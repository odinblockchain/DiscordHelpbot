/*  Libraries
*/
const Trello        = require('./lib/trello');
const moment        = require('moment');
const EventEmitter  = require('events');

/*  Debug
*/
let debug = require('debug')('helpbot:update');

/*  Core
*/
const config    = require('./config.json');
const eventEmit = new EventEmitter();
const IgnoreLists = [
  'aim',
  'to be sorted'
];
const ReadyLabelColor = 'green';

const TrelloClientKey = config['integrations']['trello']['api']['key'];
const TrelloClientToken = config['integrations']['trello']['api']['token'];
const TrelloFAQBoard = config['integrations']['trello']['board'];
const TrelloFAQOrganization = config['integrations']['trello']['board'];

function UTCNow() {
  return moment().utc();
}

function toUnix(momentDate) {
  return momentDate.unix();
}

function timeDiff(thenDate) {
  return moment.duration(UTCNow().diff(thenDate)).asMinutes();
}

function filterAvailableQuestions(cards) {
  if (typeof cards !== 'object') throw new TypeError('Expecting Array of Cards');

  return cards.filter(card => card.labels.some(label => (label.color === ReadyLabelColor) ));
};

function removeIgnoredLists(listCollection) {
  return listCollection.filter(list => {
    return !(IgnoreLists.some(ig => RegExp(`^${list.name}$`, 'i').test(ig)));
  });
};

async function getCard(cardId) {
  const TrelloClient = new Trello.Client({
    client_key:   TrelloClientKey,
    client_token: TrelloClientToken
  });

  return new Promise((resolve, reject) => {
    TrelloClient.Cards.getCard(cardId)
    .then((card) => {
      debug(`getCard [${card.name}]`);
      resolve(card);
    }, (error) => {
      console.log('!! GET CARD ERROR', error);
      reject(error);
    });
  });
}

async function getBoards() {
  return new Promise((resolve, reject) => {
    client.Organizations.getBoards(TrelloFAQOrganization)
    .then((boards) => {
      boards.forEach(board => debug(`getBoard >> ${board.name}\n${board.id}\n`));

      resolve(boards);
    }, (error) => {
      console.log('!! GET BOARDS ERROR', error);
      reject(error);
    });
  });
}

async function purgeSupportList(Db, listKey) {
  debug('purgeSupportList');
  return new Promise((resolve, reject) => {
    purgeCardsFromList(Db, listKey)
    .then(() => {
      Db.SupportLists.del(listKey, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    })
    .catch(reject);
  });
};

async function purgeCardsFromList(Db, listKey) {
  debug('purgeCardsFromList');

  return new Promise((resolve, reject) => {
    let batchCmd = [];

    Db.SupportCards.createReadStream()
    .on('data', (data) => {
      const Card = data.value;
      if (Card.boardId === listKey) {
        debug(`purgeCard >> [${Card.boardName}] ${Card.question}`);
        batchCmd.push({ key: Card.id, type: 'del' })
      }
    })
    .on('end', () => {
      Db.SupportCards.batch(batchCmd, (err) => {
        if (err) {
          err = (err && err.message) ? err.message : '';
          return reject(new Error(`Storage Issue -- could not run batch card removal for faq list ${listName}\n${err}`));
        }
        resolve(true);
      });
    })
    .on('error', (err) => {
      err = (err && err.message) ? err.message : '';
      return reject(new Error(`Storage Issue -- could not access faq list ${listName}\n${err}`));
    })
  });
}

async function updateSupportList(Db, listKey, listData) {
  return new Promise((resolve, reject) => {
    let list = {
      id:           listData.id,
      name:         listData.name,
      board:        listData.idBoard,
      lastUpdated:  toUnix(UTCNow())
    };

    Db.put(listKey, list, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
};

async function updateSupportCard(Db, cardId, cardData, listData) {
  return new Promise((resolve, reject) => {
    let card = {
      id:           cardData.id,
      url:          cardData.url,
      question:     cardData.name,
      answer:       cardData.desc,
      shortUrl:     cardData.shortUrl,
      shortLink:    cardData.shortLink,
      boardId:      listData.id,
      boardName:    listData.name,
      lastUpdated:  toUnix(UTCNow()),
      upVotes:      0,
      downVotes:    0
    };

    Db.get(cardId, (err, cardData) => {
      if (err && !err.notFound) return reject(err);
      if (!err) {
        card.upVotes    = cardData.upVotes;
        card.downVotes  = cardData.downVotes;
      }

      Db.put(cardId, card, (err) => {
        if (err) return reject(err);
        resolve(true);
      })
    });
  });
};

// remove missing support lists from storage
// update outdated lists
let UpdateSupportLists = (Db) => {
  if (typeof Db === 'undefined' || Db === null) {
    throw new Error('[UpdateSupportLists] :: Missing Database');
  };

  debug('updateSupportLists');

  const TrelloClient = new Trello.Client({
    client_key: TrelloClientKey,
    client_token: TrelloClientToken
  });

  return new Promise((resolveUpdate, rejectUpdate) => {
    TrelloClient.Boards.getLists(TrelloFAQBoard)
    .then(Lists => {

      Lists = removeIgnoredLists(Lists);
      debug('Filtered Lists >> ', Lists.map(list => list.name).join(', '));

      new Promise((resolve, reject) => {
        let listKeys = Lists.map(list => list.id);

        debug('Searching for unknown lists...');
        Db.SupportLists.createReadStream()
        .on('data', (listData) => {
          const List = listData.value;
          if (!listKeys.includes(List.id)) {
            debug(`Found Unknown List '${List.name}'`);
            purgeSupportList(Db, List.id)
            .then(success => debug(`Removed Unknown List '${List.name}'`))
            .catch(rejectUpdate);
          }
        })
        .on('error', reject)
        .on('end', resolve)
      })
      .then(status => {
        debug('Searching for missing or outdated lists...');

        Lists.forEach(List => {
          debug(`Working list >> ${List.name}`);
          Db.SupportLists.get(List.id, (err, listData) => {
            if (err && err.notFound) {
              debug(`${List.name} NOT_FOUND ... adding`);
              updateSupportList(Db.SupportLists, List.id, List)
              .then(status => debug(`${List.name} Added`))
              .catch(rejectUpdate);
              return true;
            } else if (err) {
              return rejectUpdate(err);
            }

            let lastUpdatedDate = moment(listData.lastUpdated * 1000).utc();
            if (timeDiff(lastUpdatedDate) > 0) {
              debug(`${listData.name} OUTDATED ${timeDiff(lastUpdatedDate)}`);
              updateSupportList(Db.SupportLists, List.id, List)
              .then(success => console.log(`[UpdateSupportLists] :: Updated List '${List.name}'`))
              .catch(rejectUpdate);
            }
          })
        });

        eventEmit.emit('UPDATE_SUPPORT_LIST_COMPLETE');
        resolveUpdate(true);
      })
      .catch(rejectUpdate)
    })
    .catch(rejectUpdate);
  });
};

// remove missing support cards from storage
// update outdated support cards
// add new support cards
let UpdateSupportCards = (Db) => {
  if (typeof Db === 'undefined' || Db === null) {
    throw new Error('[UpdateSupportCards] :: Missing Database');
  };

  const TrelloClient = new Trello.Client({
    client_key: TrelloClientKey,
    client_token: TrelloClientToken
  });

  return new Promise((resolveUpdate, rejectUpdate) => {
    console.log('[UpdateSupportCards] :: Update requested');

    Db.SupportLists.createReadStream()
    .on('data', (ListData) => {
      const List = ListData.value;

      TrelloClient.Lists.getCards(List.id)
      .then(Cards => {
        Cards = filterAvailableQuestions(Cards);
        console.log(`[UpdateSupportCards] :: ${List.name} :: Total Cards >> ${Cards.length}`);

        new Promise((resolve, reject) => {
          let cardKeys = Cards.map(card => card.id);

          console.log(`[UpdateSupportCards] :: ${List.name} :: Searching for unknown cards...`);

          let storedCards = [];
          Db.SupportCards.createReadStream()
          .on('data', (cardData) => {
            if (cardData.value.boardId === List.id) {
              storedCards.push(cardData.value);
            }
          })
          .on('error', (err) => {
            console.log('error?', err);
            reject(err);
          })
          .on('end', () => {
            storedCards.forEach(card => {
              if (!cardKeys.includes(card.id)) {
                console.log(`[UpdateSupportCards] :: ${List.name} :: Found Unknown Card '${card.question}'`);
                Db.SupportCards.del(card.id, (err) => {
                  if (err) return reject(err);
                  console.log(`[UpdateSupportCards] :: ${List.name} :: Removed Unknown Card '${card.question}'`);
                });
              }
            });

            resolve(true);
          });
        })
        .then(status => {
          console.log(`[UpdateSupportCards] :: ${List.name} :: Searching for missing or outdated cards...`);

          Cards.forEach(Card => {
            console.log(`[UpdateSupportCards] :: ${List.name} :: Working Card '${Card.name}'`);
            Db.SupportCards.get(Card.id, (err, cardData) => {
              if (err && err.notFound) {
                console.log(`[UpdateSupportCards] :: ${List.name} :: Card not found, adding card '${Card.name}'`);
                updateSupportCard(Db.SupportCards, Card.id, Card, List)
                .then(status => console.log(`[UpdateSupportCards] :: ${List.name} :: Added New Card '${Card.name}'`))
                .catch(rejectUpdate);
                return true;
              } else if (err) {
                return rejectUpdate(err);
              }

              let lastUpdatedDate = moment(cardData.lastUpdated * 1000).utc();
              if (timeDiff(lastUpdatedDate) > 0) {
                console.log(`[UpdateSupportCards] :: ${List.name} :: Found Outdated Card '${cardData.question}' ... ${timeDiff(lastUpdatedDate)}`);
                updateSupportCard(Db.SupportCards, cardData.id, Card, List)
                .then(success => console.log(`[UpdateSupportCards] :: ${List.name} :: Updated Card '${cardData.question}'`))
                .catch(rejectUpdate);
              }
            })
          });
          eventEmit.emit('UPDATE_SUPPORT_CARD_COMPLETE');
          resolveUpdate(true);
        })
        .catch(rejectUpdate);
      })
      .catch(rejectUpdate);
    })
    .on('error', rejectUpdate)
    .on('end', () => { return true; });
  });
};

module.exports = {
  eventEmit: eventEmit,
  getCard: getCard,
  updateSupportLists: UpdateSupportLists,
  updateSupportCards: UpdateSupportCards
};
