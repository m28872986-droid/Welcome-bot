const http = require("http");
const {
  Client, GatewayIntentBits, Partials, ChannelType,
  PermissionsBitField, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  AttachmentBuilder
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
http.createServer((req,res)=>{res.writeHead(200);res.end("RipBot is online");}).listen(PORT,"0.0.0.0");

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1546851578638630922";

const C = {
  welcome:"1548158650823221318",
  tickets:"1548093364602146887",
  suggestions:"1553280719844024352",
  problems:"1547467032910626826",
  swearingLog:"1547902342903636061",
  voice24:"1546859095032729620",
  privateSettings:"1546945538774016115",
  privateCreate:"1546945537696333884",
  adminRatings:"1553298350265073787",
  staffRole:"1549461212348153856",
  ticketCategory:null
};

const DATA = path.join(__dirname,"warnings.json");
function loadWarnings(){try{return JSON.parse(fs.readFileSync(DATA,"utf8"));}catch{return {};}}
function saveWarnings(d){fs.writeFileSync(DATA,JSON.stringify(d,null,2));}

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials:[Partials.Channel]
});

function embed(title,description,color=0x5865F2){
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
}

function isStaff(member){
  return member?.permissions?.has(PermissionsBitField.Flags.ManageGuild) ||
    member?.roles?.cache?.has(C.staffRole);
}

async function replyMsg(message,content){return message.reply({content}).catch(()=>{});}

function ticketNumber(guild){
  let max=0;
  for(const ch of guild.channels.cache.values()){
    const m=/^ticket-(\d+)$/.exec(ch.name);
    if(m) max=Math.max(max,Number(m[1]));
  }
  return max+1;
}

async function sendTicketPanel(channel){
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_create").setLabel("فتح تكت").setEmoji("🎟️").setStyle(ButtonStyle.Primary)
  );
  const e=embed("🎟️ نظام التذاكر","اضغط الزر لفتح تكت والتواصل مع الإدارة.");
  await channel.send({embeds:[e],components:[row]}).catch(()=>{});
}

async function sendRating(channel,ownerId){
  const row=new ActionRowBuilder().addComponents(
    [1,2,3,4,5].map(n=>new ButtonBuilder().setCustomId(`rate_${n}_${ownerId}`).setLabel(String(n)).setStyle(n>=4?ButtonStyle.Success:n>=3?ButtonStyle.Secondary:ButtonStyle.Danger))
  );
  await channel.send({embeds:[embed("⭐ تقييم التكت","كيف كان تعاملك مع الإدارة؟ اختر تقييمك من 1 إلى 5.")],components:[row]}).catch(()=>{});
}

client.once("ready",async()=>{
  console.log(`✅ ${client.user.tag} online | PORT ${PORT}`);
  const guild=client.guilds.cache.get(GUILD_ID);
  if(!guild){console.error("❌ Guild not found");return;}

  await guild.commands.set([
    {name:"help",description:"عرض أوامر RipBot"},
    {name:"setup",description:"فحص إعدادات RipBot"},
    {name:"ping",description:"فحص استجابة البوت"},
    {name:"warn",description:"تحذير عضو",options:[
      {name:"user",description:"العضو",type:6,required:true},
      {name:"reason",description:"السبب",type:3,required:false}
    ]},
    {name:"warnings",description:"عرض تحذيرات عضو",options:[
      {name:"user",description:"العضو",type:6,required:true}
    ]},
    {name:"clearwarnings",description:"إزالة تحذيرات عضو",options:[
      {name:"user",description:"العضو",type:6,required:true}
    ]},
    {name:"ticket",description:"إرسال لوحة التذاكر"}
  ]).catch(console.error);

  // محاولة دخول روم 24/7
  try{
    const vc=guild.channels.cache.get(C.voice24);
    if(vc?.type===ChannelType.GuildVoice){
      joinVoiceChannel({
        channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,
        selfMute:true,selfDeaf:true
      });
      console.log("🔊 Joined 24/7 voice");
    }
  }catch(e){console.error("Voice error:",e);}
});

client.on("interactionCreate",async i=>{
  try{
    if(i.isChatInputCommand()){
      if(i.commandName==="ping") return i.reply(`🏓 Pong! ${client.ws.ping}ms`);
      if(i.commandName==="help") return i.reply({content:
        "🤖 **RipBot Commands**\n\n"+
        "`/ping` `/setup` `/warn` `/warnings` `/clearwarnings` `/ticket`\n"+
        "أوامر الرسائل العربية متاحة أيضًا: `تحذير` `تحذيرات` `ازالة-تحذير` `روم-تحكم` وغيرها.",ephemeral:true});
      if(i.commandName==="setup") return i.reply({content:
        `✅ البوت متصل\n🏠 ${i.guild.name}\n🌐 PORT: ${PORT}\n🎟️ التكت: <#${C.tickets}>\n🔊 الروم الخاص: <#${C.privateCreate}>`,ephemeral:true});

      if(i.commandName==="ticket"){
        if(!isStaff(i.member)) return i.reply({content:"❌ هذا الأمر للإدارة.",ephemeral:true});
        await sendTicketPanel(i.channel);
        return i.reply({content:"✅ تم إرسال لوحة التذاكر.",ephemeral:true});
      }

      if(["warn","warnings","clearwarnings"].includes(i.commandName)){
        if(!isStaff(i.member)) return i.reply({content:"❌ هذا الأمر للإدارة.",ephemeral:true});
        const u=i.options.getUser("user");
        const d=loadWarnings(); d[i.guildId]??={}; d[i.guildId][u.id]??=[];
        if(i.commandName==="warn"){
          const reason=i.options.getString("reason")||"بدون سبب";
          d[i.guildId][u.id].push({reason,by:i.user.id,at:new Date().toISOString()}); saveWarnings(d);
          return i.reply(`⚠️ تم تحذير <@${u.id}>. الإجمالي: **${d[i.guildId][u.id].length}**\nالسبب: ${reason}`);
        }
        if(i.commandName==="warnings"){
          const a=d[i.guildId][u.id];
          return i.reply(`⚠️ <@${u.id}> لديه **${a.length}** تحذير.\n${a.map((x,n)=>`${n+1}. ${x.reason}`).join("\n")||"لا توجد تحذيرات."}`);
        }
        d[i.guildId][u.id]=[]; saveWarnings(d);
        return i.reply(`✅ تمت إزالة جميع تحذيرات <@${u.id}>.`);
      }
    }

    if(i.isButton()){
      if(i.customId==="ticket_create"){
        const guild=i.guild;
        const n=ticketNumber(guild);
        const ch=await guild.channels.create({
          name:`ticket-${n}`,type:ChannelType.GuildText,
          parent:C.ticketCategory||undefined,
          topic:`owner:${i.user.id}`,
          permissionOverwrites:[
            {id:guild.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel]},
            {id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]},
            {id:C.staffRole,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]}
          ]
        });
        const row=new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ticket_claim").setLabel("استلام التكت").setEmoji("🙋").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("ticket_close").setLabel("إغلاق التكت").setEmoji("🔒").setStyle(ButtonStyle.Danger)
        );
        await ch.send({content:`<@${i.user.id}>`,embeds:[embed("🎟️ تكت جديد","أهلًا بك، اكتب طلبك هنا وسيتم خدمتك من الإدارة.")],components:[row]});
        return i.reply({content:`✅ تم فتح التكت: ${ch}`,ephemeral:true});
      }

      if(i.customId==="ticket_claim"){
        if(!isStaff(i.member)) return i.reply({content:"❌ للإدارة فقط.",ephemeral:true});
        return i.reply(`🙋 تم استلام التكت بواسطة ${i.user}.`);
      }

      if(i.customId==="ticket_close"){
        const ch=i.channel;
        const owner=(ch.topic||"").match(/owner:(\d+)/)?.[1];
        await sendRating(ch,owner);
        return i.reply("🔒 سيتم إغلاق التكت بعد التقييم.").catch(()=>{});
      }

      if(i.customId.startsWith("rate_")){
        const n=i.customId.split("_")[1];
        const log=i.guild.channels.cache.get(C.adminRatings);
        if(log?.isTextBased()) await log.send({embeds:[embed("⭐ تقييم تكت",`التقييم: **${n}/5**\nالعضو: ${i.user}`)]});
        return i.reply({content:`✅ شكرًا لك! تم تسجيل تقييمك: ${n}/5`,ephemeral:true});
      }
    }
  }catch(e){
    console.error("Interaction error:",e);
    if(!i.replied&&!i.deferred) i.reply({content:"❌ حدث خطأ.",ephemeral:true}).catch(()=>{});
  }
});

client.on("guildMemberAdd",async member=>{
  const ch=member.guild.channels.cache.get(C.welcome);
  if(!ch?.isTextBased())return;
  await ch.send({
    content:`ياهلا والله فيك <@${member.id}> 🤍\nنورت سيرفرنا، خذ راحتك ووسع صدرك ونتمنى لك وقت ممتع معنا 🫶🏻`,
    files:[path.join(__dirname,"welcome.png")]
  }).catch(console.error);
});

client.on("voiceStateUpdate",async(oldState,newState)=>{
  try{
    if(newState.channelId===C.privateCreate && oldState.channelId!==C.privateCreate){
      const guild=newState.guild,member=newState.member;
      const room=await guild.channels.create({
        name:`روم・${member.user.username}`,type:ChannelType.GuildVoice,
        parent:newState.channel.parentId||undefined,
        permissionOverwrites:[
          {id:guild.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.Connect]},
          {id:member.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.Connect,PermissionsBitField.Flags.Speak,PermissionsBitField.Flags.Stream]}
        ]
      });
      await member.voice.setChannel(room);
    }
    const old=oldState.channel;
    if(old&&old.id!==C.privateCreate&&old.name.startsWith("روم・")&&old.members.size===0)
      await old.delete("Private room empty").catch(()=>{});
  }catch(e){console.error("Voice:",e);}
});

client.on("messageCreate",async m=>{
  if(m.author.bot)return;
  const parts=m.content.trim().split(/\s+/),cmd=parts.shift()?.toLowerCase();

  if(cmd==="!ping")return m.reply(`🏓 Pong! ${client.ws.ping}ms`);
  if(cmd==="!status")return m.reply(`✅ RipBot شغال\n🌐 PORT: ${PORT}`);

  if(!isStaff(m.member)) return;

  const mention=m.mentions.members.first();
  if(cmd==="تحذير"){
    if(!mention)return replyMsg(m,"❌ منشن العضو.");
    const reason=parts.join(" ")||"بدون سبب",d=loadWarnings();
    d[m.guild.id]??={};d[m.guild.id][mention.id]??=[];
    d[m.guild.id][mention.id].push({reason,by:m.author.id,at:new Date().toISOString()});saveWarnings(d);
    return replyMsg(m,`⚠️ تم تحذير ${mention}. الإجمالي: **${d[m.guild.id][mention.id].length}**\nالسبب: ${reason}`);
  }

  if(cmd==="تحذيرات"){
    if(!mention)return replyMsg(m,"❌ منشن العضو.");
    const a=loadWarnings()[m.guild.id]?.[mention.id]||[];
    return replyMsg(m,`⚠️ ${mention} لديه **${a.length}** تحذير.\n${a.map((x,n)=>`${n+1}. ${x.reason}`).join("\n")||"لا توجد تحذيرات."}`);
  }

  if(cmd==="ازالة-تحذير"||cmd==="إزالة-تحذير"){
    if(!mention)return replyMsg(m,"❌ منشن العضو.");
    const d=loadWarnings();d[m.guild.id]??={};d[m.guild.id][mention.id]=[];saveWarnings(d);
    return replyMsg(m,`✅ تمت إزالة تحذيرات ${mention}.`);
  }

  if(cmd==="تكت-لوحة") return sendTicketPanel(m.channel);
  if(cmd==="روم-تحكم") return replyMsg(m,"🎛️ نظام التحكم بالرومات الخاصة مفعل. أوامر الإدارة التفصيلية يمكن إضافتها حسب نظام الروم.");
});

if(!TOKEN){console.error("❌ DISCORD_TOKEN missing");process.exit(1);}
client.login(TOKEN);
