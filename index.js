import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv-safe';
import express from 'express';
import querystring from 'querystring';
import SpotifyWebApi from 'spotify-web-api-node';
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

const spotifyAPI = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});
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
  const scopes = ['user-read-private', 'user-read-email'];

  res.cookie(stateKey, state);

  const authorizeUrl = spotifyAPI.createAuthorizeURL(scopes, state);
  // const loginURI = `https://accounts.spotify.com/authorize?${querystring.stringify(
  //   {
  //     response_type: 'code',
  //     client_id: CLIENT_ID,
  //     scopes,
  //     redirect_uri: REDIRECT_URI,
  //     state,
  //   }
  // )}`;

  // console.log('authUrl', authorizeUrl);
  // console.log('loginUrl', loginURI);
  res.redirect(authorizeUrl);
});

app.get('/callback', async (req, res) => {
  // request refresh and access tokens
  // only after checking the state parameter

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
    // Reset state for next login attempt
    res.clearCookie(stateKey);

    try {
      const data = await spotifyAPI.authorizationCodeGrant(code);

      const expiresIn = data.body.expires_in;
      const accessToken = data.body.access_token;
      const refreshToken = data.body.refresh_token;

      // Set the access token on the API object to use it in later calls
      spotifyAPI.setAccessToken(accessToken);
      spotifyAPI.setRefreshToken(refreshToken);

      // Pass the token to the browser for `index.html` to render FE properly
      res.redirect(
        `/#${querystring.stringify({
          accessToken,
          refreshToken,
          expiresIn,
        })}`
      );
    } catch (err) {
      res.redirect(
        `/#${querystring.stringify({
          error: 'invalid_token',
        })}`
      );
    }
  }
});

app.get('/refresh_token', async (_, res) => {
  try {
    const data = await spotifyAPI.refreshAccessToken();
    const newAccessToken = data.body.access_token;
    spotifyAPI.setAccessToken(newAccessToken);

    res.send({
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error('[refresh_token]: '.concat(err));
  }
});

app.listen(port, () =>
  console.log(`Spotify Airtable Tracker listening on port ${port}!`)
);
