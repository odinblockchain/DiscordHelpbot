/* Libraries
*/
const http          = require('http');
const express       = require('express');
const config        = require('../config.json');
const Trello        = require('../lib/trello');
const request       = require('request');

let app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, CSRF-Token, X-XSRF-TOKEN');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
  next();
});

// Respond to a request at the root level
// .replace(new RegExp('.', 'g'), 'x')
app.get('/', (req, res) => {
  

  // const TrelloClient = new Trello.Client({
  //   client_key:   config['integrations']['trello']['api']['key'],
  //   client_token: config['integrations']['trello']['api']['token'],
  // });

  var html = makeForm();
  res.send(html);
});

app.get('/submit', (req, res) => {
  console.log(req.query);
  let trelloKey = config['integrations']['trello']['api']['key'];
  let trelloToken = config['integrations']['trello']['api']['token'];
  let trelloBoard = config['integrations']['trello']['board'];
  let trelloWebhookPort = config['trelloWebhookPort'];
  let serverAddress = req.query.serverAddress;

  if (!serverAddress || serverAddress.trim() === '') {
    var html = makeForm('Server Address is missing or was empty');
    return res.send(html);
  }

  if (trelloKey === '' || trelloKey === 'YOUR_TRELLO_KEY') {
    var html = makeForm('Your Trello Key is missing or not set');
    return res.send(html);
  }

  if (trelloToken === '' || trelloToken === 'YOUR_TRELLO_TOKEN') {
    var html = makeForm('Your Trello Token is missing or not set');
    return res.send(html);
  }

  if (trelloBoard === '' || trelloBoard === 'YOUR_TRELLO_FAQ_BOARD_ID') {
    var html = makeForm('Your Trello Board ID is missing or not set');
    return res.send(html);
  }

  if (serverAddress.indexOf('//')) {
    console.log('remove //');
    serverAddress = serverAddress.split('//')[1];
  }

  if (serverAddress.indexOf('/')) {
    console.log('remove trailing /');
    serverAddress = serverAddress.substr(0, (serverAddress.length - 1));
  }

  let postData = {
    description: 'Discord HelpBot',
    callbackURL: `http://${serverAddress}:${trelloWebhookPort}/ping`,
    idModel:      trelloBoard,
    active:        true
  };
  
  let url = `https://api.trello.com/1/tokens/${trelloToken}/webhooks/?key=${trelloKey}`;
  console.log(url);

  let options = {
    method: 'post',
    body: postData,
    json: true,
    url: url
  };
  
  request(options, function (err, response, body) {
    if (err) {
      var html = makeForm((err.message) ? err.message : err);
      return res.send(html);
    }

    if (body === 'invalid key') {
      var html = makeForm('Trello Fail! Invalid Key?');
      return res.send(html);
    }

    if (body.match(/did not return 200/)) {
      var html = makeForm(`Trello Fail! They attempted to test a connection to you but could not connect.<br>Make sure this URL is acceessible from outside your network: <a href="${postData.callbackURL}" target="_blank">${postData.callbackURL}</a>.`);
      return res.send(html);
    }

    res.send(body);
  });
})

app.get('/ping', handleSuccess);
app.post('/ping', handleWebhook);

function handleSuccess(req, res) {
  res.json({ status: 'success' });
}

function handleWebhook(req, res) {
  res.json({ status: 'success' });
}

function makeForm(errors) {
  let trelloBoard = config['integrations']['trello']['board'];
  if (errors) {
    errors = `
    <h3>Response Error:</h3>
    <p>${errors}</p>
    <br>
    `;
  }

  let html = `
<!doctype html>
<head>
  <title>Trello Webhook Setup</title>
</head>
<body>
  <h1>Setup Trello Webhook</h1>
  <p>Trello Board:<br>${trelloBoard}</p>
  <br>
  <form action="/submit" method="GET">
    ${errors}
    <p>
      <label for="serverAddress">Server Address:<br>
      <input id="serverAddress" name="serverAddress" type="text" required>
    </p>
    <p>
      <button type="submit">Create Webhook</button>
    </p>
  </form>
</body>
`
  return html;
}

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
server.listen(config.trelloWebhookPort);
server.on('error', onError);
server.on('listening', onListening);
