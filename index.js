require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
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
    // قناة الترحيب
    const channel = await member.guild.channels.fetch(
      "1548158650823221318"
    );

    if (!channel) {
      console.log("❌ ما لقيت قناة الترحيب");
      return;
    }

    // تحميل تصميم الترحيب
    const template = await loadImage(
      path.join(__dirname, "welcome.png")
    );

    // إنشاء الصورة بنفس حجم التصميم
    const canvas = createCanvas(
      template.width,
      template.height
    );

    const ctx = canvas.getContext("2d");

    // رسم التصميم
    ctx.drawImage(
      template,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // تحميل صورة العضو
    const avatarURL = member.user.displayAvatarURL({
      extension: "png",
      size: 512
    });

    const avatar = await loadImage(avatarURL);

    // مكان صورة العضو
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

    let fontSize = 85;

    if (username.length > 15) fontSize = 70;
    if (username.length > 20) fontSize = 55;
    if (username.length > 25) fontSize = 45;

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#ffffff";

    ctx.shadowColor = "#008cff";
    ctx.shadowBlur = 20;

    ctx.fillText(
      username,
      1370,
      430
    );

    ctx.shadowBlur = 0;

    // تحويل الصورة إلى PNG
    const buffer = await canvas.encode("png");

    const attachment = new AttachmentBuilder(
      buffer,
      {
        name: "welcome-result.png"
      }
    );

    // رسالة الترحيب
    await channel.send({
      content: `⚡👑 وصل عضو جديد! حيّاك يا <@${member.id}>، نورت سيرفرنا وشرّفتنا! 🔥`,
      files: [attachment]
    });

    console.log(
      `✅ تم الترحيب بـ ${member.user.tag}`
    );

  } catch (error) {
    console.error("❌ خطأ:", error);
  }
});

client.login(process.env.TOKEN);
