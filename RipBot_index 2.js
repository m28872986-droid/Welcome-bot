const {Client,GatewayIntentBits,Partials,PermissionsBitField,EmbedBuilder,
ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,AttachmentBuilder,
ModalBuilder,TextInputBuilder,TextInputStyle,UserSelectMenuBuilder} = require("discord.js");
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

const privateTrigger=()=>C.channels?.privateCreateVoice||C.privateCreateVoice||C.channels?.voice24_7;
const privateSettings=()=>C.channels?.privateSettings||C.privateSettings;
const isPrivateRoom=(channel)=>!!channel?.topic?.includes("rip-private-owner:");
const privateOwner=(channel)=>channel?.topic?.match(/rip-private-owner:(\d+)/)?.[1]||null;
const isTicket=(channel)=>channel?.name?.match(/^ticket-(\d+)$/i);
const nextTicketNumber=(guild)=>{
  let max=0;
  for(const c of guild.channels.cache.values()){
    const m=c.name?.match(/^ticket-(\d+)$/i);
    if(m)max=Math.max(max,Number(m[1]));
  }
  return max+1;
};
const ticketStaff=(member)=>staff(member);
const ticketOwner=(channel)=>channel?.topic?.match(/owner:(\d+)/)?.[1]||null;
const ticketType=(channel)=>channel?.topic?.match(/type:([^;]+)/)?.[1]||"تكت";
const ticketPanel=()=>{
  const row1=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:claim").setLabel("استلام التكت").setEmoji("🎫").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket:add").setLabel("إضافة عضو").setEmoji("👥").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket:remove").setLabel("إزالة عضو").setEmoji("👤").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket:close").setLabel("قفل التكت").setEmoji("🔒").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket:delete").setLabel("حذف التكت").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
  );
  const row2=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:rename").setLabel("تغيير الاسم").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ticket:reopen").setLabel("فتح التكت").setEmoji("🔓").setStyle(ButtonStyle.Success)
  );
  return [row1,row2];
};

const privatePanelRows=()=>[
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("private:lock").setLabel("قفل الروم").setEmoji("🔒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:unlock").setLabel("فتح الروم").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:hide").setLabel("إخفاء الروم").setEmoji("🙈").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:show").setLabel("إظهار الروم").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:limit").setLabel("حد الروم").setEmoji("⏱️").setStyle(ButtonStyle.Secondary)
  ),
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("private:rename").setLabel("تغيير الاسم").setEmoji("📝").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:transfer").setLabel("نقل الملكية").setEmoji("🤝").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:allow").setLabel("السماح").setEmoji("👤").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:deny").setLabel("منع").setEmoji("🚫").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:kick").setLabel("طرد عضو").setEmoji("🏃").setStyle(ButtonStyle.Danger)
  ),
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("private:banned").setLabel("عرض المحظورين").setEmoji("🔨").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:mute").setLabel("سيرفر ميوت").setEmoji("🔇").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:unmute").setLabel("فك سيرفر ميوت").setEmoji("🎙️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:deaf").setLabel("سيرفر دفن").setEmoji("🎧").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("private:undeaf").setLabel("فك سيرفر دفن").setEmoji("🔊").setStyle(ButtonStyle.Secondary)
  )
];

const privatePanelEmbed=()=>new EmbedBuilder()
  .setTitle("🎛️ تحكم برومك الخاص")
  .setDescription("ادخل الروم الخاص بك ثم استخدم الأزرار بالأسفل.\n\n⚠️ الأزرار تعمل فقط لمالك الروم أو الإدارة.\n\n🔒 القفل والمنع يمنعان الدخول.\n📝 تغيير الاسم يغيّر اسم الروم مباشرة.\n👤 السماح/المنع/الطرد تحتاج اختيار عضو.\n🤝 نقل الملكية يعطي العضو الجديد صلاحية التحكم.")
  .setColor(0x5865F2);

const findPrivateForUser=(guild,userId)=>guild.channels.cache.find(c=>c.type===ChannelType.GuildVoice&&isPrivateRoom(c)&&privateOwner(c)===userId);
const privateOwnerCheck=(i,room)=>{
  const owner=privateOwner(room);
  return owner===i.user.id || i.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
};
const privateUserPicker=(action)=>new ActionRowBuilder().addComponents(
  new UserSelectMenuBuilder().setCustomId(`private_select:${action}`).setPlaceholder("اختر العضو").setMinValues(1).setMaxValues(1)
);

async function ensurePrivatePanel(){
  const id=privateSettings();
  const c=ch(id);
  if(!c?.isTextBased())return;
  const recent=await c.messages.fetch({limit:50}).catch(()=>null);
  const exists=recent?.some(x=>x.author.id===client.user.id&&x.embeds?.[0]?.title==="🎛️ تحكم برومك الخاص");
  if(!exists)await c.send({embeds:[privatePanelEmbed()],components:privatePanelRows()}).catch(console.error);
}

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
  await ensurePrivatePanel();
});

client.on("guildMemberAdd",async m=>{
  const c=ch(C.channels.welcome); if(!c?.isTextBased())return;
  const welcomePath=path.join(__dirname,"welcome.png");
  const payload={
    content:
`ياهلا والله فيك يا ${m} 🤍
نورت سيرفرنا، نتمنى لك وقت ممتع معنا 🫶🏻

🎟️ تحتاج تفتح تكت؟ <#${C.channels.tickets}>
👤 عندك مشكلة ضد شخص؟ <#${C.channels.tickets}>
👀 عندك مشكلة ضد إداري؟ <#${C.channels.tickets}>
🧐 ودك تستفسر عن شيء؟ <#${C.channels.tickets}>
🛒 ودك تشتري من المتجر؟ <#${C.channels.tickets}>
🗳️ عندك اقتراح؟ <#${C.channels.suggestions}>
🎬 عندك مشاكل بالسيرفر؟ <#${C.channels.problems}>`,
    allowedMentions:{users:[m.id]},
  };
  if(fs.existsSync(welcomePath)){
    payload.files=[new AttachmentBuilder(welcomePath,{name:"welcome.png"})];
  }else{
    console.warn("welcome.png غير موجود؛ أضفه بجانب index.js لإظهار صورة الترحيب.");
  }
  await c.send(payload).catch(console.error);
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
      ["استفسار","دعم فني","شكوى على شخص","شراء من المتجر","طلب رول"].map((x,i)=>new ButtonBuilder().setCustomId(`ticket:${i}`).setLabel(x).setEmoji(["❓","🛠️","⚠️","🛒","🎟️"][i]).setStyle(ButtonStyle.Secondary))
    );
    const r2=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket:5").setLabel("شكوى على إداري").setEmoji("👮").setStyle(ButtonStyle.Secondary));
    await m.channel.send({embeds:[new EmbedBuilder().setTitle("🎫 التذاكر").setDescription("اختر نوع التكت المناسب.\n\nبعد فتح التكت ستظهر لك أيقونات الإدارة مثل **🎫 استلام التكت** و **🔒 قفل التكت** و **🗑️ حذف التكت**.\n\nاحترم الإدارة، اشرح طلبك بوضوح، ولا تفتح أكثر من تكت لنفس الموضوع.").setColor(0x2B2D31)],components:[r1,r2]});
    return reply(m,"✅ تم نشر لوحة التكت.");
  }
  if(cmd==="فك_باند_الكل"){
    if(!m.member.permissions.has(PermissionsBitField.Flags.Administrator))return reply(m,"❌ يحتاج Administrator.");
    const b=await m.guild.bans.fetch();for(const [id] of b){try{await m.guild.bans.remove(id,"فك_باند_الكل")}catch{}}
    log(C.channels.moderationLog,embed("🔓 فك باند الكل",[{name:"بواسطة",value:`${m.author}`},{name:"العدد",value:String(b.size)}],0x57F287));
    return reply(m,`✅ تم فك باند **${b.size}**.`);
  }
  // Ticket management commands
  if(["استلام","اضافة","ازالة","قفل-تكت","فتح-تكت","حذف-تكت","نقل-تكت","اسم-تكت"].includes(cmd)){
    if(!isTicket(m.channel))return reply(m,"❌ استخدم الأمر داخل التكت.");
    if(cmd==="استلام"){
      await m.channel.permissionOverwrites.edit(m.author.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
      return reply(m,"🎫 تم استلام التكت.");
    }
    if(cmd==="قفل-تكت"||cmd==="فتح-تكت"){
      const ownerId=ticketOwner(m.channel);const closed=cmd==="قفل-تكت";
      if(ownerId)await m.channel.permissionOverwrites.edit(ownerId,{ViewChannel:true,SendMessages:!closed,ReadMessageHistory:true});
      await m.channel.setTopic((m.channel.topic||"").replace(/status:(open|closed)/,`status:${closed?"closed":"open"}`));
      return reply(m,closed?"🔒 تم قفل التكت.":"🔓 تم فتح التكت.");
    }
    if(cmd==="حذف-تكت"){
      await reply(m,"🗑️ سيتم حذف التكت.");
      return setTimeout(()=>m.channel.delete("حذف التكت").catch(()=>{}),500);
    }
    if(cmd==="اسم-تكت"){
      const name=s.split(/\s+/).slice(1).join("-").trim();
      if(!name)return reply(m,"❌ اكتب الاسم بعد الأمر.");
      return m.channel.setName(`ticket-${name.slice(0,80)}`).then(()=>reply(m,"✅ تم تغيير اسم التكت."));
    }
    const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");
    if(cmd==="اضافة"){
      await m.channel.permissionOverwrites.edit(t.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
      return reply(m,`👥 تمت إضافة ${t}.`);
    }
    if(cmd==="ازالة"){
      if(t.id===ticketOwner(m.channel))return reply(m,"❌ ما أقدر أشيل صاحب التكت.");
      await m.channel.permissionOverwrites.delete(t.id).catch(()=>{});
      return reply(m,`👤 تمت إزالة ${t}.`);
    }
    if(cmd==="نقل-تكت"){
      const category=m.guild.channels.cache.get(s.split(/\s+/)[1]);
      if(!category||category.type!==ChannelType.GuildCategory)return reply(m,"❌ حط ID تصنيف صحيح.");
      await m.channel.setParent(category.id,{lockPermissions:false});
      return reply(m,`📦 تم نقل التكت إلى التصنيف ${category}.`);
    }
  }

  // Private rooms: join the configured trigger voice channel to create your own room.
  if(cmd==="روم-تحكم"||cmd.startsWith("روم-")){
    if(!isPrivateRoom(m.channel))return reply(m,"❌ استخدم الأمر داخل الروم الخاص بك.");
    const ownerId=privateOwner(m.channel);
    if(ownerId!==m.author.id&&!m.member.permissions.has(PermissionsBitField.Flags.Administrator))return reply(m,"❌ هذا الروم ليس لك.");
    const p=s.split(/\s+/);
    if(cmd==="روم-تحكم")return reply(m,"🎛️ أوامر الروم: `روم-اسم` `روم-طرد` `روم-اضافة` `روم-حذف` `روم-نقل` `روم-قفل` `روم-فتح`.");
    if(cmd==="روم-اسم"){
      const name=p.slice(1).join("-");if(!name)return reply(m,"❌ اكتب الاسم.");await m.channel.setName(name.slice(0,90));return reply(m,"✅ تم تغيير اسم الروم.");
    }
    if(cmd==="روم-طرد"){
      const t=target(m);if(!t?.voice||t.voice.channelId!==m.channel.id)return reply(m,"❌ منشن عضو داخل الروم.");await t.voice.disconnect("طرد من الروم الخاص");return reply(m,"👢 تم طرد العضو.");
    }
    if(cmd==="روم-اضافة"){
      const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");await m.channel.permissionOverwrites.edit(t.id,{Connect:true,ViewChannel:true});return reply(m,"👥 تم إضافة العضو للروم.");
    }
    if(cmd==="روم-حذف"){
      const t=target(m);if(!t)return reply(m,"❌ منشن العضو.");await m.channel.permissionOverwrites.delete(t.id).catch(()=>{});return reply(m,"👤 تم حذف العضو من صلاحيات الروم.");
    }
    if(cmd==="روم-نقل"){
      const id=p[1],cat=m.guild.channels.cache.get(id);if(!cat||cat.type!==ChannelType.GuildCategory)return reply(m,"❌ حط ID تصنيف صحيح.");await m.channel.setParent(cat.id,{lockPermissions:false});return reply(m,"📦 تم نقل الروم.");
    }
    if(cmd==="روم-قفل"||cmd==="روم-فتح"){
      const lock=cmd==="روم-قفل";await m.channel.permissionOverwrites.edit(m.guild.roles.everyone,{Connect:!lock});return reply(m,lock?"🔒 تم قفل الروم.":"🔓 تم فتح الروم.");
    }
  }
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
        "• الأزرار: ❓ استفسار، 🛠️ دعم فني، ⚠️ شكوى على شخص، 🛒 شراء من المتجر، 🎟️ طلب رول، 👮 شكوى على إداري.",
        "• الحد الأقصى 3 تكتات مفتوحة للعضو.",
        "• داخل التكت تظهر أزرار: 🎫 استلام التكت، 👥 إضافة عضو، 👤 إزالة عضو، 🔒 قفل، 🔓 فتح، ✏️ تغيير الاسم، 🗑️ حذف.",
        "• الأوامر: `استلام` `اضافة` `ازالة` `قفل-تكت` `فتح-تكت` `حذف-تكت` `نقل-تكت` `اسم-تكت`.",
        "• اسم التكت الجديد يكون تلقائيًا `ticket-1` ثم `ticket-2` ثم `ticket-3`...",
        "",
        "🔊 **الروم الخاص**",
        "• عند دخول العضو للروم المحدد في `privateCreateVoice` يتم إنشاء روم خاص له تلقائيًا ونقله إليه.",
        "• `روم-تحكم` `روم-اسم` `روم-طرد` `روم-اضافة` `روم-حذف` `روم-نقل` `روم-قفل` `روم-فتح` تعمل داخل الروم الخاص.",
        "• الروم الخاص يحذف تلقائيًا عندما يفرغ من الأعضاء.",
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

  if(!i.isButton())return;
  const g=i.guild;if(!g)return;

  if(i.customId.startsWith("private:")){
    const action=i.customId.split(":")[1];
    const room=findPrivateForUser(g,i.user.id);
    if(!room)return i.reply({content:"❌ لازم تكون داخل رومك الخاص أولاً.",ephemeral:true});
    if(!privateOwnerCheck(i,room))return i.reply({content:"❌ هذا الروم ليس رومك الخاص.",ephemeral:true});
    if(action==="lock"||action==="unlock"){
      const locked=action==="lock";
      await room.permissionOverwrites.edit(g.roles.everyone,{Connect:!locked});
      return i.reply({content:locked?"🔒 تم قفل الروم.":"🔓 تم فتح الروم.",ephemeral:true});
    }
    if(action==="hide"||action==="show"){
      const hidden=action==="hide";
      await room.permissionOverwrites.edit(g.roles.everyone,{ViewChannel:!hidden});
      return i.reply({content:hidden?"🙈 تم إخفاء الروم.":"👁️ تم إظهار الروم.",ephemeral:true});
    }
    if(action==="limit"){
      const modal=new ModalBuilder().setCustomId("private_modal:limit").setTitle("حد الروم");
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("value").setLabel("عدد الأعضاء 0 - 99").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(room.userLimit||0))));
      return i.showModal(modal);
    }
    if(action==="rename"){
      const modal=new ModalBuilder().setCustomId("private_modal:rename").setTitle("تغيير اسم الروم");
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("value").setLabel("اسم الروم الجديد").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90).setValue(room.name)));
      return i.showModal(modal);
    }
    if(["transfer","allow","deny","kick","mute","unmute","deaf","undeaf"].includes(action))
      return i.reply({content:`اختر العضو لتنفيذ: **${i.customId.split(":")[1]}**`,components:[privateUserPicker(action)],ephemeral:true});
    if(action==="banned"){
      const denied=room.permissionOverwrites.cache.filter(x=>x.type===0&&!x.allow.has(PermissionsBitField.Flags.Connect)&&x.deny.has(PermissionsBitField.Flags.Connect)&&x.id!==g.roles.everyone.id);
      const names=[];for(const [id] of denied){const m=await g.members.fetch(id).catch(()=>null);if(m)names.push(`• ${m}`);}
      return i.reply({content:names.length?`🔨 **الممنوعون من الروم:**\n${names.join("\n")}`:"🔨 لا يوجد أعضاء ممنوعون.",ephemeral:true});
    }
  }

  if(i.isModalSubmit() && i.customId.startsWith("private_modal:")){
    const room=findPrivateForUser(g,i.user.id);
    if(!room)return i.reply({content:"❌ لازم تكون داخل رومك الخاص.",ephemeral:true});
    if(!privateOwnerCheck(i,room))return i.reply({content:"❌ هذا الروم ليس رومك.",ephemeral:true});
    const action=i.customId.split(":")[1],value=i.fields.getTextInputValue("value").trim();
    if(action==="rename"){
      await room.setName(value);
      return i.reply({content:`📝 تم تغيير اسم الروم إلى **${value}**.`,ephemeral:true});
    }
    const n=Number(value);
    if(!Number.isInteger(n)||n<0||n>99)return i.reply({content:"❌ اكتب رقمًا من 0 إلى 99.",ephemeral:true});
    await room.setUserLimit(n);
    return i.reply({content:`⏱️ تم تحديد حد الروم على **${n===0?"غير محدود":n}**.`,ephemeral:true});
  }

  if(i.isUserSelectMenu() && i.customId.startsWith("private_select:")){
    const action=i.customId.split(":")[1];
    const room=findPrivateForUser(g,i.user.id);
    if(!room)return i.update({content:"❌ لازم تكون داخل رومك الخاص.",components:[],embeds:[]});
    if(!privateOwnerCheck(i,room))return i.update({content:"❌ هذا الروم ليس رومك.",components:[],embeds:[]});
    const member=await g.members.fetch(i.values[0]).catch(()=>null);
    if(!member)return i.update({content:"❌ العضو غير موجود.",components:[],embeds:[]});
    if(action==="allow"){
      await room.permissionOverwrites.edit(member.id,{ViewChannel:true,Connect:true});
      return i.update({content:`👤 تم السماح لـ ${member}.`,components:[],embeds:[]});
    }
    if(action==="deny"){
      await room.permissionOverwrites.edit(member.id,{ViewChannel:false,Connect:false});
      if(member.voice.channelId===room.id)await member.voice.disconnect("منع من الروم الخاص").catch(()=>{});
      return i.update({content:`🚫 تم منع ${member} من الروم.`,components:[],embeds:[]});
    }
    if(action==="kick"){
      if(member.voice.channelId===room.id)await member.voice.disconnect("طرد من الروم الخاص");
      return i.update({content:`🏃 تم طرد ${member} من الروم.`,components:[],embeds:[]});
    }
    if(action==="mute"||action==="unmute"){
      if(member.voice.channelId!==room.id)return i.update({content:"❌ العضو لازم يكون داخل رومك.",components:[],embeds:[]});
      await member.voice.setMute(action==="mute","تحكم الروم الخاص");
      return i.update({content:action==="mute"?`🔇 تم سيرفر ميوت لـ ${member}.`:`🎙️ تم فك سيرفر ميوت لـ ${member}.`,components:[],embeds:[]});
    }
    if(action==="deaf"||action==="undeaf"){
      if(member.voice.channelId!==room.id)return i.update({content:"❌ العضو لازم يكون داخل رومك.",components:[],embeds:[]});
      await member.voice.setDeaf(action==="deaf","تحكم الروم الخاص");
      return i.update({content:action==="deaf"?`🎧 تم سيرفر دفن لـ ${member}.`:`🔊 تم فك سيرفر دفن لـ ${member}.`,components:[],embeds:[]});
    }
    if(action==="transfer"){
      const oldOwner=privateOwner(room);
      await room.setTopic(`rip-private-owner:${member.id}`);
      await room.permissionOverwrites.edit(member.id,{ViewChannel:true,Connect:true,Speak:true,ManageChannels:true});
      if(oldOwner&&oldOwner!==member.id)await room.permissionOverwrites.edit(oldOwner,{ManageChannels:false}).catch(()=>{});
      return i.update({content:`🤝 تم نقل ملكية الروم إلى ${member}.`,components:[],embeds:[]});
    }
  }

  // Ticket type buttons create a numbered ticket: ticket-1, ticket-2, ...
  if(i.customId.startsWith("ticket:") && /^ticket:\d+$/.test(i.customId)){
    const open=g.channels.cache.filter(c=>c.parentId===C.channels.ticketCategory&&c.topic?.includes(`owner:${i.user.id}`)&&!c.topic?.includes("status:closed"));
    if(open.size>=3)return i.reply({content:"❌ عندك 3 تذاكر مفتوحة بالفعل.",ephemeral:true});
    const types=["استفسار","دعم فني","شكوى على شخص","شراء من المتجر","طلب رول","شكوى على إداري"];
    const type=types[+i.customId.split(":")[1]];
    if(!type)return i.reply({content:"❌ نوع التكت غير صحيح.",ephemeral:true});
    const staffRole=g.roles.cache.get(C.STAFF_TEAM);
    const overwrites=[
      {id:g.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel]},
      {id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]}
    ];
    if(staffRole)overwrites.push({id:staffRole.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory,PermissionsBitField.Flags.ManageChannels]});
    const number=nextTicketNumber(g);
    const c=await g.channels.create({name:`ticket-${number}`,type:ChannelType.GuildText,parent:C.channels.ticketCategory,topic:`owner:${i.user.id};type:${type};number:${number};status:open`,permissionOverwrites:overwrites});
    await c.send({content:`🎫 ${i.user} تم فتح **ticket-${number}** — ${type}.`,embeds:[new EmbedBuilder().setTitle(`🎫 ticket-${number}`).setDescription("لوحة تحكم التكت جاهزة تحت الرسالة.\n\n🎫 **استلام التكت** — استلم التكت باسمك.\n👥 **إضافة عضو** — أضف عضوًا للتكت.\n👤 **إزالة عضو** — أزل عضوًا من التكت.\n🔒 **قفل التكت** — اقفل التكت مؤقتًا.\n🔓 **فتح التكت** — افتح التكت بعد القفل.\n✏️ **تغيير الاسم** — غيّر اسم التكت.\n🗑️ **حذف التكت** — احذف التكت.").setColor(0x5865F2)],components:ticketPanel()});
    await i.reply({content:`✅ تم فتح التكت: ${c}`,ephemeral:true});
    log(C.channels.ticketLog,embed("🎫 تكت جديد",[{name:"العضو",value:`${i.user}`},{name:"النوع",value:type},{name:"الروم",value:`${c}`}]))
    return;
  }

  if(!i.customId.startsWith("ticket:"))return;
  const c=i.channel;
  if(!c?.isTextBased() || !isTicket(c))return i.reply({content:"❌ هذا الزر يعمل داخل التكت فقط.",ephemeral:true});
  const ownerId=ticketOwner(c);
  const action=i.customId.split(":")[1];

  if(!ticketStaff(i.member))return i.reply({content:"❌ هذا الزر للإدارة فقط.",ephemeral:true});

  if(action==="claim"){
    await c.permissionOverwrites.edit(i.user.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
    await c.send(`🎫 تم استلام التكت بواسطة ${i.user}.`);
    return i.reply({content:"✅ استلمت التكت.",ephemeral:true});
  }

  if(action==="close"||action==="reopen"){
    const closed=action==="close";
    if(ownerId)await c.permissionOverwrites.edit(ownerId,{ViewChannel:true,SendMessages:!closed,ReadMessageHistory:true});
    const topic=(c.topic||"").replace(/status:(open|closed)/,`status:${closed?"closed":"open"}`);
    await c.setTopic(topic);
    await c.send(closed?`🔒 تم قفل التكت بواسطة ${i.user}.`:`🔓 تم فتح التكت بواسطة ${i.user}.`);
    return i.reply({content:closed?"🔒 تم قفل التكت.":"🔓 تم فتح التكت.",ephemeral:true});
  }

  if(action==="delete"){
    await i.reply({content:"🗑️ سيتم حذف التكت الآن.",ephemeral:true});
    setTimeout(()=>c.delete("حذف التكت").catch(()=>{}),500);
    return;
  }

  if(action==="rename"){
    const n=isTicket(c)?.[1]||"";
    await c.setName(`ticket-${n}`);
    return i.reply({content:"✏️ اسم التكت بالفعل بصيغة ticket-رقم.",ephemeral:true});
  }

  if(action==="add"||action==="remove"){
    const member=i.options?.getMember?.("member");
    return i.reply({content:action==="add"?"👥 لاختيار العضو استخدم الأمر: `اضافة @عضو` داخل التكت.":"👤 لاختيار العضو استخدم الأمر: `ازالة @عضو` داخل التكت.",ephemeral:true});
  }
});;

client.on("voiceStateUpdate",async(o,n)=>{
  try{
    const trigger=privateTrigger();
    if(n.channelId===trigger && o.channelId!==trigger){
      const g=n.guild;
      const owner=n.member;
      const existing=findPrivateForUser(g,owner.id);
      if(existing){await owner.voice.setChannel(existing).catch(()=>{});return;}
      const parent=n.channel?.parentId||null;
      const room=await g.channels.create({
        name:`روم-${owner.user.username}`.slice(0,90),type:ChannelType.GuildVoice,parent,
        topic:`rip-private-owner:${owner.id}`,
        permissionOverwrites:[
          {id:g.roles.everyone.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.Connect]},
          {id:owner.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.Connect,PermissionsBitField.Flags.Speak,PermissionsBitField.Flags.ManageChannels]}
        ]
      });
      await owner.voice.setChannel(room).catch(()=>{});
      const settings=ch(privateSettings());
      if(settings?.isTextBased())settings.send({content:`🔊 ${owner} تم إنشاء **${room.name}** لك.\nادخل رومك واستخدم لوحة التحكم المثبتة هنا.`,allowedMentions:{users:[owner.id]},embeds:[privatePanelEmbed()],components:privatePanelRows()}).catch(()=>{});
    }
    if(o.channelId!==n.channelId && o.channelId){
      const old=o.channel;
      if(old&&old.type===ChannelType.GuildVoice&&isPrivateRoom(old)&&old.members.size===0)await old.delete("private room empty").catch(()=>{});
    }
  }catch(err){console.error("Private room error:",err)}

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
