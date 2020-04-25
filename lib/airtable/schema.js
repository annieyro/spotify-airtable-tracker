/*
    THIS IS A GENERATED FILE
    Changes might be overwritten in the future, edit with caution!
*/

export const Tables = {
  User: 'User',
  Song: 'Song',
  Playlist: 'Playlist',
};

export const Columns = {
  User: {
    primaryKey: { name: `Primary Key`, type: `text` },
    username: { name: `Username`, type: `text` },
    email: { name: `Email`, type: `text` },
    id: { name: `id`, type: `formula` },
    songIds: { name: `Songs`, type: `foreignKey-many` },
    playlisIds: { name: `Playlist`, type: `foreignKey-many` },
    name: { name: `Name`, type: `text` },
  },
  Song: {
    primaryKey: { name: `Primary Key`, type: `text` },
    artist: { name: `Artist`, type: `text` },
    userIds: { name: `Users`, type: `foreignKey-many` },
    playlistIds: { name: `Playlists`, type: `foreignKey-many` },
    id: { name: `id`, type: `formula` },
    name: { name: `Name`, type: `text` },
    spotifyId: { name: `Spotify Id`, type: `text` },
    album: { name: `Album`, type: `text` },
    uri: { name: `Uri`, type: `text` },
  },
  Playlist: {
    primaryKey: { name: `Primary Key`, type: `text` },
    songIds: { name: `Songs`, type: `foreignKey-many` },
    created: { name: `Created`, type: `formula` },
    userId: { name: `User`, type: `foreignKey-one` },
    id: { name: `id`, type: `formula` },
    name: { name: `Name`, type: `text` },
    spotifyId: { name: `Spotify Id`, type: `text` },
  },
};
