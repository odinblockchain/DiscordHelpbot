const Action = require('./Action');

class Boards extends Action {
  constructor(options = {}) {
    super(options);
  }

  async getLists(boardId = '') {
    if (boardId === '') throw new ReferenceError('INVALID_BOARD_ID');
    return await this.client.api.request(`/boards/${boardId}/lists`);
  }

  async getCards(boardId = '') {
    if (boardId === '') throw new ReferenceError('INVALID_BOARD_ID');
    return this.client.api.request(`/boards/${boardId}/cards`);
  }
}

module.exports = Boards;
