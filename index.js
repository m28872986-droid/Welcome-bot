const http = require("http");
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

// =========================
// PORT - حل مشكلة Render
// =========================

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("RipBot is online");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =========================
// الإعدادات
// =========================

const GUILD_ID = "1546851578638630922";

// قناة الترحيب
const WELCOME_CHANNEL_ID = "1548158650823221318";

// قناة إنشاء الرومات الخاصة
const PRIVATE_CREATE_CHANNEL_ID = "1546945537696333884";

// قناة الصوت 24/7
const VOICE_24_7_CHANNEL_ID = "1546859095032729620";

// =========================
// BOT READY
// =========================

client.once("ready", async () => {
  console.log("================================");
  console.log(`✅ RipBot شغال: ${client.user.tag}`);
  console.log(`🌐 PORT: ${PORT}`);
  console.log("================================");

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.log("❌ السيرفر غير موجود أو البوت غير موجود فيه.");
    return;
  }

  console.log(`🏠 Connected to: ${guild.name}`);
});

// =========================
// الترحيب
// =========================

client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.channels.cache.get(
      WELCOME_CHANNEL_ID
    );

    if (!channel) {
      console.log("❌ قناة الترحيب غير موجودة.");
      return;
    }

    await channel.send({
      content:
        `ياهلا والله فيك <@${member.id}> 🤍\n` +
        `نورت سيرفرنا، خذ راحتك ووسع صدرك ونتمنى لك وقت ممتع معنا 🫶🏻`,
      files: ["./welcome.png"]
    });

    console.log(`👋 تم الترحيب بـ ${member.user.tag}`);
  } catch (error) {
    console.error("❌ خطأ في الترحيب:", error);
  }
});

// =========================
// الرومات الخاصة
// =========================

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    // إذا دخل العضو قناة إنشاء الروم
    if (
      newState.channelId === PRIVATE_CREATE_CHANNEL_ID &&
      oldState.channelId !== PRIVATE_CREATE_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      if (!member) return;

      // إنشاء الروم الخاص
      const room = await guild.channels.create({
        name: `روم・${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: newState.channel?.parentId || null,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.ViewChannel
            ]
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.Stream
            ]
          }
        ]
      });

      // نقل العضو للروم
      await member.voice.setChannel(room);

      console.log(
        `🔊 تم إنشاء روم خاص لـ ${member.user.tag}: ${room.name}`
      );
    }
  } catch (error) {
    console.error("❌ خطأ في الروم الخاص:", error);
  }
});

// =========================
// حذف الرومات الخاصة الفارغة
// =========================

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const channel = oldState.channel;

    if (!channel) return;

    // لا نحذف قناة الإنشاء
    if (channel.id === PRIVATE_CREATE_CHANNEL_ID) return;

    // نحذف فقط الرومات التي اسمها يبدأ بهذا الشكل
    if (!channel.name.startsWith("روم・")) return;

    // إذا صار الروم فاضي
    if (channel.members.size === 0) {
      await channel.delete("Private room empty");
      console.log(`🗑️ تم حذف الروم الفاضي: ${channel.name}`);
    }
  } catch (error) {
    console.error("❌ خطأ في حذف الروم:", error);
  }
});

// =========================
// أوامر بسيطة
// =========================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    await message.reply("🏓 Pong!");
  }

  if (message.content === "!status") {
    await message.reply(
      `✅ RipBot شغال\n🌐 PORT: ${PORT}`
    );
  }
});

// =========================
// أخطاء
// =========================

client.on("error", (error) => {
  console.error("❌ Discord Error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Rejection:", error);
});

// =========================
// تشغيل البوت
// =========================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Render Environment Variables.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
