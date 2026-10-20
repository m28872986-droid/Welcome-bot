require("dotenv").config();

const http = require("http");
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const TOKEN = process.env.DISCORD_TOKEN;
const VOICE_CHANNEL_ID = "1562036111214247956";
const ALLOWED_ROLE_ID = "1562069171330744340";
const PREFIX = "#sendall";
const PORT = Number(process.env.PORT) || 3000;

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN. Add it in your host's environment variables.");
  process.exit(1);
}

// Lightweight health-check server for hosts that expect an HTTP port.
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("AFK voice bot is running.\\n");
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Health server listening on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

let joiningVoice = false;
let broadcastRunning = false;

async function connectToVoice() {
  if (joiningVoice || !client.isReady()) return;
  joiningVoice = true;

  try {
    const channel = await client.channels.fetch(VOICE_CHANNEL_ID);

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      console.error("The configured voice channel was not found or is not a voice channel.");
      return;
    }

    const guild = channel.guild;
    const me = guild.members.me ?? await guild.members.fetchMe();

    const permissions = channel.permissionsFor(me);
    if (
      !permissions?.has(PermissionsBitField.Flags.ViewChannel) ||
      !permissions?.has(PermissionsBitField.Flags.Connect)
    ) {
      console.error("The bot needs View Channel and Connect permissions in the voice channel.");
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    connection.on("error", (error) => {
      console.error("Voice connection error:", error.message);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        try { connection.destroy(); } catch {}
        setTimeout(connectToVoice, 5_000);
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      console.log(`Connected to voice channel: ${channel.name}`);
    } catch (error) {
      console.error("Could not connect to voice:", error.message);
      try { connection.destroy(); } catch {}
      setTimeout(connectToVoice, 10_000);
    }
  } catch (error) {
    console.error("Failed to join voice channel:", error.message);
    setTimeout(connectToVoice, 10_000);
  } finally {
    joiningVoice = false;
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await connectToVoice();
});

// If the voice connection drops or the bot is moved, try joining the configured room again.
client.on("voiceStateUpdate", (oldState, newState) => {
  if (oldState.id === client.user.id || newState.id === client.user.id) {
    const currentChannelId = newState.channelId;
    if (currentChannelId !== VOICE_CHANNEL_ID) {
      setTimeout(connectToVoice, 3_000);
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  // Only members with the configured role may use #sendall.
  if (!message.member?.roles.cache.has(ALLOWED_ROLE_ID)) {
    await message.reply("ما عندك صلاحية استخدام هذا الأمر.");
    return;
  }

  const announcement = message.content.slice(PREFIX.length).trim();
  if (!announcement) {
    await message.reply("اكتب الرسالة بعد الأمر، مثال: `#sendall السلام عليكم`");
    return;
  }

  if (broadcastRunning) {
    await message.reply("فيه برودكاست شغال حاليًا، انتظر لين يخلص.");
    return;
  }

  await message.reply("بدأ إرسال الرسالة للأعضاء. قد لا تصل الرسالة لمن أغلق الخاص أو منع رسائل السيرفر.");
  broadcastRunning = true;

  let sent = 0;
  let failed = 0;

  try {
    // Fetch members; the bot needs the Server Members Intent enabled in Developer Portal.
    const members = await message.guild.members.fetch();

    for (const member of members.values()) {
      if (member.user.bot) continue;

      try {
        await member.send(announcement);
        sent++;
      } catch {
        failed++;
      }

      // Slow down delivery to reduce rate-limit pressure.
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }

    await message.channel.send(
      `انتهى البرودكاست. وصلت: ${sent} | تعذر الإرسال: ${failed}`
    );
  } catch (error) {
    console.error("Broadcast error:", error);
    await message.channel.send("صار خطأ أثناء البرودكاست. تأكد من صلاحيات البوت والـ Intents.");
  } finally {
    broadcastRunning = false;
  }
});

client.login(TOKEN);
