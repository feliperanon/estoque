/**
 * app.js — Controle de SPA do sistema Estoque.
 * Gerencia alternância entre tela de login e dashboard,
 * autenticação via API e persistência de sessão no localStorage.
 * Inclui modo de contagem offline-first com sincronizacao posterior.
 */

const API_LOGIN  = '/api/auth/login-legacy';
const API_SYNC_COUNTS = '/api/audit/count-events';
const TOKEN_KEY  = 'estoque_token';
const USER_KEY   = 'estoque_user';
const COUNT_EVENTS_KEY = 'estoque_count_events_v1';
const DEVICE_NAME_KEY = 'estoque_device_name_v1';

// ── Elementos ──────────────────────────────────────────────────
const viewLogin     = document.getElementById('view-login');
const viewDashboard = document.getElementById('view-dashboard');
const loginForm     = document.getElementById('login-form');
const loginError    = document.getElementById('login-error');
const btnLogin      = document.getElementById('btn-login');
const btnSpinner    = document.getElementById('btn-spinner');
const btnLogout     = document.getElementById('btn-logout');
const userDisplay   = document.getElementById('user-display');
const netStatus     = document.getElementById('net-status');
const countForm     = document.getElementById('count-form');
const countFeedback = document.getElementById('count-feedback');
const totalsList    = document.getElementById('totals-list');
const totalItems    = document.getElementById('total-items');
const pendingList   = document.getElementById('pending-list');
const pendingCount  = document.getElementById('pending-count');
const btnSync       = document.getElementById('btn-sync');
const btnExport     = document.getElementById('btn-export');
const importFile    = document.getElementById('import-file');

let syncInProgress = false;

// ── Troca de views ─────────────────────────────────────────────
function showLogin() {
  viewDashboard.style.display = 'none';
  viewLogin.style.display     = 'flex';
  document.getElementById('username').focus();
}

function showDashboard() {
  viewLogin.style.display     = 'none';
  viewDashboard.style.display = 'block';
}

// ── Sessão ─────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function loadCountEvents() {
  try {
    const raw = localStorage.getItem(COUNT_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCountEvents(events) {
  localStorage.setItem(COUNT_EVENTS_KEY, JSON.stringify(events));
}

function getDeviceName() {
  let value = localStorage.getItem(DEVICE_NAME_KEY);
  if (value) return value;

  value = `device-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_NAME_KEY, value);
  return value;
}

function makeEventId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeItemCode(value) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function formatDateTime(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return date.toLocaleString('pt-BR');
}

function setFeedback(message, isError = false) {
  countFeedback.textContent = message;
  countFeedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  netStatus.textContent = online ? 'ONLINE' : 'OFFLINE';
  netStatus.style.background = online ? 'rgba(64, 179, 120, 0.28)' : 'rgba(217, 76, 76, 0.28)';
}

function computeTotals(events) {
  const totals = new Map();

  for (const event of events) {
    const current = totals.get(event.item_code) || 0;
    totals.set(event.item_code, current + event.quantity);
  }

  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([itemCode, qty]) => ({ itemCode, qty }));
}

function renderCounts() {
  const events = loadCountEvents();
  const totals = computeTotals(events);
  const pending = events.filter((event) => !event.synced);

  totalsList.innerHTML = '';
  pendingList.innerHTML = '';

  if (totals.length === 0) {
    totalsList.innerHTML = '<li><span>Nenhuma contagem registrada ainda.</span><strong>0</strong></li>';
  } else {
    for (const row of totals) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${row.itemCode}</span><strong>${row.qty}</strong>`;
      totalsList.appendChild(li);
    }
  }

  if (pending.length === 0) {
    pendingList.innerHTML = '<li><span>Sem pendencias para envio.</span><strong>OK</strong></li>';
  } else {
    const toRender = [...pending].sort((a, b) => b.observed_at.localeCompare(a.observed_at)).slice(0, 100);
    for (const event of toRender) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${event.item_code} x ${event.quantity}</span><strong>${formatDateTime(event.observed_at)}</strong>`;
      pendingList.appendChild(li);
    }
  }

  totalItems.textContent = `${totals.length} itens`;
  pendingCount.textContent = `${pending.length} pendentes`;
}

async function syncPendingEvents() {
  if (syncInProgress) return;

  const token = getToken();
  if (!token) return;
  if (!navigator.onLine) return;

  const events = loadCountEvents();
  const pending = events.filter((event) => !event.synced);
  if (pending.length === 0) return;

  syncInProgress = true;
  btnSync.disabled = true;

  try {
    const response = await fetch(API_SYNC_COUNTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        events: pending.map((event) => ({
          client_event_id: event.client_event_id,
          item_code: event.item_code,
          quantity: event.quantity,
          observed_at: event.observed_at,
          device_name: event.device_name,
        })),
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        setFeedback('Sessao expirada. Continue contando offline e faca login depois para sincronizar.', true);
      } else {
        setFeedback('Falha ao sincronizar agora. Seus dados continuam salvos localmente.', true);
      }
      return;
    }

    const data = await response.json();
    const syncedIds = new Set(data.synced_ids || []);
    const updated = events.map((event) => {
      if (syncedIds.has(event.client_event_id)) {
        return { ...event, synced: true, synced_at: new Date().toISOString() };
      }
      return event;
    });

    saveCountEvents(updated);
    renderCounts();
    setFeedback(`Sincronizacao concluida: ${syncedIds.size} evento(s) enviado(s).`);
  } catch {
    setFeedback('Sem conexao no momento. Contagem continua segura neste dispositivo.', true);
  } finally {
    syncInProgress = false;
    btnSync.disabled = false;
  }
}

function registerCount(itemCodeInput, qtyInput) {
  const itemCode = normalizeItemCode(itemCodeInput);
  const quantity = Number(qtyInput);

  if (!itemCode) {
    setFeedback('Informe o item para registrar.', true);
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    setFeedback('Informe uma quantidade inteira maior que zero.', true);
    return;
  }

  const events = loadCountEvents();
  const event = {
    client_event_id: makeEventId(),
    item_code: itemCode,
    quantity,
    observed_at: new Date().toISOString(),
    synced: false,
    device_name: getDeviceName(),
  };

  events.push(event);
  saveCountEvents(events);
  renderCounts();
  setFeedback(`Contagem salva no dispositivo: ${itemCode} (+${quantity}).`);

  if (navigator.onLine) {
    syncPendingEvents();
  }
}

function exportBackup() {
  const events = loadCountEvents();
  const payload = {
    exported_at: new Date().toISOString(),
    device_name: getDeviceName(),
    events,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estoque-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const incoming = Array.isArray(data.events) ? data.events : [];
    const current = loadCountEvents();
    const knownIds = new Set(current.map((event) => event.client_event_id));
    const merged = [...current];

    for (const event of incoming) {
      if (!event || typeof event !== 'object') continue;
      if (!event.client_event_id || knownIds.has(event.client_event_id)) continue;
      if (!event.item_code || !Number.isInteger(event.quantity) || event.quantity <= 0) continue;
      merged.push({
        client_event_id: String(event.client_event_id),
        item_code: normalizeItemCode(String(event.item_code)),
        quantity: Number(event.quantity),
        observed_at: event.observed_at || new Date().toISOString(),
        synced: Boolean(event.synced),
        device_name: event.device_name || getDeviceName(),
        synced_at: event.synced_at || null,
      });
      knownIds.add(event.client_event_id);
    }

    saveCountEvents(merged);
    renderCounts();
    setFeedback('Backup importado com sucesso.');
  } catch {
    setFeedback('Arquivo de backup invalido.', true);
  }
}

function bindCountEvents() {
  if (!countForm) return;

  countForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const itemCode = document.getElementById('item-code').value;
    const qty = document.getElementById('item-qty').value;
    registerCount(itemCode, qty);
    document.getElementById('item-code').value = '';
    document.getElementById('item-qty').value = '1';
    document.getElementById('item-code').focus();
  });

  btnSync.addEventListener('click', () => {
    syncPendingEvents();
  });

  btnExport.addEventListener('click', () => {
    exportBackup();
  });

  importFile.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importBackup(file);
    event.target.value = '';
  });

  window.addEventListener('online', () => {
    updateNetworkStatus();
    syncPendingEvents();
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();
    setFeedback('Modo offline ativo. Continue contando normalmente.');
  });
}

// ── Login ───────────────────────────────────────────────────────
function setLoading(on) {
  btnLogin.disabled        = on;
  btnLogin.querySelector('.btn-label').style.display  = on ? 'none' : 'inline';
  btnSpinner.style.display = on ? 'inline-block' : 'none';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

  if (!username || !password) {
    loginError.textContent = 'Preencha e-mail e senha.';
    return;
  }

  if (!looksLikeEmail) {
    loginError.textContent = 'Informe um e-mail corporativo válido.';
    return;
  }

  setLoading(true);

  try {
    const resp = await fetch(API_LOGIN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      loginError.textContent = err.detail || 'E-mail ou senha incorretos.';
      return;
    }

    const data = await resp.json();
    saveSession(data.access_token, data.user);
    initDashboard(data.user);

  } catch {
    loginError.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
  } finally {
    setLoading(false);
  }
});

// ── Dashboard ───────────────────────────────────────────────────
function initDashboard(user) {
  const label = user?.name || user?.email || user?.username || 'Usuário';
  userDisplay.textContent = label;
  updateNetworkStatus();
  renderCounts();
  syncPendingEvents();
  showDashboard();
}

// ── Logout ──────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => {
  clearSession();
  loginForm.reset();
  showLogin();
});

// ── Inicialização ───────────────────────────────────────────────
(function init() {
  bindCountEvents();
  const token = getToken();
  const user  = getUser();

  if (token && user) {
    initDashboard(user);
  } else {
    showLogin();
  }
})();
