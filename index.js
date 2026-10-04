const { Client, GatewayIntentBits, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error("Missing DISCORD_TOKEN");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const COLOR_ROLES = [
  "1552157873096622090","1552159760697139220","1552160281151668364","1552159918851760250",
  "1552159893698383942","1552159864309026896","1552159831362773032","1552159800132108420",
  "1552159700324454420","1552159674135093318","1552159095899947018","1552159061242421350",
  "1552159016229150741","1552158933919993906","1552158901053431899","1552158733755219998",
  "1552158673474949170","1552158530881069086","1552158372219060318","1552158297514053713",
  "1552156375134502912","1552158236663091271","1552158163241926676","1552158071164248066"
];

const COLOR_EMOJIS = [
  "⚪","◻️","⚫","🔵","🟣","🟢","🟡","🔴",
  "🩵","🔷","🟤","🩷","🔹","🔷","🟪","🟩",
  "🟢","🟥","🔵","🔷","⚫","🟫","🩶","🟣"
];

function colorPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("rip_color_select")
    .setPlaceholder("اختر لونك...")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(COLOR_ROLES.map((id, i) => ({
      label: String(i + 1),
      value: String(i + 1),
      emoji: COLOR_EMOJIS[i],
      description: `لون رقم ${i + 1}`
    })));

  const embed = new EmbedBuilder()
    .setTitle("🎨 اختر لونك")
    .setDescription("اختر اللون المناسب لك من القائمة بالأسفل.\n\nعند اختيار لون جديد، سيتم إزالة لونك السابق تلقائيًا.")
    .setColor(0x5865F2);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

client.once("ready", () => console.log(`✅ ${client.user.tag} online`));

client.on("messageCreate", async m => {
  if (m.author.bot || !m.guild) return;
  if (m.content.trim() !== "!ty") return;
  await m.channel.send(colorPanel());
});

client.on("interactionCreate", async i => {
  if (!i.isStringSelectMenu() || i.customId !== "rip_color_select") return;

  const index = Number(i.values[0]) - 1;
  const role = i.guild.roles.cache.get(COLOR_ROLES[index]);

  if (!role) return i.reply({content:"❌ رتبة هذا اللون غير موجودة.", ephemeral:true});
  if (!role.editable) return i.reply({content:"❌ ارفع رتبة البوت فوق رتب الألوان.", ephemeral:true});

  try {
    const old = i.member.roles.cache.filter(r => COLOR_ROLES.includes(r.id));
    if (old.size) await i.member.roles.remove([...old.values()]);
    await i.member.roles.add(role);
    await i.reply({content:`✅ تم اختيار اللون **${index + 1}**.`, ephemeral:true});
  } catch (e) {
    console.error(e);
    await i.reply({content:"❌ تأكد من Manage Roles وترتيب رتبة البوت.", ephemeral:true});
  }
});

client.login(TOKEN);
