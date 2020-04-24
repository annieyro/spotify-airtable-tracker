import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv-safe';
import express from 'express';
import querystring from 'querystring';
import request from 'request';
import { createUser } from './lib/airtable/request';
import { generateRandomString } from './lib/helpers';
import { synchDevProd } from './utils/synchDevProd';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app
  .use(express.static(__dirname.concat('/public')))
  .use(cors()) // Allow Cross-Origin Requests
  .use(cookieParser())
  .use(express.json()); // Format post body using JSON

const { CLIENT_ID, CLIENT_SECRET } = process.env;
const REDIRECT_URI = 'http://localhost:3000/callback'; // Your redirect uri
const base64Auth = Buffer.from(
  CLIENT_ID.concat(':').concat(CLIENT_SECRET)
).toString('base64');

const stateKey = 'spotify_auth_state';

// GET route as a sanity check when deploying
app.get('/', (_, res) => {
  res.send(
    "You've reached the Spotify Airtable Tracker backend server. Try sending a request to one of the API endpoints!"
  );
});

// POST route to create a user in Airtable
app.post('/create-user', async (req, res) => {
  console.log('Received Create User with body:');
  console.log(req.body);
  const userId = await createUser(req.body);
  res.send({ userId });
});

// Example code from DC Central Kitchen
// GET route to trigger synch from dev to prod
app.get('/synch', async (_, res) => {
  try {
    const {
      newIds,
      updatedProductNames,
      updatedProductIds,
      updatedStoreNames,
      updatedStoreIds,
    } = await synchDevProd();
    res.send({
      newIds,
      updatedProductNames,
      updatedProductIds,
      updatedStoreNames,
      updatedStoreIds,
    });
  } catch (e) {
    console.error(e);
  }
});

// Examples of People Power's API routes
app.post('/invite', async (req, res) => {
  console.log('Received Invite Request with body:');
  console.log(req.body);

  // const confirmSend =  await sendInviteEmail(req.body.pledgeInviteId);
  const confirmSend = 'dummy';
});

app.get('/approve', async (req, res) => {
  console.log('Received Approve Request with query:');
  console.log(req.query);

  const billId = req.query.id;
});

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  // your application requests authorization
  const scope = 'user-read-private user-read-email';

  res.cookie(stateKey, state);

  const loginURI = `https://accounts.spotify.com/authorize?${querystring.stringify(
    {
      response_type: 'code',
      client_id: CLIENT_ID,
      scope,
      redirect_uri: REDIRECT_URI,
      state,
    }
  )}`;

  res.redirect(loginURI);
});

app.get('/callback', (req, res) => {
  // your application requests refresh and access tokens
  // after checking the state parameter

  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      `/#${querystring.stringify({
        error: 'state_mismatch',
      })}`
    );
  } else {
    res.clearCookie(stateKey);
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      },
      headers: {
        Authorization: `Basic ${base64Auth}`,
      },
      json: true,
    };

    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const { access_token, refresh_token } = body;

        const options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: `Bearer ${access_token}` },
          json: true,
        };

        // use the access token to access the Spotify Web API
        request.get(options, (error, response, body) => {
          console.log('body', body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          `/#${querystring.stringify({
            access_token,
            refresh_token,
          })}`
        );
      } else {
        res.redirect(
          `/#${querystring.stringify({
            error: 'invalid_token',
          })}`
        );
      }
    });
  }
});

app.get('/refresh_token', (req, res) => {
  // requesting access token from refresh token
  const { refreshToken } = req.query;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization: `Basic 
      ${base64Auth}`,
    },
    form: {
      grant_type: 'refresh_token',
      refreshToken,
    },
    json: true,
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      const { access_token } = body;
      res.send({
        access_token,
      });
    }
  });
});

app.listen(port, () =>
  console.log(`Spotify Airtable Tracker listening on port ${port}!`)
);
