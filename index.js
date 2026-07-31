// ═══════════════════════════════════════════════════════════
//  Painel Levi — index.js  v2
// ═══════════════════════════════════════════════════════════

// ── Comandos do bot ──────────────────────────────────────
const BOT_COMMANDS = [
  { id:'ping',     name:'ping',     prefix:true,  slash:true,  cat:'Utilidade',    icon:'🏓', desc:'Mostra o ping atual do bot e responde com 🏓 Pong.' },
  { id:'saldo',    name:'saldo',    prefix:true,  slash:true,  cat:'Economia',     icon:'💰', desc:'Mostra seu saldo atual de Tempestades no banco Levi.' },
  { id:'daily',    name:'daily',    prefix:true,  slash:true,  cat:'Economia',     icon:'📅', desc:'Coleta sua recompensa diária (5.000 a 100.000 Tempestades). Quanto maior, mais rara!' },
  { id:'apostar',  name:'apostar',  prefix:true,  slash:true,  cat:'Economia',     icon:'🎲', desc:'Aposta Tempestades com chance configurável. Padrão 50/50 — quanto menor a chance, maior o multiplicador.' },
  { id:'ban',      name:'ban',      prefix:true,  slash:true,  cat:'Moderação',    icon:'🔨', desc:'Bane um membro permanentemente do servidor. Requer permissão de Staff.' },
  { id:'mutar',    name:'mutar',    prefix:true,  slash:true,  cat:'Moderação',    icon:'🔇', desc:'Silencia um membro por um período (s=segundos, m=minutos, h=horas, ms=semanas, n=anos). Ex: 10m, 2h, 1ms.' },
  { id:'desmutar', name:'desmutar', prefix:true,  slash:true,  cat:'Moderação',    icon:'🔊', desc:'Remove o silêncio de um membro. Avisa se o membro não estiver mutado.' },
  { id:'expulsar', name:'expulsar', prefix:true,  slash:true,  cat:'Moderação',    icon:'👢', desc:'Expulsa um membro do servidor. Requer permissão de Staff.' },
  { id:'slowmode', name:'slowmode', prefix:true,  slash:true,  cat:'Moderação',    icon:'⏳', desc:'Edita o slow mode de um canal (s, m, h, ms, n). Pode ser ativado ou desativado. Requer Staff.' },
  { id:'suporte',  name:'suporte',  prefix:true,  slash:false, cat:'Servidor',     icon:'🎫', desc:'Envia o painel de suporte com menu de tickets.' },
  { id:'re',       name:'re',       prefix:true,  slash:false, cat:'Servidor',     icon:'📜', desc:'Envia as regras do servidor de forma estilizada.' },
  { id:'config',   name:'config',   prefix:true,  slash:false, cat:'Configuração', icon:'⚙️', desc:'Abre o painel de configuração do bot (apenas no servidor).' },
];

// ── Estado global ─────────────────────────────────────────
const S = {
  prefix: localStorage.getItem('botPrefix') || ';',
  cmdStates: JSON.parse(localStorage.getItem('cmdStates') || '{}'),
  apiUrl: localStorage.getItem('apiUrl') || '',
  welcomeChannel: localStorage.getItem('welcomeChannel') || '',
  welcomeTitle: localStorage.getItem('welcomeTitle') || '',
  welcomeMsg: localStorage.getItem('welcomeMsg') || '',
  welcomeImg: localStorage.getItem('welcomeImg') || '',
  botEnabled: true,
  dirty: false,
  currentSection: null,
  pendingSave: {},
};

function getApi() { return localStorage.getItem('apiUrl') || ''; }
function isCmdEnabled(id) { return S.cmdStates[id] !== false; }

// ── Toast ─────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3000);
}

// ── Save notice ───────────────────────────────────────────
function showNotice(msg, color) {
  const el = document.getElementById('saveNotice');
  el.textContent = msg;
  el.className = `save-notice ${color} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ══════════════════════════════════════════════════════════
//  LANDING + SIDEBAR
// ══════════════════════════════════════════════════════════
function initNav() {
  const ham = document.getElementById('hamBtn');
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  const landing = document.getElementById('landing');

  function openSidebar() {
    sb.classList.add('open');
    ov.classList.add('show');
    ham.classList.add('open');
    landing.classList.add('hidden');
  }

  function closeSidebar() {
    sb.classList.remove('open');
    ov.classList.remove('show');
    ham.classList.remove('open');
  }

  ham.addEventListener('click', () => {
    if (sb.classList.contains('open')) closeSidebar();
    else openSidebar();
  });

  ov.addEventListener('click', closeSidebar);

  document.querySelectorAll('.sb-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.section);
      closeSidebar();
    });
  });
}

function navigateTo(sec) {
  S.currentSection = sec;
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const active = document.querySelector(`.sb-item[data-section="${sec}"]`);
  if (active) active.classList.add('active');

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`section-${sec}`);
  if (el) el.classList.add('active');

  // Section-specific init
  if (sec === 'comandos') renderComandos();
  if (sec === 'gatilho') initGatilho();
  if (sec === 'togglecmds') renderToggleList();
  if (sec === 'entrada') initEntrada();
  if (sec === 'botonoff') initBotOnOff();
}

// ══════════════════════════════════════════════════════════
//  SECTION: COMANDOS
// ══════════════════════════════════════════════════════════
let activeCat = 'Todos';

function renderComandos() {
  // Filter bar
  const cats = ['Todos', ...new Set(BOT_COMMANDS.map(c => c.cat))];
  const fb = document.getElementById('cmdFilterBar');
  if (!fb.hasChildNodes()) {
    fb.innerHTML = cats.map(c =>
      `<button class="cmd-filter-btn${c === activeCat ? ' active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
    fb.querySelectorAll('.cmd-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCat = btn.dataset.cat;
        fb.querySelectorAll('.cmd-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCmdGrid();
      });
    });
  }
  renderCmdGrid();
}

function renderCmdGrid() {
  const grid = document.getElementById('cmdGrid');
  const pfx = S.prefix;
  const filtered = activeCat === 'Todos' ? BOT_COMMANDS : BOT_COMMANDS.filter(c => c.cat === activeCat);
  grid.innerHTML = filtered.map(c => {
    const enabled = isCmdEnabled(c.id);
    return `
    <div class="cmd-embed" style="${enabled ? '' : 'opacity:.45;border-left-color:var(--muted2)'}">
      <div class="cmd-embed-name">${c.icon} ${c.name}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
        ${c.prefix ? `<span class="cmd-embed-prefix">${pfx}${c.name}</span>` : ''}
        ${c.slash  ? `<span class="cmd-embed-prefix" style="color:var(--accent)">/</span><span class="cmd-embed-prefix" style="color:var(--accent)">/${c.name}</span>` : ''}
      </div>
      <div class="cmd-embed-desc">${c.desc}</div>
      <div class="cmd-embed-cat">${c.cat} ${enabled ? '· <span style="color:var(--green)">Ativo</span>' : '· <span style="color:var(--red)">Inativo</span>'}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  SECTION: GATILHO
// ══════════════════════════════════════════════════════════
function initGatilho() {
  const input = document.getElementById('prefixInput');
  if (!input) return;
  input.value = S.prefix;
  syncPrefixExample();

  input.addEventListener('input', () => {
    if (!input.value) return;
    S.pendingSave.prefix = input.value;
    syncPrefixExample(input.value);
    markDirty();
  });
}

function syncPrefixExample(pfx) {
  const p = pfx || document.getElementById('prefixInput')?.value || S.prefix;
  document.getElementById('prefixBadge').textContent = p;
  ['exPrefix','exPrefix2','exPrefix3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = p;
  });
}

// ══════════════════════════════════════════════════════════
//  SECTION: TOGGLE COMMANDS
// ══════════════════════════════════════════════════════════
function renderToggleList() {
  const list = document.getElementById('toggleList');
  list.innerHTML = BOT_COMMANDS.map(c => {
    const on = isCmdEnabled(c.id);
    return `
    <div class="toggle-item">
      <div class="toggle-item-icon">${c.icon}</div>
      <div class="toggle-item-name">
        ${c.name}
        <small>${c.cat} · ${on ? 'Ativo' : 'Inativo'}</small>
      </div>
      <button class="ti-switch ${on ? 'on' : ''}" data-cmd="${c.id}" aria-label="Toggle ${c.name}"></button>
    </div>`;
  }).join('');

  list.querySelectorAll('.ti-switch').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cmd;
      const cur = isCmdEnabled(id);
      S.cmdStates[id] = !cur;
      localStorage.setItem('cmdStates', JSON.stringify(S.cmdStates));
      btn.className = `ti-switch ${!cur ? 'on' : ''}`;
      const nameEl = btn.closest('.toggle-item').querySelector('small');
      const cmd = BOT_COMMANDS.find(c => c.id === id);
      if (nameEl && cmd) nameEl.textContent = `${cmd.cat} · ${!cur ? 'Ativo' : 'Inativo'}`;
      markDirty();
      S.pendingSave.cmdStates = S.cmdStates;
      syncCommandsApi(id, !cur);
      toast(`${cmd?.icon} ${!cur ? 'Ativado' : 'Desativado'}: ${cmd?.name}`, !cur ? 'ok' : 'warn');
    });
  });
}

async function syncCommandsApi(id, enabled) {
  const api = getApi();
  if (!api) return;
  try {
    await fetch(api + '/bot/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: id, enabled }),
    });
  } catch {}
}

// ══════════════════════════════════════════════════════════
//  SECTION: ENTRADA
// ══════════════════════════════════════════════════════════
let selectedChannel = localStorage.getItem('welcomeChannel') || '';

async function initEntrada() {
  // Load saved values
  const wt = document.getElementById('wTitle');
  const wm = document.getElementById('wMsg');
  const wi = document.getElementById('wImg');
  if (wt) wt.value = localStorage.getItem('welcomeTitle') || '';
  if (wm) wm.value = localStorage.getItem('welcomeMsg') || '';
  if (wi) wi.value = localStorage.getItem('welcomeImg') || '';

  [wt, wm, wi].forEach(el => {
    if (!el) return;
    if (!el._dirty) {
      el._dirty = true;
      el.addEventListener('input', () => {
        markDirty();
        S.pendingSave.welcome = {
          channel: selectedChannel,
          title: wt?.value,
          msg: wm?.value,
          img: wi?.value,
        };
      });
    }
  });

  // Load channels
  await loadChannels();
}

async function loadChannels() {
  const spinner = document.getElementById('chSpinner');
  const loadMsg = document.getElementById('chLoadMsg');
  const list = document.getElementById('channelList');
  const api = getApi();

  if (!api) {
    spinner.style.display = 'none';
    loadMsg.textContent = '⚠️ Configure a URL da API para ver os canais do servidor.';
    list.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(api + '/bot/channels');
    if (!res.ok) throw new Error();
    const { channels } = await res.json();
    spinner.style.display = 'none';
    loadMsg.style.display = 'none';

    list.innerHTML = channels.map(ch => `
      <div class="ch-item ${selectedChannel === ch.id ? 'selected' : ''}" data-id="${ch.id}" data-name="${ch.name}">
        <span class="ch-icon">#</span>
        <span class="ch-name">${ch.name}</span>
        <span class="ch-perms ${ch.canSend ? '' : 'no'}">${ch.canSend ? '✅ pode enviar' : '❌ sem permissão'}</span>
      </div>
    `).join('');

    list.querySelectorAll('.ch-item').forEach(item => {
      item.addEventListener('click', () => {
        const canSend = item.querySelector('.ch-perms').classList.contains('no') === false;
        if (!canSend) { toast('❌ O bot não tem permissão neste canal.', 'err'); return; }
        selectedChannel = item.dataset.id;
        list.querySelectorAll('.ch-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        markDirty();
        S.pendingSave.welcome = { ...S.pendingSave.welcome, channel: selectedChannel };
      });
    });
  } catch {
    spinner.style.display = 'none';
    loadMsg.textContent = '❌ Não foi possível carregar os canais (API offline?).';
  }
}

// ══════════════════════════════════════════════════════════
//  SECTION: BOT OFF/ON
// ══════════════════════════════════════════════════════════
function initBotOnOff() {
  const btn = document.getElementById('bigToggle');
  const apiInput = document.getElementById('apiUrlInput');
  if (apiInput) apiInput.value = getApi();

  applyBotToggleUi(S.botEnabled);
  if (btn && !btn._init) {
    btn._init = true;
    btn.addEventListener('click', handleBotToggle);
  }
  if (apiInput && !apiInput._init) {
    apiInput._init = true;
    apiInput.addEventListener('input', () => {
      localStorage.setItem('apiUrl', apiInput.value);
      S.pendingSave.apiUrl = apiInput.value;
      markDirty();
    });
  }
}

function applyBotToggleUi(enabled) {
  const btn = document.getElementById('bigToggle');
  const lbl = document.getElementById('bigStatusLabel');
  const sub = document.getElementById('bigStatusSub');
  if (!btn) return;
  btn.className = `big-toggle ${enabled ? 'on' : ''}`;
  if (lbl) lbl.textContent = enabled ? 'Bot Ativado' : 'Bot Desativado';
  if (sub) sub.textContent = enabled ? 'O bot está conectado ao Discord' : 'O bot foi desconectado do Discord';
}

async function handleBotToggle() {
  const api = getApi();
  const btn = document.getElementById('bigToggle');
  if (!api) { document.getElementById('botErrMsg').style.display = 'block'; return; }
  document.getElementById('botErrMsg').style.display = 'none';
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(api + '/bot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !S.botEnabled }),
    });
    if (res.ok) {
      const data = await res.json();
      S.botEnabled = data.enabled;
      applyBotToggleUi(S.botEnabled);
      toast(S.botEnabled ? '✅ Bot ativado!' : '🔌 Bot desativado.', S.botEnabled ? 'ok' : 'warn');
    } else throw new Error();
  } catch {
    toast('❌ Não foi possível conectar à API', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════
//  BOT STATUS POLLING
// ══════════════════════════════════════════════════════════
async function fetchBotStatus() {
  const api = getApi();
  if (!api) return;
  try {
    const res = await fetch(api + '/bot/status');
    if (!res.ok) return;
    const data = await res.json();
    S.botEnabled = data.enabled;
    applyBotToggleUi(data.enabled);
  } catch {}
}

// ══════════════════════════════════════════════════════════
//  SAVE / RESET / DIRTY
// ══════════════════════════════════════════════════════════
function markDirty() {
  if (S.dirty) return;
  S.dirty = true;
  document.getElementById('saveBar').classList.add('show');
}

function clearDirty() {
  S.dirty = false;
  S.pendingSave = {};
  document.getElementById('saveBar').classList.remove('show');
}

async function saveAll() {
  const p = S.pendingSave;

  // Prefix
  if (p.prefix) {
    S.prefix = p.prefix;
    localStorage.setItem('botPrefix', p.prefix);
    syncPrefixExample(p.prefix);
    renderCmdGrid();
  }

  // Command states
  if (p.cmdStates) {
    localStorage.setItem('cmdStates', JSON.stringify(p.cmdStates));
  }

  // Welcome config
  if (p.welcome) {
    const w = p.welcome;
    if (w.channel) localStorage.setItem('welcomeChannel', w.channel);
    if (w.title !== undefined) localStorage.setItem('welcomeTitle', w.title);
    if (w.msg !== undefined) localStorage.setItem('welcomeMsg', w.msg);
    if (w.img !== undefined) localStorage.setItem('welcomeImg', w.img);
  }

  // API URL
  if (p.apiUrl !== undefined) {
    localStorage.setItem('apiUrl', p.apiUrl);
  }

  // Push to API
  const api = getApi();
  if (api && (p.welcome || p.prefix)) {
    try {
      await fetch(api + '/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: S.prefix,
          welcomeChannel: localStorage.getItem('welcomeChannel'),
          welcomeTitle: localStorage.getItem('welcomeTitle'),
          welcomeMsg: localStorage.getItem('welcomeMsg'),
          welcomeImg: localStorage.getItem('welcomeImg'),
        }),
      });
    } catch {}
  }

  clearDirty();
  showNotice('✅ Alterações salvas!', 'green');
}

function resetAll() {
  S.pendingSave = {};

  // Revert prefix input
  const pi = document.getElementById('prefixInput');
  if (pi) { pi.value = S.prefix; syncPrefixExample(S.prefix); }

  // Revert welcome inputs
  const wt = document.getElementById('wTitle');
  const wm = document.getElementById('wMsg');
  const wi = document.getElementById('wImg');
  if (wt) wt.value = localStorage.getItem('welcomeTitle') || '';
  if (wm) wm.value = localStorage.getItem('welcomeMsg') || '';
  if (wi) wi.value = localStorage.getItem('welcomeImg') || '';

  // Revert cmd states in UI
  S.cmdStates = JSON.parse(localStorage.getItem('cmdStates') || '{}');
  renderToggleList();

  clearDirty();
  showNotice('❌ Alterações redefinidas!', 'red');
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initNav();

  document.getElementById('saveBtn').addEventListener('click', saveAll);
  document.getElementById('resetBtn').addEventListener('click', resetAll);

  fetchBotStatus();
  setInterval(fetchBotStatus, 6000);
});
