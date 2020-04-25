/* eslint no-restricted-imports: 0 */
/* eslint-disable no-unused-vars */

/*
  THIS IS A GENERATED FILE
  Changes might be overwritten in the future, edit with caution!

  Wrapper functions around functions in airtable.js that interact with Airtable, designed
  to provide basic functionality

  If you're adding a new function: make sure you add a corresponding test (at least 1) for it in request.spec.js

*/

import { Tables, Columns } from './schema';
import {
  createRecord,
  updateRecord,
  getAllRecords,
  getRecordsByAttribute,
  getRecordById,
  deleteRecord,
} from './airtable';

/*
 ******* CREATE RECORDS *******
 */

export const createUser = async (record) => {
  return createRecord(Tables.User, record);
};

export const createSong = async (record) => {
  return createRecord(Tables.Song, record);
};

export const createPlaylist = async (record) => {
  return createRecord(Tables.Playlist, record);
};

/*
 ******* READ RECORDS *******
 */

export const getUserById = async (id) => {
  return getRecordById(Tables.User, id);
};

export const getUsersByIds = async (ids) => {
  const formula = `OR(${ids.reduce(
    (f, id) => `${f} {ID}='${id}',`,
    ''
  )} 1 < 0)`;
  return getAllRecords(Tables.User, formula);
};

export const getAllUsers = async (filterByFormula = '', sort = []) => {
  return getAllRecords(Tables.User, filterByFormula, sort);
};

export const getUsersByUsername = async (value, sort = []) => {
  return getRecordsByAttribute(
    Tables.User,
    Columns[Tables.User].username.name,
    value,
    sort
  );
};

export const getSongById = async (id) => {
  return getRecordById(Tables.Song, id);
};

export const getSongsByIds = async (ids) => {
  const formula = `OR(${ids.reduce(
    (f, id) => `${f} {ID}='${id}',`,
    ''
  )} 1 < 0)`;
  return getAllRecords(Tables.Song, formula);
};

export const getAllSongs = async (filterByFormula = '', sort = []) => {
  return getAllRecords(Tables.Song, filterByFormula, sort);
};

export const getSongsBySpotifyId = async (value, sort = []) => {
  return getRecordsByAttribute(
    Tables.Song,
    Columns[Tables.Song].spotifyId.name,
    value,
    sort
  );
};

export const getPlaylistById = async (id) => {
  return getRecordById(Tables.Playlist, id);
};

export const getPlaylistsByIds = async (ids) => {
  const formula = `OR(${ids.reduce(
    (f, id) => `${f} {ID}='${id}',`,
    ''
  )} 1 < 0)`;
  return getAllRecords(Tables.Playlist, formula);
};

export const getAllPlaylists = async (filterByFormula = '', sort = []) => {
  return getAllRecords(Tables.Playlist, filterByFormula, sort);
};

/*
 ******* UPDATE RECORDS *******
 */

export const updateUser = async (id, recordUpdates) => {
  return updateRecord(Tables.User, id, recordUpdates);
};

export const updateSong = async (id, recordUpdates) => {
  return updateRecord(Tables.Song, id, recordUpdates);
};

export const updatePlaylist = async (id, recordUpdates) => {
  return updateRecord(Tables.Playlist, id, recordUpdates);
};

/*
 ******* DELETE RECORDS *******
 */

export const deleteUser = async (id) => {
  return deleteRecord(Tables.User, id);
};
export const deleteSong = async (id) => {
  return deleteRecord(Tables.Song, id);
};
export const deletePlaylist = async (id) => {
  return deleteRecord(Tables.Playlist, id);
};
