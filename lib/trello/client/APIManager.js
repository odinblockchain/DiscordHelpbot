const Request = require('request');
const Util    = require('../util/Util');

/**
* The main hub for interacting with the Trello API.
*/
class APIManager {
  constructor(client) {
    this.client = client;
    this.TrelloAPIURL = 'https://api.trello.com/1';
  }

  requestOpts(options = {}) {
    let defaultOptions = {
      method: 'GET',
      qs: {
        key: this.client.key,
        token: this.client.token
      }
    };

    return Util.mergeDefault(defaultOptions, options);
  }

  request(path) {
    return new Promise((resolve, reject) => {
      let opts = this.requestOpts({
        url: `${this.TrelloAPIURL}${path}`
      });

      Request(opts, (error, response, body) => {

        if (error) return reject(new Error(error));
        try {
          return resolve(JSON.parse(body));
        } catch (err) {
          console.log('MALFORMED TRELLO RESPONSE', body);
          return reject(new Error('Unparsable Body'));
        }
      });
    });
  }
}

module.exports = APIManager;
