const Util = require('./util/Util');

module.exports = {
  // Primary Classes
  BaseClient: require('./client/BaseClient'),
  Client: require('./client/Client'),

  // Utilities
  Util: Util,
  util: Util
  // version: require('../package.json').version
}
