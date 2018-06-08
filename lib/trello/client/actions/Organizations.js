const Action = require('./Action');

class Organizations extends Action {
  constructor(options = {}) {
    super(options);
  }

  getBoards(id = 'my') {
    return this.client.api.request(`/organizations/${id}/boards`);
  }
}

module.exports = Organizations;
