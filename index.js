require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');

if (!process.env.TOKEN) {
  console.error('Missing TOKEN environment variable. Add TOKEN in Render Environment Variables.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const sessions = new Map();

function getSession(guildId) {
  let s = sessions.get(guildId);
  if (!s) {
    s = { player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } }), connection: null, current: null, startedAt: 0, baseSeconds: 0 };
    s.player.on(AudioPlayerStatus.Idle, () => { s.current = null; s.baseSeconds = 0; s.startedAt = 0; });
    s.player.on('error', err => console.error('Audio player error:', err));
    sessions.set(guildId, s);
  }
  return s;
}

async function connectToMember(member, session) {
  const channel = member.voice.channel;
  if (!channel) throw new Error('VOICE_REQUIRED');
  if (!session.connection || session.connection.joinConfig.channelId !== channel.id) {
    if (session.connection) {
      try { session.connection.destroy(); } catch {}
    }
    session.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    session.connection.subscribe(session.player);
    session.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(session.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(session.connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        try { session.connection.destroy(); } catch {}
        session.connection = null;
      }
    });
  }
  await entersState(session.connection, VoiceConnectionStatus.Ready, 20_000);
  return channel;
}

async function searchAndPlay(message, query, session) {
  const channel = await connectToMember(message.member, session);
  const results = await play.search(query, { limit: 1, source: { youtube: 'video' } });
  if (!results || !results.length) {
    await message.reply('❌ ما لقيت الأغنية. جرّب اسمًا أوضح.');
    return;
  }
  const video = results[0];
  const stream = await play.stream(video.url, { seek: 0 });
  const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
  session.player.play(resource);
  session.current = { url: video.url, title: video.title, duration: video.durationInSec || 0 };
  session.baseSeconds = 0;
  session.startedAt = Date.now();
  await message.reply(`🎶 **${video.title}**\n▶️ جاري التشغيل في **${channel.name}**\n${video.url}`);
  await message.react('✅').catch(() => {});
}

client.once('ready', () => console.log(`Rip Music online as ${client.user.tag}`));

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot || !message.member) return;
  const content = message.content.trim();
  if (!content) return;
  const parts = content.split(/\s+/);
  const command = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ').trim();
  const session = getSession(message.guild.id);

  try {
    // Play aliases: ش, شغل, تشغيل, play, p
    if (['ش', 'شغل', 'تشغيل', 'play', 'p'].includes(command)) {
      if (!rest) {
        await message.reply('اكتب اسم الأغنية بعد الأمر، مثال: `ش حسن رسام` أو `play Hasan Rasam`');
        return;
      }
      await searchAndPlay(message, rest, session);
      return;
    }

    // Stop aliases: وقف, stop, s
    if (['وقف', 'stop', 's'].includes(command)) {
      if (session.player.state.status !== AudioPlayerStatus.Idle) session.player.stop(true);
      session.current = null;
      session.baseSeconds = 0;
      session.startedAt = 0;
      await message.react('❌').catch(() => {});
      return;
    }

    // Pause and resume
    if (['ايقاف', 'pause'].includes(command)) {
      session.player.pause();
      await message.react('⏸️').catch(() => {});
      return;
    }
    if (['كمل', 'resume', 'استكمل'].includes(command)) {
      session.player.unpause();
      await message.react('▶️').catch(() => {});
      return;
    }

    // Forward relative seconds: قدم 20 / seek 20 / forward 20
    if (['قدم', 'seek', 'forward'].includes(command)) {
      const seconds = Number.parseInt(rest, 10);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) {
        await message.reply('اكتب عدد الثواني، مثال: `قدم 20`');
        return;
      }
      if (!session.current || !session.current.url) {
        await message.reply('❌ ما فيه أغنية شغالة حاليًا.');
        return;
      }
      const elapsed = session.baseSeconds + (session.startedAt ? Math.floor((Date.now() - session.startedAt) / 1000) : 0);
      const target = elapsed + seconds;
      if (session.current.duration && target >= session.current.duration) {
        session.player.stop(true);
        session.current = null;
        await message.react('⏭️').catch(() => {});
        return;
      }
      const current = session.current;
      const stream = await play.stream(current.url, { seek: target });
      const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
      session.player.play(resource);
      session.baseSeconds = target;
      session.startedAt = Date.now();
      await message.react('⏩').catch(() => {});
      return;
    }

    // Join and stay in voice: hey @bot music / music / دخول
    const mentioned = message.mentions.users.has(client.user.id);
    const lower = content.toLowerCase();
    if ((mentioned && /\b(music|hey|دخول|ادخل)\b/i.test(content)) || ['music', 'دخول', 'ادخل'].includes(command)) {
      const channel = await connectToMember(message.member, session);
      await message.reply(`🔊 دخلت **${channel.name}** وباقي فيه. اكتب 0ش اسم الأغنية0 للتشغيل.`.replaceAll('\u00060', '`'));
      await message.react('✅').catch(() => {});
    }
  } catch (error) {
    console.error(error);
    const msg = error.message === 'VOICE_REQUIRED'
      ? '❌ لازم تكون داخل روم صوتي أول.'
      : '❌ ما قدرت أشغّل الطلب. تأكد من إعدادات الصوت والاستضافة وجرب مرة ثانية.';
    await message.reply(msg).catch(() => {});
  }
});

client.login(process.env.TOKEN);
