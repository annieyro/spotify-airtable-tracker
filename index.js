import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv-safe';
import express from 'express';
import querystring from 'querystring';
import SpotifyWebApi from 'spotify-web-api-node';
import { createUser, getUsersByUsername } from './lib/airtable/request';
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
const stateKey = 'spotify_auth';

let currentUserId = null;

// GET route as a sanity check when deploying
app.get('/', (_, res) => {
  res.send(
    "You've reached the Spotify Airtable Tracker backend server. Try sending a request to one of the API endpoints!"
  );
});

/* POST routes: expect body to contain {username: <SPOTIFY_USERNAME} and only succeed if currently signed in */

// POST route to create a user in Airtable
app.post('/create-user', async (req, res) => {
  console.log('Received Create User with body:');
  console.log(req.body);
  const { username } = req.body;
  let airtableId = null;
  let error = '';
  let success = false;
  try {
    if (currentUserId === null) {
      error =
        'Access to Spotify API denied. Please authorize Spotify at localhost:3000 before continuing!';
    } else if (!currentUserId === username) {
      error = 'May only take action for the currently authorized Spotify user';
    } else {
      const userInfo = (await spotifyAPI.getMe()).body;

      // Check if in Airtable
      const existing = await getUsersByUsername(username);
      console.log(username);
      console.log(existing);
      if (existing.length > 1) {
        error =
          'Database malformed! Multiple users found in Airtable with this username. Please report an issue so we can fix this for you.';
        // No user found - create
      } else if (existing.length === 0) {
        airtableId = await createUser({
          name: userInfo.display_name,
          email: userInfo.email,
          username: userInfo.id,
        });
        success = true;
        // Otherwise, user exists.
      } else {
        airtableId = existing[0].id;
      }
    }
    if (error) {
      res.send({ success, error });
    } else {
      res.send({ success, username, airtableId });
    }
  } catch (err) {
    res.send({ success, error: err });
    console.error('[create-user]: '.concat(err));
  }
});

// POST route to link songs to a user in Airtable
app.post('/update-library', async (req, res) => {
  const { username } = req.body;
  const airtableIds = null;
  let error = '';
  const success = false;
  try {
    if (currentUserId === null) {
      error =
        'Access to Spotify API denied. Please authorize Spotify at localhost:3000 before continuing!';
    } else if (!currentUserId === username) {
      error = 'May only take action for the currently authorized Spotify user';
    }
    // Get tracks in the signed in user's Your Music library
    else {
      const songs = (await spotifyAPI.getMySavedTracks({
        limit: 10,
        offset: 1,
      })).body.items;
      console.log(songs);

      // For each song, check if it exists in Airtable already
      // Otherwise create it

      // Create a playlist with these songs

      // Update user with song IDs ( Airtable gracefully handles duplicates) and new playlist ID
    }
    if (error) {
      res.send({ success, error });
    } else {
      res.send({ success, username, airtableIds });
    }
  } catch (err) {
    res.send({ success, error: err });
    console.error('[update-library]: '.concat(err));
  }
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
app.get('/approve', async (req, res) => {
  console.log('Received Approve Request with query:');
  console.log(req.query);

  const billId = req.query.id;
});

// Spotify Authentication
app.get('/login', (_, res) => {
  const state = generateRandomString(16);
  // your application requests authorization
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'playlist-read-private',
    'playlist-modify-private',
  ];

  res.cookie(stateKey, state);

  const authorizeUrl = spotifyAPI.createAuthorizeURL(scopes, state);

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

      const userInfo = await spotifyAPI.getMe();
      currentUserId = userInfo.body.id;

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
