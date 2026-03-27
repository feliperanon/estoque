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
/** Limite alinhado ao backend (le=5000); listas grandes de cadastro/BI. */
const PRODUCTS_LIST_LIMIT = 2000;
const API_PRODUCTS_CATALOG = '/products/catalog';
const API_PRODUCTS_IMPORT_EXCEL = '/products/import-excel';
const APP_BASE_PATH = '/app';
const TOKEN_KEY  = 'estoque_token';
const USER_KEY   = 'estoque_user';
const COUNT_EVENTS_KEY = 'estoque_count_events_v1';
const COUNT_EVENTS_DAY_KEY = 'estoque_count_events_day_v1';
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
const countProgressFill = document.getElementById('count-progress-fill');
const countProgressText = document.getElementById('count-progress-text');
const kpiCountPercent = document.getElementById('kpi-count-percent');
const kpiCountUser = document.getElementById('kpi-count-user');
const kpiCountWindow = document.getElementById('kpi-count-window');
const kpiCountElapsed = document.getElementById('kpi-count-elapsed');
const kpiCountEta = document.getElementById('kpi-count-eta');
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
const topbarPageTitle = document.querySelector('.topbar .topbar-title');
const sidebarPageTitle = document.getElementById('sidebar-page-title');
const sidebarMenu = document.getElementById('sidebar-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnMenuToggle = document.getElementById('btn-menu-toggle');
const btnMenuClose = document.getElementById('btn-menu-close');
const accessMatrixContainer = document.getElementById('access-matrix');
const registerAccessAll = document.getElementById('register-access-all');
const registerProfilePreset = document.getElementById('register-profile-preset');
const registerAccessMain = document.getElementById('register-access-main');
const registerAccessCount = document.getElementById('register-access-count');
const registerAccessCadastro = document.getElementById('register-access-cadastro');
const editAccessMain = document.getElementById('edit-access-main');
const editAccessCount = document.getElementById('edit-access-count');
const editAccessCadastro = document.getElementById('edit-access-cadastro');
const editAccessAll = document.getElementById('edit-access-all');
const editProfilePreset = document.getElementById('edit-profile-preset');
const userEditPanel = document.getElementById('user-edit-panel');
const userEditForm = document.getElementById('user-edit-form');
const userEditFeedback = document.getElementById('user-edit-feedback');
const btnUserEditClose = document.getElementById('btn-user-edit-close');

let userEditOriginalUsername = '';
let usersAdminCache = [];

let syncInProgress = false;
let selectedProductFile = null;
let currentRole = 'conferente';
let countProductsCache = [];
let currentAllowedPages = [];
let countKpiTicker = null;

const PAGE_KEYS_BY_MODULE = {
  contagem: ['contagem', 'count', 'recount', 'pull', 'return', 'break', 'direct-sale', 'validity'],
  cadastro: ['cadastro', 'cadastro-produto', 'produtos', 'preco-produtos', 'parametros-produto'],
  acesso: ['acesso'],
};

const REGISTER_ACCESS_GROUPS = [
  {
    container: () => registerAccessMain,
    items: [
      { key: 'contagem', label: 'Contagem' },
      { key: 'cadastro', label: 'Cadastro' },
      { key: 'acesso', label: 'Acesso' },
    ],
  },
  {
    container: () => registerAccessCount,
    items: [
      { key: 'count', label: 'Contagem de Estoque' },
      { key: 'recount', label: 'Recontagem' },
      { key: 'pull', label: 'Puxada' },
      { key: 'return', label: 'Devolução' },
      { key: 'break', label: 'Quebra' },
      { key: 'direct-sale', label: 'Venda Direta' },
      { key: 'validity', label: 'Data de Vencimento' },
    ],
  },
  {
    container: () => registerAccessCadastro,
    items: [
      { key: 'cadastro-produto', label: 'Cadastro de Produto' },
      { key: 'produtos', label: 'Produtos' },
      { key: 'preco-produtos', label: 'Preço de Produtos' },
      { key: 'parametros-produto', label: 'Parâmetros de Produto' },
    ],
  },
];

const REGISTER_PROFILE_PRESETS = {
  admin: null, // null = todos
  administrativo: [
    'contagem',
    'cadastro',
    'acesso',
    'count',
    'recount',
    'pull',
    'return',
    'break',
    'direct-sale',
    'validity',
    'cadastro-produto',
    'produtos',
    'preco-produtos',
    'parametros-produto',
  ],
  conferente: [
    'contagem',
    'count',
    'recount',
    'pull',
    'return',
    'break',
    'direct-sale',
    'validity',
  ],
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

const PAGE_TITLES = {
  contagem: 'Contagem',
  cadastro: 'Cadastro',
  acesso: 'Acesso',
  count: 'Contagem',
  recount: 'Recontagem',
  pull: 'Puxada',
  return: 'Devolução',
  break: 'Quebra',
  'direct-sale': 'Venda Direta',
  validity: 'Data de Vencimento',
  'cadastro-produto': 'Cadastro de Produto',
  produtos: 'Produtos',
  'preco-produtos': 'Preço de Produtos',
  'parametros-produto': 'Parâmetros',
};

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
    category: 'Operação',
    subcategories: [
      { module: 'Contagem de Estoque', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Recontagem', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Puxada', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Devolução', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Quebra', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Venda Direta', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Data de Vencimento', roles: ['conferente', 'administrativo', 'admin'] },
    ],
  },
  {
    category: 'Cadastro',
    subcategories: [
      { module: 'Cadastro de produtos', roles: ['administrativo', 'admin'] },
      { module: 'Importação de produtos', roles: ['administrativo', 'admin'] },
    ],
  },
  {
    category: 'Governança',
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

  const pageTitle = PAGE_TITLES[moduleKey] || PAGE_TITLES[actualModule] || 'Estoque';
  if (topbarPageTitle) {
    topbarPageTitle.textContent = pageTitle;
  }
  if (sidebarPageTitle) {
    sidebarPageTitle.textContent = pageTitle;
  }

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
  if (!accessMatrixContainer) return;
  accessMatrixContainer.innerHTML = '';

  ACCESS_CATEGORIES.forEach((item) => {
    const categoryCard = document.createElement('section');
    categoryCard.className = 'access-category';

    const header = document.createElement('div');
    header.className = 'access-category-head';
    header.innerHTML = `<h3>${item.category}</h3><span class="access-count">${item.subcategories.length} modulo(s)</span>`;

    const table = document.createElement('table');
    table.className = 'access-table';
    table.innerHTML = '<thead><tr><th>Operacao</th><th>Perfis permitidos</th></tr></thead>';

    const tbody = document.createElement('tbody');
    item.subcategories.forEach((sub) => {
      const tr = document.createElement('tr');
      const roleTags = sub.roles
        .map((role) => `<span class="access-role-tag ${role}">${role}</span>`)
        .join('');
      tr.innerHTML = `<td class="access-op-name">${sub.module}</td><td><div class="access-role-tags">${roleTags}</div></td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    categoryCard.appendChild(header);
    categoryCard.appendChild(table);
    accessMatrixContainer.appendChild(categoryCard);
  });
}

function renderRegisterAccessOptions() {
  REGISTER_ACCESS_GROUPS.forEach((group) => {
    const container = group.container();
    if (!container) return;
    container.innerHTML = '';
    group.items.forEach((item) => {
      const label = document.createElement('label');
      label.className = 'access-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'register-access-item';
      input.value = item.key;
      input.checked = true;
      const text = document.createElement('span');
      text.textContent = item.label;
      label.appendChild(input);
      label.appendChild(text);
      container.appendChild(label);
    });
  });

  if (registerAccessAll) {
    registerAccessAll.checked = true;
  }
}

function getSelectedRegisterPages() {
  const selected = Array.from(document.querySelectorAll('.register-access-item:checked'))
    .map((node) => (node.value || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(selected));
}

function getAllRegisterAccessKeys() {
  return REGISTER_ACCESS_GROUPS
    .flatMap((group) => group.items.map((item) => item.key))
    .map((key) => key.trim().toLowerCase());
}

function setAllRegisterAccess(checked) {
  document.querySelectorAll('.register-access-item').forEach((node) => {
    node.checked = checked;
  });
}

function getLocalDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ensureDailyCountReset() {
  const today = getLocalDateKey();
  const lastReset = localStorage.getItem(COUNT_EVENTS_DAY_KEY);
  if (lastReset === today) return false;
  localStorage.removeItem(COUNT_EVENTS_KEY);
  localStorage.setItem(COUNT_EVENTS_DAY_KEY, today);
  return true;
}

function syncRegisterAllToggle() {
  if (!registerAccessAll) return;
  const allItems = Array.from(document.querySelectorAll('.register-access-item'));
  registerAccessAll.checked = allItems.length > 0 && allItems.every((node) => node.checked);
}

function applyRegisterProfilePreset(preset) {
  const normalized = (preset || '').trim().toLowerCase();
  const allowed = REGISTER_PROFILE_PRESETS[normalized];
  const allKeys = new Set(getAllRegisterAccessKeys());
  const allowedSet = allowed ? new Set(allowed) : allKeys;
  document.querySelectorAll('.register-access-item').forEach((node) => {
    const key = (node.value || '').trim().toLowerCase();
    node.checked = allowedSet.has(key);
  });
  syncRegisterAllToggle();
}

function renderEditAccessOptions() {
  if (!editAccessMain || !editAccessCount || !editAccessCadastro) return;
  const groups = [
    { el: editAccessMain, items: REGISTER_ACCESS_GROUPS[0].items },
    { el: editAccessCount, items: REGISTER_ACCESS_GROUPS[1].items },
    { el: editAccessCadastro, items: REGISTER_ACCESS_GROUPS[2].items },
  ];
  groups.forEach(({ el, items }) => {
    el.innerHTML = '';
    items.forEach((item) => {
      const label = document.createElement('label');
      label.className = 'access-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'edit-access-item';
      input.value = item.key;
      const text = document.createElement('span');
      text.textContent = item.label;
      label.appendChild(input);
      label.appendChild(text);
      el.appendChild(label);
    });
  });
}

function getSelectedEditAccessPages() {
  const selected = Array.from(document.querySelectorAll('.edit-access-item:checked'))
    .map((node) => (node.value || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(selected));
}

function syncEditAllToggle() {
  if (!editAccessAll) return;
  const items = Array.from(document.querySelectorAll('.edit-access-item'));
  editAccessAll.checked = items.length > 0 && items.every((node) => node.checked);
}

function setAllEditAccess(checked) {
  document.querySelectorAll('.edit-access-item').forEach((node) => {
    node.checked = checked;
  });
}

function applyEditProfilePreset(preset) {
  const normalized = (preset || '').trim().toLowerCase();
  const allowed = REGISTER_PROFILE_PRESETS[normalized];
  const allKeys = new Set(getAllRegisterAccessKeys());
  const allowedSet = allowed ? new Set(allowed) : allKeys;
  document.querySelectorAll('.edit-access-item').forEach((node) => {
    const key = (node.value || '').trim().toLowerCase();
    node.checked = allowedSet.has(key);
  });
  syncEditAllToggle();
}

function setUserEditFeedback(message, isError = false) {
  if (!userEditFeedback) return;
  userEditFeedback.textContent = message || '';
  userEditFeedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function openUserEditPanel(user) {
  if (!userEditPanel || currentRole !== 'admin' || !user || user.id == null) return;
  userEditOriginalUsername = (user.username || '').trim().toLowerCase();
  const idEl = document.getElementById('edit-user-id');
  const nameEl = document.getElementById('edit-user-name');
  const emailEl = document.getElementById('edit-user-email');
  const phoneEl = document.getElementById('edit-user-phone');
  const passEl = document.getElementById('edit-user-password');
  const roleEl = document.getElementById('edit-user-role');
  const activeEl = document.getElementById('edit-user-active');
  if (!idEl || !nameEl || !emailEl || !roleEl || !activeEl) return;

  idEl.value = String(user.id);
  nameEl.value = user.full_name || '';
  emailEl.value = user.username || '';
  if (phoneEl) phoneEl.value = user.phone || '';
  if (passEl) passEl.value = '';
  roleEl.value = normalizeRole(user.role) || 'conferente';
  if (!['admin', 'administrativo', 'conferente'].includes(roleEl.value)) {
    roleEl.value = 'conferente';
  }
  activeEl.checked = user.is_active !== false;

  const pages = Array.isArray(user.allowed_pages)
    ? user.allowed_pages.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    : [];
  document.querySelectorAll('.edit-access-item').forEach((node) => {
    const key = (node.value || '').trim().toLowerCase();
    node.checked = pages.includes(key);
  });
  syncEditAllToggle();
  if (editProfilePreset) editProfilePreset.value = 'custom';
  setUserEditFeedback('');
  userEditPanel.style.display = 'block';
  document.body.classList.add('modal-open');
}

function closeUserEditPanel() {
  if (userEditPanel) userEditPanel.style.display = 'none';
  document.body.classList.remove('modal-open');
  userEditOriginalUsername = '';
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
  ensureDailyCountReset();
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
  localStorage.setItem(COUNT_EVENTS_DAY_KEY, getLocalDateKey());
  localStorage.setItem(COUNT_EVENTS_KEY, JSON.stringify(events));
}

function computeItemNetTotals(events) {
  const totals = new Map();
  for (const event of events) {
    const code = normalizeItemCode(event.item_code || '');
    if (!code) continue;
    const current = totals.get(code) || 0;
    totals.set(code, current + Number(event.quantity || 0));
  }
  return totals;
}

function computeCountProgressStats(products = countProductsCache, events = loadCountEvents()) {
  const validProducts = (Array.isArray(products) ? products : [])
    .map((p) => normalizeItemCode(p.cod_produto || p.cod_grup_sku || p.cod_grup_descricao || ''))
    .filter(Boolean);
  const uniqueProducts = Array.from(new Set(validProducts));
  const total = uniqueProducts.length;
  const netByItem = computeItemNetTotals(events);
  const counted = uniqueProducts.filter((code) => (netByItem.get(code) || 0) > 0).length;
  const percent = total > 0 ? Math.min(100, Math.round((counted / total) * 100)) : 0;
  return { total, counted, percent };
}

function formatClock(dateValue) {
  if (!dateValue) return '--:--';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDurationFromMs(msValue) {
  const totalSeconds = Math.max(0, Math.floor(msValue / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function estimateCountFinish(events, totalProducts) {
  const byItem = new Map();
  for (const event of events) {
    const code = normalizeItemCode(event.item_code || '');
    if (!code) continue;
    const ts = new Date(event.observed_at || '').getTime();
    if (!Number.isFinite(ts)) continue;
    const current = byItem.get(code);
    if (!current || ts < current) {
      byItem.set(code, ts);
    }
  }
  const firstTimes = [...byItem.values()].sort((a, b) => a - b);
  if (firstTimes.length < 2 || totalProducts <= firstTimes.length) return null;

  // "Aprendizado" online: média móvel exponencial do tempo por produto.
  let emaSecondsPerProduct = 0;
  let seen = 0;
  for (let i = 1; i < firstTimes.length; i += 1) {
    const deltaSec = Math.max(1, Math.round((firstTimes[i] - firstTimes[i - 1]) / 1000));
    if (seen === 0) {
      emaSecondsPerProduct = deltaSec;
    } else {
      const alpha = 0.35;
      emaSecondsPerProduct = (alpha * deltaSec) + ((1 - alpha) * emaSecondsPerProduct);
    }
    seen += 1;
  }

  const remainingProducts = totalProducts - firstTimes.length;
  if (remainingProducts <= 0) return null;
  const etaMs = firstTimes[firstTimes.length - 1] + (remainingProducts * emaSecondsPerProduct * 1000);
  return new Date(etaMs);
}

function updateCountKpi(products = countProductsCache) {
  if (!kpiCountPercent || !kpiCountWindow || !kpiCountElapsed || !kpiCountEta) return;
  const events = loadCountEvents();
  const { total, counted, percent } = computeCountProgressStats(products, events);
  kpiCountPercent.textContent = `${percent}%`;

  if (!events.length) {
    kpiCountWindow.textContent = 'Início: --:-- | Fim: --:--';
    kpiCountElapsed.textContent = 'Tempo em andamento: 00:00:00';
    kpiCountEta.textContent = 'Previsão de término: --:--';
    return;
  }

  const timestamps = events
    .map((e) => new Date(e.observed_at || '').getTime())
    .filter((ts) => Number.isFinite(ts))
    .sort((a, b) => a - b);
  const startMs = timestamps[0] || Date.now();
  const lastMs = timestamps[timestamps.length - 1] || startMs;
  const finished = total > 0 && counted >= total;
  const endMs = finished ? lastMs : null;
  const elapsedMs = (finished ? endMs : Date.now()) - startMs;

  kpiCountWindow.textContent = `Início: ${formatClock(startMs)} | Fim: ${finished ? formatClock(endMs) : '--:--'}`;
  kpiCountElapsed.textContent = `Tempo em andamento: ${formatDurationFromMs(elapsedMs)}`;

  if (finished) {
    kpiCountEta.textContent = `Previsão de término: concluído às ${formatClock(endMs)}`;
    return;
  }

  const etaDate = estimateCountFinish(events, total);
  kpiCountEta.textContent = etaDate
    ? `Previsão de término: ${formatClock(etaDate)}`
    : 'Previsão de término: coletando dados...';
}

function startCountKpiTicker() {
  if (countKpiTicker) return;
  countKpiTicker = window.setInterval(() => {
    updateCountKpi(countProductsCache);
  }, 1000);
}

function updateCountProgress(products = countProductsCache) {
  if (!countProgressFill || !countProgressText) return;
  const { total, counted, percent } = computeCountProgressStats(products, loadCountEvents());
  if (!total) {
    countProgressFill.style.width = '0%';
    countProgressText.textContent = '0% dos produtos contados (0/0)';
    return;
  }

  countProgressFill.style.width = `${percent}%`;
  countProgressFill.classList.remove('is-low', 'is-mid', 'is-high');
  if (percent >= 80) {
    countProgressFill.classList.add('is-high');
  } else if (percent >= 40) {
    countProgressFill.classList.add('is-mid');
  } else {
    countProgressFill.classList.add('is-low');
  }
  countProgressText.textContent = `${percent}% dos produtos contados (${counted}/${total})`;
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
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeCountType(value) {
  return (value || '').trim().toLowerCase() === 'unidade' ? 'unidade' : 'caixa';
}

function makeCountTotalKey(itemCode, countType) {
  return `${normalizeItemCode(itemCode)}::${normalizeCountType(countType)}`;
}

function formatDateTime(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return date.toLocaleString('pt-BR');
}

function setFeedback(message, isError = false, isSuccess = false) {
  if (!countFeedback) return;
  countFeedback.textContent = message;
  if (isError) {
    countFeedback.style.color = 'var(--error)';
  } else if (isSuccess) {
    countFeedback.style.color = 'var(--success, #1b8744)';
  } else {
    countFeedback.style.color = 'var(--accent)';
  }
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
    li.className = 'users-list-item';
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.dataset.userId = String(user.id);
    const title = user.full_name || user.name || user.username || 'Usuário';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'users-list-name';
    nameSpan.textContent = title;
    const meta = document.createElement('small');
    meta.className = 'users-list-meta';
    meta.textContent = user.username || '';
    li.appendChild(nameSpan);
    li.appendChild(meta);
    const open = () => {
      if (currentRole === 'admin') openUserEditPanel(user);
    };
    li.addEventListener('click', open);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
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
    usersAdminCache = Array.isArray(users) ? users : [];
    renderUsersList(usersAdminCache);
  } catch {
    // silencia para nao quebrar UX
  }
}

function renderCountProducts(products) {
  if (!countProductsList || !countProductsTotal) return;
  countProductsList.innerHTML = '';
  countProductsTotal.textContent = `${products.length}`;
  updateCountProgress(products);
  updateCountKpi(products);
  const totalsByItemAndType = new Map(
    computeTotals(loadCountEvents()).map((row) => [makeCountTotalKey(row.itemCode, row.countType), row.qty]),
  );

  if (!products.length) {
    countProductsList.innerHTML = '<li><span>Nenhum produto encontrado para o filtro atual.</span><strong>0</strong></li>';
    return;
  }

  for (const product of products) {
    const li = document.createElement('li');
    li.className = 'count-product-item';
    
    const isInactive = (product.status || '').toLowerCase() === 'inativo';
    if (isInactive) {
      li.classList.add('is-inactive');
    }

    const itemCode = normalizeItemCode(product.cod_produto || product.cod_grup_sku || product.cod_grup_descricao || '');
    const codeText = (product.cod_produto || product.cod_grup_sku || '—').trim() || '—';
    const descText = (product.cod_grup_descricao || 'Sem descricao').trim() || 'Sem descricao';
    const brandText = (product.cod_grup_marca || '').trim();
    const label = document.createElement('span');
    label.className = 'count-product-label';
    const descEl = document.createElement('span');
    descEl.className = 'count-product-desc';
    descEl.textContent = isInactive ? `${descText} (INATIVO)` : descText;
    label.appendChild(descEl);

    const controls = document.createElement('div');
    controls.className = 'count-product-controls';

    const hasCode = Boolean(itemCode);

    const buildControlRow = (countType, focusByDefault = false) => {
      const row = document.createElement('div');
      row.className = 'count-control-row';

      const typeLabel = document.createElement('span');
      typeLabel.className = 'count-control-type';
      typeLabel.textContent = countType === 'caixa' ? 'Caixa' : 'Unidade';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'btn-count-adjust btn-minus';
      minusBtn.textContent = '-';
      minusBtn.setAttribute('aria-label', `Diminuir ${countType} de ${itemCode || 'item'}`);

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.inputMode = 'numeric';
      qtyInput.min = '0';
      qtyInput.step = '1';
      qtyInput.value = '0';
      qtyInput.className = 'count-product-qty';
      qtyInput.setAttribute('aria-label', `Quantidade de ${countType} para ${itemCode || 'item sem codigo'}`);
      qtyInput.setAttribute('pattern', '[0-9]*');

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'btn-count-adjust btn-plus';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', `Aumentar ${countType} de ${itemCode || 'item'}`);

      const totalEl = document.createElement('strong');
      totalEl.className = 'count-product-total';
      totalEl.textContent = `${totalsByItemAndType.get(makeCountTotalKey(itemCode, countType)) || 0}`;

      if (!hasCode) {
        qtyInput.disabled = true;
        minusBtn.disabled = true;
        plusBtn.disabled = true;
      }

      const applyDelta = (deltaSign) => {
        if (!hasCode) return;
        const rawVal = Number(qtyInput.value);
        const qtyBase = Number.isInteger(rawVal) && rawVal > 0 ? rawVal : 1;
        const delta = deltaSign * qtyBase;
        registerCountDelta(itemCode, delta, countType);
        const updatedTotals = new Map(
          computeTotals(loadCountEvents()).map((entry) => [makeCountTotalKey(entry.itemCode, entry.countType), entry.qty]),
        );
        totalEl.textContent = `${updatedTotals.get(makeCountTotalKey(itemCode, countType)) || 0}`;
        qtyInput.value = '0';
      };

      plusBtn.addEventListener('click', () => applyDelta(1));
      minusBtn.addEventListener('click', () => applyDelta(-1));

      row.appendChild(typeLabel);
      row.appendChild(minusBtn);
      row.appendChild(qtyInput);
      row.appendChild(plusBtn);
      row.appendChild(totalEl);

      return { row, qtyInput, focusByDefault };
    };

    const caixaControl = buildControlRow('caixa', true);
    const unidadeControl = buildControlRow('unidade');
    controls.appendChild(caixaControl.row);
    controls.appendChild(unidadeControl.row);

    // Clicar no card sempre prioriza o campo de caixa.
    const focusQty = () => {
      if (!hasCode) return;
      caixaControl.qtyInput.focus();
      caixaControl.qtyInput.select();
    };
    li.addEventListener('click', (e) => {
      const interactive = e.target instanceof HTMLElement && (
        e.target.closest('.btn-count-adjust') || e.target.closest('.count-product-qty')
      );
      if (interactive) return;
      focusQty();
    });
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
  const statusValue = countProductsStatusToggle?.checked ? 'todos' : 'ativo';
  const fetchCatalog = async (statusParam) => {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    params.set('status', statusParam);
    if (q) params.set('q', q);
    const resp = await apiFetch(`${API_PRODUCTS_CATALOG}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    return resp.json();
  };

  try {
    let products = await fetchCatalog(statusValue);
    if (products === null) {
      renderCountProducts([]);
      setFeedback('Nao foi possivel carregar a lista de produtos para contagem.', true);
      return;
    }

    countProductsCache = products;
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
  const label = online ? 'ONLINE' : 'OFFLINE';
  const background = online ? 'rgba(64, 179, 120, 0.28)' : 'rgba(217, 76, 76, 0.28)';

  if (netStatus) {
    netStatus.textContent = label;
    netStatus.style.background = background;
  }

  document.querySelectorAll('.net-status-sidebar').forEach((el) => {
    el.textContent = label;
    el.style.background = background;
  });
}

function computeTotals(events) {
  const totals = new Map();

  for (const event of events) {
    const countType = normalizeCountType(event.count_type);
    const key = makeCountTotalKey(event.item_code, countType);
    const current = totals.get(key) || 0;
    totals.set(key, current + event.quantity);
  }

  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fullKey, qty]) => {
      const [itemCode, countType = 'caixa'] = fullKey.split('::');
      return { itemCode, countType, qty };
    });
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
      const countTypeLabel = row.countType === 'unidade' ? 'Unidade' : 'Caixa';
      li.innerHTML = `<span>${row.itemCode} (${countTypeLabel})</span><strong>${row.qty}</strong>`;
      totalsList.appendChild(li);
    }
  }

  if (pending.length === 0) {
    pendingList.innerHTML = '<li><span>Sem pendencias para envio.</span><strong>OK</strong></li>';
  } else {
    const toRender = [...pending].sort((a, b) => b.observed_at.localeCompare(a.observed_at)).slice(0, 100);
    for (const event of toRender) {
      const li = document.createElement('li');
      const countTypeLabel = normalizeCountType(event.count_type) === 'unidade' ? 'Unidade' : 'Caixa';
      li.innerHTML = `<span>${event.item_code} (${countTypeLabel}) x ${event.quantity}</span><strong>${formatDateTime(event.observed_at)}</strong>`;
      pendingList.appendChild(li);
    }
  }

  totalItems.textContent = `${totals.length} itens`;
  pendingCount.textContent = `${pending.length} pendentes`;
  updateCountProgress(countProductsCache);
  updateCountKpi(countProductsCache);
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
          item_code: normalizeCountType(event.count_type) === 'unidade'
            ? `${event.item_code} [UN]`
            : `${event.item_code} [CX]`,
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
  registerCountDelta(itemCodeInput, 1, 'caixa');
}

function registerCountDelta(itemCodeInput, qtyDeltaInput, countTypeInput = 'caixa') {
  const itemCode = normalizeItemCode(itemCodeInput);
  const quantity = Number(qtyDeltaInput);
  const countType = normalizeCountType(countTypeInput);

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
    count_type: countType,
    quantity,
    observed_at: new Date().toISOString(),
    synced: false,
    device_name: getDeviceName(),
  };

  events.push(event);
  saveCountEvents(events);
  renderCounts();
  let productName = itemCode;
  if (typeof countProductsCache !== 'undefined' && Array.isArray(countProductsCache)) {
    const found = countProductsCache.find(
      p => normalizeItemCode(p.cod_produto || '') === itemCode || 
           normalizeItemCode(p.cod_grup_sku || '') === itemCode ||
           normalizeItemCode(p.cod_grup_descricao || '') === itemCode
    );
    if (found && found.cod_grup_descricao) {
      productName = found.cod_grup_descricao.trim();
    }
  }

  const countTypeLabel = countType === 'unidade' ? 'Unidade' : 'Caixa';
  setFeedback(`${productName} (${countTypeLabel}) salvo`, false, true);

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
        count_type: normalizeCountType(event.count_type),
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
    const response = await apiFetch(`${API_PRODUCTS}?limit=${PRODUCTS_LIST_LIMIT}`, {
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
    const failed = data.failed != null ? data.failed : 0;
    setProductImportFeedback(
      `Importacao: ${data.created} novos, ${data.updated} atualizados, ${data.ignored} ignorados` +
        (failed ? `, ${failed} falhas` : '') +
        '. Mesmo SKU = um cadastro. Muitos ignorados: revise colunas (codigo, descricao, SKU/EAN).',
    );
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
    const url = q ? `${API_PRODUCTS}?q=${encodeURIComponent(q)}&limit=${PRODUCTS_LIST_LIMIT}` : `${API_PRODUCTS}?limit=${PRODUCTS_LIST_LIMIT}`;
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
    const url = q ? `${API_PRODUCTS}?q=${encodeURIComponent(q)}&limit=${PRODUCTS_LIST_LIMIT}` : `${API_PRODUCTS}?limit=${PRODUCTS_LIST_LIMIT}`;
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
  renderRegisterAccessOptions();
  applyRegisterProfilePreset('admin');

  if (registerAccessAll) {
    registerAccessAll.addEventListener('change', () => {
      setAllRegisterAccess(registerAccessAll.checked);
      if (registerProfilePreset) {
        registerProfilePreset.value = registerAccessAll.checked ? 'admin' : 'custom';
      }
    });
  }

  if (registerProfilePreset) {
    registerProfilePreset.addEventListener('change', () => {
      if (registerProfilePreset.value === 'custom') return;
      applyRegisterProfilePreset(registerProfilePreset.value);
    });
  }

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.classList.contains('register-access-item')) {
      syncRegisterAllToggle();
      if (registerProfilePreset) {
        registerProfilePreset.value = 'custom';
      }
    }
    if (target.classList.contains('edit-access-item')) {
      syncEditAllToggle();
      if (editProfilePreset) editProfilePreset.value = 'custom';
    }
  });

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
    const allowedPages = getSelectedRegisterPages();

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
      if (registerProfilePreset) {
        registerProfilePreset.value = 'admin';
      }
      applyRegisterProfilePreset('admin');
      await loadUsersAdminList();
    } catch {
      setRegisterFeedback('Erro de conexão ao cadastrar usuário.', true);
    }
  });
}

if (editAccessMain) {
  renderEditAccessOptions();
}
if (editAccessAll) {
  editAccessAll.addEventListener('change', () => {
    setAllEditAccess(editAccessAll.checked);
    if (editProfilePreset) editProfilePreset.value = editAccessAll.checked ? 'admin' : 'custom';
  });
}
if (editProfilePreset && userEditForm) {
  editProfilePreset.addEventListener('change', () => {
    if (editProfilePreset.value === 'custom') return;
    applyEditProfilePreset(editProfilePreset.value);
  });
}
if (btnUserEditClose) {
  btnUserEditClose.addEventListener('click', closeUserEditPanel);
}
if (userEditForm) {
  userEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (currentRole !== 'admin') {
      setUserEditFeedback('Apenas admin pode editar usuários.', true);
      return;
    }
    const token = getToken();
    if (!token) return;

    const idRaw = document.getElementById('edit-user-id')?.value;
    const id = parseInt(idRaw, 10);
    if (!id || Number.isNaN(id)) {
      setUserEditFeedback('Usuário inválido.', true);
      return;
    }

    const name = document.getElementById('edit-user-name')?.value.trim() || '';
    const email = document.getElementById('edit-user-email')?.value.trim() || '';
    const phone = document.getElementById('edit-user-phone')?.value.trim() || '';
    const password = document.getElementById('edit-user-password')?.value || '';
    const role = document.getElementById('edit-user-role')?.value || 'conferente';
    const isActive = Boolean(document.getElementById('edit-user-active')?.checked);
    const allowedPages = getSelectedEditAccessPages();

    if (!name || !email) {
      setUserEditFeedback('Preencha nome e e-mail.', true);
      return;
    }
    if (!allowedPages.length) {
      setUserEditFeedback('Selecione ao menos um módulo de acesso.', true);
      return;
    }
    if (password && password.length < 6) {
      setUserEditFeedback('A nova senha deve ter ao menos 6 caracteres.', true);
      return;
    }

    const body = {
      full_name: name,
      username: email.toLowerCase(),
      phone: phone || null,
      role,
      is_active: isActive,
      allowed_pages: allowedPages,
    };
    if (password.length >= 6) {
      body.password = password;
    }

    setUserEditFeedback('Salvando...');
    try {
      const resp = await apiFetch(`/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (handleUnauthorizedResponse(resp)) return;
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setUserEditFeedback(err.detail || 'Falha ao salvar usuário.', true);
        return;
      }
      const data = await resp.json();
      const editedWasMe = userEditOriginalUsername;
      setUserEditFeedback('Alterações salvas.');
      closeUserEditPanel();
      await loadUsersAdminList();

      const me = getUser();
      const meUser = (me?.username || '').trim().toLowerCase();
      if (me && editedWasMe && meUser === editedWasMe) {
        saveSession(token, {
          ...me,
          username: data.username,
          full_name: data.full_name,
          name: data.full_name || data.username,
          email: data.username,
          phone: data.phone,
          role: data.role,
          allowed_pages: Array.isArray(data.allowed_pages) ? data.allowed_pages : [],
        });
        initDashboard(getUser());
      }
    } catch {
      setUserEditFeedback('Erro de conexão ao salvar.', true);
    }
  });
}

// ── Dashboard ───────────────────────────────────────────────────
function initDashboard(user) {
  const label = user?.full_name || user?.name || user?.username || 'Usuário';
  userDisplay.textContent = label;
  if (kpiCountUser) {
    kpiCountUser.textContent = `Contador: ${label}`;
  }
  currentRole = normalizeRole(user?.role || 'conferente') || 'conferente';
  currentAllowedPages = Array.isArray(user?.allowed_pages)
    ? user.allowed_pages.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    : [];
  if (roleDisplay) {
    roleDisplay.textContent = `Perfil: ${currentRole}`;
  }

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
  startCountKpiTicker();
  showDashboard();
}

// ── Logout ──────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => {
  if (countKpiTicker) {
    window.clearInterval(countKpiTicker);
    countKpiTicker = null;
  }
  clearSession();
  if (kpiCountUser) {
    kpiCountUser.textContent = 'Contador: --';
  }
  loginForm.reset();
  history.replaceState(null, '', APP_BASE_PATH);
  showLogin();
  closeSidebar();
});

// ── Sidebar Menu ────────────────────────────────────────────────
function openSidebar() {
  if (!sidebarMenu || !sidebarOverlay) return;
  sidebarMenu.classList.add('open');
  sidebarOverlay.classList.add('open');
}

function closeSidebar() {
  if (!sidebarMenu || !sidebarOverlay) return;
  sidebarMenu.classList.remove('open');
  sidebarOverlay.classList.remove('open');
}

if (btnMenuToggle) btnMenuToggle.addEventListener('click', openSidebar);
if (btnMenuClose) btnMenuClose.addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

if (moduleNav) {
  moduleNav.addEventListener('click', (e) => {
    if (e.target.classList.contains('module-btn')) {
      closeSidebar();
    }
  });
}

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
