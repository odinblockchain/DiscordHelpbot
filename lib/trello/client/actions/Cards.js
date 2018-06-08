const Action = require('./Action');

class Cards extends Action {
  constructor(options = {}) {
    super(options);
  }

  async getCard(cardId = '') {
    if (cardId === '') throw new ReferenceError('INVALID_CARD_ID');
    return this.client.api.request(`/cards/${cardId}`);
  }
}

module.exports = Cards;
