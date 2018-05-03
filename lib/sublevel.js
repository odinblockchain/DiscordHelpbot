let level     = require('level');
let path      = require('path');
let sublevel  = require('level-sublevel');
let dbPath    = process.env.DB_PATH || path.join(__basedir, 'db');

let db = sublevel(level(dbPath, {
  valueEncoding: 'json'
}));

db.on('put', function (key, value) {
  console.log('DB :: PUT', { key, value })
});

db.on('del', function (key) {
  console.log('DB :: DELETE', key);
});

db.on('open', function () {
  console.log('DB :: OPEN');
});

db.on('closed', function () {
  console.log('DB :: CLOSE');
});

module.exports = {
  base: db,
  trelloLists: db.sublevel('lists'),
  SupportLists: db.sublevel('lists'),
  SupportCards: db.sublevel('cards')
};
