const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  AttachmentBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  staffRoleId: process.env.STAFF_ROLE_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || null,
  logChannelId: process.env.LOG_CHANNEL_ID || null,
};

if (!CONFIG.token || !CONFIG.clientId || !CONFIG.guildId || !CONFIG.staffRoleId) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, GUILD_ID or STAFF_ROLE_ID.");
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, "data.json");
const BANNER = path.join(__dirname, "assets", "ticket-banner.png");

function loadData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return parsed && parsed.tickets ? parsed : { tickets: {} };
  } catch {
    return { tickets: {} };
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const data = loadData();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const ticketTypes = {
  support: { label: "دعم فني", emoji: "🛠️", description: "مساعدة واستفسارات" },
  complaint: { label: "شكوى", emoji: "⚠️", description: "تقديم شكوى" },
  report: { label: "بلاغ", emoji: "🚨", description: "الإبلاغ عن مخالفة" },
  management: { label: "إدارة", emoji: "👑", description: "التواصل مع الإدارة" },
  general: { label: "تذكرة عامة", emoji: "💬", description: "أي استفسار آخر" },
};

function isStaff(member) {
  return Boolean(
    member?.roles?.cache?.has(CONFIG.staffRoleId) ||
    member?.permissions?.has(PermissionsBitField.Flags.Administrator)
  );
}

function bannerAttachment() {
  if (!fs.existsSync(BANNER)) return null;
  return new AttachmentBuilder(BANNER, { name: "ticket-banner.png" });
}

function panelEmbed() {
  return new EmbedBuilder()
    .setTitle("👑 RIP • TICKET SYSTEM")
    .setDescription(
      "**مرحبًا بك في نظام التذاكر الرسمي لـ Rip**\n\n" +
      "اختر القسم المناسب من القائمة بالأسفل، وسيتم إنشاء محادثة خاصة بك مع الإدارة.\n\n" +
      "🛠️ **دعم فني** — مساعدة واستفسارات\n" +
      "⚠️ **شكوى** — تقديم شكوى\n" +
      "🚨 **بلاغ** — الإبلاغ عن مخالفة\n" +
      "👑 **إدارة** — التواصل مع الإدارة\n" +
      "💬 **عامة** — أي طلب آخر\n\n" +
      "🔒 **تنبيه:** يمنع فتح أكثر من تذكرة لنفس الموضوع."
    )
    .setColor(0xE50914)
    .setImage("attachment://ticket-banner.png")
    .setFooter({ text: "RIP • Professional Ticket System" });
}

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_create")
        .setPlaceholder("🎫 اختر نوع التذكرة")
        .addOptions(
          Object.entries(ticketTypes).map(([value, t]) => ({
            label: t.label,
            value,
            emoji: t.emoji,
            description: t.description,
          }))
        )
    ),
  ];
}

function ticketButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim")
        .setEmoji("🙋")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_admin")
        .setLabel("لوحة الإدارة")
        .setEmoji("⚙️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("إغلاق")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

function adminPanelRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("admin_rename")
        .setLabel("تغيير اسم المحادثة")
        .setEmoji("✏️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("admin_add")
        .setLabel("إدخال عضو")
        .setEmoji("👤")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("admin_remove")
        .setLabel("إخراج عضو")
        .setEmoji("🚪")
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("admin_clear")
        .setLabel("Clear")
        .setEmoji("🧹")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("admin_lock")
        .setLabel("قفل المحادثة")
        .setEmoji("🔐")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("admin_unlock")
        .setLabel("فتح المحادثة")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("admin_transcript")
        .setLabel("Transcript")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("admin_close")
        .setLabel("إغلاق وحذف")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

function ticketEmbed(type, user) {
  return new EmbedBuilder()
    .setTitle(`${ticketTypes[type]?.emoji || "🎫"} ${ticketTypes[type]?.label || "تذكرة"}`)
    .setDescription(
      `أهلًا <@${user.id}> 👋\n\n` +
      "تم إنشاء تذكرتك بنجاح. اكتب طلبك بالتفصيل وانتظر الإدارة.\n\n" +
      "**قوانين التذكرة**\n" +
      "• يمنع السب والإزعاج.\n" +
      "• يمنع فتح تذاكر متعددة لنفس الموضوع.\n" +
      "• أرفق الأدلة عند الحاجة.\n" +
      "• يمنع منشن الإدارة بشكل متكرر.\n" +
      "• إغلاق التذكرة متاح للإدارة فقط."
    )
    .setColor(0xE50914)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setImage("attachment://ticket-banner.png")
    .setFooter({ text: "RIP • Ticket System" })
    .setTimestamp();
}

async function sendLog(guild, embed, file = null) {
  if (!CONFIG.logChannelId) return;
  const channel = guild.channels.cache.get(CONFIG.logChannelId);
  if (channel?.isTextBased()) {
    await channel
      .send({ embeds: [embed], files: file ? [file] : [] })
      .catch(() => {});
  }
}

async function transcript(channel) {
  const all = [];
  let before;

  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages
      .fetch({ limit: 100, before })
      .catch(() => null);

    if (!batch || !batch.size) break;

    all.push(...batch.values());
    before = batch.last().id;

    if (batch.size < 100) break;
  }

  return all
    .reverse()
    .map(
      (m) =>
        `[${m.createdAt.toISOString()}] ${m.author.tag}: ${
          m.content || "[مرفق / Embed]"
        }`
    )
    .join("\n");
}

function adminOnlyReply(interaction) {
  return interaction.reply({
    content: "❌ هذه العملية للإدارة فقط.",
    ephemeral: true,
  });
}

function getTicket(interaction) {
  return data.tickets[interaction.channelId] || null;
}

async function openAdminPanel(interaction) {
  if (!isStaff(interaction.member)) return adminOnlyReply(interaction);

  const ticket = getTicket(interaction);

  if (!ticket?.open) {
    return interaction.reply({
      content: "❌ استخدم هذا الأمر داخل تذكرة مفتوحة.",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("⚙️ RIP • لوحة إدارة التذكرة")
    .setDescription(
      "هذه اللوحة **للإدارة فقط**.\n\n" +
      "✏️ تغيير اسم المحادثة\n" +
      "👤 إدخال عضو / 🚪 إخراج عضو\n" +
      "🧹 Clear لمسح الرسائل\n" +
      "🔐 قفل / 🔓 فتح المحادثة\n" +
      "📜 استخراج Transcript\n" +
      "🗑️ إغلاق وحذف التذكرة"
    )
    .setColor(0xE50914)
    .setFooter({ text: "RIP • Staff Control Panel" });

  return interaction.reply({
    embeds: [embed],
    components: adminPanelRows(),
    ephemeral: true,
  });
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("ticket-panel")
      .setDescription("إرسال لوحة التذاكر"),
    new SlashCommandBuilder()
      .setName("ticket-admin")
      .setDescription("فتح لوحة إدارة التذكرة الحالية"),
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("عرض إعدادات نظام التذاكر"),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(CONFIG.token);

  await rest.put(
    Routes.applicationGuildCommands(CONFIG.clientId, CONFIG.guildId),
    { body: commands }
  );

  console.log("Slash commands registered.");
}

client.once("ready", async () => {
  console.log(`Online as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Rip Tickets", type: 3 }],
    status: "online",
  });

  await registerCommands().catch(console.error);
});

client.on("interactionCreate", async (interaction) => {
  try {
    // =========================
    // SLASH COMMANDS
    // =========================
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ticket-panel") {
        if (!isStaff(interaction.member)) return adminOnlyReply(interaction);

        await interaction.deferReply({ ephemeral: true });

        const file = bannerAttachment();

        await interaction.channel.send({
          embeds: [panelEmbed()],
          components: panelComponents(),
          files: file ? [file] : [],
        });

        return interaction.editReply("✅ تم إرسال لوحة التذاكر.");
      }

      if (interaction.commandName === "ticket-admin") {
        return openAdminPanel(interaction);
      }

      if (interaction.commandName === "setup") {
        if (!isStaff(interaction.member)) return adminOnlyReply(interaction);

        return interaction.reply({
          content:
            `**👑 RIP Ticket System**\n\n` +
            `• **Staff:** <@&${CONFIG.staffRoleId}>\n` +
            `• **Category:** ${
              CONFIG.ticketCategoryId
                ? `<#${CONFIG.ticketCategoryId}>`
                : "غير محددة — التذاكر ستنشأ بدون تصنيف"
            }\n` +
            `• **Logs:** ${
              CONFIG.logChannelId
                ? `<#${CONFIG.logChannelId}>`
                : "غير مفعلة"
            }\n` +
            `• **Banner:** ${
              fs.existsSync(BANNER) ? "✅ موجود" : "❌ غير موجود"
            }\n\n` +
            `**الأوامر:**\n` +
            `🎫 /ticket-panel — إرسال اللوحة\n` +
            `⚙️ /ticket-admin — لوحة الإدارة داخل التذكرة`,
          ephemeral: true,
        });
      }
    }

    // =========================
    // CREATE TICKET
    // =========================
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_create"
    ) {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.values[0];
      const guild = interaction.guild;

      if (!guild) {
        return interaction.editReply("❌ تعذر العثور على السيرفر.");
      }

      const existing = Object.values(data.tickets).find(
        (t) =>
          t.guildId === guild.id &&
          t.userId === interaction.user.id &&
          t.open
      );

      if (existing) {
        const ch = guild.channels.cache.get(existing.channelId);
        return interaction.editReply(
          ch
            ? `❌ لديك تذكرة مفتوحة: <#${ch.id}>`
            : "❌ لديك تذكرة مفتوحة بالفعل."
        );
      }

      const me = guild.members.me;
      if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.editReply(
          "❌ البوت يحتاج صلاحية **Manage Channels** لإنشاء التذاكر."
        );
      }

      const safe =
        interaction.user.username
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 18) || "user";

      const channel = await guild.channels.create({
        name: `ticket-${safe}`,
        type: ChannelType.GuildText,
        parent: CONFIG.ticketCategoryId || undefined,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
          {
            id: CONFIG.staffRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
        ],
      });

      data.tickets[channel.id] = {
        channelId: channel.id,
        guildId: guild.id,
        userId: interaction.user.id,
        type,
        open: true,
        claimedBy: null,
        createdAt: new Date().toISOString(),
      };

      saveData();

      const file = bannerAttachment();

      await channel.send({
        content: `<@${interaction.user.id}> <@&${CONFIG.staffRoleId}>`,
        embeds: [ticketEmbed(type, interaction.user)],
        components: ticketButtons(),
        files: file ? [file] : [],
      });

      await interaction.editReply(`✅ تم إنشاء تذكرتك: <#${channel.id}>`);

      await sendLog(
        guild,
        new EmbedBuilder()
          .setTitle("🎫 Ticket Opened")
          .setDescription(
            `<@${interaction.user.id}> فتح تذكرة <#${channel.id}>`
          )
          .addFields({
            name: "النوع",
            value: ticketTypes[type]?.label || type,
            inline: true,
          })
          .setColor(0x57f287)
          .setTimestamp()
      );

      return;
    }

    // =========================
    // BUTTONS
    // =========================
    if (interaction.isButton()) {
      if (interaction.customId === "ticket_admin") {
        return openAdminPanel(interaction);
      }

      const ticket = getTicket(interaction);

      if (!ticket?.open) {
        return interaction.reply({
          content: "❌ هذه ليست تذكرة مفتوحة.",
          ephemeral: true,
        });
      }

      if (interaction.customId === "ticket_claim") {
        if (!isStaff(interaction.member)) return adminOnlyReply(interaction);

        if (ticket.claimedBy) {
          return interaction.reply({
            content: `❌ مستلمة بالفعل بواسطة <@${ticket.claimedBy}>.`,
            ephemeral: true,
          });
        }

        ticket.claimedBy = interaction.user.id;
        saveData();

        return interaction.reply({
          content: `🙋 تم استلام التذكرة بواسطة <@${interaction.user.id}>.`,
        });
      }

      if (!isStaff(interaction.member)) return adminOnlyReply(interaction);

      if (
        interaction.customId === "ticket_close" ||
        interaction.customId === "admin_close"
      ) {
        return closeTicket(interaction);
      }

      if (interaction.customId === "admin_rename") {
        const modal = new ModalBuilder()
          .setCustomId("modal_rename")
          .setTitle("تغيير اسم المحادثة");

        const input = new TextInputBuilder()
          .setCustomId("new_name")
          .setLabel("اسم المحادثة الجديد")
          .setPlaceholder("مثال: support-mohamed")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(90);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        return interaction.showModal(modal);
      }

      if (interaction.customId === "admin_add") {
        const menu = new UserSelectMenuBuilder()
          .setCustomId("admin_add_user")
          .setPlaceholder("اختر العضو الذي تريد إدخاله")
          .setMinValues(1)
          .setMaxValues(1);

        return interaction.reply({
          content: "👤 اختر العضو:",
          components: [new ActionRowBuilder().addComponents(menu)],
          ephemeral: true,
        });
      }

      if (interaction.customId === "admin_remove") {
        const menu = new UserSelectMenuBuilder()
          .setCustomId("admin_remove_user")
          .setPlaceholder("اختر العضو الذي تريد إخراجه")
          .setMinValues(1)
          .setMaxValues(1);

        return interaction.reply({
          content: "🚪 اختر العضو:",
          components: [new ActionRowBuilder().addComponents(menu)],
          ephemeral: true,
        });
      }

      if (interaction.customId === "admin_clear") {
        await interaction.deferReply({ ephemeral: true });

        const messages = await interaction.channel.messages.fetch({
          limit: 100,
        });

        const deletable = messages.filter(
          (m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
        );

        if (deletable.size) {
          await interaction.channel
            .bulkDelete(deletable, true)
            .catch(() => {});
        }

        return interaction.editReply(
          `🧹 تم مسح ${deletable.size} رسالة.`
        );
      }

      if (interaction.customId === "admin_lock") {
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
          SendMessages: false,
        });

        return interaction.reply({
          content: "🔐 تم قفل المحادثة على صاحب التذكرة.",
          ephemeral: true,
        });
      }

      if (interaction.customId === "admin_unlock") {
        await interaction.channel.permissionOverwrites.edit(ticket.userId, {
          SendMessages: true,
        });

        return interaction.reply({
          content: "🔓 تم فتح المحادثة لصاحب التذكرة.",
          ephemeral: true,
        });
      }

      if (interaction.customId === "admin_transcript") {
        await interaction.deferReply({ ephemeral: true });

        const text = await transcript(interaction.channel);
        const filePath = path.join(
          __dirname,
          `transcript-${interaction.channelId}.txt`
        );

        fs.writeFileSync(filePath, text || "No messages.", "utf8");

        await interaction.editReply({
          content: "📜 تم إنشاء الـTranscript.",
          files: [filePath],
        });

        await sendLog(
          interaction.guild,
          new EmbedBuilder()
            .setTitle("📜 Transcript Created")
            .setDescription(
              `<@${interaction.user.id}> أنشأ Transcript لـ <#${interaction.channelId}>`
            )
            .setColor(0x5865f2)
            .setTimestamp(),
          filePath
        );

        fs.unlink(filePath, () => {});
        return;
      }
    }

    // =========================
    // RENAME MODAL
    // =========================
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_rename"
    ) {
      if (!isStaff(interaction.member)) return adminOnlyReply(interaction);

      const ticket = getTicket(interaction);

      if (!ticket?.open) {
        return interaction.reply({
          content: "❌ التذكرة مغلقة.",
          ephemeral: true,
        });
      }

      let name = interaction.fields
        .getTextInputValue("new_name")
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 90);

      if (!name) name = `ticket-${ticket.userId}`;

      await interaction.channel.setName(name);

      return interaction.reply({
        content: `✏️ تم تغيير اسم المحادثة إلى **${name}**.`,
        ephemeral: true,
      });
    }

    // =========================
    // USER SELECT MENUS
    // =========================
    if (interaction.isUserSelectMenu()) {
      const ticket = getTicket(interaction);

      if (!ticket?.open || !isStaff(interaction.member)) {
        return adminOnlyReply(interaction);
      }

      const userId = interaction.values[0];
      const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

      if (!member) {
        return interaction.update({
          content: "❌ لم أجد العضو.",
          components: [],
        });
      }

      if (interaction.customId === "admin_add_user") {
        await interaction.channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
        });

        await interaction.update({
          content: `👤 تم إدخال <@${userId}> إلى التذكرة.`,
          components: [],
        });

        await interaction.channel.send(
          `➕ تم إدخال <@${userId}> إلى هذه التذكرة بواسطة <@${interaction.user.id}>.`
        );

        return;
      }

      if (interaction.customId === "admin_remove_user") {
        if (userId === ticket.userId) {
          return interaction.update({
            content: "❌ لا يمكنك إخراج صاحب التذكرة.",
            components: [],
          });
        }

        await interaction.channel.permissionOverwrites
          .delete(userId)
          .catch(() => {});

        await interaction.update({
          content: `🚪 تم إخراج <@${userId}> من التذكرة.`,
          components: [],
        });

        await interaction.channel.send(
          `➖ تم إخراج <@${userId}> من التذكرة بواسطة <@${interaction.user.id}>.`
        );

        return;
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);

    if (interaction.isRepliable()) {
      if (interaction.deferred) {
        await interaction
          .editReply("❌ حدث خطأ غير متوقع. راجع Railway Logs لمعرفة السبب.")
          .catch(() => {});
      } else if (!interaction.replied) {
        await interaction
          .reply({
            content: "❌ حدث خطأ غير متوقع. راجع Railway Logs لمعرفة السبب.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  }
});

async function closeTicket(interaction) {
  const ticket = data.tickets[interaction.channelId];

  if (!ticket?.open) {
    return interaction.reply({
      content: "❌ التذكرة مغلقة بالفعل.",
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: "🔒 جاري حفظ الـTranscript وإغلاق التذكرة...",
  });

  const text = await transcript(interaction.channel);
  const filePath = path.join(
    __dirname,
    `transcript-${interaction.channelId}.txt`
  );

  fs.writeFileSync(filePath, text || "No messages.", "utf8");

  await sendLog(
    interaction.guild,
    new EmbedBuilder()
      .setTitle("🔒 Ticket Closed")
      .setDescription(
        `**التذكرة:** <#${interaction.channelId}>\n` +
        `**صاحبها:** <@${ticket.userId}>\n` +
        `**أغلقها:** <@${interaction.user.id}>`
      )
      .setColor(0xed4245)
      .setTimestamp(),
    filePath
  );

  ticket.open = false;
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date().toISOString();
  saveData();

  fs.unlink(filePath, () => {});

  setTimeout(() => {
    interaction.channel
      .delete("Ticket closed by staff")
      .catch(() => {});
  }, 2500);
}

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(CONFIG.token);
