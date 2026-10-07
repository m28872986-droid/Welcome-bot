require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const MOVE_ROLE_ID = "1556249940936884385";
const STAFF_ROLE_ID = "1549461212348153856";
const LOG_CHANNEL_ID = "1556244974268448819";

client.once("ready", () => {
  console.log(`✅ البوت شغال باسم ${client.user.tag}`);
});

client.on("messageCreate", async (m) => {
  if (m.author.bot || !m.guild) return;

  const s = m.content.trim();
  if (!s.toLowerCase().startsWith("سحب")) return;

  const hasPermission =
    m.member.roles.cache.has(MOVE_ROLE_ID) ||
    m.member.roles.cache.has(STAFF_ROLE_ID);

  if (!hasPermission) return m.react("❌").catch(() => {});

  if (!m.member.voice.channel) {
    return m.react("❌").catch(() => {});
  }

  const input = s.split(/\s+/)[1];
  if (!input) return m.react("❌").catch(() => {});

  let targetMember = m.mentions.members.first();

  if (!targetMember && /^\d{17,20}$/.test(input)) {
    targetMember = await m.guild.members.fetch(input).catch(() => null);
  }

  if (!targetMember) return m.react("❌").catch(() => {});

  if (!targetMember.voice.channel) {
    return m.reply("❌ الشخص مو موجود بروم صوتي!").catch(() => {});
  }

  if (targetMember.voice.channelId === m.member.voice.channelId) {
    return m.reply("❌ هو معك بنفس الروم!").catch(() => {});
  }

  const oldChannel = targetMember.voice.channel;
  const newChannel = m.member.voice.channel;
  const botMember = m.guild.members.me;

  if (
    !oldChannel.permissionsFor(botMember)
      ?.has(PermissionsBitField.Flags.MoveMembers)
  ) {
    return m.react("❌").catch(() => {});
  }

  try {
    const oldChannelName = oldChannel.name;
    const newChannelName = newChannel.name;

    await targetMember.voice.setChannel(
      newChannel,
      `سحب بواسطة ${m.author.tag}`
    );

    await m.react("✅").catch(() => {});

    const logChannel = m.guild.channels.cache.get(LOG_CHANNEL_ID);

    if (logChannel) {
      const now = new Date();

      const time = now.toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Riyadh"
      });

      const date = now.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Riyadh"
      });

      await logChannel.send(
        `🔊 **سحب عضو**\n\n` +
        `👤 **الساحب:** ${m.member}\n` +
        `🎯 **المسحوب:** ${targetMember}\n\n` +
        `📤 **من الروم:** \`${oldChannelName}\`\n` +
        `📥 **إلى الروم:** \`${newChannelName}\`\n\n` +
        `🕐 **الوقت:** ${time}\n` +
        `📅 **التاريخ:** ${date}`
      );
    }
  } catch (err) {
    console.error("خطأ في أمر السحب:", err);
    await m.react("❌").catch(() => {});
  }
});

if (!process.env.TOKEN) {
  console.error("❌ ما لقيت TOKEN في Render Environment Variables");
  process.exit(1);
}

client.login(process.env.TOKEN);
