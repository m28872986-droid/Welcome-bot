require("dotenv").config();
const http = require("http");
const {
  Client, GatewayIntentBits, ChannelType, PermissionsBitField
} = require("discord.js");
const {
  joinVoiceChannel, VoiceConnectionStatus, entersState
} = require("@discordjs/voice");

const TOKEN = process.env.DISCORD_TOKEN;
const VOICE_CHANNEL_ID = "1562036111214247956";
const ALLOWED_ROLE_ID = "1562069171330744340";
const PREFIX = "#sendall";
const PORT = Number(process.env.PORT) || 3000;

if (!TOKEN) {
  console.error("Set DISCORD_TOKEN in your host's environment variables.");
  process.exit(1);
}

http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("AFK voice bot is running.\\n");
}).listen(PORT, "0.0.0.0", () => console.log(`Health server listening on ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

let joining = false;
let broadcastRunning = false;

async function joinAfkRoom() {
  if (joining || !client.isReady()) return;
  joining = true;
  try {
    const channel = await client.channels.fetch(VOICE_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      console.error("Voice channel not found; check VOICE_CHANNEL_ID.");
      return;
    }
    const guild = channel.guild;
    const me = guild.members.me ?? await guild.members.fetchMe();
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.ViewChannel) ||
        !perms?.has(PermissionsBitField.Flags.Connect)) {
      console.error("Bot needs View Channel and Connect permissions.");
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });
    connection.on("error", err => console.error("Voice error:", err.message));
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        try { connection.destroy(); } catch {}
        setTimeout(joinAfkRoom, 5000);
      }
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30000);
      console.log(`Connected to voice channel ${channel.id}`);
    } catch (err) {
      console.error("Could not connect to voice:", err.message);
      try { connection.destroy(); } catch {}
      setTimeout(joinAfkRoom, 10000);
    }
  } catch (err) {
    console.error("Failed to join voice:", err.message);
    setTimeout(joinAfkRoom, 10000);
  } finally {
    joining = false;
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  joinAfkRoom();
});

client.on("voiceStateUpdate", (oldState, newState) => {
  if (client.user && (oldState.id === client.user.id || newState.id === client.user.id)) {
    if (newState.channelId !== VOICE_CHANNEL_ID) setTimeout(joinAfkRoom, 3000);
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

  if (!message.member?.roles.cache.has(ALLOWED_ROLE_ID)) {
    await message.reply("ما عندك صلاحية استخدام هذا الأمر.");
    return;
  }

  const textToSend = message.content.slice(PREFIX.length).trim();
  if (!textToSend) {
    await message.reply("اكتب الرسالة بعد الأمر، مثال: `#sendall السلام عليكم`");
    return;
  }
  if (broadcastRunning) {
    await message.reply("فيه برودكاست شغال حاليًا، انتظر لين يخلص.");
    return;
  }

  broadcastRunning = true;
  await message.reply("بدأ إرسال الرسالة للأعضاء. قد لا تصل الرسائل لمن أغلق الخاص.");
  let sent = 0, failed = 0;
  try {
    const members = await message.guild.members.fetch();
    for (const member of members.values()) {
      if (member.user.bot) continue;
      try {
        await member.send(textToSend);
        sent++;
      } catch {
        failed++;
      }
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    await message.channel.send(`انتهى البرودكاست. وصلت: ${sent} | تعذر الإرسال: ${failed}`);
  } catch (err) {
    console.error("Broadcast error:", err);
    await message.channel.send("صار خطأ. تأكد من إعدادات Intents وصلاحيات البوت.");
  } finally {
    broadcastRunning = false;
  }
});

client.login(TOKEN);
