let level     = require('level');
let path      = require('path');
let sublevel  = require('level-sublevel');
let dbPath    = process.env.DB_PATH || path.join(__basedir, 'db');
let debug     = require('debug')('helpbot:sublevel');

let db = sublevel(level(dbPath, {
  valueEncoding: 'json'
}));

db.on('put', function (key, value) {
  debug('PUT', { key, value });
  // console.log('DB :: PUT', { key, value })
});

db.on('del', function (key) {
  debug('DELETE', key);
  // console.log('DB :: DELETE', key);
});

db.on('open', function () {
  debug('OPEN');
  // console.log('DB :: OPEN');
});

db.on('closed', function () {
  debug('CLOSE');
  // console.log('DB :: CLOSE');
});

module.exports = {
  base: db,
  trelloLists:  db.sublevel('lists'),
  SupportLists: db.sublevel('lists'),
  SupportCards: db.sublevel('cards')
};
