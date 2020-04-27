import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv-safe';
import express from 'express';
import querystring from 'querystring';
import SpotifyWebApi from 'spotify-web-api-node';
import {
  createPlaylist,
  createSong,
  createUser,
  getSongsBySpotifyId,
  getUsersByUsername,
  updateUser,
} from './lib/airtable/request';
import { generateRandomString } from './lib/helpers';

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
      const result = await createUserIfMissing(userInfo);
      airtableId = result.airtableId;
      error = result.error;
      success = result.success;
    }
    if (error) {
      res.send({ success, error });
    } else {
      res.send({ success, username, airtableId });
    }
  } catch (err) {
    res.send({ success, error: err });
    console.error('[/create-user]: '.concat(err));
  }
});

// POST route to link songs to a user in Airtable
app.post('/update-library', async (req, res) => {
  const { username, startDate, endDate } = req.body;
  let airtableIds = null;
  let error = '';
  let success = false;
  let playlistAirtableId;
  let songAirtableIds;

  // Date parsing
  const [startY, startM, startD] = startDate.split('.');
  const [endY, endM, endD] = endDate.split('.');
  const startDateTime = new Date(startY, parseInt(startM, 10) - 1, startD);
  const endDateTime = new Date(endY, parseInt(endM, 10) - 1, endD);

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
        limit: 50,
        offset: 1,
      })).body.items
        .filter((item) => {
          const dateSaved = new Date(item.added_at);
          return (
            dateSaved.getTime() > startDateTime.getTime() &&
            dateSaved.getTime() < endDateTime.getTime()
          );
        })
        .map((item) => {
          const { track } = item;
          const { name, artists, album, uri } = track;

          return {
            name,
            artist: artists
              .map((artist) => artist.name)
              .sort()
              .join(','),
            album: album.name,
            spotifyId: track.id,
            uri,
          };
        });

      const songPromises = [];
      songs.forEach((song) => {
        const songPromise = createSongIfMissing(song);
        songPromises.push(songPromise);
      });
      const songCreationResults = await Promise.all(songPromises);
      error =
        songCreationResults
          .map((result) => result.error)
          .filter((e) => e !== '').length > 0
          ? 'Error with adding one or more songs to Airtable'
          : '';

      if (!error) {
        // Too lazy to check for database malformation here. At this point, can assume the user you want is the 0th element of the array
        const userAirtable = (await getUsersByUsername(username))[0];

        songAirtableIds = songCreationResults.map(
          (result) => result.airtableId
        );

        // Create a playlist with these songs
        const playlist = (await spotifyAPI.createPlaylist(username, endDate, {
          public: false,
          description: `songs saved between ${startDate} and ${endDate}.`,
        })).body;

        const tracks = songCreationResults.map((result) => result.uri);
        await spotifyAPI.addTracksToPlaylist(playlist.id, tracks);

        // Update Airtable with playlist mapping
        playlistAirtableId = await createPlaylist({
          name: endDate,
          spotifyId: playlist.id,
          songIds: songAirtableIds,
          userId: userAirtable.id,
        });
        let playlistSet;
        if ('playlisIds' in userAirtable) {
          userAirtable.playlisIds.push(playlistAirtableId);
          playlistSet = Array.from(new Set(userAirtable.playlisIds));
        } else {
          userAirtable.playlisIds = playlistAirtableId;
        }
        // Update user with song IDs ( Airtable gracefully handles duplicates) and new playlist ID
        await updateUser(userAirtable.id, {
          songIds:
            'songIds' in userAirtable
              ? Array.from(
                  new Set(userAirtable.songIds.concat(songAirtableIds))
                )
              : songAirtableIds,
          playlisIds: playlistSet,
        });
      }
      success = true;
      airtableIds = {
        playlistId: playlistAirtableId,
        songIds: songAirtableIds,
      };
    }
    if (error !== '') {
      res.send({ success, error });
    } else {
      res.send({ success, username, airtableIds });
    }
  } catch (err) {
    res.send({ success, error: err });
    console.error('[/update-library]: '.concat(err));
  }
});

// POST route to link songs to a user in Airtable
app.post('/add-playlist', async (req, res) => {
  const { username, playlistId } = req.body;
  let airtableIds = null;
  let error = '';
  let success = false;
  let playlistAirtableId;
  let songAirtableIds;
  let playlist;

  try {
    if (currentUserId === null) {
      error =
        'Access to Spotify API denied. Please authorize Spotify at localhost:3000 before continuing!';
    } else if (!currentUserId === username) {
      error = 'May only take action for the currently authorized Spotify user';
    }
    // Get tracks in the signed in user's Your Music library
    else {
      playlist = (await spotifyAPI.getPlaylist(playlistId)).body;
      const songs = playlist.tracks.items.map((item) => {
        const { track } = item;
        const { name, artists, album, uri } = track;

        return {
          name,
          artist: artists
            .map((artist) => artist.name)
            .sort()
            .join(','),
          album: album.name,
          spotifyId: track.id,
          uri,
        };
      });
      const songPromises = [];
      songs.forEach((song) => {
        const songPromise = createSongIfMissing(song);
        songPromises.push(songPromise);
      });
      const songCreationResults = await Promise.all(songPromises);
      error =
        songCreationResults
          .map((result) => result.error)
          .filter((e) => e !== '').length > 0
          ? 'Error with adding one or more songs to Airtable'
          : '';
      if (!error) {
        // Too lazy to check for database malformation here. At this point, can assume the user you want is the 0th element of the array
        const userAirtable = (await getUsersByUsername(username))[0];
        songAirtableIds = songCreationResults.map(
          (result) => result.airtableId
        );
        const tracks = songCreationResults.map((result) => result.uri);

        // Update Airtable with playlist mapping
        playlistAirtableId = await createPlaylist({
          name: playlist.name,
          spotifyId: playlist.id,
          songIds: songAirtableIds,
          userId: userAirtable.id,
        });
        // Update user with song IDs ( Airtable gracefully handles duplicates) and new playlist ID
        let playlistSet;
        if ('playlisIds' in userAirtable) {
          userAirtable.playlisIds.push(playlistAirtableId);
          playlistSet = Array.from(new Set(userAirtable.playlisIds));
        } else {
          userAirtable.playlisIds = playlistAirtableId;
        }
        playlistSet = Array.from(new Set(userAirtable.playlisIds));
        await updateUser(userAirtable.id, {
          songIds:
            'songIds' in userAirtable
              ? Array.from(
                  new Set(userAirtable.songIds.concat(songAirtableIds))
                )
              : songAirtableIds,
          playlisIds: playlistSet,
        });
      }
      success = true;
      airtableIds = {
        playlistId: playlistAirtableId,
        songIds: songAirtableIds,
      };
    }
    if (error !== '') {
      res.send({ success, error });
    } else {
      res.send({ success, username, airtableIds });
    }
  } catch (err) {
    res.send({ success, error: err });
    console.error('[/add-playlist]: '.concat(err));
  }
});

// Returns Airtable ID of this song if exists, or creates it
const createSongIfMissing = async (song) => {
  let airtableId = null;
  let error = '';
  let success = false;
  try {
    // Check if in Airtable
    const existing = await getSongsBySpotifyId(song.spotifyId);

    if (existing.length > 1) {
      error =
        'Database malformed! Multiple songs found in Airtable with this ID. Please report an issue so we can fix this for you.';
      // No song found - create
    } else if (existing.length === 0) {
      airtableId = await createSong(song);
      success = true;
      // Otherwise, song exists.
    } else {
      airtableId = existing[0].id;
    }
  } catch (err) {
    console.error('[createSongIfMissing]: '.concat(err));
  }
  return { airtableId, error, success, uri: song.uri };
};

// Returns Airtable ID of this user if exists, or creates it
const createUserIfMissing = async (userInfo) => {
  let airtableId = null;
  let error = '';
  let success = false;
  try {
    // Check if in Airtable
    const existing = await getUsersByUsername(userInfo.id);

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
  } catch (err) {
    console.error('[createUserIfMissing]: '.concat(err));
  }
  return { airtableId, error, success };
};

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
    console.error('[/refresh_token]: '.concat(err));
  }
});

app.listen(port, () =>
  console.log(`Spotify Airtable Tracker listening on port ${port}!`)
);
