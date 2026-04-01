/** Data civil em America/Sao_Paulo (YYYY-MM-DD). */
function getBrazilDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getActiveCountDateKey() {
  const el = document.getElementById('count-date');
  const v = (el && el.value || '').trim();
  return v || getBrazilDateKey();
}

function isCountOperationalEditable() {
  return getActiveCountDateKey() === getBrazilDateKey();
}

function getActiveValidityOpDateKey() {
  const el = document.getElementById('validity-op-date');
  const v = (el && el.value || '').trim();
  return v || getBrazilDateKey();
}

function isValidityOperationalEditable() {
  return getActiveValidityOpDateKey() === getBrazilDateKey();
}

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

// Filtro de produtos por grupo (contagem: apenas ativos na API e na renderização)

// Filtro de produtos por grupo e ativo
function filtrarProdutos() {
  const grupo = (document.getElementById('count-group')?.value || '').trim().toLowerCase();
  let totalVisiveis = 0;
  const visiveis = [];
  document.querySelectorAll('.count-product-item').forEach(item => {
    let show = true;
    // Filtro de ativos: só mostra ativos (is-inactive = oculto)
    if (item.classList.contains('is-inactive')) show = false;
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
    const inp = item.querySelector('input.count-product-qty[data-coderef]');
    const codRef = inp?.getAttribute('data-coderef');
    const cod_produto = codRef ? decodeURIComponent(codRef) : '';
    return { cod_produto };
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

// Data da contagem predefinida: hoje em America/Sao_Paulo (não UTC)
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('count-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = getBrazilDateKey();
  }
  const validityDate = document.getElementById('validity-op-date');
  if (validityDate && !validityDate.value) {
    validityDate.value = getBrazilDateKey();
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

// Chips de grupo na tela de contagem (não alterar login/dashboard aqui: init() já chama showLogin/showDashboard)
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
const API_STOCK_ANALYSIS_EXPORT_XLSX = '/audit/stock-analysis/export.xlsx';
const API_IMPORT_BALANCES = '/audit/import-balances';
const API_COUNT_SERVER_TOTALS = '/audit/count-server-totals';
const API_LAST_COUNT_PER_PRODUCT = '/audit/last-count-per-product';
const API_VALIDITY_EVENTS = '/audit/validity-events';
const API_VALIDITY_LINES = '/audit/validity-lines';
const VALIDITY_BUCKET_KEY = 'estoque_validity_by_day_v1';
const VALIDITY_LAST_SYNC_KEY = 'estoque_validity_last_sync_iso';
/** Dias sem nova contagem para considerar a base "antiga" (painel analítico). */
const VALIDITY_OLD_BASE_DAYS = 14;
const API_PRODUCTS = '/products';
/** Alinhado ao `le` em GET /products e /products/catalog (products.py). */
const PRODUCTS_LIST_LIMIT = 20000;
const API_PRODUCTS_CATALOG = '/products/catalog';
const API_AUTH_ME = '/auth/me';
const API_PRODUCTS_IMPORT_EXCEL = '/products/import-excel';
const APP_BASE_PATH = '/app';
if ('scrollRestoration' in history) {
  try {
    history.scrollRestoration = 'manual';
  } catch {
    /* ignore */
  }
}
const TOKEN_KEY  = 'estoque_token';
const USER_KEY   = 'estoque_user';
const COUNT_EVENTS_KEY = 'estoque_count_events_v1';
/** Saldo CX/UN do último TXT (ou data em #count-date), para comparar na contagem (sem exibir valores na UI). */
let countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
let validityProductsCache = [];
let validityServerLines = [];
/** Última contagem global por produto: CX/UN + count_date (ChangeLog, servidor). */
let validityLastCountState = { ok: false, balances: {} };
/** KPI clicável ativo (filtro rápido); null = nenhum. */
let validityActiveKpiKey = null;
/** Totais CX/UN já sincronizados no servidor (todos os conferentes). */
let countServerCountState = { ok: false, balances: {} };
const COUNT_EVENTS_DAY_KEY = 'estoque_count_events_day_v1';
/** Mapa por dia (YYYY-MM-DD): { "2026-04-01": [ eventos... ] } */
const COUNT_EVENTS_BUCKET_KEY = 'estoque_count_events_by_day_v2';
const DEVICE_NAME_KEY = 'estoque_device_name_v1';
/** Evita múltiplos clearSession/showLogin quando várias respostas 401 chegam ao mesmo tempo. */
let unauthorizedRedirectInProgress = false;
let loadServerCountTotalsInFlight = null;
let countTotalsVisibilityRefreshTimer = null;
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

function getProdutosStatusFilters() {
  const a = document.getElementById('produtos-filter-ativo');
  const i = document.getElementById('produtos-filter-inativo');
  const p = document.getElementById('produtos-filter-precadastro');
  const out = [];
  if (a?.checked) out.push('ativo');
  if (i?.checked) out.push('inativo');
  if (p?.checked) out.push('pre-cadastro');
  return out;
}

async function apiFetchProductsList(searchQuery, statusFilters) {
  const token = getToken();
  if (!token) return null;
  if (isAccessTokenExpired(token)) {
    handleUnauthorizedResponse({ status: 401 });
    return null;
  }

  const buildUrl = (limit) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    const qt = (searchQuery || '').trim();
    if (qt) params.set('q', qt);
    if (Array.isArray(statusFilters) && statusFilters.length > 0) {
      const full =
        statusFilters.length === 3 &&
        statusFilters.includes('ativo') &&
        statusFilters.includes('inativo') &&
        statusFilters.includes('pre-cadastro');
      if (!full) {
        statusFilters.forEach((s) => {
          const t = String(s || '').trim().toLowerCase();
          if (t) params.append('status', t);
        });
      }
    }
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
const countProductsList = document.getElementById('count-products-list');
const countProductsListDone = document.getElementById('count-products-list-done');
const countProductsDoneWrap = document.getElementById('count-products-done-wrap');
const countProductsTotal = document.getElementById('count-products-total');
const countProgressFill = document.getElementById('count-progress-fill');
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
const btnCountAuditExportExcel = document.getElementById('btn-count-audit-export-excel');
const countAuditOnlyDiff = document.getElementById('count-audit-only-diff');
const countAuditFeedback = document.getElementById('count-audit-feedback');
const countAuditSummary = document.getElementById('count-audit-summary');
const countAuditList = document.getElementById('count-audit-list');
const countAuditTotal = document.getElementById('count-audit-total');
const countAuditImport = countAuditDate;
const roleDisplay = document.getElementById('role-display');
const moduleNav = document.getElementById('module-nav');
const pageTitleEl = document.getElementById('sidebar-page-title');
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
  contagem: ['contagem', 'count', 'pull', 'return', 'break', 'direct-sale', 'validity', 'import-txt', 'count-audit'],
  cadastro: ['cadastro', 'cadastro-produto', 'produtos', 'parametros-produto'],
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
      { key: 'pull', label: 'Puxada' },
      { key: 'return', label: 'Devolução' },
      { key: 'break', label: 'Quebra' },
      { key: 'direct-sale', label: 'Venda Direta' },
      { key: 'validity', label: 'Data de Vencimento' },
      { key: 'import-txt', label: 'Importar Estoque (TXT)' },
      { key: 'count-audit', label: 'Análise de Contagem' },
    ],
  },
  {
    container: () => registerAccessCadastro,
    items: [
      { key: 'cadastro-produto', label: 'Cadastro de Produto' },
      { key: 'produtos', label: 'Produtos' },
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
    'pull',
    'return',
    'break',
    'direct-sale',
    'validity',
    'import-txt',
    'count-audit',
    'cadastro-produto',
    'produtos',
    'parametros-produto',
  ],
  conferente: [
    'contagem',
    'count',
    'pull',
    'return',
    'break',
    'direct-sale',
    'validity',
    'import-txt',
    /* count-audit: só com permissão explícita no cadastro do usuário (não no preset) */
  ],
};

const MODULE_ACCESS = {
  contagem: ['conferente', 'administrativo', 'admin'],
  cadastro: ['administrativo', 'admin'],
  acesso: ['administrativo', 'admin'],
};

const SUB_MODULES = ['count', 'pull', 'return', 'break', 'direct-sale', 'validity', 'import-txt', 'count-audit'];
const CADASTRO_SUBS = ['cadastro-produto', 'produtos', 'parametros-produto'];
const SUB_TO_PARENT = {};
SUB_MODULES.forEach(s => { SUB_TO_PARENT[s] = 'contagem'; });
CADASTRO_SUBS.forEach(s => { SUB_TO_PARENT[s] = 'cadastro'; });

/** Não liberar só por ter "contagem" em allowed_pages (auditoria / análise). */
const SUB_KEYS_REQUIRE_EXPLICIT_ALLOWED = new Set(['count-audit']);

const PAGE_TITLES = {
  inicio: 'Página inicial',
  contagem: 'Contagem',
  cadastro: 'Cadastro',
  acesso: 'Acesso',
  count: 'Contagem',
  pull: 'Puxada',
  return: 'Devolução',
  break: 'Quebra',
  'direct-sale': 'Venda Direta',
  validity: 'Data de Vencimento',
  'import-txt': 'Importar Estoque',
  'count-audit': 'Análise de Contagem',
  'cadastro-produto': 'Cadastro de Produto',
  produtos: 'Produtos',
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
  if (moduleKey === 'inicio') return true;
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
  } else if (subKey === 'count') {
    loadCountProducts();
  } else if (subKey === 'count-audit') {
    startCountAuditPolling();
  } else if (subKey === 'validity') {
    loadValidityModule();
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
  const normalized = String(moduleKey || '').trim().toLowerCase();
  // Submódulo removido: links antigos (#preco-produtos) vão para Cadastro
  if (normalized === 'preco-produtos') {
    if (updateHistory) {
      history.replaceState(null, '', `${APP_BASE_PATH}#cadastro`);
    }
    setActiveModule('cadastro', false);
    return;
  }
  // Módulo Recontagem removido: hash antigo (#recount) volta à home de Contagem
  if (normalized === 'recount') {
    if (updateHistory) {
      history.replaceState(null, '', `${APP_BASE_PATH}#contagem`);
    }
    setActiveModule('contagem', false);
    return;
  }

  // Página inicial: não existe #module-inicio no DOM; home operacional é a de Contagem
  const lookupKey = normalized === 'inicio' ? 'contagem' : normalized;
  const parentKey = SUB_TO_PARENT[lookupKey];
  const actualModule = parentKey || lookupKey;
  const subKey = parentKey ? lookupKey : null;

  document.querySelectorAll('.module-section').forEach((section) => {
    section.classList.remove('active');
  });

  const target = document.getElementById(`module-${actualModule}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.module-btn').forEach((btn) => {
    const btnMod = (btn.dataset.module || '').trim().toLowerCase();
    const isActive =
      normalized === 'inicio'
        ? btnMod === 'inicio'
        : btnMod === actualModule;
    btn.classList.toggle('active', isActive);
  });

  const pageTitle = PAGE_TITLES[normalized] || PAGE_TITLES[actualModule] || 'Estoque';
  if (pageTitleEl) {
    pageTitleEl.textContent = pageTitle;
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
  const k = String(hashKey || '').trim().toLowerCase();
  if (!k) return false;

  if (k === 'inicio') {
    return canAccessModule('contagem');
  }

  if (SUB_KEYS_REQUIRE_EXPLICIT_ALLOWED.has(k)) {
    if (currentAllowedPages.length) {
      return currentAllowedPages.includes(k);
    }
    return ['administrativo', 'admin'].includes(currentRole);
  }

  if (currentAllowedPages.length) {
    if (currentAllowedPages.includes(k)) return true;
    const parent = SUB_TO_PARENT[k];
    if (parent && currentAllowedPages.includes(parent)) return true;
    return false;
  }
  const parent = SUB_TO_PARENT[k];
  if (parent) return canAccessModule(parent);
  return canAccessModule(k);
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
      setActiveModule(firstVisible, false);
      if (hashModule && hashModule !== firstVisible) {
        const hashForUrl = firstVisible === 'inicio' ? 'contagem' : firstVisible;
        history.replaceState(null, '', `${APP_BASE_PATH}#${hashForUrl}`);
      }
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

function migrateLegacyCountEventsIfNeeded() {
  try {
    if (localStorage.getItem(COUNT_EVENTS_BUCKET_KEY)) return;
    const legacy = localStorage.getItem(COUNT_EVENTS_KEY);
    if (!legacy) return;
    const oldDay = localStorage.getItem(COUNT_EVENTS_DAY_KEY) || getBrazilDateKey();
    let arr = [];
    try {
      arr = JSON.parse(legacy);
    } catch {
      return;
    }
    if (!Array.isArray(arr) || arr.length === 0) return;
    const bucket = {};
    bucket[oldDay] = arr.map((e) => ({ ...e, count_date: e.count_date || oldDay }));
    localStorage.setItem(COUNT_EVENTS_BUCKET_KEY, JSON.stringify(bucket));
  } catch {
    /* ignore */
  }
}

function loadCountEventsBucketRaw() {
  migrateLegacyCountEventsIfNeeded();
  try {
    const raw = localStorage.getItem(COUNT_EVENTS_BUCKET_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveCountEventsBucketRaw(bucket) {
  try {
    localStorage.setItem(COUNT_EVENTS_BUCKET_KEY, JSON.stringify(bucket));
  } catch {
    /* ignore */
  }
}

function loadCountEventsForDate(dateKey) {
  const bucket = loadCountEventsBucketRaw();
  const arr = bucket[dateKey];
  return Array.isArray(arr) ? arr : [];
}

function saveCountEventsForDate(dateKey, events) {
  const bucket = loadCountEventsBucketRaw();
  bucket[dateKey] = events;
  saveCountEventsBucketRaw(bucket);
}

function flattenAllCountEventsFromBucket() {
  const bucket = loadCountEventsBucketRaw();
  return Object.keys(bucket).flatMap((k) => (Array.isArray(bucket[k]) ? bucket[k] : []));
}

function markEventsSyncedInBucket(syncedIds) {
  const ids = syncedIds instanceof Set ? syncedIds : new Set(syncedIds);
  if (!ids.size) return;
  const bucket = loadCountEventsBucketRaw();
  let changed = false;
  for (const k of Object.keys(bucket)) {
    const arr = bucket[k];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e && ids.has(e.client_event_id)) {
        bucket[k][i] = { ...e, synced: true, synced_at: new Date().toISOString() };
        changed = true;
      }
    }
  }
  if (changed) saveCountEventsBucketRaw(bucket);
}

function ensureDailyCountReset() {
  /* Migracao; eventos ficam por dia no bucket (sem apagar na virada). */
  migrateLegacyCountEventsIfNeeded();
  return false;
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
/** Decodifica payload JWT (sem validar assinatura) para ler `exp`. */
function decodeJwtPayload(token) {
  try {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** True se o token já passou do horário de expiração (margem 60s). */
function isAccessTokenExpired(token) {
  const p = decodeJwtPayload(token);
  if (!p || typeof p.exp !== 'number') return false;
  return Date.now() >= (p.exp - 60) * 1000;
}

function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length ? t : null;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  unauthorizedRedirectInProgress = false;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function handleUnauthorizedResponse(response) {
  if (response.status !== 401) return false;
  if (unauthorizedRedirectInProgress) return true;
  unauthorizedRedirectInProgress = true;
  clearSession();
  loginForm.reset();
  history.replaceState(null, '', APP_BASE_PATH);
  loginError.textContent = 'Sessao expirada neste ambiente. Faca login novamente.';
  showLogin();
  return true;
}

function loadCountEvents() {
  ensureDailyCountReset();
  return loadCountEventsForDate(getActiveCountDateKey());
}

function saveCountEvents(events) {
  saveCountEventsForDate(getActiveCountDateKey(), events);
  try {
    localStorage.setItem(COUNT_EVENTS_DAY_KEY, getBrazilDateKey());
  } catch {
    /* ignore */
  }
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

function computeCountProgressStats(products = countProductsCache) {
  const validProducts = (Array.isArray(products) ? products : [])
    .map((p) => normalizeItemCode(p.cod_produto || p.cod_grup_descricao || ''))
    .filter(Boolean);
  const uniqueProducts = Array.from(new Set(validProducts));
  const total = uniqueProducts.length;
  const hasTxt = countImportBalancesState.hasTxt;

  /*
   * Sem TXT: percent = produtos com algum lançamento / total produtos.
   * Com TXT e linha no arquivo: cada produto vale 2 metades (CX + UN); só CX ou só UN = 50% desse item.
   * Com TXT mas código fora do arquivo: 1 metade (há lançamento ou não).
   */
  if (!hasTxt) {
    let counted = 0;
    for (const code of uniqueProducts) {
      const cx = Number(getNetByProductAndType(code, 'caixa')) || 0;
      const un = Number(getNetByProductAndType(code, 'unidade')) || 0;
      if (cx > 0 || un > 0) counted += 1;
    }
    const percent = total > 0 ? Math.min(100, Math.round((counted / total) * 100)) : 0;
    return {
      total,
      counted,
      percent,
      usesDimProgress: false,
      dimCompleted: 0,
      dimTotal: 0,
    };
  }

  let dimCompleted = 0;
  let dimTotal = 0;
  let counted = 0;
  for (const code of uniqueProducts) {
    const pair = getCountSaldoPair(code);
    const netCx = getNetByProductAndType(code, 'caixa');
    const netUn = getNetByProductAndType(code, 'unidade');
    if (pair) {
      const dimCx = countDimensionMatchesSaldo(code, 'caixa', netCx, pair.import_caixa);
      const dimUn = countDimensionMatchesSaldo(code, 'unidade', netUn, pair.import_unidade);
      dimTotal += 2;
      if (dimCx === true) dimCompleted += 1;
      if (dimUn === true) dimCompleted += 1;
      if (dimCx === true && dimUn === true) counted += 1;
    } else {
      dimTotal += 1;
      const cx = Number(netCx) || 0;
      const un = Number(netUn) || 0;
      if (cx > 0 || un > 0) {
        dimCompleted += 1;
        counted += 1;
      }
    }
  }
  const percent = dimTotal > 0 ? Math.min(100, Math.round((100 * dimCompleted) / dimTotal)) : 0;
  return {
    total,
    counted,
    percent,
    usesDimProgress: true,
    dimCompleted,
    dimTotal,
  };
}

/** Texto da barra principal: com TXT usa metades CX/UN (ex.: 1 de 2 = 50%). */
function countProgressDetailLabel(stats) {
  const { total, counted, usesDimProgress, dimCompleted, dimTotal } = stats;
  if (!total) {
    return countImportBalancesState.hasTxt
      ? '0 de 0 metades (CX e UN) conferidas com o saldo do TXT'
      : '0 de 0 produtos com lançamento';
  }
  if (usesDimProgress && dimTotal > 0) {
    return `${dimCompleted} de ${dimTotal} metades (CX e UN) conferidas com o saldo do TXT`;
  }
  return `${counted} de ${total} produtos com lançamento`;
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
  const stats = computeCountProgressStats(products);
  const { total, percent } = stats;
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
  const finished = total > 0 && percent >= 100;
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
  const fill = document.getElementById('count-progress-fill') || countProgressFill;
  if (!fill) return;
  const stats = computeCountProgressStats(products);
  const { total, percent } = stats;
  if (!total) {
    fill.style.width = '0%';
    const percentSpan = document.getElementById('count-progress-percent');
    if (percentSpan) percentSpan.textContent = '0%';
    const labelSpan = document.getElementById('count-progress-label');
    if (labelSpan) labelSpan.textContent = 'em andamento';
    const detailSpan = document.getElementById('count-progress-detail');
    if (detailSpan) detailSpan.textContent = countProgressDetailLabel(stats);
    return;
  }
  fill.style.width = `${percent}%`;
  const percentSpan = document.getElementById('count-progress-percent');
  if (percentSpan) percentSpan.textContent = `${percent}%`;
  const labelSpan = document.getElementById('count-progress-label');
  /* "concluído" só quando 100% do escopo atual; evita 100% + divergência UN parecer finalizado. */
  if (labelSpan) {
    labelSpan.textContent = percent >= 100 ? 'concluído' : 'em andamento';
  }
  const detailSpan = document.getElementById('count-progress-detail');
  if (detailSpan) detailSpan.textContent = countProgressDetailLabel(stats);
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

/** Soma apenas eventos locais ainda não sincronizados (evita duplicar o que já está no servidor). */
function getUnsyncedNetByProductAndType(productCode, countType) {
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  let sum = 0;
  for (const event of loadCountEvents()) {
    if (event.synced) continue;
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    sum += Number(event.quantity || 0);
  }
  return sum;
}

function getServerNetForProductAndType(productCode, countType) {
  if (!countServerCountState.ok) return 0;
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  const b = countServerCountState.balances[base];
  if (!b) return 0;
  return ct === 'unidade' ? Number(b.unidade) || 0 : Number(b.caixa) || 0;
}

/**
 * Fonte de verdade do readout (.count-product-readout-value), para a data ativa (#count-date):
 * - Com API ok: total da equipe no servidor (GET count-server-totals, dia SP) + apenas eventos
 *   locais desta data ainda não sincronizados (evita duplicar o que já entrou no servidor).
 * - Sem API (offline/erro): soma de todos os eventos locais dessa data (inclui já sincronizados no bucket).
 * Gravação em registerCountDelta usa o mesmo dayKey que loadCountEvents() (getActiveCountDateKey).
 */
function getNetByProductAndType(productCode, countType) {
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  const unsynced = getUnsyncedNetByProductAndType(productCode, countType);
  if (countServerCountState.ok) {
    return getServerNetForProductAndType(productCode, countType) + unsynced;
  }
  let sum = 0;
  for (const event of loadCountEvents()) {
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    sum += Number(event.quantity || 0);
  }
  return sum;
}

async function loadServerCountTotals() {
  if (loadServerCountTotalsInFlight) {
    return loadServerCountTotalsInFlight;
  }
  loadServerCountTotalsInFlight = (async () => {
    const token = getToken();
    if (!token) {
      countServerCountState = { ok: false, balances: {} };
      return;
    }
    if (unauthorizedRedirectInProgress) {
      countServerCountState = { ok: false, balances: {} };
      return;
    }
    if (isAccessTokenExpired(token)) {
      countServerCountState = { ok: false, balances: {} };
      handleUnauthorizedResponse({ status: 401 });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('count_date', getActiveCountDateKey());
      const response = await apiFetch(`${API_COUNT_SERVER_TOTALS}?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (handleUnauthorizedResponse(response)) {
        countServerCountState = { ok: false, balances: {} };
        return;
      }
      if (!response.ok) {
        countServerCountState = { ok: false, balances: {} };
        return;
      }
      const data = await response.json();
      countServerCountState = { ok: true, balances: data.balances || {} };
    } catch {
      countServerCountState = { ok: false, balances: {} };
    }
  })();
  try {
    await loadServerCountTotalsInFlight;
  } finally {
    loadServerCountTotalsInFlight = null;
  }
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function getCountSaldoPair(codRaw) {
  const k = normalizeItemCode(codRaw);
  return countImportBalancesState.balances[k];
}

function hasAnyCountEventsForType(codRaw, countType) {
  const base = normalizeItemCode(codRaw);
  const ct = normalizeCountType(countType);
  for (const event of loadCountEvents()) {
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    return true;
  }
  return false;
}

function countExplicitZeroKey(codRaw, countType) {
  return `count_explicit_zero_${getActiveCountDateKey()}_${normalizeItemCode(codRaw)}_${normalizeCountType(countType)}`;
}

function countExplicitZeroStored(codRaw, countType) {
  try {
    return localStorage.getItem(countExplicitZeroKey(codRaw, countType)) === '1';
  } catch {
    return false;
  }
}

function setCountExplicitZero(codRaw, countType, on) {
  try {
    const k = countExplicitZeroKey(codRaw, countType);
    if (on) localStorage.setItem(k, '1');
    else localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** null = sem TXT / sem linha no arquivo; true = bate; false = não bate */
function countDimensionMatchesSaldo(codRaw, countType, net, saldoVal) {
  if (!countImportBalancesState.hasTxt) return null;
  const pair = getCountSaldoPair(codRaw);
  if (!pair) return null;
  const n = Math.max(0, Math.round(Number(net) || 0));
  const s = Math.max(0, Math.round(Number(saldoVal) || 0));
  if (n !== s) return false;
  if (s === 0) {
    return hasAnyCountActivityForType(codRaw, countType) || countExplicitZeroStored(codRaw, countType);
  }
  return true;
}

/** Há lançamento local ou total já sincronizado no servidor (para saldo TXT zero). */
function hasAnyCountActivityForType(codRaw, countType) {
  if (hasAnyCountEventsForType(codRaw, countType)) return true;
  const base = normalizeItemCode(codRaw);
  const ct = normalizeCountType(countType);
  if (countServerCountState.ok) {
    const b = countServerCountState.balances[base];
    if (!b) return false;
    const v = ct === 'unidade' ? Number(b.unidade) || 0 : Number(b.caixa) || 0;
    if (v !== 0) return true;
  }
  return false;
}

async function loadImportBalancesForCount() {
  const token = getToken();
  if (!token) {
    countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
    return;
  }
  if (unauthorizedRedirectInProgress) {
    countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
    return;
  }
  if (isAccessTokenExpired(token)) {
    countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
    handleUnauthorizedResponse({ status: 401 });
    return;
  }
  const dateEl = document.getElementById('count-date');
  const referenceDate = (dateEl && dateEl.value || '').trim();
  const params = new URLSearchParams();
  if (referenceDate) params.set('reference_date', referenceDate);
  params.set('only_active', 'true');
  try {
    const response = await apiFetch(`${API_IMPORT_BALANCES}?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (handleUnauthorizedResponse(response)) {
      countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
      return;
    }
    if (!response.ok) {
      countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
      return;
    }
    const data = await response.json();
    countImportBalancesState = {
      hasTxt: !!data.has_txt_import,
      balances: data.balances || {},
      importLabel: data.import && data.import.file_name ? String(data.import.file_name) : '',
    };
  } catch {
    countImportBalancesState = { hasTxt: false, balances: {}, importLabel: '' };
  }
}

async function loadLastCountPerProduct() {
  const token = getToken();
  if (!token) {
    validityLastCountState = { ok: false, balances: {} };
    return;
  }
  if (unauthorizedRedirectInProgress) {
    validityLastCountState = { ok: false, balances: {} };
    return;
  }
  if (isAccessTokenExpired(token)) {
    validityLastCountState = { ok: false, balances: {} };
    handleUnauthorizedResponse({ status: 401 });
    return;
  }
  try {
    const response = await apiFetch(API_LAST_COUNT_PER_PRODUCT, {
      headers: getAuthHeaders(),
    });
    if (handleUnauthorizedResponse(response)) {
      validityLastCountState = { ok: false, balances: {} };
      return;
    }
    if (!response.ok) {
      validityLastCountState = { ok: false, balances: {} };
      return;
    }
    const data = await response.json();
    validityLastCountState = { ok: true, balances: data.balances || {} };
  } catch {
    validityLastCountState = { ok: false, balances: {} };
  }
}

/** Última contagem do sistema para o produto, ou null. */
function getValidityLastCountSnapshot(codRaw) {
  const base = normalizeItemCode(codRaw);
  if (!validityLastCountState.ok || !validityLastCountState.balances[base]) {
    return null;
  }
  const b = validityLastCountState.balances[base];
  const cx = Math.max(0, Math.round(Number(b.caixa) || 0));
  const un = Math.max(0, Math.round(Number(b.unidade) || 0));
  const countDate = (b.count_date && String(b.count_date).slice(0, 10)) || '';
  return { cx, un, countDate };
}

function formatDateBrFromIso(iso) {
  if (!iso || String(iso).length < 8) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

function loadValidityBucketRaw() {
  try {
    const raw = localStorage.getItem(VALIDITY_BUCKET_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

function saveValidityBucketRaw(bucket) {
  try {
    localStorage.setItem(VALIDITY_BUCKET_KEY, JSON.stringify(bucket));
  } catch {
    /* ignore */
  }
}

function loadValidityEventsForDate(dayKey) {
  const b = loadValidityBucketRaw();
  const arr = b[dayKey];
  return Array.isArray(arr) ? arr : [];
}

function saveValidityEventsForDate(dayKey, events) {
  const b = loadValidityBucketRaw();
  b[dayKey] = events;
  saveValidityBucketRaw(b);
}

function flattenValidityPendingAll() {
  const b = loadValidityBucketRaw();
  return Object.keys(b).flatMap((k) => (Array.isArray(b[k]) ? b[k] : []));
}

function setValidityFeedback(msg, isError = false) {
  const el = document.getElementById('validity-feedback');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function renderCountProducts(products) {
  // Filtra itens ativos considerando sinônimos do backend (null/vazio, 'S', '1', 'Sim', etc)
  const isActive = (status) => {
    const s = String(status || '').trim().toLowerCase();
    // No backend, null ou vazio é considerado Ativo por padrão no catálogo
    if (!s || s === 'ativo' || s === 's' || s === 'sim' || s === '1' || s === 'true' || s === 'ativado' || s === 'active') return true;
    return false;
  };

  const ativos = Array.isArray(products)
    ? products.filter(p => isActive(p.status))
    : [];
  if (!countProductsList) {
    const feedback = document.getElementById('count-feedback');
    if (feedback) feedback.textContent = 'ERRO: Elemento da lista de produtos não encontrado!';
    return;
  }
  countProductsList.style.display = '';
  const subCount = document.getElementById('sub-count');
  if (subCount) subCount.style.display = '';
  // Não usar style.display = '' aqui: em style.css #view-dashboard { display: none } e some o app inteiro.
  showDashboard();
  countProductsList.hidden = false;
  countProductsList.innerHTML = '';
  if (countProductsTotal) countProductsTotal.textContent = `${ativos.length}`;
  const feedback = document.getElementById('count-feedback');
  if (feedback) feedback.textContent = '';

  if (!ativos.length) {
    countProductsList.innerHTML = '<li><span>Nenhum produto ATIVO encontrado para o filtro atual.</span><strong>0</strong></li>';
    if (countProductsListDone) countProductsListDone.innerHTML = '';
    if (countProductsDoneWrap) countProductsDoneWrap.hidden = true;
    updateCountProgress([]);
    // Garante que o menu de módulos e dashboard continuam visíveis
    const moduleNav = document.getElementById('module-nav');
    if (moduleNav) moduleNav.style.display = '';
    const sidebarMenu = document.getElementById('sidebar-menu');
    if (sidebarMenu) sidebarMenu.style.display = '';
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) dashboardContent.style.display = '';
    return;
  }

  const rowClassFromMatch = (m) => {
    if (m === null) return 'count-control-row--neutral';
    if (m === true) return 'count-control-row--ok';
    return 'count-control-row--recount';
  };

  const appendCard = (ul, product) => {
    const codRaw = String(product.cod_produto || '');
    const desc = escapeHtml(product.cod_grup_descricao || '');
    const codRef = encodeURIComponent(codRaw);
    const netCx = getNetByProductAndType(codRaw, 'caixa');
    const netUn = getNetByProductAndType(codRaw, 'unidade');
    const pair = getCountSaldoPair(codRaw);
    const hasTxt = countImportBalancesState.hasTxt;
    const dimCx = countDimensionMatchesSaldo(codRaw, 'caixa', netCx, pair ? pair.import_caixa : 0);
    const dimUn = countDimensionMatchesSaldo(codRaw, 'unidade', netUn, pair ? pair.import_unidade : 0);
    const vCx = Math.max(0, Math.round(Number(netCx) || 0));
    const vUn = Math.max(0, Math.round(Number(netUn) || 0));

    let cardClass = 'count-product-item';
    if (hasTxt && pair) {
      if (dimCx === true && dimUn === true) {
        cardClass += ' count-product-item--conferido';
      } else if (dimCx === false || dimUn === false) {
        cardClass += ' count-product-item--recontagem';
      }
    }

    const badgeCx = hasTxt && pair
      ? (dimCx === false
        ? '<span class="count-row-badge count-row-badge--recount">Divergência</span>'
        : dimCx === true
          ? '<span class="count-row-badge count-row-badge--ok">OK</span>'
          : '')
      : '';
    const badgeUn = hasTxt && pair
      ? (dimUn === false
        ? '<span class="count-row-badge count-row-badge--recount">Divergência</span>'
        : dimUn === true
          ? '<span class="count-row-badge count-row-badge--ok">OK</span>'
          : '')
      : '';

    const li = document.createElement('li');
    li.className = cardClass;
    li.dataset.codProduto = codRaw;
    /* Input sempre vazio na lista: total só no readout; após +/− ou lançamento por teclado o campo não replica o saldo. */
    li.innerHTML = `
      <div class="count-product-label">
        <span class="count-product-desc">${desc}</span>
      </div>
      <div class="count-product-controls">
        <div class="count-control-row ${rowClassFromMatch(dimCx)}">
          <span class="count-control-type">CX</span>
          <button type="button" class="btn-count-adjust btn-minus" data-coderef="${codRef}" data-count-type="caixa" data-delta="-1" aria-label="Menos caixa">−</button>
          <input type="number" class="count-product-qty" min="0" step="1" inputmode="numeric" autocomplete="off" enterkeyhint="done"
            data-coderef="${codRef}" data-count-type="caixa" value="" aria-label="Quantidade em caixas" />
          <button type="button" class="btn-count-adjust btn-plus" data-coderef="${codRef}" data-count-type="caixa" data-delta="1" aria-label="Mais caixa">+</button>
          <div class="count-control-tail">
            <div class="count-product-readout count-product-readout--by-control" aria-live="polite" title="Total em caixas: equipe (sincronizado) + pendente neste aparelho">
              <span class="count-product-readout-inner">
                <strong class="count-product-readout-value">${formatIntegerBR(vCx)}</strong>
              </span>
            </div>
            ${badgeCx}
          </div>
        </div>
        <div class="count-control-row ${rowClassFromMatch(dimUn)}">
          <span class="count-control-type">UN</span>
          <button type="button" class="btn-count-adjust btn-minus" data-coderef="${codRef}" data-count-type="unidade" data-delta="-1" aria-label="Menos unidade">−</button>
          <input type="number" class="count-product-qty" min="0" step="1" inputmode="numeric" autocomplete="off" enterkeyhint="done"
            data-coderef="${codRef}" data-count-type="unidade" value="" aria-label="Quantidade em unidades" />
          <button type="button" class="btn-count-adjust btn-plus" data-coderef="${codRef}" data-count-type="unidade" data-delta="1" aria-label="Mais unidade">+</button>
          <div class="count-control-tail">
            <div class="count-product-readout count-product-readout--by-control" aria-live="polite" title="Total em unidades: equipe (sincronizado) + pendente neste aparelho">
              <span class="count-product-readout-inner">
                <strong class="count-product-readout-value">${formatIntegerBR(vUn)}</strong>
              </span>
            </div>
            ${badgeUn}
          </div>
        </div>
      </div>
    `;
    ul.appendChild(li);
  };

  const pending = [];
  const done = [];
  for (const product of ativos) {
    const codRaw = String(product.cod_produto || '');
    const pair = getCountSaldoPair(codRaw);
    const hasTxt = countImportBalancesState.hasTxt;
    const netCx = getNetByProductAndType(codRaw, 'caixa');
    const netUn = getNetByProductAndType(codRaw, 'unidade');
    const dimCx = countDimensionMatchesSaldo(codRaw, 'caixa', netCx, pair ? pair.import_caixa : 0);
    const dimUn = countDimensionMatchesSaldo(codRaw, 'unidade', netUn, pair ? pair.import_unidade : 0);
    const fully = hasTxt && pair && dimCx === true && dimUn === true;
    if (fully) done.push(product);
    else pending.push(product);
  }

  countProductsList.innerHTML = '';
  if (pending.length === 0 && ativos.length > 0) {
    countProductsList.innerHTML =
      '<li class="count-all-done-msg"><span class="muted">Nenhum item pendente neste filtro: conferidos com o saldo do TXT (lista abaixo).</span></li>';
  } else {
    for (const product of pending) appendCard(countProductsList, product);
  }

  if (countProductsListDone && countProductsDoneWrap) {
    countProductsListDone.innerHTML = '';
    if (done.length) {
      countProductsDoneWrap.hidden = false;
      for (const product of done) appendCard(countProductsListDone, product);
    } else {
      countProductsDoneWrap.hidden = true;
    }
  }

  updateCountProgress(ativos);
  updateCountReadOnlyState();
  // Garante que o menu de módulos e dashboard continuam visíveis
  const moduleNav = document.getElementById('module-nav');
  if (moduleNav) moduleNav.style.display = '';
  const sidebarMenu = document.getElementById('sidebar-menu');
  if (sidebarMenu) sidebarMenu.style.display = '';
  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent) dashboardContent.style.display = '';
}

function updateCountReadOnlyState() {
  const shell = document.querySelector('.count-products-shell');
  const editable = isCountOperationalEditable();
  if (shell) {
    shell.classList.toggle('count-products-shell--readonly', !editable);
    shell.querySelectorAll('input.count-product-qty').forEach((el) => {
      el.readOnly = !editable;
      el.title = editable ? '' : 'Somente consulta: selecione a data de hoje para lançar.';
    });
    shell.querySelectorAll('.btn-count-adjust').forEach((el) => {
      el.disabled = !editable;
    });
  }
  const banner = document.getElementById('count-readonly-banner');
  if (banner) {
    const show = !editable;
    banner.hidden = !show;
    banner.textContent = show
      ? `Modo consulta (${getActiveCountDateKey()}). Para lançar, use a data de hoje (${getBrazilDateKey()}).`
      : '';
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

/** Re-renderiza a lista de contagem respeitando o filtro de busca atual. */
function refreshCountProductListView() {
  const input = document.getElementById('item-code');
  const term = (input && input.value || '').trim();
  const toShow = term ? filterCountProductsByTerm(term) : countProductsCache;
  renderCountProducts(toShow);
}

async function loadCountProducts() {
  if (!countProductsList) return;
  const token = getToken();
  if (!token) return;
  if (isAccessTokenExpired(token)) {
    handleUnauthorizedResponse({ status: 401 });
    return;
  }

  const q = '';
  /* Contagem operacional: sempre catálogo ativo no backend; sem toggle no front */
  const statusValue = 'ativo';
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
      if (getToken()) {
        await Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]);
      }
      renderCountProducts([]);
      setFeedback('Nao foi possivel carregar a lista de produtos para contagem.', true);
      return;
    }
    if (!Array.isArray(products) || products.length === 0) {
      await Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]);
      renderCountProducts([]);
      setFeedback('Nenhum produto ativo encontrado. Verifique se há produtos cadastrados como ATIVO.', true);
      return;
    }
    countProductsCache = products;
    await Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]);
    renderCountProducts(countProductsCache);
    if (countPrefillProductCode) {
      const itemCodeInput = document.getElementById('item-code');
      if (itemCodeInput) {
        itemCodeInput.value = countPrefillProductCode;
        itemCodeInput.dispatchEvent(new Event('input'));
      }
      countPrefillProductCode = null;
    }
  } catch (e) {
    console.error('Erro ao carregar produtos:', e);
    Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]).then(() => renderCountProducts([]));
    setFeedback('Sem conexao para carregar produtos.', true);
  }
}

function _validityLineKey(line) {
  const id = line.id != null ? `s-${line.id}` : `l-${line.client_event_id || ''}`;
  const exp = line.expiration_date || '';
  return `${id}-${exp}`;
}

function getMergedValidityLinesForProduct(codRaw) {
  const cod = normalizeItemCode(codRaw);
  const op = getActiveValidityOpDateKey();
  const server = (validityServerLines || []).filter(
    (l) => normalizeItemCode(l.cod_produto) === cod,
  );
  const local = loadValidityEventsForDate(op).filter(
    (e) => !e.synced && normalizeItemCode(e.cod_produto) === cod,
  );
  const localNorm = local.map((e) => ({
    id: null,
    client_event_id: e.client_event_id,
    cod_produto: cod,
    expiration_date: e.expiration_date,
    quantity_un: e.quantity_un,
    lot_code: e.lot_code || null,
    note: e.note || null,
    operational_date: e.operational_day || op,
    observed_at: e.observed_at,
    device_name: e.device_name || null,
    actor_username: null,
    _local: true,
  }));
  return [...server, ...localNorm];
}

/** Dias até o vencimento (negativo = já vencido). */
function validityExpiryDiffDays(expDateStr, todayBr) {
  if (!expDateStr || !todayBr) return null;
  const a = new Date(`${expDateStr}T12:00:00`);
  const b = new Date(`${todayBr}T12:00:00`);
  return Math.round((a - b) / 86400000);
}

/**
 * Faixas para bebidas (não sobrepostas): a mais restritiva aplica.
 * expired | d30 … d180 | ok (>180d)
 */
function validityRiskCategory(expDateStr, todayBr) {
  const diff = validityExpiryDiffDays(expDateStr, todayBr);
  if (diff === null) return 'unknown';
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'd30';
  if (diff <= 60) return 'd60';
  if (diff <= 90) return 'd90';
  if (diff <= 120) return 'd120';
  if (diff <= 150) return 'd150';
  if (diff <= 180) return 'd180';
  return 'ok';
}

function validityRiskLabel(cat) {
  const m = {
    unknown: '—',
    expired: 'Vencido',
    d30: 'Crítico (≤30d)',
    d60: 'Muito alto (≤60d)',
    d90: 'Alto (≤90d)',
    d120: 'Atenção (≤120d)',
    d150: 'Monitorar (≤150d)',
    d180: 'Controle próximo (≤180d)',
    ok: 'Confortável',
  };
  return m[cat] || String(cat);
}

function validityRiskChipClass(cat) {
  if (cat === 'expired' || cat === 'd30') return 'validity-chip validity-chip--danger';
  if (cat === 'd60' || cat === 'd90') return 'validity-chip validity-chip--warn';
  if (cat === 'd120' || cat === 'd150' || cat === 'd180') return 'validity-chip validity-chip--soft';
  return 'validity-chip validity-chip--muted';
}

function formatDateTimeBr(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(String(iso).trim());
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return '—';
  }
}

function countBaseAgeDays(countDateIso, todayBr) {
  if (!countDateIso || !todayBr) return null;
  const c = String(countDateIso).slice(0, 10);
  const a = new Date(`${c}T12:00:00`);
  const b = new Date(`${todayBr}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function formatCountBaseAgeLabel(ageDays) {
  if (ageDays === null || ageDays < 0) return '—';
  if (ageDays === 0) return 'Hoje';
  if (ageDays === 1) return 'Ontem';
  if (ageDays < 30) return `${ageDays} dias`;
  if (ageDays < 60) return `${ageDays} dias`;
  return `${ageDays} dias`;
}

function isValidityCountBaseOld(countDateIso, todayBr) {
  const d = countBaseAgeDays(countDateIso, todayBr);
  return d !== null && d > VALIDITY_OLD_BASE_DAYS;
}

const VALIDITY_RISK_ORDER = {
  expired: 0,
  d30: 1,
  d60: 2,
  d90: 3,
  d120: 4,
  d150: 5,
  d180: 6,
  ok: 7,
  none: 8,
  unknown: 9,
};

function worstValidityRiskAmongLines(lines, todayBr) {
  if (!lines || !lines.length) return 'none';
  let worst = 'ok';
  let wo = VALIDITY_RISK_ORDER.ok;
  for (const ln of lines) {
    const c = validityRiskCategory(ln.expiration_date, todayBr);
    if (c === 'unknown') continue;
    const o = VALIDITY_RISK_ORDER[c] ?? 99;
    if (o < wo) {
      wo = o;
      worst = c;
    }
  }
  return worst;
}

/**
 * Próximo vencimento ainda não passou (hoje ou futuro), por data crescente.
 * Ignora linhas só históricas vencidas quando existe lançamento válido mais novo.
 */
function operationalAnchorLine(lines, todayBr) {
  if (!lines?.length) return null;
  const sorted = [...lines].sort((a, b) =>
    String(a.expiration_date || '').localeCompare(String(b.expiration_date || '')),
  );
  for (const ln of sorted) {
    const d = validityExpiryDiffDays(ln.expiration_date, todayBr);
    if (d !== null && d >= 0) return ln;
  }
  return null;
}

/**
 * Faixa/status principal do card e priorização: baseado no próximo vencimento ativo.
 * Linhas antigas vencidas não dominam se já existe data futura/hoje.
 */
function operationalValidityPrimaryCategory(lines, todayBr) {
  if (!lines?.length) return 'none';
  const anchor = operationalAnchorLine(lines, todayBr);
  if (anchor) {
    return validityRiskCategory(anchor.expiration_date, todayBr);
  }
  return worstValidityRiskAmongLines(lines, todayBr);
}

function earliestExpirationLine(lines) {
  if (!lines || !lines.length) return null;
  const sorted = [...lines].sort((a, b) =>
    String(a.expiration_date || '').localeCompare(String(b.expiration_date || '')),
  );
  return sorted[0];
}

function validityStatusMainShort(worst, hasLines, hasSnap) {
  if (!hasLines) return { key: 'no_validity', label: 'Sem validade' };
  if (!hasSnap) return { key: 'no_count', label: 'Sem contagem' };
  const m = {
    expired: 'Vencido',
    d30: 'Crítico',
    d60: 'Muito alto',
    d90: 'Alto',
    d120: 'Atenção',
    d150: 'Monitorar',
    d180: 'Controle próximo',
    ok: 'Confortável',
    none: '—',
    unknown: '—',
  };
  return { key: worst, label: m[worst] || worst };
}

function validityRecommendedAction(row, todayBr) {
  const { lines, cod } = row;
  const snap = getValidityLastCountSnapshot(cod);
  if (!lines.length) {
    return { key: 'launch', tone: 'neutral', label: 'Lançar datas de validade' };
  }
  if (!snap) {
    return { key: 'no_count', tone: 'warn', label: 'Conferir estoque (sem contagem)' };
  }
  if (isValidityCountBaseOld(snap.countDate, todayBr)) {
    return { key: 'old_base', tone: 'warn', label: 'Revisar base de contagem' };
  }
  const w = operationalValidityPrimaryCategory(lines, todayBr);
  if (w === 'expired' || w === 'd30') {
    return { key: 'act_today', tone: 'danger', label: 'Agir hoje' };
  }
  if (w === 'd60' || w === 'd90') {
    return { key: 'rotate', tone: 'warn', label: 'Priorizar giro' };
  }
  if (w === 'd120' || w === 'd150' || w === 'd180') {
    return { key: 'monitor', tone: 'soft', label: 'Monitorar' };
  }
  return { key: 'calm', tone: 'muted', label: 'Sem urgência' };
}

function validityCardTone(worst, hasLines, hasSnap, baseOld) {
  if (!hasLines) return 'novalidity';
  if (!hasSnap) return 'nocount';
  if (baseOld) return 'oldbase';
  if (worst === 'expired' || worst === 'd30') return 'danger';
  if (worst === 'd60' || worst === 'd90') return 'warn';
  if (worst === 'd120' || worst === 'd150' || worst === 'd180') return 'soft';
  return 'calm';
}

function validityPriorityScore(row, todayBr) {
  const snap = getValidityLastCountSnapshot(row.cod);
  const lines = row.lines;
  if (!lines.length) return 45;
  if (!snap) return 5;
  if (isValidityCountBaseOld(snap.countDate, todayBr)) return 12;
  const w = operationalValidityPrimaryCategory(lines, todayBr);
  const map = {
    expired: 0,
    d30: 1,
    d60: 2,
    d90: 3,
    d120: 4,
    d150: 5,
    d180: 6,
    ok: 50,
  };
  return map[w] ?? 30;
}

function touchValidityLastSync() {
  try {
    localStorage.setItem(VALIDITY_LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

function formatValidityLastSyncDisplay() {
  try {
    const raw = localStorage.getItem(VALIDITY_LAST_SYNC_KEY);
    if (!raw) return 'Nunca';
    return formatDateTimeBr(raw);
  } catch {
    return '—';
  }
}

function buildValidityRowForProduct(p) {
  const cod = normalizeItemCode(p.cod_produto || '');
  const lines = getMergedValidityLinesForProduct(cod);
  return { product: p, cod, lines };
}

async function loadValidityLinesFromServer() {
  const token = getToken();
  if (!token) {
    validityServerLines = [];
    return;
  }
  if (unauthorizedRedirectInProgress) {
    validityServerLines = [];
    return;
  }
  if (isAccessTokenExpired(token)) {
    validityServerLines = [];
    handleUnauthorizedResponse({ status: 401 });
    return;
  }
  try {
    const params = new URLSearchParams();
    params.set('operational_date', getActiveValidityOpDateKey());
    const response = await apiFetch(`${API_VALIDITY_LINES}?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (handleUnauthorizedResponse(response)) {
      validityServerLines = [];
      return;
    }
    if (!response.ok) {
      validityServerLines = [];
      return;
    }
    const data = await response.json();
    validityServerLines = Array.isArray(data.lines) ? data.lines : [];
  } catch {
    validityServerLines = [];
  }
}

async function loadValidityProductsCatalog() {
  const token = getToken();
  if (!token) return;
  if (isAccessTokenExpired(token)) {
    handleUnauthorizedResponse({ status: 401 });
    return;
  }
  const statusValue = 'ativo';
  const buildUrl = (lim) => {
    const params = new URLSearchParams();
    params.set('limit', String(lim));
    params.set('status', statusValue);
    return `${API_PRODUCTS_CATALOG}?${params.toString()}`;
  };
  let lim = catalogQueryLimitEffective;
  let resp = await apiFetch(buildUrl(lim), { headers: { Authorization: `Bearer ${token}` } });
  while (resp.status === 422 && lim > 1000) {
    const next = downgradeLimitAfter422(lim);
    if (next >= lim) break;
    catalogQueryLimitEffective = next;
    lim = next;
    resp = await apiFetch(buildUrl(lim), { headers: { Authorization: `Bearer ${token}` } });
  }
  if (handleUnauthorizedResponse(resp)) return;
  if (!resp.ok) return;
  const products = await resp.json();
  validityProductsCache = Array.isArray(products) ? products : [];
}

function updateValidityReadonlyState() {
  const shell = document.getElementById('validity-products-shell');
  const editable = isValidityOperationalEditable();
  if (shell) {
    shell.classList.toggle('validity-products-shell--readonly', !editable);
  }
  const banner = document.getElementById('validity-readonly-banner');
  if (banner) {
    const show = !editable;
    banner.hidden = !show;
    banner.textContent = show
      ? `Modo consulta (${getActiveValidityOpDateKey()}). Lancamentos apenas na data de hoje (${getBrazilDateKey()}).`
      : '';
  }
}

function updateValidityKpis(allRows, todayBr) {
  let withLine = 0;
  let without = 0;
  let expired = 0;
  let c30 = 0;
  let c60 = 0;
  let c90 = 0;
  let c120 = 0;
  let c150 = 0;
  let c180 = 0;
  let productsOldBase = 0;
  let productsNoCount = 0;

  for (const row of allRows) {
    const lines = row.lines || [];
    if (lines.length) withLine += 1;
    else without += 1;
    const snap = getValidityLastCountSnapshot(row.cod);
    if (!snap) productsNoCount += 1;
    else if (isValidityCountBaseOld(snap.countDate, todayBr)) productsOldBase += 1;
    if (!lines.length) continue;
    const op = operationalValidityPrimaryCategory(lines, todayBr);
    if (op === 'expired') expired += 1;
    if (op === 'd30') c30 += 1;
    if (op === 'd60') c60 += 1;
    if (op === 'd90') c90 += 1;
    if (op === 'd120') c120 += 1;
    if (op === 'd150') c150 += 1;
    if (op === 'd180') c180 += 1;
  }

  const set = (id, v) => {
    const n = document.getElementById(id);
    if (n) n.textContent = String(v);
  };
  set('validity-kpi-with', withLine);
  set('validity-kpi-without', without);
  set('validity-kpi-expired', expired);
  set('validity-kpi-d30', c30);
  set('validity-kpi-d60', c60);
  set('validity-kpi-d90', c90);
  set('validity-kpi-d120', c120);
  set('validity-kpi-d150', c150);
  set('validity-kpi-d180', c180);
  set('validity-kpi-oldbase', productsOldBase);
  set('validity-kpi-nocount', productsNoCount);

  const ls = document.getElementById('validity-last-sync');
  if (ls) ls.textContent = `Última sincronização: ${formatValidityLastSyncDisplay()}`;

  const total = allRows.length;
  const pct = total > 0 ? Math.min(100, Math.round((withLine / total) * 100)) : 0;
  const fill = document.getElementById('validity-progress-fill');
  const pp = document.getElementById('validity-progress-percent');
  const pd = document.getElementById('validity-progress-detail');
  if (fill) fill.style.width = `${pct}%`;
  if (pp) pp.textContent = `${pct}%`;
  if (pd) pd.textContent = `${withLine} de ${total} produtos com validade lançada`;
}

function rowMatchesValidityKpi(row, kpi, todayBr) {
  if (!kpi) return true;
  const lines = row.lines || [];
  const snap = getValidityLastCountSnapshot(row.cod);
  switch (kpi) {
    case 'with':
      return lines.length > 0;
    case 'without':
      return lines.length === 0;
    case 'nocount':
      return !snap;
    case 'oldbase':
      return !!(snap && isValidityCountBaseOld(snap.countDate, todayBr));
    case 'expired':
      return lines.length > 0 && operationalValidityPrimaryCategory(lines, todayBr) === 'expired';
    case 'd30':
    case 'd60':
    case 'd90':
    case 'd120':
    case 'd150':
    case 'd180':
      return lines.length > 0 && operationalValidityPrimaryCategory(lines, todayBr) === kpi;
    default:
      return true;
  }
}

function syncValidityKpiChipStyles() {
  document.querySelectorAll('#validity-kpi-strip [data-validity-kpi]').forEach((btn) => {
    const k = btn.getAttribute('data-validity-kpi');
    const on = validityActiveKpiKey === k;
    btn.classList.toggle('validity-kpi--active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function filterValidityRows(rows) {
  const term = (document.getElementById('validity-item-code')?.value || '').trim().toLowerCase();
  const grupo = (document.getElementById('validity-group')?.value || '').trim().toLowerCase();
  const risk = (document.getElementById('validity-risk-filter')?.value || 'all').trim();
  const todayBr = getBrazilDateKey();

  return rows.filter((row) => {
    const p = row.product;
    const desc = (p.cod_grup_descricao || '').toLowerCase();
    const codigo = (p.cod_produto || '').toLowerCase();
    if (term && !codigo.includes(term) && !desc.includes(term)) return false;
    if (grupo && !desc.includes(grupo)) return false;
    if (!rowMatchesValidityKpi(row, validityActiveKpiKey, todayBr)) return false;

    const snap = getValidityLastCountSnapshot(row.cod);

    if (risk === 'all') return true;
    if (risk === 'none') return row.lines.length === 0;
    if (risk === 'nocount') return !snap;
    if (risk === 'oldbase') return !!(snap && isValidityCountBaseOld(snap.countDate, todayBr));
    if (risk === 'critical') {
      const w = operationalValidityPrimaryCategory(row.lines, todayBr);
      return w === 'expired' || w === 'd30';
    }
    if (risk === 'near') {
      const anchor = operationalAnchorLine(row.lines, todayBr);
      if (!anchor) return false;
      const d = validityExpiryDiffDays(anchor.expiration_date, todayBr);
      return d !== null && d >= 0 && d <= 180;
    }
    if (risk === 'expired') {
      return operationalValidityPrimaryCategory(row.lines, todayBr) === 'expired';
    }
    const bands = ['d30', 'd60', 'd90', 'd120', 'd150', 'd180', 'ok'];
    if (bands.includes(risk)) {
      return operationalValidityPrimaryCategory(row.lines, todayBr) === risk;
    }
    return true;
  });
}

function sortValidityRows(rows, sortMode, todayBr) {
  const out = [...rows];
  if (sortMode === 'name') {
    out.sort((a, b) =>
      String(a.product.cod_grup_descricao || '').localeCompare(String(b.product.cod_grup_descricao || ''), 'pt', {
        sensitivity: 'base',
      }),
    );
  } else if (sortMode === 'code') {
    out.sort((a, b) => String(a.cod).localeCompare(String(b.cod)));
  } else {
    out.sort((a, b) => validityPriorityScore(a, todayBr) - validityPriorityScore(b, todayBr));
  }
  return out;
}

/**
 * Compatibilidade: versões antigas de renderValidityProductList chamavam esta função.
 * Retorna linhas filtradas e ordenadas (equivalente a filterValidityRows + sortValidityRows).
 */
function filterValidityProductsForView(products) {
  const todayBr = getBrazilDateKey();
  const rows = (products || []).map(buildValidityRowForProduct);
  const sortMode = (document.getElementById('validity-sort')?.value || 'priority').trim();
  return sortValidityRows(filterValidityRows(rows), sortMode, todayBr);
}

function renderValidityProductList() {
  const ul = document.getElementById('validity-products-list');
  const totalEl = document.getElementById('validity-products-total');
  if (!ul) return;

  const isActive = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s || s === 'ativo' || s === 's' || s === 'sim' || s === '1' || s === 'true') return true;
    return false;
  };
  const ativos = (validityProductsCache || []).filter((p) => isActive(p.status));
  if (totalEl) totalEl.textContent = String(ativos.length);

  const todayBr = getBrazilDateKey();
  const allRows = ativos.map(buildValidityRowForProduct);
  updateValidityKpis(allRows, todayBr);
  const sortMode = (document.getElementById('validity-sort')?.value || 'priority').trim();
  const rows = sortValidityRows(filterValidityRows(allRows), sortMode, todayBr);

  ul.innerHTML = '';
  if (!rows.length) {
    ul.innerHTML = '<li class="validity-empty"><span>Nenhum produto no filtro atual.</span></li>';
    syncValidityKpiChipStyles();
    updateValidityReadonlyState();
    return;
  }

  const enc = encodeURIComponent;

  for (const row of rows) {
    const p = row.product;
    const cod = row.cod;
    const desc = escapeHtml((p.cod_grup_descricao || cod).trim());
    const lines = row.lines;
    const snap = getValidityLastCountSnapshot(cod);
    const opCat = operationalValidityPrimaryCategory(lines, todayBr);
    const hasSnap = !!snap;
    const baseOld = !!(snap && isValidityCountBaseOld(snap.countDate, todayBr));
    const ageDays = snap ? countBaseAgeDays(snap.countDate, todayBr) : null;
    const ageLabel = snap ? formatCountBaseAgeLabel(ageDays) : '—';
    const ageClass = baseOld ? ' validity-metric-v--alert' : '';
    const anchorLn = operationalAnchorLine(lines, todayBr);
    const nextBr = anchorLn
      ? formatDateBrFromIso(String(anchorLn.expiration_date || '').slice(0, 10))
      : lines.length > 0
        ? 'Vencidos'
        : '—';
    const statusMain = validityStatusMainShort(opCat, lines.length > 0, hasSnap);
    const action = validityRecommendedAction(row, todayBr);
    const tone = validityCardTone(opCat, lines.length > 0, hasSnap, baseOld);

    const countCompact = snap
      ? `${formatIntegerBR(snap.cx)} CX · ${formatIntegerBR(snap.un)} UN`
      : 'Sem contagem';

    const refMetrics = snap
      ? `<div class="validity-analytic-metrics validity-analytic-metrics--expanded">
          <div class="validity-metric"><span class="validity-metric-k">Última contagem</span><span class="validity-metric-v">${formatIntegerBR(snap.cx)} CX <span class="validity-meta-sep">|</span> ${formatIntegerBR(snap.un)} UN</span></div>
          <div class="validity-metric"><span class="validity-metric-k">Data base</span><span class="validity-metric-v">${formatDateBrFromIso(snap.countDate)}</span></div>
          <div class="validity-metric"><span class="validity-metric-k">Idade da base</span><span class="validity-metric-v${ageClass}">${ageLabel}${baseOld ? ' · base antiga' : ''}</span></div>
          <div class="validity-metric"><span class="validity-metric-k">Próximo venc.</span><span class="validity-metric-v">${nextBr}</span></div>
        </div>`
      : `<div class="validity-analytic-metrics validity-analytic-metrics--expanded validity-analytic-metrics--nocount">
          <div class="validity-metric validity-metric--full"><span class="validity-metric-k">Referência</span><span class="validity-metric-v">Sem contagem anterior no sistema</span></div>
        </div>`;

    const linesHtml = lines.length
      ? lines
          .map((ln) => {
            const rk = validityRiskCategory(ln.expiration_date, todayBr);
            const rkLabel = validityRiskLabel(rk);
            const rkChip = validityRiskChipClass(rk);
            const expBr = formatDateBrFromIso(String(ln.expiration_date || '').slice(0, 10));
            const canDel = isValidityOperationalEditable() && (ln.id || ln._local);
            const delBtn = canDel
              ? `<button type="button" class="btn btn-text btn-sm btn-validity-remove" data-line-id="${ln.id != null ? ln.id : ''}" data-client-id="${escapeHtml(String(ln.client_event_id || ''))}" data-coderef="${enc(cod)}">Remover</button>`
              : '—';
            const who = ln._local
              ? escapeHtml(ln.device_name || 'Este aparelho')
              : escapeHtml(ln.actor_username || '—');
            const when = formatDateTimeBr(ln.observed_at);
            return `<tr>
              <td>${expBr}</td>
              <td><span class="${rkChip}">${rkLabel}</span></td>
              <td class="muted">${who}</td>
              <td class="muted">${when}</td>
              <td>${delBtn}</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="5" class="muted">Nenhuma data neste dia operacional.</td></tr>';

    const codRefEnc = enc(cod);
    const editable = isValidityOperationalEditable();
    const addBlock = editable
      ? `<div class="validity-add-row">
          <div class="validity-add-exp"><label class="sr-only" for="validity-exp-${codRefEnc}">Vencimento</label>
          <input type="date" class="count-filter-input validity-inp-exp" id="validity-exp-${codRefEnc}" data-coderef="${codRefEnc}" /></div>
          <div class="validity-add-actions"><button type="button" class="btn btn-primary validity-btn-add" data-coderef="${codRefEnc}">Adicionar</button></div>
        </div>`
      : '';

    const defaultOpen = window.matchMedia('(min-width: 769px)').matches;
    const openAttr = defaultOpen ? 'open' : '';

    const li = document.createElement('li');
    li.className = 'validity-product-item';
    li.innerHTML = `
      <details class="validity-analytic-card validity-analytic-card--${tone}" ${openAttr}>
        <summary class="validity-analytic-summary">
          <div class="validity-summary-compact validity-summary-compact--dense">
            <div class="validity-sum-r1">
              <span class="validity-analytic-name">${desc}</span>
            </div>
            <div class="validity-sum-r2">
              <span class="validity-analytic-code">${escapeHtml(cod)}</span>
              <span class="validity-pill validity-pill--status" data-v-st="${escapeHtml(statusMain.key)}">${escapeHtml(statusMain.label)}</span>
              <span class="validity-pill validity-pill--action" data-v-act="${escapeHtml(action.key)}">${escapeHtml(action.label)}</span>
            </div>
            <div class="validity-sum-r3" aria-label="Resumo">
              <span class="validity-sum-stat"><span class="validity-stat-lbl">Cont.</span> ${escapeHtml(countCompact)}</span>
              <span class="validity-sum-stat"><span class="validity-stat-lbl">Próx.</span> ${escapeHtml(nextBr)}</span>
            </div>
          </div>
        </summary>
        <div class="validity-product-body">
          ${refMetrics}
          <p class="validity-detail-hint muted">Datas neste dia operacional</p>
          <div class="validity-lines-table-wrap">
          <table class="validity-lines-table">
            <thead><tr><th>Vencimento</th><th>Faixa</th><th>Quem</th><th>Quando</th><th></th></tr></thead>
            <tbody>${linesHtml}</tbody>
          </table>
          </div>
          ${addBlock}
        </div>
      </details>`;
    ul.appendChild(li);
  }

  syncValidityKpiChipStyles();
  updateValidityReadonlyState();
}

/** Evita rolagem indesejada ao abrir /app#validity (fragmento, restauração ou reflow da lista). */
function scrollDashboardToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

async function loadValidityModule() {
  showDashboard();
  scrollDashboardToTop();
  const opEl = document.getElementById('validity-op-date');
  if (opEl) opEl.value = getBrazilDateKey();
  await loadLastCountPerProduct();
  await loadValidityLinesFromServer();
  await loadValidityProductsCatalog();
  renderValidityProductList();
  const pending = flattenValidityPendingAll().filter((e) => !e.synced).length;
  const badge = document.getElementById('validity-pending-badge');
  if (badge) {
    badge.hidden = pending === 0;
    badge.textContent = `${pending} pendentes`;
  }
  scrollDashboardToTop();
  requestAnimationFrame(() => {
    scrollDashboardToTop();
    requestAnimationFrame(scrollDashboardToTop);
  });
}

function registerValidityLineLocal(codRaw, expirationDateStr) {
  if (!isValidityOperationalEditable()) {
    setValidityFeedback('Lancamento apenas na data de hoje (America/Sao_Paulo).', true);
    return;
  }
  const cod = normalizeItemCode(codRaw);
  if (!cod) return;
  if (!expirationDateStr || String(expirationDateStr).trim().length < 8) {
    setValidityFeedback('Informe a data de vencimento.', true);
    return;
  }
  const dayKey = getActiveValidityOpDateKey();
  const events = loadValidityEventsForDate(dayKey);
  const ev = {
    client_event_id: makeEventId(),
    cod_produto: cod,
    expiration_date: String(expirationDateStr).slice(0, 10),
    quantity_un: 0,
    lot_code: null,
    note: null,
    observed_at: new Date().toISOString(),
    synced: false,
    device_name: getDeviceName(),
    operational_day: dayKey,
  };
  events.push(ev);
  saveValidityEventsForDate(dayKey, events);
  setValidityFeedback(`Validade ${ev.expiration_date} gravada localmente. Sincronize quando estiver online.`, false);
  renderValidityProductList();
  const pending = flattenValidityPendingAll().filter((e) => !e.synced).length;
  const badge = document.getElementById('validity-pending-badge');
  if (badge) {
    badge.hidden = pending === 0;
    badge.textContent = `${pending} pendentes`;
  }
  if (navigator.onLine) {
    syncValidityPending();
  }
}

async function syncValidityPending() {
  const token = getToken();
  if (!token) return;
  if (!navigator.onLine) {
    setValidityFeedback('Sem conexao. Tentaremos sincronizar depois.', true);
    return;
  }
  const dayKey = getBrazilDateKey();
  const bucket = loadValidityBucketRaw();
  const allDays = Object.keys(bucket).flatMap((k) => (Array.isArray(bucket[k]) ? bucket[k] : []));
  const pending = allDays.filter((e) => e && !e.synced);
  if (!pending.length) {
    setValidityFeedback('Nada pendente de sincronizacao.');
    return;
  }
  const body = {
    reference_date: getActiveValidityOpDateKey(),
    events: pending.map((e) => ({
      client_event_id: e.client_event_id,
      cod_produto: normalizeItemCode(e.cod_produto),
      expiration_date: e.expiration_date,
      quantity_un: Math.max(0, Math.round(Number(e.quantity_un) || 0)),
      lot_code: e.lot_code || null,
      note: e.note || null,
      observed_at: e.observed_at || new Date().toISOString(),
      device_name: e.device_name || getDeviceName(),
    })),
  };
  try {
    const resp = await apiFetch(API_VALIDITY_EVENTS, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (handleUnauthorizedResponse(resp)) return;
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const d = err.detail;
      const msg =
        typeof d === 'string'
          ? d
          : Array.isArray(d)
            ? d.map((x) => x.msg || x).join(' ')
            : 'Falha ao sincronizar validades.';
      setValidityFeedback(msg, true);
      return;
    }
    const data = await resp.json();
    const synced = new Set(data.synced_ids || []);
    const b = loadValidityBucketRaw();
    let changed = false;
    for (const k of Object.keys(b)) {
      const arr = b[k];
      if (!Array.isArray(arr)) continue;
      for (let i = 0; i < arr.length; i++) {
        const ev = arr[i];
        if (ev && synced.has(ev.client_event_id)) {
          b[k][i] = { ...ev, synced: true };
          changed = true;
        }
      }
    }
    if (changed) saveValidityBucketRaw(b);
    touchValidityLastSync();
    setValidityFeedback(`Sincronizado: ${synced.size} lancamento(s).`);
    await loadValidityLinesFromServer();
    renderValidityProductList();
    const badge = document.getElementById('validity-pending-badge');
    const left = flattenValidityPendingAll().filter((e) => !e.synced).length;
    if (badge) {
      badge.hidden = left === 0;
      badge.textContent = `${left} pendentes`;
    }
  } catch {
    setValidityFeedback('Erro de rede ao sincronizar.', true);
  }
}

async function removeValidityLine(lineId, clientId, codRaw) {
  if (!isValidityOperationalEditable()) {
    setValidityFeedback('Remocao apenas no dia corrente.', true);
    return;
  }
  const cod = normalizeItemCode(codRaw);
  const dayKey = getActiveValidityOpDateKey();
  if (lineId) {
    const resp = await apiFetch(`${API_VALIDITY_LINES}/${lineId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (handleUnauthorizedResponse(resp)) return;
    if (!resp.ok) {
      setValidityFeedback('Nao foi possivel remover no servidor.', true);
      return;
    }
    await loadValidityLinesFromServer();
    renderValidityProductList();
    setValidityFeedback('Linha removida.');
    return;
  }
  if (clientId) {
    const events = loadValidityEventsForDate(dayKey);
    const next = events.filter((e) => e.client_event_id !== clientId);
    saveValidityEventsForDate(dayKey, next);
    renderValidityProductList();
    setValidityFeedback('Lancamento local removido.');
  }
}

function bindValidityEvents() {
  const shell = document.getElementById('validity-products-shell');
  const opDate = document.getElementById('validity-op-date');
  const itemCode = document.getElementById('validity-item-code');
  const grp = document.getElementById('validity-group');
  const risk = document.getElementById('validity-risk-filter');
  const btnSync = document.getElementById('btn-validity-sync');

  if (itemCode) {
    itemCode.addEventListener('input', () => renderValidityProductList());
  }
  if (grp) {
    grp.addEventListener('input', () => renderValidityProductList());
  }
  if (risk) {
    risk.addEventListener('change', () => renderValidityProductList());
  }
  const sortEl = document.getElementById('validity-sort');
  if (sortEl) {
    sortEl.addEventListener('change', () => renderValidityProductList());
  }
  const kpiStrip = document.getElementById('validity-kpi-strip');
  if (kpiStrip && kpiStrip.dataset.kpiBound !== '1') {
    kpiStrip.dataset.kpiBound = '1';
    kpiStrip.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-validity-kpi]');
      if (!btn) return;
      const k = btn.getAttribute('data-validity-kpi');
      if (!k) return;
      validityActiveKpiKey = validityActiveKpiKey === k ? null : k;
      renderValidityProductList();
    });
  }
  if (opDate) {
    opDate.addEventListener('change', async () => {
      await loadValidityLinesFromServer();
      renderValidityProductList();
    });
  }
  if (btnSync) {
    btnSync.addEventListener('click', () => syncValidityPending());
  }

  if (shell && shell.dataset.validityBound !== '1') {
    shell.dataset.validityBound = '1';
    shell.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.validity-btn-add');
      if (addBtn) {
        const codRefEnc = addBtn.getAttribute('data-coderef') || '';
        const cod = normalizeItemCode(decodeURIComponent(codRefEnc));
        const expEl = document.getElementById(`validity-exp-${codRefEnc}`);
        registerValidityLineLocal(cod, expEl && expEl.value);
        if (expEl) expEl.value = '';
        return;
      }
      const rem = e.target.closest('.btn-validity-remove');
      if (rem) {
        const lid = rem.getAttribute('data-line-id');
        const cid = rem.getAttribute('data-client-id');
        const cref = rem.getAttribute('data-coderef') || '';
        const cod = normalizeItemCode(decodeURIComponent(cref));
        removeValidityLine(lid ? Number(lid) : null, cid || null, cod);
      }
    });
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
  const allEv = flattenAllCountEventsFromBucket();
  const pending = allEv.filter((event) => !event.synced);

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

  const allEv = flattenAllCountEventsFromBucket();
  const pending = allEv.filter((event) => !event.synced);
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
    markEventsSyncedInBucket(syncedIds);
    renderCounts();
    setFeedback(`Sincronizacao concluida: ${syncedIds.size} evento(s) enviado(s).`);
    await loadServerCountTotals();
    refreshCountProductListView();
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
  if (!isCountOperationalEditable()) {
    setFeedback('Só é possível lançar contagem na data de hoje (America/Sao_Paulo).', true);
    return;
  }
  registerCountDelta(itemCodeInput, 1, 'caixa');
}

/** Confirma saldo zero com TXT quando total e saldo são 0 (sem substituir total pelo input). */
function tryConfirmExplicitZeroOnBlur(codRefEnc, countTypeRaw) {
  const codRaw = decodeURIComponent(String(codRefEnc || ''));
  const itemCode = normalizeItemCode(codRaw);
  const countType = normalizeCountType(countTypeRaw || 'caixa');
  if (!itemCode || !isCountOperationalEditable()) return;
  const current = getNetByProductAndType(itemCode, countType);
  if (current !== 0) return;
  if (!countImportBalancesState.hasTxt) return;
  const pair = getCountSaldoPair(itemCode);
  if (!pair) return;
  const s = countType === 'caixa' ? pair.import_caixa : pair.import_unidade;
  if (Math.max(0, Math.round(Number(s) || 0)) !== 0) return;
  setCountExplicitZero(itemCode, countType, true);
}

function parseOperationQtyFromInputEl(inp) {
  if (!inp) return null;
  const digitsOnly = String(inp.value ?? '').replace(/\D/g, '');
  if (digitsOnly === '') return null;
  const n = parseInt(digitsOnly, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Mesmo fluxo do clique no botão + da linha (delegação existente em .count-products-shell). */
function dispatchCountRowPlusClick(inp) {
  if (!inp || !inp.classList?.contains('count-product-qty')) return;
  const row = inp.closest('.count-control-row');
  const plusBtn = row?.querySelector('.btn-count-adjust.btn-plus');
  if (!plusBtn || plusBtn.disabled) return;
  plusBtn.click();
}

/**
 * + soma o valor digitado ao total; − subtrai (mínimo 0). Input = quantidade da operação, não total absoluto.
 */
function applyCountRowOperation(codRefEnc, countTypeRaw, inp, direction) {
  const opQty = parseOperationQtyFromInputEl(inp);
  if (opQty == null) {
    setFeedback('Digite uma quantidade maior que zero para aplicar com + ou −.', true);
    return;
  }
  const refDecoded = decodeURIComponent(String(codRefEnc || ''));
  const itemCode = normalizeItemCode(refDecoded);
  const ct = normalizeCountType(countTypeRaw || 'caixa');
  const current = getNetByProductAndType(itemCode, ct);
  let delta;
  if (direction > 0) {
    delta = opQty;
  } else {
    delta = -Math.min(opQty, Math.max(0, current));
  }
  if (delta === 0) {
    if (inp) inp.value = '';
    refreshCountProductListView();
    return;
  }
  registerCountDelta(itemCode, delta, ct);
  if (inp) inp.value = '';
}

function registerCountDelta(itemCodeInput, qtyDeltaInput, countTypeInput = 'caixa') {
  if (!isCountOperationalEditable()) {
    setFeedback('Só é possível lançar contagem na data de hoje (America/Sao_Paulo).', true);
    return;
  }
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

  const dayKey = getActiveCountDateKey();
  const events = loadCountEventsForDate(dayKey);
  const event = {
    client_event_id: makeEventId(),
    item_code: itemCode,
    count_type: countType,
    quantity,
    observed_at: new Date().toISOString(),
    synced: false,
    device_name: getDeviceName(),
    count_date: dayKey,
  };

  events.push(event);
  saveCountEventsForDate(dayKey, events);
  const netAfterType = getNetByProductAndType(itemCode, countType);
  if (netAfterType !== 0) setCountExplicitZero(itemCode, countType, false);
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
  const netCx = Math.max(0, Math.round(Number(getNetByProductAndType(itemCode, 'caixa')) || 0));
  const netUn = Math.max(0, Math.round(Number(getNetByProductAndType(itemCode, 'unidade')) || 0));
  const deltaStr = quantity > 0 ? `+${quantity}` : String(quantity);
  setFeedback(
    `${productName}: ${deltaStr} ${countTypeLabel === 'Caixa' ? 'CX' : 'UN'} · Total operação ${formatIntegerBR(netCx)} CX e ${formatIntegerBR(netUn)} UN`,
    false,
    true,
  );

  const lastLaunch = document.getElementById('count-last-launch');
  if (lastLaunch) {
    lastLaunch.hidden = false;
    lastLaunch.innerHTML =
      `<span class="count-last-launch-kicker">Último lançamento</span>` +
      `<span class="count-last-launch-body">` +
      `<strong class="count-last-launch-name">${escapeHtml(productName)}</strong> ` +
      `<span class="count-last-launch-delta">(${deltaStr} ${countTypeLabel === 'Caixa' ? 'CX' : 'UN'})</span>` +
      ` · Total operação: <strong>${formatIntegerBR(netCx)} CX</strong> · <strong>${formatIntegerBR(netUn)} UN</strong>` +
      `</span>`;
  }

  if (navigator.onLine) {
    syncPendingEvents();
  }
}

function exportBackup() {
  migrateLegacyCountEventsIfNeeded();
  const bucket = loadCountEventsBucketRaw();
  const payload = {
    exported_at: new Date().toISOString(),
    device_name: getDeviceName(),
    events_by_day: bucket,
    events: flattenAllCountEventsFromBucket(),
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
    migrateLegacyCountEventsIfNeeded();
    const bucket = loadCountEventsBucketRaw();
    const knownIds = new Set(flattenAllCountEventsFromBucket().map((e) => e.client_event_id));
    const incoming = Array.isArray(data.events) ? data.events : [];

    for (const event of incoming) {
      if (!event || typeof event !== 'object') continue;
      if (!event.client_event_id || knownIds.has(event.client_event_id)) continue;
      if (!event.item_code || !Number.isInteger(event.quantity) || event.quantity === 0) continue;
      const day = event.count_date || getBrazilDateKey();
      if (!bucket[day]) bucket[day] = [];
      bucket[day].push({
        client_event_id: String(event.client_event_id),
        item_code: normalizeItemCode(String(event.item_code)),
        count_type: normalizeCountType(event.count_type),
        quantity: Number(event.quantity),
        observed_at: event.observed_at || new Date().toISOString(),
        synced: Boolean(event.synced),
        device_name: event.device_name || getDeviceName(),
        synced_at: event.synced_at || null,
        count_date: day,
      });
      knownIds.add(event.client_event_id);
    }

    saveCountEventsBucketRaw(bucket);
    renderCounts();
    setFeedback('Backup importado com sucesso.');
  } catch {
    setFeedback('Arquivo de backup invalido.', true);
  }
}

function bindCountEvents() {
  if (countForm) {
    countForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const itemCode = document.getElementById('item-code').value;
      registerCount(itemCode);
      document.getElementById('item-code').value = '';
      document.getElementById('item-code').focus();
    });
  }

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

  const countDateEl = document.getElementById('count-date');
  if (countDateEl) {
    countDateEl.addEventListener('change', async () => {
      await Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]);
      refreshCountProductListView();
      updateCountReadOnlyState();
    });
  }

  const countShell = document.querySelector('.count-products-shell');
  if (countShell && countShell.dataset.countDelegates !== '1') {
    countShell.dataset.countDelegates = '1';
    const refreshCountListAfterEdit = () => {
      refreshCountProductListView();
    };
    countShell.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-count-adjust');
      if (!btn || !countShell.contains(btn)) return;
      e.preventDefault();
      const codRefEnc = btn.getAttribute('data-coderef') || '';
      const deltaBtn = Number(btn.dataset.delta);
      const countType = btn.dataset.countType || 'caixa';
      if (!codRefEnc || !Number.isFinite(deltaBtn)) return;
      if (deltaBtn !== 1 && deltaBtn !== -1) return;
      const row = btn.closest('.count-control-row');
      const inp = row ? row.querySelector('input.count-product-qty') : null;
      applyCountRowOperation(codRefEnc, countType, inp, deltaBtn);
      refreshCountListAfterEdit();
    });
    countShell.addEventListener('focusout', (e) => {
      const inp = e.target;
      if (!inp || !inp.classList || !inp.classList.contains('count-product-qty')) return;
      if (!countShell.contains(inp)) return;
      const next = e.relatedTarget;
      if (next && typeof next.closest === 'function' && next.closest('.btn-count-adjust') && countShell.contains(next)) {
        return;
      }
      const ref = inp.getAttribute('data-coderef') || '';
      const ct = inp.getAttribute('data-count-type') || 'caixa';
      tryConfirmExplicitZeroOnBlur(ref, ct);
      if (parseOperationQtyFromInputEl(inp) != null) {
        dispatchCountRowPlusClick(inp);
      }
      refreshCountListAfterEdit();
    });
    countShell.addEventListener('keydown', (e) => {
      const inp = e.target;
      if (!inp.classList?.contains('count-product-qty')) return;
      const isEnter = e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13;
      if (!isEnter) return;
      e.preventDefault();
      e.stopPropagation();
      dispatchCountRowPlusClick(inp);
    });
    countShell.addEventListener(
      'wheel',
      (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('count-product-qty')) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }

  window.addEventListener('online', () => {
    updateNetworkStatus();
    syncPendingEvents();
    loadServerCountTotals().then(() => refreshCountProductListView());
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();
    setFeedback('Modo offline ativo. Continue contando normalmente.');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!navigator.onLine) return;
    if (!getToken()) return;
    if (unauthorizedRedirectInProgress) return;
    if (countTotalsVisibilityRefreshTimer) {
      clearTimeout(countTotalsVisibilityRefreshTimer);
    }
    countTotalsVisibilityRefreshTimer = setTimeout(() => {
      countTotalsVisibilityRefreshTimer = null;
      if (!getToken() || unauthorizedRedirectInProgress) return;
      loadServerCountTotals().then(() => refreshCountProductListView());
    }, 200);
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
              li.innerHTML = `<span><strong>${it.cod_produto || '-'}<\/strong> - ${it.descricao || '-'} <span class="status-badge badge-inactive">Inativo · via TXT (regularizar no cadastro)<\/span><\/span>` +
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
  const allEv = flattenAllCountEventsFromBucket();
  const pending = allEv.filter((e) => !e.synced);
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
    markEventsSyncedInBucket(syncedIds);
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

/** Filtro do resumo (clique no card): null = todos. */
let countAuditSummaryFilterKey = null;

function updateCountAuditSummarySelection() {
  if (!countAuditSummary) return;
  countAuditSummary.querySelectorAll('.count-audit-summary-item[data-count-audit-filter]').forEach((el) => {
    const active = el.dataset.countAuditFilter === countAuditSummaryFilterKey;
    el.classList.toggle('is-selected', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderCountAuditSummary(summary) {
  if (!countAuditSummary) return;
  const s = summary || {};
  countAuditSummary.innerHTML = '';
  const rows = [
    ['Itens com saldo', Number(s.total_import_items) || 0, 'is-neutral', 'balance'],
    ['Itens com contagem', Number(s.counted_items) || 0, 'is-info', 'counted'],
    ['Conferidos', Number(s.equal_items) || 0, 'is-ok', 'equal'],
    ['Divergências', Number(s.divergent_items) || 0, 'is-warn', 'divergent'],
    ['Sem contagem', Number(s.missing_in_count) || 0, 'is-danger', 'missing'],
    ['Só na contagem', Number(s.extra_in_count) || 0, 'is-purple', 'extra'],
  ];
  for (const [label, value, tone, filterKey] of rows) {
    const li = document.createElement('li');
    li.className = `count-audit-summary-item count-audit-summary-item--clickable ${tone}`;
    li.setAttribute('data-count-audit-filter', filterKey);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-pressed', 'false');
    li.title = `Filtrar lista: ${label}. Clique de novo para mostrar todos.`;
    li.innerHTML =
      `<span class="count-audit-summary-label">${label}</span>` +
      `<strong class="count-audit-summary-value">${formatIntegerBR(value)}</strong>`;
    countAuditSummary.appendChild(li);
  }
  updateCountAuditSummarySelection();

  if (!countAuditSummary.dataset.filterBound) {
    countAuditSummary.dataset.filterBound = '1';
    countAuditSummary.addEventListener('click', (e) => {
      const li = e.target.closest('.count-audit-summary-item[data-count-audit-filter]');
      if (!li) return;
      const key = li.dataset.countAuditFilter;
      countAuditSummaryFilterKey = countAuditSummaryFilterKey === key ? null : key;
      updateCountAuditSummarySelection();
      if (window.lastCountAuditRows) {
        renderCountAuditRows(window.lastCountAuditRows);
      }
    });
    countAuditSummary.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const li = e.target.closest('.count-audit-summary-item[data-count-audit-filter]');
      if (!li) return;
      e.preventDefault();
      li.click();
    });
  }
}

function getAuditStatusRank(status) {
  const m = { missing_in_count: 0, divergent: 1, extra_in_count: 2, ok: 3 };
  return m[status] ?? 9;
}

function compareAuditCodProduto(a, b) {
  return String(a.cod_produto || '').localeCompare(String(b.cod_produto || ''), 'pt-BR', { numeric: true });
}

/** Ordenação da lista (select #count-audit-sort). */
function sortCountAuditRowsForDisplay(list) {
  const sortEl = document.getElementById('count-audit-sort');
  const mode = (sortEl && sortEl.value) || 'status';

  const tieCod = (a, b, primary) => {
    const p = primary(a, b);
    if (p !== 0) return p;
    return compareAuditCodProduto(a, b);
  };

  switch (mode) {
    case 'cod_asc':
      list.sort(compareAuditCodProduto);
      break;
    case 'cod_desc':
      list.sort((a, b) => compareAuditCodProduto(b, a));
      break;
    case 'nome_asc':
      list.sort((a, b) =>
        tieCod(a, b, (x, y) =>
          String(x.descricao || '')
            .toLowerCase()
            .localeCompare(String(y.descricao || '').toLowerCase(), 'pt-BR'),
        ),
      );
      break;
    case 'nome_desc':
      list.sort((a, b) =>
        tieCod(a, b, (x, y) =>
          String(y.descricao || '')
            .toLowerCase()
            .localeCompare(String(x.descricao || '').toLowerCase(), 'pt-BR'),
        ),
      );
      break;
    case 'grupo_asc':
      list.sort((a, b) => {
        const ga = (a.grupo || 'Sem grupo').toLowerCase();
        const gb = (b.grupo || 'Sem grupo').toLowerCase();
        const g = ga.localeCompare(gb, 'pt-BR');
        if (g !== 0) return g;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'grupo_desc':
      list.sort((a, b) => {
        const ga = (a.grupo || 'Sem grupo').toLowerCase();
        const gb = (b.grupo || 'Sem grupo').toLowerCase();
        const g = gb.localeCompare(ga, 'pt-BR');
        if (g !== 0) return g;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'diff_desc':
      list.sort((a, b) => {
        const d = (Number(b.difference_abs) || 0) - (Number(a.difference_abs) || 0);
        if (d !== 0) return d;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'diff_asc':
      list.sort((a, b) => {
        const d = (Number(a.difference_abs) || 0) - (Number(b.difference_abs) || 0);
        if (d !== 0) return d;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'saldo_cx_desc':
      list.sort((a, b) => {
        const d = (Number(b.import_caixa) || 0) - (Number(a.import_caixa) || 0);
        if (d !== 0) return d;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'saldo_cx_asc':
      list.sort((a, b) => {
        const d = (Number(a.import_caixa) || 0) - (Number(b.import_caixa) || 0);
        if (d !== 0) return d;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'saldo_un_desc':
      list.sort((a, b) => {
        const d = (Number(b.import_unidade) || 0) - (Number(a.import_unidade) || 0);
        if (d !== 0) return d;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'saldo_un_asc':
      list.sort((a, b) => {
        const d = (Number(a.import_unidade) || 0) - (Number(b.import_unidade) || 0);
        if (d !== 0) return d;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'status':
    default:
      list.sort((a, b) => {
        const r = getAuditStatusRank(a.status) - getAuditStatusRank(b.status);
        if (r !== 0) return r;
        const da = Number(a.difference_abs) || 0;
        const db = Number(b.difference_abs) || 0;
        if (da !== db) return db - da;
        const ga = (a.grupo || 'Sem grupo').toLowerCase();
        const gb = (b.grupo || 'Sem grupo').toLowerCase();
        if (ga !== gb) return ga.localeCompare(gb, 'pt-BR');
        return compareAuditCodProduto(a, b);
      });
  }
}

function matchesCountAuditSummaryFilter(row, key) {
  if (!key) return true;
  const cx = Number(row.counted_caixa) || 0;
  const un = Number(row.counted_unidade) || 0;
  switch (key) {
    case 'balance':
      return row.status !== 'extra_in_count';
    case 'counted':
      return cx !== 0 || un !== 0;
    case 'equal':
      return row.status === 'ok';
    case 'divergent':
      return row.status === 'divergent';
    case 'missing':
      return row.status === 'missing_in_count';
    case 'extra':
      return row.status === 'extra_in_count';
    default:
      return true;
  }
}

// Eventos para barra de pesquisa na análise de contagem
const countAuditSearch = document.getElementById('count-audit-search');
const countAuditClearSearch = document.getElementById('count-audit-clear-search');
if (countAuditSearch) {
  countAuditSearch.addEventListener('input', () => {
    if (typeof countAuditState !== 'undefined') {
      countAuditState.showAllMissingMobile = false;
    }
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
    if (typeof countAuditState !== 'undefined') {
      countAuditState.showAllMissingMobile = false;
    }
    if (window.lastCountAuditRows) {
      renderCountAuditRows(window.lastCountAuditRows);
    }
    countAuditSearch.focus();
  });
}

const countAuditSort = document.getElementById('count-audit-sort');
if (countAuditSort) {
  countAuditSort.addEventListener('change', () => {
    if (typeof countAuditState !== 'undefined') {
      countAuditState.showAllMissingMobile = false;
    }
    if (window.lastCountAuditRows) {
      renderCountAuditRows(window.lastCountAuditRows);
    }
  });
}

async function loadCountAuditAnalysis() {
  if (!countAuditImport || !countAuditList) return;
  const token = getToken();
  if (!token) return;

  try {
    const referenceDate = (countAuditImport.value || '').trim();
    const onlyDiff = countAuditOnlyDiff ? countAuditOnlyDiff.checked : false;
    const params = new URLSearchParams();
    if (referenceDate) params.set('reference_date', referenceDate);
    params.set('only_diff', onlyDiff ? 'true' : 'false');
    params.set('only_active', 'true');
    params.set('limit', '5000');

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
    const rows = payload.rows || [];
    countAuditSummaryFilterKey = null;

    if (!info) {
      setCountAuditFeedback(
        'Não foi possível montar a análise. Verifique permissões ou tente novamente.',
        true,
      );
      renderCountAuditSummary({});
      window.lastCountAuditRows = [];
      renderCountAuditRows([]);
      return;
    }

    const isSynthetic = info.id == null;
    if (isSynthetic) {
      setCountAuditFeedback(
        `${info.file_name || 'Análise sem TXT.'} Importe um TXT em Contagem → Importar Estoque quando quiser comparar com o saldo do arquivo.`,
        false,
      );
    } else {
      setCountAuditFeedback(
        `Base de saldo (TXT): ${info.reference_date || '-'} — ${info.file_name || 'arquivo'}`,
        false,
      );
    }

    renderCountAuditSummary(payload.summary || {});
    window.lastCountAuditRows = rows;
    renderCountAuditRows(window.lastCountAuditRows);
  } catch {
    setCountAuditFeedback('Erro de conexão ao carregar análise de contagem.', true);
  }
}

async function exportCountAuditExcel() {
  const token = getToken();
  if (!token) return;
  if (!countAuditImport) return;

  const referenceDate = (countAuditImport.value || '').trim();
  const onlyDiff = countAuditOnlyDiff ? countAuditOnlyDiff.checked : false;
  const params = new URLSearchParams();
  if (referenceDate) params.set('reference_date', referenceDate);
  params.set('only_diff', onlyDiff ? 'true' : 'false');
  params.set('only_active', 'true');
  params.set('limit', '20000');

  setCountAuditFeedback('Gerando Excel...', false);

  try {
    const response = await apiFetch(`${API_STOCK_ANALYSIS_EXPORT_XLSX}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setCountAuditFeedback(err.detail || 'Não foi possível gerar o Excel.', true);
      return;
    }
    const blob = await response.blob();
    let filename = 'analise-contagem.xlsx';
    const cd = response.headers.get('Content-Disposition');
    if (cd) {
      const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(cd);
      const raw = m ? decodeURIComponent(m[1] || m[2] || '') : '';
      if (raw) filename = raw.trim();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setCountAuditFeedback('Excel baixado com sucesso.');
  } catch {
    setCountAuditFeedback('Falha ao baixar o Excel. Verifique a conexão.', true);
  }
}

function bindCountAuditEvents() {
  if (!countAuditImport) return;

  if (btnCountAuditRefresh) {
    btnCountAuditRefresh.addEventListener('click', () => {
      loadCountAuditAnalysis();
    });
  }

  if (btnCountAuditExportExcel) {
    btnCountAuditExportExcel.addEventListener('click', () => {
      exportCountAuditExcel();
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

const API_STOCK_ANALYSIS_DETAIL = '/audit/stock-analysis/detail';
const countAuditGroupFilter = document.getElementById('count-audit-group');
const countAuditStatusFilter = document.getElementById('count-audit-status');
const countAuditPriorityFilter = document.getElementById('count-audit-priority');
const countAuditDivergenceFilter = document.getElementById('count-audit-divergence');
const countAuditOnlyPending = document.getElementById('count-audit-only-pending');
const countAuditOnlyCritical = document.getElementById('count-audit-only-critical');
const countAuditOnlyMissing = document.getElementById('count-audit-only-missing');
const countAuditClearFilters = document.getElementById('count-audit-clear-filters');
const countAuditToggleFilters = document.getElementById('count-audit-toggle-filters');
const countAuditRangeInfo = document.getElementById('count-audit-range-info');
const countAuditDetailStatus = document.getElementById('count-audit-detail-status');
const countAuditDetailPanel = document.getElementById('count-audit-detail');
const countAuditOperationalDate = document.getElementById('count-audit-operational-date');
const countAuditAnalysisStatus = document.getElementById('count-audit-analysis-status');
const countAuditLastSync = document.getElementById('count-audit-last-sync');
const countAuditBaseSource = document.getElementById('count-audit-base-source');
const countAuditBaseSourceNote = document.getElementById('count-audit-base-source-note');
const countAuditModeIndicator = document.getElementById('count-audit-mode-indicator');
const countAuditFiltersCard = document.querySelector('#sub-count-audit .count-audit-filters-card');
const countAuditMobileMediaQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(max-width: 760px)')
  : null;

const countAuditState = {
  rows: [],
  summary: {},
  importInfo: null,
  loadedAt: null,
  selectedCode: null,
  detailCache: new Map(),
  loadingDetailCode: null,
  showAllMissingMobile: false,
  mobileFiltersExpanded: false,
};
let countAuditDetailRequestSeq = 0;
let countPrefillProductCode = null;

function formatSignedIntegerBR(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${formatIntegerBR(n)}` : formatIntegerBR(n);
}

function formatAuditRelativeTime(isoValue) {
  if (!isoValue) return '--';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return formatDateTime(isoValue);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) {
    return `${formatDateTime(isoValue)} (${diffMinutes === 0 ? 'agora' : `${Math.abs(diffMinutes)} min`})`;
  }
  return formatDateTime(isoValue);
}

function isCountAuditMobileViewport() {
  return !!countAuditMobileMediaQuery?.matches;
}

function getCountAuditDetailCacheKey(code) {
  return `${(countAuditImport?.value || '').trim() || '-'}::${String(code || '')}`;
}

function getCountAuditCachedDetail(code) {
  return countAuditState.detailCache.get(getCountAuditDetailCacheKey(code)) || null;
}

function hasCountAuditAdvancedFiltersActive() {
  return Boolean(
    (countAuditGroupFilter?.value || '').trim()
    || (countAuditStatusFilter?.value || '').trim()
    || (countAuditPriorityFilter?.value || '').trim()
    || (countAuditDivergenceFilter?.value || '').trim(),
  );
}

function syncCountAuditFiltersPresentation() {
  if (!countAuditFiltersCard) return;
  const expanded = !isCountAuditMobileViewport()
    || !!countAuditState.mobileFiltersExpanded
    || hasCountAuditAdvancedFiltersActive();
  countAuditFiltersCard.classList.toggle('is-expanded', expanded);
  if (countAuditToggleFilters) {
    countAuditToggleFilters.hidden = !isCountAuditMobileViewport();
    countAuditToggleFilters.textContent = expanded ? 'Menos filtros' : 'Mais filtros';
    countAuditToggleFilters.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function shouldCompactMissingRowsForMobile(filters) {
  return isCountAuditMobileViewport()
    && !filters.search
    && !filters.onlyMissing
    && filters.status !== 'missing'
    && filters.divergence !== 'missing'
    && countAuditSummaryFilterKey !== 'missing';
}

function compactMissingRowsForMobile(list, filters) {
  const missingRows = list.filter((row) => row._auditMeta?.stateKey === 'missing');
  const nonMissingRows = list.filter((row) => row._auditMeta?.stateKey !== 'missing');
  const visibleLimit = 8;
  if (!shouldCompactMissingRowsForMobile(filters) || missingRows.length <= visibleLimit) {
    return {
      rows: list,
      hiddenMissingCount: 0,
      totalMissingCount: missingRows.length,
      nonMissingCount: nonMissingRows.length,
      compacted: false,
    };
  }

  const visibleMissingRows = countAuditState.showAllMissingMobile ? missingRows : missingRows.slice(0, visibleLimit);
  return {
    rows: [...nonMissingRows, ...visibleMissingRows],
    hiddenMissingCount: countAuditState.showAllMissingMobile ? 0 : Math.max(0, missingRows.length - visibleLimit),
    totalMissingCount: missingRows.length,
    nonMissingCount: nonMissingRows.length,
    compacted: true,
  };
}

function getCountAuditCompactActionLabel(meta = {}) {
  switch (meta.stateKey) {
    case 'missing':
      return 'Contagem imediata';
    case 'critical':
      return 'Recontagem prioritária';
    case 'high':
      return 'Revisar lançamentos';
    case 'light':
      return 'Validar ajuste';
    default:
      return 'Sem ação imediata';
  }
}

function getCountAuditFiltersSnapshot() {
  return {
    search: (countAuditSearch?.value || '').trim().toLowerCase(),
    group: (countAuditGroupFilter?.value || '').trim(),
    status: (countAuditStatusFilter?.value || '').trim(),
    priority: (countAuditPriorityFilter?.value || '').trim(),
    divergence: (countAuditDivergenceFilter?.value || '').trim(),
    onlyPending: !!countAuditOnlyPending?.checked,
    onlyCritical: !!countAuditOnlyCritical?.checked,
    onlyMissing: !!countAuditOnlyMissing?.checked,
    onlyDiff: !!countAuditOnlyDiff?.checked,
  };
}

function enrichCountAuditRow(row) {
  if (!row || row._auditMeta) return row;
  const importCx = Number(row.import_caixa) || 0;
  const importUn = Number(row.import_unidade) || 0;
  const countedCx = Number(row.counted_caixa) || 0;
  const countedUn = Number(row.counted_unidade) || 0;
  const diffCx = Number(row.difference_caixa) || 0;
  const diffUn = Number(row.difference_unidade) || 0;
  const diffAbs = Number(row.difference_abs) || (Math.abs(diffCx) + Math.abs(diffUn));
  const hasCount = countedCx !== 0 || countedUn !== 0;
  const diffDims = (diffCx !== 0 ? 1 : 0) + (diffUn !== 0 ? 1 : 0);

  let stateKey = 'ok';
  let stateLabel = 'Conferido';
  let priorityLabel = 'Baixa';
  let priorityRank = 4;
  let divergenceType = 'none';
  let divergenceLabel = 'Sem divergência';
  let recommendedAction = 'Somente monitorar';
  let insight = 'Saldo TXT e contagem atual estão alinhados.';

  if (row.status === 'missing_in_count') {
    stateKey = 'missing';
    stateLabel = 'Sem lançamento';
    priorityLabel = 'Imediata';
    priorityRank = 0;
    divergenceType = 'missing';
    divergenceLabel = 'Sem contagem';
    recommendedAction = 'Acionar contagem imediata';
    insight = 'O item existe na base, mas não recebeu lançamento no dia operacional.';
  } else if (row.status === 'extra_in_count') {
    stateKey = 'critical';
    stateLabel = 'Crítico';
    priorityLabel = 'Imediata';
    priorityRank = 0;
    divergenceType = 'extra';
    divergenceLabel = 'Sem base TXT';
    recommendedAction = 'Validar cadastro ou base importada';
    insight = 'Há contagem sem correspondência direta na base comparativa.';
  } else if (row.status === 'divergent') {
    divergenceType = diffDims === 2 ? 'both' : (diffCx !== 0 ? 'caixa' : 'unidade');
    divergenceLabel = divergenceType === 'both'
      ? 'Caixa e unidade'
      : divergenceType === 'caixa'
        ? 'Diferença em caixa'
        : 'Diferença em unidade';

    if (diffAbs >= 10 || (diffDims === 2 && diffAbs >= 6)) {
      stateKey = 'critical';
      stateLabel = 'Crítico';
      priorityLabel = 'Imediata';
      priorityRank = 0;
      recommendedAction = 'Abrir recontagem prioritária';
      insight = 'A diferença é alta e pede revisão completa antes da validação.';
    } else if (diffAbs >= 4 || diffDims === 2) {
      stateKey = 'high';
      stateLabel = 'Divergência alta';
      priorityLabel = 'Alta';
      priorityRank = 1;
      recommendedAction = 'Revisar lançamentos e conferir base';
      insight = 'Há impacto relevante no fechamento e o item deve subir na fila.';
    } else {
      stateKey = 'light';
      stateLabel = 'Divergência leve';
      priorityLabel = 'Média';
      priorityRank = 2;
      recommendedAction = 'Validar ajuste pontual';
      insight = 'Parece um desvio localizado, com baixa amplitude relativa.';
    }
  }

  return {
    ...row,
    _auditMeta: {
      stateKey,
      stateLabel,
      priorityLabel,
      priorityRank,
      divergenceType,
      divergenceLabel,
      recommendedAction,
      insight,
      diffAbs,
      diffCx,
      diffUn,
      hasCount,
      isPending: stateKey !== 'ok',
      isCritical: stateKey === 'critical' || stateKey === 'missing',
      isDivergent: row.status === 'divergent' || row.status === 'extra_in_count',
      totalBase: importCx + importUn,
      totalCount: countedCx + countedUn,
    },
  };
}

function getCountAuditRowsFromState() {
  return Array.isArray(countAuditState.rows) ? countAuditState.rows : [];
}

function getCountAuditDashboard(summary = countAuditState.summary, rows = getCountAuditRowsFromState()) {
  const total = (Number(summary.equal_items) || 0)
    + (Number(summary.divergent_items) || 0)
    + (Number(summary.missing_in_count) || 0)
    + (Number(summary.extra_in_count) || 0);
  const analyzed = Number(summary.counted_items) || rows.filter((row) => row._auditMeta?.hasCount).length;
  const pending = Math.max(0, total - (Number(summary.equal_items) || 0));
  const divergent = rows.filter((row) => row._auditMeta?.isDivergent).length;
  const critical = rows.filter((row) => row._auditMeta?.stateKey === 'critical').length;
  const missing = Number(summary.missing_in_count) || rows.filter((row) => row._auditMeta?.stateKey === 'missing').length;
  const completedPercent = total > 0 ? Math.round((analyzed / total) * 100) : 0;
  const biggestGap = rows.reduce((max, row) => Math.max(max, Number(row._auditMeta?.diffAbs) || 0), 0);
  return { total, analyzed, pending, divergent, critical, missing, completedPercent, biggestGap };
}

function updateCountAuditHeaderContext() {
  const dashboard = getCountAuditDashboard();
  const info = countAuditState.importInfo || {};
  const referenceDate = (countAuditImport?.value || '').trim() || countAuditState.importInfo?.reference_date || '';

  if (countAuditOperationalDate) {
    countAuditOperationalDate.textContent = referenceDate ? formatDateBR(referenceDate) : formatDateBR(getBrazilDateKey());
  }
  if (countAuditLastSync) {
    countAuditLastSync.textContent = countAuditState.loadedAt ? formatDateTime(countAuditState.loadedAt) : '--';
  }
  if (countAuditModeIndicator) {
    countAuditModeIndicator.textContent = 'Modo leitura';
  }
  if (countAuditAnalysisStatus) {
    let label = 'Aguardando carga';
    if (dashboard.total > 0) {
      if (dashboard.critical > 0 || dashboard.missing > 0) label = 'Ação imediata';
      else if (dashboard.pending > 0) label = 'Em validação';
      else label = 'Conferido';
    }
    countAuditAnalysisStatus.textContent = label;
  }
  if (countAuditBaseSource) {
    countAuditBaseSource.textContent = info.id == null
      ? 'Saldo sintético'
      : `TXT ${formatDateBR(info.reference_date || referenceDate || '')}`;
  }
  if (countAuditBaseSourceNote) {
    countAuditBaseSourceNote.textContent = info.id == null
      ? (info.file_name || 'Sem importação TXT para a data.')
      : (info.file_name || 'Base TXT carregada');
  }
}

function populateCountAuditGroups(rows) {
  if (!countAuditGroupFilter) return;
  const current = countAuditGroupFilter.value;
  const groups = Array.from(new Set(rows.map((row) => String(row.grupo || 'Sem grupo').trim() || 'Sem grupo'))).sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );
  countAuditGroupFilter.innerHTML = '<option value="">Todos os grupos</option>'
    + groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
  if (groups.includes(current)) countAuditGroupFilter.value = current;
}

function getCountAuditRowByCode(code, rows = getCountAuditRowsFromState()) {
  return rows.find((row) => String(row.cod_produto || '') === String(code || '')) || null;
}

function setCountAuditFeedback(message, isError = false) {
  if (!countAuditFeedback) return;
  countAuditFeedback.textContent = message || '';
  countAuditFeedback.style.color = isError ? '#fee2e2' : '#e2e8f0';
  countAuditFeedback.style.borderColor = isError ? 'rgba(248, 113, 113, 0.32)' : 'rgba(255, 255, 255, 0.12)';
  countAuditFeedback.style.background = isError ? 'rgba(127, 29, 29, 0.18)' : 'rgba(255, 255, 255, 0.08)';
}

function updateCountAuditSummarySelection() {
  if (!countAuditSummary) return;
  countAuditSummary.querySelectorAll('.count-audit-summary-item[data-count-audit-filter]').forEach((el) => {
    const active = el.dataset.countAuditFilter === countAuditSummaryFilterKey;
    el.classList.toggle('is-selected', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderCountAuditSummary(summary) {
  if (!countAuditSummary) return;
  const rows = getCountAuditRowsFromState();
  const dashboard = getCountAuditDashboard(summary, rows);
  const cards = [
    ['Produtos pendentes', formatIntegerBR(dashboard.pending), 'is-warn', 'pending', 'Itens ainda fora do fechamento', false],
    ['Produtos com divergência', formatIntegerBR(dashboard.divergent), 'is-warn', 'divergent', 'Diferença entre base e contagem', false],
    ['Divergências críticas', formatIntegerBR(dashboard.critical), 'is-danger', 'critical', 'Itens que exigem ação imediata', false],
    ['Produtos sem contagem', formatIntegerBR(dashboard.missing), 'is-danger', 'missing', 'Base prevista sem lançamento', false],
    ['Total de produtos', formatIntegerBR(dashboard.total), 'is-neutral', 'all', 'Escopo ativo carregado', true],
    ['Produtos analisados', formatIntegerBR(dashboard.analyzed), 'is-info', 'analyzed', 'Itens com contagem registrada', true],
    ['Percentual concluído', `${dashboard.completedPercent}%`, 'is-ok', 'completed', `${formatIntegerBR(Number(summary.equal_items) || 0)} conferidos`, true],
    ['Maior divergência do dia', formatIntegerBR(dashboard.biggestGap), 'is-highlight', '', 'Maior impacto absoluto carregado', true],
  ];

  countAuditSummary.innerHTML = cards.map(([label, value, tone, filterKey, trend, isSecondary]) => {
    const attrs = filterKey
      ? ` data-count-audit-filter="${filterKey}" role="button" tabindex="0" aria-pressed="false"`
      : '';
    const clickableClass = filterKey ? ' count-audit-summary-item--clickable' : '';
    const secondaryClass = isSecondary ? ' count-audit-summary-item--secondary' : '';
    return (
      `<article class="count-audit-summary-item ${tone}${clickableClass}${secondaryClass}"${attrs}>` +
        `<span class="count-audit-summary-label">${label}</span>` +
        `<strong class="count-audit-summary-value">${value}</strong>` +
        `<span class="count-audit-summary-trend">${trend}</span>` +
      `</article>`
    );
  }).join('');

  updateCountAuditSummarySelection();

  if (!countAuditSummary.dataset.filterBound) {
    countAuditSummary.dataset.filterBound = '1';
    countAuditSummary.addEventListener('click', (e) => {
      const card = e.target.closest('.count-audit-summary-item[data-count-audit-filter]');
      if (!card) return;
      const key = card.dataset.countAuditFilter;
      countAuditSummaryFilterKey = countAuditSummaryFilterKey === key || key === 'all' ? null : key;
      countAuditState.showAllMissingMobile = false;
      updateCountAuditSummarySelection();
      renderCountAuditRows(getCountAuditRowsFromState());
    });
    countAuditSummary.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.count-audit-summary-item[data-count-audit-filter]');
      if (!card) return;
      e.preventDefault();
      card.click();
    });
  }
}

function getAuditStatusRank(row) {
  const stateKey = row?._auditMeta?.stateKey || 'ok';
  return { missing: 0, critical: 1, high: 2, light: 3, ok: 4 }[stateKey] ?? 9;
}

function compareAuditCodProduto(a, b) {
  return String(a.cod_produto || '').localeCompare(String(b.cod_produto || ''), 'pt-BR', { numeric: true });
}

function sortCountAuditRowsForDisplay(list) {
  const mode = (countAuditSort && countAuditSort.value) || 'relevance';
  const tieCod = (a, b, primary) => {
    const r = primary(a, b);
    return r !== 0 ? r : compareAuditCodProduto(a, b);
  };

  switch (mode) {
    case 'criticality':
    case 'relevance':
      list.sort((a, b) => {
        const pa = Number(a._auditMeta?.priorityRank) || 0;
        const pb = Number(b._auditMeta?.priorityRank) || 0;
        if (pa !== pb) return pa - pb;
        const ra = getAuditStatusRank(a);
        const rb = getAuditStatusRank(b);
        if (ra !== rb) return ra - rb;
        const da = Number(a._auditMeta?.diffAbs) || 0;
        const db = Number(b._auditMeta?.diffAbs) || 0;
        if (da !== db) return db - da;
        return compareAuditCodProduto(a, b);
      });
      break;
    case 'diff_desc':
      list.sort((a, b) => tieCod(a, b, (x, y) => (Number(y._auditMeta?.diffAbs) || 0) - (Number(x._auditMeta?.diffAbs) || 0)));
      break;
    case 'diff_asc':
      list.sort((a, b) => tieCod(a, b, (x, y) => (Number(x._auditMeta?.diffAbs) || 0) - (Number(y._auditMeta?.diffAbs) || 0)));
      break;
    case 'cod_asc':
      list.sort(compareAuditCodProduto);
      break;
    case 'cod_desc':
      list.sort((a, b) => compareAuditCodProduto(b, a));
      break;
    case 'nome_asc':
      list.sort((a, b) => tieCod(a, b, (x, y) => String(x.descricao || '').localeCompare(String(y.descricao || ''), 'pt-BR')));
      break;
    case 'nome_desc':
      list.sort((a, b) => tieCod(a, b, (x, y) => String(y.descricao || '').localeCompare(String(x.descricao || ''), 'pt-BR')));
      break;
    case 'grupo_asc':
      list.sort((a, b) => tieCod(a, b, (x, y) => String(x.grupo || 'Sem grupo').localeCompare(String(y.grupo || 'Sem grupo'), 'pt-BR')));
      break;
    case 'grupo_desc':
      list.sort((a, b) => tieCod(a, b, (x, y) => String(y.grupo || 'Sem grupo').localeCompare(String(x.grupo || 'Sem grupo'), 'pt-BR')));
      break;
    case 'saldo_cx_desc':
      list.sort((a, b) => tieCod(a, b, (x, y) => (Number(y.import_caixa) || 0) - (Number(x.import_caixa) || 0)));
      break;
    case 'saldo_un_desc':
      list.sort((a, b) => tieCod(a, b, (x, y) => (Number(y.import_unidade) || 0) - (Number(x.import_unidade) || 0)));
      break;
    case 'count_desc':
      list.sort((a, b) => tieCod(a, b, (x, y) => (Number(y._auditMeta?.totalCount) || 0) - (Number(x._auditMeta?.totalCount) || 0)));
      break;
    default:
      break;
  }
}

function matchesCountAuditSummaryFilter(row, key) {
  if (!key || key === 'all') return true;
  switch (key) {
    case 'analyzed':
      return !!row._auditMeta?.hasCount;
    case 'pending':
      return !!row._auditMeta?.isPending;
    case 'divergent':
      return !!row._auditMeta?.isDivergent;
    case 'critical':
      return row._auditMeta?.stateKey === 'critical';
    case 'missing':
      return row._auditMeta?.stateKey === 'missing';
    case 'completed':
      return row._auditMeta?.stateKey === 'ok';
    default:
      return true;
  }
}

function syncCountAuditListSelection() {
  if (!countAuditList) return;
  countAuditList.querySelectorAll('.count-audit-item[data-code]').forEach((item) => {
    item.classList.toggle('is-selected', item.dataset.code === String(countAuditState.selectedCode || ''));
  });
}

function renderCountAuditRows(rows) {
  if (!countAuditList) return;
  const previousSelectedCode = String(countAuditState.selectedCode || '');
  let list = Array.isArray(rows) ? rows.slice() : [];
  if (countAuditSummaryFilterKey) {
    list = list.filter((row) => matchesCountAuditSummaryFilter(row, countAuditSummaryFilterKey));
  }

  const filters = getCountAuditFiltersSnapshot();
  if (filters.search) {
    list = list.filter((row) => {
      const meta = row._auditMeta || {};
      const haystack = [
        row.cod_produto,
        row.descricao,
        row.grupo,
        meta.recommendedAction,
        meta.divergenceLabel,
      ].map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(filters.search));
    });
  }
  if (filters.group) list = list.filter((row) => String(row.grupo || 'Sem grupo') === filters.group);
  if (filters.status) list = list.filter((row) => row._auditMeta?.stateKey === filters.status);
  if (filters.priority) list = list.filter((row) => String(row._auditMeta?.priorityLabel || '').toLowerCase() === filters.priority);
  if (filters.divergence) list = list.filter((row) => row._auditMeta?.divergenceType === filters.divergence);
  if (filters.onlyPending) list = list.filter((row) => row._auditMeta?.isPending);
  if (filters.onlyCritical) list = list.filter((row) => row._auditMeta?.isCritical);
  if (filters.onlyMissing) list = list.filter((row) => row._auditMeta?.stateKey === 'missing');
  if (filters.onlyDiff) list = list.filter((row) => row._auditMeta?.isDivergent);

  sortCountAuditRowsForDisplay(list);

  if (countAuditTotal) countAuditTotal.textContent = formatIntegerBR(list.length);
  if (countAuditRangeInfo) {
    const loaded = getCountAuditRowsFromState().length;
    const limited = loaded >= 5000 ? ' Top 5.000 priorizados carregados.' : '';
    countAuditRangeInfo.textContent = `Exibindo ${formatIntegerBR(list.length)} de ${formatIntegerBR(loaded)} itens carregados.${limited}`;
  }

  if (!list.length) {
    countAuditList.innerHTML = '<li class="count-audit-empty"><span>Nenhum item corresponde aos filtros atuais.</span><strong>—</strong></li>';
    countAuditState.selectedCode = null;
    syncCountAuditListSelection();
    renderCountAuditDetailEmpty('Nenhum item atende aos filtros aplicados.');
    return;
  }

  if (!countAuditState.selectedCode || !list.some((row) => String(row.cod_produto || '') === String(countAuditState.selectedCode))) {
    countAuditState.selectedCode = String(list[0].cod_produto || '');
  }

  countAuditList.innerHTML = list.map((row) => {
    const meta = row._auditMeta || {};
    const code = String(row.cod_produto || '');
    return (
      `<li class="count-audit-item" data-state="${meta.stateKey}" data-code="${escapeHtml(code)}">` +
        `<div class="count-audit-row">` +
          `<div class="count-audit-cell count-audit-cell--product">` +
            `<button type="button" class="count-audit-row-select" data-action="select" data-code="${encodeURIComponent(code)}">` +
              `<div class="count-audit-row-topline">` +
                `<span class="count-audit-state-badge" data-state="${meta.stateKey}">${meta.stateLabel}</span>` +
                `<span class="count-audit-priority-badge">${meta.priorityLabel}</span>` +
                `<span class="count-audit-code-badge">${escapeHtml(code || '-')}</span>` +
              `</div>` +
              `<strong class="count-audit-row-name">${escapeHtml(row.descricao || 'Sem descrição')}</strong>` +
              `<div class="count-audit-row-meta">` +
                `<span>Grupo ${escapeHtml(row.grupo || 'Sem grupo')}</span>` +
                `<span>${escapeHtml(meta.divergenceLabel || 'Sem divergência')}</span>` +
              `</div>` +
            `</button>` +
          `</div>` +
          `<div class="count-audit-cell"><span class="count-audit-cell-label">Base / TXT</span><strong class="count-audit-cell-value">CX ${formatIntegerBR(Number(row.import_caixa) || 0)}</strong><span class="count-audit-cell-note">UN ${formatIntegerBR(Number(row.import_unidade) || 0)}</span></div>` +
          `<div class="count-audit-cell"><span class="count-audit-cell-label">Contagem atual</span><strong class="count-audit-cell-value">CX ${formatIntegerBR(Number(row.counted_caixa) || 0)}</strong><span class="count-audit-cell-note">UN ${formatIntegerBR(Number(row.counted_unidade) || 0)}</span></div>` +
          `<div class="count-audit-cell"><span class="count-audit-cell-label">Diferença</span><strong class="count-audit-diff-total">|Dif| ${formatIntegerBR(meta.diffAbs || 0)}</strong><div class="count-audit-diff-breakdown"><span>CX ${formatSignedIntegerBR(meta.diffCx || 0)}</span><span>UN ${formatSignedIntegerBR(meta.diffUn || 0)}</span></div></div>` +
          `<div class="count-audit-cell"><span class="count-audit-cell-label">Status e prioridade</span><strong class="count-audit-cell-value">${meta.stateLabel}</strong><span class="count-audit-cell-note">${meta.priorityLabel} · ${escapeHtml(meta.divergenceLabel || '')}</span></div>` +
          `<div class="count-audit-cell"><span class="count-audit-cell-label">Ação recomendada</span><strong class="count-audit-recommendation">${escapeHtml(meta.recommendedAction || 'Revisar')}</strong><span class="count-audit-row-insight">${escapeHtml(meta.insight || '')}</span></div>` +
          `<div class="count-audit-cell count-audit-cell--detail"><button type="button" class="btn-secondary btn-small count-audit-detail-btn" data-action="detail" data-code="${encodeURIComponent(code)}">Detalhe</button></div>` +
        `</div>` +
      `</li>`
    );
  }).join('');

  syncCountAuditListSelection();
  if (String(countAuditState.selectedCode || '') !== previousSelectedCode) {
    selectCountAuditRow(String(countAuditState.selectedCode || ''));
  }
}

function renderCountAuditDetailEmpty(message = 'Selecione um item da fila para abrir o painel lateral.') {
  if (!countAuditDetailPanel) return;
  if (countAuditDetailStatus) countAuditDetailStatus.textContent = 'Sem seleção';
  countAuditDetailPanel.innerHTML =
    `<div class="count-audit-detail-empty">` +
      `<strong>${escapeHtml(message)}</strong>` +
      `<p class="muted">Histórico de lançamentos, responsáveis, observações automáticas e trilha de auditoria aparecem aqui.</p>` +
    `</div>`;
}

function renderCountAuditDetailShell(row, detail, isLoading = false) {
  if (!countAuditDetailPanel || !row) return;
  const meta = row._auditMeta || {};
  const importInfo = detail?.import || countAuditState.importInfo || {};
  const history = Array.isArray(detail?.history) ? detail.history : [];
  const actors = Array.isArray(detail?.summary?.actors) ? detail.summary.actors : [];
  const devices = Array.isArray(detail?.summary?.devices) ? detail.summary.devices : [];

  if (countAuditDetailStatus) {
    countAuditDetailStatus.textContent = meta.stateLabel || 'Detalhe';
  }

  const historyHtml = history.length
    ? history.map((entry) => (
      `<li class="count-audit-history-item">` +
        `<div class="count-audit-history-topline">` +
          `<strong>${escapeHtml(entry.actor || 'Equipe')}</strong>` +
          `<span>${escapeHtml(formatAuditRelativeTime(entry.observed_at || entry.changed_at || ''))}</span>` +
        `</div>` +
        `<div class="count-audit-history-values">` +
          `${entry.count_type === 'unidade' ? 'UN' : 'CX'} ${formatSignedIntegerBR(entry.quantity_delta)} · ${formatIntegerBR(entry.previous_value)} → ${formatIntegerBR(entry.current_value)}` +
        `</div>` +
        `<div class="count-audit-history-note">` +
          `CX ${formatIntegerBR(entry.previous_caixa)} → ${formatIntegerBR(entry.current_caixa)} · UN ${formatIntegerBR(entry.previous_unidade)} → ${formatIntegerBR(entry.current_unidade)}${entry.device_name ? ` · ${escapeHtml(entry.device_name)}` : ''}` +
        `</div>` +
      `</li>`
    )).join('')
    : '<li class="count-audit-history-item"><div class="count-audit-history-note">Nenhum lançamento sincronizado para este item na data operacional da análise.</div></li>';

  const trailHtml = [
    ['Base de comparação', importInfo.id == null ? 'Saldo sintético / fallback sem TXT' : `${formatDateBR(importInfo.reference_date || '')} · ${importInfo.file_name || 'TXT'}`],
    ['Divergência calculada', `CX ${formatSignedIntegerBR(row.difference_caixa)} · UN ${formatSignedIntegerBR(row.difference_unidade)} · |Dif| ${formatIntegerBR(meta.diffAbs || 0)}`],
    ['Observação automática', meta.insight || 'Sem observação automática.'],
    ['Quem lançou', actors.length ? actors.join(', ') : 'Sem ator identificado'],
    ['Dispositivos', devices.length ? devices.join(', ') : 'Sem dispositivo identificado'],
  ].map(([label, value]) => (
    `<li class="count-audit-trail-item">` +
      `<div class="count-audit-trail-topline"><strong>${label}</strong></div>` +
      `<div class="count-audit-trail-note">${escapeHtml(value)}</div>` +
    `</li>`
  )).join('');

  countAuditDetailPanel.innerHTML =
    `<div class="count-audit-detail-shell">` +
      `<section class="count-audit-detail-hero">` +
        `<div class="count-audit-detail-hero-top">` +
          `<div>` +
            `<h4 class="count-audit-detail-title">${escapeHtml(row.descricao || 'Sem descrição')}</h4>` +
            `<div class="count-audit-detail-subtitle">Código ${escapeHtml(String(row.cod_produto || '-'))} · Grupo ${escapeHtml(row.grupo || 'Sem grupo')}</div>` +
          `</div>` +
          `<div class="count-audit-detail-pill-row">` +
            `<span class="count-audit-state-badge" data-state="${meta.stateKey}">${meta.stateLabel}</span>` +
            `<span class="count-audit-priority-badge">${meta.priorityLabel}</span>` +
          `</div>` +
        `</div>` +
        `<div class="count-audit-detail-grid">` +
          `<article class="count-audit-detail-metric"><span>Base / TXT</span><strong>${formatIntegerBR(Number(row.import_caixa) || 0)} CX / ${formatIntegerBR(Number(row.import_unidade) || 0)} UN</strong><small>${importInfo.id == null ? 'Fallback sem TXT' : (importInfo.file_name || 'Base importada')}</small></article>` +
          `<article class="count-audit-detail-metric"><span>Contagem atual</span><strong>${formatIntegerBR(Number(row.counted_caixa) || 0)} CX / ${formatIntegerBR(Number(row.counted_unidade) || 0)} UN</strong><small>${detail?.summary?.launches || 0} lançamento(s) sincronizado(s)</small></article>` +
          `<article class="count-audit-detail-metric"><span>Diferença em caixa</span><strong>${formatSignedIntegerBR(row.difference_caixa)}</strong><small>${escapeHtml(meta.divergenceLabel || 'Sem divergência')}</small></article>` +
          `<article class="count-audit-detail-metric"><span>Diferença em unidade</span><strong>${formatSignedIntegerBR(row.difference_unidade)}</strong><small>${escapeHtml(meta.recommendedAction || 'Sem recomendação')}</small></article>` +
        `</div>` +
      `</section>` +
      `${isLoading ? '<div class="count-audit-detail-loading">Carregando trilha detalhada deste item...</div>' : ''}` +
      `<section class="count-audit-detail-section">` +
        `<div class="count-audit-detail-section-head"><h4>Histórico de lançamentos</h4><span>${detail?.summary?.launches || 0} registro(s) no dia operacional</span></div>` +
        `<ul class="count-audit-history-list">${historyHtml}</ul>` +
      `</section>` +
      `<section class="count-audit-detail-section">` +
        `<div class="count-audit-detail-section-head"><h4>Trilha de auditoria</h4><span>Contexto para validação e decisão</span></div>` +
        `<ul class="count-audit-trail-list">${trailHtml}</ul>` +
      `</section>` +
      `<div class="count-audit-detail-actions">` +
        `<button type="button" class="btn-secondary count-audit-detail-action-btn" data-audit-recount="${encodeURIComponent(String(row.cod_produto || ''))}">Abrir recontagem</button>` +
        `<button type="button" class="btn-secondary count-audit-detail-action-btn" data-audit-refresh-detail="${encodeURIComponent(String(row.cod_produto || ''))}">Atualizar detalhe</button>` +
      `</div>` +
    `</div>`;
}

async function loadCountAuditDetail(code, forceReload = false) {
  const row = getCountAuditRowByCode(code);
  if (!row || !countAuditDetailPanel) return;
  const referenceDate = (countAuditImport?.value || '').trim();
  const cacheKey = `${referenceDate || '-'}::${code}`;
  if (!forceReload && countAuditState.detailCache.has(cacheKey)) {
    renderCountAuditDetailShell(row, countAuditState.detailCache.get(cacheKey), false);
    return;
  }

  renderCountAuditDetailShell(row, null, true);
  const requestId = ++countAuditDetailRequestSeq;
  try {
    const params = new URLSearchParams();
    params.set('item_code', code);
    params.set('only_active', 'true');
    if (referenceDate) params.set('reference_date', referenceDate);
    const response = await apiFetch(`${API_STOCK_ANALYSIS_DETAIL}?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Não foi possível carregar o detalhe.');
    }
    const detail = await response.json();
    countAuditState.detailCache.set(cacheKey, detail);
    if (requestId === countAuditDetailRequestSeq && String(countAuditState.selectedCode || '') === String(code)) {
      renderCountAuditDetailShell(row, detail, false);
    }
  } catch (error) {
    if (requestId !== countAuditDetailRequestSeq) return;
    renderCountAuditDetailShell(row, null, false);
    setCountAuditFeedback(error?.message || 'Falha ao carregar o detalhe do item.', true);
  }
}

function selectCountAuditRow(code, forceReload = false) {
  const row = getCountAuditRowByCode(code);
  if (!row) return;
  countAuditState.selectedCode = code;
  syncCountAuditListSelection();
  loadCountAuditDetail(code, forceReload);
}

function clearCountAuditFilters() {
  if (countAuditSearch) countAuditSearch.value = '';
  if (countAuditClearSearch) countAuditClearSearch.style.display = 'none';
  if (countAuditGroupFilter) countAuditGroupFilter.value = '';
  if (countAuditStatusFilter) countAuditStatusFilter.value = '';
  if (countAuditPriorityFilter) countAuditPriorityFilter.value = '';
  if (countAuditDivergenceFilter) countAuditDivergenceFilter.value = '';
  if (countAuditOnlyPending) countAuditOnlyPending.checked = false;
  if (countAuditOnlyCritical) countAuditOnlyCritical.checked = false;
  if (countAuditOnlyMissing) countAuditOnlyMissing.checked = false;
  if (countAuditOnlyDiff) countAuditOnlyDiff.checked = false;
  if (countAuditSort) countAuditSort.value = 'relevance';
  countAuditSummaryFilterKey = null;
  updateCountAuditSummarySelection();
  renderCountAuditRows(getCountAuditRowsFromState());
}

async function loadCountAuditAnalysis() {
  if (!countAuditImport || !countAuditList) return;
  const token = getToken();
  if (!token) return;

  try {
    if (btnCountAuditRefresh) btnCountAuditRefresh.disabled = true;
    const referenceDate = (countAuditImport.value || '').trim();
    const params = new URLSearchParams();
    if (referenceDate) params.set('reference_date', referenceDate);
    params.set('only_diff', 'false');
    params.set('only_active', 'true');
    params.set('limit', '5000');

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
    if (!info) {
      countAuditState.rows = [];
      countAuditState.summary = {};
      countAuditState.importInfo = null;
      countAuditState.loadedAt = null;
      countAuditState.detailCache.clear();
      renderCountAuditSummary({});
      renderCountAuditRows([]);
      renderCountAuditDetailEmpty('Não foi possível montar a análise.');
      setCountAuditFeedback('Não foi possível montar a análise. Verifique permissões ou tente novamente.', true);
      return;
    }

    countAuditSummaryFilterKey = null;
    countAuditState.rows = (payload.rows || []).map(enrichCountAuditRow);
    countAuditState.summary = payload.summary || {};
    countAuditState.importInfo = info;
    countAuditState.loadedAt = new Date().toISOString();
    countAuditState.detailCache.clear();
    window.lastCountAuditRows = countAuditState.rows;

    populateCountAuditGroups(countAuditState.rows);
    updateCountAuditHeaderContext();
    renderCountAuditSummary(countAuditState.summary);
    renderCountAuditRows(countAuditState.rows);

    const selected = countAuditState.selectedCode || countAuditState.rows[0]?.cod_produto || null;
    if (selected) selectCountAuditRow(String(selected));
    else renderCountAuditDetailEmpty();

    if (info.id == null) {
      setCountAuditFeedback(info.file_name || 'Análise sem TXT: usando saldo zero para produtos ativos.', false);
    } else {
      setCountAuditFeedback(`Base TXT: ${formatDateBR(info.reference_date || '')} · ${info.file_name || 'arquivo'}`, false);
    }
  } catch {
    setCountAuditFeedback('Erro de conexão ao carregar análise de contagem.', true);
  } finally {
    if (btnCountAuditRefresh) btnCountAuditRefresh.disabled = false;
  }
}

async function exportCountAuditExcel() {
  const token = getToken();
  if (!token || !countAuditImport) return;
  const referenceDate = (countAuditImport.value || '').trim();
  const onlyDiff = !!countAuditOnlyDiff?.checked;
  const params = new URLSearchParams();
  if (referenceDate) params.set('reference_date', referenceDate);
  params.set('only_diff', onlyDiff ? 'true' : 'false');
  params.set('only_active', 'true');
  params.set('limit', '20000');

  setCountAuditFeedback('Gerando Excel da análise...', false);
  try {
    const response = await apiFetch(`${API_STOCK_ANALYSIS_EXPORT_XLSX}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setCountAuditFeedback(err.detail || 'Não foi possível gerar o Excel.', true);
      return;
    }
    const blob = await response.blob();
    let filename = 'analise-contagem.xlsx';
    const cd = response.headers.get('Content-Disposition');
    if (cd) {
      const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(cd);
      const raw = m ? decodeURIComponent(m[1] || m[2] || '') : '';
      if (raw) filename = raw.trim();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setCountAuditFeedback('Excel baixado com sucesso.', false);
  } catch {
    setCountAuditFeedback('Falha ao baixar o Excel. Verifique a conexão.', true);
  }
}

function openCountAuditRecount(code) {
  countPrefillProductCode = code;
  setActiveModule('count');
  const applySearch = () => {
    const input = document.getElementById('item-code');
    if (!input) return;
    input.value = countPrefillProductCode || '';
    input.dispatchEvent(new Event('input'));
    input.focus();
  };
  applySearch();
  window.setTimeout(applySearch, 350);
}

function bindCountAuditEvents() {
  if (!countAuditImport) return;
  if (btnCountAuditRefresh) {
    btnCountAuditRefresh.addEventListener('click', () => loadCountAuditAnalysis());
  }
  if (btnCountAuditExportExcel) {
    btnCountAuditExportExcel.addEventListener('click', () => exportCountAuditExcel());
  }
  if (countAuditImport) {
    countAuditImport.addEventListener('change', () => loadCountAuditAnalysis());
  }

  [
    countAuditGroupFilter,
    countAuditStatusFilter,
    countAuditPriorityFilter,
    countAuditDivergenceFilter,
    countAuditOnlyPending,
    countAuditOnlyCritical,
    countAuditOnlyMissing,
    countAuditOnlyDiff,
    countAuditSort,
  ].filter(Boolean).forEach((el) => {
    el.addEventListener('change', () => renderCountAuditRows(getCountAuditRowsFromState()));
  });

  if (countAuditClearFilters) {
    countAuditClearFilters.addEventListener('click', () => clearCountAuditFilters());
  }

  if (countAuditList && !countAuditList.dataset.auditBound) {
    countAuditList.dataset.auditBound = '1';
    countAuditList.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action][data-code]');
      if (!target) return;
      const code = decodeURIComponent(target.dataset.code || '');
      if (!code) return;
      selectCountAuditRow(code, target.dataset.action === 'detail');
    });
  }

  if (countAuditDetailPanel && !countAuditDetailPanel.dataset.auditBound) {
    countAuditDetailPanel.dataset.auditBound = '1';
    countAuditDetailPanel.addEventListener('click', (e) => {
      const recountBtn = e.target.closest('[data-audit-recount]');
      if (recountBtn) {
        openCountAuditRecount(decodeURIComponent(recountBtn.dataset.auditRecount || ''));
        return;
      }
      const refreshBtn = e.target.closest('[data-audit-refresh-detail]');
      if (refreshBtn) {
        selectCountAuditRow(decodeURIComponent(refreshBtn.dataset.auditRefreshDetail || ''), true);
      }
    });
  }
}

function getAuthHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

/** Valida token antes de montar o dashboard; evita rajada de 401 com sessão expirada. */
async function validateSessionOrClear() {
  const token = getToken();
  if (!token) return false;
  if (isAccessTokenExpired(token)) {
    clearSession();
    if (loginError) {
      loginError.textContent = 'Sessão expirada. Faça login novamente.';
    }
    showLogin();
    return false;
  }
  try {
    const resp = await apiFetch(API_AUTH_ME, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 401) {
      clearSession();
      if (loginError) {
        loginError.textContent = 'Sessão expirada ou inválida. Faça login novamente.';
      }
      showLogin();
      return false;
    }
    if (!resp.ok) {
      return true;
    }
    try {
      const profile = await resp.json();
      const prev = getUser() || {};
      saveSession(token, {
        ...prev,
        username: profile.username ?? prev.username,
        name: profile.name ?? prev.name,
        full_name: profile.name ?? prev.full_name,
        email: profile.email ?? prev.email,
        phone: profile.phone ?? prev.phone,
        role: profile.role ?? prev.role,
        allowed_pages: Array.isArray(profile.allowed_pages)
          ? profile.allowed_pages
          : prev.allowed_pages,
      });
    } catch {
      /* mantém user em cache */
    }
    return true;
  } catch {
    /* Rede indisponível: se o JWT já expirou localmente, não mantém sessão falsa. */
    if (isAccessTokenExpired(token)) {
      clearSession();
      if (loginError) {
        loginError.textContent = 'Sessão expirada. Faça login novamente.';
      }
      showLogin();
      return false;
    }
    return true;
  }
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
  const defaults = loadProductDefaults();
  const nextDefaults = {
    ...defaults,
    cod_grup_cia: [document.getElementById('prod-cod-cia')?.value || defaults.cod_grup_cia[0]],
    cod_grup_tipo: [document.getElementById('prod-cod-tipo')?.value || defaults.cod_grup_tipo[0]],
    cod_grup_segmento: [document.getElementById('prod-cod-segmento')?.value || defaults.cod_grup_segmento[0]],
    cod_grup_marca: [document.getElementById('prod-cod-marca')?.value || defaults.cod_grup_marca[0]],
    cod_grup_sku: [document.getElementById('prod-sku')?.value || defaults.cod_grup_sku[0]],
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
    ['cod_grup_cia', 'prod-cod-cia', 'edit-cod-cia'],
    ['cod_grup_tipo', 'prod-cod-tipo', 'edit-cod-tipo'],
    ['cod_grup_segmento', 'prod-cod-segmento', 'edit-cod-segmento'],
    ['cod_grup_marca', 'prod-cod-marca', 'edit-cod-marca'],
    ['cod_grup_sku', 'prod-sku', 'edit-sku'],
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
    cod_grup_sp: null,
    cod_grup_cia: document.getElementById('prod-cod-cia').value.trim() || null,
    cod_grup_tipo: document.getElementById('prod-cod-tipo').value.trim() || null,
    cod_grup_familia: null,
    cod_grup_segmento: document.getElementById('prod-cod-segmento').value.trim() || null,
    cod_grup_marca: document.getElementById('prod-cod-marca').value.trim() || null,
    cod_produto: document.getElementById('prod-codigo').value.trim(),
    cod_grup_descricao: document.getElementById('prod-produto').value.trim(),
    cod_grup_sku: document.getElementById('prod-sku').value.trim(),
    status: null,
    grup_prioridade: null,
    price: parseFloat(document.getElementById('prod-custo').value) || null,
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
    setProductFeedback('Código, produto e SKU são obrigatórios.', true);
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
      const dlow = detail.toLowerCase();
      if (dlow.includes('uq_product_sku')) {
        setProductImportFeedback(
          'Falha ao importar: ainda existe restrição única antiga em SKU no banco. Rode a migração ou tente de novo (o servidor tenta remover automaticamente). Detalhe: ' +
            detail,
          true,
        );
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
        ' Linhas ignoradas: confira código do produto e nome do produto (cabeçalhos reconhecidos e células vazias). SKU e custo são opcionais.';
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

function produtoStatusBadgeMeta(p) {
  const raw = (p.status || '').trim();
  const sl = raw.toLowerCase();
  const isAtivo =
    !raw ||
    sl === 'ativo' ||
    sl === 's' ||
    sl === 'sim' ||
    sl === '1' ||
    sl === 'true' ||
    sl === 'ativado' ||
    sl === 'active';
  if (isAtivo) {
    return { cls: 'badge-active', label: raw || 'ativo' };
  }
  if (sl.includes('pre') && sl.includes('cadastro')) {
    return { cls: 'badge-precadastro', label: raw };
  }
  if (sl === 'inativo' || sl === 'inactive' || ['n', 'nao', 'no', '0', 'false'].includes(sl)) {
    return { cls: 'badge-inactive', label: raw || 'inativo' };
  }
  return { cls: 'badge-status-other', label: raw || '—' };
}

async function searchProdutos() {
  const q = document.getElementById('produtos-search').value.trim();
  const token = getToken();
  if (!token) return;

  const filters = getProdutosStatusFilters();
  if (!filters.length) {
    setProdutosFeedback('Selecione pelo menos um status (Ativo, Inativo ou Pré-cadastro).', true);
    return;
  }

  try {
    const resp = await apiFetchProductsList(q, filters);
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
    const st = produtoStatusBadgeMeta(p);
    tr.innerHTML = `
      <td>${p.cod_produto || '—'}</td>
      <td>${p.cod_grup_sku || '—'}</td>
      <td>${p.cod_grup_descricao || '—'}</td>
      <td>${formatPrice(p.price)}</td>
      <td><span class="status-badge ${st.cls}">${st.label}</span></td>
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
    fillSelect('edit-cod-cia', defaults.cod_grup_cia, p.cod_grup_cia || '');
    fillSelect('edit-cod-tipo', defaults.cod_grup_tipo, p.cod_grup_tipo || '');
    fillSelect('edit-cod-segmento', defaults.cod_grup_segmento, p.cod_grup_segmento || '');
    fillSelect('edit-cod-marca', defaults.cod_grup_marca, p.cod_grup_marca || '');
    document.getElementById('edit-codigo').value = p.cod_produto || '';
    document.getElementById('edit-produto').value = p.cod_grup_descricao || '';
    fillSelect('edit-sku', defaults.cod_grup_sku, p.cod_grup_sku || '');
    document.getElementById('edit-custo').value = p.price != null ? p.price : '';

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
    cod_grup_cia: document.getElementById('edit-cod-cia').value.trim() || null,
    cod_grup_tipo: document.getElementById('edit-cod-tipo').value.trim() || null,
    cod_grup_segmento: document.getElementById('edit-cod-segmento').value.trim() || null,
    cod_grup_marca: document.getElementById('edit-cod-marca').value.trim() || null,
    cod_produto: document.getElementById('edit-codigo').value.trim(),
    cod_grup_descricao: document.getElementById('edit-produto').value.trim(),
    cod_grup_sku: document.getElementById('edit-sku').value.trim(),
    price: parseFloat(document.getElementById('edit-custo').value) || null,
  };

  if (!payload.cod_produto || !payload.cod_grup_descricao || !payload.cod_grup_sku) {
    setEditFeedback('Código, produto e SKU são obrigatórios.', true);
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

// ── Modulos extras (offline-first local storage) ────────────────
const EXTRA_MODULES = [
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
    renderModuleNav();
  });
}

/** Frase idêntica à API POST /system/purge-except-users */
const PURGE_CONFIRM_PHRASE = 'APAGAR TUDO EXCETO USUARIOS';

function clearLocalOperationalCaches() {
  try {
    localStorage.removeItem(COUNT_EVENTS_KEY);
    localStorage.removeItem(COUNT_EVENTS_BUCKET_KEY);
    localStorage.removeItem(COUNT_EVENTS_DAY_KEY);
    localStorage.removeItem(PRODUCT_DEFAULTS_KEY);
    for (const mod of EXTRA_MODULES) {
      localStorage.removeItem(mod.storageKey);
    }
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith('count_explicit_zero_')) localStorage.removeItem(k);
    }
  } catch (e) {
    console.warn(e);
  }
}

function bindAdminPurge() {
  const btn = document.getElementById('btn-purge-except-users');
  const feedback = document.getElementById('purge-feedback');
  const input = document.getElementById('purge-confirm-input');
  if (!btn || !feedback) return;
  btn.addEventListener('click', async () => {
    if (currentRole !== 'admin') {
      feedback.textContent = 'Apenas administrador pode executar.';
      feedback.style.color = 'var(--error)';
      return;
    }
    const typed = (input?.value || '').trim();
    if (typed !== PURGE_CONFIRM_PHRASE) {
      feedback.textContent = 'Digite a frase de confirmação exata (veja o texto de ajuda abaixo do campo).';
      feedback.style.color = 'var(--error)';
      return;
    }
    if (!window.confirm('Confirma apagar todos os dados do servidor, exceto usuários cadastrados?')) {
      return;
    }
    const token = getToken();
    if (!token) return;
    feedback.textContent = 'Limpando servidor...';
    feedback.style.color = 'var(--accent)';
    btn.disabled = true;
    try {
      const resp = await apiFetch('/system/purge-except-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: PURGE_CONFIRM_PHRASE }),
      });
      if (handleUnauthorizedResponse(resp)) {
        btn.disabled = false;
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = typeof data.detail === 'string' ? data.detail : 'Falha ao limpar base.';
        feedback.textContent = msg;
        feedback.style.color = 'var(--error)';
        btn.disabled = false;
        return;
      }
      clearLocalOperationalCaches();
      if (input) input.value = '';
      feedback.textContent = 'Base limpa. Usuários preservados. Dados locais de contagem neste aparelho também foram limpos.';
      feedback.style.color = 'var(--success, #1b8744)';
      await loadProducts();
      await loadCountProducts();
      await loadUsersAdminList();
      searchProdutos();
      renderCounts();
    } catch {
      feedback.textContent = 'Erro de conexão.';
      feedback.style.color = 'var(--error)';
    } finally {
      btn.disabled = false;
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
  const adminPurgeSection = document.getElementById('admin-purge-section');
  if (adminPurgeSection) {
    adminPurgeSection.style.display = currentRole === 'admin' ? 'block' : 'none';
  }
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
(async function init() {
  applyProductDefaultsToForms();
  bindCountEvents();
  bindValidityEvents();
  bindCountAuditEvents();
  bindImportTxtEvents();
  bindProductEvents();
  bindProductParamsEvents();
  bindProdutosEvents();
  bindModuleEvents();
  bindExtraModules();
  bindAdminPurge();
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    showLogin();
    return;
  }
  const ok = await validateSessionOrClear();
  if (!ok) {
    return;
  }
  initDashboard(getUser() || user);
})();
