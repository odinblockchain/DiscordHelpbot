const Action = require('./Action');

class Member extends Action {
  constructor(options = {}) {
    super(options);
  }

  getOrganizations(id = 'my') {
    return this.client.api.request(`/members/${id}/organizations`);
  }
}

module.exports = Member;
