const http = require('http');
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PORT = process.env.PORT || 10000;
http.createServer((req,res)=>{res.writeHead(200);res.end('RipBot is online');}).listen(PORT,'0.0.0.0');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error('Missing DISCORD_TOKEN');

const C = require('./config');

const WARN_FILE = path.join(__dirname,'warnings.json');
if(!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE,'{}');
const loadWarnings=()=>{try{return JSON.parse(fs.readFileSync(WARN_FILE,'utf8'));}catch{return {};}};
const saveWarnings=d=>fs.writeFileSync(WARN_FILE,JSON.stringify(d,null,2));

const client = new Client({intents:[
  GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildModeration
],partials:[Partials.Channel,Partials.Message,Partials.GuildMember]});

const ch=id=>client.channels.cache.get(id);
const isStaff=m=>!!m&&(m.permissions.has(PermissionsBitField.Flags.Administrator)||m.roles.cache.has(C.staffRole));
const isAdmin=m=>!!m&&m.permissions.has(PermissionsBitField.Flags.Administrator);
const isRip=m=>isAdmin(m)||!!m?.roles?.cache?.has(C.staffRip);
const target=m=>m.mentions.members.first();
const cleanId=x=>String(x||'').replace(/[<@!>]/g,'').trim();
const getMember=(g,x)=>g.members.cache.get(cleanId(x))||g.members.cache.find(m=>m.user.username.toLowerCase()===String(x||'').toLowerCase())||null;
const reply=(m,t)=>m.reply({content:t,allowedMentions:{parse:[]}}).catch(()=>{});
const reason=(m,start=2)=>m.content.trim().split(/\s+/).slice(start).join(' ')||'بدون سبب';
const dur=s=>{const x=String(s||'').match(/^(\d+)(s|m|h|d|w)$/i);if(!x)return null;const mult={s:1e3,m:6e4,h:36e5,d:864e5,w:6048e5};const ms=+x[1]*mult[x[2].toLowerCase()];return ms>0&&ms<=24192e5?ms:null;};
const E=(title,desc,color=0x5865F2)=>new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setTimestamp();
const log=(id,e)=>{const c=ch(id);if(c?.isTextBased())c.send({embeds:[e]}).catch(()=>{});};
const logFields=(id,title,fields,color)=>log(id,new EmbedBuilder().setTitle(title).addFields(fields).setColor(color||0x5865F2).setTimestamp());

function escapeXml(value){
  return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

async function makeWelcomeImage(member){
  const template=path.join(__dirname,'welcome.png');
  if(!fs.existsSync(template)) return null;
  const response=await fetch(member.user.displayAvatarURL({extension:'png',size:512}));
  if(!response.ok) throw new Error(`avatar fetch failed: ${response.status}`);
  const avatarBuffer=await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(270,270,{fit:'cover'})
    .composite([{input:Buffer.from('<svg width="270" height="270" xmlns="http://www.w3.org/2000/svg"><circle cx="135" cy="135" r="135" fill="white"/></svg>'),blend:'dest-in'}])
    .png().toBuffer();
  const name=escapeXml(member.displayName||member.user.username);
  const nameSvg=Buffer.from(`<svg width="1040" height="410" xmlns="http://www.w3.org/2000/svg"><text x="748" y="307" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="38" font-weight="700">${name}</text></svg>`);
  return sharp(template).composite([{input:avatarBuffer,left:100,top:115},{input:nameSvg,left:0,top:0}]).png().toBuffer();
}


function roomOwner(room){return room?.topic?.match(/roomOwner:(\d+)/)?.[1]||null;}
function isPrivateRoom(room){return !!room&&room.type===ChannelType.GuildVoice&&room.name.startsWith('روم・');}
function roomControl(member){const room=member?.voice?.channel;if(!isPrivateRoom(room))return null;const owner=roomOwner(room);if(isAdmin(member)||member.roles.cache.has(C.staffRole)||owner===member.id)return room;return null;}
function roomPanel(){
  const row=(a)=>new ActionRowBuilder().addComponents(a.map(([id,label,emoji])=>new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary)));
  return [
    row([['room_lock','قفل الروم','🔒'],['room_unlock','فتح الروم','🔓'],['room_hide','إخفاء الروم','🙈'],['room_show','إظهار الروم','👁️']]),
    row([['room_limit','حد الروم','⏱️'],['room_rename','تغيير الاسم','🎤'],['room_transfer','نقل الملكية','🫱🏻‍🫲🏻']]),
    row([['room_allow','السماح','👤'],['room_deny','منع','🚫'],['room_kick','طرد عضو','🕺']]),
    row([['room_banned','عرض المحظورين','🔨'],['room_mute','سيرفر ميوت','🎙️'],['room_unmute','فك سيرفر ميوت','🎙️']]),
    row([['room_deaf','سيرفر دفن','🎧'],['room_undeaf','فك سيرفر دفن','🔊']])
  ];
}
function roomEmbed(){return E('تحكم برومك !',
'🕺 **طرد عضو** — طرد عضو من الروم.\n🛡️ **إعطاء صلاحية** — السماح لعضو بدخول الروم.\n🚫 **عرض المحظورين** — عرض الأعضاء الممنوعين.\n📢 **سيرفر ميوت** — كتم عضو صوتيًا.\n🎧 **سيرفر دفن** — كتم + منع سماع عضو.\n\n⚠️ جميع الأزرار تعمل لصاحب الروم أو الإدارة، ويجب أن تكون داخل رومك الخاص.',0x2B2D31).setFooter({text:'RIP • التحكم بالروم'});}
function modal(id,title,label,placeholder){return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)));}

const ticketTypes=[
  ['استفسار','❓'],['دعم فني','🛠️'],['شكوى على شخص','🚨'],['شراء من المتجر','🛒'],['طلب رول','🎭'],['شكوى على إداري','⚠️']
];
function ticketNumber(g){let n=0;for(const c of g.channels.cache.values()){const x=c.name?.match(/^ticket-(\d+)$/);if(x)n=Math.max(n,+x[1]);}return n+1;}
function ticketPanel(){
  const rows=[];for(let i=0;i<ticketTypes.length;i+=3){const r=new ActionRowBuilder();for(const [label,emoji] of ticketTypes.slice(i,i+3))r.addComponents(new ButtonBuilder().setCustomId('ticket_open:'+i).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary));rows.push(r);}return rows;
}
function ticketControls(){return [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلام التكت').setEmoji('🙋').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('ticket_add').setLabel('إضافة شخص').setEmoji('➕').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('ticket_remove').setLabel('حذف شخص').setEmoji('➖').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('ticket_close').setLabel('قفل التكت').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('ticket_delete').setLabel('حذف التكت').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('ticket_transfer').setLabel('نقل التكت').setEmoji('📤').setStyle(ButtonStyle.Secondary)
)];}
async function sendTicketPanel(channel){
  const e=E('🎫 نظام التذاكر','اختر نوع التكت المناسب لك من الأزرار بالأسفل.\n\n• استفسار\n• دعم فني\n• شكوى على شخص\n• شراء من المتجر\n• طلب رول\n• شكوى على إداري\n\n**ملاحظة:** الحد الأقصى 3 تكتات مفتوحة للشخص.');
  return channel.send({embeds:[e],components:ticketPanel()});
}
async function rating(channel,owner){const row=new ActionRowBuilder().addComponents([1,2,3,4,5].map(n=>new ButtonBuilder().setCustomId(`rate:${n}:${owner}`).setLabel(`${n}`).setStyle(n>=4?ButtonStyle.Success:n>=3?ButtonStyle.Secondary:ButtonStyle.Danger)));return channel.send({embeds:[E('⭐ تقييم التكت','كيف كان تعاملك مع الإدارة؟ اختر تقييمك من 1 إلى 5.')],components:[row]});}

async function fetchAllBans(guild){
  const out=new Map();let after;for(let i=0;i<20;i++){
    const batch=await guild.bans.fetch({limit:1000,after});if(!batch.size)break;
    for(const [id,b] of batch)out.set(id,b);if(batch.size<1000)break;after=[...batch.keys()][batch.size-1];
  }return out;
}

async function doAvatarBanner(channel,user){
  const u=await client.users.fetch(user.id,{force:true}).catch(()=>user);const av=u.displayAvatarURL({extension:'png',size:1024});const banner=u.bannerURL?.({extension:'png',size:2048});
  const e=E(`🖼️ ${u.username}`,`**الآفتار:** ${av}\n**البنر:** ${banner||'ما عنده بنر.'}`);e.setThumbnail(av);if(banner)e.setImage(banner);return channel.send({embeds:[e]});
}

client.once('ready',async()=>{
  const g=client.guilds.cache.get(C.guild);console.log(`✅ ${client.user.tag} online | PORT ${PORT}`);
  if(!g)return console.error('Guild not found');
  const commands=[
    {name:'help',description:'عرض أوامر RipBot'},
    {name:'setup',description:'فحص إعدادات RipBot'},
    {name:'ping',description:'فحص الاستجابة'},
    {name:'all',description:'إدارة الباندات',options:[{name:'ban',description:'عرض عدد المتبندين',type:1},{name:'open',description:'فك باند الكل - Administrator',type:1}]},
    {name:'avatar',description:'عرض افتار عضو',options:[{name:'user',description:'العضو',type:6,required:true}]},
    {name:'banner',description:'عرض بنر عضو',options:[{name:'user',description:'العضو',type:6,required:true}]},
    {name:'userinfo',description:'معلومات عضو',options:[{name:'user',description:'العضو',type:6,required:true}]},
    {name:'serverinfo',description:'معلومات السيرفر'},
    {name:'clear',description:'مسح رسائل من 10 إلى 150',options:[{name:'amount',description:'العدد',type:4,required:true,min_value:10,max_value:150}]},
    {name:'warn',description:'تحذير عضو',options:[{name:'user',description:'العضو',type:6,required:true},{name:'reason',description:'السبب',type:3}]},
    {name:'warnings',description:'عرض تحذيرات عضو',options:[{name:'user',description:'العضو',type:6,required:true}]},
    {name:'ticket',description:'نشر لوحة التكت'},
    {name:'room-panel',description:'إرسال لوحة تحكم الروم'},
    {name:'id',description:'عرض آيدي روم أو رول أو عضو',options:[
      {name:'room',description:'عرض آيدي الروم',type:1,options:[{name:'channel',description:'اختر الروم',type:7,required:true}]},
      {name:'role',description:'عرض آيدي الرول',type:1,options:[{name:'role',description:'اختر الرول',type:8,required:true}]},
      {name:'member',description:'عرض آيدي العضو',type:1,options:[{name:'user',description:'اختر العضو',type:6,required:true}]}
    ]}
  ];
  await g.commands.set(commands).catch(console.error);
  try{const vc=g.channels.cache.get(C.voice24);if(vc?.type===ChannelType.GuildVoice)joinVoiceChannel({channelId:vc.id,guildId:g.id,adapterCreator:g.voiceAdapterCreator,selfMute:true,selfDeaf:true});}catch(e){console.error('24/7 voice',e);}
});

client.on('guildMemberAdd',async m=>{
  // إعطاء الرولات تلقائيًا لأي عضو جديد.
  // لازم البوت يملك Manage Roles وأن تكون هذه الرولات تحت رتبة البوت.
  const roleResults=[];
  for(const roleId of (C.autoRoles||[])){
    const role=m.guild.roles.cache.get(roleId);
    if(!role){roleResults.push(`❌ ${roleId} غير موجود`);continue;}
    if(!role.editable){roleResults.push(`❌ ${role.name}: رتبة البوت أعلى/لا يمكن إدارتها`);continue;}
    try{await m.roles.add(role, 'RipBot: auto role on member join');roleResults.push(`✅ ${role.name}`);}
    catch(e){console.error(`Auto role failed for ${m.user.tag} / ${roleId}:`,e);roleResults.push(`❌ ${role.name}: فشل الإضافة`);}
  }
  if(roleResults.length)console.log(`🎭 Auto roles for ${m.user.tag}: ${roleResults.join(' | ')}`);

  const c=ch(C.welcome);if(!c?.isTextBased())return;
  const text=`اهلا نورت سيرفرنا خش ووسع صدرك\n\n🎟️ تحتاج تفتح تكت؟ <#${C.tickets}>\n👤 عندك مشكلة ضد شخص من الأعضاء؟ <#${C.tickets}>\n👀 عندك مشكلة ضد إداري؟ <#${C.tickets}>\n🧐 ودك تستفسر عن شي؟ <#${C.tickets}>\n🛒 ودك تشتري من المتجر؟ <#${C.tickets}>\n🗳️ عندك اقتراح؟ <#${C.suggestions}>\n🎬 عندك مشاكل بالسيرفر؟ <#${C.problems}>`;
  try{
    const image=await makeWelcomeImage(m);
    if(image){
      const attachment=new AttachmentBuilder(image,{name:'welcome-member.png'});
      await c.send({content:`ياهلا والله فيك ${m} 🤍\n${text}`,files:[attachment]});
    }else await c.send({content:`ياهلا والله فيك ${m} 🤍\n${text}`});
  }catch(err){
    console.error('Welcome image failed:',err);
    await c.send({content:`ياهلا والله فيك ${m} 🤍\n${text}`}).catch(()=>{});
  }
});

client.on('interactionCreate',async i=>{
  try{
    if(!i.guild)return;
    if(i.isChatInputCommand()){
      if(i.commandName==='id'){
        const sub=i.options.getSubcommand();
        if(sub==='room'){
          const room=i.options.getChannel('channel');
          return i.reply(`🆔 آيدي الروم **${room.name}**:
\`${room.id}\``);
        }
        if(sub==='role'){
          const role=i.options.getRole('role');
          return i.reply(`🆔 آيدي الرول **${role.name}**:
\`${role.id}\``);
        }
        if(sub==='member'){
          const user=i.options.getUser('user');
          return i.reply(`🆔 آيدي العضو **${user.tag}**:
\`${user.id}\``);
        }
      }
      if(i.commandName==='ping')return i.reply(`🏓 Pong! ${client.ws.ping}ms`);
      if(i.commandName==='help')return i.reply({content:'🤖 **RipBot**\n\n🛡️ كسرة • فك_كسرة • بنعالي • ابلع • فك_تايم • ميوت • فك_ميوت • دفن • فك_دفن • تحذير • تحذيرات • شيل_تحذير • مسح_تحذيرات • قفل • فتح • مسح\n🎫 تكت-نشر • استلام • اضافة • ازالة • قفل-تكت • فتح-تكت • حذف-تكت • نقل-تكت • اسم-تكت\n🔊 روم-تحكم • روم-اسم • روم-طرد • روم-اضافة • روم-حذف • روم-نقل • روم-قفل • روم-فتح\n🖼️ افتار • بنر • افتار-بنر • معلومات • معلومات-سيرفر\n🧹 مسح 10-150 • all ban • open ban all\n🎮 العاب\n⚡ -تكت • -اقتراحات • -مشاكل',ephemeral:true});
      if(i.commandName==='setup'){
        if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});
        const ids=[['تصنيف التكت',C.ticketCategory],['لوق فتح التكت',C.ticketOpenLog],['لوق إغلاق التكت',C.ticketClosedLog],['لوق التحذيرات',C.warningsLog],['لوق الحماية',C.securityLog],['لوق الباند/الطرد/التايم',C.moderationLog],['لوق السب والقذف',C.swearingLog],['لوق الميوت والدفن',C.voiceLog],['لوق الرومات الخاصة',C.privateLog],['روم 24/7',C.voice24],['روم إنشاء الخاص',C.privateCreate]];
        return i.reply({embeds:[E('⚙️ RipBot Setup',ids.map(([n,id])=>({name:n,value:`<#${id}> — \`${id}\``})).reduce((a,x)=>a.concat(x),[]))],ephemeral:true});
      }
      if(i.commandName==='all'){
        if(!isAdmin(i.member))return i.reply({content:'❌ يحتاج Administrator.',ephemeral:true});
        if(i.options.getSubcommand()==='ban'){const b=await fetchAllBans(i.guild);return i.reply(`🔨 عدد المتبندين حاليًا: **${b.size}**`);}
        if(i.options.getSubcommand()==='open'){
          const b=await fetchAllBans(i.guild);let ok=0,fail=0;for(const id of b.keys()){try{await i.guild.bans.remove(id,'open ban all');ok++;}catch{fail++;}}logFields(C.moderationLog,'🔓 فك باند الكل',[{name:'بواسطة',value:`${i.user}`},{name:'تم الفك',value:String(ok)},{name:'فشل',value:String(fail)}],0x57F287);return i.reply(`✅ تم فك باند **${ok}**${fail?`\n⚠️ فشل في **${fail}** بسبب صلاحيات/ترتيب الرتب.`:''}`);}
      }
      if(['warn','warnings'].includes(i.commandName)){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const u=i.options.getMember('user'),d=loadWarnings();d[i.guildId]??={};d[i.guildId][u.id]??=[];if(i.commandName==='warn'){const r=i.options.getString('reason')||'بدون سبب';d[i.guildId][u.id].push({reason:r,by:i.user.id,at:new Date().toISOString()});saveWarnings(d);logFields(C.warningsLog,'⚠️ تحذير',[{name:'العضو',value:`${u}`},{name:'بواسطة',value:`${i.user}`},{name:'السبب',value:r},{name:'الإجمالي',value:String(d[i.guildId][u.id].length)}],0xFEE75C);return i.reply(`⚠️ تم تحذير ${u}.`);}return i.reply(`⚠️ ${u} لديه **${d[i.guildId][u.id].length}** تحذير.`);}
      if(i.commandName==='clear'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const n=i.options.getInteger('amount');const msgs=await i.channel.messages.fetch({limit:Math.min(n+1,100)});const del=[...msgs.values()].filter(x=>!x.pinned).slice(0,n);await i.channel.bulkDelete(del,true);logFields(C.securityLog,'🧹 مسح رسائل',[{name:'بواسطة',value:`${i.user}`},{name:'العدد',value:String(del.length)}]);return i.reply({content:`🧹 تم مسح **${del.length}** رسالة.`,ephemeral:true});}
      if(i.commandName==='avatar'||i.commandName==='banner'||i.commandName==='userinfo'){const u=await client.users.fetch(i.options.getUser('user').id,{force:true});if(i.commandName==='avatar')return i.reply({embeds:[E(`🖼️ آفتار ${u.username}`,`[فتح الصورة](${u.displayAvatarURL({extension:'png',size:1024})})`).setImage(u.displayAvatarURL({extension:'png',size:1024}))]});if(i.commandName==='banner'){const b=u.bannerURL({extension:'png',size:2048});return i.reply({embeds:[E(`🖼️ بنر ${u.username}`,b?`[فتح البنر](${b})`:'هذا العضو ما عنده بنر.').setImage(b || undefined)]});}const m=await i.guild.members.fetch(u.id);return i.reply({embeds:[E(`👤 معلومات ${u.username}`,`الاسم: ${u}\nID: \`${u.id}\`\nتاريخ إنشاء الحساب: <t:${Math.floor(u.createdTimestamp/1000)}:F>\nدخل السيرفر: <t:${Math.floor((m.joinedTimestamp||Date.now())/1000)}:F>`)]});}
      if(i.commandName==='serverinfo')return i.reply({embeds:[E(`🏠 ${i.guild.name}`,`ID: \`${i.guild.id}\`\nالأعضاء: **${i.guild.memberCount}**\nالرومات: **${i.guild.channels.cache.size}**\nالرولات: **${i.guild.roles.cache.size}**`)]});
      if(i.commandName==='ticket'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});await sendTicketPanel(i.channel);return i.reply({content:'✅ تم نشر لوحة التكت.',ephemeral:true});}
      if(i.commandName==='room-panel'){const room=roomControl(i.member);if(!room)return i.reply({content:'❌ ادخل رومك الخاص أولًا.',ephemeral:true});await i.channel.send({embeds:[roomEmbed()],components:roomPanel()});return i.reply({content:'✅ تم إرسال لوحة التحكم.',ephemeral:true});}
    }

    if(i.isModalSubmit()&&i.customId.startsWith('room_')){
      const room=roomControl(i.member);if(!room)return i.reply({content:'❌ لازم تكون داخل رومك الخاص.',ephemeral:true});const v=i.fields.getTextInputValue('value').trim();
      if(i.customId==='room_limit_modal'){const n=Number(v);if(!Number.isInteger(n)||n<0||n>99)return i.reply({content:'❌ من 0 إلى 99.',ephemeral:true});await room.setUserLimit(n);return i.reply({content:'✅ تم تعديل حد الروم.',ephemeral:true});}
      if(i.customId==='room_rename_modal'){await room.setName(v.slice(0,100));logFields(C.privateLog,'🎤 تغيير اسم روم خاص',[{name:'الروم',value:room.name},{name:'بواسطة',value:`${i.user}`},{name:'الاسم الجديد',value:v}]);return i.reply({content:'✅ تم تغيير الاسم.',ephemeral:true});}
      const m=getMember(i.guild,v);if(!m)return i.reply({content:'❌ ما لقيت العضو. استخدم ID أو منشن.',ephemeral:true});
      if(i.customId==='room_transfer_modal'){await room.permissionOverwrites.edit(roomOwner(room),{ManageChannels:null}).catch(()=>{});await room.permissionOverwrites.edit(m.id,{ViewChannel:true,Connect:true,Speak:true,Stream:true,ManageChannels:true});await room.setTopic(`roomOwner:${m.id}`);return i.reply({content:`✅ تم نقل الملكية إلى ${m}.`,ephemeral:true});}
      if(i.customId==='room_allow_modal'){await room.permissionOverwrites.edit(m.id,{ViewChannel:true,Connect:true,Speak:true});return i.reply({content:`✅ تم السماح لـ ${m}.`,ephemeral:true});}
      if(i.customId==='room_deny_modal'){await room.permissionOverwrites.edit(m.id,{ViewChannel:false,Connect:false});if(m.voice?.channelId===room.id)await m.voice.disconnect().catch(()=>{});return i.reply({content:`🚫 تم منع ${m}.`,ephemeral:true});}
      if(i.customId==='room_kick_modal'){if(m.voice?.channelId===room.id)await m.voice.disconnect().catch(()=>{});return i.reply({content:`🕺 تم طرد ${m}.`,ephemeral:true});}
      if(['room_mute_modal','room_unmute_modal','room_deaf_modal','room_undeaf_modal'].includes(i.customId)){if(m.voice?.channelId!==room.id)return i.reply({content:'❌ العضو ليس داخل رومك.',ephemeral:true});if(i.customId==='room_mute_modal')await m.voice.setMute(true);if(i.customId==='room_unmute_modal')await m.voice.setMute(false);if(i.customId==='room_deaf_modal')await m.voice.setDeaf(true);if(i.customId==='room_undeaf_modal')await m.voice.setDeaf(false);logFields(C.voiceLog,'🔊 تحكم صوتي بالروم',[{name:'العضو',value:`${m}`},{name:'بواسطة',value:`${i.user}`},{name:'الحالة',value:i.customId}]);return i.reply({content:'✅ تم.',ephemeral:true});}
    }

    if(i.isButton()&&i.customId.startsWith('room_')){
      const room=roomControl(i.member);if(!room)return i.reply({content:'❌ لازم تكون داخل رومك الخاص.',ephemeral:true});
      if(i.customId==='room_lock'){await room.permissionOverwrites.edit(i.guild.roles.everyone,{Connect:false});return i.reply({content:'🔒 تم قفل الروم.',ephemeral:true});}
      if(i.customId==='room_unlock'){await room.permissionOverwrites.edit(i.guild.roles.everyone,{Connect:null});return i.reply({content:'🔓 تم فتح الروم.',ephemeral:true});}
      if(i.customId==='room_hide'){await room.permissionOverwrites.edit(i.guild.roles.everyone,{ViewChannel:false,Connect:false});return i.reply({content:'🙈 تم إخفاء الروم.',ephemeral:true});}
      if(i.customId==='room_show'){await room.permissionOverwrites.edit(i.guild.roles.everyone,{ViewChannel:null});return i.reply({content:'👁️ تم إظهار الروم.',ephemeral:true});}
      if(i.customId==='room_banned'){const ids=room.permissionOverwrites.cache.filter(x=>x.type===1&&x.deny.has(PermissionsBitField.Flags.Connect)).map(x=>`<@${x.id}>`);return i.reply({content:ids.length?`🚫 المحظورون:\n${ids.join('\n')}`:'✅ لا يوجد.',ephemeral:true});}
      const map={room_limit:['room_limit_modal','حد الروم','العدد','0-99'],room_rename:['room_rename_modal','تغيير الاسم','الاسم الجديد','روم・RIP'],room_transfer:['room_transfer_modal','نقل الملكية','منشن أو ID','@user'],room_allow:['room_allow_modal','السماح','منشن أو ID','@user'],room_deny:['room_deny_modal','منع','منشن أو ID','@user'],room_kick:['room_kick_modal','طرد','منشن أو ID','@user'],room_mute:['room_mute_modal','سيرفر ميوت','منشن أو ID','@user'],room_unmute:['room_unmute_modal','فك ميوت','منشن أو ID','@user'],room_deaf:['room_deaf_modal','سيرفر دفن','منشن أو ID','@user'],room_undeaf:['room_undeaf_modal','فك دفن','منشن أو ID','@user']};
      if(map[i.customId])return i.showModal(modal(...map[i.customId]));
    }

    if(i.isButton()&&i.customId.startsWith('ticket_open:')){
      const idx=Number(i.customId.split(':')[1]),type=ticketTypes[idx]?.[0];if(type==null)return i.reply({content:'❌ نوع غير معروف.',ephemeral:true});
      const open=i.guild.channels.cache.filter(c=>c.type===ChannelType.GuildText&&c.parentId===C.ticketCategory&&c.topic?.includes(`owner:${i.user.id}`));if(open.size>=3)return i.reply({content:'❌ عندك 3 تكتات مفتوحة.',ephemeral:true});
      const n=ticketNumber(i.guild);const overwrites=[{id:i.guild.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel]},{id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]}];const sr=i.guild.roles.cache.get(C.staffRole);if(sr)overwrites.push({id:sr.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory,PermissionsBitField.Flags.ManageChannels]});
      const tc=await i.guild.channels.create({name:`ticket-${n}`,type:ChannelType.GuildText,parent:C.ticketCategory,topic:`owner:${i.user.id};type:${type}`,permissionOverwrites:overwrites});await tc.send({content:`${i.user} ${sr?`<@&${sr.id}>`:''}`,embeds:[E(`🎫 ${type}`,'أهلًا بك، اكتب طلبك بالتفصيل وسيتم خدمتك من الإدارة.')],components:ticketControls()});logFields(C.ticketOpenLog,'🎫 فتح تكت',[{name:'التكت',value:tc.name},{name:'العضو',value:`${i.user}`},{name:'النوع',value:type},{name:'المستلم',value:'لم يتم الاستلام بعد'},{name:'الروم',value:`${tc}`}]);return i.reply({content:`✅ تم فتح ${tc}`,ephemeral:true});
    }
    if(i.isButton()&&i.customId==='ticket_claim'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const claimed=i.channel.topic?.match(/claimed:(\d+)/)?.[1];if(claimed){if(claimed===i.user.id)return i.reply({content:'❌ أنت مستلم التكت بالفعل، ما تقدر تستلمه مرة ثانية.',ephemeral:true});return i.reply({content:`❌ التكت مستلم بالفعل من <@${claimed}>. استخدم **نقل التكت** إذا تبي تنقله لإداري آخر.`,ephemeral:true});}await i.channel.setTopic((i.channel.topic||'')+`;claimed:${i.user.id}`);logFields(C.ticketOpenLog,'🙋 استلام تكت',[{name:'التكت',value:i.channel.name},{name:'المستلم',value:`${i.user}`},{name:'العضو',value:`<@${i.channel.topic?.match(/owner:(\d+)/)?.[1]||'0'}>`}]);return i.reply(`🙋 تم استلام التكت بواسطة ${i.user}.`);}
    if(i.isButton()&&['ticket_add','ticket_remove'].includes(i.customId)){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});return i.showModal(modal(i.customId==='ticket_add'?'ticket_add_modal':'ticket_remove_modal',i.customId==='ticket_add'?'إضافة عضو':'إزالة عضو','منشن أو ID','@user'));}
    if(i.isModalSubmit()&&['ticket_add_modal','ticket_remove_modal'].includes(i.customId)){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const m=getMember(i.guild,i.fields.getTextInputValue('value'));if(!m)return i.reply({content:'❌ العضو غير موجود.',ephemeral:true});const allow=i.customId==='ticket_add_modal';await i.channel.permissionOverwrites.edit(m.id,allow?{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}:{ViewChannel:null,SendMessages:null,ReadMessageHistory:null});return i.reply({content:allow?`➕ تمت إضافة ${m}.`:`➖ تمت إزالة ${m}.`,ephemeral:true});}
    if(i.isButton()&&i.customId==='ticket_close'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const ticketName=i.channel.name;const claimed=i.channel.topic?.match(/claimed:(\d+)/)?.[1];await rating(i.channel,i.channel.topic?.match(/owner:(\d+)/)?.[1]||i.user.id);await i.reply('🔒 تم قفل التكت، انتظر التقييم.');await i.channel.setName(`${ticketName}-closed`.slice(0,100)).catch(()=>{});await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{ViewChannel:false}).catch(()=>{});logFields(C.ticketClosedLog,'🔒 قفل تكت',[{name:'التكت',value:ticketName},{name:'الذي قفل التكت',value:`${i.user}`},{name:'المستلم',value:claimed?`<@${claimed}>`:'لم يتم الاستلام'}]);return;}
    if(i.isButton()&&i.customId==='ticket_delete'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const ticketName=i.channel.name;const claimed=i.channel.topic?.match(/claimed:(\d+)/)?.[1];logFields(C.ticketClosedLog,'🗑️ حذف تكت',[{name:'التكت',value:ticketName},{name:'الذي حذف التكت',value:`${i.user}`},{name:'المستلم',value:claimed?`<@${claimed}>`:'لم يتم الاستلام'}]);await i.reply('🗑️ سيتم حذف التكت.');return setTimeout(()=>i.channel.delete('Ticket deleted').catch(()=>{}),1200);}
    if(i.isButton()&&i.customId==='ticket_transfer'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});return i.showModal(modal('ticket_transfer_modal','نقل التكت','منشن أو ID الإداري','@admin'));}
    if(i.isModalSubmit()&&i.customId==='ticket_transfer_modal'){if(!isStaff(i.member))return i.reply({content:'❌ للإدارة فقط.',ephemeral:true});const targetMember=getMember(i.guild,i.fields.getTextInputValue('value'));if(!targetMember)return i.reply({content:'❌ ما لقيت العضو. استخدم ID أو منشن.',ephemeral:true});if(!isStaff(targetMember))return i.reply({content:'❌ تقدر تنقل التكت لإداري فقط.',ephemeral:true});const oldClaim=i.channel.topic?.match(/claimed:(\d+)/)?.[1];const base=(i.channel.topic||'').replace(/;claimed:\d+/,'');await i.channel.setTopic(`${base};transferred:${targetMember.id}`);await i.channel.permissionOverwrites.edit(targetMember.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true});if(oldClaim)await i.channel.permissionOverwrites.edit(oldClaim,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true}).catch(()=>{});logFields(C.ticketOpenLog,'📤 نقل تكت',[{name:'التكت',value:i.channel.name},{name:'من',value:`${i.user}`},{name:'إلى',value:`${targetMember}`},{name:'الحالة',value:'بانتظار استلام الإداري الجديد'}]);await i.channel.send(`📤 تم نقل التكت إلى ${targetMember}. يقدر يستلمه الآن من زر **استلام التكت**.`);return i.reply({content:`✅ تم نقل التكت إلى ${targetMember}، وتم إتاحة الاستلام له.`,ephemeral:true});}
    if(i.isButton()&&i.customId.startsWith('rate:')){const [,n,owner]=i.customId.split(':');logFields(C.adminRatings,'⭐ تقييم تكت',[{name:'التقييم',value:`${n}/5`},{name:'العضو',value:`<@${owner}>`},{name:'بواسطة',value:`${i.user}`}],0xFEE75C);await i.reply({content:`✅ تم تسجيل تقييمك ${n}/5`,ephemeral:true});setTimeout(()=>i.channel.delete('Ticket rated').catch(()=>{}),2500);return;}
  }catch(e){console.error('interaction',e);if(!i.replied&&!i.deferred)i.reply({content:'❌ حدث خطأ.',ephemeral:true}).catch(()=>{});}
});

const recent=new Map();
const badWords=['كس','كسم','قحبة','قذف','يلعن','زب','منيك','نيك'];
client.on('messageCreate',async m=>{
  if(m.author.bot||!m.guild)return;
  const s=m.content.trim(),p=s.split(/\s+/),cmd=p[0];
  if(['-تكت','-اقتراحات','-مشاكل'].includes(cmd))return reply(m,cmd==='-تكت'?`<#${C.tickets}>`:cmd==='-اقتراحات'?`<#${C.suggestions}>`:`<#${C.problems}>`);
  if(cmd==='!ping')return reply(m,`🏓 Pong! ${client.ws.ping}ms`);
  const now=Date.now();const arr=(recent.get(m.author.id)||[]).filter(x=>now-x<5000);arr.push(now);recent.set(m.author.id,arr);if(arr.length>=7){await m.delete().catch(()=>{});logFields(C.securityLog,'🛡️ سبام',[{name:'العضو',value:`${m.author}`},{name:'الرسائل',value:String(arr.length)}],0xED4245);return;}
  if(badWords.some(w=>s.includes(w))){await m.delete().catch(()=>{});logFields(C.swearingLog,'🚫 سب/قذف',[{name:'العضو',value:`${m.author}`},{name:'القناة',value:`${m.channel}`},{name:'النص',value:s.slice(0,1000)}],0xED4245);return;}
  if(s==='اوامر'||s==='help')return reply(m,'اكتب `/help` أو استخدم أوامر RipBot العربية.');
  if(s==='العاب')return reply(m,'🎮 الألعاب: نرد، عملة، روليت، 8ball، حظ، اختيار، صراحة، جرأة، صح_خطأ، هذا_أو_ذاك.');
  if(['نرد','عملة','روليت','8ball','حظ'].includes(cmd)){const out=cmd==='نرد'?`🎲 ${1+Math.floor(Math.random()*6)}`:cmd==='عملة'?(Math.random()<.5?'🪙 وجه':'🪙 كتابة'):cmd==='حظ'?`🍀 حظك ${Math.floor(Math.random()*101)}%`:`🎮 النتيجة: ${['نعم','لا','ممكن','غالبًا'][Math.floor(Math.random()*4)]}`;return reply(m,out);}
  if(!isStaff(m.member))return;
  const t=target(m);
  if(cmd==='كسرة'){if(!t||!t.bannable)return reply(m,'❌ منشن عضو أقدر أبنده.');const r=reason(m);await t.ban({reason:r});logFields(C.moderationLog,'🔨 باند',[{name:'العضو',value:`${t.user.tag} (${t.id})`},{name:'بواسطة',value:`${m.author}`},{name:'السبب',value:r}],0xED4245);return reply(m,'✅ تم الباند.');}
  if(cmd==='فك_كسرة'){if(!isRip(m.member))return reply(m,'❌ لـ Staff Rip.');const id=cleanId(p[1]);if(!id)return reply(m,'❌ حط ID.');await m.guild.bans.remove(id,'فك كسرة');logFields(C.moderationLog,'🔓 فك باند',[{name:'ID',value:id},{name:'بواسطة',value:`${m.author}`}],0x57F287);return reply(m,'✅ تم فك الباند.');}
  if(cmd==='بنعالي'){if(!t||!t.kickable)return reply(m,'❌ ما أقدر أطرده.');const r=reason(m);await t.kick(r);logFields(C.moderationLog,'👢 طرد',[{name:'العضو',value:`${t.user.tag}`},{name:'بواسطة',value:`${m.author}`},{name:'السبب',value:r}],0xED4245);return reply(m,'✅ تم الطرد.');}
  if(cmd==='ابلع'){const ms=dur(p[2]);if(!t||!ms)return reply(m,'❌ اكتب: `ابلع @عضو 10m السبب`');const r=p.slice(3).join(' ')||'بدون سبب';await t.timeout(ms,r);logFields(C.moderationLog,'⏱️ تايم',[{name:'العضو',value:t.user.tag},{name:'المدة',value:p[2]},{name:'بواسطة',value:`${m.author}`},{name:'السبب',value:r}],0xFEE75C);return reply(m,'✅ تم التايم.');}
  if(cmd==='فك_تايم'){if(!t)return reply(m,'❌ منشن العضو.');await t.timeout(null,'فك تايم');return reply(m,'✅ تم فك التايم.');}
  if(cmd==='ميوت'||cmd==='فك_ميوت'){if(!t)return reply(m,'❌ منشن العضو.');const role=m.guild.roles.cache.get(C.muteRole);if(!role)return reply(m,'❌ حط MUTE_ROLE_ID في Render Environment Variables.');if(cmd==='ميوت')await t.roles.add(role,reason(m));else await t.roles.remove(role,'فك الميوت');logFields(C.voiceLog,cmd==='ميوت'?'🔇 ميوت':'🔊 فك ميوت',[{name:'العضو',value:t.user.tag},{name:'بواسطة',value:`${m.author}`}]);return reply(m,cmd==='ميوت'?'✅ تم الميوت.':'✅ تم فك الميوت.');}
  if(cmd==='دفن'||cmd==='فك_دفن'){if(!t?.voice)return reply(m,'❌ العضو مو بالصوت.');await t.voice.setDeaf(cmd==='دفن');logFields(C.voiceLog,cmd==='دفن'?'🎧 دفن':'🔊 فك دفن',[{name:'العضو',value:t.user.tag},{name:'بواسطة',value:`${m.author}`}]);return reply(m,cmd==='دفن'?'✅ تم الدفن.':'✅ تم فك الدفن.');}
  if(cmd==='تحذير'){if(!t)return reply(m,'❌ منشن العضو.');const d=loadWarnings();d[m.guild.id]??={};d[m.guild.id][t.id]??=[];const r=reason(m);d[m.guild.id][t.id].push({reason:r,by:m.author.id,at:new Date().toISOString()});saveWarnings(d);logFields(C.warningsLog,'⚠️ تحذير',[{name:'العضو',value:`${t}`},{name:'بواسطة',value:`${m.author}`},{name:'السبب',value:r},{name:'الإجمالي',value:String(d[m.guild.id][t.id].length)}],0xFEE75C);return reply(m,`⚠️ تم تحذير ${t}.`);}
  if(cmd==='تحذيرات'){if(!t)return reply(m,'❌ منشن العضو.');const a=loadWarnings()[m.guild.id]?.[t.id]||[];return reply(m,`⚠️ ${t} لديه **${a.length}** تحذير.\n${a.map((x,n)=>`${n+1}. ${x.reason}`).join('\n')||'لا توجد تحذيرات.'}`);}
  if(cmd==='شيل_تحذير'){if(!t)return reply(m,'❌ منشن العضو.');const d=loadWarnings(),a=d[m.guild.id]?.[t.id]||[];if(!a.length)return reply(m,'❌ ما عنده تحذيرات.');a.pop();saveWarnings(d);return reply(m,'✅ تم شيل آخر تحذير.');}
  if(cmd==='مسح_تحذيرات'){if(!t)return reply(m,'❌ منشن العضو.');const d=loadWarnings();d[m.guild.id]??={};d[m.guild.id][t.id]=[];saveWarnings(d);return reply(m,'✅ تم مسح التحذيرات.');}
  if(cmd==='مسح'){const n=Number(p[1]);if(!Number.isInteger(n)||n<10||n>150)return reply(m,'❌ اكتب رقم من 10 إلى 150.');let left=n,total=0;while(left>0){const batch=Math.min(left,100);const msgs=await m.channel.messages.fetch({limit:batch});const dels=[...msgs.values()].filter(x=>!x.pinned).slice(0,batch);if(!dels.length)break;await m.channel.bulkDelete(dels,true);total+=dels.length;left-=dels.length;if(dels.length<batch)break;}logFields(C.securityLog,'🧹 مسح رسائل',[{name:'بواسطة',value:`${m.author}`},{name:'العدد',value:String(total)}]);return reply(m,`🧹 تم مسح ${total}.`);}
  if(cmd==='قفل'||cmd==='فتح'){const lock=cmd==='قفل';await m.channel.permissionOverwrites.edit(m.guild.roles.everyone,{SendMessages:lock?false:null});return reply(m,lock?'🔒 تم قفل الروم.':'🔓 تم فتح الروم.');}
  const ticketHere=()=>m.channel.type===ChannelType.GuildText&&m.channel.name.startsWith('ticket-')&&!!m.channel.topic?.includes('owner:');
  if(cmd==='استلام'){if(!ticketHere())return reply(m,'❌ هذا الأمر داخل التكت فقط.');if(!isStaff(m.member))return reply(m,'❌ للإدارة فقط.');if(m.channel.topic.includes('claimed:'))return reply(m,'❌ التكت مستلم مسبقًا.');await m.channel.setTopic(m.channel.topic+';claimed:'+m.author.id);return reply(m,'🙋 تم استلام التكت.');}
  if(cmd==='اضافة'||cmd==='ازالة'){if(!ticketHere())return reply(m,'❌ داخل التكت فقط.');if(!isStaff(m.member))return reply(m,'❌ للإدارة فقط.');const mem=t||getMember(m.guild,p[1]);if(!mem)return reply(m,'❌ منشن العضو.');const allow=cmd==='اضافة';await m.channel.permissionOverwrites.edit(mem.id,allow?{ViewChannel:true,SendMessages:true,ReadMessageHistory:true}:{ViewChannel:null,SendMessages:null,ReadMessageHistory:null});return reply(m,allow?`➕ تمت إضافة ${mem}.`:`➖ تمت إزالة ${mem}.`);}
  if(cmd==='قفل-تكت'||cmd==='فتح-تكت'){if(!ticketHere())return reply(m,'❌ داخل التكت فقط.');if(!isStaff(m.member))return reply(m,'❌ للإدارة فقط.');const lock=cmd==='قفل-تكت';await m.channel.permissionOverwrites.edit(m.guild.roles.everyone,{ViewChannel:lock?false:null});return reply(m,lock?'🔒 تم قفل التكت.':'🔓 تم فتح التكت.');}
  if(cmd==='حذف-تكت'){if(!ticketHere())return reply(m,'❌ داخل التكت فقط.');if(!isStaff(m.member))return reply(m,'❌ للإدارة فقط.');logFields(C.ticketClosedLog,'🗑️ حذف تكت',[{name:'الروم',value:m.channel.name},{name:'بواسطة',value:`${m.author}`}]);await reply(m,'🗑️ سيتم حذف التكت.');return setTimeout(()=>m.channel.delete('Ticket deleted').catch(()=>{}),1000);}
  if(cmd==='نقل-تكت'){if(!ticketHere())return reply(m,'❌ داخل التكت فقط.');if(!isStaff(m.member))return reply(m,'❌ للإدارة فقط.');const mem=getMember(m.guild,p[1])||t;if(!mem)return reply(m,'❌ منشن أو ID الإداري.');if(!isStaff(mem))return reply(m,'❌ تقدر تنقل التكت لإداري فقط.');const base=(m.channel.topic||'').replace(/;claimed:\d+/,'');await m.channel.setTopic(`${base};transferred:${mem.id}`);await m.channel.permissionOverwrites.edit(mem.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true});logFields(C.ticketOpenLog,'📤 نقل تكت',[{name:'التكت',value:m.channel.name},{name:'من',value:`${m.author}`},{name:'إلى',value:`${mem}`},{name:'الحالة',value:'بانتظار الاستلام'}]);await m.channel.send(`📤 تم نقل التكت إلى ${mem}. يقدر يستلمه الآن.`);return reply(m,`✅ تم نقل التكت إلى ${mem}.`);}
  if(cmd==='اسم-تكت'){if(!ticketHere())return reply(m,'❌ داخل التكت فقط.');if(!isStaff(m.member))return reply(m,'❌ للإدارة فقط.');const name=p.slice(1).join(' ').trim();if(!name)return reply(m,'❌ اكتب الاسم الجديد.');await m.channel.setName(name.slice(0,100));return reply(m,'🎤 تم تغيير اسم التكت.');}
  if(cmd==='تكت-نشر'){if(m.channel.id!==C.tickets)return reply(m,`❌ استخدمه في <#${C.tickets}>.`);await sendTicketPanel(m.channel);return reply(m,'✅ تم نشر لوحة التكت.');}
  if(cmd==='روم-تحكم'){const room=roomControl(m.member);if(!room)return reply(m,'❌ ادخل رومك الخاص.');await m.channel.send({embeds:[roomEmbed()],components:roomPanel()});return reply(m,'✅ تم إرسال لوحة التحكم.');}
  if(cmd==='روم-اسم'){const room=roomControl(m.member);if(!room)return reply(m,'❌ ادخل رومك الخاص.');const name=p.slice(1).join(' ');if(!name)return reply(m,'❌ اكتب الاسم.');await room.setName(name.slice(0,100));return reply(m,'✅ تم تغيير الاسم.');}
  if(cmd==='روم-قفل'||cmd==='روم-فتح'){const room=roomControl(m.member);if(!room)return reply(m,'❌ ادخل رومك الخاص.');await room.permissionOverwrites.edit(m.guild.roles.everyone,{Connect:cmd==='روم-قفل'?false:null});return reply(m,cmd==='روم-قفل'?'🔒 تم قفل الروم.':'🔓 تم فتح الروم.');}
  if(cmd==='روم-طرد'||cmd==='روم-اضافة'||cmd==='روم-حذف'||cmd==='روم-نقل'){const room=roomControl(m.member);const mem=getMember(m.guild,p[1])||t;if(!room||!mem)return reply(m,'❌ ادخل رومك الخاص وحدد العضو.');if(cmd==='روم-طرد'&&mem.voice?.channelId===room.id)await mem.voice.disconnect();if(cmd==='روم-اضافة')await room.permissionOverwrites.edit(mem.id,{ViewChannel:true,Connect:true,Speak:true});if(cmd==='روم-حذف')await room.permissionOverwrites.edit(mem.id,{ViewChannel:null,Connect:null,Speak:null});if(cmd==='روم-نقل'){await room.permissionOverwrites.edit(roomOwner(room),{ManageChannels:null}).catch(()=>{});await room.permissionOverwrites.edit(mem.id,{ViewChannel:true,Connect:true,Speak:true,ManageChannels:true});await room.setTopic(`roomOwner:${mem.id}`);}return reply(m,'✅ تم.');}
  if(cmd==='افتار'||cmd==='بنر'||cmd==='افتار-بنر'){const u=t?.user||m.mentions.users.first()||m.author;return doAvatarBanner(m.channel,u);}
  if(cmd==='معلومات'){const u=t||m.member;return reply(m,`👤 ${u.user.tag}\nID: ${u.id}\nالرول: ${u.roles.highest}`);}
  if(cmd==='معلومات-سيرفر'){return reply(m,`🏠 ${m.guild.name}\n👥 ${m.guild.memberCount} عضو\n📁 ${m.guild.channels.cache.size} روم\n🎭 ${m.guild.roles.cache.size} رول`);}
  if(cmd==='all'&&p[1]==='ban'){const b=await fetchAllBans(m.guild);return reply(m,`🔨 عدد المتبندين: **${b.size}**`);}
  if(cmd==='open'&&p[1]==='ban'&&p[2]==='all'){if(!isAdmin(m.member))return reply(m,'❌ Administrator فقط.');const b=await fetchAllBans(m.guild);let ok=0;for(const id of b.keys()){try{await m.guild.bans.remove(id,'open ban all');ok++;}catch{}}logFields(C.moderationLog,'🔓 فك باند الكل',[{name:'بواسطة',value:`${m.author}`},{name:'العدد',value:String(ok)}],0x57F287);return reply(m,`✅ تم فك باند ${ok} عضو.`);}
  if(cmd==='بروفايل'||cmd==='profile'){const u=t?.user||m.author;return doAvatarBanner(m.channel,u);}
  if(cmd==='عدد'){return reply(m,`👥 عدد أعضاء السيرفر: **${m.guild.memberCount}**`);}
  if(cmd==='رابط'){return m.guild.invites.fetch().then(xs=>reply(m,xs.first()?`🔗 ${xs.first().url}`:'❌ ما فيه رابط متاح.')).catch(()=>reply(m,'❌ ما أقدر أجيب رابط الدعوة.'));}
  if(cmd==='بطاقة'){return reply(m,`🪪 ${m.author} — ID: ${m.author.id}`);}
  if(cmd==='slowmode'){const n=Math.max(0,Math.min(21600,Number(p[1])));if(!Number.isInteger(n))return reply(m,'❌ اكتب ثواني.');await m.channel.setRateLimitPerUser(n);return reply(m,`🐌 تم ضبط السلو مود على ${n} ثانية.`);}
  if(cmd==='نسخ-الروم'){const copy=await m.guild.channels.create({name:`${m.channel.name}-نسخة`,type:m.channel.type,parent:m.channel.parentId,topic:m.channel.topic});return reply(m,`✅ تم إنشاء ${copy}.`);}
  if(cmd==='اعطاء-رول'||cmd==='شيل-رول'){const mem=t,role=m.mentions.roles.first();if(!mem||!role)return reply(m,'❌ منشن عضو ثم رول.');if(role.position>=m.member.roles.highest.position&&!isAdmin(m.member))return reply(m,'❌ الرول أعلى منك.');if(cmd==='اعطاء-رول')await mem.roles.add(role);else await mem.roles.remove(role);return reply(m,'✅ تم.');}
  if(cmd==='لقب'){if(!t)return reply(m,'❌ منشن العضو.');const nick=p.slice(2).join(' ');await t.setNickname(nick||null);return reply(m,'✅ تم تعديل اللقب.');}
  if(cmd==='فك_باند_الكل'){if(!isAdmin(m.member))return reply(m,'❌ Administrator فقط.');const b=await fetchAllBans(m.guild);let ok=0;for(const id of b.keys()){try{await m.guild.bans.remove(id,'فك باند الكل');ok++;}catch{}}return reply(m,`✅ تم فك باند ${ok}.`);}
});

client.on('voiceStateUpdate',async(o,n)=>{
  try{
    if(n.channelId===C.privateCreate&&o.channelId!==C.privateCreate){
      const g=n.guild,m=n.member,room=await g.channels.create({name:`روم・${m.user.username}`.slice(0,100),type:ChannelType.GuildVoice,parent:n.channel.parentId||null,topic:`roomOwner:${m.id}`,permissionOverwrites:[{id:g.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.Connect]},{id:m.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.Connect,PermissionsBitField.Flags.Speak,PermissionsBitField.Flags.Stream,PermissionsBitField.Flags.ManageChannels]}]});await m.voice.setChannel(room);logFields(C.privateLog,'🔊 إنشاء روم خاص',[{name:'العضو',value:`${m}`},{name:'الروم',value:`${room}`}]);
    }
    const old=o.channel;if(old&&isPrivateRoom(old)&&old.id!==C.privateCreate&&old.members.size===0){logFields(C.privateLog,'🗑️ حذف روم خاص',[{name:'الروم',value:old.name},{name:'السبب',value:'صار فارغًا'}]);await old.delete().catch(()=>{});}
    if(o.channelId!==n.channelId&&n.channelId)logFields(C.privateLog,'🔊 دخول/انتقال صوتي',[{name:'العضو',value:`${n.member||n.id}`},{name:'إلى',value:`${n.channel}`}]);
  }catch(e){console.error('voice',e);}
});

client.on('messageDelete',m=>{if(!m.guild||!m.author||m.author.bot)return;if(badWords.some(w=>(m.content||'').includes(w)))logFields(C.swearingLog,'🚫 رسالة سب/قذف محذوفة',[{name:'العضو',value:`${m.author}`},{name:'القناة',value:`${m.channel}`},{name:'النص',value:(m.content||'').slice(0,1000)}],0xED4245);});
client.on('guildBanAdd',b=>logFields(C.moderationLog,'🔨 باند',[{name:'العضو',value:`${b.user.tag} (${b.user.id})`}],0xED4245));
client.on('guildMemberRemove',m=>logFields(C.moderationLog,'👢 خروج/طرد',[{name:'العضو',value:`${m.user.tag} (${m.id})`}],0xED4245));
client.on('error',console.error);process.on('unhandledRejection',console.error);
client.login(TOKEN);
