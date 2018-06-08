const BaseClient = require('./BaseClient');

/**
* The main hub for interacting with the Trello API.
* @extends {BaseClient}
*/
class Client extends BaseClient {

  /**
  * @param {ClientOptions} [options] Options for the client
  */
  constructor(options = {}) {
    super(options);

    // Validate passed options
    this._validateOptions();

    Object.defineProperty(this, 'key', { writable: true });
    if (!this.key && 'CLIENT_KEY' in process.env) {
      /**
      * Authorization token for the logged in user
      * <warn>This should be kept private at all times.</warn>
      * @type {?string}
      */
      this.key = process.env.CLIENT_KEY;
    }
    else if (!this.key && 'client_key' in options) {
      /**
      * Authorization token for the logged in user
      * <warn>This should be kept private at all times.</warn>
      * @type {?string}
      */
      this.key = options['client_key'];
    }
    else {
      this.key = null;
    }

    Object.defineProperty(this, 'token', { writable: true });
    if (!this.token && 'CLIENT_TOKEN' in process.env) {
      /**
      * Authorization secret for the logged in user
      * <warn>This should be kept private at all times.</warn>
      * @type {?string}
      */
      this.token = process.env.CLIENT_TOKEN;
    }
    else if (!this.token && 'client_token' in options) {
      /**
      * Authorization secret for the logged in user
      * <warn>This should be kept private at all times.</warn>
      * @type {?string}
      */
      this.token = options['client_token'];
    }
    else {
      this.token = null;
    }

    /**
    * Timeouts set by {@link Client#setTimeout} that are still active
    * @type {Set<Timeout>}
    * @private
    */
    this._timeouts = new Set();

    /**
    * Intervals set by {@link Client#setInterval} that are still active
    * @type {Set<Timeout>}
    * @private
    */
    this._intervals = new Set();

    // Register actions available on the client
    this.register(require('./actions/Organizations'));
    this.register(require('./actions/Boards'));
    this.register(require('./actions/Lists'));
    this.register(require('./actions/Cards'));
  }

  /**
  * Destroys the client.
  * @returns {Promise}
  */
  destroy() {
    super.destroy();
  }

  /**
  * Registers an action.
  */
  register(Action) {
    this[Action.name.replace(/Action$/, '')] = new Action(this);
  }

  /**
  * Validates the client options.
  * @param {ClientOptions} [options=this.options] Options to validate
  * @private
  */
  _validateOptions(options = this.options) {
  }
}

module.exports = Client;
