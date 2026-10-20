# AFK Voice Bot

This bot automatically joins the configured Discord voice channel and supports a role-restricted `#sendall` command.

## Configured IDs
- Voice channel ID: `1562036111214247956`
- Role allowed to use `#sendall`: `1562069171330744340`

## Requirements
- Node.js 20 or newer
- A Discord bot application and token
- The bot invited to your server with permission to view/connect to the voice channel and send messages
- In Discord Developer Portal → Bot, enable **Message Content Intent** and **Server Members Intent**

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Put the bot token in `.env` as `DISCORD_TOKEN=...`.
4. Run `npm install`.
5. Run `npm start`.

## Host setup
- Build/install command: `npm install`
- Start command: `npm start`
- Environment variable: `DISCORD_TOKEN` = your bot token
- Port: the app listens on `process.env.PORT`, defaulting to `3000`. Most hosts set this automatically.

Do not commit `.env` or share your bot token. If it is exposed, reset it in Discord Developer Portal.

## Broadcast command
A member with the configured role can use:
`#sendall Your message here`

The bot skips bot accounts, sends DMs with a delay, and reports how many succeeded or failed. Discord may block DMs from server members who have privacy settings enabled. Use broadcasts only for relevant messages and avoid repeatedly messaging members who did not opt in.
