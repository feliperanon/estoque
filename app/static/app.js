/**
 * app.js — Controle de SPA do sistema Estoque.
 * Gerencia alternância entre tela de login e dashboard,
 * autenticação via API e persistência de sessão no localStorage.
 * Inclui modo de contagem offline-first com sincronizacao posterior.
 */

const RENDER_API_ORIGIN = 'https://estoque-app-hrt2.onrender.com';
const IS_LOCAL_WEB = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const API_BASE_URL_PRIMARY = IS_LOCAL_WEB ? `${window.location.origin}/api` : '/api';
const API_BASE_URL_FALLBACK = IS_LOCAL_WEB ? `${RENDER_API_ORIGIN}/api` : null;
const API_LOGIN  = '/auth/login-legacy';
const API_LOGIN_LOCAL = '/auth/login';
const API_REGISTER = '/auth/register';
const API_SYNC_COUNTS = '/audit/count-events';
const API_PRODUCTS = '/products';
const API_PRODUCTS_CATALOG = '/products/catalog';
const API_PRODUCTS_IMPORT_EXCEL = '/products/import-excel';
const APP_BASE_PATH = '/app';
const TOKEN_KEY  = 'estoque_token';
const USER_KEY   = 'estoque_user';
const COUNT_EVENTS_KEY = 'estoque_count_events_v1';
const DEVICE_NAME_KEY = 'estoque_device_name_v1';
let activeApiBasePrimary = API_BASE_URL_PRIMARY;
let activeApiBaseFallback = API_BASE_URL_FALLBACK;

async function apiFetch(path, options = {}) {
  try {
    const primaryResponse = await fetch(`${activeApiBasePrimary}${path}`, options);
    if (
      activeApiBaseFallback
      && [502, 503, 504].includes(primaryResponse.status)
    ) {
      return fetch(`${activeApiBaseFallback}${path}`, options);
    }
    return primaryResponse;
  } catch (error) {
    if (!activeApiBaseFallback) throw error;
    return fetch(`${activeApiBaseFallback}${path}`, options);
  }
}

// ── Elementos ──────────────────────────────────────────────────
const viewLogin     = document.getElementById('view-login');
const viewDashboard = document.getElementById('view-dashboard');
const loginForm     = document.getElementById('login-form');
const loginError    = document.getElementById('login-error');
const registerForm  = document.getElementById('register-form');
const registerFeedback = document.getElementById('register-feedback');
const usersList = document.getElementById('users-list');
const btnLogin      = document.getElementById('btn-login');
const btnSpinner    = document.getElementById('btn-spinner');
const btnLogout     = document.getElementById('btn-logout');
const userDisplay   = document.getElementById('user-display');
const netStatus     = document.getElementById('net-status');
const countForm     = document.getElementById('count-form');
const countFeedback = document.getElementById('count-feedback');
const countProductsStatusToggle = document.getElementById('count-products-status-toggle');
const countProductsList = document.getElementById('count-products-list');
const countProductsTotal = document.getElementById('count-products-total');
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
let countProductsCache = [];
let currentAllowedPages = [];

const PAGE_KEYS_BY_MODULE = {
  contagem: ['contagem', 'count', 'recount', 'pull', 'return', 'break', 'direct-sale', 'validity'],
  cadastro: ['cadastro', 'cadastro-produto', 'produtos', 'preco-produtos', 'parametros-produto'],
  acesso: ['acesso'],
};

const MODULE_ACCESS = {
  contagem: ['conferente', 'administrativo', 'admin'],
  cadastro: ['administrativo', 'admin'],
  acesso: ['administrativo', 'admin'],
};

const SUB_MODULES = ['count', 'recount', 'pull', 'return', 'break', 'direct-sale', 'validity'];
const CADASTRO_SUBS = ['cadastro-produto', 'produtos', 'preco-produtos', 'parametros-produto'];
const SUB_TO_PARENT = {};
SUB_MODULES.forEach(s => { SUB_TO_PARENT[s] = 'contagem'; });
CADASTRO_SUBS.forEach(s => { SUB_TO_PARENT[s] = 'cadastro'; });

const PRODUCT_DEFAULTS_KEY = 'estoque_product_defaults_v1';
const DEFAULT_PRODUCT_PARAMS = {
  cod_grup_sp: [],
  cod_grup_cia: [],
  cod_grup_tipo: [],
  cod_grup_familia: [],
  cod_grup_segmento: [],
  cod_grup_marca: [],
  cod_grup_sku: [],
  status: ['ativo', 'inativo'],
  grup_prioridade: [],
};
const PRODUCT_PARAM_LABELS = {
  cod_grup_sp: 'Cod Grup SP',
  cod_grup_cia: 'Cod Grup Cia',
  cod_grup_tipo: 'Cod Grup Tipo',
  cod_grup_familia: 'Cod Grup Familia',
  cod_grup_segmento: 'Cod Grup Segmento',
  cod_grup_marca: 'Cod Grup Marca',
  cod_grup_sku: 'SKU',
  status: 'Status',
  grup_prioridade: 'Prioridade',
};

const ACCESS_CATEGORIES = [
  {
    category: 'Operacao',
    subcategories: [
      { module: 'Contagem de Estoque', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Recontagem', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Puxada', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Devolucao', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Quebra', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Venda Direta', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Data de Vencimento', roles: ['conferente', 'administrativo', 'admin'] },
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
  if (currentRole === 'admin') return true;
  if (currentAllowedPages.length) {
    const allowedKeys = PAGE_KEYS_BY_MODULE[moduleKey] || [moduleKey];
    return allowedKeys.some((key) => currentAllowedPages.includes(key));
  }
  const allowed = MODULE_ACCESS[moduleKey] || [];
  return allowed.includes(currentRole);
}

function setActiveSub(subKey) {
  const parent = SUB_TO_PARENT[subKey];
  const parentEl = document.getElementById(`module-${parent}`);
  if (!parentEl) return;
  parentEl.querySelectorAll('.sub-section').forEach((s) => s.classList.remove('active'));

  const target = document.getElementById(`sub-${subKey}`);
  if (target) target.classList.add('active');

  if (subKey === 'produtos') {
    searchProdutos();
  } else if (subKey === 'preco-produtos') {
    searchPrecoProducts();
  } else if (subKey === 'count') {
    loadCountProducts();
  }
}

function showModuleHome(moduleKey) {
  const parentEl = document.getElementById(`module-${moduleKey}`);
  if (!parentEl) return;
  parentEl.querySelectorAll('.sub-section').forEach((s) => s.classList.remove('active'));
  const home = document.getElementById(`${moduleKey}-home`);
  if (home) home.classList.add('active');
}

function setActiveModule(moduleKey, updateHistory = true) {
  const parentKey = SUB_TO_PARENT[moduleKey];
  const actualModule = parentKey || moduleKey;
  const subKey = parentKey ? moduleKey : null;

  document.querySelectorAll('.module-section').forEach((section) => {
    section.classList.remove('active');
  });

  const target = document.getElementById(`module-${actualModule}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.module-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.module === actualModule);
  });

  if (subKey) {
    setActiveSub(subKey);
  } else if (actualModule === 'contagem' || actualModule === 'cadastro') {
    showModuleHome(actualModule);
  }

  const hashValue = subKey || actualModule;
  if (updateHistory && window.location.hash.slice(1) !== hashValue) {
    history.pushState(null, '', `${APP_BASE_PATH}#${hashValue}`);
  }
}

function canAccessHash(hashKey) {
  if (currentRole === 'admin') return true;
  if (currentAllowedPages.length) {
    return currentAllowedPages.includes(hashKey);
  }
  const parent = SUB_TO_PARENT[hashKey];
  if (parent) return canAccessModule(parent);
  return canAccessModule(hashKey);
}

function renderSubCardsAccess() {
  document.querySelectorAll('.module-card').forEach((card) => {
    const subKey = (card.dataset.sub || '').trim().toLowerCase();
    if (!subKey) return;
    const visible = canAccessHash(subKey);
    card.style.display = visible ? 'flex' : 'none';
  });
}

function getCurrentHashKey() {
  return decodeURIComponent((window.location.hash || '').replace('#', '')).trim().toLowerCase();
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
    const hashModule = getCurrentHashKey();
    if (hashModule && canAccessHash(hashModule)) {
      setActiveModule(hashModule, false);
    } else {
      setActiveModule(firstVisible);
    }
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

function handleUnauthorizedResponse(response) {
  if (response.status !== 401) return false;
  clearSession();
  loginForm.reset();
  history.replaceState(null, '', APP_BASE_PATH);
  loginError.textContent = 'Sessao expirada neste ambiente. Faca login novamente.';
  showLogin();
  return true;
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

function setRegisterFeedback(message, isError = false) {
  if (!registerFeedback) return;
  registerFeedback.textContent = message;
  registerFeedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function renderUsersList(users) {
  if (!usersList) return;
  usersList.innerHTML = '';
  if (!users.length) {
    usersList.innerHTML = '<li><span>Nenhum usuário cadastrado.</span><strong>0</strong></li>';
    return;
  }
  for (const user of users) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${user.full_name || user.username} (${user.username})</span><strong>${user.role || 'conferente'}</strong>`;
    usersList.appendChild(li);
  }
}

async function loadUsersAdminList() {
  if (!usersList || currentRole !== 'admin') return;
  const token = getToken();
  if (!token) return;
  try {
    const resp = await apiFetch('/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const users = await resp.json();
    renderUsersList(Array.isArray(users) ? users : []);
  } catch {
    // silencia para nao quebrar UX
  }
}

function renderCountProducts(products) {
  if (!countProductsList || !countProductsTotal) return;
  countProductsList.innerHTML = '';
  countProductsTotal.textContent = `${products.length}`;
  const totalsByItem = new Map(computeTotals(loadCountEvents()).map((row) => [row.itemCode, row.qty]));

  if (!products.length) {
    countProductsList.innerHTML = '<li><span>Nenhum produto encontrado para o filtro atual.</span><strong>0</strong></li>';
    return;
  }

  for (const product of products) {
    const li = document.createElement('li');
    li.className = 'count-product-item';
    const itemCode = normalizeItemCode(product.cod_produto || product.cod_grup_sku || product.cod_grup_descricao || '');
    const itemTotal = itemCode ? (totalsByItem.get(itemCode) || 0) : 0;
    const codeText = (product.cod_produto || product.cod_grup_sku || '—').trim() || '—';
    const descText = (product.cod_grup_descricao || 'Sem descricao').trim() || 'Sem descricao';
    const brandText = (product.cod_grup_marca || '').trim();
    const label = document.createElement('span');
    label.className = 'count-product-label';
    const codeEl = document.createElement('strong');
    codeEl.className = 'count-product-code';
    codeEl.textContent = codeText;
    const descEl = document.createElement('span');
    descEl.className = 'count-product-desc';
    descEl.textContent = brandText ? `${descText} - ${brandText}` : descText;
    label.appendChild(codeEl);
    label.appendChild(descEl);

    const controls = document.createElement('div');
    controls.className = 'count-product-controls';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.value = '1';
    qtyInput.className = 'count-product-qty';
    qtyInput.setAttribute('aria-label', `Quantidade para ${itemCode || 'item sem codigo'}`);

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'btn-count-adjust btn-minus';
    minusBtn.textContent = '-';
    minusBtn.setAttribute('aria-label', `Diminuir ${itemCode || 'item'}`);

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'btn-count-adjust btn-plus';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', `Aumentar ${itemCode || 'item'}`);

    const totalEl = document.createElement('strong');
    totalEl.className = 'count-product-total';
    totalEl.textContent = `${itemTotal}`;

    const hasCode = Boolean(itemCode);
    if (!hasCode) {
      qtyInput.disabled = true;
      minusBtn.disabled = true;
      plusBtn.disabled = true;
    }

    const applyDelta = (deltaSign) => {
      if (!hasCode) return;
      const qtyBase = Number(qtyInput.value);
      if (!Number.isInteger(qtyBase) || qtyBase <= 0) {
        setFeedback('Informe uma quantidade inteira maior que zero.', true);
        return;
      }
      const delta = deltaSign * qtyBase;
      registerCountDelta(itemCode, delta);
      const updatedTotals = new Map(computeTotals(loadCountEvents()).map((row) => [row.itemCode, row.qty]));
      totalEl.textContent = `${updatedTotals.get(itemCode) || 0}`;
    };

    label.addEventListener('click', () => {
      const itemInput = document.getElementById('item-code');
      if (!itemInput) return;
      itemInput.value = itemCode;
      itemInput.focus();
      setFeedback(`Produto selecionado: ${itemCode}`);
    });
    plusBtn.addEventListener('click', () => applyDelta(1));
    minusBtn.addEventListener('click', () => applyDelta(-1));

    controls.appendChild(minusBtn);
    controls.appendChild(qtyInput);
    controls.appendChild(plusBtn);
    controls.appendChild(totalEl);
    li.appendChild(label);
    li.appendChild(controls);
    countProductsList.appendChild(li);
  }
}

function filterCountProductsByTerm(term) {
  const normalized = (term || '').trim().toLowerCase();
  if (!normalized) return countProductsCache;
  return countProductsCache.filter((product) => {
    const sku = (product.cod_grup_sku || '').toLowerCase();
    const descricao = (product.cod_grup_descricao || '').toLowerCase();
    const marca = (product.cod_grup_marca || '').toLowerCase();
    const codigo = (product.cod_produto || '').toLowerCase();
    return (
      sku.includes(normalized)
      || descricao.includes(normalized)
      || marca.includes(normalized)
      || codigo.includes(normalized)
    );
  });
}

async function loadCountProducts() {
  if (!countProductsList) return;
  const token = getToken();
  if (!token) return;

  const q = '';
  const statusValue = countProductsStatusToggle?.checked ? 'inativo' : 'ativo';
  const params = new URLSearchParams();
  params.set('limit', '1000');
  params.set('status', statusValue);
  if (q) params.set('q', q);

  try {
    const resp = await apiFetch(`${API_PRODUCTS_CATALOG}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      renderCountProducts([]);
      setFeedback('Nao foi possivel carregar a lista de produtos para contagem.', true);
      return;
    }
    countProductsCache = await resp.json();
    renderCountProducts(countProductsCache);
  } catch {
    renderCountProducts([]);
    setFeedback('Sem conexao para carregar produtos.', true);
  }
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
  if (!totalsList || !pendingList || !totalItems || !pendingCount) return;
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
  if (!btnSync) return;
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
    const response = await apiFetch(API_SYNC_COUNTS, {
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

function registerCount(itemCodeInput) {
  registerCountDelta(itemCodeInput, 1);
}

function registerCountDelta(itemCodeInput, qtyDeltaInput) {
  const itemCode = normalizeItemCode(itemCodeInput);
  const quantity = Number(qtyDeltaInput);

  if (!itemCode) {
    setFeedback('Informe o item para registrar.', true);
    return;
  }

  if (!Number.isInteger(quantity) || quantity === 0) {
    setFeedback('Informe uma quantidade inteira diferente de zero.', true);
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
  const signal = quantity > 0 ? '+' : '';
  setFeedback(`Contagem salva no dispositivo: ${itemCode} (${signal}${quantity}).`);

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
      if (!event.item_code || !Number.isInteger(event.quantity) || event.quantity === 0) continue;
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
    registerCount(itemCode);
    document.getElementById('item-code').value = '';
    document.getElementById('item-code').focus();
  });

  if (btnSync) {
    btnSync.addEventListener('click', () => {
      syncPendingEvents();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportBackup();
    });
  }

  if (importFile) {
    importFile.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await importBackup(file);
      event.target.value = '';
    });
  }

  const itemCodeInput = document.getElementById('item-code');
  if (itemCodeInput) {
    itemCodeInput.addEventListener('input', () => {
      const filtered = filterCountProductsByTerm(itemCodeInput.value);
      renderCountProducts(filtered);
    });
  }

  if (countProductsStatusToggle) {
    countProductsStatusToggle.addEventListener('change', () => {
      loadCountProducts();
    });
  }

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

function loadProductDefaults() {
  try {
    const raw = localStorage.getItem(PRODUCT_DEFAULTS_KEY);
    if (!raw) return { ...DEFAULT_PRODUCT_PARAMS };
    const parsed = JSON.parse(raw);
    return {
      cod_grup_sp: parsed.cod_grup_sp?.length ? parsed.cod_grup_sp : DEFAULT_PRODUCT_PARAMS.cod_grup_sp,
      cod_grup_cia: parsed.cod_grup_cia?.length ? parsed.cod_grup_cia : DEFAULT_PRODUCT_PARAMS.cod_grup_cia,
      cod_grup_tipo: parsed.cod_grup_tipo?.length ? parsed.cod_grup_tipo : DEFAULT_PRODUCT_PARAMS.cod_grup_tipo,
      cod_grup_familia: parsed.cod_grup_familia?.length ? parsed.cod_grup_familia : DEFAULT_PRODUCT_PARAMS.cod_grup_familia,
      cod_grup_segmento: parsed.cod_grup_segmento?.length ? parsed.cod_grup_segmento : DEFAULT_PRODUCT_PARAMS.cod_grup_segmento,
      cod_grup_marca: parsed.cod_grup_marca?.length ? parsed.cod_grup_marca : DEFAULT_PRODUCT_PARAMS.cod_grup_marca,
      cod_grup_sku: parsed.cod_grup_sku?.length ? parsed.cod_grup_sku : DEFAULT_PRODUCT_PARAMS.cod_grup_sku,
      status: parsed.status?.length ? parsed.status : DEFAULT_PRODUCT_PARAMS.status,
      grup_prioridade: parsed.grup_prioridade?.length ? parsed.grup_prioridade : DEFAULT_PRODUCT_PARAMS.grup_prioridade,
    };
  } catch {
    return { ...DEFAULT_PRODUCT_PARAMS };
  }
}

function saveProductDefaults(params) {
  localStorage.setItem(PRODUCT_DEFAULTS_KEY, JSON.stringify(params));
}

function appendOptionAndSelect(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || !value) return;
  const normalized = value.trim();
  if (!normalized) return;

  const exists = [...select.options].some((opt) => opt.value.toLowerCase() === normalized.toLowerCase());
  if (!exists) {
    const option = document.createElement('option');
    option.value = normalized;
    option.textContent = normalized;
    select.appendChild(option);
  }
  select.value = normalized;
}

function updateDefaultsFromFormSelections() {
  const nextDefaults = {
    cod_grup_sp: [document.getElementById('prod-cod-sp')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_sp[0]],
    cod_grup_cia: [document.getElementById('prod-cod-cia')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_cia[0]],
    cod_grup_tipo: [document.getElementById('prod-cod-tipo')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_tipo[0]],
    cod_grup_familia: [document.getElementById('prod-cod-familia')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_familia[0]],
    cod_grup_segmento: [document.getElementById('prod-cod-segmento')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_segmento[0]],
    cod_grup_marca: [document.getElementById('prod-cod-marca')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_marca[0]],
    cod_grup_sku: [document.getElementById('prod-sku')?.value || DEFAULT_PRODUCT_PARAMS.cod_grup_sku[0]],
    status: [document.getElementById('prod-status')?.value || 'ativo', 'inativo'].filter((v, i, arr) => arr.indexOf(v) === i),
    grup_prioridade: [document.getElementById('prod-prioridade')?.value || DEFAULT_PRODUCT_PARAMS.grup_prioridade[0]],
  };
  saveProductDefaults(nextDefaults);
}

function fillSelect(selectId, options, selected = null) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione...';
  placeholder.selected = selected == null || selected === '';
  el.appendChild(placeholder);
  if (!Array.isArray(options) || options.length === 0) return;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt === 'ativo' ? 'Ativo' : opt === 'inativo' ? 'Inativo' : opt;
    if (selected != null && String(selected).toLowerCase() === String(opt).toLowerCase()) {
      option.selected = true;
    }
    el.appendChild(option);
  }
  if (selected != null && !options.some((v) => String(v).toLowerCase() === String(selected).toLowerCase())) {
    const custom = document.createElement('option');
    custom.value = selected;
    custom.textContent = selected;
    custom.selected = true;
    el.appendChild(custom);
  }
}

function parseParamList(rawValue) {
  return (rawValue || '')
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean);
}

function mergeUnique(baseValues, newValues) {
  const out = [...baseValues];
  for (const value of newValues) {
    if (!out.some((v) => String(v).toLowerCase() === String(value).toLowerCase())) {
      out.push(value);
    }
  }
  return out;
}

function applyProductDefaultsToForms() {
  const defaults = loadProductDefaults();
  const pairs = [
    ['cod_grup_sp', 'prod-cod-sp', 'edit-cod-sp'],
    ['cod_grup_cia', 'prod-cod-cia', 'edit-cod-cia'],
    ['cod_grup_tipo', 'prod-cod-tipo', 'edit-cod-tipo'],
    ['cod_grup_familia', 'prod-cod-familia', 'edit-cod-familia'],
    ['cod_grup_segmento', 'prod-cod-segmento', 'edit-cod-segmento'],
    ['cod_grup_marca', 'prod-cod-marca', 'edit-cod-marca'],
    ['cod_grup_sku', 'prod-sku', 'edit-sku'],
    ['status', 'prod-status', 'edit-status'],
    ['grup_prioridade', 'prod-prioridade', 'edit-prioridade'],
  ];
  for (const [key, createId, editId] of pairs) {
    fillSelect(createId, defaults[key]);
    fillSelect(editId, defaults[key]);
  }
  renderParamRemoveValues(defaults);
}

function renderParamRemoveValues(defaults = null) {
  const fieldEl = document.getElementById('param-remove-field');
  const valueEl = document.getElementById('param-remove-value');
  if (!fieldEl || !valueEl) return;

  const currentDefaults = defaults || loadProductDefaults();
  const fieldKey = fieldEl.value || 'cod_grup_sp';
  const values = currentDefaults[fieldKey] || [];

  valueEl.innerHTML = '';
  if (!values.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nenhum valor cadastrado';
    valueEl.appendChild(opt);
    return;
  }

  for (const value of values) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    valueEl.appendChild(opt);
  }
}

function readProductPayloadFromForm() {
  return {
    cod_grup_sp: document.getElementById('prod-cod-sp').value.trim() || null,
    cod_grup_cia: document.getElementById('prod-cod-cia').value.trim() || null,
    cod_grup_tipo: document.getElementById('prod-cod-tipo').value.trim() || null,
    cod_grup_familia: document.getElementById('prod-cod-familia').value.trim() || null,
    cod_grup_segmento: document.getElementById('prod-cod-segmento').value.trim() || null,
    cod_grup_marca: document.getElementById('prod-cod-marca').value.trim() || null,
    cod_produto: document.getElementById('prod-codigo').value.trim(),
    cod_grup_descricao: document.getElementById('prod-descricao').value.trim(),
    cod_grup_sku: document.getElementById('prod-sku').value.trim(),
    status: document.getElementById('prod-status').value.trim() || null,
    grup_prioridade: document.getElementById('prod-prioridade').value.trim() || null,
    price: parseFloat(document.getElementById('prod-price').value) || null,
    source_system: 'manual',
  };
}

function renderProducts(products) {
  if (!productsList || !productsTotal) return;
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
    const response = await apiFetch(`${API_PRODUCTS}?limit=300`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (handleUnauthorizedResponse(response)) {
      return;
    }
    if (!response.ok) {
      setProductFeedback('Nao foi possivel carregar os produtos.', true);
      return;
    }
    const products = await response.json();
    const defaults = loadProductDefaults();
    const mergedDefaults = {
      cod_grup_sp: mergeUnique(defaults.cod_grup_sp, products.map((p) => (p.cod_grup_sp || '').trim()).filter(Boolean)),
      cod_grup_cia: mergeUnique(defaults.cod_grup_cia, products.map((p) => (p.cod_grup_cia || '').trim()).filter(Boolean)),
      cod_grup_tipo: mergeUnique(defaults.cod_grup_tipo, products.map((p) => (p.cod_grup_tipo || '').trim()).filter(Boolean)),
      cod_grup_familia: mergeUnique(defaults.cod_grup_familia, products.map((p) => (p.cod_grup_familia || '').trim()).filter(Boolean)),
      cod_grup_segmento: mergeUnique(defaults.cod_grup_segmento, products.map((p) => (p.cod_grup_segmento || '').trim()).filter(Boolean)),
      cod_grup_marca: mergeUnique(defaults.cod_grup_marca, products.map((p) => (p.cod_grup_marca || '').trim()).filter(Boolean)),
      cod_grup_sku: mergeUnique(defaults.cod_grup_sku, products.map((p) => (p.cod_grup_sku || '').trim()).filter(Boolean)),
      status: mergeUnique(defaults.status, products.map((p) => (p.status || '').trim().toLowerCase()).filter(Boolean)),
      grup_prioridade: mergeUnique(defaults.grup_prioridade, products.map((p) => (p.grup_prioridade || '').trim()).filter(Boolean)),
    };
    saveProductDefaults(mergedDefaults);
    applyProductDefaultsToForms();
    renderProducts(products);
  } catch {
    setProductFeedback('Falha de conexao ao carregar produtos.', true);
  }
}

async function saveProductManual() {
  const payload = readProductPayloadFromForm();
  if (!payload.cod_produto || !payload.cod_grup_descricao || !payload.cod_grup_sku) {
    setProductFeedback('Codigo, descricao e SKU sao obrigatorios.', true);
    return;
  }

  try {
    const response = await apiFetch(API_PRODUCTS, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setProductFeedback(err.detail || 'Falha ao salvar produto.', true);
      return;
    }

    productForm.reset();
    applyProductDefaultsToForms();
    setProductFeedback('Produto salvo com sucesso.');
    await loadProducts();
  } catch {
    setProductFeedback('Sem conexao para salvar agora. Tente novamente.', true);
  }
}

function bindProductParamsEvents() {
  const form = document.getElementById('product-params-form');
  const feedback = document.getElementById('product-params-feedback');
  const removeField = document.getElementById('param-remove-field');
  const removeValue = document.getElementById('param-remove-value');
  const removeBtn = document.getElementById('btn-param-remove');
  if (!form || !feedback) return;

  document.getElementById('param-status').value = 'ativo';
  renderParamRemoveValues();

  if (removeField) {
    removeField.addEventListener('change', () => renderParamRemoveValues());
  }

  if (removeBtn && removeValue && removeField) {
    removeBtn.addEventListener('click', () => {
      const defaults = loadProductDefaults();
      const fieldKey = removeField.value;
      const selectedValue = removeValue.value;
      if (!fieldKey || !selectedValue) {
        feedback.textContent = 'Selecione um campo e um valor para remover.';
        feedback.style.color = 'var(--error)';
        return;
      }

      const list = defaults[fieldKey] || [];
      defaults[fieldKey] = list.filter((v) => String(v).toLowerCase() !== String(selectedValue).toLowerCase());
      saveProductDefaults(defaults);
      applyProductDefaultsToForms();
      renderParamRemoveValues(defaults);
      const fieldLabel = PRODUCT_PARAM_LABELS[fieldKey] || fieldKey;
      feedback.textContent = `Valor removido de ${fieldLabel}.`;
      feedback.style.color = 'var(--accent)';
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const defaults = loadProductDefaults();
    const nextDefaults = {
      cod_grup_sp: mergeUnique(defaults.cod_grup_sp, parseParamList(document.getElementById('param-cod-sp').value)),
      cod_grup_cia: mergeUnique(defaults.cod_grup_cia, parseParamList(document.getElementById('param-cod-cia').value)),
      cod_grup_tipo: mergeUnique(defaults.cod_grup_tipo, parseParamList(document.getElementById('param-cod-tipo').value)),
      cod_grup_familia: mergeUnique(defaults.cod_grup_familia, parseParamList(document.getElementById('param-cod-familia').value)),
      cod_grup_segmento: mergeUnique(defaults.cod_grup_segmento, parseParamList(document.getElementById('param-cod-segmento').value)),
      cod_grup_marca: mergeUnique(defaults.cod_grup_marca, parseParamList(document.getElementById('param-cod-marca').value)),
      cod_grup_sku: mergeUnique(defaults.cod_grup_sku, parseParamList(document.getElementById('param-sku').value)),
      status: [document.getElementById('param-status').value || 'ativo', 'inativo'].filter((v, i, arr) => arr.indexOf(v) === i),
      grup_prioridade: mergeUnique(defaults.grup_prioridade, parseParamList(document.getElementById('param-prioridade').value)),
    };
    saveProductDefaults(nextDefaults);
    applyProductDefaultsToForms();
    renderParamRemoveValues(nextDefaults);
    form.reset();
    document.getElementById('param-status').value = 'ativo';
    feedback.textContent = 'Parâmetros salvos com sucesso.';
    feedback.style.color = 'var(--accent)';
  });
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
    const response = await apiFetch(API_PRODUCTS_IMPORT_EXCEL, {
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

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-new-option-target]');
    if (!btn) return;
    const targetId = btn.dataset.newOptionTarget;
    const label = btn.parentElement?.querySelector('label')?.textContent || 'campo';
    const value = prompt(`Digite um novo valor para ${label}:`);
    if (!value) return;

    appendOptionAndSelect(targetId, value);

    const linkedId = targetId.startsWith('prod-') ? targetId.replace('prod-', 'edit-') : targetId.replace('edit-', 'prod-');
    appendOptionAndSelect(linkedId, value);

    updateDefaultsFromFormSelections();
    setProductFeedback(`${label}: novo valor "${value.trim()}" adicionado.`);
  });
}

// ── Sub-módulo: Produtos (listagem completa, edição, toggle, delete, histórico) ──

function setProdutosFeedback(msg, isError = false) {
  const el = document.getElementById('produtos-feedback');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function setEditFeedback(msg, isError = false) {
  const el = document.getElementById('product-edit-feedback');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function openProductEditPanel() {
  const panel = document.getElementById('product-edit-panel');
  if (!panel) return;
  panel.style.display = 'block';
  document.body.classList.add('modal-open');
}

function closeProductEditPanel() {
  const panel = document.getElementById('product-edit-panel');
  if (!panel) return;
  panel.style.display = 'none';
  document.body.classList.remove('modal-open');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function searchProdutos() {
  const q = document.getElementById('produtos-search').value.trim();
  const token = getToken();
  if (!token) return;

  try {
    const url = q ? `${API_PRODUCTS}?q=${encodeURIComponent(q)}&limit=300` : `${API_PRODUCTS}?limit=300`;
    const resp = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setProdutosFeedback('Falha ao buscar produtos.', true); return; }
    if (IS_LOCAL_WEB) {
      const usedOrigin = new URL(resp.url).origin;
      if (usedOrigin === window.location.origin) {
        // Login autenticou no backend local: usa local como primario.
        activeApiBasePrimary = `${window.location.origin}/api`;
        activeApiBaseFallback = `${RENDER_API_ORIGIN}/api`;
      } else {
        // Login autenticou no Render: usa Render como primario.
        activeApiBasePrimary = `${RENDER_API_ORIGIN}/api`;
        activeApiBaseFallback = `${window.location.origin}/api`;
      }
    }

    const data = await resp.json();
    renderProdutosTable(data);
  } catch {
    setProdutosFeedback('Sem conexão.', true);
  }
}

function renderProdutosTable(products) {
  const tbody = document.getElementById('produtos-tbody');
  const total = document.getElementById('produtos-result-total');
  tbody.innerHTML = '';
  total.textContent = products.length;

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Nenhum produto encontrado.</td></tr>';
    return;
  }

  for (const p of products) {
    const tr = document.createElement('tr');
    const statusClass = (p.status || 'ativo').toLowerCase() === 'ativo' ? 'badge-active' : 'badge-inactive';
    tr.innerHTML = `
      <td>${p.cod_produto || '—'}</td>
      <td>${p.cod_grup_sku || '—'}</td>
      <td>${p.cod_grup_descricao || '—'}</td>
      <td>${formatPrice(p.price)}</td>
      <td><span class="status-badge ${statusClass}">${p.status || 'ativo'}</span></td>
      <td>${formatDate(p.created_at)}</td>
      <td class="actions-cell">
        <button class="btn-icon" data-action="edit" data-id="${p.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-action="toggle" data-id="${p.id}" title="Ativar/Inativar">🔄</button>
        <button class="btn-icon" data-action="history" data-id="${p.id}" data-label="${p.cod_grup_sku}" title="Histórico">📜</button>
        <button class="btn-icon btn-danger-icon" data-action="delete" data-id="${p.id}" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

async function openEditProduct(id) {
  const token = getToken();
  if (!token) return;

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setProdutosFeedback('Produto não encontrado.', true); return; }
    const p = await resp.json();

    document.getElementById('edit-product-id').value = p.id;
    const defaults = loadProductDefaults();
    fillSelect('edit-cod-sp', defaults.cod_grup_sp, p.cod_grup_sp || '');
    fillSelect('edit-cod-cia', defaults.cod_grup_cia, p.cod_grup_cia || '');
    fillSelect('edit-cod-tipo', defaults.cod_grup_tipo, p.cod_grup_tipo || '');
    fillSelect('edit-cod-familia', defaults.cod_grup_familia, p.cod_grup_familia || '');
    fillSelect('edit-cod-segmento', defaults.cod_grup_segmento, p.cod_grup_segmento || '');
    fillSelect('edit-cod-marca', defaults.cod_grup_marca, p.cod_grup_marca || '');
    document.getElementById('edit-codigo').value = p.cod_produto || '';
    document.getElementById('edit-descricao').value = p.cod_grup_descricao || '';
    fillSelect('edit-sku', defaults.cod_grup_sku, p.cod_grup_sku || '');
    fillSelect('edit-status', defaults.status, (p.status || 'ativo').toLowerCase());
    fillSelect('edit-prioridade', defaults.grup_prioridade, p.grup_prioridade || '');
    document.getElementById('edit-price').value = p.price != null ? p.price : '';

    openProductEditPanel();
    document.getElementById('product-history-inline').style.display = 'none';
    setEditFeedback('');
  } catch {
    setProdutosFeedback('Falha ao carregar produto para edição.', true);
  }
}

async function updateProduct() {
  const id = document.getElementById('edit-product-id').value;
  const token = getToken();
  if (!token || !id) return;

  const payload = {
    cod_grup_sp: document.getElementById('edit-cod-sp').value.trim() || null,
    cod_grup_cia: document.getElementById('edit-cod-cia').value.trim() || null,
    cod_grup_tipo: document.getElementById('edit-cod-tipo').value.trim() || null,
    cod_grup_familia: document.getElementById('edit-cod-familia').value.trim() || null,
    cod_grup_segmento: document.getElementById('edit-cod-segmento').value.trim() || null,
    cod_grup_marca: document.getElementById('edit-cod-marca').value.trim() || null,
    cod_produto: document.getElementById('edit-codigo').value.trim(),
    cod_grup_descricao: document.getElementById('edit-descricao').value.trim(),
    cod_grup_sku: document.getElementById('edit-sku').value.trim(),
    status: document.getElementById('edit-status').value.trim() || null,
    grup_prioridade: document.getElementById('edit-prioridade').value.trim() || null,
    price: parseFloat(document.getElementById('edit-price').value) || null,
  };

  if (!payload.cod_produto || !payload.cod_grup_descricao || !payload.cod_grup_sku) {
    setEditFeedback('Codigo, descrição e SKU são obrigatórios.', true);
    return;
  }

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (handleUnauthorizedResponse(resp)) {
      return;
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setEditFeedback(err.detail || 'Falha ao atualizar produto.', true);
      return;
    }
    setEditFeedback('Produto atualizado com sucesso.');
    closeProductEditPanel();
    await searchProdutos();
    await loadProducts();
  } catch {
    setEditFeedback('Sem conexão.', true);
  }
}

async function toggleProductStatus(id) {
  const token = getToken();
  if (!token) return;

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}/toggle-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setProdutosFeedback('Falha ao alternar status.', true); return; }
    const data = await resp.json();
    setProdutosFeedback(`Status alterado para: ${data.status}`);
    await searchProdutos();
    await loadProducts();
  } catch {
    setProdutosFeedback('Sem conexão.', true);
  }
}

async function deleteProduct(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  const token = getToken();
  if (!token) return;

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setProdutosFeedback('Falha ao excluir.', true); return; }
    setProdutosFeedback('Produto excluído.');
    await searchProdutos();
    await loadProducts();
  } catch {
    setProdutosFeedback('Sem conexão.', true);
  }
}

async function showProductHistory(id, label) {
  const token = getToken();
  if (!token) return;

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}/history`, { headers: { Authorization: `Bearer ${token}` } });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setProdutosFeedback('Falha ao carregar histórico.', true); return; }
    const items = await resp.json();

    const panel = document.getElementById('product-history-inline');
    const list = document.getElementById('product-history-list');
    document.getElementById('history-product-label').textContent = `Produto: ${label || id}`;

    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<li><span>Nenhuma alteração registrada.</span></li>';
    } else {
      for (const h of items) {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${h.field_name}</strong>: "${h.old_value || '—'}" → "${h.new_value || '—'}" <small>(por ${h.changed_by || '?'} em ${formatDate(h.changed_at)})</small></span>`;
        list.appendChild(li);
      }
    }
    panel.style.display = 'block';
  } catch {
    setProdutosFeedback('Sem conexão.', true);
  }
}

function bindProdutosEvents() {
  const btnSearch = document.getElementById('btn-produtos-search');
  const searchInput = document.getElementById('produtos-search');
  const tbody = document.getElementById('produtos-tbody');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnOpenHistoryInline = document.getElementById('btn-open-history-inline');
  const btnCloseHistoryInline = document.getElementById('btn-close-history-inline');
  const editForm = document.getElementById('product-edit-form');

  if (!btnSearch) return;

  btnSearch.addEventListener('click', () => searchProdutos());
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchProdutos(); } });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'edit') openEditProduct(id);
    else if (action === 'toggle') toggleProductStatus(id);
    else if (action === 'delete') deleteProduct(id);
    else if (action === 'history') showProductHistory(id, btn.dataset.label);
  });

  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
      closeProductEditPanel();
    });
  }

  if (btnOpenHistoryInline) {
    btnOpenHistoryInline.addEventListener('click', async () => {
      const id = document.getElementById('edit-product-id').value;
      const label = document.getElementById('edit-sku').value;
      if (!id) return;
      await showProductHistory(id, label);
    });
  }

  if (btnCloseHistoryInline) {
    btnCloseHistoryInline.addEventListener('click', () => {
      document.getElementById('product-history-inline').style.display = 'none';
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', (e) => { e.preventDefault(); updateProduct(); });
  }
}

// ── Sub-módulo: Preço de Produtos ──

function setPrecoFeedback(msg, isError = false) {
  const el = document.getElementById('preco-feedback');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

async function searchPrecoProducts() {
  const q = document.getElementById('preco-search').value.trim();
  const token = getToken();
  if (!token) return;

  try {
    const url = q ? `${API_PRODUCTS}?q=${encodeURIComponent(q)}&limit=300` : `${API_PRODUCTS}?limit=300`;
    const resp = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setPrecoFeedback('Falha ao buscar.', true); return; }
    const data = await resp.json();
    renderPrecoTable(data);
  } catch {
    setPrecoFeedback('Sem conexão.', true);
  }
}

function renderPrecoTable(products) {
  const tbody = document.getElementById('preco-tbody');
  tbody.innerHTML = '';

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhum produto encontrado.</td></tr>';
    return;
  }

  for (const p of products) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.cod_grup_sku || '—'}</td>
      <td>${p.cod_grup_descricao || '—'}</td>
      <td>
        <input type="number" step="0.01" min="0" class="price-inline-input" data-id="${p.id}" value="${p.price != null ? p.price : ''}" placeholder="0.00" />
      </td>
      <td class="actions-cell">
        <button class="btn-icon" data-price-save="${p.id}" title="Salvar preço">💾</button>
        <button class="btn-icon" data-price-history="${p.id}" data-label="${p.cod_grup_sku}" title="Histórico de preços">📜</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

async function saveInlinePrice(id, inputEl) {
  const token = getToken();
  if (!token) return;
  const newPrice = parseFloat(inputEl.value);
  if (isNaN(newPrice) || newPrice < 0) { setPrecoFeedback('Preço inválido.', true); return; }

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ price: newPrice }),
    });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      setPrecoFeedback(err.detail || 'Falha ao salvar preço.', true);
      return;
    }
    setPrecoFeedback('Preço atualizado com sucesso.');
    await loadProducts();
  } catch {
    setPrecoFeedback('Sem conexão.', true);
  }
}

async function showPriceHistory(id, label) {
  const token = getToken();
  if (!token) return;

  try {
    const resp = await apiFetch(`${API_PRODUCTS}/${id}/history`, { headers: { Authorization: `Bearer ${token}` } });
    if (handleUnauthorizedResponse(resp)) { return; }
    if (!resp.ok) { setPrecoFeedback('Falha ao carregar histórico.', true); return; }
    const items = await resp.json();

    const panel = document.getElementById('price-history-panel');
    const list = document.getElementById('price-history-list');
    document.getElementById('price-history-label').textContent = `Produto: ${label || id}`;

    const priceItems = items.filter(h => h.field_name === 'price');
    list.innerHTML = '';
    if (!priceItems.length) {
      list.innerHTML = '<li><span>Nenhuma alteração de preço registrada.</span></li>';
    } else {
      for (const h of priceItems) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${formatPrice(h.old_value)} → ${formatPrice(h.new_value)} <small>(por ${h.changed_by || '?'} em ${formatDate(h.changed_at)})</small></span>`;
        list.appendChild(li);
      }
    }
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth' });
  } catch {
    setPrecoFeedback('Sem conexão.', true);
  }
}

function bindPrecoEvents() {
  const btnSearch = document.getElementById('btn-preco-search');
  const searchInput = document.getElementById('preco-search');
  const tbody = document.getElementById('preco-tbody');
  const btnCloseHistory = document.getElementById('btn-close-price-history');

  if (!btnSearch) return;

  btnSearch.addEventListener('click', () => searchPrecoProducts());
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchPrecoProducts(); } });

  tbody.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-price-save]');
    if (saveBtn) {
      const id = saveBtn.dataset.priceSave;
      const input = tbody.querySelector(`input[data-id="${id}"]`);
      if (input) saveInlinePrice(id, input);
      return;
    }
    const histBtn = e.target.closest('[data-price-history]');
    if (histBtn) {
      showPriceHistory(histBtn.dataset.priceHistory, histBtn.dataset.label);
    }
  });

  if (btnCloseHistory) {
    btnCloseHistory.addEventListener('click', () => {
      document.getElementById('price-history-panel').style.display = 'none';
    });
  }
}

// ── Modulos extras (offline-first local storage) ────────────────
const EXTRA_MODULES = [
  { key: 'recount',      storageKey: 'estoque_recount_v1',      label: 'Recontagem' },
  { key: 'pull',         storageKey: 'estoque_pull_v1',         label: 'Puxada' },
  { key: 'return',       storageKey: 'estoque_return_v1',       label: 'Devolucao' },
  { key: 'break',        storageKey: 'estoque_break_v1',        label: 'Quebra' },
  { key: 'direct-sale',  storageKey: 'estoque_directsale_v1',   label: 'Venda Direta' },
  { key: 'validity',     storageKey: 'estoque_validity_v1',     label: 'Validade' },
];

function loadModuleEvents(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveModuleEvents(storageKey, events) {
  localStorage.setItem(storageKey, JSON.stringify(events));
}

function renderModuleList(mod) {
  const list = document.getElementById(`${mod.key}-list`);
  const total = document.getElementById(`${mod.key}-total`);
  if (!list) return;

  const events = loadModuleEvents(mod.storageKey);
  const totals = new Map();
  for (const e of events) {
    totals.set(e.item_code, (totals.get(e.item_code) || 0) + e.quantity);
  }

  list.innerHTML = '';
  if (totals.size === 0) {
    list.innerHTML = `<li><span>Nenhum registro de ${mod.label.toLowerCase()} ainda.</span><strong>0</strong></li>`;
  } else {
    for (const [code, qty] of [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${code}</span><strong>${qty}</strong>`;
      list.appendChild(li);
    }
  }
  if (total) total.textContent = `${totals.size} itens`;
}

function setModuleFeedback(moduleKey, message, isError = false) {
  const el = document.getElementById(`${moduleKey}-feedback`);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function bindExtraModules() {
  for (const mod of EXTRA_MODULES) {
    const form = document.getElementById(`${mod.key}-form`);
    if (!form) continue;

    renderModuleList(mod);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const itemInput = form.querySelector('input[type="text"]');
      const qtyInput = form.querySelector('input[type="number"]');
      const itemCode = normalizeItemCode(itemInput.value);
      const quantity = Number(qtyInput.value);

      if (!itemCode) {
        setModuleFeedback(mod.key, 'Informe o item para registrar.', true);
        return;
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setModuleFeedback(mod.key, 'Informe uma quantidade inteira maior que zero.', true);
        return;
      }

      const events = loadModuleEvents(mod.storageKey);
      events.push({
        client_event_id: makeEventId(),
        item_code: itemCode,
        quantity,
        observed_at: new Date().toISOString(),
        device_name: getDeviceName(),
        synced: false,
      });
      saveModuleEvents(mod.storageKey, events);
      renderModuleList(mod);
      setModuleFeedback(mod.key, `${mod.label} salva: ${itemCode} (+${quantity}).`);

      itemInput.value = '';
      qtyInput.value = '1';
      itemInput.focus();
    });
  }
}

function bindModuleEvents() {
  moduleNav.addEventListener('click', (event) => {
    const btn = event.target.closest('.module-btn');
    if (!btn) return;
    const moduleKey = btn.dataset.module;
    if (!canAccessModule(moduleKey)) return;
    setActiveModule(moduleKey);
  });

  // Card grid clicks -> navega para sub-módulo
  document.addEventListener('click', (event) => {
    const card = event.target.closest('.module-card');
    if (card) {
      const subKey = card.dataset.sub;
      if (subKey) {
        setActiveSub(subKey);
        history.pushState(null, '', `${APP_BASE_PATH}#${subKey}`);
      }
      return;
    }

    // Botão Voltar -> retorna ao grid do módulo-mãe
    const backBtn = event.target.closest('.back-btn');
    if (backBtn) {
      const parentModule = backBtn.dataset.back;
      showModuleHome(parentModule);
      history.pushState(null, '', `${APP_BASE_PATH}#${parentModule}`);
      return;
    }
  });

  window.addEventListener('hashchange', () => {
    const hashKey = getCurrentHashKey();
    if (hashKey && canAccessHash(hashKey)) {
      setActiveModule(hashKey, false);
    }
  });
}

// ── Login ───────────────────────────────────────────────────────
function setLoading(on) {
  btnLogin.disabled        = on;
  btnLogin.querySelector('.btn-label').style.display  = on ? 'none' : 'inline';
  btnSpinner.style.display = on ? 'inline-block' : 'none';
}

async function resolveLocalUserInfo(token, username) {
  try {
    const resp = await apiFetch('/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('users lookup failed');
    const users = await resp.json();
    const normalized = (username || '').trim().toLowerCase();
    const matched = Array.isArray(users)
      ? users.find((u) => (u.username || '').trim().toLowerCase() === normalized)
      : null;
    if (matched) {
      return {
        username: matched.username,
        name: matched.full_name || matched.username,
        email: matched.username.includes('@') ? matched.username : null,
        phone: matched.phone || null,
        role: matched.role || 'conferente',
        allowed_pages: matched.allowed_pages || [],
      };
    }
  } catch {
    // fallback para manter fluxo de login quando /api/users falhar
  }
  return {
    username,
    name: username,
    email: username.includes('@') ? username : null,
    role: 'conferente',
    allowed_pages: ['contagem'],
  };
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
    const doLoginRequest = () => apiFetch(API_LOGIN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    let resp = await doLoginRequest();
    if (resp.status >= 500) {
      loginError.textContent = 'Servidor de autenticacao temporariamente indisponivel. Tentando novamente...';
      await new Promise((resolve) => setTimeout(resolve, 2500));
      resp = await doLoginRequest();
    }

    if (!resp.ok) {
      if (resp.status >= 500) {
        loginError.textContent = 'Servidor temporariamente indisponível. Tente novamente em alguns segundos.';
        return;
      }
      const err = await resp.json().catch(() => ({}));
      loginError.textContent = err.detail || 'E-mail ou senha incorretos.';
      return;
    }

    const data = await resp.json();
    const token = data.access_token;
    const user = data.user || await resolveLocalUserInfo(token, username);
    saveSession(token, user);
    initDashboard(user);

  } catch {
    loginError.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
  } finally {
    setLoading(false);
  }
});

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (currentRole !== 'admin') {
      setRegisterFeedback('Apenas admin pode cadastrar usuários.', true);
      return;
    }
    setRegisterFeedback('');
    const name = document.getElementById('register-name')?.value.trim() || '';
    const email = document.getElementById('register-email')?.value.trim() || '';
    const phone = document.getElementById('register-phone')?.value.trim() || '';
    const password = document.getElementById('register-password')?.value || '';
    const pagesRaw = document.getElementById('register-pages')?.value || '';
    const allowedPages = pagesRaw
      .split(';')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (!name || !email || !password) {
      setRegisterFeedback('Preencha nome, e-mail e senha.', true);
      return;
    }

    try {
      const resp = await apiFetch(API_REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          password,
          allowed_pages: allowedPages,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setRegisterFeedback(err.detail || 'Falha ao cadastrar usuário.', true);
        return;
      }
      setRegisterFeedback('Usuário cadastrado com sucesso. Faça login com o novo e-mail/senha.');
      registerForm.reset();
      await loadUsersAdminList();
    } catch {
      setRegisterFeedback('Erro de conexão ao cadastrar usuário.', true);
    }
  });
}

// ── Dashboard ───────────────────────────────────────────────────
function initDashboard(user) {
  const label = user?.name || user?.email || user?.username || 'Usuário';
  userDisplay.textContent = label;
  currentRole = normalizeRole(user?.role || 'conferente') || 'conferente';
  currentAllowedPages = Array.isArray(user?.allowed_pages)
    ? user.allowed_pages.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    : [];
  roleDisplay.textContent = `Perfil: ${currentRole}`;

  renderModuleNav();
  renderSubCardsAccess();
  const hashKey = getCurrentHashKey();
  // Quando a URL e /app#contagem, deve abrir a home informativa do modulo.
  if (hashKey === 'contagem') {
    setActiveModule('contagem', false);
  }
  renderAccessMatrix();
  updateNetworkStatus();
  renderCounts();
  loadCountProducts();
  syncPendingEvents();
  loadProducts();
  loadUsersAdminList();
  showDashboard();
}

// ── Logout ──────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => {
  clearSession();
  loginForm.reset();
  history.replaceState(null, '', APP_BASE_PATH);
  showLogin();
});

// ── Inicialização ───────────────────────────────────────────────
(function init() {
  applyProductDefaultsToForms();
  bindCountEvents();
  bindProductEvents();
  bindProductParamsEvents();
  bindProdutosEvents();
  bindPrecoEvents();
  bindModuleEvents();
  bindExtraModules();
  const token = getToken();
  const user  = getUser();

  if (token && user) {
    initDashboard(user);
  } else {
    showLogin();
  }
})();
