/* Libraries
*/
const http          = require('http');
const express       = require('express');
const bodyParser    = require('body-parser');
const Update        = require('./update');
const EventEmitter  = require('events');

/*  Debug
*/
let debug = require('debug')('helpbot:webhook');

/* Core
*/
let eventEmit = new EventEmitter();

class WebhookServer {
  constructor() {
    this.app    = null;
    this.server = null;
    this.port   = this.normalizePort(process.env.PORT || '5000');
  }

  init() {
    this.app = express();
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, CSRF-Token, X-XSRF-TOKEN');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
      next();
    });

    this.app.get('/ping', this.handleSuccess);
    this.app.post('/ping', this.handleWebhook);

    this.app.use((err, req, res, next) => {
      console.log('\n[Webhook] Encountered Error', err, '\n\n');
      res.status(err.status || 501);
      res.json({
        status: 'error',
        message: err.message,
        error: err
      });
    });

    this.app.set('port', this.port);

    this.server = http.createServer(this.app);
    this.server.listen(this.port);
    this.server.on('error', WebhookServer.onError);
    this.server.on('listening', WebhookServer.onListening);
  }

  handleSuccess(req, res) {
    res.json({ status: 'success' });
  }

  handleWebhook(req, res) {
    let data  = {},
        type  = '';

    debug('handleWebhook');
    if (req.body.action && req.body.action.data) {
      data = req.body.action.data;
      type = req.body.action.type;
      debug(`webhook :: ${type}`)

      if (type === 'updateCard') {
        Update.getCard(data.card.id)
        .then(card => {
          if (card.labels.some(c => c.color === 'green'))
            eventEmit.emit('WEBHOOK_UPDATE');
        });
      }
      else if (type === 'updateList') {
        if (data.old && data.old.hasOwnProperty('name'))
          eventEmit.emit('WEBHOOK_UPDATE');
      }
      else if ( (type === 'addLabelToCard' || type === 'removeLabelFromCard')
                && data.value === 'green') {
        eventEmit.emit('WEBHOOK_UPDATE');
      }
    }

    res.json({
      status: 'success',
      type: type,
      data: data
    });
  }

  normalizePort(val) {
    let port = parseInt(val, 10);

    // named pipe
    if (isNaN(port)) return val;

    // port number
    if (port >= 0) return port;

    return false;
  }

  // Event handler for Server Listening
  // @this refers to the Server instance
  static onListening() {
    let addr = this.address(),
        bind = (typeof addr === 'string')
          ? `pipe ${addr}`
          : `port ${addr.port}`;

    console.log(`[Helpbot::Webhook] Listening on ${bind}`);
  }

  // Event handler for Server Error
  // @this refers to the Server instance
  static onError(error) {
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
}

module.exports = {
  Server: WebhookServer,
  eventEmit: eventEmit
};
