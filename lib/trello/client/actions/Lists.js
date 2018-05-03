const Action = require('./Action');

class Lists extends Action {
  constructor(options = {}) {
    super(options);
  }

  async getCards(listId) {
    if (typeof listId === 'undefined' || listId === null || listId === '') {
      throw new ReferenceError('INVALID_LIST_ID');
    };

    return this.client.api.request(`/lists/${listId}/cards`);
  }
}

module.exports = Lists;
