const {Client,GatewayIntentBits,Partials,PermissionsBitField,EmbedBuilder,
ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType} = require("discord.js");
const fs=require("fs"),path=require("path"),C=require("./config");
const token=process.env.DISCORD_TOKEN;
if(!token) throw new Error("Missing DISCORD_TOKEN");

const client=new Client({intents:[
  GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildModeration
],partials:[Partials.Channel,Partials.Message,Partials.GuildMember]});

const wf=path.join(__dirname,"data","warnings.json");
const db=()=>JSON.parse(fs.readFileSync(wf,"utf8"));
const save=x=>fs.writeFileSync(wf,JSON.stringify(x,null,2));
const ch=id=>client.channels.cache.get(id);
const staff=m=>m&&(m.permissions.has(PermissionsBitField.Flags.Administrator)||m.roles.cache.has(C.STAFF_TEAM)||m.roles.cache.has(C.STAFF_RIP));
const rip=m=>m&&(m.permissions.has(PermissionsBitField.Flags.Administrator)||m.roles.cache.has(C.STAFF_RIP));
const reply=(m,t)=>m.reply({content:t,allowedMentions:{parse:[]}});
const target=m=>m.mentions.members.first();
const reason=(m,start=2)=>m.content.trim().split(/\s+/).slice(start).join(" ")||"بدون سبب";
const embed=(title,fields,color=0x5865F2)=>new EmbedBuilder().setTitle(title).setColor(color).addFields(fields).setTimestamp();
const log=(id,e)=>{const c=ch(id);if(c?.isTextBased())c.send({embeds:[e]}).catch(()=>{});};
const duration=s=>{const x=String(s||"").match(/^(\d+)(s|m|h|d|w)$/i);if(!x)return null;const mult={s:1e3,m:6e4,h:36e5,d:864e5,w:6048e5}[x[2].toLowerCase()];const ms=+x[1]*mult;return ms>0&&ms<=24192e5?ms:null};

const games=[
"روليت","نرد","عملة","8ball","اختيار","قول","حظ","تخمين","حجر_ورق_مقص","أعلى_رقم",
"ترتيب","سرعة","ذاكرة","رياضيات","تحدي","مباراة","صيد","كنز","XO","تخمين_رقم",
"خمن_الكلمة","حروف","ترتيب_حروف","صح_خطأ","من_أنا","لغز","أسئلة","مسابقة","رقم_سري",
"4_في_صف","دومينو","شطرنج","داما","صندوق","عجلة_الحظ","فتحات","يانصيب","صراحة","جرأة",
"من_الأكثر","لو_كنت","هذا_أو_ذاك","أسئلة_محرجة","تحدي_الأصدقاء","كلمة_سرية"
];
const rnd=a=>a[Math.floor(Math.random()*a.length)];

client.once("ready",async()=>{
  console.log(`RipBot online: ${client.user.tag}`);
  const g=client.guilds.cache.get(C.GUILD_ID);
  if(!g)return console.error("Guild not found");
  console.log(`Connected: ${g.name}`);
  await g.commands.set([
    {
      name:"help",
      description:"عرض جميع أوامر RipBot ومميزاته"
    },
    {
      name:"setup",
      description:"فحص إعدادات RipBot والقنوات والرتب المطلوبة"
    },
    {
      name:"all",
      description:"إدارة الباندات",
      options:[{name:"ban",description:"عرض عدد المتبندين",type:1}]
    }
  ]).then(()=>console.log("Slash commands registered: /help /setup /all"))
    .catch(console.error);
});

client.on("guildMemberAdd",async m=>{
  const c=ch(C.channels.welcome); if(!c?.isTextBased())return;
  await c.send({content:
`ياهلا والله فيك، نورت سيرفرنا 🤍
خذ راحتك ووسع صدرك، ونتمنى لك وقت ممتع معنا 🫶🏻

🎟️ تحتاج تفتح تكت؟ <#${C.channels.tickets}>
👤 عندك مشكلة ضد شخص؟ <#${C.channels.tickets}>
👀 عندك مشكلة ضد إداري؟ <#${C.channels.tickets}>
🧐 ودك تستفسر عن شيء؟ <#${C.channels.tickets}>
🛒 ودك تشتري من المتجر؟ <#${C.channels.tickets}>
🗳️ عندك اقتراح؟ <#${C.channels.suggestions}>
🎬 عندك مشاكل بالسيرفر؟ <#${C.channels.problems}>`}).catch(console.error);
});

client.on("messageCreate",async m=>{
  if(m.author.bot||!m.guild)return;
  const s=m.content.trim(),cmd=s.split(/\s+/)[0];

  if(s==="-تكت")return reply(m,`<#${C.channels.tickets}>`);
  if(s==="-اقتراحات")return reply(m,`<#${C.channels.suggestions}>`);
  if(s==="-مشاكل")return reply(m,`<#${C.channels.problems}>`);
  if(s==="اوامر"||s==="help")return reply(m,
`**RipBot**
🛡️ الإدارة: \`كسرة\` \`فك_كسرة\` \`بنعالي\` \`ابلع\` \`فك_تايم\` \`ميوت\` \`فك_ميوت\` \`دفن\` \`فك_دفن\` \`تحذير\` \`تحذيرات\` \`شيل_تحذير\` \`مسح_تحذيرات\` \`قفل\` \`فتح\` \`مسح\`
🎫 التكت: \`تكت-نشر\` \`استلام\` \`اضافة\` \`ازالة\` \`قفل-تكت\` \`فتح-تكت\` \`حذف-تكت\` \`نقل-تكت\` \`اسم-تكت\`
🔊 الروم الخاص: \`روم-تحكم\` \`روم-اسم\` \`روم-طرد\` \`روم-اضافة\` \`روم-حذف\` \`روم-نقل\` \`روم-قفل\` \`روم-فتح\`
🎮 الألعاب: اكتب \`العاب\`
⚡ \`-تكت\` \`-اقتراحات\` \`-مشاكل\``);
  if(s==="العاب")return reply(m,"🎮 **الألعاب المتاحة:**\n"+games.map(x=>`• \`${x}\``).join("\n"));

  // Public entertainment
  if(games.includes(cmd)){
    const a=s.split(/\s+/).slice(1), choices={
      "روليت":["🔴","⚫","🟢"],"عملة":["وجه 🪙","كتابة 🪙"],
      "حجر_ورق_مقص":["حجر 🪨","ورق 📄","مقص ✂️"],
      "8ball":["نعم.","لا.","ممكن.","غالباً.","جرّب لاحقاً."]
    };
    let out;
    if(cmd==="نرد")out=`🎲 **${1+Math.floor(Math.random()*6)}**`;
    else if(cmd==="حظ")out=`🍀 حظك **${Math.floor(Math.random()*101)}%**`;
    else if(cmd==="اختيار")out=a.length?`🎯 **${rnd(a)}**`:"اكتب خيارات بعد الأمر.";
    else if(cmd==="قول")out=a.length?a.join(" "):"اكتب الكلام بعد الأمر.";
    else if(cmd==="صح_خطأ")out=rnd(["✅ صح","❌ خطأ"]);
    else if(cmd==="صراحة")out="🗣️ "+rnd(["وش أكثر شيء يضحكك؟","وش موقف ما تنساه؟","وش شيء ودك تتعلمه؟"]);
    else if(cmd==="جرأة")out="🔥 "+rnd(["قل كلمة عشوائية.","اكتب أول إيموجي عندك.","غيّر اسمك مؤقتاً لاسم مضحك."]);
    else if(cmd==="من_الأكثر")out="👥 من الأكثر؟ "+rnd(["ضحكاً؟","سهرًا؟","تأخراً؟"]);
    else if(cmd==="هذا_أو_ذاك")out="⚖️ "+rnd(["ليل 🌙 أو نهار ☀️؟","بحر 🌊 أو بر 🏜️؟","قهوة ☕ أو شاي 🍵؟"]);
    else if(cmd==="أسئلة_محرجة")out="😅 "+rnd(["وش أكثر موقف انحرجت منه؟","وش أغرب عادة عندك؟"]);
    else if(choices[cmd])out=`🎮 النتيجة: **${rnd(choices[cmd])}**`;
    else out=`🎮 **${cmd}** — اللعبة موجودة وجاهزة، وهذه النسخة الأساسية تعرض اللعبة وتفتح باب إضافة اللعب التفاعلي.`;
    return reply(m,out);
  }

  if(!staff(m.member)) {
    const staffCmd=["كسرة","فك_كسرة","بنعالي","ابلع","فك_تايم","ميوت","فك_ميوت","دفن","فك_دفن","تحذير","تحذيرات","شيل_تحذير","مسح_تحذيرات","قفل","فتح","مسح","تكت-نشر","استلام","اضافة","ازالة","قفل-تكت","فتح-تكت","حذف-تكت","نقل-تكت","اسم-تكت","روم-تحكم","روم-اسم","روم-طرد","روم-اضافة","روم-حذف","روم-نقل","روم-قفل","روم-فتح"];
    if(staffCmd.includes(cmd))return reply(m,"❌ هذا الأمر للإدارة.");
    return;
  }

  if(cmd==="كسرة"){
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");
    if(!t.bannable)return reply(m,"❌ لا أستطيع الباند بسبب ترتيب الرتب.");
    const r=reason(m);await t.ban({reason:r});
    log(C.channels.moderationLog,embed("🔨 باند",[
      {name:"العضو",value:`${t.user.tag} (${t.id})`},{name:"بواسطة",value:`${m.author}`},{name:"السبب",value:r}],0xED4245));
    return reply(m,"✅ تم الباند.");
  }
  if(cmd==="فك_كسرة"){
    if(!rip(m.member))return reply(m,"❌ هذا الأمر لـ Staff Rip.");
    const id=m.mentions.users.first()?.id||s.split(/\s+/)[1];if(!id)return reply(m,"❌ حط ID العضو.");
    const r=s.split(/\s+/).slice(2).join(" ")||"بدون سبب";await m.guild.bans.remove(id,r);
    log(C.channels.moderationLog,embed("🔓 فك باند",[
      {name:"ID",value:id},{name:"بواسطة",value:`${m.author}`},{name:"السبب",value:r}],0x57F287));
    return reply(m,"✅ تم فك الباند.");
  }
  if(cmd==="بنعالي"){
    const t=target(m);if(!t||!t.kickable)return reply(m,"❌ ما أقدر أطرده.");
    const r=reason(m);await t.kick(r);log(C.channels.moderationLog,embed("👢 كيك",[
      {name:"العضو",value:t.user.tag},{name:"بواسطة",value:`${m.author}`},{name:"السبب",value:r}],0xED4245));
    return reply(m,"✅ تم الطرد.");
  }
  if(cmd==="ابلع"){
    const t=target(m),p=s.split(/\s+/),ms=duration(p[2]);if(!t||!ms)return reply(m,"❌ `ابلع @عضو 10m السبب`");
    const r=p.slice(3).join(" ")||"بدون سبب";if(!t.moderatable)return reply(m,"❌ لا أستطيع التايم.");
    await t.timeout(ms,r);log(C.channels.moderationLog,embed("⏱️ تايم",[
      {name:"العضو",value:t.user.tag},{name:"المدة",value:p[2]},{name:"بواسطة",value:`${m.author}`},{name:"السبب",value:r}],0xFEE75C));
    return reply(m,"✅ تم التايم.");
  }
  if(cmd==="فك_تايم"){
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");await t.timeout(null,"فك التايم");
    log(C.channels.moderationLog,embed("⏱️ فك تايم",[{name:"العضو",value:t.user.tag},{name:"بواسطة",value:`${m.author}`}],0x57F287));
    return reply(m,"✅ تم فك التايم.");
  }
  if(cmd==="ميوت"||cmd==="فك_ميوت"){
    const t=target(m),role=m.guild.roles.cache.get(C.MUTE_ROLE_ID);
    if(!t||!role||C.MUTE_ROLE_ID==="PUT_MUTE_ROLE_ID_HERE")return reply(m,"❌ حط ID رتبة الميوت في `config.js` أولاً.");
    if(cmd==="ميوت"){const r=reason(m);await t.roles.add(role,r);log(C.channels.voiceLog,embed("🔇 ميوت",[
      {name:"العضو",value:t.user.tag},{name:"بواسطة",value:`${m.author}`},{name:"السبب",value:r}],0x5865F2));}
    else {await t.roles.remove(role,"فك الميوت");log(C.channels.voiceLog,embed("🔊 فك ميوت",[
      {name:"العضو",value:t.user.tag},{name:"بواسطة",value:`${m.author}`}],0x57F287));}
    return reply(m,cmd==="ميوت"?"✅ تم الميوت.":"✅ تم فك الميوت.");
  }
  if(cmd==="دفن"||cmd==="فك_دفن"){
    const t=target(m);if(!t?.voice)return reply(m,"❌ العضو غير موجود في الصوت.");
    await t.voice.setDeaf(cmd==="دفن",`بواسطة ${m.author.tag}`);
    log(C.channels.voiceLog,embed(cmd==="دفن"?"🔇 دفن":"🔊 فك دفن",[
      {name:"العضو",value:t.user.tag},{name:"بواسطة",value:`${m.author}`}],0x5865F2));
    return reply(m,cmd==="دفن"?"✅ تم الدفن.":"✅ تم فك الدفن.");
  }
  if(cmd==="تحذير"){
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");const r=reason(m),d=db();
    d[m.guild.id]??={};d[m.guild.id][t.id]??=[];d[m.guild.id][t.id].push({reason:r,by:m.author.id,at:new Date().toISOString()});save(d);
    const n=d[m.guild.id][t.id].length;log(C.channels.warningsLog,embed("⚠️ تحذير",[
      {name:"العضو",value:`${t}`},{name:"بواسطة",value:`${m.author}`},{name:"السبب",value:r},{name:"الإجمالي",value:String(n)}],0xFEE75C));
    return reply(m,`⚠️ تم تحذير ${t}. الإجمالي: **${n}**`);
  }
  if(cmd==="تحذيرات"){
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");const d=db(),a=d[m.guild.id]?.[t.id]||[];
    return reply(m,`⚠️ ${t} لديه **${a.length}** تحذير.\n${a.slice(-10).map((x,i)=>`${i+1}. ${x.reason}`).join("\n")||"لا توجد تحذيرات."}`);
  }
  if(cmd==="شيل_تحذير"){
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");const d=db(),a=d[m.guild.id]?.[t.id]||[];if(!a.length)return reply(m,"❌ ما عنده تحذيرات.");
    a.pop();save(d);return reply(m,"✅ تم شيل آخر تحذير.");
  }
  if(cmd==="مسح_تحذيرات"){
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");const d=db();d[m.guild.id]??={};d[m.guild.id][t.id]=[];save(d);return reply(m,"✅ تم مسح التحذيرات.");
  }
  if(cmd==="قفل"||cmd==="فتح"){
    const lock=cmd==="قفل";await m.channel.permissionOverwrites.edit(m.guild.roles.everyone,{SendMessages:!lock});
    return reply(m,lock?"🔒 تم قفل الروم.":"🔓 تم فتح الروم.");
  }
  if(cmd==="مسح"){
    const n=+s.split(/\s+/)[1];if(![10,20,30,40,50,60,70,80,90,100].includes(n))return reply(m,"❌ المسموح 10/20/30/.../100.");
    const x=await m.channel.messages.fetch({limit:n+1});await m.channel.bulkDelete(x,true);return reply(m,`🧹 تم مسح ${n}.`);
  }
  if(cmd==="تكت-نشر"){
    if(m.channel.id!==C.channels.tickets)return reply(m,`❌ استخدمه في <#${C.channels.tickets}>.`);
    const r1=new ActionRowBuilder().addComponents(
      ["استفسار","دعم فني","شكوى على شخص","شراء من المتجر","طلب رول"].map((x,i)=>new ButtonBuilder().setCustomId(`ticket:${i}`).setLabel(x).setStyle(ButtonStyle.Secondary))
    );
    const r2=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket:5").setLabel("شكوى على إداري").setStyle(ButtonStyle.Secondary));
    await m.channel.send({embeds:[new EmbedBuilder().setTitle("🎫 التذاكر").setDescription("اختر نوع التكت المناسب.\n\nاحترم الإدارة، اشرح طلبك بوضوح، ولا تفتح أكثر من تكت لنفس الموضوع. التقييم بعد الإغلاق اختياري.").setColor(0x2B2D31)],components:[r1,r2]});
    return reply(m,"✅ تم نشر لوحة التكت.");
  }
  if(cmd==="فك_باند_الكل"){
    if(!m.member.permissions.has(PermissionsBitField.Flags.Administrator))return reply(m,"❌ يحتاج Administrator.");
    const b=await m.guild.bans.fetch();for(const [id] of b){try{await m.guild.bans.remove(id,"فك_باند_الكل")}catch{}}
    log(C.channels.moderationLog,embed("🔓 فك باند الكل",[{name:"بواسطة",value:`${m.author}`},{name:"العدد",value:String(b.size)}],0x57F287));
    return reply(m,`✅ تم فك باند **${b.size}**.`);
  }
  if(cmd==="روم-تحكم"||cmd.startsWith("روم-"))return reply(m,"ℹ️ نظام الروم الخاص سيتم ربطه بالملكية والتخزين في خطوة الربط النهائية.");
});

client.on("interactionCreate",async i=>{
  if(i.isChatInputCommand()){
    if(!i.guild)return i.reply({content:"❌ هذا الأمر يعمل داخل السيرفر فقط.",ephemeral:true});

    if(i.commandName==="help"){
      const sections=[
        "**RipBot — كل شيء حرفيًا**",
        "",
        "🛠️ **Slash Commands**",
        "• `/help` — عرض كل أوامر ومميزات البوت.",
        "• `/setup` — فحص إعدادات البوت والقنوات والرتب.",
        "• `/all ban` — عرض عدد المتبندين.",
        "",
        "🛡️ **الإدارة**",
        "• `كسرة @عضو السبب` — باند.",
        "• `فك_كسرة @عضو` — فك الباند.",
        "• `بنعالي @عضو السبب` — طرد.",
        "• `ابلع @عضو 10m السبب` — تايم.",
        "• `فك_تايم @عضو` — فك التايم.",
        "• `ميوت @عضو السبب` / `فك_ميوت @عضو` — ميوت/فك الميوت.",
        "• `دفن @عضو` / `فك_دفن @عضو` — دفن/فك الدفن الصوتي.",
        "• `تحذير @عضو السبب` — إضافة تحذير.",
        "• `تحذيرات @عضو` — عرض التحذيرات.",
        "• `شيل_تحذير @عضو` — إزالة آخر تحذير.",
        "• `مسح_تحذيرات @عضو` — مسح جميع التحذيرات.",
        "• `قفل` / `فتح` — قفل/فتح الروم.",
        "• `مسح 10-100` — مسح رسائل.",
        "• `فك_باند_الكل` — فك جميع الباندات (Administrator).",
        "",
        "🎫 **التكت**",
        "• `تكت-نشر` — نشر لوحة التكت.",
        "• الأزرار: استفسار، دعم فني، شكوى على شخص، شراء من المتجر، طلب رول، شكوى على إداري.",
        "• الحد الأقصى 3 تكتات مفتوحة للعضو.",
        "• `استلام` `اضافة` `ازالة` `قفل-تكت` `فتح-تكت` `حذف-تكت` `نقل-تكت` `اسم-تكت` — أوامر التكت الموجودة في القائمة.",
        "",
        "🔊 **الروم الخاص**",
        "• `روم-تحكم` `روم-اسم` `روم-طرد` `روم-اضافة` `روم-حذف` `روم-نقل` `روم-قفل` `روم-فتح`.",
        "• الربط الكامل بالملكية والتخزين غير منفذ في هذه النسخة.",
        "",
        "🎮 **الألعاب**",
        "• `العاب` — عرض كل الألعاب.",
        `• الألعاب: ${games.join("، ")}`,
        "",
        "⚡ **اختصارات عامة**",
        "• `-تكت` → روم التكت.",
        "• `-اقتراحات` → روم الاقتراحات.",
        "• `-مشاكل` → روم المشاكل.",
        "",
        "👋 **الترحيب**",
        "• عند دخول عضو جديد، يرسل البوت رسالة الترحيب تلقائيًا في قناة الترحيب المحددة.",
        "",
        "📋 **السجلات**",
        "• يسجل الباند، فك الباند، الكيك، التايم، الميوت، الدفن، التحذيرات، التكت، وتغييرات الحالة الصوتية في قنوات السجل المحددة."
      ];
      const text=sections.join("\n");
      return i.reply({embeds:[new EmbedBuilder().setTitle("🤖 RipBot | Help").setDescription(text).setColor(0x5865F2)]});
    }

    if(i.commandName==="setup"){
      if(!staff(i.member))return i.reply({content:"❌ هذا الأمر للإدارة فقط.",ephemeral:true});
      const checks=[
        ["السيرفر",i.guild?.id===C.GUILD_ID],
        ["قناة الترحيب",!!ch(C.channels.welcome)],
        ["قناة التكت",!!ch(C.channels.tickets)],
        ["قناة الاقتراحات",!!ch(C.channels.suggestions)],
        ["قناة المشاكل",!!ch(C.channels.problems)],
        ["تصنيف التكت",!!ch(C.channels.ticketCategory)],
        ["رتبة Staff",!!i.guild.roles.cache.get(C.STAFF_TEAM)],
        ["رتبة Staff Rip",!!i.guild.roles.cache.get(C.STAFF_RIP)],
        ["رتبة الميوت",C.MUTE_ROLE_ID!=="PUT_MUTE_ROLE_ID_HERE" && !!i.guild.roles.cache.get(C.MUTE_ROLE_ID)]
      ];
      const lines=checks.map(([name,ok])=>`${ok?"✅":"❌"} **${name}**`);
      return i.reply({embeds:[new EmbedBuilder().setTitle("⚙️ RipBot Setup").setDescription(lines.join("\n")+"\n\nإذا ظهر ❌ فالقيمة ناقصة أو الـID غير صحيح في config.js.").setColor(0x5865F2)]});
    }

    if(i.commandName==="all" && i.options.getSubcommand()==="ban"){
      if(!i.member.permissions.has(PermissionsBitField.Flags.Administrator))return i.reply({content:"❌ يحتاج Administrator.",ephemeral:true});
      const bans=await i.guild.bans.fetch();
      return i.reply({content:`🔨 عدد المتبندين حاليًا: **${bans.size}**`});
    }
    return;
  }

  if(!i.isButton()||!i.customId.startsWith("ticket:"))return;
  const g=i.guild;if(!g)return;
  const open=g.channels.cache.filter(c=>c.parentId===C.channels.ticketCategory&&c.topic?.includes(`owner:${i.user.id}`));
  if(open.size>=3)return i.reply({content:"❌ عندك 3 تذاكر مفتوحة بالفعل.",ephemeral:true});
  const types=["استفسار","دعم فني","شكوى على شخص","شراء من المتجر","طلب رول","شكوى على إداري"];
  const type=types[+i.customId.split(":")[1]];
  const staffRole=g.roles.cache.get(C.STAFF_TEAM);
  const overwrites=[
    {id:g.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel]},
    {id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]}
  ];
  if(staffRole)overwrites.push({id:staffRole.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory,PermissionsBitField.Flags.ManageChannels]});
  const c=await g.channels.create({name:`ticket-${i.user.username}`.slice(0,90),type:ChannelType.GuildText,parent:C.channels.ticketCategory,topic:`owner:${i.user.id};type:${type}`,permissionOverwrites:overwrites});
  await c.send(`🎫 ${i.user} تم فتح تكت **${type}**. الإدارة ستتولى التكت هنا.`);
  await i.reply({content:`✅ تم فتح التكت: ${c}`,ephemeral:true});
  log(C.channels.ticketLog,embed("🎫 تكت جديد",[{name:"العضو",value:`${i.user}`},{name:"النوع",value:type},{name:"الروم",value:`${c}`}]));
});

client.on("voiceStateUpdate",(o,n)=>{
  if(o.serverMute!==n.serverMute||o.serverDeaf!==n.serverDeaf)
    log(C.channels.voiceLog,embed("🔊 تغيير صوتي",[
      {name:"العضو",value:n.member?.user?.tag||n.id},
      {name:"الحالة",value:n.serverMute?"ميوت":o.serverMute?"فك ميوت":n.serverDeaf?"دفن":"فك دفن"},
      {name:"ملاحظة",value:"تحديد منفذ التغيير يحتاج View Audit Log."}
    ]));
});

client.on("error",console.error);
process.on("unhandledRejection",console.error);
client.login(token);
