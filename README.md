# RIP Ticket Bot

Discord ticket system for the Rip server.

## Features
- /ticket-panel
- /ticket-admin
- /setup
- Support / Complaint / Report / Management / General
- Staff-only Claim
- Staff-only close/delete
- Staff admin panel
- Rename / add user / remove user
- Lock / unlock
- Clear
- Transcript
- Ticket banner included in `assets/ticket-banner.png`

## Railway Variables

Add these variables in Railway:

- DISCORD_TOKEN
- CLIENT_ID
- GUILD_ID
- STAFF_ROLE_ID

Optional:
- TICKET_CATEGORY_ID
- LOG_CHANNEL_ID

Do not put your bot token inside GitHub.

## Discord permissions

The bot needs at least:
- View Channels
- Send Messages
- Read Message History
- Manage Channels
- Manage Messages
- Attach Files

If you want transcripts to contain normal message text, enable the Message Content Intent in the Discord Developer Portal.
