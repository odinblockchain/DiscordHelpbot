# DiscordHelpbot
A helpful bot for the ODIN Blockchain community Discord. This bot incorporates [Trello](https://trello.com/) for the management of frequently-asked-questions and primary topics. This bot also tracks feedback through simple ( 👍 👎 ) reactions.

## Prerequisites

### NodeJS
This bot is built with JavaScript and a little bit of love and runs on the Chrome V8 JavaScript engine which is wrapped by [NodeJS](https://nodejs.org/).

### Trello
You will need to figure out your Trello developer API Key which should be available here [https://trello.com/app-key](https://trello.com/app-key) if you are logged in. You will need to save your Key in a safe place. Now click the "generate a Token" link, follow the steps, and save the generated Trello Token as well.

### Discord
This bot is of course integrated with Discord, and as such you'll need to create a Discord application and a Discord bot within that application. You can access their Dev Dashboard here if you are logged in: [https://discordapp.com/developers/applications/](https://discordapp.com/developers/applications/). Once you have created a bot, save the bot's token somewhere.

## Setup

### Database
This DiscordHelpbot utilizes a special database system called [LevelDB](https://github.com/google/leveldb) written by Google. It is very fast, pretty efficient, and best of all requires **zero effort** for the end user (*you*) to setup. The database is stored in the folder `db/` of which you'll likely never have to touch. So don't touch it.

### Configuration
Duplicate the file `settings.json.template` and save it as `settings.json`. This is the configuration file for this bot. Open it up and adjust the necessary information you have so far collected from the "Prerequisites".

```
"integrations": {
  "trello": {
    "api": {
      "key": "TRELLO_KEY",
      "token": "TRELLO_TOKEN"
    },
    "organization": "",
    "board": ""
  },
  "discord": {
    "token": "DISCORD_BOT_TOKEN"
  }
}
```

#### Trello Board/Organization IDs

Now we need to figure out the special identifiers (keys) for both the Trello Organization that contains all the boards, and the board itself you want this bot to sync with. At this point you should make sure your Trello account has access to the organization you will be looking for. We'll need the bot to go fetch whatever information it can and display this to you so you can find these important keys! In your terminal, and enter the command below:

```
node scripts/trelloAccount.js
```

This will create a local website you can view at: `http://localhost:3000/`. After you view the page and can see your information it will self terminate this process for you. Once you can see the page, you'll see a list of names/ids of any organizations you are a member of AND any boards owned by that organization and should look like this:

```
{
  "5ae6cde49627620a07cf48fa": {
    "id": "5ae6cde49627620a07cf48fa",
    "name": "xxxxxxx",
    "description": "",
    "url": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "boards": {
      "5af1d2737b0d5efebacd8b4c": {
        "id": "5af1d2737b0d5efebacd8b4c",
        "name": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "description": "",
        "shortLink": "xxxxxxxx",
        "url": "xxxxxxxxxxxxxx"
      },
      "5ae6cdbdc4f37ad6c245ec27": {
        "id": "5ae6cdbdc4f37ad6c245ec27",
        "name": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "description": "",
        "shortLink": "xxxxxxxx",
        "url": "xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  },
  ...
}
```

So what you're looking for here is the Organization and the Board from that Organization you want this Discord Helpbot to sync too. The highlevel list are all organizations, and their respective boards are listed under "boards". The `ID` and `NAME` can be easily seen. Once you find the `id` of both the Organization and Board, add it to your `config.json`:

```
"integrations": {
  "trello": {
    "api": {
      "key": "TRELLO_KEY",
      "token": "TRELLO_TOKEN"
    },
    "organization": "TRELLO_ORGANIZATION_ID",
    "board": "BOARD_ORGANIZATION_ID"
  },
  "discord": {
    "token": "DISCORD_BOT_TOKEN"
  }
}
```

#### Setting up the Trello Webhook

**This part is optional and is only for people setting this bot up on a server!**

One part of the `config.json` mentions a `trelloWebhookPort`. By default, this is set to `3000`. What this means is that Trello will make a Webhook request to *your* server on port *3000*. This webhook will contain metadata about changes done on the Trello Board your bot is in sync with so you won't have to manually refresh the stored information.

If you want to set this up, make sure you have correctly set the `Integrations >> Trello >> Organization` **and** `Integrations >> Trello >> Board` ID as mentioned in the previous step.

Now run this node command to generate another local website to confirm some information:

```
node scripts/trelloWebhook.js
```

If you once again navigate to your web server at port `3000` (or whatever alternative port you set your config too) you should see a simple website up with a form requiring you to enter your web server IP Address (or Website Name if you have the appropriate DNS configuration to send traffic to your server). Submit the form and you'll see either an error or confirmation that the webhook was created. If this is successful, the process will self-terminate and you're clear for running the bot! If not, well you should see an error message explaining the problem.

#### ForeverJS

**This part is optional and is only for people setting this bot up on a server!**

I you recommend to use `ForeverJS` which will run a `NodeJS` process in the background "forever" until you manually stop it with `forever stopall`:

```
# Install ForeverJS:
npm install forever -g

# List running Forever processes:
forever list

# Stop Forever processes:
forever stopall

# Stop specific forever process:
forver stop 0
```

## Configuring Your Trello Board
Content coming soon™.

## Running the bot

To run the Discord Helpbot, run the following command with either Node or ForeverJS. Running it with Node will stop the bot whenever the process is terminated which is why I recommend ForeverJS.

```
forever start index.js
# OR
node index.js
```

Now you should invite this bot to a server that you have **Admin** access to, or at least permissions to add bots. You can do this through the DiscordApp Developer screen. Replace `<DISCORD_CLIENT_ID>` with your Discord Application Client ID (*not your Discord Bot Token!*).

```
https://discordapp.com/oauth2/authorize?client_id=<DISCORD_CLIENT_ID>&scope=bot&permissions=536996928
```

You'll see a screen where you can invite this Discord Helpbot to a server. Once the bot is added, it will greet everyone, list channels it is actively listening in, and wait for a command! By default, it will actively listen to all channels that contain `support` in the name. *(i.e., support, general-support, website-support)*. Additionally, it will listen to **all channels** if you have any **Primary Topics** defined. Primary Topics are, well, primary pieces of information that should be displayed. This will look like: `!topic`.
