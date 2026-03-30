
// Autocomplete para Grupo + filtro funcional
document.addEventListener('DOMContentLoaded', () => {
  const groupInput = document.getElementById('count-group');
  if (!groupInput) return;
  let suggestionBox = null;
  function closeSuggestions() {
    if (suggestionBox) {
      suggestionBox.remove();
      suggestionBox = null;
    }
  }
  groupInput.addEventListener('input', function() {
    closeSuggestions();
    const value = this.value.trim().toLowerCase();
    if (!value) {
      filtrarProdutos();
      return;
    }
    const matches = GROUPS.filter(g => g.toLowerCase().includes(value));
    if (!matches.length) return;
    suggestionBox = document.createElement('div');
    suggestionBox.className = 'autocomplete-suggestions';
    matches.forEach(g => {
      const opt = document.createElement('div');
      opt.className = 'autocomplete-suggestion';
      opt.textContent = g;
      opt.onclick = () => {
        groupInput.value = g;
        closeSuggestions();
        filtrarProdutos();
      };
      suggestionBox.appendChild(opt);
    });
    const rect = groupInput.getBoundingClientRect();
    suggestionBox.style.position = 'absolute';
    suggestionBox.style.left = rect.left + window.scrollX + 'px';
    suggestionBox.style.top = rect.bottom + window.scrollY + 'px';
    suggestionBox.style.width = rect.width + 'px';
    suggestionBox.style.zIndex = 1002;
    document.body.appendChild(suggestionBox);
  });
  groupInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
  groupInput.addEventListener('change', filtrarProdutos);
});

// Botão Ativo funcional + filtro
document.addEventListener('DOMContentLoaded', () => {
  const ativoToggle = document.getElementById('count-products-status-toggle');
  if (ativoToggle) {
    ativoToggle.disabled = false;
    ativoToggle.addEventListener('change', filtrarProdutos);
  }
});

// Filtro de produtos por grupo e ativo
function filtrarProdutos() {
  const grupo = (document.getElementById('count-group')?.value || '').trim().toLowerCase();
  const soAtivos = document.getElementById('count-products-status-toggle')?.checked;
  let totalVisiveis = 0;
  const visiveis = [];
  document.querySelectorAll('.count-product-item').forEach(item => {
    let show = true;
    // Filtro de ativos: se marcado, só mostra ativos
    if (soAtivos && item.classList.contains('is-inactive')) show = false;
    // Filtro de grupo: se preenchido, só mostra se o grupo bate
    if (grupo) {
      const desc = item.querySelector('.count-product-desc')?.textContent?.toLowerCase() || '';
      show = show && desc.includes(grupo);
    }
    item.style.display = show ? '' : 'none';
    if (show) {
      totalVisiveis++;
      visiveis.push(item);
    }
  });
  // Atualiza o total exibido
  const totalSpan = document.getElementById('count-products-total');
  if (totalSpan) totalSpan.textContent = totalVisiveis;
  // Atualiza barra de progresso após filtro
  updateCountProgress(visiveis.map(item => {
    // Recupera o código do produto do DOM
    const codeEl = item.querySelector('.count-product-code');
    return { cod_produto: codeEl ? codeEl.textContent : '' };
  }));
  // Atualiza chips de grupo selecionado
  const chipsContainer = document.getElementById('count-group-chips');
  if (chipsContainer) {
    chipsContainer.innerHTML = '';
    if (grupo) {
      const chip = document.createElement('span');
      chip.className = 'count-group-chip';
      chip.textContent = grupo;
      chipsContainer.appendChild(chip);
    }
  }
}

// Data da contagem predefinida hoje
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('count-date');
  if (dateInput && !dateInput.value) {
    const today = new Date();
    dateInput.value = today.toISOString().slice(0, 10);
  }
});

// Botão Ativo funcional
document.addEventListener('DOMContentLoaded', () => {
  const ativoToggle = document.getElementById('count-products-status-toggle');
  if (ativoToggle) {
    ativoToggle.disabled = false;
    ativoToggle.addEventListener('change', () => {
      // Chame aqui a função de filtro de produtos ativos
      // Exemplo: filtrarProdutosAtivos(ativoToggle.checked);
      // (implemente a lógica conforme seu app)
    });
  }
});
// === Grupos disponíveis para filtro (pode ser movido para API futuramente)
const GROUPS = [
  "Socorro Beb", "Dikoko", "Britvic", "Inga", "Santissima", "Mate couro", "Wow", "Grafrutalle", "Piraque", "Kydoidera", "Cory", "Selmi", "Brothers Paiol", "Salinas", "Arbor", "Heineken", "Cepal", "Arcor", "Nestle", "Tres Lobos", "Don Rigollo", "Jack Power", "Blue Bev", "Vanfall", "Itts", "Xeque Mate", "Perfetti", "Tampico", "Tapioca", "Tial", "Pergola", "Xa de Cana", "Açai Futuro", "Mais Coco", "Baly", "Ferreira", "Knofler", "Sunhot", "Seleta", "SP TT"
];

// Estado dos grupos selecionados
let selectedGroups = [];

function renderGroupChips() {
  const chipsContainer = document.getElementById('count-group-chips');
  if (!chipsContainer) return;
  chipsContainer.innerHTML = '';
  if (selectedGroups.length === 0) {
    // Mostra todos para seleção
    GROUPS.forEach(group => {
      const chip = document.createElement('button');
      chip.className = 'count-group-chip';
      chip.textContent = group;
      chip.onclick = () => {
        selectedGroups.push(group);
        renderGroupChips();
        // TODO: disparar filtro
      };
      chipsContainer.appendChild(chip);
    });
  } else {
    // Mostra chips selecionados com botão de remover
    selectedGroups.forEach(group => {
      const chip = document.createElement('span');
      chip.className = 'count-group-chip';
      chip.textContent = group;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'count-group-chip-remove';
      removeBtn.innerHTML = '×';
      removeBtn.onclick = () => {
        selectedGroups = selectedGroups.filter(g => g !== group);
        renderGroupChips();
        // TODO: disparar filtro
      };
      chip.appendChild(removeBtn);
      chipsContainer.appendChild(chip);
    });
    // Adicionar botão para adicionar mais
    if (selectedGroups.length < GROUPS.length) {
      const addBtn = document.createElement('button');
      addBtn.className = 'count-group-chip';
      addBtn.textContent = '+ Adicionar';
      addBtn.onclick = () => {
        // Mostra lista de grupos não selecionados
        const menu = document.createElement('div');
        menu.style.position = 'absolute';
        menu.style.background = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.zIndex = 1000;
        menu.style.padding = '6px 0';
        menu.style.borderRadius = '8px';
        GROUPS.filter(g => !selectedGroups.includes(g)).forEach(g => {
          const opt = document.createElement('div');
          opt.textContent = g;
          opt.style.padding = '6px 18px';
          opt.style.cursor = 'pointer';
          opt.onmouseover = () => opt.style.background = '#f4f4f4';
          opt.onmouseout = () => opt.style.background = '';
          opt.onclick = () => {
            selectedGroups.push(g);
            document.body.removeChild(menu);
            renderGroupChips();
            // TODO: disparar filtro
          };
          menu.appendChild(opt);
        });
        // Fecha menu ao clicar fora
        function closeMenu(e) {
          if (!menu.contains(e.target)) {
            document.body.removeChild(menu);
            document.removeEventListener('mousedown', closeMenu);
          }
        }
        document.addEventListener('mousedown', closeMenu);
        // Posiciona menu
        const rect = addBtn.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        document.body.appendChild(menu);
      };
      chipsContainer.appendChild(addBtn);
    }
  }
}

// Inicializar chips ao carregar tela de contagem
document.addEventListener('DOMContentLoaded', () => {
  renderGroupChips();
});
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
const API_STOCK_ANALYSIS = '/audit/stock-analysis';
const API_PRODUCTS = '/products';
/** Alinhado ao `le` em GET /products e /products/catalog (products.py). */
const PRODUCTS_LIST_LIMIT = 20000;
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

/** Limite efetivo; se o deploy for antigo (422), desce via downgradeLimitAfter422. */
let productsQueryLimitEffective = PRODUCTS_LIST_LIMIT;

const CATALOG_LIST_LIMIT = 20000;
let catalogQueryLimitEffective = CATALOG_LIST_LIMIT;

function downgradeLimitAfter422(current) {
  if (current > 10000) return 10000;
  if (current > 5000) return 5000;
  if (current > 2000) return 2000;
  if (current > 1000) return 1000;
  return current;
}

async function apiFetchProductsList(searchQuery) {
  const token = getToken();
  if (!token) return null;

  const buildUrl = (limit) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    const qt = (searchQuery || '').trim();
    if (qt) params.set('q', qt);
    return `${API_PRODUCTS}?${params.toString()}`;
  };

  let limit = productsQueryLimitEffective;
  let response = await apiFetch(buildUrl(limit), {
    headers: { Authorization: `Bearer ${token}` },
  });

  while (response.status === 422 && limit > 1000) {
    const next = downgradeLimitAfter422(limit);
    if (next >= limit) break;
    productsQueryLimitEffective = next;
    limit = next;
    response = await apiFetch(buildUrl(limit), {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return response;
}

function patchAccessFormAutofillHints() {
  const phone = document.getElementById('edit-user-phone');
  if (phone) {
    phone.setAttribute('autocomplete', 'tel');
    if ((phone.getAttribute('type') || '') === 'text') phone.setAttribute('type', 'tel');
  }
  const regPhone = document.getElementById('register-phone');
  if (regPhone) {
    regPhone.setAttribute('autocomplete', 'tel');
    if ((regPhone.getAttribute('type') || '') === 'text') regPhone.setAttribute('type', 'tel');
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
// Sempre manter o toggle "Ativo" marcado ao abrir o painel
if (countProductsStatusToggle) {
  countProductsStatusToggle.checked = true;
}
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
const countAuditDate = document.getElementById('count-audit-date');
// Inicializa campo de data para hoje por padrão
if (countAuditDate) {
  const today = new Date().toISOString().slice(0, 10);
  countAuditDate.value = today;
}
const btnCountAuditRefresh = document.getElementById('btn-count-audit-refresh');
const countAuditOnlyDiff = document.getElementById('count-audit-only-diff');
const countAuditFeedback = document.getElementById('count-audit-feedback');
const countAuditSummary = document.getElementById('count-audit-summary');
const countAuditList = document.getElementById('count-audit-list');
const countAuditTotal = document.getElementById('count-audit-total');
const countAuditImport = countAuditDate;
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
let countAuditPollingTimer = null;

const PAGE_KEYS_BY_MODULE = {
  contagem: ['contagem', 'count', 'recount', 'pull', 'return', 'break', 'direct-sale', 'validity', 'import-txt', 'count-audit'],
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
      { key: 'count-audit', label: 'Análise de Contagem' },
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
    'count-audit',
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
    'count-audit',
  ],
};

const MODULE_ACCESS = {
  contagem: ['conferente', 'administrativo', 'admin'],
  cadastro: ['administrativo', 'admin'],
  acesso: ['administrativo', 'admin'],
};

const SUB_MODULES = ['count', 'recount', 'pull', 'return', 'break', 'direct-sale', 'validity', 'import-txt', 'count-audit'];
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
  'import-txt': 'Importar Estoque',
  'count-audit': 'Análise de Contagem',
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

  // Para o polling de análise se estava ativo em outro submódulo
  if (countAuditPollingTimer && subKey !== 'count-audit') {
    clearInterval(countAuditPollingTimer);
    countAuditPollingTimer = null;
  }

  parentEl.querySelectorAll('.sub-section').forEach((s) => s.classList.remove('active'));

  const target = document.getElementById(`sub-${subKey}`);
  if (target) target.classList.add('active');

  if (subKey === 'produtos') {
    searchProdutos();
  } else if (subKey === 'preco-produtos') {
    searchPrecoProducts();
  } else if (subKey === 'count') {
    loadCountProducts();
  } else if (subKey === 'count-audit') {
    startCountAuditPolling();
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
    .map((p) => normalizeItemCode(p.cod_produto || p.cod_grup_descricao || ''))
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

function formatDateBR(value) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function formatIntegerBR(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('pt-BR');
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
    if (handleUnauthorizedResponse(resp)) return;
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

    const itemCode = normalizeItemCode(product.cod_produto || product.cod_grup_descricao || '');
    const codeText = (product.cod_produto || '—').trim() || '—';
    const descText = (product.cod_grup_descricao || 'Sem descricao').trim() || 'Sem descricao';
    const brandText = (product.cod_grup_marca || '').trim();
    const label = document.createElement('span');
    label.className = 'count-product-label';

    const codeEl = document.createElement('span');
    codeEl.className = 'count-product-code';
    codeEl.textContent = codeText;
    label.appendChild(codeEl);

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
    const descricao = (product.cod_grup_descricao || '').toLowerCase();
    const marca = (product.cod_grup_marca || '').toLowerCase();
    const codigo = (product.cod_produto || '').toLowerCase();
    return (
      codigo.includes(normalized)
      || descricao.includes(normalized)
      || marca.includes(normalized)
    );
  });
}

async function loadCountProducts() {
  if (!countProductsList) return;
  const token = getToken();
  if (!token) return;

  const q = '';
  const statusValue =
    countProductsStatusToggle && !countProductsStatusToggle.checked ? 'ativo' : 'todos';
  const fetchCatalog = async (statusParam) => {
    const buildUrl = (lim) => {
      const params = new URLSearchParams();
      params.set('limit', String(lim));
      params.set('status', statusParam);
      if (q) params.set('q', q);
      return `${API_PRODUCTS_CATALOG}?${params.toString()}`;
    };
    let lim = catalogQueryLimitEffective;
    let resp = await apiFetch(buildUrl(lim), {
      headers: { Authorization: `Bearer ${token}` },
    });
    while (resp.status === 422 && lim > 1000) {
      const next = downgradeLimitAfter422(lim);
      if (next >= lim) break;
      catalogQueryLimitEffective = next;
      lim = next;
      resp = await apiFetch(buildUrl(lim), {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (handleUnauthorizedResponse(resp)) return null;
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
    // Atualiza análise em tempo real se a aba estiver aberta
    const auditVisible = document.getElementById('sub-count-audit')?.classList.contains('active');
    if (auditVisible) {
      loadCountAuditAnalysis();
    }
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

function bindImportTxtEvents() {
  const form = document.getElementById('import-txt-form');
  const fileInput = document.getElementById('import-txt-file');
  const fileNameDisplay = document.getElementById('import-txt-filename');
  const feedback = document.getElementById('import-txt-feedback');
  const listEl = document.getElementById('import-txt-list');
  const detailsWrap = document.getElementById('import-txt-details');
  const detailsMeta = document.getElementById('import-txt-details-meta');
  const detailsItems = document.getElementById('import-txt-details-items');

  if (!form || !fileInput || !fileNameDisplay || !feedback || !listEl) return;

  const setImportFeedback = (msg, isError = false) => {
    feedback.textContent = msg;
    feedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
  };

  const loadImports = async () => {
    try {
      const response = await apiFetch('/inventory/imports', {
        headers: getAuthHeaders(),
      });
      if (handleUnauthorizedResponse(response)) return;
      if (!response.ok) {
        setImportFeedback('Erro ao carregar histórico.', true);
        return;
      }
      const data = await response.json();
      listEl.innerHTML = '';
      if (!data.length) {
        listEl.innerHTML = '<li><span>Nenhuma importação registrada ainda.</span></li>';
        if (detailsWrap) detailsWrap.style.display = 'none';
        return;
      }

      const showImportDetails = async (importId) => {
        if (!importId || !detailsWrap || !detailsMeta || !detailsItems) return;
        detailsWrap.style.display = 'block';
        detailsMeta.textContent = 'Carregando detalhes...';
        detailsItems.innerHTML = '';
        try {
          const detailResp = await apiFetch(`/inventory/imports/${importId}`, {
            headers: getAuthHeaders(),
          });
          if (handleUnauthorizedResponse(detailResp)) return;
          if (!detailResp.ok) {
            detailsMeta.textContent = 'Não foi possível carregar os detalhes.';
            return;
          }

          const detail = await detailResp.json();
          const items = Array.isArray(detail.items) ? detail.items : [];
          detailsMeta.textContent =
            `Data de referência: ${formatDateBR(detail.reference_date)} | Arquivo: ${detail.file_name || '-'} | ` +
            `Produtos lidos: ${formatIntegerBR(detail.total_products)} | Novos cadastros: ${formatIntegerBR(detail.created_products)}`;

          if (!items.length) {
            detailsItems.innerHTML = '<li><span>Nenhum item encontrado nesta importação.</span></li>';
            return;
          }

          const top = items.slice(0, 200);
          for (const it of top) {
            const li = document.createElement('li');
            if (it.pre_registered) {
              li.classList.add('import-item-pre-registered');
              // Exibe apenas CX e UNI (saldo físico)
              const cx = it.saldo_cx || 0;
              const uni = it.saldo_uni || 0;
              li.innerHTML = `<span><strong>${it.cod_produto || '-'}<\/strong> - ${it.descricao || '-'} <span class="status-badge badge-active">PRÉ-CADASTRADO<\/span><\/span>` +
                             `<span class="muted">CX ${cx} UNI ${uni}<\/span>`;
              if (it.product_id) {
                const btnEdit = document.createElement('button');
                btnEdit.type = 'button';
                btnEdit.className = 'btn-secondary btn-dark';
                btnEdit.textContent = 'Editar cadastro';
                btnEdit.addEventListener('click', async (event) => {
                  event.stopPropagation();
                  if (!canAccessHash('produtos')) {
                    setImportFeedback('Seu perfil não possui acesso ao módulo de produtos para edição.', true);
                    return;
                  }
                  setActiveModule('produtos');
                  await openEditProduct(it.product_id);
                });
                li.appendChild(btnEdit);
              }
            } else {
              const badge = '<span class="status-badge">IMPORTADO<\/span>';
              const metricsRaw = Array.isArray(it.metrics?.raw) ? it.metrics.raw.join(' ') : '-';
              li.innerHTML = `<span><strong>${it.cod_produto || '-'}<\/strong> - ${it.descricao || '-'} ${badge}<\/span>` +
                             `<span class="muted">Métricas: ${metricsRaw}<\/span>`;
            }
            detailsItems.appendChild(li);
          }

          if (items.length > top.length) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="muted">Mostrando ${formatIntegerBR(top.length)} de ${formatIntegerBR(items.length)} itens.</span>`;
            detailsItems.appendChild(li);
          }
        } catch {
          detailsMeta.textContent = 'Falha de conexão ao carregar detalhes.';
        }
      };


      for (const item of data) {
        const li = document.createElement('li');
        li.className = 'import-txt-card';
        li.innerHTML = `
          <div class="import-txt-card-main" title="Clique para ver detalhes">
            <div class="import-txt-card-meta">
              <span class="import-txt-card-date">${formatDateBR(item.reference_date)}</span>
              <span class="import-txt-card-file">${item.file_name || '-'}</span>
            </div>
            <div class="import-txt-card-info">
              <span class="import-txt-card-prod">Produtos: <strong>${formatIntegerBR(item.total_products)}</strong></span>
              <span class="import-txt-card-new">Novos: <strong class="badge-active status-badge">${formatIntegerBR(item.created_products)}</strong></span>
            </div>
          </div>
          <button type="button" class="import-txt-delete-btn" title="Excluir importação" aria-label="Excluir importação">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7.5 8.5v5m5-5v5M3 5.5h14M5.5 5.5V15a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V5.5" stroke="#b42318" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 3.5h3a1 1 0 0 1 1 1V5.5h-5V4.5a1 1 0 0 1 1-1Z" stroke="#b42318" stroke-width="1.5"/></svg>
          </button>
        `;
        li.querySelector('.import-txt-card-main').addEventListener('click', () => showImportDetails(item.id));
        li.querySelector('.import-txt-delete-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Tem certeza que deseja excluir esta importação? Esta ação não pode ser desfeita.')) return;
          try {
            const resp = await apiFetch(`/inventory/imports/${item.id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
            });
            if (handleUnauthorizedResponse(resp)) return;
            if (!resp.ok) {
              setImportFeedback('Erro ao excluir importação.', true);
              return;
            }
            setImportFeedback('Importação excluída com sucesso.', false);
            await loadImports();
            if (detailsWrap) detailsWrap.style.display = 'none';
          } catch {
            setImportFeedback('Erro de conexão ao excluir.', true);
          }
        });
        listEl.appendChild(li);
      }

    } catch {
      setImportFeedback('Falha de conexão ao carregar histórico.', true);
    }
  };

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    fileNameDisplay.textContent = file ? file.name : 'Nenhum arquivo...';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];
    const dateRef = document.getElementById('import-txt-date').value;
    
    if (!file) {
      setImportFeedback('Selecione o arquivo.', true);
      return;
    }
    if (!dateRef) {
      setImportFeedback('Data de referência obrigatória.', true);
      return;
    }

    const formData = new FormData();
    formData.append('reference_date', dateRef);
    formData.append('file', file);

    const btn = document.getElementById('btn-import-txt');
    btn.disabled = true;
    setImportFeedback('Importando, aguarde...');

    try {
      const response = await apiFetch('/inventory/import-txt', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      if (handleUnauthorizedResponse(response)) {
        btn.disabled = false;
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setImportFeedback(err.detail || 'Falha ao importar.', true);
        btn.disabled = false;
        return;
      }

      const resData = await response.json();
      form.reset();
      fileNameDisplay.textContent = 'Nenhum arquivo...';
      setImportFeedback(`Sucesso! ${formatIntegerBR(resData.total_products)} produtos lidos e ${formatIntegerBR(resData.created_products)} novos produtos cadastrados.`);
      await loadImports();
    } catch {
      setImportFeedback('Erro de conexão.', true);
    } finally {
      btn.disabled = false;
    }
  });

  // Load exactly when active
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.classList.contains('active')) {
        loadImports();
      }
    });
  });
  const subSection = document.getElementById('sub-import-txt');
  if (subSection) {
    observer.observe(subSection, { attributes: true, attributeFilter: ['class'] });
  }
}

async function startCountAuditPolling() {
  // Para timer anterior se existir
  if (countAuditPollingTimer) {
    clearInterval(countAuditPollingTimer);
    countAuditPollingTimer = null;
  }

  // Sincroniza eventos pendentes antes de carregar a análise
  if (navigator.onLine && getToken()) {
    setCountAuditFeedback('Sincronizando contagens...', false);
    await syncPendingEventsForAudit();
  }

  await loadCountAuditAnalysis();

  // Polling: a cada 30s sincroniza + recarrega a análise enquanto a aba estiver ativa
  countAuditPollingTimer = setInterval(async () => {
    const auditVisible = document.getElementById('sub-count-audit')?.classList.contains('active');
    if (!auditVisible) {
      clearInterval(countAuditPollingTimer);
      countAuditPollingTimer = null;
      return;
    }
    if (navigator.onLine && getToken()) {
      await syncPendingEventsForAudit();
    }
    await loadCountAuditAnalysis();
  }, 30000);
}

// Versão silenciosa do sync que não mexe no feedback da tela de contagem
async function syncPendingEventsForAudit() {
  if (syncInProgress) return;
  const token = getToken();
  if (!token) return;
  const events = loadCountEvents();
  const pending = events.filter((e) => !e.synced);
  if (!pending.length) return;

  try {
    const response = await apiFetch(API_SYNC_COUNTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    if (!response.ok) return;
    const data = await response.json();
    const syncedIds = new Set(data.synced_ids || []);
    const updated = events.map((ev) =>
      syncedIds.has(ev.client_event_id) ? { ...ev, synced: true, synced_at: new Date().toISOString() } : ev
    );
    saveCountEvents(updated);
  } catch {
    // silencioso — falha de rede não interrompe a análise
  }
}

function setCountAuditFeedback(message, isError = false) {
  if (!countAuditFeedback) return;
  countAuditFeedback.textContent = message || '';
  countAuditFeedback.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

async function loadCountAuditImports() {
  // Não faz mais nada: campo de data é livre
  return [];
}

function renderCountAuditSummary(summary) {
  if (!countAuditSummary) return;
  const s = summary || {};
  countAuditSummary.innerHTML = '';
  const rows = [
    ['Itens com saldo', Number(s.total_import_items) || 0, 'is-neutral'],
    ['Itens com contagem', Number(s.counted_items) || 0, 'is-info'],
    ['Conferidos', Number(s.equal_items) || 0, 'is-ok'],
    ['Divergências', Number(s.divergent_items) || 0, 'is-warn'],
    ['Sem contagem', Number(s.missing_in_count) || 0, 'is-danger'],
    ['Só na contagem', Number(s.extra_in_count) || 0, 'is-purple'],
  ];
  for (const [label, value, tone] of rows) {
    const li = document.createElement('li');
    li.className = `count-audit-summary-item ${tone}`;
    li.innerHTML =
      `<span class="count-audit-summary-label">${label}</span>` +
      `<strong class="count-audit-summary-value">${formatIntegerBR(value)}</strong>`;
    countAuditSummary.appendChild(li);
  }
}

function renderCountAuditRows(rows) {
  if (!countAuditList || !countAuditTotal) return;
  let list = Array.isArray(rows) ? rows : [];
  // Filtro de pesquisa
  const searchInput = document.getElementById('count-audit-search');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (searchTerm) {
    list = list.filter(row => {
      const cod = (row.cod_produto || '').toLowerCase();
      const desc = (row.descricao || '').toLowerCase();
      return cod.includes(searchTerm) || desc.includes(searchTerm);
    });
  }
  // Ordenação: código (numérico), depois descrição (alfabética)
  list = [...list].sort((a, b) => {
    const codeA = (a.cod_produto || '').padStart(10, '0');
    const codeB = (b.cod_produto || '').padStart(10, '0');
    if (codeA < codeB) return -1;
    if (codeA > codeB) return 1;
    const descA = (a.descricao || '').toLowerCase();
    const descB = (b.descricao || '').toLowerCase();
    return descA.localeCompare(descB);
  });
  // Itens com diferença zerada vão para o final
  const diffZero = [];
  const diffOthers = [];
  for (const row of list) {
    const diffCx = Number(row.difference_caixa) || 0;
    const diffUn = Number(row.difference_unidade) || 0;
    if (diffCx === 0 && diffUn === 0) {
      diffZero.push(row);
    } else {
      diffOthers.push(row);
    }
  }
  list = [...diffOthers, ...diffZero];
  countAuditList.innerHTML = '';
  countAuditTotal.textContent = String(list.length);
  if (!list.length) {
    countAuditList.innerHTML = '<li class="count-audit-empty"><span>Nenhuma divergência encontrada para os filtros atuais.</span><strong>OK</strong></li>';
    return;
  }
  for (const row of list) {
    const li = document.createElement('li');
    let statusClass = 'is-ok';
    let statusLabel = 'OK';
    if (row.status === 'missing_in_count') {
      statusLabel = 'SEM CONTAGEM';
      statusClass = 'is-danger';
    } else if (row.status === 'extra_in_count') {
      statusLabel = 'SO NA CONTAGEM';
      statusClass = 'is-purple';
    } else if (row.status === 'divergent') {
      statusLabel = 'CONTAGEM';
      statusClass = 'is-warn';
    }
    const diffCx = Number(row.difference_caixa) || 0;
    const diffUn = Number(row.difference_unidade) || 0;
    const diffCxText = diffCx > 0 ? `+${formatIntegerBR(diffCx)}` : `${formatIntegerBR(diffCx)}`;
    const diffUnText = diffUn > 0 ? `+${formatIntegerBR(diffUn)}` : `${formatIntegerBR(diffUn)}`;
    li.className = `count-audit-item ${statusClass}`;
    li.innerHTML =
      `<div class="count-audit-item-head">` +
        `<div class="count-audit-item-title">` +
          `<span class="count-audit-item-code">${row.cod_produto || '-'}</span>` +
          `<strong class="count-audit-item-desc">${row.descricao || 'Sem descrição'}</strong>` +
        `</div>` +
        `<span class="count-audit-badge ${statusClass}">${statusLabel}</span>` +
      `</div>` +
      `<div class="count-audit-metrics">` +
        `<div class="count-audit-metric count-audit-balance">` +
          `<span class="count-audit-metric-label">Saldo</span>` +
          `<strong class="count-audit-metric-value">CX ${formatIntegerBR(Number(row.import_caixa) || 0)} | UN ${formatIntegerBR(Number(row.import_unidade) || 0)}</strong>` +
        `</div>` +
        `<div class="count-audit-metric count-audit-counted">` +
          `<span class="count-audit-metric-label">Contagem</span>` +
          `<strong class="count-audit-metric-value">CX ${formatIntegerBR(Number(row.counted_caixa) || 0)} | UN ${formatIntegerBR(Number(row.counted_unidade) || 0)}</strong>` +
        `</div>` +
        `<div class="count-audit-metric count-audit-diff ${statusClass}">` +
          `<span class="count-audit-metric-label">Diferença</span>` +
          `<strong class="count-audit-metric-value">CX ${diffCxText} | UN ${diffUnText}</strong>` +
        `</div>` +
      `</div>`;
    countAuditList.appendChild(li);
  }
}
// Eventos para barra de pesquisa na análise de contagem
const countAuditSearch = document.getElementById('count-audit-search');
const countAuditClearSearch = document.getElementById('count-audit-clear-search');
if (countAuditSearch) {
  countAuditSearch.addEventListener('input', () => {
    // Re-renderiza usando último payload
    if (window.lastCountAuditRows) {
      renderCountAuditRows(window.lastCountAuditRows);
    }
    countAuditClearSearch.style.display = countAuditSearch.value ? '' : 'none';
  });
}
if (countAuditClearSearch) {
  countAuditClearSearch.addEventListener('click', () => {
    countAuditSearch.value = '';
    countAuditClearSearch.style.display = 'none';
    if (window.lastCountAuditRows) {
      renderCountAuditRows(window.lastCountAuditRows);
    }
    countAuditSearch.focus();
  });
}

async function loadCountAuditAnalysis() {
  if (!countAuditImport || !countAuditList) return;
  const token = getToken();
  if (!token) return;

  try {
    const referenceDate = (countAuditImport.value || '').trim();
    const onlyDiff = countAuditOnlyDiff ? countAuditOnlyDiff.checked : true;
    const params = new URLSearchParams();
    if (referenceDate) params.set('reference_date', referenceDate);
    params.set('only_diff', onlyDiff ? 'true' : 'false');
    params.set('limit', '1000');

    const response = await apiFetch(`${API_STOCK_ANALYSIS}?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setCountAuditFeedback(err.detail || 'Falha ao carregar análise de contagem.', true);
      return;
    }

    const payload = await response.json();
    const info = payload.import;
    if (info) {
      setCountAuditFeedback(`Base de saldo: ${info.reference_date || '-'} (${info.file_name || 'arquivo'})`);
    } else {
      setCountAuditFeedback('Nenhuma importação TXT encontrada para esta data.', true);
    }

    renderCountAuditSummary(payload.summary || {});
    window.lastCountAuditRows = payload.rows || [];
    renderCountAuditRows(window.lastCountAuditRows);
  } catch {
    setCountAuditFeedback('Erro de conexão ao carregar análise de contagem.', true);
  }
}

function bindCountAuditEvents() {
  if (!btnCountAuditRefresh && !countAuditImport && !countAuditOnlyDiff) return;

  if (btnCountAuditRefresh) {
    btnCountAuditRefresh.addEventListener('click', () => {
      loadCountAuditAnalysis();
    });
  }

  if (countAuditImport) {
    countAuditImport.addEventListener('change', () => {
      loadCountAuditAnalysis();
    });
  }

  if (countAuditOnlyDiff) {
    countAuditOnlyDiff.addEventListener('change', () => {
      loadCountAuditAnalysis();
    });
  }
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
    const response = await apiFetchProductsList(null);
    if (!response) return;
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

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const detail = String(err.detail || 'Falha ao importar arquivo.');
      if (detail.toLowerCase().includes('uq_product_sku') || detail.toLowerCase().includes('cod_grup_sku')) {
        setProductImportFeedback('Falha ao importar: banco ainda com regra legada de SKU único. Aguarde o deploy e tente novamente.', true);
      } else {
        setProductImportFeedback(detail, true);
      }
      return;
    }

    const data = await response.json();
    const created = Number(data.created) || 0;
    const updated = Number(data.updated) || 0;
    const ignored = Number(data.ignored) || 0;
    const failed = data.failed != null ? Number(data.failed) || 0 : 0;
    const rawDistinct =
      data.distinct_product_codes_touched != null
        ? data.distinct_product_codes_touched
        : data.distinct_skus_touched;
    const distinctCodes = rawDistinct != null ? Number(rawDistinct) : null;
    const totalInDb =
      data.total_products_in_db != null ? Number(data.total_products_in_db) : null;
    const rowOps = created + updated;

    let msg = `Importacao: ${created} novos, ${updated} linhas atualizadas na planilha, ${ignored} ignorados`;
    if (failed > 0) msg += `, ${failed} falhas`;
    msg +=
      '. No cadastro, cada codigo de produto = um registro (varias linhas com o mesmo codigo atualizam o mesmo item).';

    if (distinctCodes != null && Number.isFinite(distinctCodes)) {
      msg += ` Codigos de produto distintos neste arquivo: ${distinctCodes}.`;
    }
    if (totalInDb != null && Number.isFinite(totalInDb)) {
      msg += ` Total de produtos no sistema agora: ${totalInDb} (e o que a lista deve mostrar ao buscar vazio).`;
    }
    if (distinctCodes != null && rowOps > distinctCodes) {
      const tot = totalInDb != null && Number.isFinite(totalInDb) ? String(totalInDb) : '?';
      msg += ` A planilha tinha ${rowOps} linhas com dados, mas so ${distinctCodes} codigos diferentes: o cadastro guarda um produto por codigo (total no banco agora: ${tot}), nao uma linha por linha da planilha.`;
    }

    if (ignored > 0) {
      msg +=
        ' Linhas ignoradas: confira codigo, descricao e SKU/EAN (cabecalhos e celulas vazias).';
    }

    if (failed > 0) {
      msg += ' Revise linhas com falha (formato ou erro no servidor).';
    }

    setProductImportFeedback(msg);
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
    const resp = await apiFetchProductsList(q);
    if (!resp) return;
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
    if (!resp.ok) {
      if (resp.status === 403) {
        setProdutosFeedback('Seu perfil não possui permissão para editar produtos.', true);
      } else if (resp.status === 404) {
        setProdutosFeedback('Produto não encontrado.', true);
      } else {
        setProdutosFeedback('Falha ao carregar produto para edição.', true);
      }
      return;
    }
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
    const resp = await apiFetchProductsList(q);
    if (!resp) return;
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
  patchAccessFormAutofillHints();
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
  bindCountAuditEvents();
  bindImportTxtEvents();
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
