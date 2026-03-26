/**
 * app.js — Controle de SPA do sistema Estoque.
 * Gerencia alternância entre tela de login e dashboard,
 * autenticação via API e persistência de sessão no localStorage.
 * Inclui modo de contagem offline-first com sincronizacao posterior.
 */

const API_LOGIN  = '/api/auth/login-legacy';
const API_SYNC_COUNTS = '/api/audit/count-events';
const API_PRODUCTS = '/api/products';
const API_PRODUCTS_IMPORT_EXCEL = '/api/products/import-excel';
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
const productForm = document.getElementById('product-form');
const productFeedback = document.getElementById('product-feedback');
const productExcelFile = document.getElementById('product-excel-file');
const btnProductUpload = document.getElementById('btn-product-upload');
const productImportFeedback = document.getElementById('product-import-feedback');
const productsList = document.getElementById('products-list');
const productsTotal = document.getElementById('products-total');
const roleDisplay = document.getElementById('role-display');
const moduleNav = document.getElementById('module-nav');
const accessMatrixList = document.getElementById('access-matrix-list');

let syncInProgress = false;
let selectedProductFile = null;
let currentRole = 'conferente';

const MODULE_ACCESS = {
  count: ['conferente', 'administrativo', 'admin'],
  cadastro: ['administrativo', 'admin'],
  acesso: ['administrativo', 'admin'],
};

const ACCESS_CATEGORIES = [
  {
    category: 'Operacao',
    subcategories: [
      { module: 'Contagem', roles: ['conferente', 'administrativo', 'admin'] },
    ],
  },
  {
    category: 'Cadastro',
    subcategories: [
      { module: 'Cadastro de produtos', roles: ['administrativo', 'admin'] },
      { module: 'Importacao de produtos', roles: ['administrativo', 'admin'] },
    ],
  },
  {
    category: 'Governanca',
    subcategories: [
      { module: 'Matriz de acessos', roles: ['administrativo', 'admin'] },
    ],
  },
];

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

function normalizeRole(role) {
  return (role || '').trim().toLowerCase();
}

function canAccessModule(moduleKey) {
  const allowed = MODULE_ACCESS[moduleKey] || [];
  return allowed.includes(currentRole);
}

function setActiveModule(moduleKey) {
  document.querySelectorAll('.module-section').forEach((section) => {
    section.classList.remove('active');
  });

  const target = document.getElementById(`module-${moduleKey}`);
  if (target) {
    target.classList.add('active');
  }

  document.querySelectorAll('.module-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.module === moduleKey);
  });
}

function renderModuleNav() {
  const buttons = moduleNav.querySelectorAll('.module-btn');
  let firstVisible = null;

  buttons.forEach((btn) => {
    const moduleKey = btn.dataset.module;
    const visible = canAccessModule(moduleKey);
    btn.style.display = visible ? 'inline-flex' : 'none';
    if (visible && !firstVisible) {
      firstVisible = moduleKey;
    }
  });

  if (firstVisible) {
    setActiveModule(firstVisible);
  }
}

function renderAccessMatrix() {
  accessMatrixList.innerHTML = '';

  ACCESS_CATEGORIES.forEach((item) => {
    const categoryLi = document.createElement('li');
    categoryLi.innerHTML = `<span><strong>${item.category}</strong></span><strong>Categoria</strong>`;
    accessMatrixList.appendChild(categoryLi);

    item.subcategories.forEach((sub) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${sub.module}</span><strong>${sub.roles.join(', ')}</strong>`;
      accessMatrixList.appendChild(li);
    });
  });
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

function setProductFeedback(message, isError = false) {
  productFeedback.textContent = message;
  productFeedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function setProductImportFeedback(message, isError = false) {
  productImportFeedback.textContent = message;
  productImportFeedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
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

function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function readProductPayloadFromForm() {
  return {
    cod_grup_sp: document.getElementById('prod-cod-sp').value.trim() || null,
    cod_grup_cia: document.getElementById('prod-cod-cia').value.trim() || null,
    cod_grup_tipo: document.getElementById('prod-cod-tipo').value.trim() || null,
    cod_grup_familia: document.getElementById('prod-cod-familia').value.trim() || null,
    cod_grup_segmento: document.getElementById('prod-cod-segmento').value.trim() || null,
    cod_grup_marca: document.getElementById('prod-cod-marca').value.trim() || null,
    cod_grup_descricao: document.getElementById('prod-descricao').value.trim(),
    cod_grup_sku: document.getElementById('prod-sku').value.trim(),
    status: document.getElementById('prod-status').value.trim() || null,
    grup_prioridade: document.getElementById('prod-prioridade').value.trim() || null,
    source_system: 'manual',
  };
}

function renderProducts(products) {
  productsList.innerHTML = '';
  if (!products.length) {
    productsList.innerHTML = '<li><span>Nenhum produto cadastrado ainda.</span><strong>0</strong></li>';
    productsTotal.textContent = '0 produtos';
    return;
  }

  for (const product of products) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${product.cod_grup_sku} - ${product.cod_grup_descricao}</span><strong>${product.status || 'ativo'}</strong>`;
    productsList.appendChild(li);
  }
  productsTotal.textContent = `${products.length} produtos`;
}

async function loadProducts() {
  if (!canAccessModule('cadastro')) {
    return;
  }

  const token = getToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_PRODUCTS}?limit=300`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      setProductFeedback('Nao foi possivel carregar os produtos.', true);
      return;
    }
    const products = await response.json();
    renderProducts(products);
  } catch {
    setProductFeedback('Falha de conexao ao carregar produtos.', true);
  }
}

async function saveProductManual() {
  const payload = readProductPayloadFromForm();
  if (!payload.cod_grup_descricao || !payload.cod_grup_sku) {
    setProductFeedback('Descricao e SKU sao obrigatorios.', true);
    return;
  }

  try {
    const response = await fetch(API_PRODUCTS, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setProductFeedback(err.detail || 'Falha ao salvar produto.', true);
      return;
    }

    productForm.reset();
    setProductFeedback('Produto salvo com sucesso.');
    await loadProducts();
  } catch {
    setProductFeedback('Sem conexao para salvar agora. Tente novamente.', true);
  }
}

async function uploadProductsExcel() {
  if (!selectedProductFile) {
    setProductImportFeedback('Selecione um arquivo Excel primeiro.', true);
    return;
  }

  const token = getToken();
  const formData = new FormData();
  formData.append('file', selectedProductFile);

  try {
    const response = await fetch(API_PRODUCTS_IMPORT_EXCEL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setProductImportFeedback(err.detail || 'Falha ao importar arquivo.', true);
      return;
    }

    const data = await response.json();
    setProductImportFeedback(`Importacao concluida: ${data.created} novos, ${data.updated} atualizados, ${data.ignored} ignorados.`);
    selectedProductFile = null;
    productExcelFile.value = '';
    await loadProducts();
  } catch {
    setProductImportFeedback('Falha de conexao durante importacao.', true);
  }
}

function bindProductEvents() {
  if (!productForm) return;

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveProductManual();
  });

  productExcelFile.addEventListener('change', (event) => {
    selectedProductFile = event.target.files?.[0] || null;
    if (selectedProductFile) {
      setProductImportFeedback(`Arquivo selecionado: ${selectedProductFile.name}`);
    }
  });

  btnProductUpload.addEventListener('click', async () => {
    await uploadProductsExcel();
  });
}

function bindModuleEvents() {
  moduleNav.addEventListener('click', (event) => {
    const btn = event.target.closest('.module-btn');
    if (!btn) return;

    const moduleKey = btn.dataset.module;
    if (!canAccessModule(moduleKey)) {
      return;
    }
    setActiveModule(moduleKey);
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
  currentRole = normalizeRole(user?.role || 'conferente') || 'conferente';
  roleDisplay.textContent = `Perfil: ${currentRole}`;

  renderModuleNav();
  renderAccessMatrix();
  updateNetworkStatus();
  renderCounts();
  syncPendingEvents();
  loadProducts();
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
  bindProductEvents();
  bindModuleEvents();
  const token = getToken();
  const user  = getUser();

  if (token && user) {
    initDashboard(user);
  } else {
    showLogin();
  }
})();
