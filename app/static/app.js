/** Data civil em America/Sao_Paulo (YYYY-MM-DD). */
function getBrazilDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Primeiro e último dia do mês civil atual em America/Sao_Paulo (YYYY-MM-DD). */
function getBrazilMonthBoundsDateKeys() {
  const key = getBrazilDateKey();
  const [ys, ms] = key.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad2 = (n) => String(n).padStart(2, '0');
  return { first: `${ys}-${ms}-01`, last: `${ys}-${ms}-${pad2(lastDay)}` };
}

/** Soma dias a uma chave YYYY-MM-DD (meio-dia em BRT, alinhado a getBrazilDateKey). */
function brazilDateKeyAddDays(dayKey, deltaDays) {
  const m = String(dayKey || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return getBrazilDateKey();
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 15, 0, 0);
  return getBrazilDateKey(new Date(utcMs + Number(deltaDays) * 86400000));
}

function getActiveCountDateKey() {
  const el = document.getElementById('count-date');
  const v = (el && el.value || '').trim();
  return v || getBrazilDateKey();
}

function isCountOperationalEditable() {
  return getActiveCountDateKey() === getBrazilDateKey();
}

/** Dia operacional da quebra (sempre o dia civil atual em America/Sao_Paulo). */
function getActiveBreakDateKey() {
  return getBrazilDateKey();
}

function isBreakOperationalEditable() {
  return true;
}

const BREAK_SCOPE_STORAGE_KEY = 'break_scope_filter';
const BREAK_SCOPE_VALUES = ['mate-couro', 'outros', 'todos'];

/** Normaliza descrição do produto para comparar com a lista fixa da quebra (Mate couro). */
function normalizeBreakProductDescForScope(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Lista fechada: só estes itens aparecem ao escolher "Mate couro" na Quebra (descrição após normalização). */
const BREAK_MATE_COURO_DESC_NORMALIZED = new Set([
  'MATE COURO PET 2L TRADICIONAL',
  'MATE COURO PET 2L GUARANA',
  'NICK PET 2L GUARANA EB/06',
  'MATE COURO PET 1,5 LTS TRADICIONAL C/06',
  'AGUA MATE COURO 500ML NATURAL CX/12',
  'MATE COURO PET 1L TRADICIONAL',
  'MATE COURO PET 1L ZERO C/06 UNID',
  'MATE COURO PET 250ML TRADICIONAL',
  'MATE COURO PET 350ML TRADICIONAL',
  'MATE COURO PET 600ML TRADICIONAL',
  'AGUA TONICA TRAD MC 1L CX/6',
  'MATE COURO PET 200ML TRADICIONAL',
  'NICK 200ML GUARANA CX/12',
]);

function isProductOnBreakMateCouroAllowlist(product) {
  const key = normalizeBreakProductDescForScope(product?.cod_grup_descricao);
  return !!key && BREAK_MATE_COURO_DESC_NORMALIZED.has(key);
}

/**
 * Linha CIA Mate couro para excluir de "Outros produtos": lista fechada + qualquer descrição com
 * "MATE COURO" (novos SKUs) + marca Nick no início da descrição.
 */
function isProductBreakMateCouroCiaExcludedFromOutros(product) {
  if (isProductOnBreakMateCouroAllowlist(product)) return true;
  const norm = normalizeBreakProductDescForScope(product?.cod_grup_descricao);
  if (norm.includes('MATE COURO')) return true;
  if (norm.startsWith('NICK ')) return true;
  return false;
}

function filterBreakCatalogByScope(products, scope) {
  if (!Array.isArray(products)) return [];
  if (scope === 'mate-couro') {
    return products.filter((p) => isProductOnBreakMateCouroAllowlist(p));
  }
  if (scope === 'outros') {
    return products.filter((p) => !isProductBreakMateCouroCiaExcludedFromOutros(p));
  }
  return products;
}

function getSelectedBreakScope() {
  const checked = document.querySelector('input[name="break-scope"]:checked');
  const v = checked && checked.value;
  if (BREAK_SCOPE_VALUES.includes(v)) return v;
  return 'todos';
}

function restoreBreakScopeFromStorage() {
  try {
    const saved = localStorage.getItem(BREAK_SCOPE_STORAGE_KEY);
    if (!saved || !BREAK_SCOPE_VALUES.includes(saved)) return;
    const id =
      saved === 'mate-couro'
        ? 'break-scope-mate-couro'
        : saved === 'outros'
          ? 'break-scope-outros'
          : 'break-scope-todos';
    const r = document.getElementById(id);
    if (r) r.checked = true;
  } catch {
    /* ignore */
  }
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

// Autocomplete Grupo — Quebra (mesmo catálogo GROUPS)
document.addEventListener('DOMContentLoaded', () => {
  const groupInput = document.getElementById('break-group');
  if (!groupInput) return;
  let suggestionBox = null;
  function closeSuggestions() {
    if (suggestionBox) {
      suggestionBox.remove();
      suggestionBox = null;
    }
  }
  groupInput.addEventListener('input', function () {
    closeSuggestions();
    const value = this.value.trim().toLowerCase();
    if (!value) {
      filtrarProdutosQuebra();
      return;
    }
    const matches = GROUPS.filter((g) => g.toLowerCase().includes(value));
    if (!matches.length) return;
    suggestionBox = document.createElement('div');
    suggestionBox.className = 'autocomplete-suggestions';
    matches.forEach((g) => {
      const opt = document.createElement('div');
      opt.className = 'autocomplete-suggestion';
      opt.textContent = g;
      opt.onclick = () => {
        groupInput.value = g;
        closeSuggestions();
        filtrarProdutosQuebra();
      };
      suggestionBox.appendChild(opt);
    });
    const rect = groupInput.getBoundingClientRect();
    suggestionBox.style.position = 'absolute';
    suggestionBox.style.left = `${rect.left + window.scrollX}px`;
    suggestionBox.style.top = `${rect.bottom + window.scrollY}px`;
    suggestionBox.style.width = `${rect.width}px`;
    suggestionBox.style.zIndex = '1002';
    document.body.appendChild(suggestionBox);
  });
  groupInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
  groupInput.addEventListener('change', filtrarProdutosQuebra);
});

// Filtro de produtos por grupo (contagem: apenas ativos na API e na renderização)

// Filtro de produtos por grupo e ativo
function filtrarProdutos() {
  const grupo = (document.getElementById('count-group')?.value || '').trim().toLowerCase();
  let totalVisiveis = 0;
  const visiveis = [];
  document.querySelectorAll('#count-products-list .count-product-item').forEach(item => {
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
  if (totalSpan) {
    totalSpan.textContent = `${totalVisiveis} ${totalVisiveis === 1 ? 'item' : 'itens'}`;
  }
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
  const breakHistoryDate = document.getElementById('break-history-date');
  if (breakHistoryDate && !breakHistoryDate.value) {
    breakHistoryDate.value = getBrazilDateKey();
  }
  const mateCouroTrocaDate = document.getElementById('mate-couro-troca-date');
  if (mateCouroTrocaDate && !mateCouroTrocaDate.value) {
    mateCouroTrocaDate.value = getBrazilDateKey();
  }
  const breakHistoryMetaDate = document.getElementById('break-history-meta-date');
  if (breakHistoryMetaDate && breakHistoryDate && breakHistoryDate.value) {
    try {
      breakHistoryMetaDate.textContent = new Date(`${breakHistoryDate.value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
    } catch {
      breakHistoryMetaDate.textContent = breakHistoryDate.value;
    }
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
const API_VALIDITY_LAST_LAUNCH = '/audit/validity-last-launch-by-product';
const API_VALIDITY_DISPLAY_EXPIRY_BY_PRODUCT = '/audit/validity-display-expiry-by-product';
const API_VALIDITY_KPI_EXPIRING_30D = '/audit/validity-kpi-expiring-30d';
const API_VALIDITY_ANALYSIS_EXPORT_XLSX = '/audit/validity-analysis/export.xlsx';
const API_SYNC_BREAKS = '/audit/break-events';
const API_BREAK_DAY_TOTALS = '/audit/break-day-totals';
const API_MATE_TROCA_EVENTS = '/audit/mate-troca-events';
const API_MATE_TROCA_PENDING_BY_PRODUCT = '/audit/mate-troca-pending-by-product';
const API_MATE_TROCA_BASE_V2 = '/audit/mate-troca-base-v2';
const API_MATE_TROCA_RECONCILE_FROM_BREAKS = '/audit/mate-troca-reconcile-from-breaks';
/** Último estado confiável da Base de Troca V2 (persistido) — evita 0/0 fantasma em refresh parcial. */
const MATE_TROCA_BASE_V2_LAST_VALID_KEY = 'estoque_mate_troca_base_v2_last_valid_v1';
/** Saldo de troca no servidor — espelho para análise de contagem / espelho local; preenchido pelo fluxo V2. */
let mateTrocaServerPendingCache = {};
/** Códigos com quebra Mate couro no período De–Até (só presença) — espelho do V2 para compat. */
let mateTrocaDiscoveryCodesCache = new Set();
/** Base de Troca V2 — saldos explícitos do último GET ok (inclui 0/0 do servidor). */
let mateTrocaBaseBalanceCacheV2 = {};
/** Descoberta de códigos no período (V2). */
let mateTrocaBaseDiscoveryCodesV2 = new Set();
/** Por código: último estado confiável exibido / servidor (merge). */
let mateTrocaBaseLastValidStateV2 = {};
/** Últimas linhas já fundidas (KPI + busca sem novo fetch). */
let mateTrocaBaseV2LastMergedRows = [];
let mateTrocaBaseV2LastValidHydrated = false;
const BREAK_EVENTS_BUCKET_KEY = 'estoque_break_events_by_day_v1';
const VALIDITY_BUCKET_KEY = 'estoque_validity_by_day_v1';
const VALIDITY_LAST_SYNC_KEY = 'estoque_validity_last_sync_iso';
/** Dias sem nova contagem para considerar a base "antiga" (painel analítico). */
const VALIDITY_OLD_BASE_DAYS = 14;
const API_PRODUCTS = '/products';
/** Alinhado ao `le` em GET /products e /products/catalog (products.py). */
const PRODUCTS_LIST_LIMIT = 20000;
/** Detalhe da importação TXT: renderizar até N itens (evita travar o navegador em arquivos enormes). */
const IMPORT_TXT_DETAIL_ITEMS_LIMIT = 20000;
const API_PRODUCTS_CATALOG = '/products/catalog';
const API_AUTH_ME = '/auth/me';
const API_PRODUCTS_IMPORT_EXCEL = '/products/import-excel';
const APP_BASE_PATH = (() => {
  const p = window.location.pathname.replace(/\/$/, '');
  if (!p || p === '/') return '';
  return p;
})();

function historyBasePathNoHash() {
  return APP_BASE_PATH || '/';
}
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
/** Última data operacional com lançamento de validade por código (servidor). */
let validityLastLaunchByCode = {};
/** Última contagem global por produto: CX/UN + count_date (ChangeLog, servidor). */
let validityLastCountState = { ok: false, balances: {} };
/** Totais CX/UN da contagem consolidada no servidor para o dia operacional da validade (GET count-server-totals). */
let validityDayCountState = { ok: false, balances: {}, meta: null, dayKey: null };
let loadValidityDayCountInFlight = null;
/** KPI clicável ativo (filtro rápido); null = nenhum. */
let validityActiveKpiKey = null;
/** Produto selecionado na tabela da análise (painel lateral). */
let validityAnalysisSelectedCod = null;
/** Totais CX/UN já sincronizados no servidor (todos os conferentes). */
let countServerCountState = { ok: false, balances: {}, meta: null };
let breakServerBreakState = { ok: false, balances: {} };
let loadServerBreakTotalsInFlight = null;
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

async function apiFetchProductsList(searchQuery, statusFilters, options = {}) {
  const applyDimFilters = options.applyProdutosDimFilters === true;
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
    if (applyDimFilters) {
      const fcia = document.getElementById('produtos-filter-cia')?.value?.trim() || '';
      const fseg = document.getElementById('produtos-filter-segmento')?.value?.trim() || '';
      const fmar = document.getElementById('produtos-filter-marca')?.value?.trim() || '';
      if (fcia) params.set('cia', fcia);
      if (fseg) params.set('segmento', fseg);
      if (fmar) params.set('marca', fmar);
    }
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
let breakSyncInProgress = false;
let selectedProductFile = null;
let currentRole = 'conferente';
let countProductsCache = [];
/** Catálogo ativo CIA Mate couro (base de troca). */
let mateCouroProductsCache = [];
/** Último número de itens Mate couro no dia carregado (para KPIs). */
let lastMateTrocaDayItemsCount = null;
let currentAllowedPages = [];
let countKpiTicker = null;
let countAuditPollingTimer = null;
/** Intervalo da Análise de Contagem: atualização quase em tempo real (outros dispositivos / servidor). */
const COUNT_AUDIT_POLL_MS = 8000;
let countAuditVisibilityBound = false;

const PAGE_KEYS_BY_MODULE = {
  contagem: [
    'contagem',
    'count',
    'pull',
    'return',
    'break',
    'break-history',
    'mate-couro-troca',
    'mate-couro-troca-historico',
    'mate-couro-troca-trocas',
    'direct-sale',
    'validity',
    'validity-analysis',
    'import-txt',
    'count-audit',
  ],
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
      { key: 'break-history', label: 'Registro de quebras' },
      { key: 'mate-couro-troca', label: 'Base de Troca' },
      { key: 'direct-sale', label: 'Venda Direta' },
      { key: 'validity', label: 'Validade (lançamento)' },
      { key: 'validity-analysis', label: 'Análise de Validades' },
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
    'break-history',
    'mate-couro-troca',
    'direct-sale',
    'validity',
    'validity-analysis',
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
    'break-history',
    'mate-couro-troca',
    'direct-sale',
    'validity',
    'import-txt',
    /* count-audit / validity-analysis: só com permissão explícita ou perfil administrativo */
  ],
};

const MODULE_ACCESS = {
  contagem: ['conferente', 'administrativo', 'admin'],
  cadastro: ['administrativo', 'admin'],
  acesso: ['administrativo', 'admin'],
};

const SUB_MODULES = [
  'count',
  'pull',
  'return',
  'break',
  'break-history',
  'mate-couro-troca',
  'mate-couro-troca-historico',
  'mate-couro-troca-trocas',
  'direct-sale',
  'validity',
  'validity-analysis',
  'import-txt',
  'count-audit',
];
const CADASTRO_SUBS = ['cadastro-produto', 'produtos', 'parametros-produto'];
const SUB_TO_PARENT = {};
SUB_MODULES.forEach(s => { SUB_TO_PARENT[s] = 'contagem'; });
CADASTRO_SUBS.forEach(s => { SUB_TO_PARENT[s] = 'cadastro'; });

/** Não liberar só por ter "contagem" em allowed_pages (auditoria / análise). */
const SUB_KEYS_REQUIRE_EXPLICIT_ALLOWED = new Set(['count-audit', 'validity-analysis']);

const PAGE_TITLES = {
  inicio: 'Página inicial',
  contagem: 'Contagem',
  cadastro: 'Cadastro',
  acesso: 'Acesso',
  count: 'Contagem',
  pull: 'Puxada',
  return: 'Devolução',
  break: 'Quebra',
  'break-history': 'Registro de quebras',
  'mate-couro-troca': 'Base de Troca',
  'mate-couro-troca-historico': 'Histórico no servidor',
  'mate-couro-troca-trocas': 'Trocas encerradas',
  'direct-sale': 'Venda Direta',
  validity: 'Validade',
  'validity-analysis': 'Análise de Validades',
  'import-txt': 'Importar Estoque',
  'count-audit': 'Análise de Contagem',
  'cadastro-produto': 'Cadastro de Produto',
  produtos: 'Produtos',
  'parametros-produto': 'Parâmetros',
};

const PRODUCT_DEFAULTS_KEY = 'estoque_product_defaults_v1';
/** Acumulativo de troca (Mate couro): pending + dias já incorporados — só neste aparelho. */
const MATE_COURO_TROCA_STORAGE_KEY = 'estoque_mate_couro_troca_v3';
const MATE_COURO_TROCA_STORAGE_PREV_KEY = 'estoque_mate_couro_troca_v2';
const MATE_COURO_TROCA_STORAGE_LEGACY_KEY = 'estoque_mate_couro_troca_acum_v1';
const API_MATE_TROCA_BATCHES = '/audit/mate-troca-batches';
const MATE_COURO_CIA = 'Mate couro';
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
      { module: 'Base de Troca', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Venda Direta', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Validade (lançamento)', roles: ['conferente', 'administrativo', 'admin'] },
      { module: 'Análise de Validades', roles: ['administrativo', 'admin'] },
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

  if (subKey !== 'count-audit') {
    closeCountAuditDetailDrawer();
  }

  // Para o polling de análise se estava ativo em outro submódulo
  if (countAuditPollingTimer && subKey !== 'count-audit') {
    clearInterval(countAuditPollingTimer);
    countAuditPollingTimer = null;
  }

  parentEl.querySelectorAll('.sub-section').forEach((s) => s.classList.remove('active'));

  const target = document.getElementById(`sub-${subKey}`);
  if (target) target.classList.add('active');

  if (subKey !== 'count') {
    stopCountRecountSignalsPolling();
  }

  if (subKey === 'produtos') {
    searchProdutos();
  } else if (subKey === 'count') {
    startCountRecountSignalsPolling();
    loadCountProducts();
  } else if (subKey === 'break') {
    loadBreakProducts();
  } else if (subKey === 'break-history') {
    loadBreakHistoryList();
  } else if (subKey === 'mate-couro-troca') {
    loadMateCouroTrocaPage();
  } else if (subKey === 'mate-couro-troca-historico') {
    /* Lista do histórico: carregamento explícito pelo usuário (Carregar histórico). */
  } else if (subKey === 'mate-couro-troca-trocas') {
    loadMateTrocaTrocasPage();
  } else if (subKey === 'count-audit') {
    startCountAuditPolling();
  } else if (subKey === 'validity-analysis') {
    loadValidityModuleForSub(subKey);
  } else if (subKey === 'validity') {
    loadValidityOperationalModule();
  }
}

function showModuleHome(moduleKey) {
  const parentEl = document.getElementById(`module-${moduleKey}`);
  if (!parentEl) return;
  parentEl.querySelectorAll('.sub-section').forEach((s) => s.classList.remove('active'));
  const home = document.getElementById(`${moduleKey}-home`);
  if (home) home.classList.add('active');
  if (pageTitleEl) {
    pageTitleEl.textContent = PAGE_TITLES[moduleKey] || 'Estoque';
  }
  if (moduleKey === 'contagem') {
    stopCountRecountSignalsPolling();
    refreshContagemValidityExpiringKpi();
  }
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
  // Hash legado: lançamento rápido de validade unificado em #validity
  if (normalized === 'validity-launch') {
    if (updateHistory) {
      history.replaceState(null, '', `${APP_BASE_PATH}#validity`);
    }
    setActiveModule('validity', false);
    return;
  }

  if (normalized === 'inicio') {
    document.querySelectorAll('.module-section').forEach((section) => {
      section.classList.remove('active');
    });
    const hub = document.getElementById('module-inicio');
    if (hub) hub.classList.add('active');

    document.querySelectorAll('.module-btn').forEach((btn) => {
      const btnMod = (btn.dataset.module || '').trim().toLowerCase();
      btn.classList.toggle('active', btnMod === 'inicio');
    });

    if (pageTitleEl) {
      pageTitleEl.textContent = PAGE_TITLES.inicio;
    }

    if (updateHistory && window.location.hash.slice(1) !== 'inicio') {
      history.pushState(null, '', `${APP_BASE_PATH}#inicio`);
    }
    return;
  }

  const lookupKey = normalized;
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

/** Bases com `validity` legado ganham acesso ao submódulo de análise de validades. */
function expandUserAllowedPagesForValidity(pages) {
  const arr = [...pages];
  if (arr.includes('validity')) {
    if (!arr.includes('validity-analysis')) arr.push('validity-analysis');
  }
  if (arr.includes('mate-couro-troca')) {
    if (!arr.includes('mate-couro-troca-historico')) arr.push('mate-couro-troca-historico');
    if (!arr.includes('mate-couro-troca-trocas')) arr.push('mate-couro-troca-trocas');
  }
  return arr;
}

function canAccessHash(hashKey) {
  if (currentRole === 'admin') return true;
  const k = String(hashKey || '').trim().toLowerCase();
  if (!k) return false;

  if (k === 'inicio') {
    return true;
  }

  if (k === 'mate-couro-troca-trocas' || k === 'mate-couro-troca-historico') {
    if (currentAllowedPages.length) {
      const expanded = expandUserAllowedPagesForValidity(currentAllowedPages);
      if (expanded.includes('mate-couro-troca')) return true;
    }
    return canAccessHash('break');
  }
  if (k === 'break-history' || k === 'mate-couro-troca') {
    return canAccessHash('break');
  }

  if (k === 'validity' || k === 'validity-launch') {
    return canAccessModule('contagem');
  }

  if (SUB_KEYS_REQUIRE_EXPLICIT_ALLOWED.has(k)) {
    if (currentAllowedPages.length) {
      const expanded = expandUserAllowedPagesForValidity(currentAllowedPages);
      return expanded.includes(k);
    }
    return ['administrativo', 'admin'].includes(currentRole);
  }

  if (currentAllowedPages.length) {
    const expanded = expandUserAllowedPagesForValidity(currentAllowedPages);
    if (expanded.includes(k)) return true;
    const parent = SUB_TO_PARENT[k];
    if (parent && expanded.includes(parent)) return true;
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

function renderHubCards() {
  document.querySelectorAll('.module-hub-card[data-module]').forEach((card) => {
    const mk = (card.dataset.module || '').trim().toLowerCase();
    if (!mk || mk === 'inicio') {
      card.hidden = false;
      card.style.display = '';
      return;
    }
    const visible = canAccessModule(mk);
    card.hidden = !visible;
    card.style.display = visible ? '' : 'none';
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
        history.replaceState(null, '', `${APP_BASE_PATH}#${firstVisible}`);
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

function migrateLegacyBreakIfNeeded() {
  try {
    const legacyKey = 'estoque_break_v1';
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(legacyKey);
      return;
    }
    const bucket = loadBreakEventsBucketRaw();
    const hasNew = Object.keys(bucket).some((k) => Array.isArray(bucket[k]) && bucket[k].length > 0);
    if (hasNew) {
      localStorage.removeItem(legacyKey);
      return;
    }
    const day = getBrazilDateKey();
    if (!bucket[day]) bucket[day] = [];
    for (const e of parsed) {
      if (!e || !e.item_code) continue;
      bucket[day].push({
        client_event_id: e.client_event_id || makeEventId(),
        item_code: normalizeItemCode(String(e.item_code)),
        count_type: 'unidade',
        quantity: Number(e.quantity) || 0,
        observed_at: e.observed_at || new Date().toISOString(),
        synced: Boolean(e.synced),
        device_name: e.device_name || getDeviceName(),
        operational_date: day,
        reason: null,
      });
    }
    saveBreakEventsBucketRaw(bucket);
    localStorage.removeItem(legacyKey);
  } catch {
    /* ignore */
  }
}

function loadBreakEventsBucketRaw() {
  migrateLegacyBreakIfNeeded();
  try {
    const raw = localStorage.getItem(BREAK_EVENTS_BUCKET_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveBreakEventsBucketRaw(bucket) {
  try {
    localStorage.setItem(BREAK_EVENTS_BUCKET_KEY, JSON.stringify(bucket));
  } catch {
    /* ignore */
  }
}

function loadBreakEventsForDate(dateKey) {
  const bucket = loadBreakEventsBucketRaw();
  const arr = bucket[dateKey];
  return Array.isArray(arr) ? arr : [];
}

function saveBreakEventsForDate(dateKey, events) {
  const bucket = loadBreakEventsBucketRaw();
  bucket[dateKey] = events;
  saveBreakEventsBucketRaw(bucket);
}

function flattenAllBreakEventsFromBucket() {
  const bucket = loadBreakEventsBucketRaw();
  return Object.keys(bucket).flatMap((k) => (Array.isArray(bucket[k]) ? bucket[k] : []));
}

function markBreakEventsSyncedInBucket(syncedIds) {
  const ids = syncedIds instanceof Set ? syncedIds : new Set(syncedIds);
  if (!ids.size) return;
  const bucket = loadBreakEventsBucketRaw();
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
  if (changed) saveBreakEventsBucketRaw(bucket);
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
    let checked = pages.includes(key);
    if (key === 'validity-analysis') {
      checked = checked || pages.includes('validity');
    }
    if (key === 'validity') {
      checked = checked || pages.includes('validity-analysis');
    }
    node.checked = checked;
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
  history.replaceState(null, '', historyBasePathNoHash());
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
   * Sem TXT: percent = produtos com lançamento / total.
   * Com TXT: percent (barra principal) = metades CX/UN que batem o import; productPercent/counted = produtos
   * com qualquer lançamento (não só os já conferidos contra o TXT).
   */
  if (!hasTxt) {
    let counted = 0;
    for (const code of uniqueProducts) {
      if (productHasAnyCountLaunch(code)) counted += 1;
    }
    const percent = total > 0 ? Math.min(100, Math.round((counted / total) * 100)) : 0;
    return {
      total,
      counted,
      percent,
      productPercent: percent,
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
      if (productHasAnyCountLaunch(code)) counted += 1;
    } else {
      dimTotal += 1;
      if (productHasAnyCountLaunch(code)) {
        dimCompleted += 1;
        counted += 1;
      }
    }
  }
  const percent = dimTotal > 0 ? Math.min(100, Math.round((100 * dimCompleted) / dimTotal)) : 0;
  const productPercent = total > 0 ? Math.min(100, Math.round((100 * counted) / total)) : 0;
  return {
    total,
    counted,
    percent,
    productPercent,
    usesDimProgress: true,
    dimCompleted,
    dimTotal,
  };
}

/** Descrição sob a barra de metades (CX/UN vs TXT). */
function countProgressDetailDimLabel(stats) {
  const { total, counted, usesDimProgress, dimCompleted, dimTotal } = stats;
  if (!total) {
    return countImportBalancesState.hasTxt
      ? '0 de 0 metades (CX e UN)'
      : '0 de 0 produtos com lançamento';
  }
  if (usesDimProgress && dimTotal > 0) {
    return `${dimCompleted} de ${dimTotal} metades (CX e UN)`;
  }
  return `${counted} de ${total} produtos com lançamento`;
}

/** Descrição sob a barra de produtos: produtos com lançamento (não exige acerto com TXT). */
function countProgressDetailProductsLabel(stats) {
  const { total, counted } = stats;
  if (!total) return '0 de 0 produtos';
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

/** Linha do mini-KPI: quem sincronizou no servidor (dia da #count-date) vs. sessão local. */
function formatKpiCountUserLine() {
  const me = getUser();
  const sess = (me && (me.full_name || me.name || me.username)) || '—';
  if (!kpiCountUser) return;
  const meta = countServerCountState.ok ? countServerCountState.meta : null;
  const actors = meta && Array.isArray(meta.actors) ? meta.actors.filter(Boolean) : [];
  if (actors.length) {
    const shown =
      actors.length <= 2
        ? actors.join(', ')
        : `${actors.slice(0, 2).join(', ')} +${actors.length - 2}`;
    kpiCountUser.textContent = `Servidor (${actors.length} conferente${actors.length === 1 ? '' : 's'}): ${shown} · Você: ${sess}`;
    return;
  }
  kpiCountUser.textContent = `Sem lançamentos sincronizados neste dia no servidor · Você: ${sess}`;
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

/** Previsão pelo ritmo médio (produtos com lançamento / tempo desde o início). */
function estimateCountFinishFromProgress(stats, startMs, nowMs) {
  const total = stats.total;
  const done = stats.counted;
  if (total <= 0 || done < 1 || total <= done) return null;
  const elapsed = nowMs - startMs;
  if (!Number.isFinite(elapsed) || elapsed < 1000) return null;
  const rate = done / elapsed;
  if (!(rate > 0)) return null;
  const remaining = total - done;
  const etaMs = nowMs + remaining / rate;
  return new Date(etaMs);
}

function updateCountKpi(products = countProductsCache) {
  if (!kpiCountPercent || !kpiCountWindow || !kpiCountElapsed || !kpiCountEta) return;
  formatKpiCountUserLine();

  const events = loadCountEvents();
  const stats = computeCountProgressStats(products);
  const { total, percent, productPercent } = stats;
  const showDimSub =
    Boolean(stats.usesDimProgress && stats.dimTotal > 0 && countImportBalancesState.hasTxt);
  const kpiDisplayPercent = showDimSub ? productPercent : percent;
  kpiCountPercent.textContent = `${kpiDisplayPercent}%`;
  const kpiSub = document.getElementById('kpi-count-percent-sub');
  if (kpiSub) {
    if (showDimSub) {
      kpiSub.hidden = false;
      kpiSub.textContent = `Metades CX/UN vs importação: ${percent}%`;
    } else {
      kpiSub.hidden = true;
      kpiSub.textContent = '';
    }
  }

  const timestamps = events
    .map((e) => new Date(e.observed_at || '').getTime())
    .filter((ts) => Number.isFinite(ts))
    .sort((a, b) => a - b);
  const serverFirst =
    countServerCountState.ok && countServerCountState.meta?.first_observed_at
      ? new Date(countServerCountState.meta.first_observed_at).getTime()
      : null;
  const serverLast =
    countServerCountState.ok && countServerCountState.meta?.last_observed_at
      ? new Date(countServerCountState.meta.last_observed_at).getTime()
      : null;
  const starts = [timestamps[0], serverFirst].filter((t) => Number.isFinite(t));
  const lastLocal = timestamps.length ? timestamps[timestamps.length - 1] : null;
  const ends = [lastLocal, serverLast].filter((t) => Number.isFinite(t));

  if (!starts.length) {
    kpiCountWindow.textContent = 'Início: --:-- | Fim: --:--';
    kpiCountElapsed.textContent = 'Tempo em andamento: 00:00:00';
    kpiCountEta.textContent =
      kpiDisplayPercent > 0 || percent > 0
        ? 'Previsão de término: aguardando horários dos lançamentos sincronizados'
        : 'Previsão de término: --:--';
    return;
  }

  const startMs = Math.min(...starts);
  const lastMs = ends.length ? Math.max(startMs, ...ends) : startMs;
  const finished = total > 0 && percent >= 100;
  const endMs = finished ? lastMs : null;
  const nowMs = Date.now();
  const elapsedMs = (finished ? endMs : nowMs) - startMs;

  kpiCountWindow.textContent = `Início: ${formatClock(startMs)} | Fim: ${finished ? formatClock(endMs) : '--:--'}`;
  kpiCountElapsed.textContent = `Tempo em andamento: ${formatDurationFromMs(elapsedMs)}`;

  if (finished) {
    kpiCountEta.textContent = `Previsão de término: concluído às ${formatClock(endMs)}`;
    return;
  }

  let etaDate = estimateCountFinish(events, total);
  if (!etaDate) {
    etaDate = estimateCountFinishFromProgress(stats, startMs, nowMs);
  }

  if (etaDate) {
    kpiCountEta.textContent = `Previsão de término: ${formatClock(etaDate)}`;
    return;
  }

  const doneUnits = stats.counted;
  const totalUnits = stats.total;
  if (totalUnits > 0 && doneUnits >= 1 && elapsedMs < 1000) {
    kpiCountEta.textContent = 'Previsão de término: calculando…';
  } else if (totalUnits > 0 && doneUnits >= 1) {
    kpiCountEta.textContent =
      'Previsão de término: indisponível (ritmo ainda irregular — continue lançando)';
  } else {
    kpiCountEta.textContent =
      'Previsão de término: após o primeiro lançamento e ~1 min de operação';
  }
}

/** KPI na home de Contagem: produtos ativos com data de validade exibida entre hoje e +30 dias. */
async function refreshContagemValidityExpiringKpi() {
  const el = document.getElementById('kpi-validity-expiring-30d');
  if (!el) return;
  const token = getToken();
  if (!token || isAccessTokenExpired(token)) {
    el.textContent = '—';
    return;
  }
  if (unauthorizedRedirectInProgress) return;
  try {
    const response = await apiFetch(API_VALIDITY_KPI_EXPIRING_30D, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      el.textContent = '—';
      return;
    }
    const data = await response.json();
    const n = Number(data.count);
    el.textContent = Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : '—';
  } catch {
    el.textContent = '—';
  }
}

function startCountKpiTicker() {
  if (countKpiTicker) return;
  countKpiTicker = window.setInterval(() => {
    updateCountKpi(countProductsCache);
  }, 1000);
}

function applyCountProgressFillTier(el, pct) {
  if (!el) return;
  el.classList.remove('is-low', 'is-mid', 'is-high');
  if (pct >= 85) el.classList.add('is-high');
  else if (pct >= 40) el.classList.add('is-mid');
  else el.classList.add('is-low');
}

/** Barra: produtos com distribuição de validade concluída (soma de lotes = base da contagem do dia). */
function updateValidityOpProgress(completeCount, totalWithBase, opKey, todayBr) {
  const fill = document.getElementById('validity-op-progress-fill-products');
  const pctEl = document.getElementById('validity-op-progress-percent-products');
  const detailEl = document.getElementById('validity-op-progress-detail-products');
  const pct = totalWithBase > 0 ? Math.round((completeCount / totalWithBase) * 100) : 0;
  if (fill) {
    fill.style.width = `${pct}%`;
    applyCountProgressFillTier(fill, pct);
  }
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (detailEl) {
    const sameDay = opKey === todayBr;
    detailEl.textContent = sameDay
      ? `${completeCount} de ${totalWithBase} produtos com lotes completos (hoje)`
      : `${completeCount} de ${totalWithBase} produtos com lotes completos nesta data`;
  }
}

function updateCountProgress(products = countProductsCache) {
  const fillDim = document.getElementById('count-progress-fill') || countProgressFill;
  const fillProducts = document.getElementById('count-progress-fill-products');
  const blockProducts = document.getElementById('count-progress-block-products');
  const percentProductsSpan = document.getElementById('count-progress-percent-products');
  const detailDimEl = document.getElementById('count-progress-detail-dim');
  const detailProductsEl = document.getElementById('count-progress-detail-products');
  if (!fillDim) return;
  const stats = computeCountProgressStats(products);
  const { total, percent, productPercent, usesDimProgress } = stats;
  const dual = Boolean(total && usesDimProgress && stats.dimTotal > 0);

  if (blockProducts) blockProducts.hidden = !dual;

  if (!total) {
    fillDim.style.width = '0%';
    applyCountProgressFillTier(fillDim, 0);
    if (fillProducts) {
      fillProducts.style.width = '0%';
      applyCountProgressFillTier(fillProducts, 0);
    }
    const percentSpan = document.getElementById('count-progress-percent');
    if (percentSpan) percentSpan.textContent = '0%';
    if (percentProductsSpan) percentProductsSpan.textContent = '0%';
    if (detailDimEl) detailDimEl.textContent = countProgressDetailDimLabel(stats);
    if (detailProductsEl) detailProductsEl.textContent = countProgressDetailProductsLabel(stats);
    return;
  }

  fillDim.style.width = `${percent}%`;
  applyCountProgressFillTier(fillDim, percent);
  if (dual && fillProducts) {
    fillProducts.style.width = `${productPercent}%`;
    applyCountProgressFillTier(fillProducts, productPercent);
  } else if (fillProducts) {
    fillProducts.style.width = '0%';
    applyCountProgressFillTier(fillProducts, 0);
  }

  const percentSpan = document.getElementById('count-progress-percent');
  if (percentSpan) percentSpan.textContent = `${percent}%`;
  if (percentProductsSpan) percentProductsSpan.textContent = dual ? `${productPercent}%` : '0%';

  if (detailDimEl) detailDimEl.textContent = countProgressDetailDimLabel(stats);
  if (detailProductsEl) detailProductsEl.textContent = countProgressDetailProductsLabel(stats);
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
  let raw = String(value || '').trim().replace(/\s+/g, ' ');
  raw = raw.replace(/\s*\[(UN|CX)\]\s*$/i, '');
  return raw.toUpperCase();
}

/** Mesma regra do servidor: códigos só numéricos viram uma chave única (010 ≡ 10). */
function normalizeNumericProductCodeKey(code) {
  const base = normalizeItemCode(code);
  if (!base) return '';
  if (/^\d+$/.test(base)) return normalizeItemCode(String(Number(base)));
  return base;
}

function normalizeCountType(value) {
  return (value || '').trim().toLowerCase() === 'unidade' ? 'unidade' : 'caixa';
}

/** CX/UN de evento de quebra (API /audit/break-events): evita perder um eixo quando só um vem no JSON. */
function parseAuditBreakCxUn(ev) {
  if (!ev || typeof ev !== 'object') return { cx: 0, un: 0 };
  const rawCx = Number(ev.cx);
  const rawUn = Number(ev.un);
  const finCx = Number.isFinite(rawCx);
  const finUn = Number.isFinite(rawUn);
  if (finCx && finUn) {
    return { cx: Math.round(rawCx), un: Math.round(rawUn) };
  }
  if (finCx) return { cx: Math.round(rawCx), un: 0 };
  if (finUn) return { cx: 0, un: Math.round(rawUn) };
  const qty = Number(ev.quantity) || 0;
  const tipo = ev.qty_type === 'unidade' ? 'unidade' : 'caixa';
  return {
    cx: tipo === 'caixa' ? Math.round(qty) : 0,
    un: tipo === 'unidade' ? Math.round(qty) : 0,
  };
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

function loadBreakEvents() {
  return loadBreakEventsForDate(getActiveBreakDateKey());
}

function getUnsyncedNetBreakByProductAndType(productCode, countType) {
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  let sum = 0;
  for (const event of loadBreakEvents()) {
    if (event.synced) continue;
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    sum += Number(event.quantity || 0);
  }
  return sum;
}

/** Pendências locais não sincronizadas para um dia operacional específico (mesma regra da tela Quebra). */
function getUnsyncedNetBreakByProductAndTypeForDate(productCode, countType, dayKey) {
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  let sum = 0;
  for (const event of loadBreakEventsForDate(dayKey)) {
    if (event.synced) continue;
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    sum += Number(event.quantity || 0);
  }
  return sum;
}

/**
 * Totais de quebra no mapa do servidor (break-day-totals) para o código da linha.
 * Tenta equivalente numérico (ex.: 030 vs 30) para não zerar a coluna Quebra quando TXT e ChangeLog divergem
 * só na forma do código.
 */
function resolveBreakDayBalanceEntry(balancesMap, productCode) {
  const base = normalizeItemCode(productCode);
  const empty = { caixa: 0, unidade: 0 };
  if (!base || !balancesMap || typeof balancesMap !== 'object') return empty;
  const pick = (key) => {
    const b = balancesMap[key];
    if (!b || typeof b !== 'object') return null;
    return {
      caixa: Math.round(Number(b.caixa) || 0),
      unidade: Math.round(Number(b.unidade) || 0),
    };
  };
  const direct = pick(base);
  if (direct) return direct;
  if (/^\d+$/.test(base)) {
    const alt = normalizeItemCode(String(Number(base)));
    if (alt && alt !== base) {
      const v = pick(alt);
      if (v) return v;
    }
  }
  return empty;
}

/**
 * Total de quebra CX/UN no dia (servidor + pendente local), alinhado ao readout da tela Quebra.
 * @param {boolean} serverOk - GET break-day-totals ok para este dia
 * @param {Record<string, {caixa?: number, unidade?: number}>} balancesMap - mapa código → totais do servidor
 */
function getNetBreakByProductAndTypeForOperationalDay(productCode, countType, dayKey, serverOk, balancesMap) {
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  const unsynced = getUnsyncedNetBreakByProductAndTypeForDate(productCode, countType, dayKey);
  if (serverOk && balancesMap && typeof balancesMap === 'object') {
    const b = resolveBreakDayBalanceEntry(balancesMap, productCode);
    const server = ct === 'unidade' ? b.unidade : b.caixa;
    return server + unsynced;
  }
  let sum = 0;
  for (const event of loadBreakEventsForDate(dayKey)) {
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    sum += Number(event.quantity || 0);
  }
  return sum;
}

function getServerNetBreakForProductAndType(productCode, countType) {
  if (!breakServerBreakState.ok) return 0;
  const ct = normalizeCountType(countType);
  const b = resolveBreakDayBalanceEntry(breakServerBreakState.balances, productCode);
  return ct === 'unidade' ? b.unidade : b.caixa;
}

/**
 * Readout de quebra no dia operacional (hoje, America/Sao_Paulo): servidor + pendente local não sincronizado.
 */
function getNetBreakByProductAndType(productCode, countType) {
  const base = normalizeItemCode(productCode);
  const ct = normalizeCountType(countType);
  const unsynced = getUnsyncedNetBreakByProductAndType(productCode, countType);
  if (breakServerBreakState.ok) {
    return getServerNetBreakForProductAndType(productCode, countType) + unsynced;
  }
  let sum = 0;
  for (const event of loadBreakEvents()) {
    if (normalizeItemCode(event.item_code || '') !== base) continue;
    if (normalizeCountType(event.count_type) !== ct) continue;
    sum += Number(event.quantity || 0);
  }
  return sum;
}

async function loadServerBreakTotals() {
  if (loadServerBreakTotalsInFlight) {
    return loadServerBreakTotalsInFlight;
  }
  loadServerBreakTotalsInFlight = (async () => {
    const token = getToken();
    if (!token) {
      breakServerBreakState = { ok: false, balances: {} };
      return;
    }
    if (unauthorizedRedirectInProgress) {
      breakServerBreakState = { ok: false, balances: {} };
      return;
    }
    if (isAccessTokenExpired(token)) {
      breakServerBreakState = { ok: false, balances: {} };
      handleUnauthorizedResponse({ status: 401 });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('operational_date', getActiveBreakDateKey());
      const response = await apiFetch(`${API_BREAK_DAY_TOTALS}?${params.toString()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (handleUnauthorizedResponse(response)) {
        breakServerBreakState = { ok: false, balances: {} };
        return;
      }
      if (!response.ok) {
        breakServerBreakState = { ok: false, balances: {} };
        return;
      }
      const data = await response.json();
      breakServerBreakState = { ok: true, balances: data.balances || {} };
    } catch {
      breakServerBreakState = { ok: false, balances: {} };
    }
  })();
  try {
    await loadServerBreakTotalsInFlight;
  } finally {
    loadServerBreakTotalsInFlight = null;
  }
}

async function loadServerCountTotals() {
  if (loadServerCountTotalsInFlight) {
    return loadServerCountTotalsInFlight;
  }
  loadServerCountTotalsInFlight = (async () => {
    const token = getToken();
    if (!token) {
      countServerCountState = { ok: false, balances: {}, meta: null };
      return;
    }
    if (unauthorizedRedirectInProgress) {
      countServerCountState = { ok: false, balances: {}, meta: null };
      return;
    }
    if (isAccessTokenExpired(token)) {
      countServerCountState = { ok: false, balances: {}, meta: null };
      handleUnauthorizedResponse({ status: 401 });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('count_date', getActiveCountDateKey());
      const response = await apiFetch(`${API_COUNT_SERVER_TOTALS}?${params.toString()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (handleUnauthorizedResponse(response)) {
        countServerCountState = { ok: false, balances: {}, meta: null };
        return;
      }
      if (!response.ok) {
        countServerCountState = { ok: false, balances: {}, meta: null };
        return;
      }
      const data = await response.json();
      const metaRaw = data.meta;
      const meta =
        metaRaw && typeof metaRaw === 'object'
          ? {
              actors: Array.isArray(metaRaw.actors) ? metaRaw.actors : [],
              first_observed_at: metaRaw.first_observed_at || null,
              last_observed_at: metaRaw.last_observed_at || null,
              event_count: Number(metaRaw.event_count) || 0,
            }
          : null;
      countServerCountState = { ok: true, balances: data.balances || {}, meta };
      updateCountKpi(countProductsCache);
    } catch {
      countServerCountState = { ok: false, balances: {}, meta: null };
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

/** Produto com ao menos uma dimensão contada (evento, servidor ou zero explícito). Não exige acerto com TXT. */
function productHasAnyCountLaunch(codRaw) {
  if (hasAnyCountActivityForType(codRaw, 'caixa') || hasAnyCountActivityForType(codRaw, 'unidade')) {
    return true;
  }
  return countExplicitZeroStored(codRaw, 'caixa') || countExplicitZeroStored(codRaw, 'unidade');
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

async function loadValidityDayCountTotals() {
  const dayKey = getActiveValidityOpDateKey();
  if (loadValidityDayCountInFlight) {
    await loadValidityDayCountInFlight;
    return;
  }
  loadValidityDayCountInFlight = (async () => {
    const token = getToken();
    if (!token) {
      validityDayCountState = { ok: false, balances: {}, meta: null, dayKey };
      return;
    }
    if (unauthorizedRedirectInProgress) {
      validityDayCountState = { ok: false, balances: {}, meta: null, dayKey };
      return;
    }
    if (isAccessTokenExpired(token)) {
      validityDayCountState = { ok: false, balances: {}, meta: null, dayKey };
      handleUnauthorizedResponse({ status: 401 });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('count_date', dayKey);
      const response = await apiFetch(`${API_COUNT_SERVER_TOTALS}?${params.toString()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (handleUnauthorizedResponse(response)) {
        validityDayCountState = { ok: false, balances: {}, meta: null, dayKey };
        return;
      }
      if (!response.ok) {
        validityDayCountState = { ok: false, balances: {}, meta: null, dayKey };
        return;
      }
      const data = await response.json();
      const metaRaw = data.meta;
      const meta =
        metaRaw && typeof metaRaw === 'object'
          ? {
              actors: Array.isArray(metaRaw.actors) ? metaRaw.actors : [],
              first_observed_at: metaRaw.first_observed_at || null,
              last_observed_at: metaRaw.last_observed_at || null,
              event_count: Number(metaRaw.event_count) || 0,
            }
          : null;
      validityDayCountState = { ok: true, balances: data.balances || {}, meta, dayKey };
    } catch {
      validityDayCountState = { ok: false, balances: {}, meta: null, dayKey };
    }
  })();
  try {
    await loadValidityDayCountInFlight;
  } finally {
    loadValidityDayCountInFlight = null;
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

/** Campo livre de validade: aceita DD/MM/AAAA ou YYYY-MM-DD → YYYY-MM-DD ou null. */
function parseValidityDateInputToIso(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const t = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
    if (Number.isNaN(t.getTime())) return null;
    if (t.getFullYear() !== y || t.getMonth() + 1 !== mo || t.getDate() !== d) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!br) return null;
  const d = Number(br[1]);
  const mo = Number(br[2]);
  const y = Number(br[3]);
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const mm = String(mo).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const t = new Date(`${y}-${mm}-${dd}T12:00:00`);
  if (Number.isNaN(t.getTime())) return null;
  if (t.getFullYear() !== y || t.getMonth() + 1 !== mo || t.getDate() !== d) return null;
  return `${y}-${mm}-${dd}`;
}

function applyValidityDateDigitMask(el) {
  if (!el) return;
  const digits = String(el.value || '').replace(/\D/g, '').slice(0, 8);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += '/';
    out += digits[i];
  }
  el.value = out;
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

function getActiveValiditySubKey() {
  if (document.getElementById('sub-validity-analysis')?.classList.contains('active')) return 'validity-analysis';
  if (document.getElementById('sub-validity')?.classList.contains('active')) return 'validity';
  return null;
}

function setValidityFeedback(msg, isError = false) {
  const color = isError ? 'var(--error)' : 'var(--accent)';
  document.querySelectorAll('#validity-analysis-feedback, #validity-op-feedback').forEach((el) => {
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = color;
  });
}

function updateValidityPendingBadges() {
  const pending = flattenValidityPendingAll().filter((e) => !e.synced).length;
  const text = `${pending} pendentes`;
  document.querySelectorAll('#validity-analysis-pending-badge, #validity-op-pending-badge').forEach((badge) => {
    if (!badge) return;
    badge.hidden = pending === 0;
    badge.textContent = text;
  });
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
  /* Ordem por código do produto (igual análise de contagem: numérico-aware em pt-BR). */
  ativos.sort(compareAuditCodProduto);
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
  if (countProductsTotal) {
    const n = ativos.length;
    countProductsTotal.textContent = `${n} ${n === 1 ? 'item' : 'itens'}`;
  }
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
    const codHtml = codRaw
      ? ` <span class="count-product-cod">· ${escapeHtml(codRaw)}</span>`
      : '';
    const netCx = getNetByProductAndType(codRaw, 'caixa');
    const netUn = getNetByProductAndType(codRaw, 'unidade');
    const pair = getCountSaldoPair(codRaw);
    const hasTxt = countImportBalancesState.hasTxt;
    const dimCx = countDimensionMatchesSaldo(codRaw, 'caixa', netCx, pair ? pair.import_caixa : 0);
    const dimUn = countDimensionMatchesSaldo(codRaw, 'unidade', netUn, pair ? pair.import_unidade : 0);
    const vCx = Math.max(0, Math.round(Number(netCx) || 0));
    const vUn = Math.max(0, Math.round(Number(netUn) || 0));

    let cardClass = 'count-product-item';
    const analystLiveRecount = serverRecountSignalCodes.has(codRaw);
    if (analystLiveRecount) {
      cardClass += ' count-product-item--analyst-recount';
    }
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
        <span class="count-product-title-row">
          ${analystLiveRecount ? '<span class="count-product-recount-flag" role="status">Recontar</span>' : ''}
          <span class="count-product-desc">${desc}${codHtml}</span>
        </span>
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

/**
 * @param {string} term
 * @param {unknown[]} [sourceList] quando omitido, usa o cache global da contagem
 */
function filterCountProductsByTerm(term, sourceList) {
  const list = sourceList !== undefined && sourceList !== null ? sourceList : countProductsCache;
  if (!Array.isArray(list)) return [];
  const normalized = (term || '').trim().toLowerCase();
  if (!normalized) return list;
  return list.filter((product) => {
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

/**
 * @param {{ skipCountRender?: boolean }} [options]
 */
async function loadCountProducts(options = {}) {
  const skipCountRender = options.skipCountRender === true;
  if (!skipCountRender && !countProductsList) return;
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
      if (!skipCountRender) {
        renderCountProducts([]);
        setFeedback('Nao foi possivel carregar a lista de produtos para contagem.', true);
      }
      return;
    }
    if (!Array.isArray(products) || products.length === 0) {
      await Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]);
      if (!skipCountRender) {
        renderCountProducts([]);
        setFeedback('Nenhum produto ativo encontrado. Verifique se há produtos cadastrados como ATIVO.', true);
      }
      return;
    }
    countProductsCache = products;
    await Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]);
    await refreshRecountSignalsFromServer();
    if (!skipCountRender) {
      renderCountProducts(countProductsCache);
      if (countPrefillProductCode) {
        const itemCodeInput = document.getElementById('item-code');
        if (itemCodeInput) {
          itemCodeInput.value = countPrefillProductCode;
          itemCodeInput.dispatchEvent(new Event('input'));
        }
        countPrefillProductCode = null;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar produtos:', e);
    Promise.all([loadImportBalancesForCount(), loadServerCountTotals()]).then(() => {
      if (!skipCountRender) renderCountProducts([]);
    });
    if (!skipCountRender) {
      setFeedback('Sem conexao para carregar produtos.', true);
    }
  }
}

/** Garante catálogo ativo em memória para enriquecer nomes na Análise de Contagem. */
async function ensureCountProductsCatalogForAudit() {
  if (Array.isArray(countProductsCache) && countProductsCache.length > 0) return;
  await loadCountProducts({ skipCountRender: true });
}

async function loadBreakProducts() {
  const list = document.getElementById('break-products-list');
  if (!list) return;
  await loadCountProducts({ skipCountRender: true });
  await loadServerBreakTotals();
  refreshBreakProductListView();
}

function setBreakFeedback(msg, isError = false) {
  const el = document.getElementById('break-feedback');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? 'var(--error)' : 'var(--accent)';
}

function renderBreakProducts(products) {
  const isActive = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s || s === 'ativo' || s === 's' || s === 'sim' || s === '1' || s === 'true' || s === 'ativado' || s === 'active') return true;
    return false;
  };

  const ativos = Array.isArray(products)
    ? products.filter((p) => isActive(p.status))
    : [];
  ativos.sort(compareAuditCodProduto);

  const ul = document.getElementById('break-products-list');
  const totalSpan = document.getElementById('break-products-total');
  if (!ul) return;

  const subBreak = document.getElementById('sub-break');
  if (subBreak) subBreak.style.display = '';
  showDashboard();
  ul.hidden = false;
  ul.innerHTML = '';
  if (totalSpan) {
    const n = ativos.length;
    totalSpan.textContent = `${n} ${n === 1 ? 'item' : 'itens'}`;
  }
  setBreakFeedback('');

  if (!ativos.length) {
    ul.innerHTML = '<li><span>Nenhum produto ATIVO encontrado para o filtro atual.</span><strong>0</strong></li>';
    updateBreakReadOnlyState();
    return;
  }

  const appendCard = (parentUl, product) => {
    const codRaw = String(product.cod_produto || '');
    const desc = escapeHtml(product.cod_grup_descricao || '');
    const codRef = encodeURIComponent(codRaw);
    const codHtml = codRaw
      ? ` <span class="count-product-cod">· ${escapeHtml(codRaw)}</span>`
      : '';
    const netCx = getNetBreakByProductAndType(codRaw, 'caixa');
    const netUn = getNetBreakByProductAndType(codRaw, 'unidade');
    const vCx = Math.round(Number(netCx) || 0);
    const vUn = Math.round(Number(netUn) || 0);

    const li = document.createElement('li');
    li.className = 'count-product-item break-product-item';
    li.dataset.codProduto = codRaw;
    li.innerHTML = `
      <div class="count-product-label">
        <span class="count-product-title-row">
          <span class="count-product-desc">${desc}${codHtml}</span>
        </span>
      </div>
      <div class="count-product-controls">
        <div class="count-control-row count-control-row--neutral">
          <span class="count-control-type">CX</span>
          <button type="button" class="btn-count-adjust btn-minus" data-coderef="${codRef}" data-count-type="caixa" data-delta="-1" aria-label="Menos caixa">−</button>
          <input type="number" class="count-product-qty" min="0" step="1" inputmode="numeric" autocomplete="off" enterkeyhint="done"
            data-coderef="${codRef}" data-count-type="caixa" value="" aria-label="Quantidade em caixas" />
          <button type="button" class="btn-count-adjust btn-plus" data-coderef="${codRef}" data-count-type="caixa" data-delta="1" aria-label="Mais caixa">+</button>
          <div class="count-control-tail">
            <div class="count-product-readout count-product-readout--by-control break-product-readout" aria-live="polite" title="Total de quebra em caixas neste dia (sincronizado + pendente local)">
              <span class="count-product-readout-inner">
                <strong class="count-product-readout-value">${formatBreakIntegerBR(vCx)}</strong>
              </span>
            </div>
          </div>
        </div>
        <div class="count-control-row count-control-row--neutral">
          <span class="count-control-type">UN</span>
          <button type="button" class="btn-count-adjust btn-minus" data-coderef="${codRef}" data-count-type="unidade" data-delta="-1" aria-label="Menos unidade">−</button>
          <input type="number" class="count-product-qty" min="0" step="1" inputmode="numeric" autocomplete="off" enterkeyhint="done"
            data-coderef="${codRef}" data-count-type="unidade" value="" aria-label="Quantidade em unidades" />
          <button type="button" class="btn-count-adjust btn-plus" data-coderef="${codRef}" data-count-type="unidade" data-delta="1" aria-label="Mais unidade">+</button>
          <div class="count-control-tail">
            <div class="count-product-readout count-product-readout--by-control break-product-readout" aria-live="polite" title="Total de quebra em unidades neste dia (sincronizado + pendente local)">
              <span class="count-product-readout-inner">
                <strong class="count-product-readout-value">${formatBreakIntegerBR(vUn)}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
    parentUl.appendChild(li);
  };

  for (const product of ativos) appendCard(ul, product);
  updateBreakReadOnlyState();
}

function updateBreakReadOnlyState() {
  const shell = document.getElementById('break-products-shell');
  const editable = isBreakOperationalEditable();
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
  const banner = document.getElementById('break-readonly-banner');
  if (banner) {
    const show = !editable;
    banner.hidden = !show;
    banner.textContent = show
      ? `Modo consulta (${getActiveBreakDateKey()}). Para lançar, use a data de hoje (${getBrazilDateKey()}).`
      : '';
  }
}

function refreshBreakProductListView() {
  const input = document.getElementById('break-item-code');
  const term = (input && input.value || '').trim();
  const scoped = filterBreakCatalogByScope(countProductsCache, getSelectedBreakScope());
  const toShow = term ? filterCountProductsByTerm(term, scoped) : scoped;
  renderBreakProducts(toShow);
  filtrarProdutosQuebra();
}

function applyBreakRowOperation(codRefEnc, countTypeRaw, inp, direction) {
  const opQty = parseOperationQtyFromInputEl(inp);
  if (opQty == null) {
    setBreakFeedback('Digite uma quantidade maior que zero para aplicar com + ou −.', true);
    return;
  }
  const refDecoded = decodeURIComponent(String(codRefEnc || ''));
  const itemCode = normalizeItemCode(refDecoded);
  const ct = normalizeCountType(countTypeRaw || 'caixa');
  const current = getNetBreakByProductAndType(itemCode, ct);
  let delta;
  if (direction > 0) {
    delta = opQty;
  } else {
    delta = -Math.min(opQty, Math.max(0, current));
  }
  if (delta === 0) {
    if (inp) inp.value = '';
    refreshBreakProductListView();
    return;
  }
  registerBreakDelta(itemCode, delta, ct);
  if (inp) inp.value = '';
}

function registerBreakDelta(itemCodeInput, qtyDeltaInput, countTypeInput = 'caixa') {
  if (!isBreakOperationalEditable()) {
    setBreakFeedback('Só é possível lançar quebra na data de hoje (America/Sao_Paulo).', true);
    return;
  }
  const itemCode = normalizeItemCode(itemCodeInput);
  const quantity = Number(qtyDeltaInput);
  const countType = normalizeCountType(countTypeInput);

  if (!itemCode) {
    setBreakFeedback('Informe o item para registrar.', true);
    return;
  }

  if (!Number.isInteger(quantity) || quantity === 0) {
    setBreakFeedback('Informe uma quantidade inteira diferente de zero.', true);
    return;
  }

  const dayKey = getActiveBreakDateKey();
  const events = loadBreakEventsForDate(dayKey);
  const event = {
    client_event_id: makeEventId(),
    item_code: itemCode,
    count_type: countType,
    quantity,
    observed_at: new Date().toISOString(),
    synced: false,
    device_name: getDeviceName(),
    operational_date: dayKey,
    reason: null,
  };

  events.push(event);
  saveBreakEventsForDate(dayKey, events);

  let productName = itemCode;
  if (Array.isArray(countProductsCache)) {
    const found = countProductsCache.find(
      (p) => normalizeItemCode(p.cod_produto || '') === itemCode
        || normalizeItemCode(p.cod_grup_descricao || '') === itemCode,
    );
    if (found && found.cod_grup_descricao) {
      productName = found.cod_grup_descricao.trim();
    }
  }

  const countTypeLabel = countType === 'unidade' ? 'Unidade' : 'Caixa';
  const netCx = Math.round(Number(getNetBreakByProductAndType(itemCode, 'caixa')) || 0);
  const netUn = Math.round(Number(getNetBreakByProductAndType(itemCode, 'unidade')) || 0);
  const deltaStr =
    quantity < 0 ? formatSignedIntegerBR(quantity) : formatBreakIntegerBR(quantity);
  setBreakFeedback(
    `${productName}: ${deltaStr} ${countTypeLabel === 'Caixa' ? 'CX' : 'UN'} · Total quebra ${formatBreakIntegerBR(netCx)} CX e ${formatBreakIntegerBR(netUn)} UN`,
    false,
  );

  const lastLaunch = document.getElementById('break-last-launch');
  if (lastLaunch) {
    lastLaunch.hidden = false;
    lastLaunch.innerHTML =
      `<span class="count-last-launch-kicker">Último lançamento</span>` +
      `<span class="count-last-launch-body">` +
      `<strong class="count-last-launch-name">${escapeHtml(productName)}</strong> ` +
      `<span class="count-last-launch-delta">(${deltaStr} ${countTypeLabel === 'Caixa' ? 'CX' : 'UN'})</span>` +
      ` · Total no dia: <strong>${formatBreakIntegerBR(netCx)} CX</strong> · <strong>${formatBreakIntegerBR(netUn)} UN</strong>` +
      `</span>`;
  }

  if (navigator.onLine) {
    syncPendingBreakEvents();
  }
}

async function syncPendingBreakEvents() {
  if (breakSyncInProgress) return;

  const token = getToken();
  if (!token) return;
  if (!navigator.onLine) return;

  const allEv = flattenAllBreakEventsFromBucket();
  const pending = allEv.filter((event) => !event.synced);
  if (pending.length === 0) return;

  breakSyncInProgress = true;

  try {
    const response = await apiFetch(API_SYNC_BREAKS, {
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
          operational_date: event.operational_date || getActiveBreakDateKey(),
          reason: event.reason || null,
        })),
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        setBreakFeedback('Sessão expirada. Continue offline e faça login depois para sincronizar.', true);
      } else {
        setBreakFeedback('Falha ao sincronizar quebras. Os dados continuam salvos localmente.', true);
      }
      return;
    }

    const data = await response.json();
    const syncedIds = new Set(data.synced_ids || []);
    markBreakEventsSyncedInBucket(syncedIds);
    setBreakFeedback(`Sincronização: ${syncedIds.size} evento(s) enviado(s).`);
    await loadServerBreakTotals();
    refreshBreakProductListView();
  } catch {
    setBreakFeedback('Sem conexão no momento. Quebra continua salva neste aparelho.', true);
  } finally {
    breakSyncInProgress = false;
  }
}

function bindBreakEvents() {
  restoreBreakScopeFromStorage();

  const form = document.getElementById('break-op-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const itemCode = document.getElementById('break-item-code')?.value;
      if (!itemCode || !String(itemCode).trim()) {
        setBreakFeedback('Use a busca para localizar o produto e aplique a quantidade nas linhas CX/UN.', true);
        return;
      }
      document.getElementById('break-item-code')?.focus();
    });
  }

  document.querySelectorAll('input[name="break-scope"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      try {
        localStorage.setItem(BREAK_SCOPE_STORAGE_KEY, radio.value);
      } catch {
        /* ignore */
      }
      refreshBreakProductListView();
    });
  });

  const itemCodeInput = document.getElementById('break-item-code');
  if (itemCodeInput) {
    itemCodeInput.addEventListener('input', () => {
      refreshBreakProductListView();
    });
  }

  const breakHistoryDate = document.getElementById('break-history-date');
  const btnBreakHistoryRefresh = document.getElementById('btn-break-history-refresh');
  if (breakHistoryDate) {
    breakHistoryDate.addEventListener('change', () => {
      loadBreakHistoryList();
    });
  }
  if (btnBreakHistoryRefresh) {
    btnBreakHistoryRefresh.addEventListener('click', () => {
      loadBreakHistoryList();
    });
  }

  const breakShell = document.getElementById('break-products-shell');
  if (breakShell && breakShell.dataset.breakDelegates !== '1') {
    breakShell.dataset.breakDelegates = '1';
    const refreshAfter = () => {
      refreshBreakProductListView();
    };
    breakShell.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-count-adjust');
      if (!btn || !breakShell.contains(btn)) return;
      e.preventDefault();
      const codRefEnc = btn.getAttribute('data-coderef') || '';
      const rawDelta = btn.getAttribute('data-delta');
      const deltaBtn = rawDelta === '1' ? 1 : rawDelta === '-1' ? -1 : NaN;
      const countType = btn.dataset.countType || 'caixa';
      if (!codRefEnc || !Number.isFinite(deltaBtn)) return;
      if (deltaBtn !== 1 && deltaBtn !== -1) return;
      const row = btn.closest('.count-control-row');
      const inp = row ? row.querySelector('input.count-product-qty') : null;
      applyBreakRowOperation(codRefEnc, countType, inp, deltaBtn);
      if (inp && typeof inp.focus === 'function') inp.focus({ preventScroll: true });
      refreshAfter();
    });
    breakShell.addEventListener('focusout', (e) => {
      const inp = e.target;
      if (!inp || !inp.classList || !inp.classList.contains('count-product-qty')) return;
      if (!breakShell.contains(inp)) return;
      const next = e.relatedTarget;
      if (next && typeof next.closest === 'function' && next.closest('.btn-count-adjust') && breakShell.contains(next)) {
        return;
      }
      const hadOpQty = parseOperationQtyFromInputEl(inp) != null;
      if (!hadOpQty) {
        refreshAfter();
      }
      // Sem aplicar ao sair do campo: blur não dispara + (evita envio “sozinho” e permite usar − com valor digitado).
    });
    breakShell.addEventListener('keydown', (e) => {
      const inp = e.target;
      if (!inp.classList?.contains('count-product-qty')) return;
      const isEnter = e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13;
      if (!isEnter) return;
      e.preventDefault();
      e.stopPropagation();
      const row = inp.closest('.count-control-row');
      const plusBtn = row?.querySelector('.btn-count-adjust.btn-plus');
      if (plusBtn && !plusBtn.disabled) plusBtn.click();
    });
    breakShell.addEventListener(
      'wheel',
      (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('count-product-qty')) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }
}

function filtrarProdutosQuebra() {
  const grupo = (document.getElementById('break-group')?.value || '').trim().toLowerCase();
  let totalVisiveis = 0;
  document.querySelectorAll('#break-products-shell .count-product-item').forEach((item) => {
    let show = true;
    if (item.classList.contains('is-inactive')) show = false;
    if (grupo) {
      const desc = item.querySelector('.count-product-desc')?.textContent?.toLowerCase() || '';
      show = show && desc.includes(grupo);
    }
    item.style.display = show ? '' : 'none';
    if (show) totalVisiveis += 1;
  });
  const totalSpan = document.getElementById('break-products-total');
  if (totalSpan) {
    totalSpan.textContent = `${totalVisiveis} ${totalVisiveis === 1 ? 'item' : 'itens'}`;
  }
}

async function loadBreakHistoryList() {
  const list = document.getElementById('break-history-list');
  const chip = document.getElementById('break-history-count-chip');
  const feedback = document.getElementById('break-history-feedback');
  const dateEl = document.getElementById('break-history-date');
  const metaDate = document.getElementById('break-history-meta-date');
  const metaCount = document.getElementById('break-history-meta-count');
  const rangeInfo = document.getElementById('break-history-range-info');
  if (!list) return;

  const token = getToken();
  if (!token) return;

  const d = (dateEl && dateEl.value) || getBrazilDateKey();
  let dayLabel = d;
  try {
    dayLabel = new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
  } catch {
    dayLabel = d;
  }
  if (metaDate) metaDate.textContent = dayLabel;

  const setBreakHistoryFeedback = (visible, message, isError) => {
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.style.display = visible ? '' : 'none';
    feedback.classList.toggle('is-error', !!(visible && isError));
    feedback.classList.toggle('is-info', !!(visible && !isError));
  };

  setBreakHistoryFeedback(true, 'Carregando...', false);

  try {
    const params = new URLSearchParams();
    params.set('operational_date', d);
    const response = await apiFetch(`${API_SYNC_BREAKS}?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) {
      setBreakHistoryFeedback(false, '', false);
      return;
    }
    if (!response.ok) {
      setBreakHistoryFeedback(true, 'Não foi possível carregar o registro.', true);
      if (metaCount) metaCount.textContent = '—';
      if (rangeInfo) rangeInfo.textContent = 'Falha ao carregar. Tente novamente.';
      return;
    }
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];
    list.innerHTML = '';
    setBreakHistoryFeedback(false, '', false);

    if (metaCount) metaCount.textContent = `${events.length}`;
    if (rangeInfo) {
      rangeInfo.textContent = events.length
        ? `${events.length} produto(s) com lançamento de quebra neste dia.`
        : 'Nenhum lançamento para este dia.';
    }
    if (chip) chip.textContent = `${events.length}`;

    if (!events.length) {
      list.innerHTML = '<li class="count-audit-empty"><span>Nenhuma quebra registrada neste dia.</span><strong>—</strong></li>';
      return;
    }

    for (const ev of events) {
      const codRaw = String(ev.cod_produto || '');
      const cod = escapeHtml(codRaw);
      const descRaw = String(ev.product_desc || '').trim();
      const descEsc = escapeHtml(descRaw);
      const nameHtml = descRaw ? descEsc : cod;
      const { cx, un } = parseAuditBreakCxUn(ev);
      const actor = ev.actor ? escapeHtml(String(ev.actor)) : '—';
      const li = document.createElement('li');
      li.className = 'count-audit-item break-history-item';
      li.setAttribute('data-state', 'ok');
      li.innerHTML =
        `<div class="break-history-audit-row">` +
        `<div class="count-audit-cell count-audit-cell--product">` +
        `<div class="break-history-product-static">` +
        `<div class="count-audit-row-topline">` +
        `<span class="count-audit-code-badge">${cod}</span>` +
        `</div>` +
        `<span class="count-audit-row-name">${nameHtml}</span>` +
        `</div></div>` +
        `<div class="count-audit-cell">` +
        `<span class="count-audit-cell-label">Dia</span>` +
        `<strong class="count-audit-cell-value">${escapeHtml(dayLabel)}</strong>` +
        `</div>` +
        `<div class="count-audit-cell">` +
        `<span class="count-audit-cell-label">Quebra</span>` +
        `<div class="count-audit-diff-breakdown count-audit-diff-breakdown--break" title="Total de quebra no dia operacional (mesma lógica da tela Quebra)">` +
        `<strong class="count-audit-diff-cx">CX ${formatBreakIntegerBR(cx)}</strong>` +
        `<strong class="count-audit-diff-un">UN ${formatBreakIntegerBR(un)}</strong>` +
        `</div></div>` +
        `<div class="count-audit-cell">` +
        `<span class="count-audit-cell-label">Nome</span>` +
        `<span class="count-audit-cell-value">${actor}</span>` +
        `</div>` +
        `</div>`;
      list.appendChild(li);
    }
  } catch {
    setBreakHistoryFeedback(true, 'Sem conexão.', true);
    if (metaCount) metaCount.textContent = '—';
    if (rangeInfo) rangeInfo.textContent = 'Verifique a rede e tente de novo.';
  }
}

function normalizeMateTrocaCxUnMap(raw) {
  const norm = {};
  if (!raw || typeof raw !== 'object') return norm;
  for (const k of Object.keys(raw)) {
    const c = normalizeNumericProductCodeKey(k);
    if (!c) continue;
    const v = raw[k];
    norm[c] = {
      cx: Math.max(0, Math.round(Number(v?.cx) || 0)),
      un: Math.max(0, Math.round(Number(v?.un) || 0)),
    };
  }
  return norm;
}

function ensureMateTrocaAcumuladoRangeDefaults() {
  const fromEl = document.getElementById('mate-couro-troca-acum-from');
  const toEl = document.getElementById('mate-couro-troca-acum-to');
  const dayEl = document.getElementById('mate-couro-troca-date');
  if (!fromEl || !toEl) return;
  const bounds = getBrazilMonthBoundsDateKeys();
  const dayVal = (dayEl && dayEl.value && String(dayEl.value).trim()) || getBrazilDateKey();
  if (!String(toEl.value || '').trim()) toEl.value = String(dayVal).slice(0, 10);
  if (!String(fromEl.value || '').trim()) fromEl.value = bounds.first;
}

function hydrateMateTrocaBaseV2LastValidFromDiskOnce() {
  if (mateTrocaBaseV2LastValidHydrated) return;
  mateTrocaBaseV2LastValidHydrated = true;
  try {
    const raw = localStorage.getItem(MATE_TROCA_BASE_V2_LAST_VALID_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return;
    const next = {};
    for (const [k, v] of Object.entries(o)) {
      const ck = normalizeNumericProductCodeKey(k);
      if (!ck || !v || typeof v !== 'object') continue;
      next[ck] = {
        cod: ck,
        desc: String(v.desc || ''),
        cx: Math.max(0, Math.round(Number(v.cx) || 0)),
        un: Math.max(0, Math.round(Number(v.un) || 0)),
        balanceOrigin: String(v.balanceOrigin || 'preserved'),
        updatedAt: Math.max(0, Number(v.updatedAt) || 0),
        saldoKnown: v.saldoKnown !== false,
        explicitZero: !!v.explicitZero,
      };
    }
    mateTrocaBaseLastValidStateV2 = next;
  } catch {
    /* ignore */
  }
}

function persistMateTrocaBaseV2LastValidToDisk() {
  try {
    localStorage.setItem(MATE_TROCA_BASE_V2_LAST_VALID_KEY, JSON.stringify(mateTrocaBaseLastValidStateV2));
  } catch {
    /* ignore */
  }
}

async function fetchMateTrocaBaseV2() {
  const token = getToken();
  const fail = { ok: false, discovery_codes: [], balances: {}, raw: null };
  if (!token) return fail;
  try {
    ensureMateTrocaAcumuladoRangeDefaults();
    const params = new URLSearchParams();
    const fromEl = document.getElementById('mate-couro-troca-acum-from');
    const toEl = document.getElementById('mate-couro-troca-acum-to');
    const d0 = String((fromEl && fromEl.value) || '').trim().slice(0, 10);
    const d1 = String((toEl && toEl.value) || '').trim().slice(0, 10);
    if (d0 && d1) {
      params.set('date_from', d0);
      params.set('date_to', d1);
    }
    const qs = params.toString();
    const url = qs ? `${API_MATE_TROCA_BASE_V2}?${qs}` : API_MATE_TROCA_BASE_V2;
    const response = await apiFetch(url, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return fail;
    if (!response.ok) return fail;
    const data = await response.json();
    const rawList = data.discovery_codes;
    const discovery_codes = Array.isArray(rawList) ? rawList.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const balances = {};
    const rawBal = data.balances;
    if (rawBal && typeof rawBal === 'object') {
      for (const [k, v] of Object.entries(rawBal)) {
        const ck = normalizeNumericProductCodeKey(k);
        if (!ck) continue;
        const cxRaw = Number(v?.cx);
        const unRaw = Number(v?.un);
        const cx = Number.isFinite(cxRaw) ? Math.max(0, Math.round(cxRaw)) : 0;
        const un = Number.isFinite(unRaw) ? Math.max(0, Math.round(unRaw)) : 0;
        balances[ck] = { cx, un };
      }
    }
    return {
      ok: true,
      discovery_codes,
      balances,
      period_from: data.period_from,
      period_to: data.period_to,
      raw: data,
    };
  } catch {
    return fail;
  }
}

function composeMateTrocaBaseBalanceRowsV2(
  serverBalances,
  lastValidMap,
  discoverySet,
  catalog,
  searchTerm,
  flags,
) {
  const fetchFailed = !!(flags && flags.fetchFailed);
  const codeSet = new Set();
  if (serverBalances && typeof serverBalances === 'object') {
    for (const k of Object.keys(serverBalances)) {
      const ck = normalizeNumericProductCodeKey(k);
      if (ck) codeSet.add(ck);
    }
  }
  if (discoverySet instanceof Set) {
    for (const c of discoverySet) {
      const ck = normalizeNumericProductCodeKey(String(c || ''));
      if (ck) codeSet.add(ck);
    }
  }
  if (lastValidMap && typeof lastValidMap === 'object') {
    for (const k of Object.keys(lastValidMap)) {
      const ck = normalizeNumericProductCodeKey(k);
      if (ck) codeSet.add(ck);
    }
  }
  const term = (searchTerm || '').trim().toLowerCase();
  const rows = [];
  for (const cod of codeSet) {
    const hasServer =
      serverBalances &&
      typeof serverBalances === 'object' &&
      Object.prototype.hasOwnProperty.call(serverBalances, cod);
    let cx = null;
    let un = null;
    let saldoKnown = false;
    let balanceOrigin = 'unknown';

    if (hasServer) {
      const b = serverBalances[cod];
      cx = Math.max(0, Math.round(Number(b?.cx) || 0));
      un = Math.max(0, Math.round(Number(b?.un) || 0));
      saldoKnown = true;
      balanceOrigin = 'server_v2';
    } else if (lastValidMap && lastValidMap[cod] && lastValidMap[cod].saldoKnown !== false) {
      if (fetchFailed || !hasServer) {
        const lv = lastValidMap[cod];
        cx = Math.max(0, Math.round(Number(lv.cx) || 0));
        un = Math.max(0, Math.round(Number(lv.un) || 0));
        saldoKnown = true;
        balanceOrigin = fetchFailed ? 'preserved_fetch_failed' : 'preserved';
      }
    }

    if (!saldoKnown) {
      cx = null;
      un = null;
      balanceOrigin = 'unknown';
    }

    const p = (catalog || []).find(
      (x) => normalizeNumericProductCodeKey(String(x.cod_produto || '')) === cod,
    );
    const desc = p ? String(p.cod_grup_descricao || '').trim() : (lastValidMap[cod]?.desc || '');
    if (term) {
      const ok =
        cod.toLowerCase().includes(term) || String(desc || '').toLowerCase().includes(term);
      if (!ok) continue;
    }
    const explicitZero = saldoKnown && cx === 0 && un === 0 && balanceOrigin === 'server_v2';
    rows.push({
      cod,
      desc,
      cx,
      un,
      saldoKnown,
      balanceOrigin,
      explicitZero,
    });
  }
  rows.sort((a, b) => compareAuditCodProduto({ cod_produto: a.cod }, { cod_produto: b.cod }));
  return rows;
}

function renderMateTrocaBaseBalanceCardV2(mergedRows) {
  const ul = document.getElementById('mate-couro-troca-balance-list-v2');
  const countEl = document.getElementById('mate-couro-troca-balance-v2-count');
  const rangeEl = document.getElementById('mate-couro-troca-balance-v2-range');
  if (!ul) return;
  console.log('[MATE TROCA V2] render final', mergedRows);
  if (countEl) {
    countEl.textContent = mergedRows.length ? `${mergedRows.length} produto(s)` : '0 produtos';
  }
  const fromEl = document.getElementById('mate-couro-troca-acum-from');
  const toEl = document.getElementById('mate-couro-troca-acum-to');
  if (rangeEl) {
    const dr =
      fromEl && toEl && fromEl.value && toEl.value
        ? `${formatDateBR(fromEl.value)} – ${formatDateBR(toEl.value)}`
        : '';
    rangeEl.textContent = dr ? `Período lista: ${dr}` : '';
  }
  ul.innerHTML = '';
  if (!mergedRows.length) {
    ul.innerHTML =
      '<li class="count-audit-empty"><span>Sem itens no período ou busca. Ajuste <strong>De</strong>/<strong>Até</strong>, <strong>Atualizar lista</strong> ou <strong>Carregar</strong> o dia.</span><strong>—</strong></li>';
    return;
  }
  for (const r of mergedRows) {
    const codEsc = escapeHtml(r.cod);
    const nameEsc = escapeHtml(r.desc || r.cod);
    const codRef = encodeURIComponent(r.cod);
    const saldoHtml = r.saldoKnown
      ? `<strong class="count-audit-diff-cx">CX ${formatBreakIntegerBR(r.cx)}</strong>` +
        `<strong class="count-audit-diff-un">UN ${formatBreakIntegerBR(r.un)}</strong>`
      : `<span class="mate-troca-balance-v2-unknown" title="Saldo ainda não confirmado no servidor nesta sessão">CX — · UN —</span>`;
    const li = document.createElement('li');
    li.className = 'count-audit-item mate-couro-pending-item mate-troca-balance-v2-item';
    li.setAttribute('data-state', 'ok');
    li.setAttribute('data-mate-pending-cod', r.cod);
    li.setAttribute('data-mate-balance-known', r.saldoKnown ? '1' : '0');
    li.innerHTML =
      `<div class="mate-couro-pending-audit-row mate-couro-pending-audit-row--clickable mate-troca-balance-v2-row" role="presentation">` +
      `<div class="count-audit-cell count-audit-cell--product">` +
      `<div class="break-history-product-static">` +
      `<div class="count-audit-row-topline"><span class="count-audit-code-badge">${codEsc}</span></div>` +
      `<span class="count-audit-row-name">${nameEsc}</span>` +
      `</div></div>` +
      `<div class="count-audit-cell mate-couro-pending-saldo-cell">` +
      `<span class="count-audit-cell-label">Saldo acumulado</span>` +
      `<div class="count-audit-diff-breakdown count-audit-diff-breakdown--break mate-couro-pending-break-acc mate-troca-balance-v2-saldo">${saldoHtml}</div>` +
      `</div>` +
      `<div class="count-audit-cell mate-couro-pending-actions">` +
      `<button type="button" class="mate-troca-pend-btn mate-troca-pend-btn--primary" data-mate-pend-v2="recebeu" data-coderef="${codRef}" aria-label="Registrar chegada" title="Registrar chegada">Chegada</button>` +
      `<button type="button" class="mate-troca-pend-btn mate-troca-pend-btn--outline" data-mate-pend-v2="definir" data-coderef="${codRef}" aria-label="Definir saldo pendente" title="Definir saldo pendente">Saldo</button>` +
      `<button type="button" class="mate-troca-pend-btn mate-troca-pend-btn--muted" data-mate-pend-v2="zerar" data-coderef="${codRef}" aria-label="Zerar saldo pendente" title="Zerar saldo pendente">Zerar</button>` +
      `</div>` +
      `</div>`;
    ul.appendChild(li);
  }
}

function renderMateTrocaBaseBalanceCardV2FromCache() {
  hydrateMateTrocaBaseV2LastValidFromDiskOnce();
  const searchEl = document.getElementById('mate-couro-troca-pending-search');
  const term = ((searchEl && searchEl.value) || '').trim().toLowerCase();
  const mergedRows = composeMateTrocaBaseBalanceRowsV2(
    mateTrocaBaseBalanceCacheV2,
    mateTrocaBaseLastValidStateV2,
    mateTrocaBaseDiscoveryCodesV2,
    mateCouroProductsCache,
    term,
    { fetchFailed: false },
  );
  mateTrocaBaseV2LastMergedRows = mergedRows;
  console.log('[MATE TROCA V2] merged rows (cache)', mergedRows);
  renderMateTrocaBaseBalanceCardV2(mergedRows);
  updateMateCouroKpis();
}

async function refreshMateTrocaBaseBalanceCardV2() {
  hydrateMateTrocaBaseV2LastValidFromDiskOnce();
  const payload = await fetchMateTrocaBaseV2();
  console.log('[MATE TROCA V2] payload bruto', payload.raw != null ? payload.raw : payload);
  console.log('[MATE TROCA V2] last valid state (antes merge)', { ...mateTrocaBaseLastValidStateV2 });

  const searchEl = document.getElementById('mate-couro-troca-pending-search');
  const term = ((searchEl && searchEl.value) || '').trim().toLowerCase();

  if (payload.ok) {
    mateTrocaBaseDiscoveryCodesV2 = new Set();
    for (const c of payload.discovery_codes) {
      const ck = normalizeNumericProductCodeKey(c);
      if (ck) mateTrocaBaseDiscoveryCodesV2.add(ck);
    }
    mateTrocaBaseBalanceCacheV2 = { ...payload.balances };
    mateTrocaDiscoveryCodesCache = new Set(mateTrocaBaseDiscoveryCodesV2);

    const catalog = mateCouroProductsCache || [];
    for (const [ck, b] of Object.entries(payload.balances)) {
      const p = catalog.find(
        (x) => normalizeNumericProductCodeKey(String(x.cod_produto || '')) === ck,
      );
      const desc = p ? String(p.cod_grup_descricao || '').trim() : '';
      mateTrocaBaseLastValidStateV2[ck] = {
        cod: ck,
        desc,
        cx: b.cx,
        un: b.un,
        balanceOrigin: 'server_v2',
        updatedAt: Date.now(),
        saldoKnown: true,
        explicitZero: b.cx === 0 && b.un === 0,
      };
    }
    persistMateTrocaBaseV2LastValidToDisk();

    mateTrocaServerPendingCache = { ...payload.balances };
    countAuditState.mateTrocaServerPending = { ...mateTrocaServerPendingCache };
    mirrorMateTrocaPendingToLocalStorage(mateTrocaServerPendingCache);
  }

  const serverPatch = payload.ok ? payload.balances : {};
  const mergedRows = composeMateTrocaBaseBalanceRowsV2(
    serverPatch,
    mateTrocaBaseLastValidStateV2,
    mateTrocaBaseDiscoveryCodesV2,
    mateCouroProductsCache,
    term,
    { fetchFailed: !payload.ok },
  );
  mateTrocaBaseV2LastMergedRows = mergedRows;
  console.log('[MATE TROCA V2] merged rows', mergedRows);
  renderMateTrocaBaseBalanceCardV2(mergedRows);
  updateMateCouroKpis();
  return mateTrocaServerPendingCache;
}

async function fetchMateTrocaPendingByProductMap() {
  const r = await fetchMateTrocaBaseV2();
  if (r.ok) return { ...r.balances };
  return mateTrocaBaseBalanceCacheV2 && Object.keys(mateTrocaBaseBalanceCacheV2).length
    ? { ...mateTrocaBaseBalanceCacheV2 }
    : {};
}

/** Atualiza caches da Base de Troca (card V2 + espelhos para análise de contagem). */
async function refreshMateTrocaBaseScreenData() {
  await refreshMateTrocaBaseBalanceCardV2();
  return mateTrocaServerPendingCache;
}

/** Saldo “antes” para POST Mate troca — prioriza cache V2 do último GET ok, senão último estado válido. */
function getMateTrocaV2CurForPayload(cod) {
  const ck = normalizeNumericProductCodeKey(cod) || normalizeItemCode(String(cod || ''));
  if (!ck) return { cx: 0, un: 0 };
  if (mateTrocaBaseBalanceCacheV2[ck] !== undefined) {
    const b = mateTrocaBaseBalanceCacheV2[ck];
    return { cx: Math.max(0, Math.round(Number(b.cx) || 0)), un: Math.max(0, Math.round(Number(b.un) || 0)) };
  }
  const lv = mateTrocaBaseLastValidStateV2[ck];
  if (lv && lv.saldoKnown) {
    return { cx: Math.max(0, Math.round(Number(lv.cx) || 0)), un: Math.max(0, Math.round(Number(lv.un) || 0)) };
  }
  return { cx: 0, un: 0 };
}

function mateTrocaV2SaldoKnownForCod(cod) {
  const ck = normalizeNumericProductCodeKey(cod) || normalizeItemCode(String(cod || ''));
  if (!ck) return false;
  if (mateTrocaBaseBalanceCacheV2[ck] !== undefined) return true;
  const lv = mateTrocaBaseLastValidStateV2[ck];
  return !!(lv && lv.saldoKnown);
}

/**
 * Espelha o pendente do servidor no localStorage (histórico/offline parcial).
 * A API só devolve produtos com saldo > 0; um mapa vazio não significa “apagar tudo no aparelho”.
 * Só removemos chaves que já tinham sido confirmadas no servidor e sumiram da resposta (ex.: Zerar).
 * Pendente só local (nunca veio no servidor) permanece até sincronizar ou limpar manualmente.
 */
function mirrorMateTrocaPendingToLocalStorage(serverMap) {
  const state = readMateCouroTrocaStorage();
  const sm = serverMap && typeof serverMap === 'object' ? serverMap : {};
  const incomingKeys = new Set();
  for (const k of Object.keys(sm)) {
    const ck = normalizeNumericProductCodeKey(k);
    if (ck) incomingKeys.add(ck);
  }
  const prevMirrored = state.serverMirroredPendingKeys;
  const prevSet = new Set(Array.isArray(prevMirrored) ? prevMirrored.map((x) => String(x || '').trim()).filter(Boolean) : []);
  for (const ck of prevSet) {
    if (!incomingKeys.has(ck)) {
      delete state.pending[ck];
    }
  }
  for (const [k, v] of Object.entries(sm)) {
    const ck = normalizeNumericProductCodeKey(k);
    if (!ck) continue;
    const cx = Math.max(0, Math.round(Number(v?.cx) || 0));
    const un = Math.max(0, Math.round(Number(v?.un) || 0));
    if (cx || un) state.pending[ck] = { cx, un };
    else delete state.pending[ck];
  }
  state.serverMirroredPendingKeys = Array.from(incomingKeys);
  writeMateCouroTrocaStorage(state);
}

function updateMateTrocaReconcileFromBreaksButton() {
  const btn = document.getElementById('btn-mate-couro-reconcile-from-breaks');
  if (!btn) return;
  btn.hidden = !['administrativo', 'admin'].includes(currentRole);
}

/** Administrativo/Admin: POST soma das quebras no intervalo → evento definir no servidor. */
async function runMateTrocaReconcileFromBreaks() {
  const token = getToken();
  if (!token) {
    window.alert('Faça login.');
    return;
  }
  const rawCod = window.prompt('Código do produto (Mate couro):', '10');
  if (rawCod == null) return;
  const cod = normalizeNumericProductCodeKey(rawCod) || normalizeItemCode(rawCod);
  if (!cod) {
    window.alert('Código inválido.');
    return;
  }
  const defDay = getBrazilDateKey();
  const d0 = window.prompt('Data inicial das quebras (AAAA-MM-DD):', defDay);
  if (d0 == null) return;
  const d0c = String(d0).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d0c)) {
    window.alert('Data inicial inválida.');
    return;
  }
  const d1 = window.prompt('Data final (AAAA-MM-DD), inclusive:', d0c);
  if (d1 == null) return;
  const d1c = String(d1).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d1c)) {
    window.alert('Data final inválida.');
    return;
  }
  if (
    !window.confirm(
      `Definir o pendente do código ${cod} como a SOMA das quebras de ${d0c} a ${d1c}?\n\n` +
        `Isso não desconta chegadas já registradas na Base de Troca — use para corrigir pendente incoerente com as quebras.\n\n` +
        `Grava um evento "definir" no servidor para todos os usuários.`,
    )
  ) {
    return;
  }
  try {
    const response = await apiFetch(API_MATE_TROCA_RECONCILE_FROM_BREAKS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cod_produto: cod,
        date_from: d0c,
        date_to: d1c,
      }),
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      let msg = 'Não foi possível repor o pendente.';
      try {
        const err = await response.json();
        if (typeof err.detail === 'string') msg = err.detail;
      } catch {
        /* ignore */
      }
      window.alert(msg);
      return;
    }
    const data = await response.json();
    const tgt = data.pending_target_from_breaks || {};
    window.alert(
      data.skipped
        ? data.message || 'Já estava correto.'
        : `Pronto. Pendente definido: CX ${formatBreakIntegerBR(Number(tgt.cx) || 0)} · UN ${formatBreakIntegerBR(Number(tgt.un) || 0)}.`,
    );
    await refreshMateTrocaBaseBalanceCardV2();
  } catch {
    window.alert('Sem conexão.');
  }
}

/**
 * Id da incorporação ao Carregar dia: inclui geração global (Limpar snapshots) e revisão por código
 * (Zerar pendente daquele produto) para permitir reenviar o mesmo delta após zerar — o servidor ignora
 * client_event_id duplicado, sem isso o Carregar não refaz o lançamento.
 */
function mateTrocaIncorporacaoClientEventId(dayKey, codBase, dcx, dun) {
  const st = readMateCouroTrocaStorage();
  const gen = Math.max(0, Math.round(Number(st.incorpGen) || 0));
  const b =
    normalizeNumericProductCodeKey(codBase) || normalizeItemCode(String(codBase || '')) || String(codBase || '').trim();
  const revMap = st.incorpRevByCod && typeof st.incorpRevByCod === 'object' ? st.incorpRevByCod : {};
  const rev = Math.max(0, Math.round(Number(revMap[b]) || 0));
  const d = String(dayKey || '').slice(0, 10);
  const x = String(Math.round(Number(dcx) || 0));
  const u = String(Math.round(Number(dun) || 0));
  return `incorp-v1|g${gen}|r${rev}|${d}|${b}|${x}|${u}`;
}

function bumpMateTrocaIncorpRevForCod(cod) {
  const ck = normalizeNumericProductCodeKey(cod) || normalizeItemCode(String(cod || ''));
  if (!ck) return;
  const st = readMateCouroTrocaStorage();
  if (!st.incorpRevByCod || typeof st.incorpRevByCod !== 'object') st.incorpRevByCod = {};
  st.incorpRevByCod[ck] = Math.max(0, Math.round(Number(st.incorpRevByCod[ck]) || 0)) + 1;
  writeMateCouroTrocaStorage(st);
}

function readMateCouroTrocaStorage() {
  try {
    let raw = localStorage.getItem(MATE_COURO_TROCA_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(MATE_COURO_TROCA_STORAGE_PREV_KEY);
    if (!raw) raw = localStorage.getItem(MATE_COURO_TROCA_STORAGE_LEGACY_KEY);
    if (!raw) {
      return {
        pending: {},
        daySnapshots: {},
        eventLog: [],
        incorpGen: 0,
        incorpRevByCod: {},
        serverMirroredPendingKeys: [],
      };
    }
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') {
      return {
        pending: {},
        daySnapshots: {},
        eventLog: [],
        incorpGen: 0,
        incorpRevByCod: {},
        serverMirroredPendingKeys: [],
      };
    }
    const eventLog = Array.isArray(o.eventLog)
      ? o.eventLog.filter((e) => e && typeof e === 'object')
      : [];
    const incorpGen = Math.max(0, Math.round(Number(o.incorpGen) || 0));
    const incorpRevByCod = {};
    if (o.incorpRevByCod && typeof o.incorpRevByCod === 'object') {
      for (const [k, v] of Object.entries(o.incorpRevByCod)) {
        const ck = normalizeNumericProductCodeKey(k) || normalizeItemCode(k);
        if (!ck) continue;
        incorpRevByCod[ck] = Math.max(0, Math.round(Number(v) || 0));
      }
    }
    if (o.pending && typeof o.pending === 'object') {
      const smpk = o.serverMirroredPendingKeys;
      const serverMirroredPendingKeys = Array.isArray(smpk)
        ? smpk.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      return {
        pending: o.pending,
        daySnapshots: o.daySnapshots && typeof o.daySnapshots === 'object' ? o.daySnapshots : {},
        eventLog,
        incorpGen,
        incorpRevByCod,
        serverMirroredPendingKeys,
      };
    }
    const pending = {};
    for (const [k, v] of Object.entries(o)) {
      if (
        k === 'pending' ||
        k === 'daySnapshots' ||
        k === 'incorporatedDays' ||
        k === 'eventLog' ||
        k === 'incorpGen' ||
        k === 'incorpRevByCod'
      ) {
        continue;
      }
      if (v && typeof v === 'object' && ('cx' in v || 'un' in v)) {
        const base = normalizeItemCode(k);
        pending[base] = {
          cx: Math.max(0, Math.round(Number(v.cx) || 0)),
          un: Math.max(0, Math.round(Number(v.un) || 0)),
        };
      }
    }
    return {
      pending,
      daySnapshots: {},
      eventLog,
      incorpGen,
      incorpRevByCod,
      serverMirroredPendingKeys: [],
    };
  } catch {
    return {
      pending: {},
      daySnapshots: {},
      eventLog: [],
      incorpGen: 0,
      incorpRevByCod: {},
      serverMirroredPendingKeys: [],
    };
  }
}

function writeMateCouroTrocaStorage(state) {
  try {
    const smpk = state.serverMirroredPendingKeys;
    const serverMirroredPendingKeys = Array.isArray(smpk)
      ? smpk.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const payload = {
      pending: state.pending && typeof state.pending === 'object' ? state.pending : {},
      daySnapshots:
        state.daySnapshots && typeof state.daySnapshots === 'object' ? state.daySnapshots : {},
      eventLog: Array.isArray(state.eventLog) ? state.eventLog : [],
      incorpGen: Math.max(0, Math.round(Number(state.incorpGen) || 0)),
      incorpRevByCod:
        state.incorpRevByCod && typeof state.incorpRevByCod === 'object' ? state.incorpRevByCod : {},
      serverMirroredPendingKeys,
    };
    localStorage.setItem(MATE_COURO_TROCA_STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(MATE_COURO_TROCA_STORAGE_LEGACY_KEY);
    localStorage.removeItem(MATE_COURO_TROCA_STORAGE_PREV_KEY);
  } catch (e) {
    console.warn(e);
  }
}

function mateTrocaLocalActorLabel() {
  const u = getUser();
  return (u && (u.full_name || u.name || u.username)) || '—';
}

function markMateTrocaLocalEventsSynced(ids) {
  const idset = new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean));
  if (!idset.size) return;
  const state = readMateCouroTrocaStorage();
  if (!Array.isArray(state.eventLog)) return;
  for (const e of state.eventLog) {
    if (idset.has(String(e.client_event_id || '').trim())) e.synced = true;
  }
  writeMateCouroTrocaStorage(state);
}

async function syncMateTrocaEventsToServer(events) {
  const arr = events || [];
  if (!arr.length) return { ok: true };
  const state = readMateCouroTrocaStorage();
  if (!Array.isArray(state.eventLog)) state.eventLog = [];
  const opDay = getBrazilDateKey();
  const actor = mateTrocaLocalActorLabel();
  const nowIso = new Date().toISOString();
  for (const payload of arr) {
    state.eventLog.push({
      client_event_id: payload.client_event_id,
      kind: payload.kind,
      cod_produto: normalizeItemCode(String(payload.cod_produto || '')),
      qty_cx_in: Math.round(Number(payload.qty_cx_in) || 0),
      qty_un_in: Math.round(Number(payload.qty_un_in) || 0),
      pend_cx_before: Math.round(Number(payload.pend_cx_before) || 0),
      pend_un_before: Math.round(Number(payload.pend_un_before) || 0),
      pend_cx_after: Math.round(Number(payload.pend_cx_after) || 0),
      pend_un_after: Math.round(Number(payload.pend_un_after) || 0),
      excess_cx: Math.round(Number(payload.excess_cx) || 0),
      excess_un: Math.round(Number(payload.excess_un) || 0),
      device_name: payload.device_name || null,
      operational_date: opDay,
      created_at_local: nowIso,
      actor_label: actor,
      synced: false,
    });
  }
  while (state.eventLog.length > 500) state.eventLog.shift();
  writeMateCouroTrocaStorage(state);
  const res = await postMateTrocaEventsToServer(arr);
  if (res.ok) {
    markMateTrocaLocalEventsSynced(arr.map((e) => e.client_event_id));
  }
  return res;
}

function mergeMateTrocaHistoryForCod(cod, serverEvents, overlayEvents) {
  const base = normalizeItemCode(cod);
  const byCid = new Map();
  for (const ev of serverEvents || []) {
    const cid = String(ev.client_event_id || '').trim();
    if (cid) {
      byCid.set(cid, { ...ev, _source: 'server' });
    } else if (ev.id != null) {
      byCid.set(`srv:${ev.id}`, { ...ev, _source: 'server' });
    }
  }
  const state = readMateCouroTrocaStorage();
  for (const ev of state.eventLog || []) {
    if (normalizeItemCode(String(ev.cod_produto || '')) !== base) continue;
    const cid = String(ev.client_event_id || '').trim();
    if (!cid || byCid.has(cid)) continue;
    byCid.set(cid, {
      client_event_id: ev.client_event_id,
      kind: ev.kind,
      cod_produto: ev.cod_produto,
      qty_cx_in: ev.qty_cx_in,
      qty_un_in: ev.qty_un_in,
      pend_cx_before: ev.pend_cx_before,
      pend_un_before: ev.pend_un_before,
      pend_cx_after: ev.pend_cx_after,
      pend_un_after: ev.pend_un_after,
      excess_cx: ev.excess_cx,
      excess_un: ev.excess_un,
      device_name: ev.device_name,
      created_at: ev.created_at_local,
      operational_date: ev.operational_date,
      actor_username: ev.actor_label,
      product_desc: null,
      _pendingSync: !ev.synced,
      _source: 'local',
    });
  }
  for (const ev of overlayEvents || []) {
    const cid = String(ev.client_event_id || '').trim();
    if (!cid || byCid.has(cid)) continue;
    byCid.set(cid, { ...ev, _source: ev._source || 'break_screen' });
  }
  return Array.from(byCid.values()).sort((a, b) => {
    const ta = Date.parse(a.created_at || '') || 0;
    const tb = Date.parse(b.created_at || '') || 0;
    return ta - tb;
  });
}

function mateTrocaHistoryDayLabel(ev) {
  if (ev.operational_date) return formatDateBR(ev.operational_date);
  const iso = ev.created_at;
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function mateTrocaHistoryDateTimeLabel(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

function mergePendingDelta(state, cod, dcx, dun) {
  const base = normalizeItemCode(cod);
  const cur = state.pending[base] || { cx: 0, un: 0 };
  const nx = Math.max(0, Math.round(cur.cx + dcx));
  const nu = Math.max(0, Math.round(cur.un + dun));
  if (nx === 0 && nu === 0) delete state.pending[base];
  else state.pending[base] = { cx: nx, un: nu };
}

function mateTrocaKindLabelPt(kind) {
  const k = String(kind || '').trim();
  if (k === 'chegada') return 'Chegada';
  if (k === 'definir') return 'Definir saldo';
  if (k === 'zerar') return 'Zerar';
  if (k === 'ajuste_pendente') return 'Ajuste por código';
  if (k === 'incorporacao_quebra') return 'Quebra (Carregar dia)';
  if (k === 'quebra_operacional') return 'Quebra (tela Quebra)';
  return k || '—';
}

/** Texto claro quando a chegada ultrapassa o pendente (por CX e por UN). */
function mateTrocaChegouAMaisText(ev) {
  if (String(ev.kind || '').trim() !== 'chegada') return '';
  const exCx = Number(ev.excess_cx) || 0;
  const exUn = Number(ev.excess_un) || 0;
  if (exCx <= 0 && exUn <= 0) return '';
  const pbc = Number(ev.pend_cx_before) || 0;
  const pbu = Number(ev.pend_un_before) || 0;
  const qcx = Number(ev.qty_cx_in) || 0;
  const qun = Number(ev.qty_un_in) || 0;
  const exParts = [];
  if (exCx > 0) exParts.push(`${formatBreakIntegerBR(exCx)} CX`);
  if (exUn > 0) exParts.push(`${formatBreakIntegerBR(exUn)} UN`);
  const exHuman = exParts.join(' e ');
  return (
    `Chegou a mais: o pendente de troca era ${formatBreakIntegerBR(pbc)} CX / ${formatBreakIntegerBR(pbu)} UN; ` +
    `registraram chegada de ${formatBreakIntegerBR(qcx)} CX / ${formatBreakIntegerBR(qun)} UN ` +
    `(houve ${exHuman} a mais do que o necessário para só abater o pendente).`
  );
}

function buildMateTrocaServerPayload(kind, cod, cur, next, qtyCxIn, qtyUnIn) {
  const pendBeforeCx = Math.round(Number(cur.cx) || 0);
  const pendBeforeUn = Math.round(Number(cur.un) || 0);
  const pendAfterCx = Math.round(Number(next.cx) || 0);
  const pendAfterUn = Math.round(Number(next.un) || 0);
  const qcx = Math.round(Number(qtyCxIn) || 0);
  const qun = Math.round(Number(qtyUnIn) || 0);
  let excessCx = 0;
  let excessUn = 0;
  if (kind === 'chegada') {
    excessCx = Math.max(0, qcx - pendBeforeCx);
    excessUn = Math.max(0, qun - pendBeforeUn);
  }
  return {
    client_event_id: makeEventId(),
    kind,
    cod_produto: cod,
    qty_cx_in: qcx,
    qty_un_in: qun,
    pend_cx_before: pendBeforeCx,
    pend_un_before: pendBeforeUn,
    pend_cx_after: pendAfterCx,
    pend_un_after: pendAfterUn,
    excess_cx: excessCx,
    excess_un: excessUn,
    device_name: getDeviceName(),
  };
}

async function postMateTrocaEventsToServer(events) {
  const token = getToken();
  if (!token) {
    return { ok: false, message: 'Faça login para registrar no servidor.' };
  }
  try {
    const response = await apiFetch(API_MATE_TROCA_EVENTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });
    if (handleUnauthorizedResponse(response)) {
      return { ok: false, message: 'Sessão expirada. Faça login novamente.' };
    }
    if (!response.ok) {
      let message = 'Não foi possível gravar no servidor.';
      try {
        const err = await response.json();
        const d = err.detail;
        if (typeof d === 'string') message = d;
        else if (d != null) message = JSON.stringify(d);
      } catch {
        /* ignore */
      }
      return { ok: false, message };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Sem conexão. Tente de novo.' };
  }
}

function aggregateMateCouroEventsByCode(events) {
  const m = {};
  for (const ev of events || []) {
    const code = normalizeNumericProductCodeKey(String(ev.cod_produto || ''));
    if (!code) continue;
    const { cx, un } = parseAuditBreakCxUn(ev);
    if (!m[code]) m[code] = { cx: 0, un: 0 };
    m[code].cx += cx;
    m[code].un += un;
  }
  return m;
}

/** Sinal + valor absoluto para texto de movimento (ex.: +3 CX / −1 UN). */
function mateTrocaSignedCxUnParts(dcx, dun) {
  const cx = Math.round(Number(dcx) || 0);
  const un = Math.round(Number(dun) || 0);
  const cxPart =
    cx === 0
      ? null
      : `${cx > 0 ? '+' : '−'}${formatBreakIntegerBR(Math.abs(cx))} CX`;
  const unPart =
    un === 0
      ? null
      : `${un > 0 ? '+' : '−'}${formatBreakIntegerBR(Math.abs(un))} UN`;
  return [cxPart, unPart].filter(Boolean).join(' · ') || '0 CX · 0 UN';
}

/** Snapshot por dia: unifica chaves numéricas (010 vs 10) somando se houver colisão legada. */
function canonicalizeMateTrocaDaySnapshot(snap) {
  if (!snap || typeof snap !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(snap)) {
    const ck = normalizeNumericProductCodeKey(k);
    if (!ck) continue;
    const cx = Math.max(0, Math.round(Number(v?.cx) || 0));
    const un = Math.max(0, Math.round(Number(v?.un) || 0));
    if (!out[ck]) out[ck] = { cx: 0, un: 0 };
    out[ck].cx += cx;
    out[ck].un += un;
  }
  return out;
}

/**
 * Aplica delta de quebra Mate couro do dia no **servidor** (incorporacao_quebra), idempotente por
 * dia+código+delta. Atualiza snapshots locais só após POST ok; espelha pending do GET em seguida.
 */
async function mateCouroApplyDaySnapshotDelta(dayKey, mateEvents) {
  const state = readMateCouroTrocaStorage();
  if (!state.daySnapshots) state.daySnapshots = {};
  if (!Array.isArray(state.eventLog)) state.eventLog = [];
  const agg = canonicalizeMateTrocaDaySnapshot(aggregateMateCouroEventsByCode(mateEvents));
  const prev = canonicalizeMateTrocaDaySnapshot(state.daySnapshots[dayKey] || {});
  const codes = new Set([...Object.keys(agg), ...Object.keys(prev)]);

  const serverMap = await fetchMateTrocaPendingByProductMap();
  const work = {};
  for (const k of Object.keys(serverMap)) {
    const ck = normalizeNumericProductCodeKey(k);
    if (!ck) continue;
    work[ck] = { cx: serverMap[k].cx, un: serverMap[k].un };
  }

  const payloads = [];
  const nowIso = new Date().toISOString();
  const opDay = String(dayKey).slice(0, 10);

  for (const cod of codes) {
    const a = agg[cod] || { cx: 0, un: 0 };
    const p = prev[cod] || { cx: 0, un: 0 };
    const dcx = a.cx - p.cx;
    const dun = a.un - p.un;
    if (dcx === 0 && dun === 0) continue;

    const base = normalizeNumericProductCodeKey(cod) || normalizeItemCode(cod);
    if (!base) continue;

    const cur = work[base] || { cx: 0, un: 0 };
    const pendCxBefore = Math.round(Number(cur.cx) || 0);
    const pendUnBefore = Math.round(Number(cur.un) || 0);
    const pendCxAfter = Math.max(0, pendCxBefore + dcx);
    const pendUnAfter = Math.max(0, pendUnBefore + dun);

    payloads.push({
      client_event_id: mateTrocaIncorporacaoClientEventId(dayKey, base, dcx, dun),
      kind: 'incorporacao_quebra',
      cod_produto: base,
      qty_cx_in: dcx,
      qty_un_in: dun,
      pend_cx_before: pendCxBefore,
      pend_un_before: pendUnBefore,
      pend_cx_after: pendCxAfter,
      pend_un_after: pendUnAfter,
      excess_cx: 0,
      excess_un: 0,
      device_name: getDeviceName(),
    });

    work[base] = { cx: pendCxAfter, un: pendUnAfter };
  }

  if (payloads.length) {
    const res = await postMateTrocaEventsToServer(payloads);
    if (!res.ok) {
      return false;
    }
    for (const pl of payloads) {
      state.eventLog.push({
        client_event_id: pl.client_event_id,
        kind: 'incorporacao_quebra',
        cod_produto: pl.cod_produto,
        qty_cx_in: pl.qty_cx_in,
        qty_un_in: pl.qty_un_in,
        pend_cx_before: pl.pend_cx_before,
        pend_un_before: pl.pend_un_before,
        pend_cx_after: pl.pend_cx_after,
        pend_un_after: pl.pend_un_after,
        excess_cx: 0,
        excess_un: 0,
        device_name: pl.device_name,
        operational_date: opDay,
        created_at_local: nowIso,
        actor_label: 'Carregar dia (quebra → servidor)',
        synced: true,
      });
    }
  }

  state.daySnapshots[dayKey] = agg;
  while (state.eventLog.length > 500) state.eventLog.shift();
  writeMateCouroTrocaStorage(state);

  await refreshMateTrocaBaseScreenData();
  return true;
}

async function ensureMateCouroCatalogLoaded() {
  if (Array.isArray(mateCouroProductsCache) && mateCouroProductsCache.length) return;
  const token = getToken();
  if (!token) return;
  const params = new URLSearchParams();
  params.set('limit', '20000');
  params.set('status', 'ativo');
  params.set('cia', MATE_COURO_CIA);
  const response = await apiFetch(`${API_PRODUCTS_CATALOG}?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) return;
  const data = await response.json();
  mateCouroProductsCache = Array.isArray(data) ? data : [];
}

function getMateCouroCodSet() {
  const s = new Set();
  for (const p of mateCouroProductsCache || []) {
    const c = normalizeItemCode(String(p.cod_produto || ''));
    if (c) s.add(c);
  }
  return s;
}

function mateCouroCatalogHasCode(set, evCod) {
  const raw = normalizeItemCode(String(evCod || ''));
  if (!raw) return false;
  if (set.has(raw)) return true;
  if (/^\d+$/.test(raw)) {
    const compact = normalizeNumericProductCodeKey(raw);
    if (compact && set.has(compact)) return true;
  }
  return false;
}

function filterEventsMateCouro(events) {
  const set = getMateCouroCodSet();
  return (events || []).filter((ev) => mateCouroCatalogHasCode(set, ev.cod_produto));
}

/** Converte linhas GET /audit/break-events (intervalo + cod) em eventos para o diálogo de histórico da Base de Troca. */
function breakScreenEventsToMateTrocaOverlay(events) {
  const out = [];
  const set = getMateCouroCodSet();
  const rawList = events || [];
  const listIn = set.size === 0 ? rawList : filterEventsMateCouro(rawList);
  for (const r of listIn) {
    const { cx, un } = parseAuditBreakCxUn(r);
    if (cx === 0 && un === 0) continue;
    const canon =
      normalizeNumericProductCodeKey(String(r.cod_produto || '')) ||
      normalizeItemCode(String(r.cod_produto || ''));
    const opDay = String(r.operational_date || '').slice(0, 10);
    if (!opDay) continue;
    const observed =
      r.observed_at != null && String(r.observed_at).trim()
        ? String(r.observed_at).trim()
        : `${opDay}T15:00:00.000Z`;
    out.push({
      client_event_id: `break-screen:${opDay}:${canon}`,
      kind: 'quebra_operacional',
      cod_produto: canon,
      qty_cx_in: cx,
      qty_un_in: un,
      pend_cx_before: 0,
      pend_un_before: 0,
      pend_cx_after: 0,
      pend_un_after: 0,
      excess_cx: 0,
      excess_un: 0,
      created_at: observed,
      operational_date: opDay,
      actor_username: r.actor || null,
      product_desc: r.product_desc || null,
      _source: 'break_screen',
    });
  }
  return out;
}

/** Códigos na Base de Troca: ``pending`` > 0 OU presença em ``discoverySet`` (quebra no período De/Até). O saldo exibido vem só de ``pending``. */
function collectMateCouroBaseProductCodes(pendingMap, discoverySet) {
  const codeSet = new Set();
  const ingestPending = (map) => {
    if (!map || typeof map !== 'object') return;
    for (const k of Object.keys(map)) {
      const t = map[k];
      const cx = Math.round(Number(t?.cx) || 0);
      const un = Math.round(Number(t?.un) || 0);
      if (!cx && !un) continue;
      const canon = normalizeNumericProductCodeKey(k);
      if (canon) codeSet.add(canon);
    }
  };
  ingestPending(pendingMap);
  if (discoverySet instanceof Set) {
    for (const c of discoverySet) {
      if (c) codeSet.add(String(c));
    }
  }
  return codeSet;
}

function updateMateCouroKpis() {
  let sumCx = 0;
  let sumUn = 0;
  let nProd = 0;
  const v2rows = Array.isArray(mateTrocaBaseV2LastMergedRows) ? mateTrocaBaseV2LastMergedRows : [];
  if (v2rows.length) {
    nProd = v2rows.length;
    for (const r of v2rows) {
      if (!r.saldoKnown) continue;
      sumCx += r.cx;
      sumUn += r.un;
    }
  } else {
    const server = mateTrocaServerPendingCache || {};
    const codeSet = collectMateCouroBaseProductCodes(server, mateTrocaDiscoveryCodesCache);
    for (const cod of codeSet) {
      const sv = resolveMateCouroPendingEntry(server, cod);
      sumCx += sv.cx;
      sumUn += sv.un;
      nProd += 1;
    }
  }
  const catalogLen = Array.isArray(mateCouroProductsCache) ? mateCouroProductsCache.length : 0;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText(
    'mate-troca-kpi-items-day',
    lastMateTrocaDayItemsCount == null ? '—' : String(lastMateTrocaDayItemsCount),
  );
  setText('mate-troca-kpi-pending-count', String(nProd));
  setText('mate-troca-kpi-pend-cx', formatBreakIntegerBR(sumCx));
  setText('mate-troca-kpi-pend-un', formatBreakIntegerBR(sumUn));
  setText('mate-troca-kpi-catalog', catalogLen ? String(catalogLen) : '—');
  setText(
    'mate-troca-kpi-resume',
    nProd
      ? `${nProd} prod. · ${formatBreakIntegerBR(sumCx)} CX / ${formatBreakIntegerBR(sumUn)} UN`
      : '—',
  );
}

function renderMateCouroDayList(dayLabel, mateEvents) {
  const list = document.getElementById('mate-couro-troca-day-list');
  const rangeInfo = document.getElementById('mate-couro-troca-day-range-info');
  if (!list) return;
  if (rangeInfo) {
    rangeInfo.textContent = mateEvents.length
      ? `${mateEvents.length} produto(s) com lançamento Mate couro neste dia.`
      : 'Nenhum lançamento Mate couro para este dia.';
  }
  list.innerHTML = '';
  if (!mateEvents.length) {
    list.innerHTML =
      '<li class="count-audit-empty"><span>Nenhuma quebra Mate couro registrada neste dia.</span><strong>—</strong></li>';
    return;
  }
  for (const ev of mateEvents) {
    const codRaw = String(ev.cod_produto || '');
    const cod = escapeHtml(codRaw);
    const descRaw = String(ev.product_desc || '').trim();
    const descEsc = escapeHtml(descRaw);
    const nameHtml = descRaw ? descEsc : cod;
    const { cx, un } = parseAuditBreakCxUn(ev);
    const actor = ev.actor ? escapeHtml(String(ev.actor)) : '—';
    const li = document.createElement('li');
    li.className = 'count-audit-item break-history-item';
    li.setAttribute('data-state', 'ok');
    li.innerHTML =
      `<div class="break-history-audit-row mate-troca-day-row">` +
      `<div class="count-audit-cell count-audit-cell--product">` +
      `<div class="break-history-product-static">` +
      `<div class="count-audit-row-topline">` +
      `<span class="count-audit-code-badge">${cod}</span>` +
      `</div>` +
      `<span class="count-audit-row-name">${nameHtml}</span>` +
      `</div></div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Dia</span>` +
      `<strong class="count-audit-cell-value">${escapeHtml(dayLabel)}</strong>` +
      `</div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Quebra</span>` +
      `<div class="count-audit-diff-breakdown count-audit-diff-breakdown--break" title="Total de quebra no dia operacional (mesma lógica da tela Quebra)">` +
      `<strong class="count-audit-diff-cx">CX ${formatBreakIntegerBR(cx)}</strong>` +
      `<strong class="count-audit-diff-un">UN ${formatBreakIntegerBR(un)}</strong>` +
      `</div></div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Nome</span>` +
      `<span class="count-audit-cell-value">${actor}</span>` +
      `</div>` +
      `</div>`;
    list.appendChild(li);
  }
}

/** @deprecated Card legado substituído por V2 — mantido só para chamadas residuais. */
function getMateCouroPendingRowsFiltered() {
  const searchEl = document.getElementById('mate-couro-troca-pending-search');
  const term = ((searchEl && searchEl.value) || '').trim().toLowerCase();
  const base = Array.isArray(mateTrocaBaseV2LastMergedRows) ? mateTrocaBaseV2LastMergedRows : [];
  if (!term) return base.slice();
  return base.filter(
    (r) =>
      r.cod.toLowerCase().includes(term) ||
      String(r.desc || '').toLowerCase().includes(term),
  );
}

/** @deprecated Render legado — delega ao card V2 (sem lista antiga). */
function renderMateCouroPendingList() {
  renderMateTrocaBaseBalanceCardV2FromCache();
}

async function loadMateCouroBreakDayList() {
  const dateEl = document.getElementById('mate-couro-troca-date');
  const list = document.getElementById('mate-couro-troca-day-list');
  const lastSyncKpi = document.getElementById('mate-troca-kpi-last-sync');

  if (!list) return;

  const token = getToken();
  if (!token) {
    return;
  }

  const d = (dateEl && dateEl.value) || getBrazilDateKey();
  const dayKey = String(d).slice(0, 10);
  let dayLabel = d;
  try {
    dayLabel = new Date(`${dayKey}T12:00:00`).toLocaleDateString('pt-BR');
  } catch {
    dayLabel = d;
  }

  await ensureMateCouroCatalogLoaded();
  await refreshMateTrocaBaseScreenData();
  await loadServerBreakTotals();

  try {
    const params = new URLSearchParams();
    params.set('operational_date', dayKey);
    const response = await apiFetch(`${API_SYNC_BREAKS}?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) {
      return;
    }
    if (!response.ok) {
      lastMateTrocaDayItemsCount = null;
      renderMateCouroDayList(dayLabel, []);
      renderMateTrocaBaseBalanceCardV2FromCache();
      return;
    }
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];
    const mateEvents = filterEventsMateCouro(events);
    lastMateTrocaDayItemsCount = mateEvents.length;
    const incorporacaoOk = await mateCouroApplyDaySnapshotDelta(dayKey, mateEvents);
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (lastSyncKpi) {
      lastSyncKpi.textContent = incorporacaoOk === false
        ? `${dayLabel} · ${nowStr} · falha ao gravar pendente no servidor`
        : `${dayLabel} · ${nowStr}`;
    }
    renderMateCouroDayList(dayLabel, mateEvents);
  } catch {
    lastMateTrocaDayItemsCount = null;
    renderMateCouroDayList(dayLabel, []);
    renderMateTrocaBaseBalanceCardV2FromCache();
  }
}

async function loadMateCouroTrocaPage() {
  const dateEl = document.getElementById('mate-couro-troca-date');
  if (dateEl && !dateEl.value) {
    dateEl.value = getBrazilDateKey();
  }
  ensureMateTrocaAcumuladoRangeDefaults();
  updateMateTrocaReconcileFromBreaksButton();
  await loadMateCouroBreakDayList();
}

async function loadMateTrocaTrocasPage() {
  const ul = document.getElementById('mate-troca-batches-list');
  const fb = document.getElementById('mate-troca-batches-feedback');
  const setFb = (msg, isErr) => {
    if (!fb) return;
    fb.textContent = msg || '';
    fb.style.display = msg ? '' : 'none';
    fb.classList.toggle('is-error', !!isErr);
  };
  if (!ul) return;
  const token = getToken();
  if (!token) {
    ul.innerHTML = '<li class="count-audit-empty"><span>Faça login.</span></li>';
    setFb('Faça login para ver trocas encerradas.', true);
    return;
  }
  setFb('Carregando…', false);
  ul.innerHTML = '<li class="count-audit-empty"><span>Carregando…</span></li>';
  try {
    const response = await apiFetch(`${API_MATE_TROCA_BATCHES}?limit=200`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      setFb('Não foi possível carregar o consolidado.', true);
      ul.innerHTML = '<li class="count-audit-empty"><span>Falha ao carregar.</span></li>';
      return;
    }
    const data = await response.json();
    const batches = Array.isArray(data.batches) ? data.batches : [];
    setFb('', false);
    renderMateTrocaBatchesList(batches);
  } catch {
    setFb('Sem conexão.', true);
    ul.innerHTML = '<li class="count-audit-empty"><span>Sem conexão.</span></li>';
  }
}

function renderMateTrocaBatchesList(batches) {
  const ul = document.getElementById('mate-troca-batches-list');
  if (!ul) return;
  ul.innerHTML = '';
  if (!batches.length) {
    ul.innerHTML =
      '<li class="count-audit-empty"><span>Nenhuma troca encerrada no período analisado (pendente zerado no servidor).</span></li>';
    return;
  }
  for (const b of batches) {
    const cod = escapeHtml(String(b.cod_produto || ''));
    const desc = escapeHtml(String(b.product_desc || '').trim() || '—');
    const code = escapeHtml(String(b.batch_code || ''));
    const closed = b.closed_at ? mateTrocaHistoryDateTimeLabel(b.closed_at) : '—';
    const closing = escapeHtml(mateTrocaKindLabelPt(b.closing_kind));
    const by = escapeHtml(String(b.closed_by || '—').trim() || '—');
    const li = document.createElement('li');
    li.className = 'mate-troca-batch-item count-audit-item';
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.dataset.closeLogId = String(b.close_log_id || '');
    li.innerHTML =
      `<div class="mate-troca-batch-row mate-troca-batch-row--trocas">` +
      `<div class="mate-troca-batch-cell mate-troca-batch-cell--code">` +
      `<span class="count-audit-cell-label">Código da troca</span>` +
      `<strong class="mate-troca-batch-code">${code}</strong>` +
      `</div>` +
      `<div class="mate-troca-batch-cell mate-troca-batch-cell--product">` +
      `<span class="count-audit-cell-label">Produto</span>` +
      `<span class="mate-troca-batch-product">${desc}</span>` +
      `<span class="muted mate-troca-batch-cod">${cod}</span>` +
      `</div>` +
      `<div class="mate-troca-batch-cell mate-troca-batch-cell--when">` +
      `<span class="count-audit-cell-label">Encerrou</span>` +
      `<span class="mate-troca-batch-when">${escapeHtml(closed)}</span>` +
      `<span class="muted mate-troca-batch-who">${by} · ${closing}</span>` +
      `</div>` +
      `<div class="mate-troca-batch-cell mate-troca-batch-cell--move">` +
      `<span class="count-audit-cell-label">Entrada (Σ)</span>` +
      `<span class="mate-troca-batch-qty">CX ${formatBreakIntegerBR(b.sum_qty_cx_in)} · UN ${formatBreakIntegerBR(b.sum_qty_un_in)}</span>` +
      `<span class="muted mate-troca-batch-events">${escapeHtml(String(b.event_count || 0))} lanç.</span>` +
      `</div>` +
      `</div>`;
    ul.appendChild(li);
  }
}

async function openMateTrocaBatchDetail(closeLogId) {
  const id = Number(closeLogId);
  if (!Number.isFinite(id) || id < 1) return;
  const dlg = document.getElementById('mate-troca-batch-detail-dialog');
  const body = document.getElementById('mate-troca-batch-detail-dialog-body');
  const title = document.getElementById('mate-troca-batch-detail-dialog-title');
  if (!dlg || !body) return;
  body.innerHTML = '<p class="muted">Carregando…</p>';
  if (title) title.textContent = 'Detalhe da troca';
  dlg.showModal();
  const token = getToken();
  if (!token) {
    body.innerHTML = '<p class="is-error">Faça login.</p>';
    return;
  }
  try {
    const response = await apiFetch(`${API_MATE_TROCA_BATCHES}/by-close/${id}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) {
      dlg.close();
      return;
    }
    if (!response.ok) {
      body.innerHTML = '<p class="is-error">Não foi possível carregar.</p>';
      return;
    }
    const data = await response.json();
    const evs = Array.isArray(data.events) ? data.events : [];
    if (title) {
      const by = (data.closed_by && String(data.closed_by).trim()) || '';
      title.textContent = by
        ? `Troca ${data.batch_code || ''} · ${data.cod_produto || ''} · Encerrou: ${by}`
        : `Troca ${data.batch_code || ''} · ${data.cod_produto || ''}`;
    }
    const parts = evs.map((ev) => {
      const kind = mateTrocaKindLabelPt(ev.kind);
      const dayOp = escapeHtml(mateTrocaHistoryDayLabel(ev));
      const when = escapeHtml(mateTrocaHistoryDateTimeLabel(ev.created_at));
      const actor = escapeHtml(String(ev.actor_username || '—'));
      const chegouMaisPlain = mateTrocaChegouAMaisText(ev);
      const mov =
        String(ev.kind || '').trim() === 'chegada'
          ? `Chegada: CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)} (abatido do pendente).`
          : `${mateTrocaKindLabelPt(ev.kind)}: CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)}`;
      const pend = `Pendente ${formatBreakIntegerBR(ev.pend_cx_before)}/${formatBreakIntegerBR(ev.pend_un_before)} → ${formatBreakIntegerBR(ev.pend_cx_after)}/${formatBreakIntegerBR(ev.pend_un_after)}`;
      return (
        `<li class="mate-troca-pending-history-item">` +
        `<div class="mate-troca-pending-history-item-head">` +
        `<span class="mate-troca-pending-history-day"><span class="count-audit-cell-label">Dia</span> ${dayOp}</span>` +
        `<span class="mate-troca-pending-history-kind">${escapeHtml(kind)}</span></div>` +
        `<p class="mate-troca-pending-history-detail"><span class="count-audit-cell-label">Quando</span> ${when}</p>` +
        `<p class="mate-troca-pending-history-detail">${escapeHtml(mov)}</p>` +
        (chegouMaisPlain
          ? `<p class="mate-troca-pending-history-detail mate-troca-chegou-a-mais">${escapeHtml(chegouMaisPlain)}</p>`
          : '') +
        `<p class="mate-troca-pending-history-detail">${escapeHtml(pend)}</p>` +
        `<p class="mate-troca-pending-history-actor muted"><span class="count-audit-cell-label">Por quem</span> ${actor}</p>` +
        `</li>`
      );
    });
    body.innerHTML =
      `<p class="mate-troca-pending-history-lead muted">Lançamentos desta troca até o pendente zerar no servidor. Cada linha mostra por quem foi registrado.</p>` +
      `<ul class="mate-troca-pending-history-list" role="list">${parts.join('')}</ul>`;
  } catch {
    body.innerHTML = '<p class="is-error">Sem conexão.</p>';
  }
}

function renderMateTrocaServerLog(events) {
  const ul = document.getElementById('mate-troca-server-log-list');
  if (!ul) return;
  ul.innerHTML = '';
  if (!events.length) {
    ul.innerHTML =
      '<li class="count-audit-empty"><span>Nenhum registro para o filtro.</span><strong>—</strong></li>';
    return;
  }
  for (const ev of events) {
    let when = '—';
    if (ev.created_at) {
      try {
        when = new Date(ev.created_at).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
      } catch {
        when = String(ev.created_at);
      }
    }
    const kind = mateTrocaKindLabelPt(ev.kind);
    const cod = escapeHtml(String(ev.cod_produto || ''));
    const nameRaw = String(ev.product_desc || '').trim();
    const nameEsc = escapeHtml(nameRaw || ev.cod_produto || '');
    const chegouMais = mateTrocaChegouAMaisText(ev);
    const movText = chegouMais
      ? `CX ${formatBreakIntegerBR(ev.qty_cx_in)} / UN ${formatBreakIntegerBR(ev.qty_un_in)}. ${chegouMais}`
      : `CX ${formatBreakIntegerBR(ev.qty_cx_in)} / UN ${formatBreakIntegerBR(ev.qty_un_in)}`;
    const pendText = `${formatBreakIntegerBR(ev.pend_cx_before)}/${formatBreakIntegerBR(ev.pend_un_before)} → ${formatBreakIntegerBR(ev.pend_cx_after)}/${formatBreakIntegerBR(ev.pend_un_after)}`;
    const actor = escapeHtml(String(ev.actor_username || '—'));
    const li = document.createElement('li');
    li.className = 'count-audit-item';
    li.innerHTML =
      `<div class="mate-troca-server-log-row">` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Quando</span>` +
      `<strong class="count-audit-cell-value">${escapeHtml(when)}</strong>` +
      `</div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Tipo</span>` +
      `<span class="count-audit-cell-value">${escapeHtml(kind)}</span>` +
      `</div>` +
      `<div class="count-audit-cell count-audit-cell--product">` +
      `<div class="break-history-product-static">` +
      `<div class="count-audit-row-topline"><span class="count-audit-code-badge">${cod}</span></div>` +
      `<span class="count-audit-row-name">${nameEsc}</span>` +
      `</div></div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Movimento</span>` +
      `<span class="count-audit-cell-value">${escapeHtml(movText)}</span>` +
      `</div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Pendente</span>` +
      `<span class="count-audit-cell-value">${escapeHtml(pendText)}</span>` +
      `</div>` +
      `<div class="count-audit-cell">` +
      `<span class="count-audit-cell-label">Por quem</span>` +
      `<span class="count-audit-cell-value">${actor}</span>` +
      `</div>` +
      `</div>`;
    ul.appendChild(li);
  }
}

function mateTrocaHistoryEventSortKey(ev) {
  const s = ev && ev.created_at ? String(ev.created_at) : '';
  return s;
}

function renderMateTrocaPendingHistoryInDialog(events, cod, productName) {
  const body = document.getElementById('mate-troca-pending-history-dialog-body');
  const title = document.getElementById('mate-troca-pending-history-dialog-title');
  if (!body) return;
  const name = (productName || '').trim() || cod;
  if (title) {
    title.textContent = `Histórico · ${cod} · ${name}`;
  }
  if (!events.length) {
    body.innerHTML =
      `<p class="mate-troca-pending-history-empty muted">Nenhum lançamento para este código nos últimos 120 dias ` +
      `(Base de Troca no servidor, histórico deste aparelho ou quebra na tela Quebra). ` +
      `Se houve quebra Mate couro, confira o dia em <strong>Quebra</strong> ou <strong>Histórico de quebra</strong>. ` +
      `Na Base de Troca, use <strong>Carregar</strong> para incorporar o dia ao pendente; ` +
      `use <strong>Chegada</strong>, <strong>Saldo</strong>, <strong>Zerar</strong> ou <strong>Ajustar pendente</strong> para movimentos gravados no servidor.</p>`;
    return;
  }
  const sorted = [...events].sort((a, b) =>
    mateTrocaHistoryEventSortKey(a).localeCompare(mateTrocaHistoryEventSortKey(b)),
  );
  const parts = sorted.map((ev) => {
    const kindRaw = String(ev.kind || '').trim();
    const kind = mateTrocaKindLabelPt(ev.kind);
    const dayOp = escapeHtml(mateTrocaHistoryDayLabel(ev));
    const when = escapeHtml(mateTrocaHistoryDateTimeLabel(ev.created_at));
    const chegouMaisPlain = mateTrocaChegouAMaisText(ev);
    let mov = '';
    if (kindRaw === 'chegada') {
      mov = `Registro de chegada: entrada CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)} (abatido do pendente).`;
    } else if (kindRaw === 'incorporacao_quebra') {
      mov = `Incorporação ao pendente ao Carregar o dia (quebra Mate couro no servidor): ${mateTrocaSignedCxUnParts(ev.qty_cx_in, ev.qty_un_in)}.`;
    } else if (kindRaw === 'quebra_operacional') {
      mov = `Quebra registrada na tela Quebra (total do dia operacional Mate couro): CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)}.`;
    } else if (kindRaw === 'zerar') {
      mov = 'Zerar: pendente levado a zero.';
    } else if (kindRaw === 'definir') {
      mov = `Definir saldo: informado CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)}`;
    } else if (kindRaw === 'ajuste_pendente') {
      mov = `Ajuste por código: informado CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)}`;
    } else {
      mov = `Quantidades: CX ${formatBreakIntegerBR(ev.qty_cx_in)} · UN ${formatBreakIntegerBR(ev.qty_un_in)}`;
    }
    const pend =
      kindRaw === 'quebra_operacional'
        ? 'Base de Troca: este valor é o registro de quebra no dia; o pendente acumulativo só muda ao usar Carregar (ou Chegada / Saldo / Zerar / Ajuste).'
        : `Pendente: ${formatBreakIntegerBR(ev.pend_cx_before)} CX / ${formatBreakIntegerBR(ev.pend_un_before)} UN → ${formatBreakIntegerBR(ev.pend_cx_after)} CX / ${formatBreakIntegerBR(ev.pend_un_after)} UN`;
    const actor = escapeHtml(String(ev.actor_username || '—'));
    const syncBadge = ev._pendingSync
      ? `<span class="mate-troca-sync-pill" title="Ainda não confirmado no servidor">Aguardando sync</span>`
      : '';
    return (
      `<li class="mate-troca-pending-history-item">` +
      `<div class="mate-troca-pending-history-item-head">` +
      `<span class="mate-troca-pending-history-day"><span class="count-audit-cell-label">Dia</span> ${dayOp}</span>` +
      `${syncBadge}` +
      `<span class="mate-troca-pending-history-kind">${escapeHtml(kind)}</span>` +
      `</div>` +
      `<p class="mate-troca-pending-history-detail"><span class="count-audit-cell-label">Quando</span> ${when}</p>` +
      `<p class="mate-troca-pending-history-detail">${escapeHtml(mov)}</p>` +
      (chegouMaisPlain
        ? `<p class="mate-troca-pending-history-detail mate-troca-chegou-a-mais">${escapeHtml(chegouMaisPlain)}</p>`
        : '') +
      `<p class="mate-troca-pending-history-detail">${escapeHtml(pend)}</p>` +
      `<p class="mate-troca-pending-history-actor muted">` +
      `<span class="count-audit-cell-label">Por quem</span> ` +
      `<span class="mate-troca-pending-history-actor-value">${actor}</span></p>` +
      `</li>`
    );
  });
  body.innerHTML =
    `<p class="mate-troca-pending-history-lead muted">Ordem cronológica (mais antigo primeiro). ` +
    `Inclui Base de Troca no servidor, quebra na tela Quebra (últimos 120 dias) e lançamentos neste aparelho ainda não sincronizados.</p>` +
    `<ul class="mate-troca-pending-history-list" role="list">${parts.join('')}</ul>`;
}

async function openMateTrocaPendingProductHistory(codRaw) {
  const cod = normalizeItemCode(codRaw);
  if (!cod) return;
  const dlg = document.getElementById('mate-troca-pending-history-dialog');
  const body = document.getElementById('mate-troca-pending-history-dialog-body');
  if (!dlg || !body) return;

  await ensureMateCouroCatalogLoaded();
  if (getToken()) {
    await refreshMateTrocaBaseScreenData();
  }
  const p = (mateCouroProductsCache || []).find(
    (x) => normalizeItemCode(String(x.cod_produto || '')) === cod,
  );
  const desc = p ? String(p.cod_grup_descricao || '').trim() : '';

  const dlgTitle = document.getElementById('mate-troca-pending-history-dialog-title');
  if (dlgTitle) {
    dlgTitle.textContent = desc ? `Histórico · ${cod} · ${desc}` : `Histórico · ${cod}`;
  }
  body.innerHTML = '<p class="muted mate-troca-pending-history-loading">Carregando histórico…</p>';
  dlg.showModal();

  const token = getToken();
  if (!token) {
    const mergedOffline = mergeMateTrocaHistoryForCod(cod, [], []);
    if (!mergedOffline.length) {
      body.innerHTML =
        '<p class="mate-troca-pending-history-empty is-error">Faça login para ver o histórico no servidor ou registre um lançamento neste aparelho.</p>';
      return;
    }
    renderMateTrocaPendingHistoryInDialog(mergedOffline, cod, desc);
    return;
  }

  try {
    const endKey = getBrazilDateKey();
    const startKey = brazilDateKeyAddDays(endKey, -119);
    const mateParams = new URLSearchParams();
    mateParams.set('cod_produto', cod);
    mateParams.set('limit', '500');
    const breakParams = new URLSearchParams();
    breakParams.set('date_from', startKey);
    breakParams.set('date_to', endKey);
    breakParams.set('cod_produto', cod);

    const [response, breakResponse] = await Promise.all([
      apiFetch(`${API_MATE_TROCA_EVENTS}?${mateParams.toString()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      }),
      apiFetch(`${API_SYNC_BREAKS}?${breakParams.toString()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      }),
    ]);

    let overlay = [];
    if (breakResponse.ok) {
      try {
        const bd = await breakResponse.json();
        overlay = breakScreenEventsToMateTrocaOverlay(Array.isArray(bd.events) ? bd.events : []);
      } catch {
        overlay = [];
      }
    }

    if (handleUnauthorizedResponse(response)) {
      dlg.close();
      return;
    }
    if (!response.ok) {
      const mergedErr = mergeMateTrocaHistoryForCod(cod, [], overlay);
      if (mergedErr.length) {
        renderMateTrocaPendingHistoryInDialog(mergedErr, cod, desc);
      } else {
        body.innerHTML =
          '<p class="mate-troca-pending-history-empty is-error">Não foi possível carregar o histórico. Tente de novo.</p>';
      }
      return;
    }
    const data = await response.json();
    const evs = Array.isArray(data.events) ? data.events : [];
    const merged = mergeMateTrocaHistoryForCod(cod, evs, overlay);
    renderMateTrocaPendingHistoryInDialog(merged, cod, desc);
  } catch {
    const mergedCatch = mergeMateTrocaHistoryForCod(cod, [], []);
    if (mergedCatch.length) {
      renderMateTrocaPendingHistoryInDialog(mergedCatch, cod, desc);
    } else {
      body.innerHTML = '<p class="mate-troca-pending-history-empty is-error">Sem conexão.</p>';
    }
  }
}

async function loadMateTrocaServerLogList() {
  const feedback = document.getElementById('mate-troca-server-log-feedback');
  const fromEl = document.getElementById('mate-troca-log-date-from');
  const toEl = document.getElementById('mate-troca-log-date-to');
  const codEl = document.getElementById('mate-troca-log-cod-filter');

  const setFb = (visible, message, isError) => {
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.style.display = visible ? '' : 'none';
    feedback.classList.toggle('is-error', !!(visible && isError));
    feedback.classList.toggle('is-info', !!(visible && !isError));
  };

  const token = getToken();
  if (!token) {
    setFb(true, 'Faça login para carregar o histórico.', true);
    renderMateTrocaServerLog([]);
    return;
  }

  const params = new URLSearchParams();
  const d0 = (fromEl && fromEl.value) || '';
  const d1 = (toEl && toEl.value) || '';
  if (d0) params.set('date_from', d0.slice(0, 10));
  if (d1) params.set('date_to', d1.slice(0, 10));
  const codF = ((codEl && codEl.value) || '').trim();
  if (codF) params.set('cod_produto', normalizeItemCode(codF));

  setFb(true, 'Carregando histórico...', false);
  try {
    const response = await apiFetch(`${API_MATE_TROCA_EVENTS}?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) {
      setFb(false, '', false);
      return;
    }
    if (!response.ok) {
      setFb(true, 'Não foi possível carregar o histórico.', true);
      renderMateTrocaServerLog([]);
      return;
    }
    const data = await response.json();
    const evs = Array.isArray(data.events) ? data.events : [];
    setFb(false, '', false);
    renderMateTrocaServerLog(evs);
  } catch {
    setFb(true, 'Sem conexão.', true);
    renderMateTrocaServerLog([]);
  }
}

function parseMateCouroIntPrompt(label, def) {
  const raw = window.prompt(label, def);
  if (raw == null) return null;
  const n = Number.parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function bindMateCouroTrocaEvents() {
  const logFrom = document.getElementById('mate-troca-log-date-from');
  const logTo = document.getElementById('mate-troca-log-date-to');
  if (logFrom && logTo && !logFrom.value && !logTo.value) {
    const bounds = getBrazilMonthBoundsDateKeys();
    logFrom.value = bounds.first;
    logTo.value = bounds.last;
  }

  const dateEl = document.getElementById('mate-couro-troca-date');
  const btnLoad = document.getElementById('btn-mate-couro-troca-load');
  const btnClearAll = document.getElementById('btn-mate-couro-troca-clear-all');
  const btnAdjust = document.getElementById('btn-mate-couro-troca-adjust-pending');
  const btnLogLoad = document.getElementById('btn-mate-troca-server-log-load');
  const pendingSearch = document.getElementById('mate-couro-troca-pending-search');
  const pendingListV2 = document.getElementById('mate-couro-troca-balance-list-v2');

  if (dateEl && !dateEl.dataset.mateTrocaBound) {
    dateEl.dataset.mateTrocaBound = '1';
    dateEl.addEventListener('change', () => {
      loadMateCouroBreakDayList();
    });
  }

  if (btnLoad && !btnLoad.dataset.mateTrocaBound) {
    btnLoad.dataset.mateTrocaBound = '1';
    btnLoad.addEventListener('click', () => {
      loadMateCouroBreakDayList();
    });
  }

  const acumFrom = document.getElementById('mate-couro-troca-acum-from');
  const acumTo = document.getElementById('mate-couro-troca-acum-to');
  const btnAcumRefresh = document.getElementById('btn-mate-couro-troca-acum-refresh');
  const runMateTrocaAcumRefresh = () => {
    void refreshMateTrocaBaseScreenData();
  };
  if (acumFrom && !acumFrom.dataset.mateTrocaAcumBound) {
    acumFrom.dataset.mateTrocaAcumBound = '1';
    acumFrom.addEventListener('change', runMateTrocaAcumRefresh);
  }
  if (acumTo && !acumTo.dataset.mateTrocaAcumBound) {
    acumTo.dataset.mateTrocaAcumBound = '1';
    acumTo.addEventListener('change', runMateTrocaAcumRefresh);
  }
  if (btnAcumRefresh && !btnAcumRefresh.dataset.mateTrocaAcumBound) {
    btnAcumRefresh.dataset.mateTrocaAcumBound = '1';
    btnAcumRefresh.addEventListener('click', runMateTrocaAcumRefresh);
  }

  const btnReconcileBreaks = document.getElementById('btn-mate-couro-reconcile-from-breaks');
  if (btnReconcileBreaks && !btnReconcileBreaks.dataset.mateReconcileBound) {
    btnReconcileBreaks.dataset.mateReconcileBound = '1';
    btnReconcileBreaks.addEventListener('click', () => void runMateTrocaReconcileFromBreaks());
  }
  updateMateTrocaReconcileFromBreaksButton();

  if (btnClearAll && !btnClearAll.dataset.mateTrocaBound) {
    btnClearAll.dataset.mateTrocaBound = '1';
    btnClearAll.addEventListener('click', () => {
      void (async () => {
        if (
          !window.confirm(
            'Limpar neste aparelho os snapshots de “Carregar dia”? O pendente no servidor não é apagado. Ao Carregar cada dia de novo, as incorporações ganham novo id neste aparelho e o servidor volta a aceitar os deltas (útil após zerar ou corrigir).',
          )
        ) {
          return;
        }
        const _s = readMateCouroTrocaStorage();
        _s.daySnapshots = {};
        _s.incorpGen = Math.max(0, Math.round(Number(_s.incorpGen) || 0)) + 1;
        writeMateCouroTrocaStorage(_s);
        await refreshMateTrocaBaseScreenData();
      })();
    });
  }

  if (btnAdjust && !btnAdjust.dataset.mateTrocaBound) {
    btnAdjust.dataset.mateTrocaBound = '1';
    btnAdjust.addEventListener('click', () => {
      void (async () => {
        const rawCod = window.prompt('Código do produto (Mate couro):', '');
        if (rawCod == null) return;
        const cod = normalizeItemCode(rawCod);
        if (!cod) {
          window.alert('Código inválido.');
          return;
        }
        await ensureMateCouroCatalogLoaded();
        const inCatalog = (mateCouroProductsCache || []).some(
          (x) => normalizeItemCode(String(x.cod_produto || '')) === cod,
        );
        if (!inCatalog) {
          window.alert('Código não encontrado no catálogo Mate couro (ativos).');
          return;
        }
        await refreshMateTrocaBaseBalanceCardV2();
        const cur = getMateTrocaV2CurForPayload(cod);
        const cxNew = parseMateCouroIntPrompt(`Novo pendente em CX para ${cod}:`, String(cur.cx));
        if (cxNew === null) return;
        const unNew = parseMateCouroIntPrompt(`Novo pendente em UN para ${cod}:`, String(cur.un));
        if (unNew === null) return;
        const next =
          cxNew === 0 && unNew === 0 ? { cx: 0, un: 0 } : { cx: cxNew, un: unNew };
        const payload = buildMateTrocaServerPayload(
          'ajuste_pendente',
          cod,
          cur,
          next,
          cxNew,
          unNew,
        );
        const sync = await syncMateTrocaEventsToServer([payload]);
        if (!sync.ok) {
          window.alert(sync.message || 'Falha ao sincronizar.');
          return;
        }
        await refreshMateTrocaBaseBalanceCardV2();
      })();
    });
  }

  if (btnLogLoad && !btnLogLoad.dataset.mateTrocaBound) {
    btnLogLoad.dataset.mateTrocaBound = '1';
    btnLogLoad.addEventListener('click', () => {
      void loadMateTrocaServerLogList();
    });
  }

  if (pendingSearch && !pendingSearch.dataset.mateTrocaBound) {
    pendingSearch.dataset.mateTrocaBound = '1';
    pendingSearch.addEventListener('input', () => {
      renderMateTrocaBaseBalanceCardV2FromCache();
    });
  }

  const mateTrocaHistDlg = document.getElementById('mate-troca-pending-history-dialog');
  if (mateTrocaHistDlg && !mateTrocaHistDlg.dataset.mateTrocaHistBound) {
    mateTrocaHistDlg.dataset.mateTrocaHistBound = '1';
    mateTrocaHistDlg
      .querySelector('.mate-troca-pending-history-dialog-close')
      ?.addEventListener('click', () => mateTrocaHistDlg.close());
    mateTrocaHistDlg.addEventListener('click', (ev) => {
      if (ev.target === mateTrocaHistDlg) mateTrocaHistDlg.close();
    });
  }

  if (pendingListV2 && pendingListV2.dataset.matePendV2RowOpen !== '1') {
    pendingListV2.dataset.matePendV2RowOpen = '1';
    pendingListV2.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('[data-mate-pend-v2]')) return;
      const li = e.target.closest('li.mate-troca-balance-v2-item');
      if (!li || !pendingListV2.contains(li)) return;
      const cod = li.getAttribute('data-mate-pending-cod');
      if (!cod) return;
      void openMateTrocaPendingProductHistory(cod);
    });
  }

  if (pendingListV2 && pendingListV2.dataset.matePendV2Delegates !== '1') {
    pendingListV2.dataset.matePendV2Delegates = '1';
    pendingListV2.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mate-pend-v2]');
      if (!btn || !pendingListV2.contains(btn)) return;
      const action = btn.getAttribute('data-mate-pend-v2');
      const codRef = btn.getAttribute('data-coderef') || '';
      const cod = normalizeItemCode(decodeURIComponent(codRef));
      if (!cod) return;

      void (async () => {
        await refreshMateTrocaBaseBalanceCardV2();

        if (action === 'recebeu' && !mateTrocaV2SaldoKnownForCod(cod)) {
          window.alert(
            'Saldo deste código ainda não está confirmado no servidor. Use Atualizar lista ou defina o saldo antes da chegada.',
          );
          return;
        }

        const cur = getMateTrocaV2CurForPayload(cod);

        if (action === 'zerar') {
          if (
            !window.confirm(
              `Zerar pendente de troca para ${cod}? Em seguida use Carregar nos dias de quebra neste aparelho: as incorporações serão aceitas de novo (novo id).`,
            )
          ) {
            return;
          }
          const payload = buildMateTrocaServerPayload(
            'zerar',
            cod,
            cur,
            { cx: 0, un: 0 },
            0,
            0,
          );
          const sync = await syncMateTrocaEventsToServer([payload]);
          if (!sync.ok) {
            window.alert(sync.message || 'Falha ao sincronizar.');
            return;
          }
          bumpMateTrocaIncorpRevForCod(cod);
          await refreshMateTrocaBaseBalanceCardV2();
          return;
        }

        if (action === 'recebeu') {
          const cxIn = parseMateCouroIntPrompt('Quantidade em CX que chegou (abatida do pendente):', '0');
          if (cxIn === null) return;
          const unIn = parseMateCouroIntPrompt('Quantidade em UN que chegou (abatida do pendente):', '0');
          if (unIn === null) return;
          const next = {
            cx: Math.max(0, cur.cx - cxIn),
            un: Math.max(0, cur.un - unIn),
          };
          const payload = buildMateTrocaServerPayload('chegada', cod, cur, next, cxIn, unIn);
          const sync = await syncMateTrocaEventsToServer([payload]);
          if (!sync.ok) {
            window.alert(sync.message || 'Falha ao sincronizar.');
            return;
          }
          await refreshMateTrocaBaseBalanceCardV2();
          return;
        }

        if (action === 'definir') {
          const cxNew = parseMateCouroIntPrompt(`Novo pendente em CX para ${cod}:`, String(cur.cx));
          if (cxNew === null) return;
          const unNew = parseMateCouroIntPrompt(`Novo pendente em UN para ${cod}:`, String(cur.un));
          if (unNew === null) return;
          const next =
            cxNew === 0 && unNew === 0 ? { cx: 0, un: 0 } : { cx: cxNew, un: unNew };
          const payload = buildMateTrocaServerPayload(
            'definir',
            cod,
            cur,
            next,
            cxNew,
            unNew,
          );
          const sync = await syncMateTrocaEventsToServer([payload]);
          if (!sync.ok) {
            window.alert(sync.message || 'Falha ao sincronizar.');
            return;
          }
          await refreshMateTrocaBaseBalanceCardV2();
        }
      })();
    });
  }

  const btnGoHistorico = document.getElementById('btn-mate-troca-go-historico');
  if (btnGoHistorico && !btnGoHistorico.dataset.mateTrocaNavHistoricoBound) {
    btnGoHistorico.dataset.mateTrocaNavHistoricoBound = '1';
    btnGoHistorico.addEventListener('click', () =>
      setActiveModule('mate-couro-troca-historico'),
    );
  }
  const btnGoTrocas = document.getElementById('btn-mate-troca-go-trocas');
  if (btnGoTrocas && !btnGoTrocas.dataset.mateTrocaNavBound) {
    btnGoTrocas.dataset.mateTrocaNavBound = '1';
    btnGoTrocas.addEventListener('click', () => setActiveModule('mate-couro-troca-trocas'));
  }
  const btnHistGoOps = document.getElementById('btn-mate-troca-historico-go-operation');
  if (btnHistGoOps && !btnHistGoOps.dataset.mateTrocaHistoricoNavBound) {
    btnHistGoOps.dataset.mateTrocaHistoricoNavBound = '1';
    btnHistGoOps.addEventListener('click', () => setActiveModule('mate-couro-troca'));
  }
  const btnHistGoTrocas = document.getElementById('btn-mate-troca-historico-go-trocas');
  if (btnHistGoTrocas && !btnHistGoTrocas.dataset.mateTrocaHistoricoNavTrocasBound) {
    btnHistGoTrocas.dataset.mateTrocaHistoricoNavTrocasBound = '1';
    btnHistGoTrocas.addEventListener('click', () =>
      setActiveModule('mate-couro-troca-trocas'),
    );
  }
  const btnGoOps = document.getElementById('btn-mate-troca-go-operation');
  if (btnGoOps && !btnGoOps.dataset.mateTrocaNavBound) {
    btnGoOps.dataset.mateTrocaNavBound = '1';
    btnGoOps.addEventListener('click', () => setActiveModule('mate-couro-troca'));
  }
  const btnBatchesReload = document.getElementById('btn-mate-troca-batches-reload');
  if (btnBatchesReload && !btnBatchesReload.dataset.mateTrocaBatchBound) {
    btnBatchesReload.dataset.mateTrocaBatchBound = '1';
    btnBatchesReload.addEventListener('click', () => void loadMateTrocaTrocasPage());
  }
  const batchesUl = document.getElementById('mate-troca-batches-list');
  if (batchesUl && batchesUl.dataset.mateBatchDelegate !== '1') {
    batchesUl.dataset.mateBatchDelegate = '1';
    batchesUl.addEventListener('click', (e) => {
      const li = e.target.closest('.mate-troca-batch-item');
      if (!li || !batchesUl.contains(li)) return;
      const lid = li.getAttribute('data-close-log-id');
      if (lid) void openMateTrocaBatchDetail(lid);
    });
    batchesUl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const li = e.target.closest('.mate-troca-batch-item');
      if (!li || !batchesUl.contains(li)) return;
      e.preventDefault();
      const lid = li.getAttribute('data-close-log-id');
      if (lid) void openMateTrocaBatchDetail(lid);
    });
  }
  const batchDlg = document.getElementById('mate-troca-batch-detail-dialog');
  if (batchDlg && !batchDlg.dataset.mateBatchDlgBound) {
    batchDlg.dataset.mateBatchDlgBound = '1';
    batchDlg
      .querySelector('.mate-troca-batch-detail-dialog-close')
      ?.addEventListener('click', () => batchDlg.close());
    batchDlg.addEventListener('click', (ev) => {
      if (ev.target === batchDlg) batchDlg.close();
    });
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
    quantity_cx: e.quantity_cx,
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
  const m = {
    unknown: 'validity-chip validity-chip--muted',
    expired: 'validity-chip validity-chip--expired',
    d30: 'validity-chip validity-chip--d30',
    d60: 'validity-chip validity-chip--d60',
    d90: 'validity-chip validity-chip--d90',
    d120: 'validity-chip validity-chip--d120',
    d150: 'validity-chip validity-chip--d150',
    d180: 'validity-chip validity-chip--d180',
    ok: 'validity-chip validity-chip--okband',
  };
  return m[cat] || 'validity-chip validity-chip--muted';
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

/** Chave visual alinhada à régua de risco da Análise (KPIs, tabela, Excel). */
function validityRowVisualKey(row, todayBr) {
  const lines = row.lines || [];
  const snap = getValidityLastCountSnapshot(row.cod);
  if (!lines.length) return 'no_validity';
  if (!snap) return 'no_count';
  if (isValidityCountBaseOld(snap.countDate, todayBr)) return 'oldbase';
  return operationalValidityPrimaryCategory(lines, todayBr);
}

function validityProductGroupLabel(p) {
  if (!p) return '—';
  const parts = [p.cod_grup_familia, p.cod_grup_segmento, p.cod_grup_marca]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function validityDaysToExpiryDisplay(lines, todayBr) {
  if (!lines?.length) return '—';
  const anchor = operationalAnchorLine(lines, todayBr);
  if (anchor) {
    const d = validityExpiryDiffDays(anchor.expiration_date, todayBr);
    return d === null ? '—' : String(d);
  }
  let minD = null;
  for (const ln of lines) {
    const d = validityExpiryDiffDays(ln.expiration_date, todayBr);
    if (d !== null && (minD === null || d < minD)) minD = d;
  }
  return minD === null ? '—' : String(minD);
}

function validityQtyAllocatedAndRemaining(row, opKey) {
  const lines = row.lines || [];
  const linesOp = lines.filter((l) => String(l.operational_date || '').slice(0, 10) === opKey);
  const sums = sumValidityLineQuantities(linesOp);
  const bal =
    validityDayCountState.ok && validityDayCountState.dayKey === opKey
      ? validityDayCountState.balances[row.cod]
      : null;
  const baseCx = bal ? Math.max(0, Math.round(Number(bal.caixa) || 0)) : 0;
  const baseUn = bal ? Math.max(0, Math.round(Number(bal.unidade) || 0)) : 0;
  const hasBase = baseCx > 0 || baseUn > 0;
  const remCx = hasBase ? Math.max(0, baseCx - sums.cx) : null;
  const remUn = hasBase ? Math.max(0, baseUn - sums.un) : null;
  const withParts = [];
  if (sums.cx > 0) withParts.push(`${formatIntegerBR(sums.cx)} CX`);
  if (sums.un > 0) withParts.push(`${formatIntegerBR(sums.un)} UN`);
  const withLabel = withParts.length ? withParts.join(' · ') : linesOp.length ? '0' : '—';
  let withoutLabel = '—';
  if (hasBase && (remCx > 0 || remUn > 0)) {
    const rp = [];
    if (baseCx > 0 && remCx > 0) rp.push(`${formatIntegerBR(remCx)} CX`);
    if (baseUn > 0 && remUn > 0) rp.push(`${formatIntegerBR(remUn)} UN`);
    withoutLabel = rp.join(' · ') || '—';
  } else if (!hasBase && linesOp.length) {
    withoutLabel = '—';
  }
  return { withLabel, withoutLabel, sums, remCx, remUn, hasBase };
}

function getLatestValidityLaunchMeta(codRaw) {
  const cod = normalizeItemCode(codRaw);
  let best = null;
  const consider = (observed_at, actor_username, device_name, isLocal) => {
    if (!observed_at) return;
    const s = String(observed_at);
    if (!best || s > best.obs) {
      best = { obs: s, actor: actor_username || null, dev: device_name || null, isLocal: !!isLocal };
    }
  };
  const b = loadValidityBucketRaw();
  for (const k of Object.keys(b)) {
    const arr = b[k];
    if (!Array.isArray(arr)) continue;
    for (const ev of arr) {
      if (normalizeItemCode(ev.cod_produto) !== cod) continue;
      consider(ev.observed_at, null, ev.device_name, true);
    }
  }
  for (const ln of validityServerLines || []) {
    if (normalizeItemCode(ln.cod_produto) !== cod) continue;
    consider(ln.observed_at, ln.actor_username, ln.device_name, false);
  }
  if (!best) return { whenIso: null, who: '—' };
  const who = (best.actor && String(best.actor).trim()) || (best.dev && String(best.dev).trim()) || (best.isLocal ? 'Este aparelho' : '—');
  return { whenIso: best.obs, who };
}

function buildValidityExecutiveNarrativeLines(rows, todayBr) {
  const out = [];
  let nWithout = 0;
  let nNoCount = 0;
  const groupScore = new Map();

  let nExpired = 0;
  let nD30 = 0;
  for (const row of rows) {
    const lines = row.lines || [];
    const snap = getValidityLastCountSnapshot(row.cod);
    const g = validityProductGroupLabel(row.product);
    if (!lines.length) {
      nWithout += 1;
      continue;
    }
    if (!snap) nNoCount += 1;
    const w = operationalValidityPrimaryCategory(lines, todayBr);
    if (w === 'expired') nExpired += 1;
    else if (w === 'd30') nD30 += 1;
    const s = validityPriorityScore(row, todayBr);
    const prev = groupScore.get(g);
    if (prev === undefined || s < prev) groupScore.set(g, s);
  }

  const nRisk60 = rows.filter((row) => {
    const lines = row.lines || [];
    if (!lines.length) return false;
    const w = operationalValidityPrimaryCategory(lines, todayBr);
    return w === 'expired' || w === 'd30' || w === 'd60';
  }).length;

  if (nExpired > 0 || nD30 > 0) {
    out.push(
      `No filtro atual: ${nExpired} produto(s) vencido(s) e ${nD30} com vencimento em até 30 dias (${nRisk60} com criticidade até 60 dias).`,
    );
  }
  if (nWithout > 0) {
    out.push(`${nWithout} produto(s) ainda estão sem validade lançada.`);
  }
  if (nNoCount > 0) {
    out.push(`${nNoCount} produto(s) estão sem contagem de referência.`);
  }
  if (groupScore.size) {
    let worstG = null;
    let worstS = Infinity;
    for (const [g, sc] of groupScore) {
      if (g && g !== '—' && sc < worstS) {
        worstS = sc;
        worstG = g;
      }
    }
    if (worstG) {
      out.push(`O grupo com maior criticidade no filtro atual é ${worstG}.`);
    }
  }
  if (!out.length) {
    out.push('Nenhum alerta adicional no filtro atual — revisar KPIs acima para o panorama completo.');
  }
  return out;
}

function buildValidityAnalysisExportPayload(rows, todayBr, executiveLines, summaryKpis) {
  const opKey = getActiveValidityOpDateKey();
  const exportRows = rows.map((row) => {
    const lines = row.lines || [];
    const snap = getValidityLastCountSnapshot(row.cod);
    const st = validityStatusMainShort(operationalValidityPrimaryCategory(lines, todayBr), lines.length > 0, !!snap);
    const vKey = validityRowVisualKey(row, todayBr);
    const anchorLn = operationalAnchorLine(lines, todayBr);
    const nextIso = anchorLn ? String(anchorLn.expiration_date || '').slice(0, 10) : '';
    const band = lines.length > 0 ? validityRiskLabel(operationalValidityPrimaryCategory(lines, todayBr)) : '—';
    const q = validityQtyAllocatedAndRemaining(row, opKey);
    const launch = getLatestValidityLaunchMeta(row.cod);
    const countRef = snap ? `${formatIntegerBR(snap.cx)} CX / ${formatIntegerBR(snap.un)} UN` : 'Sem contagem';
    return {
      cod_produto: row.cod,
      produto: String(row.product?.cod_grup_descricao || row.cod || '').trim(),
      grupo: validityProductGroupLabel(row.product),
      situacao_key: st.key,
      situacao: st.label,
      visual_key: vKey,
      proximo_vencimento: nextIso,
      proximo_vencimento_br: anchorLn
        ? formatDateBrFromIso(nextIso)
        : lines.length > 0
          ? 'Vencidos'
          : '—',
      dias_para_vencer: validityDaysToExpiryDisplay(lines, todayBr),
      faixa: band,
      faixa_key: lines.length ? operationalValidityPrimaryCategory(lines, todayBr) : 'none',
      qtd_com_validade: q.withLabel,
      qtd_sem_validade: q.withoutLabel,
      contagem_referencia: countRef,
      ultimo_lancamento_op: (() => {
        const iso = mergedLastValidityLaunchDateIso(row.cod);
        return iso ? formatDateBrFromIso(iso) : '—';
      })(),
      ultimo_lancamento_observado_em: launch.whenIso,
      responsavel_ultimo: launch.who,
    };
  });

  const historyFlat = [];
  for (const row of rows) {
    const lines = [...(row.lines || [])].sort((a, b) =>
      String(b.observed_at || '').localeCompare(String(a.observed_at || '')),
    );
    const take = lines.slice(0, 8);
    for (const ln of take) {
      historyFlat.push({
        cod_produto: row.cod,
        produto: String(row.product?.cod_grup_descricao || row.cod || '').trim(),
        vencimento: String(ln.expiration_date || '').slice(0, 10),
        cx: Math.max(0, Math.round(Number(ln.quantity_cx) || 0)),
        un: Math.max(0, Math.round(Number(ln.quantity_un) || 0)),
        observado_em: ln.observed_at || null,
        responsavel: (ln.actor_username && String(ln.actor_username).trim()) || (ln.device_name && String(ln.device_name).trim()) || null,
        dia_operacional: String(ln.operational_date || '').slice(0, 10),
      });
    }
  }

  return {
    operational_date: opKey,
    brazil_today: todayBr,
    last_sync_display: formatValidityLastSyncDisplay(),
    executive_lines: executiveLines,
    summary_kpis: summaryKpis,
    rows: exportRows,
    history_flat: historyFlat,
  };
}

/**
 * Envio futuro por e-mail (servidor): anexar o mesmo .xlsx deste export e enviar multipart
 * para um endpoint dedicado, por exemplo POST /notifications/email com campos to[], subject, body_text.
 */
/** EMAIL_VALIDITY_REPORT_ATTACH: reutilizar `payload` + blob deste fluxo como anexo no envio SMTP/API futuro. */
async function downloadValidityAnalysisExcel(payload) {
  const token = getToken();
  if (!token) {
    setValidityFeedback('Sessao expirada. Faca login novamente.', true);
    return;
  }
  if (!navigator.onLine) {
    setValidityFeedback('Sem conexao para exportar.', true);
    return;
  }
  try {
    const resp = await apiFetch(API_VALIDITY_ANALYSIS_EXPORT_XLSX, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (handleUnauthorizedResponse(resp)) return;
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const d = err.detail;
      const msg = typeof d === 'string' ? d : 'Falha ao gerar Excel.';
      setValidityFeedback(msg, true);
      return;
    }
    const blob = await resp.blob();
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    const name = m ? m[1] : `analise_validades_${payload.operational_date || getBrazilDateKey()}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window._validityLastExportPayload = payload;
    window._validityLastExportBlob = blob;
    setValidityFeedback('Excel gerado com sucesso.');
  } catch {
    setValidityFeedback('Erro de rede ao exportar Excel.', true);
  }
}

async function exportValidityAnalysisExcelFromUi() {
  const todayBr = getBrazilDateKey();
  const isActive = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s || s === 'ativo' || s === 's' || s === 'sim' || s === '1' || s === 'true') return true;
    return false;
  };
  const ativos = (validityProductsCache || []).filter((p) => isActive(p.status));
  const allRows = ativos.map(buildValidityRowForProduct);
  const sortMode = (document.getElementById('validity-analysis-sort')?.value || 'priority').trim();
  const rows = sortValidityRows(filterValidityAnalysisRows(allRows), sortMode, todayBr);
  const narrative = buildValidityExecutiveNarrativeLines(rows, todayBr);
  const numEl = (id) => Math.max(0, Math.round(Number(String(document.getElementById(id)?.textContent || '0').trim()) || 0));
  const summaryKpis = {
    with: numEl('validity-analysis-kpi-with'),
    without: numEl('validity-analysis-kpi-without'),
    expired: numEl('validity-analysis-kpi-expired'),
    d30: numEl('validity-analysis-kpi-d30'),
    d60: numEl('validity-analysis-kpi-d60'),
    d90: numEl('validity-analysis-kpi-d90'),
    d120: numEl('validity-analysis-kpi-d120'),
    d150: numEl('validity-analysis-kpi-d150'),
    d180: numEl('validity-analysis-kpi-d180'),
    oldbase: numEl('validity-analysis-kpi-oldbase'),
    nocount: numEl('validity-analysis-kpi-nocount'),
    filtered_total: rows.length,
  };
  const payload = buildValidityAnalysisExportPayload(rows, todayBr, narrative, summaryKpis);
  await downloadValidityAnalysisExcel(payload);
}

function openValidityOperationalForProduct(codRaw) {
  const cod = normalizeItemCode(codRaw);
  if (!cod) return;
  setActiveModule('validity', true);
  const inp = document.getElementById('validity-op-item-code');
  if (inp) {
    inp.value = cod;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function openValidityEmailPrepDialog() {
  const dlg = document.getElementById('validity-email-prep-dialog');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const op = getActiveValidityOpDateKey();
  const subj = document.getElementById('validity-email-subject');
  const body = document.getElementById('validity-email-body');
  if (subj && !subj.value.trim()) {
    subj.value = `Análise de validades — ${op}`;
  }
  if (body && !body.value.trim()) {
    body.value =
      `Segue em anexo a análise de validades (${op}).\n\n` +
      `Última sincronização: ${formatValidityLastSyncDisplay()}\n\n` +
      `---\n` +
      `Gere o Excel pela tela antes de enviar (botão "Gerar Excel agora" abaixo, se ainda não exportou).`;
  }
  dlg.showModal();
}

async function exportValidityAnalysisExcelForSingleCod(codRaw) {
  const cod = normalizeItemCode(codRaw);
  const row = window._validityRowsByCod?.get(cod);
  if (!row) {
    setValidityFeedback('Produto nao encontrado na analise atual.', true);
    return;
  }
  const todayBr = getBrazilDateKey();
  const narrative = buildValidityExecutiveNarrativeLines([row], todayBr);
  const numEl = (id) => Math.max(0, Math.round(Number(String(document.getElementById(id)?.textContent || '0').trim()) || 0));
  const summaryKpis = {
    with: numEl('validity-analysis-kpi-with'),
    without: numEl('validity-analysis-kpi-without'),
    expired: numEl('validity-analysis-kpi-expired'),
    d30: numEl('validity-analysis-kpi-d30'),
    d60: numEl('validity-analysis-kpi-d60'),
    d90: numEl('validity-analysis-kpi-d90'),
    d120: numEl('validity-analysis-kpi-d120'),
    d150: numEl('validity-analysis-kpi-d150'),
    d180: numEl('validity-analysis-kpi-d180'),
    oldbase: numEl('validity-analysis-kpi-oldbase'),
    nocount: numEl('validity-analysis-kpi-nocount'),
    filtered_total: 1,
  };
  const payload = buildValidityAnalysisExportPayload([row], todayBr, narrative, summaryKpis);
  await downloadValidityAnalysisExcel(payload);
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

async function loadValidityLinesFromServer(includeAllDays = false) {
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
    if (includeAllDays) {
      params.set('include_all_days', 'true');
    } else {
      params.set('operational_date', getActiveValidityOpDateKey());
    }
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

function _validityMaxDateStr(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Dias civis entre duas datas YYYY-MM-DD (later − earlier). */
function _validityDaysBetweenCalendar(laterBr, earlierBr) {
  if (!laterBr || !earlierBr) return null;
  const a = new Date(`${laterBr}T12:00:00`);
  const b = new Date(`${earlierBr}T12:00:00`);
  return Math.round((a - b) / 86400000);
}

function getLocalLastValidityOperationalDayForCode(codRaw) {
  const c = normalizeItemCode(codRaw);
  const b = loadValidityBucketRaw();
  let maxD = null;
  for (const k of Object.keys(b)) {
    const arr = b[k];
    if (!Array.isArray(arr)) continue;
    for (const ev of arr) {
      if (normalizeItemCode(ev.cod_produto) === c) {
        const d = String(ev.operational_day || k || '').slice(0, 10);
        if (d.length >= 10) maxD = _validityMaxDateStr(maxD, d);
      }
    }
  }
  return maxD;
}

function mergedLastValidityLaunchDateIso(codRaw) {
  const cod = normalizeItemCode(codRaw);
  const fromServer = validityLastLaunchByCode[cod] || null;
  const fromLocal = getLocalLastValidityOperationalDayForCode(cod);
  return _validityMaxDateStr(fromServer, fromLocal);
}

async function loadValidityLastLaunchFromServer() {
  const token = getToken();
  if (!token || isAccessTokenExpired(token)) {
    validityLastLaunchByCode = {};
    return;
  }
  try {
    const resp = await apiFetch(API_VALIDITY_LAST_LAUNCH, { headers: getAuthHeaders() });
    if (handleUnauthorizedResponse(resp)) {
      validityLastLaunchByCode = {};
      return;
    }
    if (!resp.ok) {
      validityLastLaunchByCode = {};
      return;
    }
    const data = await resp.json();
    const raw = data.last_by_code && typeof data.last_by_code === 'object' ? data.last_by_code : {};
    const norm = {};
    for (const k of Object.keys(raw)) {
      const c = normalizeItemCode(k);
      if (!c) continue;
      const v = String(raw[k] || '').slice(0, 10);
      if (v.length >= 10) norm[c] = _validityMaxDateStr(norm[c], v);
    }
    validityLastLaunchByCode = norm;
  } catch {
    validityLastLaunchByCode = {};
  }
}

/**
 * Ordenação operacional: atrasados / sem histórico primeiro, pendentes no prazo, lançados por último.
 * Desempate: descrição do produto (pt-BR).
 */
function validityOpOperationalTier(row) {
  if (row.hasLaunchOnOpDay) return 2;
  const last = row.lastLaunch;
  const ds = row.daysSinceLast;
  if (last == null || ds == null || ds > 7) return 0;
  return 1;
}

const VALIDITY_OP_BUCKET_ORDER = {
  criticos: 0,
  sem_hist: 1,
  sem_base: 2,
  pendentes: 3,
  parciais: 4,
  concluidos: 5,
};

function sumValidityLineQuantities(linesOp) {
  let cx = 0;
  let un = 0;
  for (const ln of linesOp || []) {
    cx += Math.max(0, Math.round(Number(ln.quantity_cx) || 0));
    un += Math.max(0, Math.round(Number(ln.quantity_un) || 0));
  }
  return { cx, un };
}

function deriveValidityDistributionStatus(baseCx, baseUn, sums) {
  const hasBase = baseCx > 0 || baseUn > 0;
  const anyLine = sums.cx > 0 || sums.un > 0;
  if (!hasBase) {
    return { key: 'no_base', short: 'Sem base', label: 'Sem base de contagem' };
  }
  const needCx = baseCx > 0;
  const needUn = baseUn > 0;
  const cxOk = !needCx || sums.cx >= baseCx;
  const unOk = !needUn || sums.un >= baseUn;
  if (anyLine && cxOk && unOk) {
    return { key: 'complete', short: 'Concluído', label: 'Concluído' };
  }
  if (anyLine && (!cxOk || !unOk)) {
    return { key: 'partial', short: 'Parcial', label: 'Parcial' };
  }
  return { key: 'none', short: 'Sem lançamento', label: 'Sem lançamento' };
}

function validityDistChipClass(distKey) {
  if (distKey === 'complete') return 'validity-chip validity-chip--ok';
  if (distKey === 'partial') return 'validity-chip validity-chip--over';
  if (distKey === 'no_base') return 'validity-chip validity-chip--muted';
  return 'validity-chip validity-chip--warn';
}

function assignValidityOperationalBucket(row) {
  const { distStatus, isOverdueStrict, hasLaunchOnOpDay, noHistory, hasCountBase } = row;
  if (distStatus.key === 'partial') return 'parciais';
  if (distStatus.key === 'complete') return 'concluidos';
  if (isOverdueStrict && !hasLaunchOnOpDay) return 'criticos';
  if (noHistory && !hasLaunchOnOpDay) return 'sem_hist';
  if (!hasCountBase) return 'sem_base';
  return 'pendentes';
}

function sortValidityOperationalModels(models) {
  const descKey = (row) =>
    String((row.product && row.product.cod_grup_descricao) || row.cod || '').trim();
  models.sort((a, b) => {
    const bo =
      VALIDITY_OP_BUCKET_ORDER[a.bucket] - VALIDITY_OP_BUCKET_ORDER[b.bucket];
    if (bo !== 0) return bo;
    const ta = validityOpOperationalTier(a);
    const tb = validityOpOperationalTier(b);
    if (ta !== tb) return ta - tb;
    return descKey(a).localeCompare(descKey(b), 'pt-BR', { sensitivity: 'base' });
  });
}

/**
 * Dois lançamentos mais recentes por produto (data/hora do registro), unindo bucket local e linhas do servidor no dia carregado.
 * Ao salvar um novo lançamento, ele vira "atual" e o anterior passa a ser "penúltimo".
 */
function buildValidityOpLaunchPairsByCode() {
  const map = {};
  const add = (codRaw, observed_at, expiration_date, dedupeKey) => {
    if (!observed_at || !dedupeKey) return;
    const cod = normalizeItemCode(codRaw);
    if (!cod) return;
    if (!map[cod]) map[cod] = [];
    map[cod].push({
      observed_at: String(observed_at),
      expiration_date: String(expiration_date || '').slice(0, 10),
      key: dedupeKey,
    });
  };
  const b = loadValidityBucketRaw();
  for (const k of Object.keys(b)) {
    const arr = b[k];
    if (!Array.isArray(arr)) continue;
    for (const ev of arr) {
      if (!ev || !ev.observed_at) continue;
      const dk = ev.client_event_id
        ? `e-${ev.client_event_id}`
        : `d-${k}-${String(ev.expiration_date || '').slice(0, 10)}-${ev.observed_at}`;
      add(ev.cod_produto, ev.observed_at, ev.expiration_date, dk);
    }
  }
  for (const ln of validityServerLines || []) {
    if (!ln || !ln.observed_at) continue;
    const dk = ln.id != null ? `s-${ln.id}` : `c-${ln.client_event_id || ''}`;
    add(ln.cod_produto, ln.observed_at, ln.expiration_date, dk);
  }
  const out = {};
  for (const cod of Object.keys(map)) {
    const list = map[cod];
    const uniq = new Map();
    for (const x of [...list].sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))) {
      if (!uniq.has(x.key)) uniq.set(x.key, x);
    }
    const top = [...uniq.values()]
      .sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))
      .slice(0, 2);
    out[cod] = { atual: top[0] || null, anterior: top[1] || null };
  }
  return out;
}

function buildValidityOperationalRowModel(p, opKey, todayBr, launchPairs) {
  const cod = normalizeItemCode(p.cod_produto || '');
  const lines = getMergedValidityLinesForProduct(cod);
  const linesOp = lines.filter((l) => String(l.operational_date || '').slice(0, 10) === opKey);
  const hasLaunchOnOpDay = linesOp.length > 0;
  const lastLaunch = mergedLastValidityLaunchDateIso(cod);
  const daysSinceLast = lastLaunch ? _validityDaysBetweenCalendar(todayBr, lastLaunch) : null;
  const noHistory = !lastLaunch;
  const isOverdueStrict = lastLaunch != null && daysSinceLast != null && daysSinceLast > 7;
  const isBacklog = !hasLaunchOnOpDay && (noHistory || isOverdueStrict);
  const anchor = linesOp.length ? operationalAnchorLine(linesOp, todayBr) : null;
  const validadeLabel = anchor
    ? formatDateBrFromIso(String(anchor.expiration_date || '').slice(0, 10))
    : '—';
  const pair = (launchPairs && launchPairs[cod]) || { atual: null, anterior: null };
  const bal =
    validityDayCountState.ok && validityDayCountState.dayKey === opKey
      ? validityDayCountState.balances[cod]
      : null;
  const baseCx = bal ? Math.max(0, Math.round(Number(bal.caixa) || 0)) : 0;
  const baseUn = bal ? Math.max(0, Math.round(Number(bal.unidade) || 0)) : 0;
  const hasCountBase = baseCx > 0 || baseUn > 0;
  const distSums = sumValidityLineQuantities(linesOp);
  const distStatus = deriveValidityDistributionStatus(baseCx, baseUn, distSums);
  const remainingCx = Math.max(0, baseCx - distSums.cx);
  const remainingUn = Math.max(0, baseUn - distSums.un);
  const contagemLabel = hasCountBase
    ? [baseCx > 0 ? `${formatIntegerBR(baseCx)} CX` : null, baseUn > 0 ? `${formatIntegerBR(baseUn)} UN` : null]
        .filter(Boolean)
        .join(' · ')
    : '—';
  const distribLabel = hasCountBase
    ? [baseCx > 0 ? `${formatIntegerBR(distSums.cx)} CX` : null, baseUn > 0 ? `${formatIntegerBR(distSums.un)} UN` : null]
        .filter(Boolean)
        .join(' · ') || '0'
    : '—';
  const saldoLabel = hasCountBase
    ? [baseCx > 0 ? `${formatIntegerBR(remainingCx)} CX` : null, baseUn > 0 ? `${formatIntegerBR(remainingUn)} UN` : null]
        .filter(Boolean)
        .join(' · ') || '0'
    : '—';
  const lastLaunchLabel = lastLaunch ? formatDateBrFromIso(lastLaunch) : '—';
  const logAtualLabel = pair.atual ? formatDateTimeBr(pair.atual.observed_at) : '—';
  const logAnteriorLabel = pair.anterior ? formatDateTimeBr(pair.anterior.observed_at) : '—';
  let hintLine = '';
  if (isOverdueStrict && !hasLaunchOnOpDay) {
    hintLine =
      daysSinceLast != null
        ? `Atrasado: sem lançamento há ${daysSinceLast} dia(s).`
        : 'Atrasado: sem lançamento há mais de 7 dias.';
  }
  const chips = [];
  chips.push(
    `<span class="${validityDistChipClass(distStatus.key)}">${escapeHtml(distStatus.label)}</span>`,
  );
  if (noHistory && !hasLaunchOnOpDay) {
    chips.push('<span class="validity-chip validity-chip--warn">Sem histórico</span>');
  }
  if (isOverdueStrict && !hasLaunchOnOpDay) {
    chips.push('<span class="validity-chip validity-chip--danger">Atrasado (validade)</span>');
  }
  if (hasLaunchOnOpDay) {
    chips.push('<span class="validity-chip validity-chip--ok">Lançado hoje</span>');
  }
  const badgeHtml = `<div class="validity-op-badges-row">${chips.join('')}</div>`;
  const bucket = assignValidityOperationalBucket({
    distStatus,
    isOverdueStrict,
    hasLaunchOnOpDay,
    noHistory,
    hasCountBase,
  });
  return {
    product: p,
    cod,
    lines,
    linesOp,
    hasLaunchOnOpDay,
    lastLaunch,
    daysSinceLast,
    noHistory,
    isOverdueStrict,
    isBacklog,
    contagemLabel,
    lastLaunchLabel,
    validadeLabel,
    logAtualLabel,
    logAnteriorLabel,
    hintLine,
    badgeHtml,
    baseCx,
    baseUn,
    hasCountBase,
    distSums,
    distStatus,
    remainingCx,
    remainingUn,
    distribLabel,
    saldoLabel,
    bucket,
  };
}

function filterValidityOperationalModels(rows) {
  const term = (document.getElementById('validity-op-item-code')?.value || '').trim().toLowerCase();
  const grupo = (document.getElementById('validity-op-group')?.value || '').trim().toLowerCase();
  return rows.filter((row) => {
    const p = row.product;
    const desc = (p.cod_grup_descricao || '').toLowerCase();
    const marca = (p.cod_grup_marca || '').toLowerCase();
    const cod = String(row.cod || '').toLowerCase();
    if (term) {
      const ok = cod.includes(term) || desc.includes(term) || marca.includes(term);
      if (!ok) return false;
    }
    if (grupo) {
      if (!desc.includes(grupo)) return false;
    }
    return true;
  });
}

const VALIDITY_OP_SECTION_TITLES = {
  criticos: 'Críticos',
  sem_hist: 'Sem histórico',
  sem_base: 'Sem base de contagem',
  pendentes: 'Pendentes',
  parciais: 'Parciais',
  concluidos: 'Concluídos',
};

function buildValidityOperationalLotRowHtml(ln, codRaw) {
  const enc = encodeURIComponent(codRaw);
  const exp = formatDateBrFromIso(String(ln.expiration_date || '').slice(0, 10));
  const qcx = Math.max(0, Math.round(Number(ln.quantity_cx) || 0));
  const qun = Math.max(0, Math.round(Number(ln.quantity_un) || 0));
  const parts = [];
  if (qcx > 0) parts.push(`${formatIntegerBR(qcx)} CX`);
  if (qun > 0) parts.push(`${formatIntegerBR(qun)} UN`);
  const qtyPart = parts.length ? parts.join(' · ') : '—';
  const localMark = ln._local
    ? '<span class="validity-op-lot-flag" title="Ainda não sincronizado">Local</span>'
    : '';
  const lid = ln.id != null ? String(ln.id) : '';
  const cidRaw = String(ln.client_event_id || '');
  const cidAttr = escapeHtml(cidRaw);
  const removable = isValidityOperationalEditable();
  const rem = removable
    ? `<button type="button" class="btn-text btn-validity-remove-line" data-line-id="${lid}" data-client-id="${cidAttr}" data-coderef="${enc}">Remover</button>`
    : '';
  return `<div class="validity-op-lot-row">
    <div class="validity-op-lot-main">
      <span class="validity-op-lot-qty">${escapeHtml(qtyPart)}</span>
      <span class="validity-op-lot-exp muted">venc. ${escapeHtml(exp)}</span>
      ${localMark}
    </div>
    <div class="validity-op-lot-actions">${rem}</div>
  </div>`;
}

function buildValidityOperationalExpandHtml(row, vi) {
  const enc = encodeURIComponent(row.cod);
  const sorted = [...(row.linesOp || [])].sort((a, b) =>
    String(b.observed_at || '').localeCompare(String(a.observed_at || '')),
  );
  const lotsHtml = sorted.length
    ? `<div class="validity-op-lots-head">Lotes do dia</div><div class="validity-op-lots-list">${sorted
        .map((ln) => buildValidityOperationalLotRowHtml(ln, row.cod))
        .join('')}</div>`
    : '<p class="validity-op-lots-empty muted">Nenhum lote neste dia.</p>';
  const fieldExp = `validity-op-new-exp-${vi}`;
  const fieldCcx = `validity-op-new-cx-${vi}`;
  const fieldCun = `validity-op-new-un-${vi}`;
  const showCx = row.baseCx > 0;
  const showUn = row.baseUn > 0;
  const cxField = showCx
    ? `<div class="validity-op-new-field">
        <label class="validity-op-new-label" for="${fieldCcx}">Quantidade (CX)</label>
        <input type="number" id="${fieldCcx}" class="validity-op-input validity-op-new-qty-cx" min="0" step="1" inputmode="numeric" autocomplete="off" aria-label="Quantidade em caixas do lote" />
      </div>`
    : '';
  const unField = showUn
    ? `<div class="validity-op-new-field">
        <label class="validity-op-new-label" for="${fieldCun}">Quantidade (UN)</label>
        <input type="number" id="${fieldCun}" class="validity-op-input validity-op-new-qty-un" min="0" step="1" inputmode="numeric" autocomplete="off" aria-label="Quantidade em unidades do lote" />
      </div>`
    : '';
  const qtyInner = `${cxField}${unField}`;
  const qtyRow = qtyInner ? `<div class="validity-op-new-qty-row">${qtyInner}</div>` : '';
  return `<div class="validity-op-expand-summary">
      <div class="validity-op-expand-line"><span class="muted">Base contagem (dia)</span><strong>${escapeHtml(row.contagemLabel)}</strong></div>
      <div class="validity-op-expand-line"><span class="muted">Distribuído</span><strong>${escapeHtml(row.distribLabel)}</strong></div>
      <div class="validity-op-expand-line"><span class="muted">Saldo</span><strong>${escapeHtml(row.saldoLabel)}</strong></div>
    </div>
    ${lotsHtml}
    <div class="validity-op-new-lot">
      <div class="validity-op-new-lot-title">Novo lote</div>
      <div class="validity-op-new-lot-grid">
        ${qtyRow}
        <div class="validity-op-new-field validity-op-new-field--date">
          <label class="validity-op-new-label" for="${fieldExp}">Data de validade</label>
          <input type="text" id="${fieldExp}" class="validity-op-input validity-op-date-input validity-op-new-exp" data-coderef="${enc}"
            inputmode="numeric" maxlength="10" enterkeyhint="done" autocomplete="off" placeholder="DD/MM/AAAA" aria-label="Data de validade do lote" />
        </div>
        <button type="button" class="btn btn-primary validity-op-save-lot" data-coderef="${enc}">Salvar lote</button>
      </div>
      <p class="validity-op-expand-audit muted">Último lanç. validade: ${escapeHtml(row.lastLaunchLabel)} · Próx. venc. (ref.): ${escapeHtml(row.validadeLabel)}</p>
    </div>`;
}

function renderValidityOperationalView() {
  const ul = document.getElementById('validity-op-list');
  const totalEl = document.getElementById('validity-op-products-total');
  if (!ul) return;

  const isActive = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s || s === 'ativo' || s === 's' || s === 'sim' || s === '1' || s === 'true') return true;
    return false;
  };
  const ativos = (validityProductsCache || []).filter((p) => isActive(p.status));
  const opKey = getActiveValidityOpDateKey();
  const todayBr = getBrazilDateKey();

  const launchPairs = buildValidityOpLaunchPairsByCode();
  const models = ativos.map((p) => buildValidityOperationalRowModel(p, opKey, todayBr, launchPairs));
  sortValidityOperationalModels(models);
  const visible = filterValidityOperationalModels(models);

  if (totalEl) totalEl.textContent = `${visible.length} ${visible.length === 1 ? 'item' : 'itens'}`;

  const withBase = visible.filter((r) => r.hasCountBase);
  const completeN = withBase.filter((r) => r.distStatus.key === 'complete').length;
  updateValidityOpProgress(completeN, withBase.length, opKey, todayBr);

  updateValidityOpStickyMeta();
  updateValidityReadonlyState();
  ul.innerHTML = '';
  if (!visible.length) {
    ul.innerHTML =
      '<li class="validity-op-empty"><span class="muted">Nenhum produto no filtro atual.</span></li>';
    bindValidityOperationalListOnce();
    return;
  }

  let lastBucket = null;
  let vi = 0;
  visible.forEach((row) => {
    if (row.bucket !== lastBucket) {
      lastBucket = row.bucket;
      const sec = document.createElement('li');
      sec.className = 'validity-op-section-head';
      sec.setAttribute('role', 'presentation');
      sec.innerHTML = `<span class="validity-op-section-title">${VALIDITY_OP_SECTION_TITLES[row.bucket] || row.bucket}</span>`;
      ul.appendChild(sec);
    }
    const p = row.product;
    const name = escapeHtml((p.cod_grup_descricao || row.cod || '').trim());
    const codEsc = escapeHtml(row.cod);
    const enc = encodeURIComponent(row.cod);
    const grupo = escapeHtml((p.cod_grup_segmento || p.segmento || '').trim() || '—');
    const marca = escapeHtml((p.cod_grup_marca || '').trim() || '—');
    let zone = '';
    if (row.isOverdueStrict && !row.hasLaunchOnOpDay) zone += ' validity-op-item--overdue';
    if (row.noHistory && !row.hasLaunchOnOpDay) zone += ' validity-op-item--nohistory';
    if (row.distStatus.key === 'partial') zone += ' validity-op-item--partial';
    if (row.distStatus.key === 'complete') zone += ' validity-op-item--complete';
    const li = document.createElement('li');
    li.className = `validity-op-item validity-op-queue-item${zone}`;
    li.dataset.codProduto = row.cod;
    li.dataset.baseCx = String(row.baseCx);
    li.dataset.baseUn = String(row.baseUn);
    const hintHtml = row.hintLine
      ? `<p class="validity-op-hint muted">${escapeHtml(row.hintLine)}</p>`
      : '';
    li.innerHTML = `
      <div class="validity-op-main" role="button" tabindex="0" aria-expanded="false" aria-label="Abrir lotes de validade do produto">
        <div class="validity-op-queue-top">
          <span class="validity-op-queue-name">${name}</span>
          <span class="validity-op-queue-cod">${codEsc}</span>
        </div>
        <p class="validity-op-queue-sub muted">${grupo} · ${marca}</p>
        <div class="validity-op-queue-metrics">
          <div><span class="vom-k">Base</span><span class="vom-v">${escapeHtml(row.contagemLabel)}</span></div>
          <div><span class="vom-k">Distrib.</span><span class="vom-v">${escapeHtml(row.distribLabel)}</span></div>
          <div><span class="vom-k">Saldo</span><span class="vom-v">${escapeHtml(row.saldoLabel)}</span></div>
          <div><span class="vom-k">Próx. venc.</span><span class="vom-v">${escapeHtml(row.validadeLabel)}</span></div>
        </div>
        ${row.badgeHtml}
        ${hintHtml}
      </div>
      <div class="validity-op-item-expand" aria-hidden="true">${buildValidityOperationalExpandHtml(row, vi)}</div>`;
    ul.appendChild(li);
    vi += 1;
  });

  bindValidityOperationalListOnce();
}

function updateValidityOpStickyMeta() {
  const dateEl = document.getElementById('validity-op-operational-date-label');
  if (dateEl) {
    const k = getActiveValidityOpDateKey();
    dateEl.textContent = formatDateBrFromIso(k);
  }
  const syncEl = document.getElementById('validity-op-sync-hint');
  if (syncEl) {
    syncEl.textContent = formatValidityLastSyncDisplay();
  }
}

let validityOpSaveGuard = { t: 0, key: '' };

function saveValidityOperationalNewLot(item) {
  if (!item) return;
  const cod = normalizeItemCode(item.dataset.codProduto || '');
  if (!cod) return;
  const expInp = item.querySelector('.validity-op-new-exp');
  const exp = parseValidityDateInputToIso(expInp && expInp.value);
  if (!exp) {
    setValidityFeedback('Informe a data de validade em DD/MM/AAAA.', true);
    return;
  }
  const baseCx = Math.max(0, Math.round(Number(item.dataset.baseCx || 0)));
  const baseUn = Math.max(0, Math.round(Number(item.dataset.baseUn || 0)));
  const cxInp = item.querySelector('.validity-op-new-qty-cx');
  const unInp = item.querySelector('.validity-op-new-qty-un');
  const qcx = cxInp ? Math.max(0, Math.round(Number(cxInp.value) || 0)) : 0;
  const qun = unInp ? Math.max(0, Math.round(Number(unInp.value) || 0)) : 0;
  if (baseCx > 0 && baseUn <= 0 && qcx <= 0) {
    setValidityFeedback('Informe a quantidade em caixas.', true);
    return;
  }
  if (baseUn > 0 && baseCx <= 0 && qun <= 0) {
    setValidityFeedback('Informe a quantidade em unidades.', true);
    return;
  }
  if (baseCx > 0 && baseUn > 0 && qcx <= 0 && qun <= 0) {
    setValidityFeedback('Informe quantidade em CX e/ou UN.', true);
    return;
  }
  const lines = getMergedValidityLinesForProduct(cod);
  const opKey = getActiveValidityOpDateKey();
  const linesOp = lines.filter((l) => String(l.operational_date || '').slice(0, 10) === opKey);
  const sums = sumValidityLineQuantities(linesOp);
  if (baseCx > 0 && sums.cx + qcx > baseCx) {
    setValidityFeedback(
      `Máximo ${baseCx} CX (já distribuído ${sums.cx}; restam ${Math.max(0, baseCx - sums.cx)}).`,
      true,
    );
    return;
  }
  if (baseUn > 0 && sums.un + qun > baseUn) {
    setValidityFeedback(
      `Máximo ${baseUn} UN (já distribuído ${sums.un}; restam ${Math.max(0, baseUn - sums.un)}).`,
      true,
    );
    return;
  }
  const gk = `${cod}|${exp}|${qcx}|${qun}`;
  const now = Date.now();
  if (validityOpSaveGuard.key === gk && now - validityOpSaveGuard.t < 900) {
    return;
  }
  validityOpSaveGuard = { t: now, key: gk };
  registerValidityLineLocal(cod, exp, qcx, qun);
  if (cxInp) cxInp.value = '';
  if (unInp) unInp.value = '';
  if (expInp) expInp.value = '';
  const ul = document.getElementById('validity-op-list');
  ul?.querySelectorAll('.validity-op-item--open').forEach((n) => {
    n.classList.remove('validity-op-item--open');
    const ex = n.querySelector('.validity-op-item-expand');
    if (ex) ex.setAttribute('aria-hidden', 'true');
    const m = n.querySelector('.validity-op-main');
    if (m) m.setAttribute('aria-expanded', 'false');
  });
}

function bindValidityOperationalListOnce() {
  const ul = document.getElementById('validity-op-list');
  if (!ul || ul.dataset.validityOpBound === '1') return;
  ul.dataset.validityOpBound = '1';

  const closeAllExcept = (keep) => {
    ul.querySelectorAll('.validity-op-item--open').forEach((n) => {
      if (keep && n === keep) return;
      n.classList.remove('validity-op-item--open');
      const ex = n.querySelector('.validity-op-item-expand');
      if (ex) ex.setAttribute('aria-hidden', 'true');
      const m = n.querySelector('.validity-op-main');
      if (m) m.setAttribute('aria-expanded', 'false');
    });
  };

  ul.addEventListener('input', (e) => {
    const inp = e.target.closest('.validity-op-date-input');
    if (!inp) return;
    applyValidityDateDigitMask(inp);
  });

  ul.addEventListener('click', (e) => {
    const rem = e.target.closest('.btn-validity-remove-line');
    if (rem) {
      e.preventDefault();
      e.stopPropagation();
      const lid = rem.getAttribute('data-line-id');
      const cid = rem.getAttribute('data-client-id');
      const cref = rem.getAttribute('data-coderef') || '';
      const cod = normalizeItemCode(decodeURIComponent(cref));
      removeValidityLine(lid ? Number(lid) : null, cid || null, cod);
      return;
    }
    const saveBtn = e.target.closest('.validity-op-save-lot');
    if (saveBtn) {
      e.preventDefault();
      e.stopPropagation();
      const item = saveBtn.closest('.validity-op-item');
      if (item) saveValidityOperationalNewLot(item);
      return;
    }
    if (e.target.closest('.validity-op-item-expand')) return;
    if (e.target.closest('.validity-op-date-input')) return;
    if (e.target.closest('.validity-op-new-qty-cx') || e.target.closest('.validity-op-new-qty-un')) return;

    const item = e.target.closest('.validity-op-item');
    if (!item) return;

    const main = item.querySelector('.validity-op-main');
    if (!main || !e.target.closest('.validity-op-main')) return;
    const expand = item.querySelector('.validity-op-item-expand');
    const wasOpen = item.classList.contains('validity-op-item--open');
    closeAllExcept(null);
    if (!wasOpen) {
      item.classList.add('validity-op-item--open');
      main.setAttribute('aria-expanded', 'true');
      if (expand) expand.setAttribute('aria-hidden', 'false');
      const codRaw = normalizeItemCode(item.dataset.codProduto || '');
      const lines = getMergedValidityLinesForProduct(codRaw);
      const opKey = getActiveValidityOpDateKey();
      const linesOp = lines.filter((l) => String(l.operational_date || '').slice(0, 10) === opKey);
      const sums = sumValidityLineQuantities(linesOp);
      const baseCx = Math.max(0, Math.round(Number(item.dataset.baseCx || 0)));
      const baseUn = Math.max(0, Math.round(Number(item.dataset.baseUn || 0)));
      const remCx = Math.max(0, baseCx - sums.cx);
      const remUn = Math.max(0, baseUn - sums.un);
      const cxInp = item.querySelector('.validity-op-new-qty-cx');
      const unInp = item.querySelector('.validity-op-new-qty-un');
      if (cxInp) cxInp.value = remCx > 0 ? String(remCx) : baseCx > 0 ? '0' : '';
      if (unInp) unInp.value = remUn > 0 ? String(remUn) : baseUn > 0 ? '0' : '';
      const expInp = item.querySelector('.validity-op-new-exp');
      if (expInp) expInp.value = '';
      setTimeout(() => {
        const focusEl = item.querySelector('.validity-op-new-exp');
        if (focusEl) focusEl.focus();
      }, 80);
    } else {
      main.setAttribute('aria-expanded', 'false');
    }
  });

  ul.addEventListener('keydown', (e) => {
    const inp = e.target.closest('.validity-op-new-exp');
    if (inp && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const item = inp.closest('.validity-op-item');
      if (item) saveValidityOperationalNewLot(item);
      return;
    }
    const main = e.target.closest('.validity-op-main');
    if (!main || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    main.click();
  });
}

async function loadValidityOperationalModule() {
  showDashboard();
  scrollDashboardToTop();
  await loadValidityProductsCatalog();
  await loadValidityDayCountTotals();
  await loadValidityLastLaunchFromServer();
  await loadValidityLinesFromServer(false);
  renderValidityOperationalView();
  updateValidityPendingBadges();
  scrollDashboardToTop();
}

function updateValidityReadonlyState() {
  const editable = isValidityOperationalEditable();
  document
    .getElementById('validity-analysis-shell')
    ?.classList.toggle('validity-products-shell--readonly', !editable);
  document.getElementById('validity-op-shell')?.classList.toggle('count-products-shell--readonly', !editable);
  const msg = !editable
    ? `Modo consulta (${getActiveValidityOpDateKey()}). Lancamentos apenas na data de hoje (${getBrazilDateKey()}).`
    : '';
  const banner = document.getElementById('validity-analysis-readonly-banner');
  if (banner) {
    banner.hidden = editable;
    banner.textContent = msg;
  }
  const bannerOp = document.getElementById('validity-op-readonly-banner');
  if (bannerOp) {
    bannerOp.hidden = editable;
    bannerOp.textContent = msg;
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
  set('validity-analysis-kpi-with', withLine);
  set('validity-analysis-kpi-without', without);
  set('validity-analysis-kpi-expired', expired);
  set('validity-analysis-kpi-d30', c30);
  set('validity-analysis-kpi-d60', c60);
  set('validity-analysis-kpi-d90', c90);
  set('validity-analysis-kpi-d120', c120);
  set('validity-analysis-kpi-d150', c150);
  set('validity-analysis-kpi-d180', c180);
  set('validity-analysis-kpi-oldbase', productsOldBase);
  set('validity-analysis-kpi-nocount', productsNoCount);

  const ls = document.getElementById('validity-analysis-last-sync');
  if (ls) ls.textContent = `Última sincronização: ${formatValidityLastSyncDisplay()}`;

  const total = allRows.length;
  const pct = total > 0 ? Math.min(100, Math.round((withLine / total) * 100)) : 0;
  const fill = document.getElementById('validity-analysis-progress-fill');
  const pp = document.getElementById('validity-analysis-progress-percent');
  const pd = document.getElementById('validity-analysis-progress-detail');
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
  document.querySelectorAll('#validity-analysis-kpi-strip [data-validity-kpi]').forEach((btn) => {
    const k = btn.getAttribute('data-validity-kpi');
    const on = validityActiveKpiKey === k;
    btn.classList.toggle('validity-kpi--active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function filterValidityAnalysisRows(rows) {
  const term = (document.getElementById('validity-analysis-item-code')?.value || '').trim().toLowerCase();
  const grupo = (document.getElementById('validity-analysis-group')?.value || '').trim().toLowerCase();
  const risk = (document.getElementById('validity-analysis-risk-filter')?.value || 'all').trim();
  const todayBr = getBrazilDateKey();

  return rows.filter((row) => {
    const p = row.product;
    const desc = (p.cod_grup_descricao || '').toLowerCase();
    const codigo = (p.cod_produto || '').toLowerCase();
    if (term && !codigo.includes(term) && !desc.includes(term)) return false;
    if (grupo && !desc.includes(grupo)) return false;
    const launch = (document.getElementById('validity-analysis-launch-filter')?.value || 'all').trim();
    if (launch === 'no_line' && row.lines.length > 0) return false;
    if (launch === 'has_line' && row.lines.length === 0) return false;
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
  const sortMode = (document.getElementById('validity-analysis-sort')?.value || 'priority').trim();
  return sortValidityRows(filterValidityAnalysisRows(rows), sortMode, todayBr);
}

function getLatestValidityLineByObserved(lines) {
  if (!lines?.length) return null;
  const withObs = lines.filter((l) => l.observed_at);
  if (withObs.length) {
    return [...withObs].sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))[0];
  }
  return [...lines].sort((a, b) => String(a.expiration_date || '').localeCompare(String(b.expiration_date || '')))[0];
}

function buildValidityHintLine(lines, todayBr) {
  if (!lines?.length) return 'Nenhuma data lançada ainda.';
  const latest = getLatestValidityLineByObserved(lines);
  const exp = latest?.expiration_date ? formatDateBrFromIso(String(latest.expiration_date).slice(0, 10)) : '—';
  return `Última lançada: ${exp}`;
}

function buildValidityDetailBodyHtml(row, todayBr) {
  const p = row.product;
  const cod = row.cod;
  const lines = row.lines || [];
  const opKey = getActiveValidityOpDateKey();
  const linesOp = lines.filter((l) => String(l.operational_date || '').slice(0, 10) === opKey);
  const enc = encodeURIComponent;
  const snap = getValidityLastCountSnapshot(cod);
  const contagemLabel = snap ? `${formatIntegerBR(snap.cx)} CX` : '—';
  const lastLaunchIso = mergedLastValidityLaunchDateIso(cod);
  const lastLaunchLabel = lastLaunchIso ? formatDateBrFromIso(lastLaunchIso) : '—';
  const launchPairs = buildValidityOpLaunchPairsByCode();
  const pair = (launchPairs && launchPairs[cod]) || { atual: null, anterior: null };
  const logAtualLabel = pair.atual ? formatDateTimeBr(pair.atual.observed_at) : '—';
  const logAnteriorLabel = pair.anterior ? formatDateTimeBr(pair.anterior.observed_at) : '—';
  const baseOld = !!(snap && isValidityCountBaseOld(snap.countDate, todayBr));
  const ageDays = snap ? countBaseAgeDays(snap.countDate, todayBr) : null;
  const ageLabel = snap ? formatCountBaseAgeLabel(ageDays) : '—';
  const ageClass = baseOld ? ' validity-metric-v--alert' : '';
  const anchorLn = linesOp.length ? operationalAnchorLine(linesOp, todayBr) : null;
  const nextBr = anchorLn
    ? formatDateBrFromIso(String(anchorLn.expiration_date || '').slice(0, 10))
    : lines.length > 0
      ? 'Vencidos'
      : '—';
  const resumoOperacional = `<div class="validity-analytic-metrics validity-analytic-metrics--expanded">
      <div class="validity-metric"><span class="validity-metric-k">Contagem</span><span class="validity-metric-v">${contagemLabel}</span></div>
      <div class="validity-metric"><span class="validity-metric-k">Último lançamento</span><span class="validity-metric-v">${lastLaunchLabel}</span></div>
      <div class="validity-metric"><span class="validity-metric-k">Validade</span><span class="validity-metric-v">${nextBr}</span></div>
      <div class="validity-metric"><span class="validity-metric-k">Log atual</span><span class="validity-metric-v">${logAtualLabel}</span></div>
      <div class="validity-metric"><span class="validity-metric-k">Log anterior</span><span class="validity-metric-v">${logAnteriorLabel}</span></div>
    </div>`;

  const refMetrics = snap
    ? `<div class="validity-analytic-metrics validity-analytic-metrics--expanded">
        <div class="validity-metric"><span class="validity-metric-k">Última contagem</span><span class="validity-metric-v">${formatIntegerBR(snap.cx)} CX</span></div>
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
          const qcx = Math.max(0, Math.round(Number(ln.quantity_cx) || 0));
          const cxCell = qcx > 0 ? formatIntegerBR(qcx) : '—';
          return `<tr>
            <td>${expBr}</td>
            <td><span class="${rkChip}">${rkLabel}</span></td>
            <td class="muted">${cxCell}</td>
            <td class="muted">${who}</td>
            <td class="muted">${when}</td>
            <td>${delBtn}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="6" class="muted">Nenhuma data neste dia operacional.</td></tr>';

  const codRefEnc = enc(cod);
  const editable = isValidityOperationalEditable();
  const addBlock = editable
    ? `<div class="validity-add-row">
        <div class="validity-add-exp"><label class="sr-only" for="validity-exp-panel-${codRefEnc}">Nova validade</label>
        <input type="date" class="count-filter-input validity-inp-exp" id="validity-exp-panel-${codRefEnc}" data-coderef="${codRefEnc}" /></div>
        <div class="validity-add-cx"><label class="sr-only" for="validity-cx-panel-${codRefEnc}">Caixas nesta validade</label>
        <input type="number" class="count-filter-input validity-inp-cx" id="validity-cx-panel-${codRefEnc}" data-coderef="${codRefEnc}" inputmode="numeric" min="0" step="1" placeholder="CX" aria-label="Quantidade de caixas nesta validade, opcional" /></div>
        <div class="validity-add-actions"><button type="button" class="btn btn-primary validity-btn-add" data-coderef="${codRefEnc}">Adicionar</button></div>
      </div>`
    : '';

  return `${resumoOperacional}${refMetrics}<p class="validity-detail-hint muted">Datas neste dia operacional</p><div class="validity-lines-table-wrap"><table class="validity-lines-table"><thead><tr><th>Vencimento</th><th>Faixa</th><th>Caixas</th><th>Nome</th><th>Quando</th><th></th></tr></thead><tbody>${linesHtml}</tbody></table></div>${addBlock}`;
}

function buildValidityAnalysisSidePanelHtml(row, todayBr) {
  const p = row.product;
  const cod = row.cod;
  const lines = row.lines || [];
  const snap = getValidityLastCountSnapshot(cod);
  const vKey = validityRowVisualKey(row, todayBr);
  const band =
    lines.length > 0 ? validityRiskLabel(operationalValidityPrimaryCategory(lines, todayBr)) : 'Sem validade';
  const bandClass = lines.length
    ? validityRiskChipClass(operationalValidityPrimaryCategory(lines, todayBr))
    : 'va-risk-badge va-risk-badge--no-validity';
  const anchorLn = operationalAnchorLine(lines, todayBr);
  const nextBr = anchorLn
    ? formatDateBrFromIso(String(anchorLn.expiration_date || '').slice(0, 10))
    : lines.length > 0
      ? 'Vencidos'
      : '—';
  const dias = validityDaysToExpiryDisplay(lines, todayBr);
  const q = validityQtyAllocatedAndRemaining(row, getActiveValidityOpDateKey());
  const launch = getLatestValidityLaunchMeta(cod);
  const lastLaunchBr = mergedLastValidityLaunchDateIso(cod);
  const countRef = snap
    ? `${formatIntegerBR(snap.cx)} CX / ${formatIntegerBR(snap.un)} UN`
    : 'Sem contagem';
  const grupo = validityProductGroupLabel(p);
  const codRefEnc = encodeURIComponent(cod);
  const recentLines = [...lines]
    .sort((a, b) => String(b.observed_at || '').localeCompare(String(a.observed_at || '')))
    .slice(0, 4);
  const recentHtml = recentLines.length
    ? `<ul class="va-side-recent">${recentLines
        .map((ln) => {
          const rk = validityRiskCategory(ln.expiration_date, todayBr);
          const chip = validityRiskChipClass(rk);
          return `<li><span class="${chip}">${escapeHtml(
            formatDateBrFromIso(String(ln.expiration_date || '').slice(0, 10)),
          )}</span> <span class="muted">${escapeHtml(
            formatDateTimeBr(ln.observed_at),
          )}</span></li>`;
        })
        .join('')}</ul>`
    : '<p class="muted va-side-muted">Sem lançamentos recentes.</p>';

  return `<div class="va-side-hero va-side-hero--${escapeHtml(vKey)}">
    <div class="va-side-kicker">Produto selecionado</div>
    <h3 class="va-side-title">${escapeHtml((p?.cod_grup_descricao || cod).trim())}</h3>
    <p class="va-side-meta"><span class="va-side-code">${escapeHtml(cod)}</span> · <span class="va-side-grupo">${escapeHtml(grupo)}</span></p>
    <div class="va-side-badge-row"><span class="${bandClass}">${escapeHtml(band)}</span></div>
    <dl class="va-side-dl">
      <div><dt>Próxima validade</dt><dd>${escapeHtml(nextBr)}</dd></div>
      <div><dt>Dias para vencer</dt><dd>${escapeHtml(dias)}</dd></div>
      <div><dt>Quantidade com validade (dia)</dt><dd>${escapeHtml(q.withLabel)}</dd></div>
      <div><dt>Quantidade sem validade (restante)</dt><dd>${escapeHtml(q.withoutLabel)}</dd></div>
      <div><dt>Contagem referência</dt><dd>${escapeHtml(countRef)}</dd></div>
      <div><dt>Último lançamento (op.)</dt><dd>${escapeHtml(lastLaunchBr ? formatDateBrFromIso(lastLaunchBr) : '—')}</dd></div>
      <div><dt>Registro mais recente</dt><dd>${escapeHtml(formatDateTimeBr(launch.whenIso))}</dd></div>
      <div><dt>Responsável</dt><dd>${escapeHtml(launch.who)}</dd></div>
    </dl>
    <div class="va-side-recent-block">
      <div class="va-side-h">Histórico recente</div>
      ${recentHtml}
    </div>
    <div class="va-side-actions">
      <button type="button" class="btn btn-secondary btn-sm validity-btn-history validity-analysis-btn-history" data-coderef="${codRefEnc}">Ver histórico completo</button>
      <button type="button" class="btn btn-secondary btn-sm validity-analysis-btn-export-item" data-coderef="${codRefEnc}">Exportar item (Excel)</button>
      <button type="button" class="btn btn-primary btn-sm validity-analysis-btn-open-op" data-coderef="${codRefEnc}">Abrir no lançamento</button>
    </div>
  </div>
  <div class="va-side-detail-block">${buildValidityDetailBodyHtml(row, todayBr)}</div>`;
}

function renderValidityAnalysisDetailPanel(row) {
  const inner = document.getElementById('validity-analysis-detail-inner');
  const lead = document.getElementById('validity-analysis-detail-lead');
  if (!inner) return;
  if (!row) {
    inner.innerHTML =
      '<p class="muted validity-analysis-detail-placeholder">Selecione um produto na tabela para ver contagem de referência, métricas e histórico de validades.</p>';
    if (lead) lead.textContent = '';
    return;
  }
  if (lead) lead.textContent = '';
  inner.innerHTML = buildValidityAnalysisSidePanelHtml(row, getBrazilDateKey());
}

function openValidityHistoryDialog(row) {
  const dlg = document.getElementById('validity-history-dialog');
  const body = document.getElementById('validity-history-dialog-body');
  const title = document.getElementById('validity-history-dialog-title');
  if (!dlg || !body) return;
  const name = (row.product?.cod_grup_descricao || row.cod || '').trim();
  if (title) title.textContent = `Histórico — ${name}`;
  body.innerHTML = buildValidityDetailBodyHtml(row, getBrazilDateKey());
  dlg.showModal();
}

function setValidityAnalysisSelection(cod) {
  validityAnalysisSelectedCod = cod ? normalizeItemCode(cod) : null;
  document.querySelectorAll('.validity-analysis-row').forEach((tr) => {
    const c = tr.dataset.code || '';
    tr.classList.toggle('is-selected', !!validityAnalysisSelectedCod && c === validityAnalysisSelectedCod);
  });
  const row = window._validityRowsByCod?.get(validityAnalysisSelectedCod);
  renderValidityAnalysisDetailPanel(row || null);
}

function refreshValidityUiAfterMutation() {
  const sub = getActiveValiditySubKey();
  if (sub === 'validity-analysis') renderValidityAnalysisView();
  if (sub === 'validity') renderValidityOperationalView();
}

function renderValidityAnalysisView() {
  const tbody = document.getElementById('validity-analysis-tbody');
  const statusEl = document.getElementById('validity-analysis-process-status');
  if (!tbody) return;

  const isActive = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (!s || s === 'ativo' || s === 's' || s === 'sim' || s === '1' || s === 'true') return true;
    return false;
  };
  const ativos = (validityProductsCache || []).filter((p) => isActive(p.status));
  const todayBr = getBrazilDateKey();
  const allRows = ativos.map(buildValidityRowForProduct);
  window._validityRowsByCod = new Map(allRows.map((r) => [r.cod, r]));

  updateValidityKpis(allRows, todayBr);
  const sortMode = (document.getElementById('validity-analysis-sort')?.value || 'priority').trim();
  const rows = sortValidityRows(filterValidityAnalysisRows(allRows), sortMode, todayBr);

  if (statusEl) {
    statusEl.textContent =
      ativos.length === 0
        ? 'Status: sem produtos ativos carregados'
        : `Status: ${rows.length} produto(s) no filtro · ${ativos.length} ativos no catálogo`;
  }

  if (validityAnalysisSelectedCod && !rows.some((r) => String(r.cod) === String(validityAnalysisSelectedCod))) {
    validityAnalysisSelectedCod = null;
  }

  const statsEl = document.getElementById('validity-analysis-launch-stats');
  if (statsEl) {
    const noline = rows.filter((r) => !r.lines.length).length;
    const withl = rows.length - noline;
    statsEl.textContent = `Neste filtro: ${withl} com validade lançada · ${noline} sem lançamento`;
  }

  const execEl = document.getElementById('validity-analysis-exec-summary');
  if (execEl) {
    const lines = buildValidityExecutiveNarrativeLines(rows, todayBr);
    execEl.innerHTML = `<ul class="validity-exec-list">${lines.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
  }

  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="12" class="muted">Nenhum produto no filtro atual.</td></tr>';
    syncValidityKpiChipStyles();
    updateValidityReadonlyState();
    setValidityAnalysisSelection(null);
    return;
  }

  const opKey = getActiveValidityOpDateKey();
  for (const row of rows) {
    const p = row.product;
    const cod = row.cod;
    const lines = row.lines;
    const snap = getValidityLastCountSnapshot(cod);
    const st = validityStatusMainShort(operationalValidityPrimaryCategory(lines, todayBr), lines.length > 0, !!snap);
    const vKey = validityRowVisualKey(row, todayBr);
    const anchorLn = operationalAnchorLine(lines, todayBr);
    const nextBr = anchorLn
      ? formatDateBrFromIso(String(anchorLn.expiration_date || '').slice(0, 10))
      : lines.length > 0
        ? 'Vencidos'
        : '—';
    const band =
      lines.length > 0 ? validityRiskLabel(operationalValidityPrimaryCategory(lines, todayBr)) : '—';
    const bandChip = lines.length
      ? `<span class="validity-analysis-faixa-chip ${validityRiskChipClass(operationalValidityPrimaryCategory(lines, todayBr))}">${escapeHtml(band)}</span>`
      : '—';
    const countRef = snap
      ? `${formatIntegerBR(snap.cx)} CX / ${formatIntegerBR(snap.un)} UN`
      : 'Sem contagem';
    const grupo = escapeHtml(validityProductGroupLabel(p));
    const dias = escapeHtml(validityDaysToExpiryDisplay(lines, todayBr));
    const q = validityQtyAllocatedAndRemaining(row, opKey);
    const launch = getLatestValidityLaunchMeta(cod);
    const lastOp = mergedLastValidityLaunchDateIso(cod);
    const lastOpBr = lastOp ? formatDateBrFromIso(lastOp) : '—';

    const tr = document.createElement('tr');
    tr.className = `validity-analysis-row va-row va-row--${vKey}`;
    tr.dataset.code = cod;
    tr.innerHTML = `<td class="validity-analysis-cell-name">${escapeHtml((p.cod_grup_descricao || cod).trim())}</td>
      <td class="va-td-code">${escapeHtml(cod)}</td>
      <td class="va-td-grupo muted">${grupo}</td>
      <td><span class="validity-analysis-status-pill va-status--${st.key}">${escapeHtml(st.label)}</span></td>
      <td>${escapeHtml(nextBr)}</td>
      <td class="va-td-num">${dias}</td>
      <td>${bandChip}</td>
      <td class="muted va-td-qty">${escapeHtml(q.withLabel)}</td>
      <td class="muted va-td-qty">${escapeHtml(q.withoutLabel)}</td>
      <td class="muted">${escapeHtml(countRef)}</td>
      <td class="muted va-td-dt">${escapeHtml(lastOpBr)}</td>
      <td class="muted va-td-who">${escapeHtml(launch.who)}</td>`;
    tbody.appendChild(tr);
  }

  syncValidityKpiChipStyles();
  updateValidityReadonlyState();

  if (validityAnalysisSelectedCod && rows.some((r) => String(r.cod) === String(validityAnalysisSelectedCod))) {
    setValidityAnalysisSelection(validityAnalysisSelectedCod);
  } else {
    setValidityAnalysisSelection(rows[0]?.cod || null);
  }
}

/** Evita rolagem indesejada ao abrir módulos de validade (fragmento, restauração ou reflow). */
function scrollDashboardToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

async function loadValidityShared() {
  await loadLastCountPerProduct();
  await loadValidityDayCountTotals();
  await loadValidityLinesFromServer(getActiveValiditySubKey() === 'validity-analysis');
  await loadValidityProductsCatalog();
}

async function loadValidityModuleForSub(subKey) {
  showDashboard();
  scrollDashboardToTop();
  await loadValidityShared();
  renderValidityAnalysisView();
  updateValidityPendingBadges();
  scrollDashboardToTop();
  requestAnimationFrame(() => {
    scrollDashboardToTop();
    requestAnimationFrame(scrollDashboardToTop);
  });
}

function registerValidityLineLocal(codRaw, expirationDateStr, quantityCx, quantityUn) {
  if (!isValidityOperationalEditable()) {
    setValidityFeedback('Lancamento apenas na data de hoje (America/Sao_Paulo).', true);
    return;
  }
  const cod = normalizeItemCode(codRaw);
  if (!cod) return;
  const expIso = parseValidityDateInputToIso(String(expirationDateStr || '').trim());
  if (!expIso) {
    setValidityFeedback('Informe a data de vencimento válida (DD/MM/AAAA).', true);
    return;
  }
  const dayKey = getActiveValidityOpDateKey();
  const events = loadValidityEventsForDate(dayKey);
  const qcx = Math.max(0, Math.round(Number(quantityCx) || 0));
  const qun = Math.max(0, Math.round(Number(quantityUn) || 0));
  if (qcx <= 0 && qun <= 0) {
    setValidityFeedback('Informe quantidade maior que zero (CX e/ou UN).', true);
    return;
  }
  const ev = {
    client_event_id: makeEventId(),
    cod_produto: cod,
    expiration_date: expIso,
    quantity_un: qun,
    quantity_cx: qcx,
    lot_code: null,
    note: null,
    observed_at: new Date().toISOString(),
    synced: false,
    device_name: getDeviceName(),
    operational_day: dayKey,
  };
  events.push(ev);
  saveValidityEventsForDate(dayKey, events);
  const shortOk = getActiveValiditySubKey() === 'validity';
  setValidityFeedback(
    shortOk
      ? 'Validade salva.'
      : `Validade ${ev.expiration_date} gravada localmente. Sincronize quando estiver online.`,
    false,
  );
  const savedCod = cod;
  refreshValidityUiAfterMutation();
  if (getActiveValiditySubKey() === 'validity-analysis') {
    requestAnimationFrame(() => {
      const enc = encodeURIComponent(savedCod);
      const expEl = document.getElementById(`validity-exp-panel-${enc}`);
      if (expEl && !expEl.disabled) expEl.focus();
    });
  }
  updateValidityPendingBadges();
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
      quantity_cx: Math.max(0, Math.round(Number(e.quantity_cx) || 0)),
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
    await loadValidityLinesFromServer(getActiveValiditySubKey() === 'validity-analysis');
    await loadValidityLastLaunchFromServer();
    refreshValidityUiAfterMutation();
    updateValidityPendingBadges();
    if (document.getElementById('sub-count-audit')?.classList.contains('active')) {
      await loadCountAuditValidityExpiryMap();
      renderCountAuditRows(getCountAuditRowsFromState());
      const sel = String(countAuditState.selectedCode || '');
      if (sel && countAuditDetailPanel) {
        const row = getCountAuditRowsFromState().find((r) => String(r.cod_produto) === sel);
        if (row) {
          const d = getCountAuditCachedDetail(sel);
          renderCountAuditDetailShell(row, d, false);
        }
      }
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
      const err = await resp.json().catch(() => ({}));
      const d = err.detail;
      const msg =
        typeof d === 'string'
          ? d
          : Array.isArray(d)
            ? d.map((x) => x.msg || x).join(' ')
            : 'Nao foi possivel remover no servidor.';
      setValidityFeedback(msg, true);
      return;
    }
    await loadValidityLinesFromServer(getActiveValiditySubKey() === 'validity-analysis');
    refreshValidityUiAfterMutation();
    setValidityFeedback('Linha removida.');
    return;
  }
  if (clientId) {
    const events = loadValidityEventsForDate(dayKey);
    const next = events.filter((e) => e.client_event_id !== clientId);
    saveValidityEventsForDate(dayKey, next);
    refreshValidityUiAfterMutation();
    setValidityFeedback('Lancamento local removido.');
  }
}

function bindValidityShellClicks(shell) {
  if (!shell || shell.dataset.validityBound === '1') return;
  shell.dataset.validityBound = '1';
  shell.addEventListener('click', (e) => {
    const histBtn = e.target.closest('.validity-btn-history');
    if (histBtn) {
      e.stopPropagation();
      const cref = histBtn.getAttribute('data-coderef') || '';
      const cod = normalizeItemCode(decodeURIComponent(cref));
      const row = window._validityRowsByCod?.get(cod);
      if (row) openValidityHistoryDialog(row);
      return;
    }
    const addBtn = e.target.closest('.validity-btn-add');
    if (addBtn) {
      const codRefEnc = addBtn.getAttribute('data-coderef') || '';
      const cod = normalizeItemCode(decodeURIComponent(codRefEnc));
      const expEl = document.getElementById(`validity-exp-panel-${codRefEnc}`);
      const cxEl = document.getElementById(`validity-cx-panel-${codRefEnc}`);
      const qcx = cxEl ? Math.max(0, Math.round(Number(cxEl.value) || 0)) : 0;
      registerValidityLineLocal(cod, expEl && expEl.value, qcx, 0);
      if (expEl) expEl.value = '';
      if (cxEl) cxEl.value = '';
      return;
    }
    const rem = e.target.closest('.btn-validity-remove');
    if (rem) {
      const lid = rem.getAttribute('data-line-id');
      const cid = rem.getAttribute('data-client-id');
      const cref = rem.getAttribute('data-coderef') || '';
      const cod = normalizeItemCode(decodeURIComponent(cref));
      removeValidityLine(lid ? Number(lid) : null, cid || null, cod);
      return;
    }
    const exItem = e.target.closest('.validity-analysis-btn-export-item');
    if (exItem) {
      e.stopPropagation();
      const cref = exItem.getAttribute('data-coderef') || '';
      exportValidityAnalysisExcelForSingleCod(decodeURIComponent(cref));
      return;
    }
    const openOp = e.target.closest('.validity-analysis-btn-open-op');
    if (openOp) {
      e.stopPropagation();
      const cref = openOp.getAttribute('data-coderef') || '';
      openValidityOperationalForProduct(decodeURIComponent(cref));
      return;
    }
    const analysisRow = e.target.closest('.validity-analysis-row');
    if (analysisRow) {
      const cod = analysisRow.dataset.code;
      if (cod) setValidityAnalysisSelection(cod);
      return;
    }
  });
}

function bindValidityEvents() {
  const analysisShell = document.getElementById('validity-analysis-shell');

  const aItem = document.getElementById('validity-analysis-item-code');
  const aGrp = document.getElementById('validity-analysis-group');
  const aRisk = document.getElementById('validity-analysis-risk-filter');
  const aLaunch = document.getElementById('validity-analysis-launch-filter');
  const aSort = document.getElementById('validity-analysis-sort');
  if (aItem) aItem.addEventListener('input', () => renderValidityAnalysisView());
  if (aGrp) aGrp.addEventListener('input', () => renderValidityAnalysisView());
  if (aRisk) aRisk.addEventListener('change', () => renderValidityAnalysisView());
  if (aLaunch) {
    aLaunch.addEventListener('change', () => {
      validityAnalysisSelectedCod = null;
      renderValidityAnalysisView();
    });
  }
  if (aSort) aSort.addEventListener('change', () => renderValidityAnalysisView());

  const kpiStrip = document.getElementById('validity-analysis-kpi-strip');
  if (kpiStrip && kpiStrip.dataset.kpiBound !== '1') {
    kpiStrip.dataset.kpiBound = '1';
    kpiStrip.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-validity-kpi]');
      if (!btn) return;
      const k = btn.getAttribute('data-validity-kpi');
      if (!k) return;
      validityActiveKpiKey = validityActiveKpiKey === k ? null : k;
      renderValidityAnalysisView();
    });
  }

  const opForm = document.getElementById('validity-op-form');
  if (opForm && opForm.dataset.voFormBound !== '1') {
    opForm.dataset.voFormBound = '1';
    opForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const open = document.querySelector('#validity-op-list .validity-op-item--open .validity-op-new-exp');
      if (open && document.activeElement === open) {
        const item = open.closest('.validity-op-item');
        if (item) saveValidityOperationalNewLot(item);
      }
    });
    document.getElementById('validity-op-item-code')?.addEventListener('input', () => renderValidityOperationalView());
    document.getElementById('validity-op-group')?.addEventListener('input', () => renderValidityOperationalView());
  }

  document.getElementById('btn-validity-analysis-sync')?.addEventListener('click', () => syncValidityPending());
  document.getElementById('btn-validity-analysis-export')?.addEventListener('click', () => exportValidityAnalysisExcelFromUi());
  document.getElementById('btn-validity-analysis-email-prep')?.addEventListener('click', () => openValidityEmailPrepDialog());

  const emailDlg = document.getElementById('validity-email-prep-dialog');
  if (emailDlg && emailDlg.dataset.bound !== '1') {
    emailDlg.dataset.bound = '1';
    emailDlg.querySelector('.validity-email-dialog-close')?.addEventListener('click', () => emailDlg.close());
    emailDlg.addEventListener('click', (ev) => {
      if (ev.target === emailDlg) emailDlg.close();
    });
    document.getElementById('validity-email-generate')?.addEventListener('click', () => exportValidityAnalysisExcelFromUi());
    document.getElementById('validity-email-copy')?.addEventListener('click', async () => {
      const to = document.getElementById('validity-email-to')?.value?.trim() || '';
      const subj = document.getElementById('validity-email-subject')?.value?.trim() || '';
      const body = document.getElementById('validity-email-body')?.value || '';
      const text = `Para: ${to}\nAssunto: ${subj}\n\n${body}`;
      try {
        await navigator.clipboard.writeText(text);
        setValidityFeedback('Texto copiado para a area de transferencia.');
      } catch {
        setValidityFeedback('Nao foi possivel copiar. Selecione o texto manualmente.', true);
      }
    });
  }

  const histDlg = document.getElementById('validity-history-dialog');
  if (histDlg && histDlg.dataset.bound !== '1') {
    histDlg.dataset.bound = '1';
    histDlg.querySelector('.validity-history-dialog-close')?.addEventListener('click', () => histDlg.close());
    histDlg.addEventListener('click', (ev) => {
      if (ev.target === histDlg) histDlg.close();
    });
  }

  bindValidityShellClicks(analysisShell);
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
  if (syncInProgress) return;

  const token = getToken();
  if (!token) return;
  if (!navigator.onLine) return;

  const allEv = flattenAllCountEventsFromBucket();
  const pending = allEv.filter((event) => !event.synced);
  if (pending.length === 0) return;

  syncInProgress = true;
  if (btnSync) btnSync.disabled = true;

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
    if (btnSync) btnSync.disabled = false;
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
  const digitsOnly = String(inp.value ?? '').trim().replace(/\D/g, '');
  if (digitsOnly === '') return null;
  const n = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
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

/**
 * Safari/iOS: o blur/focusout do input costuma ocorrer antes do pointerdown no botão +/−.
 * Incrementamos `countAdjustGestureGeneration` no pointerdown (captura) do `.btn-count-adjust`.
 * No focusout, não decidimos na mesma volta: `setTimeout(0)` pode rodar antes do pointerdown no iOS,
 * disparando o “+ automático” por engano. Usamos dois rAF para decidir após o pipeline de entrada.
 */
let countAdjustGestureGeneration = 0;

function bindGlobalAdjustButtonKeyboardRetention() {
  if (document.documentElement.dataset.adjustKeyboardBound === '1') return;
  document.documentElement.dataset.adjustKeyboardBound = '1';

  /**
   * Mobile (Safari/Chrome): `preventDefault` em `pointerdown` costuma cancelar o `click` nativo,
   * gerando corrida com `focusout` do input e disparando o “+ automático” em duplicidade.
   * Em `touchstart` com `passive: false` o teclado tende a permanecer; em `touchend` disparamos
   * `click()` sintético para reutilizar a delegação existente.
   */
  let touchAdjustStartBtn = null;

  document.addEventListener(
    'touchstart',
    (e) => {
      const btn = e.target.closest?.('.btn-count-adjust');
      if (!btn || btn.disabled) return;
      touchAdjustStartBtn = btn;
      countAdjustGestureGeneration += 1;
      e.preventDefault();
    },
    { capture: true, passive: false },
  );

  document.addEventListener(
    'touchcancel',
    () => {
      touchAdjustStartBtn = null;
    },
    { capture: true },
  );

  document.addEventListener(
    'touchend',
    (e) => {
      const btn = e.target.closest?.('.btn-count-adjust');
      const start = touchAdjustStartBtn;
      if (!start) return;
      if (!btn || btn !== start) {
        touchAdjustStartBtn = null;
        return;
      }
      touchAdjustStartBtn = null;
      e.preventDefault();
      if (typeof start.click === 'function') start.click();
    },
    { capture: true, passive: false },
  );
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
      refreshRecountSignalsFromServer();
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
    countShell.addEventListener(
      'pointerdown',
      (e) => {
        const btn = e.target.closest('.btn-count-adjust');
        if (!btn || !countShell.contains(btn)) return;
        countAdjustGestureGeneration += 1;
      },
      true,
    );
    countShell.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-count-adjust');
      if (!btn || !countShell.contains(btn)) return;
      e.preventDefault();
      const codRefEnc = btn.getAttribute('data-coderef') || '';
      const rawDelta = btn.getAttribute('data-delta');
      const deltaBtn = rawDelta === '1' ? 1 : rawDelta === '-1' ? -1 : NaN;
      const countType = btn.dataset.countType || 'caixa';
      if (!codRefEnc || !Number.isFinite(deltaBtn)) return;
      if (deltaBtn !== 1 && deltaBtn !== -1) return;
      const row = btn.closest('.count-control-row');
      const inp = row ? row.querySelector('input.count-product-qty') : null;
      applyCountRowOperation(codRefEnc, countType, inp, deltaBtn);
      if (inp && typeof inp.focus === 'function') inp.focus({ preventScroll: true });
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
      const genAtBlur = countAdjustGestureGeneration;
      const hadOpQty = parseOperationQtyFromInputEl(inp) != null;
      if (!hadOpQty) {
        refreshCountListAfterEdit();
        return;
      }
      const runDeferredAutoPlus = () => {
        const ae = document.activeElement;
        if (
          ae &&
          typeof ae.closest === 'function' &&
          ae.closest('.btn-count-adjust') &&
          countShell.contains(ae)
        ) {
          refreshCountListAfterEdit();
          return;
        }
        if (countAdjustGestureGeneration > genAtBlur) {
          refreshCountListAfterEdit();
          return;
        }
        dispatchCountRowPlusClick(inp);
        refreshCountListAfterEdit();
      };
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(runDeferredAutoPlus, 0);
        });
      });
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
    syncPendingBreakEvents();
    loadServerCountTotals().then(() => refreshCountProductListView());
    loadServerBreakTotals().then(() => {
      if (document.getElementById('sub-break')?.classList.contains('active')) {
        refreshBreakProductListView();
      }
    });
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

          const top = items.slice(0, IMPORT_TXT_DETAIL_ITEMS_LIMIT);
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
            li.innerHTML =
              `<span class="muted">Listagem limitada a ${formatIntegerBR(top.length)} itens (total ${formatIntegerBR(items.length)}). ` +
              `Use exportação ou consulta no servidor para o arquivo completo.</span>`;
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

  // Polling: sincroniza eventos locais + recarrega análise do servidor (lançamentos de outros dispositivos).
  countAuditPollingTimer = setInterval(async () => {
    const auditVisible = document.getElementById('sub-count-audit')?.classList.contains('active');
    if (!auditVisible) {
      clearInterval(countAuditPollingTimer);
      countAuditPollingTimer = null;
      return;
    }
    if (document.visibilityState === 'hidden') return;
    if (navigator.onLine && getToken()) {
      await syncPendingEventsForAudit();
    }
    await loadCountAuditAnalysis();
  }, COUNT_AUDIT_POLL_MS);
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

const API_STOCK_ANALYSIS_DETAIL = '/audit/stock-analysis/detail';
const API_RECOUNT_SIGNAL = '/audit/recount-signal';
const API_RECOUNT_SIGNALS = '/audit/recount-signals';
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
const countAuditDrawerRoot = document.getElementById('count-audit-drawer-root');
const countAuditDrawerBackdrop = document.getElementById('count-audit-drawer-backdrop');
const countAuditDrawerClose = document.getElementById('count-audit-drawer-close');
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
  /** YYYY-MM-DD do dia operacional usado nos totais de quebra (alinhado à data da análise). */
  breakDayKey: '',
  breakDayOk: false,
  breakDayBalances: {},
  /** Mapa normalizado cod_produto → YYYY-MM-DD (servidor, GET validity-display-expiry-by-product). */
  validityExpiryByCode: {},
  /** Pendente troca por código conforme último evento no servidor (alinhamento entre navegadores). */
  mateTrocaServerPending: {},
};
let countAuditDetailRequestSeq = 0;
let countPrefillProductCode = null;
let countRecountSignalsPollTimer = null;
/** Códigos com solicitação de recontagem em tempo real para o dia de #count-date. */
let serverRecountSignalCodes = new Set();

function formatSignedIntegerBR(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${formatIntegerBR(n)}` : formatIntegerBR(n);
}

/** Totais de quebra na UI (readout, histórico líquido): magnitude sem sinal. Para deltas use formatSignedIntegerBR. */
function formatBreakIntegerBR(value) {
  const n = Math.abs(Number(value) || 0);
  return formatIntegerBR(n);
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

let countAuditDrawerEscBound = false;

function openCountAuditDetailDrawer() {
  if (!countAuditDrawerRoot || isCountAuditMobileViewport()) return;
  countAuditDrawerRoot.classList.add('is-open');
  countAuditDrawerRoot.setAttribute('aria-hidden', 'false');
  document.body.classList.add('count-audit-drawer-open');
  window.setTimeout(() => {
    if (countAuditDrawerClose && countAuditDrawerRoot.classList.contains('is-open')) {
      countAuditDrawerClose.focus();
    }
  }, 0);
}

function closeCountAuditDetailDrawer() {
  if (!countAuditDrawerRoot) return;
  countAuditDrawerRoot.classList.remove('is-open');
  countAuditDrawerRoot.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('count-audit-drawer-open');
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

/** Nome exibido na análise: prioriza descrição do cadastro quando for mais completa que TXT/API. */
function resolveCountAuditDescricao(row) {
  const api = String(row?.descricao || '').trim();
  const rawCode = normalizeItemCode(row?.cod_produto || '');
  if (!rawCode || !Array.isArray(countProductsCache) || countProductsCache.length === 0) {
    return api || 'Sem descrição';
  }
  const useNum = /^\d+$/.test(rawCode);
  const numKey = useNum ? normalizeNumericProductCodeKey(rawCode) : '';
  const p = countProductsCache.find((x) => {
    const c = normalizeItemCode(x.cod_produto || '');
    if (!c) return false;
    if (useNum && /^\d+$/.test(c)) return normalizeNumericProductCodeKey(c) === numKey;
    return c === rawCode;
  });
  const catalog = p ? String(p.cod_grup_descricao || '').trim() : '';
  if (!catalog) return api || 'Sem descrição';
  if (!api) return catalog;
  return catalog.length >= api.length ? catalog : api;
}

function enrichCountAuditRow(row) {
  if (!row || row._auditMeta) return row;
  row = { ...row, descricao: resolveCountAuditDescricao(row) };
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

  const dk = (countAuditState.breakDayKey || '').trim();
  let breakCx = 0;
  let breakUn = 0;
  if (dk) {
    breakCx = getNetBreakByProductAndTypeForOperationalDay(
      row.cod_produto,
      'caixa',
      dk,
      countAuditState.breakDayOk,
      countAuditState.breakDayBalances,
    );
    breakUn = getNetBreakByProductAndTypeForOperationalDay(
      row.cod_produto,
      'unidade',
      dk,
      countAuditState.breakDayOk,
      countAuditState.breakDayBalances,
    );
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
      breakCx,
      breakUn,
      trocaCx: 0,
      trocaUn: 0,
      /** CIA Mate couro: produto do catálogo Mate (coluna Troca / composição). */
      trocaMateCouro: false,
      /** Saldo da Base de Troca V2 já conhecido (GET ok ou último estado válido em disco). */
      trocaSaldoKnown: false,
    },
  };
}

/**
 * Pendente Mate couro na análise: chave canônica numérica (010 ≡ 10) e fallback à forma bruta do TXT.
 */
function resolveMateCouroPendingEntry(pending, codProduto) {
  const p = pending && typeof pending === 'object' ? pending : {};
  const raw = normalizeItemCode(codProduto);
  if (!raw) return { cx: 0, un: 0 };
  const canon = normalizeNumericProductCodeKey(codProduto);
  const normEntry = (t) => {
    if (!t || typeof t !== 'object') return { cx: 0, un: 0 };
    return {
      cx: Math.max(0, Math.round(Number(t.cx) || 0)),
      un: Math.max(0, Math.round(Number(t.un) || 0)),
    };
  };
  if (canon && Object.prototype.hasOwnProperty.call(p, canon)) return normEntry(p[canon]);
  if (Object.prototype.hasOwnProperty.call(p, raw)) return normEntry(p[raw]);
  return { cx: 0, un: 0 };
}

/**
 * Alinha diferença CX/UN / |Dif| do meta com a mesma base usada em "Contagem:"
 * (sincronizado + saldo atual da Base de Troca V2 para produtos Mate couro).
 */
function reconcileCountAuditMetaDiffWithMergedCount(row) {
  const meta = row && row._auditMeta;
  if (!meta) return;
  const importCx = Math.round(Number(row.import_caixa) || 0);
  const importUn = Math.round(Number(row.import_unidade) || 0);
  const countedCx = Math.round(Number(row.counted_caixa) || 0);
  const countedUn = Math.round(Number(row.counted_unidade) || 0);
  const tCx = Math.max(0, Math.round(Number(meta.trocaCx) || 0));
  const tUn = Math.max(0, Math.round(Number(meta.trocaUn) || 0));
  meta.diffCx = countedCx + tCx - importCx;
  meta.diffUn = countedUn + tUn - importUn;
  meta.diffAbs = Math.abs(meta.diffCx) + Math.abs(meta.diffUn);
  meta.totalCount = countedCx + tCx + countedUn + tUn;
}

/**
 * Troca na análise: mesmo saldo CX/UN da Base de Troca V2 (GET /audit/mate-troca-base-v2 + último válido em disco),
 * alinhado ao card "Saldo acumulado" — sem break_totals, sem soma histórica de quebra e sem reflexo do dia.
 */
function applyMateCouroTrocaPendingToCountAuditRows() {
  const rows = Array.isArray(countAuditState.rows) ? countAuditState.rows : [];
  if (!rows.length) return;
  const mateSet = getMateCouroCodSet();
  for (const row of rows) {
    if (!row._auditMeta) continue;
    const cod = row.cod_produto;
    const isMate = mateCouroCatalogHasCode(mateSet, cod);
    row._auditMeta.trocaMateCouro = isMate;
    if (isMate) {
      row._auditMeta.trocaSaldoKnown = mateTrocaV2SaldoKnownForCod(cod);
      const bal = getMateTrocaV2CurForPayload(cod);
      row._auditMeta.trocaCx = bal.cx;
      row._auditMeta.trocaUn = bal.un;
    } else {
      row._auditMeta.trocaSaldoKnown = false;
      row._auditMeta.trocaCx = 0;
      row._auditMeta.trocaUn = 0;
    }
    reconcileCountAuditMetaDiffWithMergedCount(row);
  }
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
  const progressFill = document.getElementById('count-audit-list-progress-fill');
  const progressPct = document.getElementById('count-audit-progress-label-pct');
  if (progressFill) {
    const pct = Math.min(100, Math.max(0, dashboard.completedPercent));
    progressFill.style.width = `${pct}%`;
    if (progressPct) {
      progressPct.textContent = dashboard.total > 0 ? `${pct}%` : '—';
    }
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
  const visible = !!message;
  countAuditFeedback.style.display = visible ? '' : 'none';
  countAuditFeedback.classList.toggle('is-error', visible && isError);
  countAuditFeedback.classList.toggle('is-info', visible && !isError);
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

const COUNT_AUDIT_VALIDITY_URGENT_DAYS = 45;

/** Mescla servidor + lançamentos locais não sincronizados (módulo Validade). */
function countAuditMergedDisplayExpiryIso(codRaw) {
  const cod = normalizeItemCode(codRaw);
  const todayBr = getBrazilDateKey();
  const dates = [];
  const srv = countAuditState.validityExpiryByCode[cod];
  if (srv) dates.push(String(srv).slice(0, 10));
  for (const e of flattenValidityPendingAll()) {
    if (e.synced) continue;
    if (normalizeItemCode(e.cod_produto) !== cod) continue;
    const ex = (e.expiration_date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ex)) dates.push(ex);
  }
  const uniq = [...new Set(dates)].sort();
  const lines = uniq.map((expiration_date) => ({ expiration_date }));
  const anchor = operationalAnchorLine(lines, todayBr);
  if (anchor) return anchor.expiration_date;
  const earl = earliestExpirationLine(lines);
  return earl ? earl.expiration_date : null;
}

function countAuditValidityRiskClass(expIso) {
  if (!expIso) return '';
  const d = validityExpiryDiffDays(expIso, getBrazilDateKey());
  if (d === null) return '';
  if (d < 0) return 'count-audit-row-validity--risk';
  if (d <= COUNT_AUDIT_VALIDITY_URGENT_DAYS) return 'count-audit-row-validity--risk';
  return '';
}

function countAuditValidityMarkupForRow(codRaw) {
  const expIso = countAuditMergedDisplayExpiryIso(codRaw);
  if (!expIso) return '';
  const risk = countAuditValidityRiskClass(expIso);
  return (
    `<span class="count-audit-product-exp${risk ? ` ${risk}` : ''}" title="Validade (módulo Validade)">` +
    `Venc. ${escapeHtml(formatDateBR(expIso))}` +
    `</span>`
  );
}

function buildCountAuditHistoryHtml(history) {
  return history.length
    ? history.map((entry) => (
      `<li class="count-audit-history-item">` +
        `<div class="count-audit-history-topline">` +
          `<span class="count-audit-history-actor">${escapeHtml(entry.actor || 'Equipe')}</span>` +
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
}

function buildCountAuditTrailHtml(row, meta, importInfo, actors, devices) {
  return [
    ['Base de comparação', importInfo.id == null ? 'Saldo sintético / fallback sem TXT' : `${formatDateBR(importInfo.reference_date || '')} · ${importInfo.file_name || 'TXT'}`],
    ['Divergência calculada', `CX ${formatSignedIntegerBR(meta.diffCx ?? row.difference_caixa)} · UN ${formatSignedIntegerBR(meta.diffUn ?? row.difference_unidade)} · |Dif| ${formatIntegerBR(meta.diffAbs || 0)}`],
    ['Observação automática', meta.insight || 'Sem observação automática.'],
    ['Quem lançou', actors.length ? actors.join(', ') : 'Sem ator identificado'],
    ['Dispositivos', devices.length ? devices.join(', ') : 'Sem dispositivo identificado'],
  ].map(([label, value]) => (
    `<li class="count-audit-trail-item">` +
      `<div class="count-audit-trail-topline"><span class="count-audit-trail-label">${escapeHtml(label)}</span></div>` +
      `<div class="count-audit-trail-note">${escapeHtml(value)}</div>` +
    `</li>`
  )).join('');
}

/** Base de Troca V2: exibe coluna/resumo quando há saldo > 0 ou saldo 0/0 já conhecido (ex.: zerado no servidor). */
function countAuditHasTrocaPending(meta) {
  const tCx = Math.max(0, Math.round(Number(meta?.trocaCx) || 0));
  const tUn = Math.max(0, Math.round(Number(meta?.trocaUn) || 0));
  if (tCx > 0 || tUn > 0) return true;
  return !!(meta?.trocaMateCouro && meta?.trocaSaldoKnown);
}

/** Quebra líquida no dia da análise: só exibe quando diferente de zero. */
function countAuditHasBreakDay(meta) {
  const bCx = Math.round(Number(meta?.breakCx) || 0);
  const bUn = Math.round(Number(meta?.breakUn) || 0);
  return bCx !== 0 || bUn !== 0;
}

/**
 * Linhas CX/UN no breakdown: não mostra dimensão zerada.
 * troca: só inteiros ≥ 0; quebra: qualquer ≠ 0 (pode ser negativo no líquido).
 */
function buildCountAuditDiffCxUnStrongs(cx, un, mode) {
  const lines = [];
  if (mode === 'troca') {
    const tCx = Math.max(0, Math.round(Number(cx) || 0));
    const tUn = Math.max(0, Math.round(Number(un) || 0));
    if (tCx > 0) lines.push(`<strong class="count-audit-diff-cx">CX ${formatBreakIntegerBR(tCx)}</strong>`);
    if (tUn > 0) lines.push(`<strong class="count-audit-diff-un">UN ${formatBreakIntegerBR(tUn)}</strong>`);
  } else {
    const bCx = Math.round(Number(cx) || 0);
    const bUn = Math.round(Number(un) || 0);
    if (bCx !== 0) lines.push(`<strong class="count-audit-diff-cx">CX ${formatBreakIntegerBR(bCx)}</strong>`);
    if (bUn !== 0) lines.push(`<strong class="count-audit-diff-un">UN ${formatBreakIntegerBR(bUn)}</strong>`);
  }
  return lines.join('');
}

/** Texto compacto mobile (só dimensões não zeradas). */
function formatCountAuditOpsMobileCxUn(cx, un, mode) {
  const segs = [];
  if (mode === 'troca') {
    const tCx = Math.max(0, Math.round(Number(cx) || 0));
    const tUn = Math.max(0, Math.round(Number(un) || 0));
    if (tCx > 0) segs.push(`CX ${formatBreakIntegerBR(tCx)}`);
    if (tUn > 0) segs.push(`UN ${formatBreakIntegerBR(tUn)}`);
  } else {
    const bCx = Math.round(Number(cx) || 0);
    const bUn = Math.round(Number(un) || 0);
    if (bCx !== 0) segs.push(`CX ${formatBreakIntegerBR(bCx)}`);
    if (bUn !== 0) segs.push(`UN ${formatBreakIntegerBR(bUn)}`);
  }
  return segs.join(' · ');
}

/** Uma linha no detalhe (métricas): só partes não zeradas. */
function formatCountAuditDetailOpsCxUnLine(cx, un, mode) {
  const segs = [];
  if (mode === 'troca') {
    const tCx = Math.max(0, Math.round(Number(cx) || 0));
    const tUn = Math.max(0, Math.round(Number(un) || 0));
    if (tCx > 0) segs.push(`${formatBreakIntegerBR(tCx)} CX`);
    if (tUn > 0) segs.push(`${formatBreakIntegerBR(tUn)} UN`);
    if (!segs.length) segs.push('0 CX', '0 UN');
  } else {
    const bCx = Math.round(Number(cx) || 0);
    const bUn = Math.round(Number(un) || 0);
    if (bCx !== 0) segs.push(`${formatBreakIntegerBR(bCx)} CX`);
    if (bUn !== 0) segs.push(`${formatBreakIntegerBR(bUn)} UN`);
  }
  return segs.join(' · ');
}

/**
 * Análise de Contagem — desktop: coluna Troca = saldo atual da Base de Troca V2 (mesmo dado do card Saldo acumulado).
 */
function buildCountAuditTrocaColumnCellHtml(meta) {
  if (countAuditHasTrocaPending(meta)) {
    const tCx = Math.max(0, Math.round(Number(meta.trocaCx) || 0));
    const tUn = Math.max(0, Math.round(Number(meta.trocaUn) || 0));
    const inner =
      tCx > 0 || tUn > 0
        ? buildCountAuditDiffCxUnStrongs(meta.trocaCx, meta.trocaUn, 'troca')
        : `<strong class="count-audit-diff-cx">CX ${formatBreakIntegerBR(0)}</strong>` +
          `<strong class="count-audit-diff-un">UN ${formatBreakIntegerBR(0)}</strong>`;
    const title =
      'Saldo atual da Base de Troca (CIA Mate couro), mesma fonte do card na tela Base de Troca; altera com Chegada, Saldo, Zerar ou Carregar.';
    return (
      `<span class="count-audit-cell-label">Troca</span>` +
      `<div class="count-audit-diff-breakdown count-audit-diff-breakdown--troca" title="${escapeHtml(title)}">` +
      inner +
      `</div>`
    );
  }
  if (meta.trocaMateCouro && !meta.trocaSaldoKnown) {
    const title =
      'Saldo da Base de Troca ainda não carregado nesta sessão. Abra a Base de Troca e use Atualizar lista, ou recarregue a análise.';
    return (
      `<span class="count-audit-cell-label">Troca</span>` +
      `<span class="count-audit-cell-value mate-troca-balance-v2-unknown" title="${escapeHtml(title)}">CX — · UN —</span>`
    );
  }
  return `<span class="count-audit-cell-label">Troca</span><span class="count-audit-cell-value">—</span>`;
}

/** Coluna desktop Quebra: dia operacional da análise; traço quando líquido zero. */
function buildCountAuditQuebraColumnCellHtml(meta) {
  if (countAuditHasBreakDay(meta)) {
    const inner = buildCountAuditDiffCxUnStrongs(meta.breakCx, meta.breakUn, 'break');
    return (
      `<span class="count-audit-cell-label">Quebra</span>` +
      `<div class="count-audit-diff-breakdown count-audit-diff-breakdown--break" title="Total de quebra no dia operacional da análise (mesma lógica da tela Quebra)">` +
      inner +
      `</div>`
    );
  }
  return `<span class="count-audit-cell-label">Quebra</span><span class="count-audit-cell-value">—</span>`;
}

/** Resumo mobile: faixas Troca e/ou Quebra só quando houver valor. */
function buildCountAuditMobileTrocaQuebraOpsHtml(meta) {
  const trocaUnknownMate = !!(meta.trocaMateCouro && !meta.trocaSaldoKnown);
  if (!countAuditHasTrocaPending(meta) && !countAuditHasBreakDay(meta) && !trocaUnknownMate) return '';
  const parts = [];
  if (countAuditHasTrocaPending(meta)) {
    let vals = formatCountAuditOpsMobileCxUn(meta.trocaCx, meta.trocaUn, 'troca');
    if (!vals) vals = 'CX 0 · UN 0';
    parts.push(
      `<div class="count-audit-mobile-break-strip count-audit-mobile-break-strip--troca" title="Saldo atual da Base de Troca (CIA Mate couro), mesma fonte do card na Base de Troca">` +
        `<span class="count-audit-mobile-break-label">Troca</span>` +
        `<span class="count-audit-mobile-break-values">${vals}</span>` +
      `</div>`,
    );
  } else if (trocaUnknownMate) {
    parts.push(
      `<div class="count-audit-mobile-break-strip count-audit-mobile-break-strip--troca" title="Saldo da Base de Troca ainda não carregado — atualize na Base de Troca ou recarregue a análise">` +
        `<span class="count-audit-mobile-break-label">Troca</span>` +
        `<span class="count-audit-mobile-break-values mate-troca-balance-v2-unknown">CX — · UN —</span>` +
      `</div>`,
    );
  }
  if (countAuditHasBreakDay(meta)) {
    const vals = formatCountAuditOpsMobileCxUn(meta.breakCx, meta.breakUn, 'break');
    parts.push(
      `<div class="count-audit-mobile-break-strip" title="Quebra no dia (mesma lógica da tela Quebra)">` +
        `<span class="count-audit-mobile-break-label">Quebra</span>` +
        `<span class="count-audit-mobile-break-values">${vals}</span>` +
      `</div>`,
    );
  }
  return `<div class="count-audit-mobile-ops-wrap">${parts.join('')}</div>`;
}

/** Ícone discreto na Análise de Contagem (#count-audit) quando o nome sugere sabor de fruta / refrigerante. */
const COUNT_AUDIT_FLAVOR_RULES = [
  ['refrigerante', '🥤', 'Refrigerante'],
  ['maracuja', '🍹', 'Maracujá'],
  ['bergamota', '🍊', 'Bergamota'],
  ['tangerina', '🍊', 'Tangerina'],
  ['mandarina', '🍊', 'Mandarina'],
  ['melancia', '🍉', 'Melancia'],
  ['citricas', '🍋', 'Cítricas'],
  ['toranja', '🍊', 'Toranja'],
  ['morango', '🍓', 'Morango'],
  ['pessego', '🍑', 'Pêssego'],
  ['guarana', '🫘', 'Guaraná'],
  ['abacaxi', '🍍', 'Abacaxi'],
  ['laranja', '🍊', 'Laranja'],
  ['frutti', '🍹', 'Tutti-frutti'],
  ['tutti', '🍹', 'Tutti-frutti'],
  ['melao', '🍈', 'Melão'],
  ['banana', '🍌', 'Banana'],
  ['cereja', '🍒', 'Cereja'],
  ['manga', '🥭', 'Manga'],
  ['limao', '🍋', 'Limão'],
  ['sprite', '🍋', 'Limão'],
  ['citrica', '🍋', 'Cítrico'],
  ['citrico', '🍋', 'Cítrico'],
  ['citrus', '🍋', 'Cítrico'],
  ['cupuacu', '🫐', 'Cupuaçu'],
  ['acai', '🫐', 'Açaí'],
  ['frutas', '🍇', 'Frutas'],
  ['pepsi', '🥤', 'Cola'],
  ['fanta', '🍊', 'Laranja'],
  ['tonica', '🥤', 'Tônica'],
  ['maca', '🍎', 'Maçã'],
  ['kiwi', '🥝', 'Kiwi'],
  ['lima', '🍋', 'Lima'],
  ['coco', '🥥', 'Coco'],
  ['coca', '🥤', 'Cola'],
  ['cola', '🥤', 'Cola'],
  ['refri', '🥤', 'Refrigerante'],
  ['uva', '🍇', 'Uva'],
  /* Abreviações comuns em etiqueta/TXT (ex.: TUTTI FRUT) */
  ['frut', '🍹', 'Frutas / tutti-frutti'],
].sort((a, b) => b[0].length - a[0].length);

function countAuditFlavorHaystack(text) {
  const n = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n ? ` ${n} ` : '';
}

function countAuditFlavorWordInHay(hay, word) {
  const w = String(word || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!w || !hay) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^| )${esc}( |$)`).test(hay);
}

function countAuditFlavorIconHtml(descricao) {
  const hay = countAuditFlavorHaystack(descricao);
  if (!hay) return '';
  for (const [word, icon, label] of COUNT_AUDIT_FLAVOR_RULES) {
    if (countAuditFlavorWordInHay(hay, word)) {
      const t = escapeHtml(label);
      return `<span class="count-audit-flavor-icon" aria-hidden="true" title="Sabor: ${t}">${icon}</span>`;
    }
  }
  return '';
}

function countAuditRowNameWithFlavorHtml(descricao) {
  const raw = String(descricao || '').trim() || 'Sem descrição';
  return `${countAuditFlavorIconHtml(raw)}<span class="count-audit-row-name-text">${escapeHtml(raw)}</span>`;
}

/** Contagem sincronizada + saldo atual da Base de Troca V2 (Mate couro): total em destaque; parcela em verde. */
function buildCountAuditMergedCurrentCxuHtml(row, meta) {
  const baseCx = Math.max(0, Math.round(Number(row.counted_caixa) || 0));
  const baseUn = Math.max(0, Math.round(Number(row.counted_unidade) || 0));
  const tCx = Math.max(0, Math.round(Number(meta.trocaCx) || 0));
  const tUn = Math.max(0, Math.round(Number(meta.trocaUn) || 0));
  const sumCx = baseCx + tCx;
  const sumUn = baseUn + tUn;
  const hasTroca = tCx > 0 || tUn > 0;
  const title = hasTroca
    ? 'Total = contagem sincronizada + saldo atual da Base de Troca para este produto.'
    : '';
  const pairClass = `count-audit-cxu-pair${hasTroca ? ' count-audit-cxu-pair--with-troca' : ''}`;
  const pairOpen = title
    ? `<div class="${pairClass}" aria-label="Caixa e unidade contagem" title="${escapeHtml(title)}">`
    : `<div class="${pairClass}" aria-label="Caixa e unidade contagem">`;

  const cxInner =
    tCx > 0
      ? `<span class="count-audit-cxu-sumline">CX <span class="count-audit-cxu-sum">${formatIntegerBR(sumCx)}</span></span><span class="count-audit-cxu-troca-mix" aria-hidden="true"><span class="count-audit-cxu-base">${formatIntegerBR(baseCx)}</span><span class="count-audit-troca-delta">+${formatIntegerBR(tCx)}</span></span>`
      : `CX ${formatIntegerBR(baseCx)}`;
  const unInner =
    tUn > 0
      ? `<span class="count-audit-cxu-sumline">UN <span class="count-audit-cxu-sum">${formatIntegerBR(sumUn)}</span></span><span class="count-audit-cxu-troca-mix" aria-hidden="true"><span class="count-audit-cxu-base">${formatIntegerBR(baseUn)}</span><span class="count-audit-troca-delta">+${formatIntegerBR(tUn)}</span></span>`
      : `UN ${formatIntegerBR(baseUn)}`;

  return `${pairOpen}<strong class="count-audit-cx-val">${cxInner}</strong><strong class="count-audit-un-val">${unInner}</strong></div>`;
}

function buildCountAuditDetailMarkup(row, detail, isLoading = false, compact = false) {
  const meta = row._auditMeta || {};
  const importInfo = detail?.import || countAuditState.importInfo || {};
  const history = Array.isArray(detail?.history) ? detail.history : [];
  const actors = Array.isArray(detail?.summary?.actors) ? detail.summary.actors : [];
  const devices = Array.isArray(detail?.summary?.devices) ? detail.summary.devices : [];
  const launches = detail?.summary?.launches || 0;
  const code = String(row.cod_produto || '');
  const shellClass = compact ? 'count-audit-detail-shell count-audit-detail-shell--compact' : 'count-audit-detail-shell';
  const historyTitle = compact ? 'Histórico' : 'Histórico de lançamentos';
  const trailTitle = compact ? 'Trilha' : 'Trilha de auditoria';
  const trailSubtitle = compact ? 'Contexto do item' : 'Contexto para validação e decisão';
  const recountLabel = compact ? 'Recontagem' : 'Abrir recontagem';
  const refreshLabel = compact ? 'Atualizar' : 'Atualizar detalhe';
  const expIsoDetail = countAuditMergedDisplayExpiryIso(code);
  const expRiskDetail = expIsoDetail ? countAuditValidityRiskClass(expIsoDetail) : '';
  const expDetailLine = expIsoDetail
    ? `<div class="count-audit-detail-validity-line${expRiskDetail ? ` ${expRiskDetail}` : ''}">Validade (referência) · ${escapeHtml(formatDateBR(expIsoDetail))}</div>`
    : '';
  const trocaDetailArticle = countAuditHasTrocaPending(meta)
    ? `<article class="count-audit-detail-metric count-audit-detail-metric--troca-pendente"><span>Troca (Base de Troca)</span><strong>${formatCountAuditDetailOpsCxUnLine(meta.trocaCx, meta.trocaUn, 'troca')}</strong><small>Saldo atual da Base de Troca V2 (mesmo dado do card Saldo acumulado); altera com Chegada, Saldo, Zerar ou Carregar.</small></article>`
    : meta.trocaMateCouro && !meta.trocaSaldoKnown
      ? `<article class="count-audit-detail-metric count-audit-detail-metric--troca-pendente"><span>Troca (Base de Troca)</span><strong>—</strong><small>Saldo ainda não carregado nesta sessão. Atualize a lista na Base de Troca ou recarregue a análise.</small></article>`
      : '';
  const breakDetailArticle = countAuditHasBreakDay(meta)
    ? `<article class="count-audit-detail-metric"><span>Quebra (dia)</span><strong>${formatCountAuditDetailOpsCxUnLine(meta.breakCx, meta.breakUn, 'break')}</strong><small>Alinhado à tela Quebra neste dia operacional</small></article>`
    : '';

  return (
    `<div class="${shellClass}">` +
      `<section class="count-audit-detail-hero">` +
        `<div class="count-audit-detail-hero-top">` +
          `<div>` +
            `<h4 class="count-audit-detail-title">${countAuditFlavorIconHtml(row.descricao || '')}<span class="count-audit-detail-title-text">${escapeHtml(row.descricao || 'Sem descrição')}</span></h4>` +
            `<div class="count-audit-detail-subtitle">Código ${escapeHtml(code || '-')} · Grupo ${escapeHtml(row.grupo || 'Sem grupo')}</div>` +
            `${expDetailLine}` +
          `</div>` +
          `<div class="count-audit-detail-pill-row">` +
            `<span class="count-audit-state-badge" data-state="${meta.stateKey}">${meta.stateLabel}</span>` +
            `<span class="count-audit-priority-badge">${meta.priorityLabel}</span>` +
          `</div>` +
        `</div>` +
        `<div class="count-audit-detail-grid">` +
          `<article class="count-audit-detail-metric"><span>Base / TXT</span><strong>${formatIntegerBR(Number(row.import_caixa) || 0)} CX / ${formatIntegerBR(Number(row.import_unidade) || 0)} UN</strong><small>${importInfo.id == null ? 'Fallback sem TXT' : (importInfo.file_name || 'Base importada')}</small></article>` +
          `<article class="count-audit-detail-metric count-audit-detail-metric--current-cxu"><span>Contagem:</span><div class="count-audit-detail-metric-cxu-wrap">${buildCountAuditMergedCurrentCxuHtml(row, meta)}</div><small>${launches} lançamento(s) sincronizado(s)</small></article>` +
          `<article class="count-audit-detail-metric"><span>Diferença em caixa</span><strong>${formatSignedIntegerBR(meta.diffCx ?? row.difference_caixa)}</strong><small>${escapeHtml(meta.divergenceLabel || 'Sem divergência')}</small></article>` +
          `<article class="count-audit-detail-metric"><span>Diferença em unidade</span><strong>${formatSignedIntegerBR(meta.diffUn ?? row.difference_unidade)}</strong><small>${escapeHtml(meta.recommendedAction || 'Sem recomendação')}</small></article>` +
          `${trocaDetailArticle}` +
          `${breakDetailArticle}` +
        `</div>` +
      `</section>` +
      `${isLoading ? '<div class="count-audit-detail-loading">Carregando trilha detalhada deste item...</div>' : ''}` +
      `<section class="count-audit-detail-section">` +
        `<div class="count-audit-detail-section-head"><h4>${historyTitle}</h4><span>${launches} registro(s) no dia operacional</span></div>` +
        `<ul class="count-audit-history-list">${buildCountAuditHistoryHtml(history)}</ul>` +
      `</section>` +
      `<section class="count-audit-detail-section">` +
        `<div class="count-audit-detail-section-head"><h4>${trailTitle}</h4><span>${trailSubtitle}</span></div>` +
        `<ul class="count-audit-trail-list">${buildCountAuditTrailHtml(row, meta, importInfo, actors, devices)}</ul>` +
      `</section>` +
      `<div class="count-audit-detail-actions">` +
        `<button type="button" class="count-audit-recount-live-btn" data-action="recount-live" data-code="${encodeURIComponent(code)}">Recontar em tempo real</button>` +
        `<button type="button" class="btn-secondary count-audit-detail-action-btn" data-audit-recount="${encodeURIComponent(code)}">${recountLabel}</button>` +
        `<button type="button" class="btn-secondary count-audit-detail-action-btn" data-audit-refresh-detail="${encodeURIComponent(code)}">${refreshLabel}</button>` +
        `${compact ? `<button type="button" class="btn-secondary count-audit-detail-action-btn" data-action="collapse" data-code="${encodeURIComponent(code)}">Fechar</button>` : ''}` +
      `</div>` +
    `</div>`
  );
}

function renderCountAuditDesktopRowMarkup(row) {
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
            `<span class="count-audit-row-name">${countAuditRowNameWithFlavorHtml(row.descricao)}</span>` +
            `${countAuditValidityMarkupForRow(code)}` +
          `</button>` +
        `</div>` +
        `<div class="count-audit-cell"><span class="count-audit-cell-label">Base / TXT</span><div class="count-audit-cxu-pair" aria-label="Caixa e unidade base TXT"><strong class="count-audit-cx-val">CX ${formatIntegerBR(Number(row.import_caixa) || 0)}</strong><strong class="count-audit-un-val">UN ${formatIntegerBR(Number(row.import_unidade) || 0)}</strong></div></div>` +
        `<div class="count-audit-cell"><span class="count-audit-cell-label">Contagem:</span>${buildCountAuditMergedCurrentCxuHtml(row, meta)}</div>` +
        `<div class="count-audit-cell"><span class="count-audit-cell-label">Diferença</span><div class="count-audit-diff-breakdown"><strong class="count-audit-diff-cx">CX ${formatSignedIntegerBR(meta.diffCx || 0)}</strong><strong class="count-audit-diff-un">UN ${formatSignedIntegerBR(meta.diffUn || 0)}</strong></div></div>` +
        `<div class="count-audit-cell count-audit-col-troca">${buildCountAuditTrocaColumnCellHtml(meta)}</div>` +
        `<div class="count-audit-cell count-audit-col-quebra">${buildCountAuditQuebraColumnCellHtml(meta)}</div>` +
        `<div class="count-audit-cell"><span class="count-audit-cell-label">Status e prioridade</span><strong class="count-audit-cell-value">${meta.stateLabel}</strong><span class="count-audit-cell-note">${meta.priorityLabel} · ${escapeHtml(meta.divergenceLabel || '')}</span></div>` +
        `<div class="count-audit-cell"><span class="count-audit-cell-label">Ação recomendada</span><strong class="count-audit-recommendation">${escapeHtml(meta.recommendedAction || 'Revisar')}</strong><span class="count-audit-row-insight">${escapeHtml(meta.insight || '')}</span></div>` +
        `<div class="count-audit-cell count-audit-cell--actions">` +
          `<button type="button" class="count-audit-btn-recount-live" data-action="recount-live" data-code="${encodeURIComponent(code)}">Recontar</button>` +
          `<button type="button" class="count-audit-detail-btn" data-action="detail" data-code="${encodeURIComponent(code)}">Detalhe</button>` +
        `</div>` +
      `</div>` +
    `</li>`
  );
}

function renderCountAuditMobileMissingBucketMarkup(hiddenMissingCount, totalMissingCount) {
  const showingAll = !!countAuditState.showAllMissingMobile;
  const label = showingAll ? 'Resumir lista' : 'Mostrar todos';
  const action = showingAll ? 'hide-missing' : 'show-missing';
  const headline = showingAll
    ? `Todos os ${formatIntegerBR(totalMissingCount)} itens sem contagem estão visíveis.`
    : `${formatIntegerBR(hiddenMissingCount)} itens sem contagem foram resumidos.`;
  const note = showingAll
    ? 'Use a lista completa para varrer todo o bloco pendente.'
    : 'A fila prioriza primeiro os itens com mais contexto e deixa a massa repetitiva sob demanda.';
  return (
    `<li class="count-audit-mobile-missing-bucket">` +
      `<strong>${headline}</strong>` +
      `<span>${note}</span>` +
      `<button type="button" class="btn-secondary count-audit-mobile-missing-toggle" data-action="${action}" data-code="__missing__">${label}</button>` +
    `</li>`
  );
}

function renderCountAuditMobileRowMarkup(row) {
  const meta = row._auditMeta || {};
  const code = String(row.cod_produto || '');
  const isExpanded = String(countAuditState.selectedCode || '') === code;
  const detail = getCountAuditCachedDetail(code);
  const isLoading = isExpanded && String(countAuditState.loadingDetailCode || '') === code && !detail;

  return (
    `<li class="count-audit-item" data-state="${meta.stateKey}" data-code="${escapeHtml(code)}">` +
      `<div class="count-audit-mobile-row">` +
        `<button type="button" class="count-audit-mobile-select" data-action="select" data-code="${encodeURIComponent(code)}">` +
          `<div class="count-audit-mobile-topline">` +
            `<span class="count-audit-state-badge" data-state="${meta.stateKey}">${meta.stateLabel}</span>` +
            `<span class="count-audit-priority-badge">${meta.priorityLabel}</span>` +
            `<span class="count-audit-code-badge">${escapeHtml(code || '-')}</span>` +
          `</div>` +
          `<span class="count-audit-row-name">${countAuditRowNameWithFlavorHtml(row.descricao)}</span>` +
          `${countAuditValidityMarkupForRow(code)}` +
          `<div class="count-audit-mobile-summary">` +
            `<strong class="count-audit-mobile-diff">|Dif| ${formatIntegerBR(meta.diffAbs || 0)}</strong>` +
            `<span class="count-audit-mobile-action">${escapeHtml(getCountAuditCompactActionLabel(meta))}</span>` +
          `</div>` +
          `${buildCountAuditMobileTrocaQuebraOpsHtml(meta)}` +
        `</button>` +
        `<button type="button" class="count-audit-mobile-recount-live-btn" data-action="recount-live" data-code="${encodeURIComponent(code)}">Recontar em tempo real</button>` +
        `<button type="button" class="btn-secondary count-audit-mobile-detail-toggle" data-action="toggle" data-code="${encodeURIComponent(code)}">${isExpanded ? 'Ocultar detalhe' : 'Ver detalhe'}</button>` +
      `</div>` +
      `${isExpanded ? `<div class="count-audit-mobile-inline-detail">${buildCountAuditDetailMarkup(row, detail, isLoading, true)}</div>` : ''}` +
    `</li>`
  );
}

function renderCountAuditRows(rows) {
  if (!countAuditList) return;
  applyMateCouroTrocaPendingToCountAuditRows();
  const previousSelectedCode = String(countAuditState.selectedCode || '');
  const isMobile = isCountAuditMobileViewport();
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
  const filteredCount = list.length;
  const mobileCompaction = compactMissingRowsForMobile(list, filters);
  const displayList = mobileCompaction.rows;

  if (countAuditTotal) countAuditTotal.textContent = formatIntegerBR(filteredCount);
  if (countAuditRangeInfo) {
    const loaded = getCountAuditRowsFromState().length;
    const limited = loaded >= 5000 ? ' Top 5.000 priorizados carregados.' : '';
    const compactedNote = mobileCompaction.hiddenMissingCount > 0
      ? ` ${formatIntegerBR(mobileCompaction.hiddenMissingCount)} sem contagem foram resumidos.`
      : '';
    countAuditRangeInfo.textContent = `Exibindo ${formatIntegerBR(displayList.length)} de ${formatIntegerBR(loaded)} itens carregados.${compactedNote}${limited}`;
  }

  if (!displayList.length) {
    countAuditList.innerHTML = '<li class="count-audit-empty"><span>Nenhum item corresponde aos filtros atuais.</span><strong>—</strong></li>';
    countAuditState.selectedCode = null;
    syncCountAuditListSelection();
    renderCountAuditDetailEmpty('Nenhum item atende aos filtros aplicados.');
    return;
  }

  if (isMobile) {
    if (!displayList.some((row) => String(row.cod_produto || '') === String(countAuditState.selectedCode || ''))) {
      countAuditState.selectedCode = null;
    }
  } else if (!countAuditState.selectedCode || !displayList.some((row) => String(row.cod_produto || '') === String(countAuditState.selectedCode))) {
    countAuditState.selectedCode = String(displayList[0].cod_produto || '');
  }

  const html = [];
  displayList.forEach((row, index) => {
    if (
      isMobile
      && mobileCompaction.compacted
      && mobileCompaction.totalMissingCount > 8
      && index === mobileCompaction.nonMissingCount
    ) {
      html.push(renderCountAuditMobileMissingBucketMarkup(
        mobileCompaction.hiddenMissingCount,
        mobileCompaction.totalMissingCount,
      ));
    }
    html.push(isMobile ? renderCountAuditMobileRowMarkup(row) : renderCountAuditDesktopRowMarkup(row));
  });

  countAuditList.innerHTML = html.join('');

  syncCountAuditListSelection();
  if (countAuditState.selectedCode && String(countAuditState.selectedCode || '') !== previousSelectedCode) {
    selectCountAuditRow(String(countAuditState.selectedCode || ''), {});
  } else if (!countAuditState.selectedCode) {
    renderCountAuditDetailEmpty();
  }
}

function renderCountAuditDetailEmpty(message = 'Selecione um item na fila ou use Detalhe.') {
  if (!countAuditDetailPanel) return;
  if (countAuditDetailStatus) countAuditDetailStatus.textContent = 'Sem seleção';
  countAuditDetailPanel.innerHTML =
    `<div class="count-audit-detail-empty">` +
      `<p class="count-audit-detail-empty-title">${escapeHtml(message)}</p>` +
      `<p class="muted">Histórico de lançamentos, trilha de auditoria, recontagem e atualização ficam neste painel.</p>` +
    `</div>`;
}

function renderCountAuditDetailShell(row, detail, isLoading = false) {
  if (!countAuditDetailPanel || !row) return;
  applyMateCouroTrocaPendingToCountAuditRows();
  const meta = row._auditMeta || {};

  if (countAuditDetailStatus) {
    countAuditDetailStatus.textContent = meta.stateLabel || 'Detalhe';
  }
  countAuditDetailPanel.innerHTML = buildCountAuditDetailMarkup(row, detail, isLoading, false);
}

async function loadCountAuditDetail(code, forceReload = false) {
  const row = getCountAuditRowByCode(code);
  if (!row || !countAuditDetailPanel) return;
  const cacheKey = getCountAuditDetailCacheKey(code);
  if (!forceReload && countAuditState.detailCache.has(cacheKey)) {
    countAuditState.loadingDetailCode = null;
    renderCountAuditDetailShell(row, countAuditState.detailCache.get(cacheKey), false);
    if (isCountAuditMobileViewport()) renderCountAuditRows(getCountAuditRowsFromState());
    return;
  }

  countAuditState.loadingDetailCode = String(code || '');
  renderCountAuditDetailShell(row, null, true);
  if (isCountAuditMobileViewport()) renderCountAuditRows(getCountAuditRowsFromState());
  const requestId = ++countAuditDetailRequestSeq;
  try {
    const params = new URLSearchParams();
    params.set('item_code', code);
    params.set('only_active', 'true');
    const referenceDate = (countAuditImport?.value || '').trim();
    if (referenceDate) params.set('reference_date', referenceDate);
    const response = await apiFetch(`${API_STOCK_ANALYSIS_DETAIL}?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Não foi possível carregar o detalhe.');
    }
    const detail = await response.json();
    countAuditState.loadingDetailCode = null;
    countAuditState.detailCache.set(cacheKey, detail);
    if (requestId === countAuditDetailRequestSeq && String(countAuditState.selectedCode || '') === String(code)) {
      renderCountAuditDetailShell(row, detail, false);
      if (isCountAuditMobileViewport()) renderCountAuditRows(getCountAuditRowsFromState());
    }
  } catch (error) {
    if (requestId !== countAuditDetailRequestSeq) return;
    countAuditState.loadingDetailCode = null;
    renderCountAuditDetailShell(row, null, false);
    if (isCountAuditMobileViewport()) renderCountAuditRows(getCountAuditRowsFromState());
    setCountAuditFeedback(error?.message || 'Falha ao carregar o detalhe do item.', true);
  }
}

/**
 * @param {string} code
 * @param {{ forceReload?: boolean, openDrawer?: boolean }} [opts]
 */
function selectCountAuditRow(code, opts = {}) {
  const forceReload = !!opts.forceReload;
  const openDrawer = !!opts.openDrawer;
  const row = getCountAuditRowByCode(code);
  if (!row) return;
  countAuditState.selectedCode = code;
  syncCountAuditListSelection();

  if (isCountAuditMobileViewport()) {
    loadCountAuditDetail(code, forceReload);
    return;
  }

  if (openDrawer) {
    openCountAuditDetailDrawer();
  }

  const drawerOpen = countAuditDrawerRoot?.classList.contains('is-open');
  if (drawerOpen) {
    loadCountAuditDetail(code, forceReload);
  }
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
  countAuditState.showAllMissingMobile = false;
  countAuditState.mobileFiltersExpanded = false;
  syncCountAuditFiltersPresentation();
  updateCountAuditSummarySelection();
  renderCountAuditRows(getCountAuditRowsFromState());
}

async function loadCountAuditBreakDay(dayKey) {
  countAuditState.breakDayKey = (dayKey || '').trim();
  countAuditState.breakDayOk = false;
  countAuditState.breakDayBalances = {};
  const dk = countAuditState.breakDayKey;
  const token = getToken();
  if (!dk || !token) return;
  if (unauthorizedRedirectInProgress) return;
  try {
    const params = new URLSearchParams();
    params.set('operational_date', dk);
    const response = await apiFetch(`${API_BREAK_DAY_TOTALS}?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) return;
    const data = await response.json();
    countAuditState.breakDayOk = true;
    countAuditState.breakDayBalances = data.balances || {};
    if (data.operational_date) {
      countAuditState.breakDayKey = String(data.operational_date).trim();
    }
  } catch {
    /* offline: enrichCountAuditRow usa só eventos locais do dia */
  }
}

/** Sincroniza com GET /audit/mate-troca-base-v2 (mesmo fluxo do card Saldo acumulado na Base de Troca). */
async function loadCountAuditMateTrocaServerPending() {
  await refreshMateTrocaBaseBalanceCardV2();
}

async function loadCountAuditValidityExpiryMap() {
  countAuditState.validityExpiryByCode = {};
  const token = getToken();
  if (!token || unauthorizedRedirectInProgress) return;
  try {
    const response = await apiFetch(API_VALIDITY_DISPLAY_EXPIRY_BY_PRODUCT, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) return;
    const data = await response.json();
    const raw = data.by_code || {};
    const norm = {};
    for (const k of Object.keys(raw)) {
      const c = normalizeItemCode(k);
      if (c) norm[c] = String(raw[k]).slice(0, 10);
    }
    countAuditState.validityExpiryByCode = norm;
  } catch {
    /* offline: só merge local em countAuditMergedDisplayExpiryIso */
  }
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
    /* only_diff fica no cliente (getCountAuditRowsFromState); API sempre traz base completa para os KPIs e o toggle. */
    params.set('only_diff', 'false');
    params.set('only_active', 'true');
    params.set('limit', '5000');

    const response = await apiFetch(`${API_STOCK_ANALYSIS}?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(response)) return;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      countAuditState.breakDayKey = '';
      countAuditState.breakDayOk = false;
      countAuditState.breakDayBalances = {};
      countAuditState.validityExpiryByCode = {};
      countAuditState.mateTrocaServerPending = {};
      mateTrocaServerPendingCache = {};
      mateTrocaDiscoveryCodesCache = new Set();
      mateTrocaBaseBalanceCacheV2 = {};
      mateTrocaBaseDiscoveryCodesV2 = new Set();
      mateTrocaBaseV2LastMergedRows = [];
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
      countAuditState.breakDayKey = '';
      countAuditState.breakDayOk = false;
      countAuditState.breakDayBalances = {};
      countAuditState.validityExpiryByCode = {};
      countAuditState.mateTrocaServerPending = {};
      mateTrocaServerPendingCache = {};
      mateTrocaDiscoveryCodesCache = new Set();
      mateTrocaBaseBalanceCacheV2 = {};
      mateTrocaBaseDiscoveryCodesV2 = new Set();
      mateTrocaBaseV2LastMergedRows = [];
      countAuditState.detailCache.clear();
      renderCountAuditSummary({});
      renderCountAuditRows([]);
      renderCountAuditDetailEmpty('Não foi possível montar a análise.');
      updateCountAuditHeaderContext();
      setCountAuditFeedback('Não foi possível montar a análise. Verifique permissões ou tente novamente.', true);
      return;
    }

    const breakDayKey = referenceDate || String(info.reference_date || '').trim() || getBrazilDateKey();
    await Promise.all([
      loadCountAuditBreakDay(breakDayKey),
      loadCountAuditValidityExpiryMap(),
      loadCountAuditMateTrocaServerPending(),
      ensureMateCouroCatalogLoaded(),
    ]);
    await ensureCountProductsCatalogForAudit();

    countAuditSummaryFilterKey = null;
    countAuditState.rows = (payload.rows || []).map(enrichCountAuditRow);
    countAuditState.summary = payload.summary || {};
    countAuditState.importInfo = info;
    countAuditState.loadedAt = new Date().toISOString();
    countAuditState.selectedCode = isCountAuditMobileViewport() ? null : countAuditState.selectedCode;
    countAuditState.loadingDetailCode = null;
    countAuditState.showAllMissingMobile = false;
    countAuditState.mobileFiltersExpanded = false;
    countAuditState.detailCache.clear();
    window.lastCountAuditRows = countAuditState.rows;

    populateCountAuditGroups(countAuditState.rows);
    updateCountAuditHeaderContext();
    syncCountAuditFiltersPresentation();
    renderCountAuditSummary(countAuditState.summary);
    renderCountAuditRows(countAuditState.rows);

    if (!isCountAuditMobileViewport()) {
      if (countAuditDrawerRoot?.classList.contains('is-open') && countAuditState.selectedCode) {
        loadCountAuditDetail(String(countAuditState.selectedCode), true);
      } else {
        renderCountAuditDetailEmpty('Abra o detalhe para ver histórico, trilha e ações.');
      }
    }

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

async function postRecountLiveSignal(codeRaw) {
  const code = String(codeRaw || '').trim();
  if (!code) return;
  if (!getToken()) return;
  const op = getActiveCountDateKey();
  try {
    const r = await apiFetch(API_RECOUNT_SIGNAL, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_produto: code, operational_date: op }),
    });
    if (handleUnauthorizedResponse(r)) return;
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      setCountAuditFeedback(String(err.detail || 'Não foi possível enviar a solicitação de recontagem.'), true);
      return;
    }
    setCountAuditFeedback(
      `Recontagem em tempo real enviada para ${code} (dia ${formatDateBR(op)}). O conferente verá o alerta roxo na Contagem com essa mesma data.`,
      false,
    );
  } catch {
    setCountAuditFeedback('Erro de conexão ao solicitar recontagem.', true);
  }
}

async function refreshRecountSignalsFromServer() {
  const subCount = document.getElementById('sub-count');
  if (!subCount || !subCount.classList.contains('active')) return;
  const token = getToken();
  if (!token || isAccessTokenExpired(token)) return;
  const op = getActiveCountDateKey();
  try {
    const r = await apiFetch(`${API_RECOUNT_SIGNALS}?operational_date=${encodeURIComponent(op)}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(r)) return;
    if (!r.ok) return;
    const data = await r.json();
    const codes = Array.isArray(data.codes) ? data.codes : [];
    serverRecountSignalCodes = new Set(codes.map((c) => String(c)));
    if (Array.isArray(countProductsCache) && countProductsCache.length) {
      refreshCountProductListView();
    }
  } catch {
    /* offline */
  }
}

function startCountRecountSignalsPolling() {
  stopCountRecountSignalsPolling();
  refreshRecountSignalsFromServer();
  countRecountSignalsPollTimer = window.setInterval(refreshRecountSignalsFromServer, 22000);
}

function stopCountRecountSignalsPolling() {
  if (countRecountSignalsPollTimer) {
    window.clearInterval(countRecountSignalsPollTimer);
    countRecountSignalsPollTimer = null;
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
  if (!countAuditVisibilityBound) {
    countAuditVisibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const sub = document.getElementById('sub-count-audit');
      if (!sub?.classList.contains('active')) return;
      if (!getToken()) return;
      void (async () => {
        if (navigator.onLine) await syncPendingEventsForAudit();
        await loadCountAuditAnalysis();
      })();
    });
  }
  if (!countAuditImport) return;
  if (btnCountAuditRefresh) {
    btnCountAuditRefresh.addEventListener('click', async () => {
      setCountAuditFeedback('Sincronizando análise...', false);
      if (navigator.onLine && getToken()) {
        await syncPendingEventsForAudit();
      }
      await loadCountAuditAnalysis();
    });
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
    el.addEventListener('change', () => {
      countAuditState.showAllMissingMobile = false;
      syncCountAuditFiltersPresentation();
      renderCountAuditRows(getCountAuditRowsFromState());
    });
  });

  if (countAuditClearFilters) {
    countAuditClearFilters.addEventListener('click', () => clearCountAuditFilters());
  }

  if (countAuditToggleFilters) {
    countAuditToggleFilters.addEventListener('click', () => {
      countAuditState.mobileFiltersExpanded = !countAuditState.mobileFiltersExpanded;
      syncCountAuditFiltersPresentation();
    });
  }

  if (countAuditList && !countAuditList.dataset.auditBound) {
    countAuditList.dataset.auditBound = '1';
    countAuditList.addEventListener('click', (e) => {
      const recountBtn = e.target.closest('[data-audit-recount]');
      if (recountBtn) {
        openCountAuditRecount(decodeURIComponent(recountBtn.dataset.auditRecount || ''));
        return;
      }
      const refreshBtn = e.target.closest('[data-audit-refresh-detail]');
      if (refreshBtn) {
        selectCountAuditRow(decodeURIComponent(refreshBtn.dataset.auditRefreshDetail || ''), { forceReload: true });
        return;
      }
      const recountLiveBtn = e.target.closest('[data-action="recount-live"]');
      if (recountLiveBtn) {
        postRecountLiveSignal(decodeURIComponent(recountLiveBtn.getAttribute('data-code') || ''));
        return;
      }
      const target = e.target.closest('[data-action][data-code]');
      if (!target) return;
      const action = target.dataset.action || '';
      if (action === 'show-missing') {
        countAuditState.showAllMissingMobile = true;
        renderCountAuditRows(getCountAuditRowsFromState());
        return;
      }
      if (action === 'hide-missing') {
        countAuditState.showAllMissingMobile = false;
        renderCountAuditRows(getCountAuditRowsFromState());
        return;
      }
      const code = decodeURIComponent(target.dataset.code || '');
      if (!code) return;
      if (action === 'collapse' || (action === 'toggle' && isCountAuditMobileViewport() && String(countAuditState.selectedCode || '') === code)) {
        countAuditState.selectedCode = null;
        countAuditState.loadingDetailCode = null;
        renderCountAuditRows(getCountAuditRowsFromState());
        renderCountAuditDetailEmpty();
        return;
      }
      selectCountAuditRow(code, { forceReload: action === 'detail', openDrawer: true });
    });
  }

  if (countAuditDetailPanel && !countAuditDetailPanel.dataset.auditBound) {
    countAuditDetailPanel.dataset.auditBound = '1';
    countAuditDetailPanel.addEventListener('click', (e) => {
      const recountLiveBtn = e.target.closest('[data-action="recount-live"]');
      if (recountLiveBtn) {
        postRecountLiveSignal(decodeURIComponent(recountLiveBtn.getAttribute('data-code') || ''));
        return;
      }
      const recountBtn = e.target.closest('[data-audit-recount]');
      if (recountBtn) {
        openCountAuditRecount(decodeURIComponent(recountBtn.dataset.auditRecount || ''));
        return;
      }
      const refreshBtn = e.target.closest('[data-audit-refresh-detail]');
      if (refreshBtn) {
        selectCountAuditRow(decodeURIComponent(refreshBtn.dataset.auditRefreshDetail || ''), { forceReload: true });
      }
    });
  }

  if (countAuditDrawerBackdrop) {
    countAuditDrawerBackdrop.addEventListener('click', () => closeCountAuditDetailDrawer());
  }
  if (countAuditDrawerClose) {
    countAuditDrawerClose.addEventListener('click', () => closeCountAuditDetailDrawer());
  }
  if (!countAuditDrawerEscBound) {
    countAuditDrawerEscBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!countAuditDrawerRoot?.classList.contains('is-open')) return;
      closeCountAuditDetailDrawer();
    });
  }

  syncCountAuditFiltersPresentation();

  if (countAuditMobileMediaQuery && !countAuditList.dataset.auditViewportBound) {
    countAuditList.dataset.auditViewportBound = '1';
    countAuditMobileMediaQuery.addEventListener('change', () => {
      countAuditState.showAllMissingMobile = false;
      if (isCountAuditMobileViewport()) {
        closeCountAuditDetailDrawer();
      }
      syncCountAuditFiltersPresentation();
      renderCountAuditSummary(countAuditState.summary || {});
      renderCountAuditRows(getCountAuditRowsFromState());
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

function fillSelect(selectId, options, selected = null, placeholderLabel = 'Selecione...') {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = placeholderLabel;
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
  const preserveProdutosCia = document.getElementById('produtos-filter-cia')?.value ?? '';
  const preserveProdutosSeg = document.getElementById('produtos-filter-segmento')?.value ?? '';
  const preserveProdutosMarca = document.getElementById('produtos-filter-marca')?.value ?? '';
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
  fillSelect('produtos-filter-cia', defaults.cod_grup_cia, preserveProdutosCia, 'Todos');
  fillSelect('produtos-filter-segmento', defaults.cod_grup_segmento, preserveProdutosSeg, 'Todos');
  fillSelect('produtos-filter-marca', defaults.cod_grup_marca, preserveProdutosMarca, 'Todos');
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
    const resp = await apiFetchProductsList(q, filters, { applyProdutosDimFilters: true });
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

  for (const fid of ['produtos-filter-cia', 'produtos-filter-segmento', 'produtos-filter-marca']) {
    const fel = document.getElementById(fid);
    if (fel) fel.addEventListener('change', () => searchProdutos());
  }

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

  document.addEventListener('click', (event) => {
    const hub = event.target.closest('.module-hub-card');
    if (hub) {
      const moduleKey = (hub.dataset.module || '').trim().toLowerCase();
      if (!moduleKey) return;
      if (!canAccessModule(moduleKey)) return;
      setActiveModule(moduleKey);
      closeSidebar();
      return;
    }
    const card = event.target.closest('.module-card');
    if (card) {
      const subKey = card.dataset.sub;
      if (subKey) {
        if (!canAccessHash(subKey)) return;
        /* setActiveModule atualiza o título do header (#sidebar-page-title) e delega a setActiveSub */
        setActiveModule(subKey);
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
    localStorage.removeItem(BREAK_EVENTS_BUCKET_KEY);
    localStorage.removeItem(MATE_COURO_TROCA_STORAGE_KEY);
    localStorage.removeItem(MATE_COURO_TROCA_STORAGE_LEGACY_KEY);
    localStorage.removeItem(MATE_TROCA_BASE_V2_LAST_VALID_KEY);
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
  if (loginForm.dataset.loginInFlight === '1') {
    return;
  }
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

  loginForm.dataset.loginInFlight = '1';
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
    loginForm.dataset.loginInFlight = '0';
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
  currentRole = normalizeRole(user?.role || 'conferente') || 'conferente';
  currentAllowedPages = Array.isArray(user?.allowed_pages)
    ? user.allowed_pages.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    : [];
  if (roleDisplay) {
    roleDisplay.textContent = `Perfil: ${currentRole}`;
  }

  renderModuleNav();
  renderSubCardsAccess();
  renderHubCards();
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
  updateCountKpi(countProductsCache);
  const adminPurgeSection = document.getElementById('admin-purge-section');
  if (adminPurgeSection) {
    adminPurgeSection.style.display = currentRole === 'admin' ? 'block' : 'none';
  }
  updateMateTrocaReconcileFromBreaksButton();
  showDashboard();
}

// ── Logout ──────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => {
  if (countKpiTicker) {
    window.clearInterval(countKpiTicker);
    countKpiTicker = null;
  }
  clearSession();
  countServerCountState = { ok: false, balances: {}, meta: null };
  if (kpiCountUser) {
    kpiCountUser.textContent = 'Servidor: — · Você: —';
  }
  loginForm.reset();
  history.replaceState(null, '', historyBasePathNoHash());
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
  bindGlobalAdjustButtonKeyboardRetention();
  bindCountEvents();
  bindValidityEvents();
  bindCountAuditEvents();
  bindImportTxtEvents();
  bindProductEvents();
  bindProductParamsEvents();
  bindProdutosEvents();
  bindModuleEvents();
  bindExtraModules();
  bindBreakEvents();
  bindMateCouroTrocaEvents();
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
