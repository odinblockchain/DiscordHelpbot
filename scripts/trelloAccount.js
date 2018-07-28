/* Libraries
*/
const http          = require('http');
const express       = require('express');
const config        = require('../config.json');
const Trello        = require('../lib/trello');
const prettyHtml    = require('json-pretty-html').default;

let app = express();
let prettyCSS = `
body {
  font-family: Menlo, Monaco, "Courier New", monospace;
  font-weight: normal;
  font-size: 14px;
  line-height: 16px;
  letter-spacing: 0;
  background-color: #24282A;
  color: #d4d4d4;
  text-align: left;
  border-top: 1px solid #121516;
  padding-top: 10px;
  padding-bottom: 10px;
  margin: 0;
}
.json-pretty {
  padding-left: 30px;
  padding-right: 30px;
}
.json-selected {
  background-color: rgba(139, 191, 228, 0.19999999999999996);
}

.json-string {
  color: #6caedd;
}

.json-key {
  color: #ec5f67;
}

.json-boolean {
  color: #99c794;
}

.json-number {
  color: #99c794;
}
`;

// Respond to a request at the root level
// .replace(new RegExp('.', 'g'), 'x')
app.get('/', (req, res) => {
  const TrelloClient = new Trello.Client({
    client_key:   config['integrations']['trello']['api']['key'],
    client_token: config['integrations']['trello']['api']['token'],
  });

  TrelloClient.Member.getOrganizations()
  .then((memberOrganizations) => {

    let organizations = {};
    let _promises = [];
    for (organization of memberOrganizations) {
      organizations[organization.id] = {
        id:           organization.id,
        name:         organization.displayName,
        description:  organization.desc,
        url:          organization.url,
        boards: {}
      };

      _promises.push(TrelloClient.Organizations.getBoards(organization.id));
    }

    Promise.all(_promises)
    .then((organizationBoards) => {

      for (boardList of organizationBoards) {
        
        for (board of boardList) {
          organizations[board.idOrganization].boards[board.id] = {
            id:           board.id,
            name:         board.name,
            description:  board.desc,
            shortLink:    board.shortLink,
            url:          board.url
          };
        }
      }

      var html = 
      `
      <!doctype html>
      <head>
        <title>Your Trello Organizations</title>
        <style>${prettyCSS}</style>
      </head>
      <body>${prettyHtml(organizations)}</body>
      `
      res.send(html);

      // terminate this process after a successful grab
      process.exit(1);
    });
  }, (error) => {
    res.json({ status: 'error', error: error });
    process.exit(1);
  });
});


function onError(error) {
  if (error.syscall !== 'listen') throw error

  let bind = (typeof this.port === 'string')
    ? `Pipe ${port}`
    : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  let addr = this.address(),
      bind = (typeof addr === 'string')
        ? `pipe ${addr}`
        : `http://localhost:${addr.port}`;

  console.log(`Showing your Trello Account on ${bind}/`);
}

let server = http.createServer(app);
server.listen(3000);
server.on('error', onError);
server.on('listening', onListening);
