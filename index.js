require("dotenv").config();

const {
  Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActivityType,
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || "";
const DATA_FILE = path.join(__dirname, "data.json");
if (!TOKEN) {
  console.error("لم يتم العثور على رمز البوت داخل ملف .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { guilds: {} };
    const old = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (old.guilds) return old;
    const migrated = { guilds: {} };
    // Keep old balances as a legacy source and migrate them on first use.
    migrated.legacyUsers = {};
    for (const [id, value] of Object.entries(old)) {
      if (/^\d{17,20}$/.test(id) && typeof value === "number") {
        migrated.legacyUsers[id] = value;
      }
    }
    return migrated;
  } catch (error) {
    console.error("تعذر قراءة ملف البيانات:", error);
    return { guilds: {} };
  }
}
let data = loadData();

function saveData() {
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}
function guildData(id) {
  data.guilds[id] ??= {};
  const g = data.guilds[id];
  g.users ??= {};
  g.settings ??= {};
  const s = g.settings;
  s.prefix ??= "!";
  s.adminRoleId ??= null;
  s.pointsRoleId ??= null;
  s.broadcastRoleId ??= null;
  s.authorizedUsers ??= [];
  s.transferLogChannelId ??= null;
  s.proposalChannelId ??= null;
  s.proposalRoleId ??= ADMIN_ROLE_ID || null;
  g.proposals ??= {};
  s.nextProposalNumber ??= Object.keys(g.proposals).length + 1;
  s.pointsLogChannelId ??= null; s.voiceLogChannelId ??= null;
  s.voicePointAmount ??= 1; s.voicePointIntervalMs ??= 600000;
  s.voiceSessions ??= {}; s.voiceProgress ??= {};
  s.logChannelId ??= null;
  s.embedColor ??= "#269B78";
  s.reminderChannelId ??= null;
  s.reminderIntervalMs ??= 12 * 60 * 60 * 1000;
  s.lastReminderAt ??= 0;
  s.reminderUsed ??= [];
  return g;
}
function coins(guildId, userId) {
  const g = guildData(guildId);
  if (!g.users[userId]) {
    const legacy = Number(data.legacyUsers?.[userId] || 0);
    g.users[userId] = { points: legacy };
  }
  return Number(g.users[userId].points || 0);
}
function setCoins(guildId, userId, value) {
  guildData(guildId).users[userId] = { points: Math.max(0, Math.floor(value)) };
  saveData();
}
function validColor(value) {
  return /^#[0-9A-F]{6}$/i.test(value || "");
}
function colorNumber(guildId) {
  return parseInt(guildData(guildId).settings.embedColor.slice(1), 16);
}
function makeEmbed(guildId, title, description) {
  return new EmbedBuilder()
    .setColor(colorNumber(guildId))
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
function parseAmount(value) {
  if (!/^\d+$/.test(value || "")) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 1_000_000_000 ? n : null;
}
function parseDuration(value) {
  const m = /^(\d+)(m|h|d)$/i.exec(value || "");
  if (!m) return null;
  const n = Number(m[1]);
  const ms = n * ({ m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()]);
  return Number.isSafeInteger(ms) && ms >= 5 * 60000 && ms <= 30 * 86400000 ? ms : null;
}
function durationText(ms) {
  if (ms % 86400000 === 0) return `${ms / 86400000} يوم`;
  if (ms % 3600000 === 0) return `${ms / 3600000} ساعة`;
  return `${ms / 60000} دقيقة`;
}
function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}
function hasRole(member, roleId) {
  return Boolean(roleId && member.roles.cache.has(roleId));
}
function isManager(member) { return Boolean(ADMIN_ROLE_ID && hasRole(member, ADMIN_ROLE_ID)); }
function canManagePoints(member) { return isManager(member); }
function canBroadcast(member) { return isManager(member); }
function logSettingKey(settings, channelId) {
  return Object.entries({
    transferLogChannelId: "transfer",
    pointsLogChannelId: "points",
    voiceLogChannelId: "voice", logChannelId: "general"
  }).find(([key]) => settings[key] === channelId)?.[1] || null;
}
function isLogEnabled(settings, kind) {
  return settings.logEnabled?.[kind] !== false;
}
function proposalRows(proposalId, locked = false) {
  // صف التصويت يظهر فوق صف اعتماد الحالة.
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`proposal_vote_up_${proposalId}`).setLabel("👍").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`proposal_vote_down_${proposalId}`).setLabel("👎").setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`proposal_status_review_${proposalId}`).setLabel("قيد الدراسة").setStyle(ButtonStyle.Primary).setDisabled(locked),
      new ButtonBuilder().setCustomId(`proposal_status_accepted_${proposalId}`).setLabel("قبول").setStyle(ButtonStyle.Success).setDisabled(locked),
      new ButtonBuilder().setCustomId(`proposal_status_rejected_${proposalId}`).setLabel("رفض").setStyle(ButtonStyle.Danger).setDisabled(locked),
      new ButtonBuilder().setCustomId(`proposal_status_done_${proposalId}`).setLabel("تم التنفيذ").setStyle(ButtonStyle.Secondary).setDisabled(locked)
    )
  ];
}
function proposalVoteCounts(proposal) {
  const votes = Object.values(proposal.votes || {});
  return { up: votes.filter(v => v === "up").length, down: votes.filter(v => v === "down").length };
}
function proposalEmbed(guildId, proposal) {
  const statusNames = { pending: "بانتظار المراجعة", done: "تم التنفيذ", rejected: "مرفوض", accepted: "مقبول", review: "قيد الدراسة" };
  const counts = proposalVoteCounts(proposal);
  return makeEmbed(guildId, `💡 اقتراح رقم #${proposal.id}`,
    `${proposal.text}\n\n**صاحب الاقتراح:** <@${proposal.userId}>\n**الحالة:** ${statusNames[proposal.status] || statusNames.pending}\n\n**التصويت:** 👍 ${counts.up}  |  👎 ${counts.down}`)
    .setFooter({ text: `#${proposal.id}` });
}

async function sendLog(guild, content, channelId = null, title = "سجل البوت") {
  const s = guildData(guild.id).settings;
  const id = channelId || s.logChannelId;
  if (!id) return;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (ch?.isTextBased()) await ch.send({ embeds: [makeEmbed(guild.id, title, content)], allowedMentions: { parse: [] } }).catch(() => null);
}

function userBalanceEmbed(guildId, user, value) {
  return makeEmbed(guildId, "رصيد النقاط", `العضو: ${user}\nالرصيد: **${value.toLocaleString("ar-SA")} نقطة**`);
}

const REMINDERS = [
  // آيات قرآنية مع مواضعها
  { id: "q01", title: "آية قرآنية", body: "﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾", source: "سورة الرعد، الآية ٢٨" },
  { id: "q02", title: "آية قرآنية", body: "﴿فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾", source: "سورة الشرح، الآيتان ٥–٦" },
  { id: "q03", title: "آية قرآنية", body: "﴿وَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ﴾", source: "سورة البقرة، الآية ١٥٢" },
  { id: "q04", title: "آية قرآنية", body: "﴿وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ﴾", source: "سورة غافر، الآية ٦٠" },
  { id: "q05", title: "آية قرآنية", body: "﴿وَهُوَ مَعَكُمْ أَيْنَ مَا كُنْتُمْ وَاللَّهُ بِمَا تَعْمَلُونَ بَصِيرٌ﴾", source: "سورة الحديد، الآية ٤" },
  { id: "q06", title: "آية قرآنية", body: "﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾", source: "سورة البقرة، الآية ١٥٣" },
  { id: "q07", title: "آية قرآنية", body: "﴿وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ﴾", source: "سورة الطلاق، الآية ٣" },
  { id: "q08", title: "آية قرآنية", body: "﴿إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ﴾", source: "سورة التوبة، الآية ١٢٠" },
  { id: "q09", title: "آية قرآنية", body: "﴿وَاذْكُر رَّبَّكَ كَثِيرًا وَسَبِّحْ بِالْعَشِيِّ وَالْإِبْكَارِ﴾", source: "سورة آل عمران، الآية ٤١" },
  { id: "q10", title: "آية قرآنية", body: "﴿إِنَّ رَحْمَتَ اللَّهِ قَرِيبٌ مِنَ الْمُحْسِنِينَ﴾", source: "سورة الأعراف، الآية ٥٦" },
  { id: "q11", title: "آية قرآنية", body: "﴿وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ إِنَّهُ لَا يَيْأَسُ مِن رَّوْحِ اللَّهِ إِلَّا الْقَوْمُ الْكَافِرُونَ﴾", source: "سورة يوسف، الآية ٨٧" },
  { id: "q12", title: "آية قرآنية", body: "﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾", source: "سورة طه، الآية ١١٤" },
  { id: "q13", title: "آية قرآنية", body: "﴿إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ﴾", source: "سورة البقرة، الآية ٢٢٢" },
  { id: "q14", title: "آية قرآنية", body: "﴿وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ﴾", source: "سورة هود، الآية ٨٨" },
  { id: "q15", title: "آية قرآنية", body: "﴿وَمَا عِندَ اللَّهِ خَيْرٌ وَأَبْقَى لِلَّذِينَ آمَنُوا وَعَلَىٰ رَبِّهِمْ يَتَوَكَّلُونَ﴾", source: "سورة الشورى، الآية ٣٦" },
  { id: "q16", title: "آية قرآنية", body: "﴿رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً إِنَّكَ أَنتَ الْوَهَّابُ﴾", source: "سورة آل عمران، الآية ٨" },
  { id: "q17", title: "آية قرآنية", body: "﴿رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي﴾", source: "سورة طه، الآيتان ٢٥–٢٦" },
  { id: "q18", title: "آية قرآنية", body: "﴿وَهُوَ الْغَفُورُ الْوَدُودُ﴾", source: "سورة البروج، الآية ١٤" },
  { id: "q19", title: "آية قرآنية", body: "﴿وَبَشِّرِ الصَّابِرِينَ﴾", source: "سورة البقرة، الآية ١٥٥" },
  { id: "q20", title: "آية قرآنية", body: "﴿إِنَّ مَعِيَ رَبِّي سَيَهْدِينِ﴾", source: "سورة الشعراء، الآية ٦٢" },
  // أذكار وأدعية مأثورة
  { id: "d01", title: "ذكر واستغفار", body: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ", source: "صحيح البخاري، حديث ٦٣٠٧" },
  { id: "d02", title: "ذكر", body: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", source: "صحيح البخاري، حديث ٦٤٠٥؛ صحيح مسلم، حديث ٢٦٩١" },
  { id: "d03", title: "ذكر", body: "سُبْحَانَ اللَّهِ الْعَظِيمِ", source: "صحيح البخاري، حديث ٦٤٠٦؛ صحيح مسلم، حديث ٢٦٩٤" },
  { id: "d04", title: "ذكر", body: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", source: "صحيح البخاري، حديث ٦٣٨٤؛ صحيح مسلم، حديث ٢٧٠٤" },
  { id: "d05", title: "ذكر", body: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ", source: "صحيح مسلم، حديث ٢١٣٧" },
  { id: "d06", title: "دعاء", body: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى", source: "صحيح مسلم، حديث ٢٧٢١" },
  { id: "d07", title: "دعاء", body: "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ", source: "سنن أبي داود، حديث ١٥٢٢؛ سنن النسائي، حديث ١٣٠٣" },
  { id: "d08", title: "دعاء", body: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", source: "سورة البقرة، الآية ٢٠١" },
  { id: "d09", title: "دعاء", body: "رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ", source: "سورة إبراهيم، الآية ٤١" },
  { id: "d10", title: "دعاء", body: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي", source: "سنن الترمذي، حديث ٣٥١٣" },
  { id: "d11", title: "دعاء", body: "يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ", source: "سنن الترمذي، حديث ٢١٤٠" },
  { id: "d12", title: "دعاء", body: "اللَّهُمَّ رَحْمَتَكَ أَرْجُو فَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ", source: "سنن أبي داود، حديث ٥٠٩٠" },
  { id: "d13", title: "دعاء", body: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ", source: "سنن أبي داود، حديث ٥٠٧٤" },
  { id: "d14", title: "دعاء", body: "اللَّهُمَّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَعَافِنِي وَارْزُقْنِي", source: "صحيح مسلم، حديث ٢٦٩٧" },
  { id: "d15", title: "دعاء", body: "رَبِّ أَعُوذُ بِكَ مِنْ هَمَزَاتِ الشَّيَاطِينِ ۝ وَأَعُوذُ بِكَ رَبِّ أَنْ يَحْضُرُونِ", source: "سورة المؤمنون، الآيتان ٩٧–٩٨" },
  { id: "d16", title: "دعاء", body: "رَبَّنَا ظَلَمْنَا أَنفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ", source: "سورة الأعراف، الآية ٢٣" },
  { id: "d17", title: "دعاء", body: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ", source: "صحيح البخاري، حديث ٦٣٦٩" },
  { id: "d18", title: "الصلاة على النبي ﷺ", body: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ", source: "الصلاة على النبي ﷺ" },
  { id: "d19", title: "ذكر", body: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ", source: "سورة آل عمران، الآية ١٧٣" },
  { id: "d20", title: "ذكر", body: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ", source: "سورة الأنبياء، الآية ٨٧" },
  { id: "d21", title: "دعاء", body: "اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي", source: "صحيح مسلم، حديث ٢٧٢٥" },
  { id: "d22", title: "دعاء", body: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ مَا عَمِلْتُ وَمِنْ شَرِّ مَا لَمْ أَعْمَلْ", source: "صحيح مسلم، حديث ٢٧١٦" },
  { id: "d23", title: "دعاء", body: "رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَتَوَفَّنَا مُسْلِمِينَ", source: "سورة الأعراف، الآية ١٢٦" },
  { id: "d24", title: "دعاء", body: "رَبِّ إِنِّي لِمَا أَنْزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ", source: "سورة القصص، الآية ٢٤" },
  { id: "h01", title: "حديث نبوي", body: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ", source: "صحيح البخاري، حديث ١؛ صحيح مسلم، حديث ١٩٠٧" },
  { id: "h02", title: "حديث نبوي", body: "الدِّينُ النَّصِيحَةُ", source: "صحيح مسلم، حديث ٥٥" },
  { id: "h03", title: "حديث نبوي", body: "مَنْ لَا يَرْحَمُ لَا يُرْحَمُ", source: "صحيح البخاري، حديث ٥٩٩٧؛ صحيح مسلم، حديث ٢٣١٨" },
  { id: "h04", title: "حديث نبوي", body: "الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ", source: "صحيح البخاري، حديث ٢٩٨٩؛ صحيح مسلم، حديث ١٠٠٩" },
  { id: "h05", title: "حديث نبوي", body: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ", source: "صحيح البخاري، حديث ٦٠١٨؛ صحيح مسلم، حديث ٤٧" },
  { id: "h06", title: "حديث نبوي", body: "لَا يَشْكُرُ اللَّهَ مَنْ لَا يَشْكُرُ النَّاسَ", source: "سنن أبي داود، حديث ٤٨١١؛ سنن الترمذي، حديث ١٩٥٤" },
  { id: "h07", title: "حديث نبوي", body: "يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا", source: "صحيح البخاري، حديث ٦٩؛ صحيح مسلم، حديث ١٧٣٤" },
  { id: "h08", title: "حديث نبوي", body: "إِنَّ اللَّهَ كَتَبَ الْإِحْسَانَ عَلَى كُلِّ شَيْءٍ", source: "صحيح مسلم، حديث ١٩٥٥" },
  { id: "h09", title: "حديث نبوي", body: "لَا تَغْضَبْ", source: "صحيح البخاري، حديث ٦١١٦" },
  { id: "h10", title: "حديث نبوي", body: "الطُّهُورُ شَطْرُ الْإِيمَانِ", source: "صحيح مسلم، حديث ٢٢٣" }
];
function shuffled(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function nextReminder(g) {
  let unused = REMINDERS.filter(item => !g.settings.reminderUsed.includes(item.id));
  if (!unused.length) {
    // A full cycle has been delivered. Start a fresh cycle, avoiding an immediate repeat.
    const previous = g.settings.lastReminderId;
    g.settings.reminderUsed = [];
    unused = REMINDERS.filter(item => item.id !== previous);
  }
  const chosen = shuffled(unused)[0];
  g.settings.lastReminderId = chosen.id;
  g.settings.reminderUsed.push(chosen.id);
  saveData();
  return chosen;
}
function reminderEmbed(guildId, item) {
  return makeEmbed(guildId, item.title, `${item.body}\n\n**المصدر:** ${item.source}`)
    .setFooter({ text: "تذكير بالذكر والطاعة" });
}
async function postReminder(guild, channel) {
  const item = nextReminder(guildData(guild.id));
  await channel.send({ embeds: [reminderEmbed(guild.id, item)] });
  guildData(guild.id).settings.lastReminderAt = Date.now();
  saveData();
}
async function processVoiceSessions(guild) {
  const settings = guildData(guild.id).settings;
  const now = Date.now();
  const interval = Math.max(60000, Number(settings.voicePointIntervalMs || 600000));
  const amount = Math.max(1, Number(settings.voicePointAmount || 1));
  for (const [userId, session] of Object.entries(settings.voiceSessions || {})) {
    const total = Number(session.progressMs || 0) + Math.max(0, now - Number(session.startedAt || now));
    const cycles = Math.floor(total / interval);
    if (!cycles) continue;
    const earned = cycles * amount;
    setCoins(guild.id, userId, coins(guild.id, userId) + earned);
    session.startedAt = now;
    session.progressMs = total % interval;
    saveData();
    await sendLog(guild, `العضو: <@${userId}>\\nالنقاط المكتسبة أثناء الصوت: ${earned}\\nالرصيد: ${coins(guild.id, userId)}`,
      settings.voiceLogChannelId, "نقاط مدة الصوت");
  }
}

async function schedulerTick(guild) {
  const s = guildData(guild.id).settings;
  if (!s.reminderChannelId) return;
  if (Date.now() - Number(s.lastReminderAt) < s.reminderIntervalMs) return;
  const channel = await guild.channels.fetch(s.reminderChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await postReminder(guild, channel);
}

client.once("ready", () => {
  console.log(`تم تشغيل البوت بنجاح: ${client.user.tag}`);
  client.user.setActivity("الأذكار والنقاط", { type: ActivityType.Playing });
  for (const guild of client.guilds.cache.values()) {
    const settings = guildData(guild.id).settings;
    for (const [userId, session] of Object.entries(settings.voiceSessions || {})) {
      const member = guild.members.cache.get(userId);
      if (member?.voice?.channelId) {
        session.startedAt = Date.now();
        session.channelId = member.voice.channelId;
      } else {
        delete settings.voiceSessions[userId];
      }
    }
    for (const member of guild.members.cache.values()) {
      if (!member.user.bot && member.voice?.channelId && !settings.voiceSessions[member.id]) {
        settings.voiceSessions[member.id] = {
          startedAt: Date.now(),
          progressMs: Number(settings.voiceProgress?.[member.id] || 0),
          channelId: member.voice.channelId
        };
      }
    }
    saveData();
  }
  setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      schedulerTick(guild).catch(console.error);
      processVoiceSessions(guild).catch(console.error);
    }
  }, 15000);
});

client.on("guildCreate", guild => {
  guildData(guild.id);
  saveData();
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const g = guildData(message.guild.id);
  const s = g.settings;
  const prefix = s.prefix;
  if (!message.content.startsWith(prefix)) {
    if (s.proposalChannelId === message.channel.id) {
      if (!message.content.trim() && !message.attachments.size) return;
      const proposalId = String(s.nextProposalNumber++);
      const attachmentLinks = [...message.attachments.values()].map(a => a.url);
      const proposal = {
        id: proposalId, userId: message.author.id,
        text: message.content.trim() || "اقتراح مرفق",
        channelId: message.channel.id, channelName: message.channel.name,
        status: "pending", votes: {}
      };
      g.proposals[proposalId] = proposal;
      saveData();
      const description = proposal.text + (attachmentLinks.length ? "\n\n" + attachmentLinks.join("\n") : "");
      const embed = proposalEmbed(message.guild.id, { ...proposal, text: description.slice(0, 3900) });
      const posted = await message.channel.send({ embeds: [embed], components: proposalRows(proposalId), allowedMentions: { parse: [] } });
      await message.delete().catch(error => console.warn("تعذر حذف رسالة الاقتراح الأصلية:", error.message));
      proposal.messageId = posted.id;
      proposal.messageUrl = posted.url;
      saveData();
      return;
    }
    return;
  }

  const parts = message.content.slice(prefix.length).trim().split(/\s+/);
  // Support readable Arabic commands that contain spaces, while retaining old aliases.
  const twoWordCommands = {
    "نقاط للكل": "allpoints",
    "لوق التحويل": "logtoggle",
    "لوق النقاط": "logtoggle",
    "لوق الصوت": "logtoggle",
    "لوق عام": "logtoggle",
    "تصفير النقاط": "resetall",
    "نقاط الصوت": "setvoicepoints",
    "تغيير البادئة": "setprefix",
    "لون الإيمبد": "setcolor",
    "اسم البوت": "setbotname",
    "صورة البوت": "setbotavatar",
    "إرسال إيمبد": "sendembed",
    "إرسال رسالة": "sendmessage",
    "إرسال الخاص": "broadcast",
    "تحديد الذكر": "setreminder",
    "وقت الذكر": "setinterval",
    "إيقاف الأذكار": "reminderoff"
  };
  const firstTwo = `${parts[0] || ""} ${parts[1] || ""}`;
  let command;
  if (twoWordCommands[firstTwo]) {
    command = twoWordCommands[firstTwo];
    if (command === "logtoggle") parts.splice(0, 1);
    else parts.splice(0, 2);
  } else {
    command = (parts.shift() || "").toLowerCase();
  }
  const args = parts;
  const guild = message.guild;
  const member = message.member;
  const author = message.author;
  const target = message.mentions.users.first();
  const role = message.mentions.roles.first();
  const channel = message.mentions.channels.first();

  const aliases = {
    help: "help", "مساعدة": "help", coins: "coins", "نقاطي": "coins",
    transfer: "transfer", "تحويل": "transfer", top: "top", "توب": "top",
    give: "give", "اعطاء": "give", "إعطاء": "give", add: "give",
    remove: "remove", "سحب": "remove", resetall: "resetall", "تصفيرالنقاط": "resetall",
    allpoints: "allpoints", "نقاطللجميع": "allpoints",
    broadcast: "broadcast", "ارسالالخاص": "broadcast", "إرسالالخاص": "broadcast",
    settransferlog: "settransferlog", "لوقالتحويل": "settransferlog", "لوق_التحويل": "settransferlog",
    setpointslog: "setpointslog", "لوقالنقاط": "setpointslog", "لوق_النقاط": "setpointslog",
    setvoicelog: "setvoicelog", "لوقالصوت": "setvoicelog", "لوق_الصوت": "setvoicelog",
    setlog: "setlog", "تحديداللوق": "setlog",
    setvoicepoints: "setvoicepoints", "نقاطالصوت": "setvoicepoints",
    setbotname: "setbotname", "اسمالبوت": "setbotname",
    setbotavatar: "setbotavatar", "صورةالبوت": "setbotavatar",
    setcolor: "setcolor", "لونالإيمبد": "setcolor",
    setprefix: "setprefix", "تغييرالبادئة": "setprefix",
    setreminder: "setreminder", "تحديدالذكر": "setreminder",
    setinterval: "setinterval", "وقتالذكر": "setinterval",
    sendembed: "sendembed", "إرسالإيمبد": "sendembed", "ارسالامبد": "sendembed",
    sendmessage: "sendmessage", "إرسالرسالة": "sendmessage", "ارسالرسالة": "sendmessage",
    reminderoff: "reminderoff", "إيقافالأذكار": "reminderoff",
    reminder: "reminder", "ذكر": "reminder",
    proposals: "setproposals", "اقتراحات": "setproposals",
    log: "logtoggle", "لوق": "logtoggle"
  };
  const cmd = aliases[command];
  if (!cmd) return;

  // These three commands are public. Every other command is restricted.
  const publicCommands = new Set(["help", "coins", "transfer", "top"]);
  if (!publicCommands.has(cmd)) {
    const permitted = isManager(member);
    if (!permitted) return message.reply("عذراً، لا تملك الصلاحية لاستخدام هذا الأمر.");
  }

  try {
    if (cmd === "logtoggle") {
      const types = { التحويل: "transferLogChannelId", النقاط: "pointsLogChannelId",
        الصوت: "voiceLogChannelId", عام: "logChannelId" };
      const key = types[args[0]];
      if (!key) return message.reply("أنواع اللوقات المتاحة: التحويل، النقاط، الصوت، عام. مثال: !لوق النقاط #روم");
      const selectedChannel = message.mentions.channels.first();
      if (!selectedChannel || !selectedChannel.isTextBased()) {
        return message.reply(`حدد روم اللوق بمنشن الروم. مثال: !لوق ${args[0]} #الروم`);
      }
      s[key] = selectedChannel.id;
      saveData();
      return message.reply(`تم تحديد روم لوق ${args[0]}: ${selectedChannel}\nإذا حددت رومًا آخر لاحقًا فسيتم استبدال هذا الروم تلقائيًا.`);
    }
    if (cmd === "setproposals") {
      const destination = message.mentions.channels.first();
      const modRole = message.mentions.roles.first();
      if (!destination?.isTextBased()) return message.reply("الاستخدام: !اقتراحات #روم-الاقتراحات @رتبة-الإدارة");
      s.proposalChannelId = destination.id;
      if (modRole) s.proposalRoleId = modRole.id;
      saveData();
      return message.reply({ embeds: [makeEmbed(guild.id, "تم إعداد الاقتراحات",
        `روم الاقتراحات: ${destination}\nرتبة إدارة الاقتراحات: ${s.proposalRoleId ? `<@&${s.proposalRoleId}>` : "رتبة الإدارة العامة المحددة في ADMIN_ROLE_ID"}\nأرسل الأعضاء اقتراحاتهم داخل الروم المحدد.`)] });
    }
    if (cmd === "help") {
      const categories = {
        points: {
          label: "أوامر النقاط",
          description: [
            `\`${prefix}نقاطي\` — عرض رصيدك الحالي`,
            `\`${prefix}تحويل @عضو 50\` — تحويل نقاط لعضو`,
            `\`${prefix}توب\` — عرض قائمة المتصدرين`,
            `\`${prefix}إعطاء @عضو 50\` أو \`${prefix}إعطاء الكل 50\` — منح نقاط`,
            `\`${prefix}سحب @عضو 50\` أو \`${prefix}سحب الكل 50\` — سحب نقاط`,
            `\`${prefix}تصفير النقاط\` — تصفير جميع الأرصدة`,
            `\`${prefix}نقاط للكل 50\` — إضافة نقاط لكل الأعضاء`,
            `\`${prefix}لوق النقاط #روم\` — تحديد روم سجل النقاط`,
            `\`${prefix}لوق الصوت #روم\` — تحديد روم سجل الصوت`,
            `\`${prefix}نقاط الصوت 5 10\` — خمس نقاط لكل عشر دقائق في الصوت`
          ].join("\n")
        },
        logs: {
          label: "أوامر اللوق",
          description: [
            `\`${prefix}لوق التحويل #روم\` — سجل تحويل النقاط`,
            `\`${prefix}لوق النقاط #روم\` — سجل منح وسحب النقاط`,
            `\`${prefix}لوق الصوت #روم\` — سجل دخول وخروج الصوت والنقاط المكتسبة`,
            "لتغيير روم أي لوق، استخدم الأمر نفسه مع منشن الروم الجديد؛ سيتم استبدال الروم السابق تلقائيًا."
          ].join("\n")
        },
        proposals: {
          label: "أوامر الاقتراحات",
          description: [
            `\`${prefix}اقتراحات #روم-الاقتراحات @رتبة-الإدارة\` — تحديد روم استقبال الاقتراحات ورتبة الإدارة المسؤولة عن مراجعتها`,
            "أرسل اقتراحك كرسالة داخل روم الاقتراحات؛ يحذف البوت الرسالة الأصلية ويحوّلها إلى Embed برقم متسلسل.",
            "يوجد تصويت 👍 و👎 أعلى أزرار الحالة، ويمكن لكل عضو تغيير تصويته.",
            "أزرار الحالة من اليسار إلى اليمين: قيد الدراسة • قبول • رفض • تم التنفيذ.",
            "يستطيع الإداري اعتماد حالة واحدة فقط؛ بعدها تُقفل الأزرار ويُحفظ اسم الإداري والحالة.",
            "يرسل البوت لصاحب الاقتراح رسالة خاصة بالحالة وروم الاقتراح ورابطه.",
            "ملاحظة: أزرار الحالة مخصصة لرتبة إدارة الاقتراحات أو لمن لديه صلاحية Administrator."
          ].join("\n")
        },
        reminders: {
          label: "أوامر الأذكار",
          description: [
            `\`${prefix}تحديد الذكر #روم 30m\` — تشغيل الأذكار في روم محدد`,
            `\`${prefix}وقت الذكر 1h\` — تغيير فترة إرسال الأذكار`,
            `\`${prefix}إيقاف الأذكار\` — إيقاف الإرسال التلقائي`,
            `\`${prefix}ذكر\` — إرسال ذكر الآن`
          ].join("\n")
        },
        messages: {
          label: "أوامر الرسائل",
          description: [
            `\`${prefix}إرسال إيمبد #روم #5865F2 نص الرسالة\` — إرسال رسالة بإيمبد مع تحديد لون الشريط`,
            `\`${prefix}إرسال رسالة #روم نص الرسالة\` — إرسال رسالة عادية بدون إيمبد`,
            `\`${prefix}إرسال الخاص نص الرسالة\` — إرسال رسالة خاصة لجميع الأعضاء؛ اكتب **أكيد** لتأكيد الإرسال`
          ].join("\n")
        },
        bot: {
          label: "إعدادات البوت",
          description: [
            `\`${prefix}تغيير البادئة ؟\` — تغيير بادئة الأوامر`,
            `\`${prefix}لون الإيمبد #RRGGBB\` — تغيير لون الإيمبدات`,
            `\`${prefix}اسم البوت الاسم\` — تغيير اسم البوت`,
            `\`${prefix}صورة البوت رابط\` — تغيير صورة البوت`
          ].join("\n")
        }
      };
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`bot_help_${author.id}`)
        .setPlaceholder("اختر قسم الأوامر لعرض تفاصيله")
        .addOptions(Object.entries(categories).map(([value, item]) => ({
          label: item.label, value, description: `عرض ${item.label}`
        })));
      const row = new ActionRowBuilder().addComponents(menu);
      const embed = makeEmbed(guild.id, "مركز المساعدة — أوامر البوت",
        `**البادئة الحالية:** \`${prefix}\`\n**تغيير البادئة:** \`${prefix}تغيير البادئة ؟\`\n\nاختر القسم الذي تريد عرض أوامره من القائمة بالأسفل.\n\n**الأقسام المتاحة:** النقاط • اللوق • الاقتراحات • الأذكار • الرسائل • إعدادات البوت`);
      const helpMessage = await message.reply({ embeds: [embed], components: [row] });
      const collector = helpMessage.createMessageComponentCollector({
        filter: interaction => interaction.customId === `bot_help_${author.id}` && interaction.user.id === author.id,
        time: 120000
      });
      collector.on("collect", async interaction => {
        const selected = categories[interaction.values[0]];
        if (!selected) return interaction.deferUpdate();
        await interaction.update({ embeds: [makeEmbed(guild.id, selected.label, selected.description)], components: [row] });
      });
      collector.on("end", () => helpMessage.edit({ components: [] }).catch(() => null));
      return;
    }

    if (cmd === "coins") {
      return message.reply({ embeds: [userBalanceEmbed(guild.id, author, coins(guild.id, author.id))] });
    }

    if (cmd === "transfer") {
      const amount = parseAmount(args.find(x => /^\d+$/.test(x)));
      if (!target || target.bot || target.id === author.id || !amount) {
        return message.reply("الاستخدام الصحيح: تحويل @العضو المبلغ");
      }
      const from = coins(guild.id, author.id);
      if (from < amount) return message.reply("رصيدك لا يكفي لإتمام التحويل.");
      setCoins(guild.id, author.id, from - amount);
      setCoins(guild.id, target.id, coins(guild.id, target.id) + amount);
      const embed = makeEmbed(guild.id, "تم تحويل النقاط", `المرسل: ${author}\nالمستلم: ${target}\nالمبلغ: **${amount.toLocaleString("ar-SA")} نقطة**`);
      await sendLog(guild, `المنفذ: ${author} (${author.id})\nالمستلم: ${target} (${target.id})\nالمبلغ: ${amount} نقطة`, s.transferLogChannelId, "تحويل نقاط");
      return message.reply({ embeds: [embed] });
    }

    if (cmd === "top") {
      const rows = Object.entries(g.users)
        .map(([id, info]) => ({ id, points: Number(info.points || 0) }))
        .filter(x => x.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);
      if (!rows.length) return message.reply({ embeds: [makeEmbed(guild.id, "المتصدرون", "لا توجد نقاط مسجلة حتى الآن.")] });
      const lines = await Promise.all(rows.map(async (row, i) => {
        const m = await guild.members.fetch(row.id).catch(() => null);
        return `**${i + 1}.** ${m ? m.user.username : `<@${row.id}>`} — **${row.points.toLocaleString("ar-SA")} نقطة**`;
      }));
      return message.reply({ embeds: [makeEmbed(guild.id, "🏆 المتصدرون بالنقاط", lines.join("\n"))] });
    }

    if (cmd === "give" || cmd === "remove") {
      const amount = parseAmount(args.find(x => /^\d+$/.test(x)));
      if (!amount) return message.reply("الاستخدام: إعطاء @عضو 50 أو إعطاء الكل 50");
      const everyone = args.some(x => ["الجميع", "الكل", "all"].includes(x.toLowerCase()));
      if (everyone) {
        await guild.members.fetch();
        let count = 0;
        for (const m of guild.members.cache.values()) {
          if (m.user.bot) continue;
          const old = coins(guild.id, m.id);
          if (cmd === "remove" && old < amount) continue;
          setCoins(guild.id, m.id, cmd === "give" ? old + amount : old - amount);
          count++;
        }
        await sendLog(guild, `المنفذ: ${author} (${author.id})\nالعملية: ${cmd === "give" ? "إضافة" : "سحب"} جماعية\nالمبلغ لكل عضو: ${amount}\nعدد الأعضاء: ${count}`, s.pointsLogChannelId, "سجل النقاط");
        return message.reply({ embeds: [makeEmbed(guild.id, "تم تنفيذ العملية", `تمت العملية على ${count} عضو.`)] });
      }
      if (!target || target.bot) return message.reply("منشن العضو المطلوب.");
      const old = coins(guild.id, target.id);
      if (cmd === "remove" && old < amount) return message.reply("رصيد العضو أقل من المبلغ المطلوب سحبه.");
      setCoins(guild.id, target.id, cmd === "give" ? old + amount : old - amount);
      await sendLog(guild, `المنفذ: ${author} (${author.id})\nالعضو: ${target} (${target.id})\nالعملية: ${cmd === "give" ? "إضافة" : "سحب"}\nالمبلغ: ${amount}\nالرصيد الجديد: ${coins(guild.id, target.id)}`, s.pointsLogChannelId, "سجل النقاط");
      return message.reply({ embeds: [userBalanceEmbed(guild.id, target, coins(guild.id, target.id))] });
    }

    if (cmd === "resetall") {
      if (!canManagePoints(member)) return message.reply("هذا الأمر مخصص لرتبة إدارة النقاط.");
      await message.reply("لتأكيد حذف جميع نقاط الأعضاء، اكتب **أكيد** خلال ٣٠ ثانية.");
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === author.id && ["أكيد", "اكيد"].includes(m.content.trim()),
        max: 1, time: 30000
      });
      if (!collected.size) return message.reply("تم إلغاء العملية.");
      for (const info of Object.values(g.users)) info.points = 0;
      saveData();
      await sendLog(guild, `المنفذ: ${author} (${author.id})\\nتم تصفير نقاط جميع الأعضاء.`, s.pointsLogChannelId, "سجل النقاط");
      return message.reply({ embeds: [makeEmbed(guild.id, "تم تصفير النقاط", "تم حذف نقاط جميع الأعضاء بنجاح.")] });
    }

    if (cmd === "allpoints") {
      if (!canManagePoints(member)) return message.reply("هذا الأمر مخصص لرتبة إدارة النقاط.");
      const amount = parseAmount(args.find(x => /^\d+$/.test(x)));
      if (!amount) return message.reply("الاستخدام الصحيح: نقاط للكل المبلغ");
      await message.reply(`سيتم إضافة ${amount} نقطة لكل عضو. اكتب **أكيد** خلال ٣٠ ثانية لتأكيد العملية.`);
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === author.id && ["أكيد", "اكيد"].includes(m.content.trim()),
        max: 1, time: 30000
      });
      if (!collected.size) return message.reply("تم إلغاء العملية.");
      await guild.members.fetch();
      let count = 0;
      for (const m of guild.members.cache.values()) {
        if (m.user.bot) continue;
        setCoins(guild.id, m.id, coins(guild.id, m.id) + amount);
        count++;
      }
      await sendLog(guild, `المنفذ: ${author} (${author.id})\nإضافة جماعية: ${amount} نقطة لكل عضو\nعدد الأعضاء: ${count}`, s.pointsLogChannelId, "سجل النقاط");
      return message.reply({ embeds: [makeEmbed(guild.id, "تمت إضافة النقاط", `تمت إضافة **${amount} نقطة** إلى **${count} عضو**.`)] });
    }

    if (cmd === "broadcast") {
      if (!canBroadcast(member)) return message.reply("هذا الأمر مخصص لرتبة إرسال الرسائل الخاصة.");
      const text = args.join(" ").trim();
      if (!text) return message.reply("اكتب نص الرسالة بعد الأمر.");
      await message.reply("سيتم إرسال رسالتك الخاصة كما كتبتها، مع منشن العضو فقط. اكتب **أكيد** خلال ٣٠ ثانية لتأكيد الإرسال.");
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === author.id && ["أكيد", "اكيد"].includes(m.content.trim()),
        max: 1, time: 30000
      });
      if (!collected.size) return message.reply("تم إلغاء الإرسال.");
      await guild.members.fetch();
      const recipients = guild.members.cache.filter(m => !m.user.bot);
      let sent = 0, failed = 0;
      const status = await message.channel.send({ embeds: [makeEmbed(guild.id, "جاري الإرسال", `عدد الأعضاء: ${recipients.size}`)] });
      for (const m of recipients.values()) {
        try {
          // Exactly the requested message and the member mention; no server name, title, footer or embed.
          await m.send({ content: `${m}\n${text}`, allowedMentions: { users: [m.id] } });
          sent++;
        } catch { failed++; }
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
      return status.edit({ embeds: [makeEmbed(guild.id, "اكتمل إرسال الرسائل", `تم الإرسال: **${sent}**\nتعذر الإرسال: **${failed}**`)] });
    }

    if (["settransferlog", "setpointslog", "setvoicelog", "setlog"].includes(cmd)) {
      if (!channel || !channel.isTextBased()) return message.reply("منشن روم السجلات المطلوب.");
      const key = { settransferlog: "transferLogChannelId", setpointslog: "pointsLogChannelId", setvoicelog: "voiceLogChannelId", setlog: "logChannelId" }[cmd];
      s[key] = channel.id; saveData();
      return message.reply({ embeds: [makeEmbed(guild.id, "تم تحديد روم السجل", `${channel}`)] });
    }
    if (cmd === "sendembed") {
      const channelId = args[0]?.match(/^<#(\d+)>$/)?.[1] || (args[0] && /^\d{17,20}$/.test(args[0]) ? args[0] : null);
      const destination = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
      const color = args.find(x => validColor(x));
      const textStart = args.findIndex(x => validColor(x));
      const content = textStart >= 0 ? args.slice(textStart + 1).join(" ").trim() : "";
      if (!destination?.isTextBased() || !color || !content) {
        return message.reply(`الاستخدام: ${prefix}إرسالإيمبد #الروم #5865F2 نص الرسالة`);
      }
      const embed = new EmbedBuilder().setColor(parseInt(color.slice(1), 16)).setDescription(content).setTimestamp();
      await destination.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return message.reply({ embeds: [makeEmbed(guild.id, "تم إرسال الإيمبد", `تم إرسال الرسالة إلى ${destination} باللون ${color.toUpperCase()}.`)] });
    }

    if (cmd === "sendmessage") {
      const channelId = args[0]?.match(/^<#(\d+)>$/)?.[1] || (args[0] && /^\d{17,20}$/.test(args[0]) ? args[0] : null);
      const destination = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
      const content = args.slice(1).join(" ").trim();
      if (!destination?.isTextBased() || !content) {
        return message.reply(`الاستخدام: ${prefix}إرسالرسالة #الروم نص الرسالة`);
      }
      if (content.length > 2000) return message.reply("الرسالة العادية يجب ألا تتجاوز 2000 حرف.");
      await destination.send({ content, allowedMentions: { parse: [] } });
      return message.reply({ embeds: [makeEmbed(guild.id, "تم إرسال الرسالة", `تم إرسال الرسالة العادية إلى ${destination}.`)] });
    }

    if (cmd === "setvoicepoints") {
      const amount = parseAmount(args[0]), minutes = Number(args[1]);
      if (!amount || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return message.reply("الاستخدام: نقاط الصوت 5 10 — خمس نقاط لكل عشر دقائق.");
      s.voicePointAmount = amount; s.voicePointIntervalMs = minutes * 60000; saveData();
      return message.reply({ embeds: [makeEmbed(guild.id, "تم ضبط نقاط الصوت", `${amount} نقطة لكل ${minutes} دقيقة.`)] });
    }
    if (cmd === "setbotname") {
      const name = args.join(" ").trim();
      if (name.length < 2 || name.length > 32) return message.reply("اكتب اسماً من 2 إلى 32 حرفاً.");
      await client.user.setUsername(name);
      return message.reply({ embeds: [makeEmbed(guild.id, "تم تغيير اسم البوت", name)] });
    }
    if (cmd === "setbotavatar") {
      const url = args[0];
      if (!/^https?:\/\//i.test(url || "")) return message.reply("اكتب رابط صورة مباشر يبدأ بـ https://");
      await client.user.setAvatar(url);
      return message.reply({ embeds: [makeEmbed(guild.id, "تم تغيير صورة البوت", "تم تحديث الصورة.")] });
    }

    if (cmd === "setcolor") {
      if (!isAdmin(member) && !isManager(member)) return message.reply("يلزم امتلاك صلاحية الإدارة.");
      const value = args.find(x => validColor(x));
      if (!value) return message.reply("اكتب اللون بصيغة #RRGGBB، مثال: #12A4D9");
      s.embedColor = value.toUpperCase();
      saveData();
      return message.reply({ embeds: [makeEmbed(guild.id, "تم تغيير اللون", `اللون الجديد: **${s.embedColor}**`)] });
    }

    if (cmd === "setprefix") {
      if (!isAdmin(member) && !isManager(member)) return message.reply("يلزم امتلاك صلاحية الإدارة.");
      const value = args[0];
      if (!value || value.length > 3 || /\s/.test(value)) return message.reply("اختر بادئة من حرف إلى ثلاثة أحرف دون مسافات.");
      s.prefix = value;
      saveData();
      return message.reply(`تم تغيير بادئة الأوامر إلى: ${value}`);
    }

    if (cmd === "setreminder") {
      const duration = parseDuration(args.find(x => /^\d+[mhd]$/i.test(x)));
      if (!channel || !channel.isTextBased() || !duration) {
        return message.reply("الاستخدام: تحديدالذكر #الروم 30m — أقل مدة ٥ دقائق، مثل 10m أو 30m أو 1h.");
      }
      s.reminderChannelId = channel.id;
      s.reminderIntervalMs = duration;
      s.lastReminderAt = 0;
      saveData();
      await postReminder(guild, channel);
      return message.reply(`تم تشغيل الأذكار في ${channel} كل ${durationText(duration)}.`);
    }

    if (cmd === "setinterval") {
      const duration = parseDuration(args[0]);
      if (!s.reminderChannelId) return message.reply("حدد روم الأذكار أولاً باستخدام تحديدالذكر.");
      if (!duration) return message.reply("اكتب مدة صحيحة مثل 10m أو 30m أو 1h، والحد الأدنى ٥ دقائق.");
      s.reminderIntervalMs = duration;
      s.lastReminderAt = Date.now();
      saveData();
      return message.reply(`تم تغيير موعد الأذكار إلى كل ${durationText(duration)}.`);
    }

    if (cmd === "reminderoff") {
      s.reminderChannelId = null;
      saveData();
      return message.reply("تم إيقاف إرسال الأذكار التلقائي.");
    }

    if (cmd === "reminder") {
      const item = nextReminder(g);
      return message.reply({ embeds: [reminderEmbed(guild.id, item)] });
    }
  } catch (error) {
    console.error("خطأ أثناء تنفيذ الأمر:", error);
    return message.reply("حدث خطأ أثناء تنفيذ الأمر، راجع سجل التشغيل.").catch(() => null);
  }
});


client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith("proposal_vote_")) {
    const parts = interaction.customId.split("_");
    const vote = parts[2];
    const proposalId = parts.slice(3).join("_");
    if (!interaction.guildId || !interaction.guild) return interaction.reply({ content: "التصويت يعمل داخل السيرفر فقط.", ephemeral: true });
    const g = guildData(interaction.guildId);
    const proposal = g.proposals?.[proposalId];
    if (!proposal) return interaction.reply({ content: "هذا الاقتراح غير موجود أو انتهى.", ephemeral: true });
    if (!["up", "down"].includes(vote)) return interaction.reply({ content: "تصويت غير معروف.", ephemeral: true });
    proposal.votes ??= {};
    // يسمح للعضو بتغيير صوته، ويُحتسب صوته مرة واحدة فقط.
    proposal.votes[interaction.user.id] = vote;
    saveData();
    await interaction.update({ embeds: [proposalEmbed(interaction.guildId, proposal)], components: proposalRows(proposalId, proposal.status !== "pending") });
    return;
  }
  if (!interaction.customId.startsWith("proposal_status_")) return;
  const parts = interaction.customId.split("_");
  const value = parts[2];
  const proposalId = parts.slice(3).join("_");
  if (!interaction.guildId || !interaction.guild) return interaction.reply({ content: "هذا الزر يعمل داخل السيرفر فقط.", ephemeral: true });
  const g = guildData(interaction.guildId);
  const proposal = g.proposals?.[proposalId];
  if (!proposal) return interaction.reply({ content: "هذا الاقتراح غير موجود أو انتهى.", ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const settings = g.settings;
  const authorized = Boolean(member && ((settings.proposalRoleId && member.roles.cache.has(settings.proposalRoleId)) || isManager(member) || isAdmin(member)));
  if (!authorized) return interaction.reply({ content: "هذا الزر مخصص للإدارة فقط.", ephemeral: true });
  if (proposal.status !== "pending") {
    return interaction.reply({ content: `تم اختيار حالة هذا الاقتراح مسبقاً: ${proposal.statusName || proposal.status}. لا يمكن اختيار حالة أخرى.`, ephemeral: true });
  }
  const statuses = {
    review: ["قيد الدراسة", "اقتراحك قيد الدراسة حالياً."],
    accepted: ["قبول", "تم قبول اقتراحك."],
    rejected: ["رفض", "نعتذر، تم رفض اقتراحك."],
    done: ["تم التنفيذ", "تم تنفيذ اقتراحك، شكراً لمساهمتك."]
  };
  const selected = statuses[value];
  if (!selected) return interaction.reply({ content: "حالة غير معروفة.", ephemeral: true });
  proposal.status = value;
  proposal.statusName = selected[0];
  proposal.reviewedBy = interaction.user.id;
  proposal.reviewedAt = Date.now();
  saveData();
  const updated = proposalEmbed(interaction.guildId, proposal).addFields(
    { name: "اعتماد الحالة بواسطة", value: `<@${interaction.user.id}>`, inline: true }
  );
  await interaction.update({ embeds: [updated], components: proposalRows(proposalId, true) });
  const user = await client.users.fetch(proposal.userId).catch(() => null);
  if (user) {
    const channelName = proposal.channelName ? `#${proposal.channelName}` : "روم الاقتراحات";
    const proposalLink = proposal.messageUrl ? `\n[عرض الاقتراح في ديسكورد](${proposal.messageUrl})` : "";
    const dm = makeEmbed(interaction.guildId, `تحديث اقتراحك رقم #${proposal.id}`,
      `${selected[1]}\n**السيرفر:** ${interaction.guild.name}\n**الروم الذي أرسلت فيه الاقتراح:** ${channelName}\n**الحالة:** ${selected[0]}\n**الإداري:** ${interaction.user.username}${proposalLink}`);
    await user.send({ embeds: [dm], allowedMentions: { parse: [] } }).catch(() => null);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  if (!guild || newState.member?.user?.bot || oldState.member?.user?.bot) return;
  const g = guildData(guild.id), settings = g.settings;
  const userId = newState.id || oldState.id;
  const user = newState.member?.user || oldState.member?.user;
  if (oldState.channelId === newState.channelId) return;

  if (oldState.channelId) {
    const session = settings.voiceSessions[userId];
    if (session) {
      const elapsed = Math.max(0, Date.now() - Number(session.startedAt || Date.now()));
      const total = Number(session.progressMs || 0) + elapsed;
      const interval = Math.max(60000, Number(settings.voicePointIntervalMs || 600000));
      const earned = Math.floor(total / interval) * Math.max(1, Number(settings.voicePointAmount || 1));
      const remainder = total % interval;
      if (earned > 0) setCoins(guild.id, userId, coins(guild.id, userId) + earned);
      settings.voiceProgress ??= {};
      settings.voiceProgress[userId] = remainder;
      delete settings.voiceSessions[userId];
      saveData();
      await sendLog(guild,
        `العضو: <@${userId}> (${userId})\nالروم: <#${oldState.channelId}>\nالمدة: ${Math.floor(elapsed / 60000)} دقيقة\nالنقاط المكتسبة: ${earned}\nالرصيد: ${coins(guild.id, userId)}`,
        settings.voiceLogChannelId, "خروج من روم صوتي");
    } else {
      await sendLog(guild, `العضو: <@${userId}>\nالروم: <#${oldState.channelId}>`,
        settings.voiceLogChannelId, "خروج من روم صوتي");
    }
  }

  if (newState.channelId) {
    const progress = Number(settings.voiceProgress?.[userId] || 0);
    settings.voiceSessions[userId] = { startedAt: Date.now(), progressMs: progress, channelId: newState.channelId };
    saveData();
    await sendLog(guild, `العضو: <@${userId}> (${userId})\nالروم: <#${newState.channelId}>`,
      settings.voiceLogChannelId, "دخول روم صوتي");
  }
});

client.login(TOKEN).catch(error => console.error("تعذر تسجيل دخول البوت:", error));
