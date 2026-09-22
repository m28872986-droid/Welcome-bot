require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const {
  createCanvas,
  loadImage
} = require("@napi-rs/canvas");

const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  try {
    const channel = await member.guild.channels.fetch(
      process.env.WELCOME_CHANNEL_ID
    );

    if (!channel) return;

    const canvas = createCanvas(1875, 800);
    const ctx = canvas.getContext("2d");

    // التصميم
    const overlay = await loadImage(
      path.join(__dirname, "welcome.png")
    );

    // صورة العضو
    const avatarURL = member.user.displayAvatarURL({
      extension: "png",
      size: 512
    });

    const avatar = await loadImage(avatarURL);

    // دائرة الصورة
    const avatarX = 430;
    const avatarY = 430;
    const radius = 180;

    ctx.save();

    ctx.beginPath();
    ctx.arc(
      avatarX,
      avatarY,
      radius,
      0,
      Math.PI * 2
    );

    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      avatar,
      avatarX - radius,
      avatarY - radius,
      radius * 2,
      radius * 2
    );

    ctx.restore();

    // اسم العضو
    const username = member.displayName;

    ctx.font = "bold 85px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "#008cff";
    ctx.shadowBlur = 20;

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
      username,
      1370,
      430
    );

    ctx.shadowBlur = 0;

    // التصميم فوق الصورة والاسم
    ctx.drawImage(
      overlay,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // تجهيز الصورة
    const buffer = await canvas.encode("png");

    const attachment = new AttachmentBuilder(buffer, {
      name: "welcome.png"
    });

    // إرسال الترحيب
    await channel.send({
      content: `نورت السيرفر <@${member.id}> 🤍`,
      files: [attachment]
    });

  } catch (error) {
    console.error("❌ خطأ:", error);
  }
});

client.login(process.env.TOKEN);
