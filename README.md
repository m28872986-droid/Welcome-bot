# AFK Voice Bot

Configured IDs:
- Voice channel: `1562036111214247956`
- Role allowed to use `#sendall`: `1562069171330744340`

## Upload and run
1. Upload `index.js`, `package.json`, `README.md`, and `ENV-SETUP.txt` to your GitHub repository.
2. In your hosting provider, add an environment variable:
   - Name: `DISCORD_TOKEN`
   - Value: your bot token (never publish it).
3. Build/install command: `npm install`
4. Start command: `npm start`
5. Enable **Message Content Intent** and **Server Members Intent** in Discord Developer Portal > Bot.
6. Give the bot permission to view/connect to the voice channel and send messages.

The bot attempts to rejoin the configured voice channel after disconnects. Always-on operation depends on a host that supports continuous processes.
