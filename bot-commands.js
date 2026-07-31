// ============================================================
//  Bot Tempest 🌪 — discord.js v14
//  Comandos: ping, saldo, daily, apostar, ban, mutar,
//            desmutar, expulsar, slowmode (prefix + slash)
// ============================================================

require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, REST, Routes,
  SlashCommandBuilder, PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Cliente ─────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ─── Persistência ─────────────────────────────────────────
const ECO_FILE  = path.join(__dirname, 'economy.json');
const DATA_FILE = path.join(__dirname, 'data.json');
const CMD_FILE  = path.join(__dirname, 'cmd-states.json');

function loadEco() {
  try { return fs.existsSync(ECO_FILE) ? JSON.parse(fs.readFileSync(ECO_FILE)) : {}; } catch { return {}; }
}
function saveEco(d) { fs.writeFileSync(ECO_FILE, JSON.stringify(d, null, 2)); }

function loadData() {
  try { return fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE)) : {}; } catch { return {}; }
}
function saveData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

function loadCmdStates() {
  try { return fs.existsSync(CMD_FILE) ? JSON.parse(fs.readFileSync(CMD_FILE)) : {}; } catch { return {}; }
}

// ─── Helpers de economia ──────────────────────────────────
function getBalance(userId) {
  const eco = loadEco();
  return eco[userId]?.balance ?? 0;
}
function addBalance(userId, amount) {
  const eco = loadEco();
  if (!eco[userId]) eco[userId] = { balance: 0, lastDaily: null };
  eco[userId].balance = Math.max(0, eco[userId].balance + amount);
  saveEco(eco);
  return eco[userId].balance;
}
function getLastDaily(userId) {
  const eco = loadEco();
  return eco[userId]?.lastDaily ?? null;
}
function setLastDaily(userId) {
  const eco = loadEco();
  if (!eco[userId]) eco[userId] = { balance: 0, lastDaily: null };
  eco[userId].lastDaily = new Date().toISOString();
  saveEco(eco);
}

// ─── Formata número (1.500.000) ───────────────────────────
function fmt(n) { return n.toLocaleString('pt-BR'); }

// ─── Parse duração (10s, 5m, 2h, 3ms, 1n) ────────────────
function parseDuration(str) {
  if (!str) return null;
  const match = String(str).trim().match(/^(\d+)(ms|s|m|h|n)$/i);
  if (!match) return null;
  const num  = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const secs = { s: num, m: num * 60, h: num * 3600, ms: num * 604800, n: num * 31536000 };
  return secs[unit] ?? null;
}

function durationLabel(str) {
  const match = String(str).trim().match(/^(\d+)(ms|s|m|h|n)$/i);
  if (!match) return str;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const labels = { s: `${num} segundo(s)`, m: `${num} minuto(s)`, h: `${num} hora(s)`, ms: `${num} semana(s)`, n: `${num} ano(s)` };
  return labels[unit] ?? str;
}

// ─── Staff check ──────────────────────────────────────────
const STAFF_ROLE_IDS = [
  '1507104968992362610',
  '1507104968992362609',
  '1507104968992362608',
];
function hasStaff(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
}

// ─── Comando ativo? ───────────────────────────────────────
function isCmdEnabled(name) {
  const states = loadCmdStates();
  return states[name] !== false;
}

// ─── Prefixo dinâmico ─────────────────────────────────────
function getPrefix() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'bot-state.json')));
    return cfg?.config?.prefix || ';';
  } catch { return ';'; }
}

// ─── Cor padrão ───────────────────────────────────────────
const COLOR = '#8B6043';

// ═══════════════════════════════════════════════════════════
//  SLASH COMMANDS — REGISTRO
// ═══════════════════════════════════════════════════════════
const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Mostra o ping atual do bot'),

  new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('💰 Veja seu saldo de Tempestades'),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 Colete sua recompensa diária de Tempestades'),

  new SlashCommandBuilder()
    .setName('apostar')
    .setDescription('🎲 Aposte suas Tempestades')
    .addIntegerOption(opt =>
      opt.setName('valor').setDescription('Quantidade de Tempestades para apostar').setRequired(true).setMinValue(1))
    .addIntegerOption(opt =>
      opt.setName('chance')
        .setDescription('Sua chance de vencer em % (padrão: 50). Sugestões: 10,20,30,40,50,60,70,80,90')
        .setRequired(false)
        .addChoices(
          { name: '10% (6x)', value: 10 }, { name: '20% (5x)', value: 20 },
          { name: '30% (4x)', value: 30 }, { name: '40% (3x)', value: 40 },
          { name: '50% (2x)', value: 50 }, { name: '60% (1.5x)', value: 60 },
          { name: '70% (1.3x)', value: 70 }, { name: '80% (1.2x)', value: 80 },
          { name: '90% (1.1x)', value: 90 },
        )),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Bane um membro do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuário para banir').setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo').setDescription('Motivo do ban').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mutar')
    .setDescription('🔇 Silencia um membro temporariamente')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuário para mutar').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duracao')
        .setDescription('Duração: s=segundos, m=minutos, h=horas, ms=semanas, n=anos. Ex: 10m, 2h, 1ms')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('desmutar')
    .setDescription('🔊 Remove o silêncio de um membro')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuário para desmutar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('expulsar')
    .setDescription('👢 Expulsa um membro do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuário para expulsar').setRequired(true))
    .addStringOption(opt =>
      opt.setName('motivo').setDescription('Motivo da expulsão').setRequired(false)),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('⏳ Edita o slow mode de um canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName('duracao')
        .setDescription('Duração (s, m, h, ms, n). Ex: 10s, 5m. Deixe vazio para não alterar.')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('ativo')
        .setDescription('Ativar ou desativar o slow mode')
        .setRequired(false)
        .addChoices({ name: 'yes — ativar', value: 'yes' }, { name: 'no — desativar', value: 'no' })),
].map(c => c.toJSON());

// ─── Registra slash commands na inicialização ─────────────
client.once('ready', async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands },
    );
    console.log('✅ Slash commands registrados!');
  } catch (e) { console.error('Erro ao registrar slash commands:', e); }

  // Ping de status para o painel (a cada 10s)
  const PAINEL_API = process.env.PAINEL_API || '';
  if (PAINEL_API) {
    setInterval(async () => {
      try { await fetch(PAINEL_API + '/api/bot/ping', { method: 'POST' }); } catch {}
    }, 10000);
    // Primeiro ping imediato
    try { await fetch(PAINEL_API + '/api/bot/ping', { method: 'POST' }); } catch {}
  }
});

// ═══════════════════════════════════════════════════════════
//  HANDLER SLASH (/comando)
// ═══════════════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // Verifica se o comando está ativo
  if (!isCmdEnabled(commandName)) return;

  // ── /ping ─────────────────────────────────────────────
  if (commandName === 'ping') {
    const before = Date.now();
    await interaction.deferReply();
    const latency = Date.now() - before;
    const ws = interaction.client.ws.ping;
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏓 Pong!')
          .setColor(COLOR)
          .addFields(
            { name: '📡 Latência API', value: `\`${latency}ms\``, inline: true },
            { name: '💓 WebSocket',    value: `\`${ws}ms\``,      inline: true },
          ),
      ],
    });
    return;
  }

  // ── /saldo ────────────────────────────────────────────
  if (commandName === 'saldo') {
    const bal = getBalance(interaction.user.id);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('🏦 Bem vindo ao banco Levi')
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '\u200b', value: `**Seu saldo atual de tempestades é de:** \`${fmt(bal)}\` 🌪` },
            { name: '\u200b', value: '**Dica:** Quem ganha moeda fácil sem depender da sorte todo dia? Use `/daily`' },
          ),
      ],
    });
    return;
  }

  // ── /daily ────────────────────────────────────────────
  if (commandName === 'daily') {
    const userId = interaction.user.id;
    const lastDaily = getLastDaily(userId);
    const now = Date.now();

    if (lastDaily) {
      const diff = now - new Date(lastDaily).getTime();
      const COOLDOWN = 24 * 60 * 60 * 1000;
      if (diff < COOLDOWN) {
        const rem = COOLDOWN - diff;
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        await interaction.reply({
          embeds: [
            new EmbedBuilder().setColor(COLOR)
              .setDescription(`⏰ Você já coletou seu daily hoje!\nVolte em **${h}h ${m}m**.`),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Gacha: 5.000 (comum) → 100.000 (raro)
    const tiers = [
      { min: 5000,   max: 15000,  weight: 40 },
      { min: 15001,  max: 30000,  weight: 30 },
      { min: 30001,  max: 50000,  weight: 18 },
      { min: 50001,  max: 75000,  weight: 9  },
      { min: 75001,  max: 100000, weight: 3  },
    ];
    const total = tiers.reduce((a, t) => a + t.weight, 0);
    let roll = Math.random() * total;
    let tier = tiers[0];
    for (const t of tiers) { if (roll < t.weight) { tier = t; break; } roll -= t.weight; }
    const gained = Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
    const newBal = addBalance(userId, gained);
    setLastDaily(userId);

    const rarity = tier.min >= 75001 ? '🌟 ULTRA RARO!' : tier.min >= 50001 ? '💎 Raro!' : tier.min >= 30001 ? '✨ Incomum' : '🌪 Comum';

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('📅 Daily Coletado!')
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`Você conseguiu **${fmt(gained)}** Tempestades! ${rarity}`)
          .addFields({ name: '💰 Saldo total', value: `\`${fmt(newBal)}\` 🌪` }),
      ],
    });
    return;
  }

  // ── /apostar ──────────────────────────────────────────
  if (commandName === 'apostar') {
    const valor  = interaction.options.getInteger('valor');
    const chance = interaction.options.getInteger('chance') ?? 50;
    const userId = interaction.user.id;
    const bal    = getBalance(userId);

    if (bal < valor) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`❌ Saldo insuficiente! Você tem **${fmt(bal)}** 🌪`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Multiplicador: 50% = 2x; cada 10% abaixo adiciona 1x; acima diminui
    function calcMulti(c) {
      if (c <= 50) return 2 + Math.floor((50 - c) / 10);
      const above = Math.floor((c - 50) / 10);
      return Math.max(1.1, 2 - above * 0.5);
    }
    const multi = calcMulti(chance);
    const win   = Math.random() * 100 < chance;

    let newBal;
    if (win) {
      const prize = Math.floor(valor * multi);
      newBal = addBalance(userId, prize - valor);
      await interaction.reply({
        embeds: [
          new EmbedBuilder().setColor('#23a55a')
            .setTitle('🎲 Você ganhou!')
            .setDescription(`Apostou **${fmt(valor)}** com **${chance}%** de chance (${multi}x)\nGanhou **+${fmt(prize - valor)}** Tempestades!`)
            .addFields({ name: '💰 Novo saldo', value: `\`${fmt(newBal)}\` 🌪` }),
        ],
      });
    } else {
      newBal = addBalance(userId, -valor);
      await interaction.reply({
        embeds: [
          new EmbedBuilder().setColor('#ed4245')
            .setTitle('🎲 Você perdeu...')
            .setDescription(`Apostou **${fmt(valor)}** com **${chance}%** de chance\nPerdeu **-${fmt(valor)}** Tempestades.`)
            .addFields({ name: '💰 Novo saldo', value: `\`${fmt(newBal)}\` 🌪` }),
        ],
      });
    }
    return;
  }

  // ── /ban ──────────────────────────────────────────────
  if (commandName === 'ban') {
    if (!hasStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Você não tem permissão!', flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') || 'Nenhum motivo informado';
    try {
      await interaction.guild.members.ban(target, { reason });
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#ed4245').setTitle('🔨 Banido')
          .addFields({ name: 'Usuário', value: `${target.tag}`, inline: true }, { name: 'Motivo', value: reason, inline: true })],
      });
    } catch {
      await interaction.reply({ content: '❌ Não foi possível banir este usuário.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // ── /mutar ────────────────────────────────────────────
  if (commandName === 'mutar') {
    if (!hasStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Você não tem permissão!', flags: MessageFlags.Ephemeral });
      return;
    }
    const target   = interaction.options.getUser('usuario');
    const duracaoStr = interaction.options.getString('duracao');
    const secs     = parseDuration(duracaoStr);

    if (!secs) {
      await interaction.reply({
        content: '❌ **Duração inválida!** Use: `s` segundos, `m` minutos, `h` horas, `ms` semanas, `n` anos.\nEx: `10m`, `2h`, `1ms`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (secs > 28 * 24 * 3600) {
      await interaction.reply({ content: '❌ Duração máxima do Discord é 28 dias.', flags: MessageFlags.Ephemeral });
      return;
    }
    try {
      const member = await interaction.guild.members.fetch(target.id);
      await member.timeout(secs * 1000, `Mutado por ${interaction.user.tag}`);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🔇 Mutado')
          .addFields(
            { name: 'Usuário',  value: target.tag,              inline: true },
            { name: 'Duração',  value: durationLabel(duracaoStr), inline: true },
          )],
      });
    } catch {
      await interaction.reply({ content: '❌ Não foi possível mutar este usuário.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // ── /desmutar ─────────────────────────────────────────
  if (commandName === 'desmutar') {
    if (!hasStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Você não tem permissão!', flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser('usuario');
    try {
      const member = await interaction.guild.members.fetch(target.id);
      if (!member.communicationDisabledUntil || new Date(member.communicationDisabledUntil) < new Date()) {
        await interaction.reply({ content: `❌ **Erro** — ${target.tag} não está mutado.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await member.timeout(null);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#23a55a').setTitle('🔊 Desmutado')
          .setDescription(`${target.tag} foi desmutado com sucesso.`)],
      });
    } catch {
      await interaction.reply({ content: '❌ Não foi possível desmutar este usuário.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // ── /expulsar ─────────────────────────────────────────
  if (commandName === 'expulsar') {
    if (!hasStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Você não tem permissão!', flags: MessageFlags.Ephemeral });
      return;
    }
    const target = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') || 'Nenhum motivo informado';
    try {
      const member = await interaction.guild.members.fetch(target.id);
      await member.kick(reason);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#f0a30a').setTitle('👢 Expulso')
          .addFields({ name: 'Usuário', value: target.tag, inline: true }, { name: 'Motivo', value: reason, inline: true })],
      });
    } catch {
      await interaction.reply({ content: '❌ Não foi possível expulsar este usuário.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // ── /slowmode ─────────────────────────────────────────
  if (commandName === 'slowmode') {
    if (!hasStaff(interaction.member)) {
      await interaction.reply({ content: '❌ Você não tem permissão!', flags: MessageFlags.Ephemeral });
      return;
    }
    const duracaoStr = interaction.options.getString('duracao');
    const ativo      = interaction.options.getString('ativo');

    if (!duracaoStr && !ativo) {
      await interaction.reply({ content: '❌ **Erro** — Por favor faça alguma alteração!', flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = interaction.channel;
    let newRate = channel.rateLimitPerUser;

    if (ativo === 'no') { newRate = 0; }
    else if (duracaoStr) {
      const secs = parseDuration(duracaoStr);
      if (!secs) {
        await interaction.reply({ content: '❌ Duração inválida! Use s, m, h, ms ou n. Ex: `10s`, `5m`', flags: MessageFlags.Ephemeral });
        return;
      }
      newRate = Math.min(secs, 21600);
    }

    try {
      await channel.setRateLimitPerUser(newRate, `Slowmode por ${interaction.user.tag}`);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle('⏳ Slow Mode Atualizado')
          .addFields(
            { name: 'Canal',    value: `${channel}`,                                  inline: true },
            { name: 'Delay',    value: newRate === 0 ? 'Desativado' : `${newRate}s`,  inline: true },
          )],
      });
    } catch {
      await interaction.reply({ content: '❌ Não foi possível alterar o slow mode.', flags: MessageFlags.Ephemeral });
    }
    return;
  }
});

// ═══════════════════════════════════════════════════════════
//  HANDLER PREFIX (;comando)
// ═══════════════════════════════════════════════════════════
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const PREFIX = getPrefix();
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd  = args.shift().toLowerCase();

  if (!isCmdEnabled(cmd)) return;

  // ── ;ping ─────────────────────────────────────────────
  if (cmd === 'ping') {
    const msg = await message.reply('🏓 Calculando...');
    const lat = msg.createdTimestamp - message.createdTimestamp;
    await msg.edit({
      content: '',
      embeds: [
        new EmbedBuilder().setColor(COLOR).setTitle('🏓 Pong!')
          .addFields(
            { name: '📡 Latência', value: `\`${lat}ms\``,                       inline: true },
            { name: '💓 WebSocket', value: `\`${client.ws.ping}ms\``,           inline: true },
          ),
      ],
    });
    return;
  }

  // ── ;saldo ────────────────────────────────────────────
  if (cmd === 'saldo') {
    const bal = getBalance(message.author.id);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('🏦 Bem vindo ao banco Levi')
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '\u200b', value: `**Seu saldo atual de tempestades é de:** \`${fmt(bal)}\` 🌪` },
            { name: '\u200b', value: `**Dica:** Quem ganha moeda fácil sem depender da sorte todo dia? Use \`${PREFIX}daily\`` },
          ),
      ],
    });
    return;
  }

  // ── ;daily ────────────────────────────────────────────
  if (cmd === 'daily') {
    const userId = message.author.id;
    const lastDaily = getLastDaily(userId);
    const now = Date.now();
    if (lastDaily) {
      const diff = now - new Date(lastDaily).getTime();
      const COOLDOWN = 24 * 60 * 60 * 1000;
      if (diff < COOLDOWN) {
        const rem = COOLDOWN - diff;
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        await message.reply({
          embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`⏰ Você já coletou hoje! Volte em **${h}h ${m}m**.`)],
        });
        return;
      }
    }
    const tiers = [
      { min: 5000,  max: 15000,  weight: 40 }, { min: 15001, max: 30000,  weight: 30 },
      { min: 30001, max: 50000,  weight: 18 }, { min: 50001, max: 75000,  weight: 9  },
      { min: 75001, max: 100000, weight: 3  },
    ];
    const total = tiers.reduce((a, t) => a + t.weight, 0);
    let roll = Math.random() * total; let tier = tiers[0];
    for (const t of tiers) { if (roll < t.weight) { tier = t; break; } roll -= t.weight; }
    const gained = Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
    const newBal = addBalance(userId, gained);
    setLastDaily(userId);
    const rarity = tier.min >= 75001 ? '🌟 ULTRA RARO!' : tier.min >= 50001 ? '💎 Raro!' : tier.min >= 30001 ? '✨ Incomum' : '🌪 Comum';
    await message.reply({
      embeds: [
        new EmbedBuilder().setColor(COLOR).setTitle('📅 Daily Coletado!')
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setDescription(`Você conseguiu **${fmt(gained)}** Tempestades! ${rarity}`)
          .addFields({ name: '💰 Saldo total', value: `\`${fmt(newBal)}\` 🌪` }),
      ],
    });
    return;
  }

  // ── ;apostar ──────────────────────────────────────────
  if (cmd === 'apostar') {
    const valor  = parseInt(args[0]);
    const chance = parseInt(args[1]) || 50;
    const userId = message.author.id;
    if (!valor || valor < 1 || isNaN(valor)) {
      await message.reply(`❌ Use: \`${PREFIX}apostar <valor> [chance%]\`\nEx: \`${PREFIX}apostar 500 40\``);
      return;
    }
    const bal = getBalance(userId);
    if (bal < valor) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`❌ Saldo insuficiente! Você tem **${fmt(bal)}** 🌪`)] });
      return;
    }
    const pct = Math.max(10, Math.min(90, chance));
    function calcMulti(c) {
      if (c <= 50) return 2 + Math.floor((50 - c) / 10);
      const above = Math.floor((c - 50) / 10);
      return Math.max(1.1, 2 - above * 0.5);
    }
    const multi = calcMulti(pct);
    const win   = Math.random() * 100 < pct;
    if (win) {
      const prize = Math.floor(valor * multi);
      const newBal = addBalance(userId, prize - valor);
      await message.reply({ embeds: [new EmbedBuilder().setColor('#23a55a').setTitle('🎲 Você ganhou!')
        .setDescription(`Apostou **${fmt(valor)}** com **${pct}%** de chance (${multi}x)\nGanhou **+${fmt(prize - valor)}** Tempestades!`)
        .addFields({ name: '💰 Novo saldo', value: `\`${fmt(newBal)}\` 🌪` })] });
    } else {
      const newBal = addBalance(userId, -valor);
      await message.reply({ embeds: [new EmbedBuilder().setColor('#ed4245').setTitle('🎲 Você perdeu...')
        .setDescription(`Apostou **${fmt(valor)}** com **${pct}%** de chance\nPerdeu **-${fmt(valor)}** Tempestades.`)
        .addFields({ name: '💰 Novo saldo', value: `\`${fmt(newBal)}\` 🌪` })] });
    }
    return;
  }

  // ── ;ban ──────────────────────────────────────────────
  if (cmd === 'ban') {
    if (!hasStaff(message.member)) { await message.reply('❌ Você não tem permissão!'); return; }
    const target = message.mentions.users.first();
    if (!target) { await message.reply(`❌ Mencione um usuário! Ex: \`${PREFIX}ban @usuario motivo\``); return; }
    const reason = args.slice(1).join(' ') || 'Nenhum motivo informado';
    try {
      await message.guild.members.ban(target, { reason });
      await message.reply({ embeds: [new EmbedBuilder().setColor('#ed4245').setTitle('🔨 Banido')
        .addFields({ name: 'Usuário', value: target.tag, inline: true }, { name: 'Motivo', value: reason, inline: true })] });
    } catch { await message.reply('❌ Não foi possível banir.'); }
    return;
  }

  // ── ;mutar ────────────────────────────────────────────
  if (cmd === 'mutar') {
    if (!hasStaff(message.member)) { await message.reply('❌ Você não tem permissão!'); return; }
    const target     = message.mentions.members.first();
    const duracaoStr = args[1];
    if (!target)     { await message.reply(`❌ Mencione um membro! Ex: \`${PREFIX}mutar @usuario 10m\``); return; }
    if (!duracaoStr) { await message.reply('❌ Informe a duração! Ex: `10s`, `5m`, `2h`, `1ms`, `1n`'); return; }
    const secs = parseDuration(duracaoStr);
    if (!secs)        { await message.reply('❌ Duração inválida! Use: s, m, h, ms, n. Ex: `10m`, `2h`'); return; }
    if (secs > 28 * 24 * 3600) { await message.reply('❌ Duração máxima é 28 dias.'); return; }
    try {
      await target.timeout(secs * 1000);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🔇 Mutado')
        .addFields({ name: 'Usuário', value: target.user.tag, inline: true }, { name: 'Duração', value: durationLabel(duracaoStr), inline: true })] });
    } catch { await message.reply('❌ Não foi possível mutar.'); }
    return;
  }

  // ── ;desmutar ─────────────────────────────────────────
  if (cmd === 'desmutar') {
    if (!hasStaff(message.member)) { await message.reply('❌ Você não tem permissão!'); return; }
    const target = message.mentions.members.first();
    if (!target) { await message.reply(`❌ Mencione um membro! Ex: \`${PREFIX}desmutar @usuario\``); return; }
    if (!target.communicationDisabledUntil || new Date(target.communicationDisabledUntil) < new Date()) {
      await message.reply(`❌ **Erro** — ${target.user.tag} não está mutado.`);
      return;
    }
    try {
      await target.timeout(null);
      await message.reply({ embeds: [new EmbedBuilder().setColor('#23a55a').setTitle('🔊 Desmutado')
        .setDescription(`${target.user.tag} foi desmutado.`)] });
    } catch { await message.reply('❌ Não foi possível desmutar.'); }
    return;
  }

  // ── ;expulsar ─────────────────────────────────────────
  if (cmd === 'expulsar') {
    if (!hasStaff(message.member)) { await message.reply('❌ Você não tem permissão!'); return; }
    const target = message.mentions.members.first();
    if (!target) { await message.reply(`❌ Mencione um membro! Ex: \`${PREFIX}expulsar @usuario\``); return; }
    const reason = args.slice(1).join(' ') || 'Nenhum motivo informado';
    try {
      await target.kick(reason);
      await message.reply({ embeds: [new EmbedBuilder().setColor('#f0a30a').setTitle('👢 Expulso')
        .addFields({ name: 'Usuário', value: target.user.tag, inline: true }, { name: 'Motivo', value: reason, inline: true })] });
    } catch { await message.reply('❌ Não foi possível expulsar.'); }
    return;
  }

  // ── ;slowmode ─────────────────────────────────────────
  if (cmd === 'slowmode') {
    if (!hasStaff(message.member)) { await message.reply('❌ Você não tem permissão!'); return; }
    const duracaoStr = args[0];
    const ativo      = args[1]?.toLowerCase();
    if (!duracaoStr && !ativo) {
      await message.reply('❌ **Erro** — Por favor faça alguma alteração!\nUso: `;slowmode [duração] [yes/no]`');
      return;
    }
    let newRate = message.channel.rateLimitPerUser;
    if (ativo === 'no') { newRate = 0; }
    else if (duracaoStr) {
      const secs = parseDuration(duracaoStr);
      if (!secs) { await message.reply('❌ Duração inválida! Use s, m, h, ms, n. Ex: `10s`, `5m`'); return; }
      newRate = Math.min(secs, 21600);
    }
    try {
      await message.channel.setRateLimitPerUser(newRate);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('⏳ Slow Mode Atualizado')
        .addFields({ name: 'Delay', value: newRate === 0 ? 'Desativado' : `${newRate}s`, inline: true })] });
    } catch { await message.reply('❌ Não foi possível alterar o slow mode.'); }
    return;
  }
});

// ─── Iniciar ──────────────────────────────────────────────
client.login(process.env.TOKEN);
