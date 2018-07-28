/*
  UPDATES --

  1)  Pull current support lists from Trello
      --  Compare stored lists with pulled data
      IF stored list not found in pulled data
        1) Remove all support cards associated with stored list
        2) Remove stored list
      -- Check if pulled data is stored
      IF pulled data not stored
        1) Save pulled data as a new list entry
      -- Check if any stored list is old
      IF stored list is old
        1) Update stored list with current pull

  2)  Loop through stored support lists
      -- Pull cards for list from Trello
      -- Filter cards for cards marked "ready"
      -- Loop through each card for support list
      IF stored card not found in pulled data
        1) Remove card
      IF pulled data not stored
        1) Save card as new entry
      IF stored card is old
        1) Save updated card information

  3)  Update internal data of supportLists and supportCards


  Discord Channel Types:
   - dm       : a DM channel
   - group    : a Group DM channel
   - text     : a guild text channel
   - voice    : a guild voice channel
   - category : a guild category channel
*/
global.__basedir = __dirname;

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('UnhandledRejection', error.message);
});

/*  Libraries
*/
const Discord   = require('discord.js');
const Db        = require('./lib/sublevel');
const Level     = require('./lib/sublevel');
const Update    = require('./update');
const Webhook   = require('./webhook');
const Fuzzyset  = require('fuzzyset.js');

/*  Debug
*/
let debug = require('debug')('helpbot:index');

/*  Core
*/
const Client        = new Discord.Client();
const WebhookServer = new Webhook.Server();
const config        = require('./config.json');

/*  Datasets
*/
let supportLists  = [],
    supportCards  = [],
    supportTopics = [];

let greetMember = (member, supportChannels) => {
  supportChannels = supportChannels.map(id => `<#${id}>`).join(' --- ');

  return `Welcome fellow traveler ${member}, to the ODIN Discord Community! If you have any questions, i'll be available in these channels to help! ${supportChannels}\nSimply type \`${config.prefix}ask your_question_here\` OR \`${config.prefix}help\` in either of those channels.`
}

let getAllowedChannels = () => {
  let Guild = Client.guilds.find(g => g.name.toLowerCase() === config.primaryGuild.toLowerCase());
  return Guild.channels.filter(c => (c.type === 'text' && isAllowedChannel(c.name)));
}

let isAllowedChannel = (channelName) => {
  console.log('isallowed?', channelName);
  let regFind = new RegExp(`${config['primaryChannelMatch']}`, 'i');
  return channelName.match(regFind);
  // console.log(channelName.match(regFind));
  // return (regFind.test(config.primaryChannel));
};

let isIgnoredList = (listName) => {
  let regFind = new RegExp(`^${listName}$`, 'i');
  return (config.ignoreSupportLists.some(l => regFind.test(l.toLowerCase())));
}

let isPrimaryChannel = (channelName) => {
  let regFind = new RegExp(`^${channelName}$`, 'i');
  return (regFind.test(config.primaryChannel.toLowerCase()));
}

let isPrimaryTopic = (card) => {
  return (card.boardName.toLowerCase() === config.keywordTopicList.toLowerCase());
}

let buildSupportLists = () => {
  debug('buildSupportLists');

  supportLists  = [];
  supportCards  = [];
  supportTopics = [];

  Db.SupportLists.createReadStream()
  .on('data', (listData) => {
    let List = listData.value;

    if (!isIgnoredList(List.name)) {
      debug(`buildSupportLists :: add Support List :: ${List.name}`);
      supportLists.push({
        name: List.name,
        id: List.id,
        cards: []
      });
    }
  })
  .on('error', (err) => {
    console.log('ERR building list', err);
  })
  .on('end', () => {
    Db.SupportCards.createReadStream()
    .on('data', (cardData) => {
      let Card = cardData.value;

      if (isPrimaryTopic(Card)) {
        debug(`buildSupportLists :: add Keyword Topic :: ${Card.question}`);
        supportTopics.push(Card);
      }
      else {
        let matchingListIndex = supportLists.findIndex(list => (list.id === Card.boardId));

        if (matchingListIndex !== -1) {
          supportLists[matchingListIndex].cards.push(Card);
          supportCards.push({
            id:         Card.id,
            listLabel:  Card.boardName,
            shortId:    Card.shortLink,
            question:   Card.question,
            answer:     Card.answer,
            shortUrl:   Card.shortUrl
          });
        }
        else {
          debug(`!No matching supportList for ${Card.question} -- ${Card.id}`);
        }
      }
    })
    .on('error', (err) => {
      console.log('ERR building cards', err);
    })
  });
};

/*
  Applies a Vote to a given Card.
  if voteModifier >= 1 then UPVOTE
  if voteModifier <= 0 then DOWNVOTE
*/
function submitVote(card, voteModifier) {
  Db.SupportCards.get(card.id, (err, card) => {
    if (err) return console.log(`[submitVote] ERROR`, err);

    if (voteModifier >= 1) {
      card.upVotes = Number(card.upVotes) + 1;
    }
    else if (voteModifier <= 0) {
      card.downVotes = Number(card.downVotes) + 1;
    }

    Level.SupportCards.put(card.id, card, (err) => {
      if (err) return console.log(`[submitVote] SAVE ERROR`, err);
      debug('SAVED?', card);
    });
  });
}

/*
  Removes a Vote from a given Card.
  if voteModifier >= 1 then UPVOTE
  if voteModifier <= 0 then DOWNVOTE
*/
function removeVote(card, voteModifier) {
  Db.SupportCards.get(card.id, (err, card) => {
    if (err) return console.log(`[removeVote] ERROR`, err);

    if (voteModifier >= 1) {
      card.upVotes = Number(card.upVotes) - 1;
      if (card.upVotes <= 0) card.upVotes = 0;
    }
    else if (voteModifier <= 0) {
      card.downVotes = Number(card.downVotes) - 1;
      if (card.downVotes <= 0) card.downVotes = 0;
    }

    Level.SupportCards.put(card.id, card, (err) => {
      if (err) return console.log(`[removeVote] SAVE ERROR`, err);
      debug('SAVED?', card);
    });
  });
}

function handleMessageReaction(reactionType, reaction) {
  if (reactionType === 'add' &&
      reaction.users.last().bot === true) return ;
  else if (reactionType === 'remove' &&
           reaction.users.last().bot !== true) return;

  // ignore posts other than self
  if (reaction.message.author.id !== Client.user.id) return;

  // ignore regular reactions
  if (reaction.message.embeds.length === 0 ||
      reaction.message.embeds[0].footer === null) return console.log('no embed/footer');

  debug('[DiscordHelpbot] :: handleReaction', {
    name: reaction.emoji.name,
    emojiId: reaction.emoji.identifier,
    check: reaction.me,
    users: reaction.users.last().username
  });

  try {
    let idRegex = /\(([^)]+)\)/;
    let regExec = idRegex.exec(reaction.message.embeds[0].footer.text);

    let card = supportCards.find(card => card.shortId === regExec[1]);
    if (card) {
      let fn = ((t) => {
        switch(t) {
          case 'add': return submitVote;
          case 'remove': return removeVote;
          default: return false;
        }
      })(reactionType);

      if (fn) {
        if (reaction.emoji.identifier === '%F0%9F%91%8D') fn(card, 1);
        else if (reaction.emoji.identifier === '%F0%9F%91%8E') fn(card, 0);
        else console.log('[DiscordHelpbot] :: handleReaction :: Unsupported Reaction');
      }
      else {
        console.log('[DiscordHelpbot] :: handleReaction :: Could not determine function');
      }
    }
  } catch(err) {
    console.log('[DiscordHelpbot] :: handleReaction :: Err', err);
  }
}

function createEmbedGreeting(user) {
  let helpbotAvatar = 'https://odn-platform.nyc3.digitaloceanspaces.com/odin--image--explorer.jpg';
  let direction = ['Norðri', 'Austri', 'Suðri', 'Vestri'][Math.floor(Math.random()*4)];

  return new Discord.RichEmbed({
    'author': {
      'name': 'Welcome Traveler, To The ODIN Tribe',
      'icon_url': helpbotAvatar
    },
    'color': 8426988,
    'description': `We welcome you, ${user.username} of the ${direction}, into our community of fellow explorers. Should you find yourself with a question, I will be available to share what knowledge I have in our dedicated support channels:\n${getAllowedChannels().map(c => `<#${c.id}>`).join('\n')}\n\nYou may also seek wisdom from one of our Tribal Leaders, or a Core Tribe Member.\n\n[some nordic quote here]`,
    'thumbnail': {
      'url': helpbotAvatar
    }
  });
}

function createEmbedList(title, list) {
  let helpbotAvatar = 'https://odn-platform.nyc3.digitaloceanspaces.com/odin--image--explorer.jpg';

  return new Discord.RichEmbed({
    'author': {
      'name': title,
      'icon_url': helpbotAvatar
    },
    'color': 8426988,
    'description': list.join('\n'),
    'thumbnail': {
      'url': helpbotAvatar
    }
  });
}

function createEmbedAnswer(faqCard) {
  let helpbotAvatar = 'https://odn-platform.nyc3.digitaloceanspaces.com/odin--image--explorer.jpg';
  
  // let commentLink = `\n\n[Leave a comment on Trello](${faqCard.shortUrl})`;
  let commentLink = '';

  let embed = new Discord.RichEmbed({
    'author': {
      'name': faqCard.question,
      'icon_url': helpbotAvatar
    },
    'color': 8426988,
    'description': `${faqCard.answer}${commentLink}`,
    'url': faqCard.shortUrl,
    'thumbnail': {
      'url': helpbotAvatar
    },
    'footer': {
      text: `Was this answer helpful? 👍 👎 (${faqCard.shortId})`
    }
  });

  // embed.attachFile(faqCard.id);
  return embed;
}

function createEmbedPost(faqCard) {
  let helpbotAvatar = 'https://odn-platform.nyc3.digitaloceanspaces.com/odin--image--explorer.jpg';

  // let commentLink = `\n\n[Leave a comment on Trello](${faqCard.shortUrl})`;
  let commentLink = '';

  return new Discord.RichEmbed({
    'author': {
      'name': faqCard.question,
      'icon_url': helpbotAvatar
    },
    'color': 8426988,
    'description': `${faqCard.answer}${commentLink}`,
    'url': faqCard.shortUrl,
    'thumbnail': {
      'url': helpbotAvatar
    }
  });
}

function createEmbedHelpPost() {
  let helpbotAvatar = 'https://odn-platform.nyc3.digitaloceanspaces.com/odin--image--explorer.jpg';

  let primaryTopics = '';
  supportTopics.forEach(card => {
    primaryTopics += `\`${config.prefix}${card.question}\`\n`;
  });

  return new Discord.RichEmbed({
    'author': {
      'name': 'ODIN Helpbot',
      'icon_url': helpbotAvatar
    },
    'color': 8426988,
    'description': `**Ask a Question**\n\`${config.prefix}ask _question_\`\n\n**View Top Questions**\n\`${config.prefix}top\`\n\n**View All Support Categories**\n\`${config.prefix}lists\`\n\n**View Support Category Questions**\n\`${config.prefix}list _category_\`\n\n**Support Topics**\n${primaryTopics}`,
    'thumbnail': {
      'url': helpbotAvatar
    }
  });
}

function createEmbedTopList(supportCards) {
  let helpbotAvatar = 'https://odn-platform.nyc3.digitaloceanspaces.com/odin--image--explorer.jpg';

  let embedDesc = '';
  supportCards.forEach(card => {
    embedDesc += `**${card.question}**\n\`👍 ${card.upVotes} 👎 ${card.downVotes}\`\n\n`;
  });

  return new Discord.RichEmbed({
    'author': {
      'name': 'Top Questions',
      'icon_url': helpbotAvatar
    },
    'color': 8426988,
    'description': embedDesc,
    'thumbnail': {
      'url': helpbotAvatar
    }
  });
}

function findGuildChannel(guildName, channelName) {
  debug(`findGuildChannel [${guildName}] [${channelName}`);
  
  return Client.guilds.find(guild => guild.name.toLowerCase() === guildName.toLowerCase())
  .channels.find(channel => channel.name.toLowerCase() === channelName.toLowerCase());
}

function sendMessageToGuildChannel(guildName, channelName, message) {
  debug(`sendMessageToGuildChannel [${guildName}] [${channelName}`);

  let channel = findGuildChannel(guildName, channelName);
  if (!channel) {
    debug('channel not found!');
    return false;
  }

  channel.send(message);
}

// 472740259554131969
// This event will run if the bot starts, and logs in, successfully
Client.on("ready", () => {
  let package = require('./package.json');

  console.log(`Bot has started, with ${Client.users.size} users, in ${Client.channels.size} channels of ${Client.guilds.size} guilds.`);

  let guilds = {};
  Client.guilds.map((guild) => {
    guilds[guild.name] = {
      id: guild.id,
      members: guild.memberCount,
      channels: {}
    };

    guild.channels.map((channel) => {
      guilds[guild.name].channels[channel.name] = {
        id: channel.id,
        type: channel.type
      };

      if (channel.type !== 'category')
        guilds[guild.name].channels[channel.name].parent = (channel.parent) ? channel.parent.name : 'no_parent';
    });
  });

  let channels = {};
  Client.channels.map((channel) => {
    channels[channel.id];
  });



  let util = require('util');
  console.log(util.inspect(channels, false, null));

  // sendMessageToGuildChannel('bufferzone', 'support', 'hello');

  Client.user.setActivity(`HelpBot ${package.version}`);
  buildSupportLists();
});

// This event triggers when the bot joins a server
Client.on("guildCreate", guild => {
  let package = require('./package.json');
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members.`);

  let regFind = new RegExp(`${config['primaryChannelMatch']}`, 'i');
  let channels = guild.channels.array();
  let supportChannels = [];
  let primaryChannel = null;

  for (let channel of channels) {
    
    // console.log('channel', {
    //   type: channel.type,
    //   id: channel.id,
    //   name: channel.name,
    //   match: channel.name.match(regFind)
    // });

    if (channel.type === 'text' && channel.name.match(regFind)) {
      supportChannels.push(channel.id);
    }

    if (channel.name === 'general' && channel.type === 'text' && primaryChannel === null) {
      primaryChannel = channel;
    }
  }

  primaryChannel.send(`beep-boop -- Greetings fellow settlers! If you have any questions, please head over to any of these channels:\n${supportChannels.map(id => `<#${id}>`).join('\n')}\n\nI'll do my best to help answer questions around here! Simply type \`${config.prefix}ask your_question_here\` or \`${config.prefix}help\``);

  Client.user.setActivity(`HelpBot ${package.version}`);
});

// this event triggers when the bot is removed from a guild
Client.on("guildDelete", guild => {
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
});

// Create an event listener for new guild members
// Send the message to a designated channel on a server:
Client.on('guildMemberAdd', member => {
  // const channel = member.guild.channels.find('name', 'general');
  // if (!channel) return;

  let regFind = new RegExp(`${config['primaryChannelMatch']}`, 'i');
  let channels =  member.guild.channels.array();
  let supportChannels = [];
  let primaryChannel = null;

  for (let channel of channels) {
    
    // console.log('channel', {
    //   type: channel.type,
    //   id: channel.id,
    //   name: channel.name,
    //   match: channel.name.match(regFind)
    // });
    if (channel.type === 'text' && channel.name.match(regFind)) {
      supportChannels.push(channel.id);
    }

    if (channel.name === 'general' && channel.type === 'text' && primaryChannel === null) {
      primaryChannel = channel;
    }
  }

  primaryChannel.send(greetMember(member, supportChannels));


  // Send the message, mentioning the member
  // channel.send(greetMember(member));
  // member.send(createEmbedGreeting(member.user));
  // member.send(greetMember(member))
  // .then(message => {
  //   console.log(`Sent welcome message to ${member.displayName}`);
  // })
});

Client.on("error", (err) => {
  console.log('Client error', err.error);
});

Client.on('messageReactionAdd', (r) => handleMessageReaction('add', r));
Client.on('messageReactionRemove', (r) => handleMessageReaction('remove', r));

// This event will run on every single message received (Channel + DM)
Client.on("message", async message => {

  // Ignore bots
  if (message.author.bot || message.system) return;

  // message.channel.send(createEmbedGreeting(message.author));
  // return;

  // Ignore messages without prefix
  if (message.content[0] !== config.prefix) return;

  let args    = message.content.slice(config.prefix.length).trim().split(/ +/g);
  let command = args.shift().toLowerCase();

  debug(`[onMessage] ~~~~~~\n` +
  `channel:\t${message.channel.name}\n` +
  `type:\t\t${message.channel.type}\n` +
  `command:\t${command}\n` +
  `args:\t\t${args}\n` +
  `~~~~~~\n`);

  // ignore if only the prefix was posted
  if (command.trim() === '' || command.length === 0) return;

  // Let user know they don't need to include any underscores
  if (args.join(' ')[0] === '_') {
    // Ignore messages sent from unapproved channels
    if (isAllowedChannel(message.channel.name)) {
      message.channel.send(`${message.author} -- *FYI, you don't need to include an underscore when giving me a command. That was just for an example* 😉`);
      args = args.map(arg => arg.replace(/_/g, ''));
    }
  }

  if (command === 'help') {
    // Ignore messages sent from unapproved channels
    if (!isAllowedChannel(message.channel.name)) return;

    message.channel.send(createEmbedHelpPost());
  }
  else if (command === 'ask') {
    // Ignore messages sent from unapproved channels
    if (!isAllowedChannel(message.channel.name)) return;
    
    Fuzz = Fuzzyset(supportCards.map(card => card.question));
    possibleAnswers = Fuzz.get(args.join(' ')) || [];

    if (possibleAnswers.length) {
      debug(`[DiscordHelpbot] :: Ask question\nQuestion:\n${args.join(' ')}\n\nPossible Matches:\n${possibleAnswers.map(answer => `> ${answer[1]} (${(answer[0]*100).toFixed(2)}%)`).join('\n')}\n\n`);

      let suggestion = supportCards.find(card => card.question === possibleAnswers[0][1]);

      message.reply('I found this related question!');
      message.channel.send(createEmbedAnswer(suggestion))
      .then(suggestedPost => {
        suggestedPost.react('👍')
        .then(() => suggestedPost.react('👎'));
      });
    }
    else {
      debug(`[DiscordHelpbot] :: Ask question\nQuestion:\n${args.join(' ')}\n\nPossible Matches:\n NONE\n\n`);

      message.channel.send(`I couldn't find a related question unfortunately. Please reach out to one of our Community Moderators!`);
    }
  }
  else if (command === 'lists') {
    // Ignore messages sent from unapproved channels
    if (!isAllowedChannel(message.channel.name)) return;

    debug('[DiscordHelpbot] :: Show all category lists');

    let availableLists = supportLists.filter(list => list.cards.length > 0);
    message.channel.send(createEmbedList(
      `Available Help/Support Topics:`,
      availableLists.map(list => `\`${config.prefix}list ${list.name}\``)
    ));
  }
  else if (command === 'list') {
    // Ignore messages sent from unapproved channels
    if (!isAllowedChannel(message.channel.name)) return;

    debug('[DiscordHelpbot] :: Show questions in category list');

    let supportList = supportLists.find(list => list.name.toLowerCase() === args.join(' ').toLowerCase());
    if (supportList) {
      message.channel.send(createEmbedList(
        `${supportList.name} Sub-topics:`,
        supportList.cards.map(card => `\`${config.prefix}ask ${card.question}\``)
      ));
    }
    else {
      message.channel.send(`Unable to find a matching support category! Use the command \`${config.prefix}lists\` to view all available support categories.`);
    }
  }
  else if (command === 'top') {
    // Ignore messages sent from unapproved channels
    if (!isAllowedChannel(message.channel.name)) return;

    debug('[DiscordHelpbot] :: List top-rated questions');

    let cards = [];
    Level.SupportCards.createReadStream()
    .on('data', (c) => {
      console.log(c.value);
      if (!isPrimaryTopic(c.value)) cards.push(c.value)
    })
    .on('end', () => {
      cards = cards.sort((a, b) => (a.upVotes - b.upVotes)).reverse();
      message.channel.send(createEmbedTopList(cards.slice(0, 3)));
    });
  }
  else if (command === 'purge') {
    // Ignore messages sent from unapproved channels
    if (!isAllowedChannel(message.channel.name)) return;
    if (message.author.id !== config.admin) return;

    message.channel.send('🔥 🔥 🔥');

    Update.updateSupportLists(Level)
    .then(status => {
      setTimeout(() => {
        Update.updateSupportCards(Level)
        .then(u => {
          setTimeout(() => {
            buildSupportLists();
            message.channel.send('Purge Complete. Support List rebuilding.');
          }, 3000);
        })
        .catch(err => console.log(err));
      }, 3000);
    })
    .catch(err => console.log(err));
  }
  else {
    let primaryQuestion = supportTopics.find(topic => topic.question.toLowerCase() === command.toLowerCase());
    if (primaryQuestion) {
      message.channel.send(createEmbedPost(primaryQuestion));
    }
    else {
      message.channel.send(`I couldn't find a related question unfortunately. Please reach out to one of our Community Moderators!`);
    }
  }
});


Client.login(config['integrations']['discord']['token']);
WebhookServer.init();

Update.eventEmit.on('UPDATE_SUPPORT_LIST_COMPLETE', () => {
  debug('Support list updated');
});

Update.eventEmit.on('UPDATE_SUPPORT_LIST_COMPLETE', () => {
  debug('Support cards updated');
});

Update.eventEmit.on('error', (err) => {
  console.error('[Update :: Event] Error encountered', err);
});

Webhook.eventEmit.on('WEBHOOK_UPDATE', () => {
  debug('Webhook updated');

  Update.updateSupportLists(Level)
  .then(status => {
    setTimeout(() => {
      Update.updateSupportCards(Level)
      .then(u => {
        setTimeout(() => {
          buildSupportLists();
        }, 3000);
      })
      .catch(err => console.log(err));
    }, 3000);
  })
  .catch(err => console.log(err));
});

Webhook.eventEmit.on('error', (err) => {
  console.error('[Webhook :: Event] Error encountered', err);
});

function handleErrorOrSignal(err) {
  if (err) {
    console.error('Error occurred:', err);
    console.error(err.stack);
  }

  process.exit(1);
  // if (!closing) {
  //   console.log('Shutting down server...');
  //   process.exit(1);
  // }
}

process.on('SIGTERM', handleErrorOrSignal)
       .on('SIGINT', handleErrorOrSignal)
       .on('SIGHUP', handleErrorOrSignal)
       .on('uncaughtException', handleErrorOrSignal);
