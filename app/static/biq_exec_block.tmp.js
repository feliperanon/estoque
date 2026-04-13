let _biQuebrasChartLine = null;
let _biQuebrasChartReason = null;
let _biQuebrasSelectedCompany = '';
let _biQuebrasSelectedCiaScope = 'todas';
let _biQuebrasCurrentCompanies = [];
let _biQuebrasLastPayload = null;
let _biQuebrasActiveTab = 'trend';
let _biQuebrasDrawerOpen = false;
let _biQuebrasFallbackPresentation = false;

const _biQuebrasPageState = {
  companies: 0,
  reasons: 0,
  products: 0,
  drawer: 0,
};

const BI_QUEBRAS_PALETTE = [
  '#c23b2a', '#d97706', '#15803d', '#0f766e', '#2563eb',
  '#4f46e5', '#9333ea', '#be185d', '#0891b2', '#475569',
];
const BI_QUEBRAS_CIA_SCOPE_VALUES = new Set(['todas', 'mate-couro', 'outras']);
const BI_QUEBRAS_TAB_IDS = ['trend', 'reasons', 'products'];
const BI_QUEBRAS_PAGE_SIZE = {
  companies: 6,
  reasons: 5,
  products: 5,
  drawer: 6,
};

const BI_QUEBRAS_TEMPLATE = String.raw`
  <header class="bi-quebras-header card" aria-labelledby="bi-quebras-title">
    <span id="bi-quebras-loading-chip" class="sr-only" hidden aria-live="polite">Carregando...</span>
    <div class="bi-quebras-header-top">
      <div class="bi-quebras-header-copy">
        <span class="bi-quebras-header-kicker">Painel executivo de perdas</span>
        <h2 id="bi-quebras-title" class="bi-quebras-title">BI de Quebras</h2>
        <p id="bi-quebras-period-subtitle" class="bi-quebras-header-subtitle muted">Selecione o periodo para analisar o impacto financeiro no intervalo desejado.</p>
      </div>
      <div class="bi-quebras-header-stamps" aria-label="Contexto do painel">
        <article class="bi-quebras-stamp">
          <span class="bi-quebras-stamp-label">Periodo</span>
          <strong id="bi-quebras-period-label" class="bi-quebras-stamp-value">--</strong>
        </article>
        <article class="bi-quebras-stamp">
          <span class="bi-quebras-stamp-label">Atualizado</span>
          <strong id="bi-quebras-updated-at" class="bi-quebras-stamp-value">--</strong>
        </article>
        <article class="bi-quebras-stamp">
          <span class="bi-quebras-stamp-label">Escopo CIA</span>
          <strong id="bi-quebras-scope-label" class="bi-quebras-stamp-value">Todas CIA</strong>
        </article>
      </div>
    </div>
    <div class="bi-quebras-toolbar" aria-label="Filtros do BI de Quebras">
      <div class="bi-quebras-field bi-quebras-field--date">
        <label class="bi-quebras-label" for="bi-quebras-date-from">De</label>
        <input id="bi-quebras-date-from" name="bi-quebras-date-from" type="date" class="search-input bi-quebras-date-input" aria-label="Data inicial do periodo" />
      </div>
      <div class="bi-quebras-field bi-quebras-field--date">
        <label class="bi-quebras-label" for="bi-quebras-date-to">Ate</label>
        <input id="bi-quebras-date-to" name="bi-quebras-date-to" type="date" class="search-input bi-quebras-date-input" aria-label="Data final do periodo" />
      </div>
      <div class="bi-quebras-field bi-quebras-field--scope">
        <span class="bi-quebras-label">Visualizacao CIA</span>
        <div class="bi-quebras-scope-toggle" role="group" aria-label="Filtro visual por CIA">
          <button type="button" class="btn-secondary bi-quebras-scope-btn is-active" data-bi-quebras-cia-scope="todas" aria-pressed="true">Todas CIA</button>
          <button type="button" class="btn-secondary bi-quebras-scope-btn" data-bi-quebras-cia-scope="mate-couro" aria-pressed="false">CIA Mate couro</button>
          <button type="button" class="btn-secondary bi-quebras-scope-btn" data-bi-quebras-cia-scope="outras" aria-pressed="false">Outras CIA</button>
        </div>
      </div>
      <div class="bi-quebras-actions">
        <button type="button" id="btn-bi-quebras-load" class="btn-secondary bi-quebras-btn-load">Atualizar painel</button>
        <button type="button" id="btn-bi-quebras-mode" class="btn-secondary btn-dark bi-quebras-btn-mode" aria-pressed="false">Modo apresentacao</button>
      </div>
    </div>
    <div id="bi-quebras-feedback" class="field-feedback bi-quebras-feedback" aria-live="polite" style="display:none;"></div>
  </header>

  <div class="bi-quebras-kpi-strip" id="bi-quebras-kpi-strip" role="list" aria-label="Indicadores executivos de quebras">
    <article class="bi-quebras-kpi-card bi-quebras-kpi-card--loss" role="listitem">
      <span class="bi-quebras-kpi-icon" aria-hidden="true">R$</span>
      <span class="bi-quebras-kpi-label">Prejuizo estimado total</span>
      <strong id="bi-quebras-kpi-loss" class="bi-quebras-kpi-value">--</strong>
      <span id="bi-quebras-kpi-loss-note" class="bi-quebras-kpi-sub">Aguardando carga</span>
    </article>
    <article class="bi-quebras-kpi-card bi-quebras-kpi-card--products" role="listitem">
      <span class="bi-quebras-kpi-icon" aria-hidden="true">MX</span>
      <span class="bi-quebras-kpi-label">Produtos com quebra</span>
      <strong id="bi-quebras-kpi-products" class="bi-quebras-kpi-value">--</strong>
      <span id="bi-quebras-kpi-products-note" class="bi-quebras-kpi-sub">Leitura executiva do mix</span>
    </article>
    <article class="bi-quebras-kpi-card bi-quebras-kpi-card--cx" role="listitem">
      <span class="bi-quebras-kpi-icon" aria-hidden="true">CX</span>
      <span class="bi-quebras-kpi-label">Total de caixas</span>
      <strong id="bi-quebras-kpi-cx" class="bi-quebras-kpi-value">--</strong>
      <span id="bi-quebras-kpi-cx-note" class="bi-quebras-kpi-sub">Volume consolidado</span>
    </article>
    <article class="bi-quebras-kpi-card bi-quebras-kpi-card--un" role="listitem">
      <span class="bi-quebras-kpi-icon" aria-hidden="true">UN</span>
      <span class="bi-quebras-kpi-label">Total de unidades</span>
      <strong id="bi-quebras-kpi-un" class="bi-quebras-kpi-value">--</strong>
      <span id="bi-quebras-kpi-un-note" class="bi-quebras-kpi-sub">Volume detalhado</span>
    </article>
    <article class="bi-quebras-kpi-card bi-quebras-kpi-card--company" role="listitem">
      <span class="bi-quebras-kpi-icon" aria-hidden="true">CIA</span>
      <span class="bi-quebras-kpi-label">Companhia mais impactada</span>
      <strong id="bi-quebras-kpi-company" class="bi-quebras-kpi-value">--</strong>
      <span id="bi-quebras-kpi-company-note" class="bi-quebras-kpi-sub">Clique na CIA para abrir o detalhamento</span>
    </article>
  </div>

  <div class="bi-quebras-main" id="bi-quebras-main">
    <section class="card bi-quebras-companies-card" aria-labelledby="bi-quebras-companies-title">
      <div class="bi-quebras-section-head">
        <div>
          <h3 id="bi-quebras-companies-title">Impacto por companhia</h3>
          <p class="bi-quebras-card-sub muted">Barras horizontais ordenadas por prejuizo. Clique na CIA para abrir o drill-down executivo.</p>
        </div>
        <div class="bi-quebras-inline-pager" aria-label="Paginacao de companhias">
          <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="companies:prev">Anterior</button>
          <span class="bi-quebras-page-indicator"><strong id="bi-quebras-company-page-current">1</strong>/<span id="bi-quebras-company-page-total">1</span></span>
          <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="companies:next">Proxima</button>
        </div>
      </div>
      <div id="bi-quebras-company-board" class="bi-quebras-company-board" role="list" aria-label="Lista de companhias por impacto"></div>
    </section>

    <section class="card bi-quebras-side-card" aria-labelledby="bi-quebras-side-title">
      <div class="bi-quebras-section-head bi-quebras-section-head--tabs">
        <div>
          <h3 id="bi-quebras-side-title">Leitura executiva</h3>
          <p class="bi-quebras-card-sub muted">Tendencia, principais motivos e ranking critico em uma area fixa de apresentacao.</p>
        </div>
        <div class="bi-quebras-tabs" role="tablist" aria-label="Alternar leitura executiva">
          <button type="button" class="bi-quebras-tab-btn is-active" data-bi-quebras-tab="trend" role="tab" aria-selected="true">Tendencia</button>
          <button type="button" class="bi-quebras-tab-btn" data-bi-quebras-tab="reasons" role="tab" aria-selected="false">Motivos</button>
          <button type="button" class="bi-quebras-tab-btn" data-bi-quebras-tab="products" role="tab" aria-selected="false">Produtos criticos</button>
        </div>
      </div>

      <div class="bi-quebras-side-stage">
        <section id="bi-quebras-tab-trend" class="bi-quebras-tab-panel is-active" role="tabpanel" aria-label="Tendencia por dia">
          <div class="bi-quebras-chart-wrap bi-quebras-chart-wrap--executive">
            <canvas id="bi-quebras-chart-line" role="img" aria-label="Grafico de prejuizo por dia"></canvas>
            <p id="bi-quebras-chart-empty" class="bi-quebras-chart-empty muted" hidden>Nenhum dado disponivel para o periodo.</p>
          </div>
          <div id="bi-quebras-trend-metrics" class="bi-quebras-trend-metrics" aria-label="Metricas da tendencia"></div>
        </section>

        <section id="bi-quebras-tab-reasons" class="bi-quebras-tab-panel" role="tabpanel" aria-label="Principais motivos" hidden>
          <div class="bi-quebras-reason-stage">
            <div class="bi-quebras-mini-chart-card">
              <div class="bi-quebras-chart-wrap bi-quebras-chart-wrap--mini">
                <canvas id="bi-quebras-chart-reason" role="img" aria-label="Grafico de prejuizo por motivo"></canvas>
                <p id="bi-quebras-reason-empty" class="bi-quebras-chart-empty muted" hidden>Nenhum motivo relevante no periodo.</p>
              </div>
            </div>
            <div class="bi-quebras-panel-list-card">
              <ul id="bi-quebras-reason-list" class="bi-quebras-executive-list" role="list" aria-label="Lista de motivos com maior impacto"></ul>
              <div class="bi-quebras-inline-pager bi-quebras-inline-pager--footer" aria-label="Paginacao de motivos">
                <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="reasons:prev">Anterior</button>
                <span class="bi-quebras-page-indicator"><strong id="bi-quebras-reason-page-current">1</strong>/<span id="bi-quebras-reason-page-total">1</span></span>
                <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="reasons:next">Proxima</button>
              </div>
            </div>
          </div>
        </section>

        <section id="bi-quebras-tab-products" class="bi-quebras-tab-panel" role="tabpanel" aria-label="Produtos mais criticos" hidden>
          <div class="bi-quebras-panel-list-card bi-quebras-panel-list-card--full">
            <ul id="bi-quebras-ranking-list" class="bi-quebras-executive-list bi-quebras-executive-list--products" role="list" aria-label="Top produtos com maior prejuizo"></ul>
            <div class="bi-quebras-inline-pager bi-quebras-inline-pager--footer" aria-label="Paginacao de produtos">
              <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="products:prev">Anterior</button>
              <span class="bi-quebras-page-indicator"><strong id="bi-quebras-product-page-current">1</strong>/<span id="bi-quebras-product-page-total">1</span></span>
              <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="products:next">Proxima</button>
            </div>
          </div>
        </section>
      </div>
    </section>

    <aside id="bi-quebras-company-drawer" class="bi-quebras-company-drawer" hidden role="dialog" aria-modal="false" aria-labelledby="bi-quebras-company-products-title">
      <div class="bi-quebras-drawer-head">
        <div>
          <span class="bi-quebras-drawer-kicker">Drill-down por CIA</span>
          <h3 id="bi-quebras-company-products-title" class="bi-quebras-drawer-title">Produtos da CIA</h3>
          <p id="bi-quebras-company-products-meta" class="bi-quebras-card-sub muted">Selecione uma companhia para detalhar o grupo.</p>
        </div>
        <button type="button" id="btn-bi-quebras-drawer-close" class="btn-secondary bi-quebras-drawer-close" aria-label="Fechar detalhamento da CIA">Fechar</button>
      </div>
      <div class="bi-quebras-drawer-stats">
        <article class="bi-quebras-drawer-stat">
          <span class="bi-quebras-drawer-stat-label">Total da CIA</span>
          <strong id="bi-quebras-company-products-total" class="bi-quebras-drawer-stat-value">--</strong>
        </article>
        <article class="bi-quebras-drawer-stat">
          <span class="bi-quebras-drawer-stat-label">Produtos</span>
          <strong id="bi-quebras-company-products-count" class="bi-quebras-drawer-stat-value">0</strong>
        </article>
        <article class="bi-quebras-drawer-stat">
          <span class="bi-quebras-drawer-stat-label">Participacao</span>
          <strong id="bi-quebras-company-products-share" class="bi-quebras-drawer-stat-value">--</strong>
        </article>
      </div>
      <div class="bi-quebras-drawer-list-wrap">
        <ul id="bi-quebras-company-products-list" class="bi-quebras-company-products-list" role="list" aria-label="Produtos da CIA selecionada"></ul>
      </div>
      <div class="bi-quebras-inline-pager bi-quebras-inline-pager--footer" aria-label="Paginacao dos produtos da CIA">
        <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="drawer:prev">Anterior</button>
        <span class="bi-quebras-page-indicator"><strong id="bi-quebras-drawer-page-current">1</strong>/<span id="bi-quebras-drawer-page-total">1</span></span>
        <button type="button" class="btn-secondary bi-quebras-page-btn" data-bi-quebras-page-nav="drawer:next">Proxima</button>
      </div>
    </aside>
  </div>

  <footer class="bi-quebras-footer card" aria-labelledby="bi-quebras-insights-title">
    <div class="bi-quebras-footer-head">
      <div>
        <h3 id="bi-quebras-insights-title">Insights para diretoria</h3>
        <p class="bi-quebras-card-sub muted">Frases curtas e prontas para a apresentacao executiva.</p>
      </div>
    </div>
    <div class="bi-quebras-insights" role="list" aria-label="Insights executivos">
      <article class="bi-quebras-insight-card" role="listitem">
        <span class="bi-quebras-insight-label">Companhia mais impactada</span>
        <p id="bi-quebras-insight-company" class="bi-quebras-insight-text">Carregue o painel para gerar este insight.</p>
      </article>
      <article class="bi-quebras-insight-card" role="listitem">
        <span class="bi-quebras-insight-label">Principal motivo</span>
        <p id="bi-quebras-insight-reason" class="bi-quebras-insight-text">Carregue o painel para gerar este insight.</p>
      </article>
      <article class="bi-quebras-insight-card" role="listitem">
        <span class="bi-quebras-insight-label">Produto mais critico</span>
        <p id="bi-quebras-insight-product" class="bi-quebras-insight-text">Carregue o painel para gerar este insight.</p>
      </article>
    </div>
    <div id="bi-quebras-no-price-alert" class="bi-quebras-no-price-alert" hidden role="alert" aria-live="polite">
      <span class="bi-quebras-alert-icon" aria-hidden="true">!</span>
      <div class="bi-quebras-alert-text">
        <strong>Atencao de cadastro</strong>
        <p id="bi-quebras-no-price-list" class="bi-quebras-no-price-list"></p>
      </div>
    </div>
  </footer>
`;

function _biQuebrasEnsureLayout() {
  const shell = document.querySelector('#sub-bi-quebras .bi-quebras-shell');
  if (!shell || shell.dataset.executiveMounted === 'true') return;
  shell.innerHTML = BI_QUEBRAS_TEMPLATE;
  shell.dataset.executiveMounted = 'true';
}

function _biQuebrasEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _biQuebrasFormatBRL(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _biQuebrasFormatNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString('pt-BR') : '--';
}

function _biQuebrasFormatPct(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: num < 10 ? 1 : 0, maximumFractionDigits: 1 }) + '%';
}

function _biQuebrasFormatDateShort(dateKey) {
  const parts = String(dateKey || '').split('-');
  if (parts.length !== 3) return '--';
  return `${parts[2]}/${parts[1]}`;
}

function _biQuebrasFormatDateLong(dateKey) {
  const parts = String(dateKey || '').split('-');
  if (parts.length !== 3) return '--';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function _biQuebrasScopeLabel(scope) {
  if (scope === 'mate-couro') return 'CIA Mate couro';
  if (scope === 'outras') return 'Outras CIA';
  return 'Todas CIA';
}

function _biQuebrasCompanyHasEffectiveBreak(row) {
  if (!row || typeof row !== 'object') return false;
  return (Number(row.loss_brl) || 0) > 0 || (Number(row.total_cx) || 0) > 0 || (Number(row.total_un) || 0) > 0;
}

function _biQuebrasNormalizeCompanies(items) {
  return (Array.isArray(items) ? items : [])
    .filter(_biQuebrasCompanyHasEffectiveBreak)
    .slice()
    .sort((a, b) => (Number(b.loss_brl) || 0) - (Number(a.loss_brl) || 0));
}

function _biQuebrasGetReasonItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => (Number(item?.loss_brl) || 0) > 0)
    .slice()
    .sort((a, b) => (Number(b.loss_brl) || 0) - (Number(a.loss_brl) || 0));
}

function _biQuebrasGetTopProducts(items) {
  return (Array.isArray(items) ? items : [])
    .slice()
    .sort((a, b) => (Number(b.loss_brl) || 0) - (Number(a.loss_brl) || 0));
}

function _biQuebrasGetActiveDays(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => Number(item?.items_with_break || 0) > 0)
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}
function _biQuebrasChartTooltipTheme() {
  return {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    titleColor: '#f8fafc',
    bodyColor: '#f8fafc',
    padding: 12,
    cornerRadius: 10,
    titleFont: { size: 12, weight: '600' },
    bodyFont: { size: 13, weight: '500' },
    displayColors: false,
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  };
}

function _biQuebrasLineScalesLight() {
  return {
    x: {
      grid: { color: 'rgba(15, 23, 42, 0.06)', drawBorder: false },
      ticks: { color: '#475569', font: { size: 11, weight: '600' }, maxRotation: 0 },
      border: { display: false },
    },
    y: {
      grid: { color: 'rgba(15, 23, 42, 0.06)', drawBorder: false },
      ticks: {
        color: '#475569',
        font: { size: 11, weight: '600' },
        callback: (value) => 'R$ ' + Number(value).toLocaleString('pt-BR'),
      },
      border: { display: false },
      beginAtZero: true,
    },
  };
}

function _biQuebrasLineDatasetGradient(chart, baseRgb) {
  const { ctx, chartArea } = chart;
  if (!chartArea) return `rgba(${baseRgb}, 0.16)`;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, `rgba(${baseRgb}, 0.3)`);
  gradient.addColorStop(1, `rgba(${baseRgb}, 0.04)`);
  return gradient;
}

function _biQuebrasResizeChartsSoon() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { _biQuebrasChartLine?.resize(); } catch { /* ignore */ }
      try { _biQuebrasChartReason?.resize(); } catch { /* ignore */ }
    });
  });
}

function _biQuebrasShowFeedback(message, isError) {
  const el = document.getElementById('bi-quebras-feedback');
  if (!el) return;
  el.textContent = message;
  el.className = `field-feedback bi-quebras-feedback ${isError ? 'field-feedback--error' : 'field-feedback--ok'}`;
  el.style.display = message ? '' : 'none';
}

function _biQuebrasSyncScopeButtons() {
  document.querySelectorAll('[data-bi-quebras-cia-scope]').forEach((btn) => {
    const isActive = btn.getAttribute('data-bi-quebras-cia-scope') === _biQuebrasSelectedCiaScope;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  const label = document.getElementById('bi-quebras-scope-label');
  if (label) label.textContent = _biQuebrasScopeLabel(_biQuebrasSelectedCiaScope);
}

function _biQuebrasGetShell() {
  return document.querySelector('#sub-bi-quebras .bi-quebras-shell');
}

function _biQuebrasIsPresentationMode() {
  const shell = _biQuebrasGetShell();
  return !!shell && (document.fullscreenElement === shell || _biQuebrasFallbackPresentation);
}

function _biQuebrasSyncPresentationButton() {
  const shell = _biQuebrasGetShell();
  const btn = document.getElementById('btn-bi-quebras-mode');
  const presenting = _biQuebrasIsPresentationMode();
  if (btn) {
    btn.textContent = presenting ? 'Sair da apresentacao' : 'Modo apresentacao';
    btn.setAttribute('aria-pressed', presenting ? 'true' : 'false');
  }
  document.body.classList.toggle('bi-quebras-presenting', presenting);
  shell?.classList.toggle('is-presentation-mode', presenting);
}

function _biQuebrasTogglePresentationMode() {
  const shell = _biQuebrasGetShell();
  if (!shell) return;
  if (document.fullscreenElement === shell) {
    document.exitFullscreen().catch(() => {});
    return;
  }
  if (document.fullscreenEnabled && typeof shell.requestFullscreen === 'function') {
    shell.requestFullscreen().catch(() => {
      _biQuebrasFallbackPresentation = !_biQuebrasFallbackPresentation;
      _biQuebrasSyncPresentationButton();
      _biQuebrasResizeChartsSoon();
    });
    return;
  }
  _biQuebrasFallbackPresentation = !_biQuebrasFallbackPresentation;
  _biQuebrasSyncPresentationButton();
  _biQuebrasResizeChartsSoon();
}

function _biQuebrasGetCollection(kind) {
  if (kind === 'companies') return _biQuebrasCurrentCompanies;
  if (kind === 'reasons') return _biQuebrasGetReasonItems(_biQuebrasLastPayload?.by_reason || []);
  if (kind === 'products') return _biQuebrasGetTopProducts(_biQuebrasLastPayload?.top_products || []);
  if (kind === 'drawer') {
    const company = _biQuebrasCurrentCompanies.find((item) => String(item.cia || '').trim() === _biQuebrasSelectedCompany);
    return company && Array.isArray(company.products)
      ? company.products.slice().sort((a, b) => (Number(b.loss_brl) || 0) - (Number(a.loss_brl) || 0))
      : [];
  }
  return [];
}

function _biQuebrasGetPagedItems(kind, items) {
  const source = Array.isArray(items) ? items : [];
  const pageSize = BI_QUEBRAS_PAGE_SIZE[kind] || Math.max(source.length, 1);
  const totalPages = Math.max(1, Math.ceil(source.length / pageSize));
  const nextPage = Math.max(0, Math.min(totalPages - 1, Number(_biQuebrasPageState[kind]) || 0));
  _biQuebrasPageState[kind] = nextPage;
  const start = nextPage * pageSize;
  return {
    page: nextPage,
    totalPages,
    items: source.slice(start, start + pageSize),
  };
}

function _biQuebrasSyncPager(kind, totalItems) {
  const pageSize = BI_QUEBRAS_PAGE_SIZE[kind] || Math.max(totalItems, 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.max(1, Math.min(totalPages, (Number(_biQuebrasPageState[kind]) || 0) + 1));
  const idBase = kind === 'companies' ? 'company' : kind === 'reasons' ? 'reason' : kind === 'products' ? 'product' : 'drawer';
  const currentEl = document.getElementById(`bi-quebras-${idBase}-page-current`);
  const totalEl = document.getElementById(`bi-quebras-${idBase}-page-total`);
  if (currentEl) currentEl.textContent = String(current);
  if (totalEl) totalEl.textContent = String(totalPages);
  document.querySelectorAll(`[data-bi-quebras-page-nav^="${kind}:"]`).forEach((btn) => {
    const direction = btn.getAttribute('data-bi-quebras-page-nav')?.split(':')[1];
    btn.toggleAttribute('disabled', (direction === 'prev' && current === 1) || (direction === 'next' && current === totalPages));
  });
}

function _biQuebrasRenderHeader(data) {
  const periodLabel = document.getElementById('bi-quebras-period-label');
  const subtitle = document.getElementById('bi-quebras-period-subtitle');
  const updatedAt = document.getElementById('bi-quebras-updated-at');
  const label = `${_biQuebrasFormatDateLong(data.date_from)} a ${_biQuebrasFormatDateLong(data.date_to)}`;
  if (periodLabel) periodLabel.textContent = label;
  if (subtitle) {
    subtitle.textContent = `Periodo analisado: ${label}. Escopo atual: ${_biQuebrasScopeLabel(_biQuebrasSelectedCiaScope)}. Leitura preparada para apresentacao executiva.`;
  }
  if (updatedAt) {
    updatedAt.textContent = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    });
  }
  _biQuebrasSyncScopeButtons();
}

function _biQuebrasSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _biQuebrasRenderKpis(data) {
  const summary = data.summary || {};
  const topCompany = _biQuebrasCurrentCompanies[0] || null;
  const topProduct = _biQuebrasGetTopProducts(data.top_products || [])[0] || null;
  const activeDays = _biQuebrasGetActiveDays(data.by_day || []);
  const avgUnits = activeDays.length ? Math.round((Number(summary.total_un) || 0) / activeDays.length) : 0;

  _biQuebrasSetText('bi-quebras-kpi-loss', _biQuebrasFormatBRL(summary.total_loss_brl));
  _biQuebrasSetText('bi-quebras-kpi-products', _biQuebrasFormatNumber(summary.unique_products));
  _biQuebrasSetText('bi-quebras-kpi-cx', _biQuebrasFormatNumber(summary.total_cx));
  _biQuebrasSetText('bi-quebras-kpi-un', _biQuebrasFormatNumber(summary.total_un));
  _biQuebrasSetText('bi-quebras-kpi-company', topCompany ? String(topCompany.cia || '--') : '--');

  _biQuebrasSetText(
    'bi-quebras-kpi-loss-note',
    activeDays.length ? `${activeDays.length} dias com lancamento no periodo` : 'Nenhum lancamento no periodo',
  );
  _biQuebrasSetText(
    'bi-quebras-kpi-products-note',
    topProduct ? `Maior produto critico: ${String(topProduct.descricao || topProduct.cod_produto || '--')}` : 'Sem produto critico no periodo',
  );
  _biQuebrasSetText(
    'bi-quebras-kpi-cx-note',
    topCompany ? `${_biQuebrasFormatNumber(topCompany.total_cx)} CX na CIA lider` : 'Sem concentracao por companhia',
  );
  _biQuebrasSetText(
    'bi-quebras-kpi-un-note',
    activeDays.length ? `Media de ${_biQuebrasFormatNumber(avgUnits)} UN por dia ativo` : 'Sem media diaria disponivel',
  );
  _biQuebrasSetText(
    'bi-quebras-kpi-company-note',
    topCompany ? `${_biQuebrasFormatPct(topCompany.pct)} do total · ${_biQuebrasFormatBRL(topCompany.loss_brl)}` : 'Clique na CIA para abrir o detalhamento',
  );
}

function _biQuebrasRenderTrendMetrics(byDay) {
  const wrap = document.getElementById('bi-quebras-trend-metrics');
  if (!wrap) return;
  const activeDays = _biQuebrasGetActiveDays(byDay);
  if (!activeDays.length) {
    wrap.innerHTML = `
      <article class="bi-quebras-trend-metric">
        <span class="bi-quebras-trend-metric-label">Status</span>
        <strong class="bi-quebras-trend-metric-value">Sem atividade</strong>
        <span class="bi-quebras-trend-metric-sub">Nao houve lancamentos de quebra no intervalo selecionado.</span>
      </article>
    `;
    return;
  }
  const peakDay = activeDays.reduce((best, item) => ((Number(item.loss_brl) || 0) > (Number(best.loss_brl) || 0) ? item : best), activeDays[0]);
  const totalLoss = activeDays.reduce((acc, item) => acc + (Number(item.loss_brl) || 0), 0);
  const avgLoss = totalLoss / activeDays.length;
  const lastDay = activeDays[activeDays.length - 1];
  wrap.innerHTML = `
    <article class="bi-quebras-trend-metric">
      <span class="bi-quebras-trend-metric-label">Pico diario</span>
      <strong class="bi-quebras-trend-metric-value">${_biQuebrasFormatBRL(peakDay.loss_brl)}</strong>
      <span class="bi-quebras-trend-metric-sub">${_biQuebrasFormatDateLong(peakDay.date)}</span>
    </article>
    <article class="bi-quebras-trend-metric">
      <span class="bi-quebras-trend-metric-label">Media por dia ativo</span>
      <strong class="bi-quebras-trend-metric-value">${_biQuebrasFormatBRL(avgLoss)}</strong>
      <span class="bi-quebras-trend-metric-sub">${activeDays.length} dias com lancamento</span>
    </article>
    <article class="bi-quebras-trend-metric">
      <span class="bi-quebras-trend-metric-label">Ultimo movimento</span>
      <strong class="bi-quebras-trend-metric-value">${_biQuebrasFormatDateShort(lastDay.date)}</strong>
      <span class="bi-quebras-trend-metric-sub">${_biQuebrasFormatBRL(lastDay.loss_brl)}</span>
    </article>
  `;
}

function _biQuebrasRenderTrendChart(byDay) {
  const canvas = document.getElementById('bi-quebras-chart-line');
  const emptyMsg = document.getElementById('bi-quebras-chart-empty');
  if (!canvas) return;
  const activeDays = _biQuebrasGetActiveDays(byDay);
  if (_biQuebrasChartLine) {
    _biQuebrasChartLine.destroy();
    _biQuebrasChartLine = null;
  }
  if (!activeDays.length) {
    canvas.style.display = 'none';
    if (emptyMsg) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'Nenhum lancamento de quebra no periodo.';
    }
    return;
  }
  if (typeof Chart !== 'function') {
    canvas.style.display = 'none';
    if (emptyMsg) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'Graficos indisponiveis no momento.';
    }
    return;
  }
  canvas.style.display = '';
  if (emptyMsg) emptyMsg.hidden = true;
  _biQuebrasChartLine = new Chart(canvas, {
    type: 'line',
    data: {
      labels: activeDays.map((day) => _biQuebrasFormatDateShort(day.date)),
      datasets: [{
        label: 'Prejuizo R$',
        data: activeDays.map((day) => Number(day.loss_brl) || 0),
        fill: true,
        backgroundColor: (ctx) => _biQuebrasLineDatasetGradient(ctx.chart, '194, 59, 42'),
        borderColor: '#c23b2a',
        borderWidth: 3,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#c23b2a',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 8,
        tension: 0.32,
        cubicInterpolationMode: 'monotone',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          ..._biQuebrasChartTooltipTheme(),
          callbacks: {
            label: (ctx) => ' ' + _biQuebrasFormatBRL(ctx.parsed.y),
          },
        },
      },
      scales: _biQuebrasLineScalesLight(),
    },
  });
}
function _biQuebrasRenderReasonChart(items) {
  const canvas = document.getElementById('bi-quebras-chart-reason');
  const emptyMsg = document.getElementById('bi-quebras-reason-empty');
  if (!canvas) return;
  const reasons = _biQuebrasGetReasonItems(items).slice(0, 6);
  if (_biQuebrasChartReason) {
    _biQuebrasChartReason.destroy();
    _biQuebrasChartReason = null;
  }
  if (!reasons.length) {
    canvas.style.display = 'none';
    if (emptyMsg) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'Nenhum motivo relevante no periodo.';
    }
    return;
  }
  if (typeof Chart !== 'function') {
    canvas.style.display = 'none';
    if (emptyMsg) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'Graficos indisponiveis no momento.';
    }
    return;
  }
  canvas.style.display = '';
  if (emptyMsg) emptyMsg.hidden = true;
  _biQuebrasChartReason = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: reasons.map((item) => String(item.reason || 'Sem motivo')),
      datasets: [{
        data: reasons.map((item) => Number(item.loss_brl) || 0),
        backgroundColor: BI_QUEBRAS_PALETTE.slice(0, reasons.length),
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      animation: { duration: 650, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          ..._biQuebrasChartTooltipTheme(),
          callbacks: {
            label: (ctx) => ' ' + _biQuebrasFormatBRL(ctx.parsed),
          },
        },
      },
    },
  });
}

function _biQuebrasEnsureSelectedCompanyPage() {
  if (!_biQuebrasSelectedCompany) return;
  const index = _biQuebrasCurrentCompanies.findIndex((item) => String(item.cia || '').trim() === _biQuebrasSelectedCompany);
  if (index >= 0) {
    _biQuebrasPageState.companies = Math.floor(index / BI_QUEBRAS_PAGE_SIZE.companies);
  }
}

function _biQuebrasRenderCompanyBoard(items) {
  const wrap = document.getElementById('bi-quebras-company-board');
  if (!wrap) return;
  _biQuebrasEnsureSelectedCompanyPage();
  const allItems = Array.isArray(items) ? items : [];
  const maxLoss = Math.max(1, ...allItems.map((item) => Number(item.loss_brl) || 0));
  const pageData = _biQuebrasGetPagedItems('companies', allItems);
  _biQuebrasSyncPager('companies', allItems.length);
  if (!pageData.items.length) {
    wrap.innerHTML = '<div class="bi-quebras-empty-state">Nenhuma companhia com impacto relevante no periodo.</div>';
    return;
  }
  wrap.innerHTML = pageData.items.map((item, index) => {
    const cia = String(item.cia || '--');
    const barWidth = Math.max(8, Math.round(((Number(item.loss_brl) || 0) / maxLoss) * 100));
    const isSelected = _biQuebrasDrawerOpen && _biQuebrasSelectedCompany === cia;
    return `
      <button type="button" class="bi-quebras-company-row${isSelected ? ' is-selected' : ''}" data-bi-quebras-company="${_biQuebrasEscapeHtml(cia)}" role="listitem" aria-pressed="${isSelected ? 'true' : 'false'}">
        <span class="bi-quebras-company-rank">${String(pageData.page * BI_QUEBRAS_PAGE_SIZE.companies + index + 1).padStart(2, '0')}</span>
        <span class="bi-quebras-company-main">
          <strong class="bi-quebras-company-name">${_biQuebrasEscapeHtml(cia)}</strong>
          <span class="bi-quebras-company-meta">${_biQuebrasFormatNumber(item.items)} produtos · ${_biQuebrasFormatNumber(item.total_cx)} CX · ${_biQuebrasFormatNumber(item.total_un)} UN</span>
        </span>
        <span class="bi-quebras-company-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></span>
        <span class="bi-quebras-company-value">
          <strong>${_biQuebrasFormatBRL(item.loss_brl)}</strong>
          <small>${_biQuebrasFormatPct(item.pct)}</small>
        </span>
      </button>
    `;
  }).join('');
}

function _biQuebrasRenderReasonPanel(items) {
  const list = document.getElementById('bi-quebras-reason-list');
  if (!list) return;
  const allItems = _biQuebrasGetReasonItems(items);
  const maxLoss = Math.max(1, ...allItems.map((item) => Number(item.loss_brl) || 0));
  const pageData = _biQuebrasGetPagedItems('reasons', allItems);
  _biQuebrasSyncPager('reasons', allItems.length);
  if (!pageData.items.length) {
    list.innerHTML = '<li class="bi-quebras-executive-empty">Nenhum motivo relevante no periodo.</li>';
    return;
  }
  list.innerHTML = pageData.items.map((item) => {
    const width = Math.max(8, Math.round(((Number(item.loss_brl) || 0) / maxLoss) * 100));
    return `
      <li class="bi-quebras-executive-row">
        <div class="bi-quebras-executive-copy">
          <strong>${_biQuebrasEscapeHtml(item.reason || 'Sem motivo')}</strong>
          <span>${_biQuebrasFormatNumber(item.occurrences)} ocorrencias</span>
        </div>
        <div class="bi-quebras-executive-bar" aria-hidden="true"><span style="width:${width}%"></span></div>
        <div class="bi-quebras-executive-metric">
          <strong>${_biQuebrasFormatBRL(item.loss_brl)}</strong>
          <span>${_biQuebrasFormatPct(item.pct)}</span>
        </div>
      </li>
    `;
  }).join('');
}

function _biQuebrasRenderProductsPanel(items) {
  const list = document.getElementById('bi-quebras-ranking-list');
  if (!list) return;
  const allItems = _biQuebrasGetTopProducts(items);
  const pageData = _biQuebrasGetPagedItems('products', allItems);
  _biQuebrasSyncPager('products', allItems.length);
  if (!pageData.items.length) {
    list.innerHTML = '<li class="bi-quebras-executive-empty">Nenhum produto critico no periodo.</li>';
    return;
  }
  list.innerHTML = pageData.items.map((item, index) => `
    <li class="bi-quebras-product-card">
      <span class="bi-quebras-product-rank">${String(pageData.page * BI_QUEBRAS_PAGE_SIZE.products + index + 1).padStart(2, '0')}</span>
      <div class="bi-quebras-product-copy">
        <strong>${_biQuebrasEscapeHtml(item.descricao || item.cod_produto || '--')}</strong>
        <span>${_biQuebrasEscapeHtml(item.cia || 'Sem CIA')} · ${_biQuebrasEscapeHtml(item.segmento || 'Sem segmento')}</span>
      </div>
      <div class="bi-quebras-product-metrics">
        <span>${_biQuebrasFormatNumber(item.cx)} CX</span>
        <span>${_biQuebrasFormatNumber(item.un)} UN</span>
      </div>
      <strong class="bi-quebras-product-loss">${_biQuebrasFormatBRL(item.loss_brl)}</strong>
    </li>
  `).join('');
}

function _biQuebrasRenderCompanyDrawer() {
  const drawer = document.getElementById('bi-quebras-company-drawer');
  const main = document.getElementById('bi-quebras-main');
  const list = document.getElementById('bi-quebras-company-products-list');
  if (!drawer || !main || !list) return;
  const company = _biQuebrasCurrentCompanies.find((item) => String(item.cia || '').trim() === _biQuebrasSelectedCompany);
  if (!_biQuebrasDrawerOpen || !company) {
    drawer.classList.remove('is-open');
    drawer.hidden = true;
    main.classList.remove('has-drawer');
    return;
  }
  const products = _biQuebrasGetCollection('drawer');
  const pageData = _biQuebrasGetPagedItems('drawer', products);
  _biQuebrasSyncPager('drawer', products.length);
  _biQuebrasSetText('bi-quebras-company-products-title', `Produtos da CIA ${String(company.cia || '--')}`);
  _biQuebrasSetText(
    'bi-quebras-company-products-meta',
    `${_biQuebrasFormatNumber(company.total_cx)} CX · ${_biQuebrasFormatNumber(company.total_un)} UN · ${_biQuebrasFormatNumber(company.items)} produtos no periodo`,
  );
  _biQuebrasSetText('bi-quebras-company-products-total', _biQuebrasFormatBRL(company.loss_brl));
  _biQuebrasSetText('bi-quebras-company-products-count', _biQuebrasFormatNumber(company.items));
  _biQuebrasSetText('bi-quebras-company-products-share', _biQuebrasFormatPct(company.pct));
  if (!pageData.items.length) {
    list.innerHTML = '<li class="bi-quebras-company-products-empty">Nenhum produto detalhado para esta CIA no periodo.</li>';
  } else {
    list.innerHTML = pageData.items.map((product, index) => `
      <li class="bi-quebras-company-product-row">
        <span class="bi-quebras-company-product-pos">${String(pageData.page * BI_QUEBRAS_PAGE_SIZE.drawer + index + 1).padStart(2, '0')}</span>
        <span class="bi-quebras-company-product-main">
          <strong class="bi-quebras-company-product-desc">${_biQuebrasEscapeHtml(product.descricao || product.cod_produto || '--')}</strong>
          <span class="bi-quebras-company-product-meta">${_biQuebrasEscapeHtml(product.segmento || 'Sem segmento')} · ${_biQuebrasEscapeHtml(product.cod_produto || '--')}</span>
        </span>
        <span class="bi-quebras-company-product-cx">${_biQuebrasFormatNumber(product.cx)} CX</span>
        <span class="bi-quebras-company-product-un">${_biQuebrasFormatNumber(product.un)} UN</span>
        <span class="bi-quebras-company-product-loss">${_biQuebrasFormatBRL(product.loss_brl)}</span>
      </li>
    `).join('');
  }
  drawer.hidden = false;
  main.classList.add('has-drawer');
  requestAnimationFrame(() => drawer.classList.add('is-open'));
}

function _biQuebrasCloseDrawer() {
  _biQuebrasDrawerOpen = false;
  _biQuebrasSelectedCompany = '';
  _biQuebrasPageState.drawer = 0;
  _biQuebrasRenderCompanyBoard(_biQuebrasCurrentCompanies);
  _biQuebrasRenderCompanyDrawer();
}

function _biQuebrasSelectCompany(cia) {
  const normalized = String(cia || '').trim();
  if (!normalized) return;
  _biQuebrasSelectedCompany = normalized;
  _biQuebrasDrawerOpen = true;
  _biQuebrasPageState.drawer = 0;
  _biQuebrasEnsureSelectedCompanyPage();
  _biQuebrasRenderCompanyBoard(_biQuebrasCurrentCompanies);
  _biQuebrasRenderCompanyDrawer();
}

function _biQuebrasRenderInsights(data) {
  const topCompany = _biQuebrasCurrentCompanies[0] || null;
  const topReason = _biQuebrasGetReasonItems(data.by_reason || [])[0] || null;
  const topProduct = _biQuebrasGetTopProducts(data.top_products || [])[0] || null;

  _biQuebrasSetText(
    'bi-quebras-insight-company',
    topCompany
      ? `${String(topCompany.cia || '--')} concentra ${_biQuebrasFormatPct(topCompany.pct)} do prejuizo, somando ${_biQuebrasFormatBRL(topCompany.loss_brl)} no periodo.`
      : 'Nao houve concentracao relevante por companhia no periodo.',
  );
  _biQuebrasSetText(
    'bi-quebras-insight-reason',
    topReason
      ? `${String(topReason.reason || '--')} lidera os motivos com ${_biQuebrasFormatBRL(topReason.loss_brl)} e ${_biQuebrasFormatNumber(topReason.occurrences)} ocorrencias.`
      : 'Nao houve motivo dominante no periodo analisado.',
  );
  _biQuebrasSetText(
    'bi-quebras-insight-product',
    topProduct
      ? `${String(topProduct.descricao || topProduct.cod_produto || '--')} e o produto mais critico, com ${_biQuebrasFormatBRL(topProduct.loss_brl)} de impacto estimado.`
      : 'Nenhum produto concentrou criticidade no intervalo analisado.',
  );
}

function _biQuebrasRenderNoPriceAlert(items) {
  const alert = document.getElementById('bi-quebras-no-price-alert');
  const list = document.getElementById('bi-quebras-no-price-list');
  const products = Array.isArray(items) ? items : [];
  if (!alert || !list) return;
  alert.hidden = products.length === 0;
  if (!products.length) return;
  const sample = products.slice(0, 6).join(', ');
  list.textContent = `${products.length} produto(s) sem preco cadastrado. O prejuizo estimado pode estar subavaliado. Itens-chave: ${sample}${products.length > 6 ? '...' : ''}`;
}

function _biQuebrasSyncTabs() {
  BI_QUEBRAS_TAB_IDS.forEach((tabId) => {
    const isActive = _biQuebrasActiveTab === tabId;
    const btn = document.querySelector(`[data-bi-quebras-tab="${tabId}"]`);
    const panel = document.getElementById(`bi-quebras-tab-${tabId}`);
    btn?.classList.toggle('is-active', isActive);
    btn?.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (panel) {
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    }
  });
  if (_biQuebrasActiveTab === 'trend') {
    _biQuebrasRenderTrendChart(_biQuebrasLastPayload?.by_day || []);
  } else if (_biQuebrasActiveTab === 'reasons') {
    _biQuebrasRenderReasonChart(_biQuebrasLastPayload?.by_reason || []);
  }
  _biQuebrasResizeChartsSoon();
}

function _biQuebrasRenderExecutiveView(data) {
  _biQuebrasRenderHeader(data);
  _biQuebrasRenderKpis(data);
  _biQuebrasRenderTrendMetrics(data.by_day || []);
  _biQuebrasRenderCompanyBoard(_biQuebrasCurrentCompanies);
  _biQuebrasRenderReasonPanel(data.by_reason || []);
  _biQuebrasRenderProductsPanel(data.top_products || []);
  _biQuebrasRenderInsights(data);
  _biQuebrasRenderNoPriceAlert(data.products_without_price || []);
  _biQuebrasSyncTabs();
  _biQuebrasRenderCompanyDrawer();
}
async function loadBiQuebras() {
  _biQuebrasEnsureLayout();
  const fromEl = document.getElementById('bi-quebras-date-from');
  const toEl = document.getElementById('bi-quebras-date-to');
  const loading = document.getElementById('bi-quebras-loading-chip');
  const token = getToken();

  _biQuebrasShowFeedback('', false);
  if (!token) return;
  if (isAccessTokenExpired(token)) {
    handleUnauthorizedResponse({ status: 401 });
    return;
  }
  if (unauthorizedRedirectInProgress) return;

  const params = new URLSearchParams();
  if (fromEl?.value) params.set('date_from', fromEl.value);
  if (toEl?.value) params.set('date_to', toEl.value);
  params.set('cia_scope', _biQuebrasSelectedCiaScope);

  if (loading) loading.hidden = false;
  let data;
  try {
    const res = await apiFetch(`/audit/bi-quebras?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (handleUnauthorizedResponse(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Erro ${res.status}`);
    }
    data = await res.json();
  } catch (error) {
    _biQuebrasShowFeedback(`Erro ao carregar BI: ${error.message}`, true);
    return;
  } finally {
    if (loading) loading.hidden = true;
  }

  _biQuebrasLastPayload = data;
  _biQuebrasCurrentCompanies = _biQuebrasNormalizeCompanies(data.by_company || []);
  _biQuebrasPageState.reasons = 0;
  _biQuebrasPageState.products = 0;
  if (!_biQuebrasCurrentCompanies.some((item) => String(item.cia || '').trim() === _biQuebrasSelectedCompany)) {
    _biQuebrasDrawerOpen = false;
    _biQuebrasSelectedCompany = '';
    _biQuebrasPageState.companies = 0;
    _biQuebrasPageState.drawer = 0;
  }
  if (typeof Chart !== 'function') {
    _biQuebrasShowFeedback(
      'Dados carregados, mas os graficos nao puderam ser exibidos porque o Chart.js nao carregou.',
      true,
    );
  }
  _biQuebrasRenderExecutiveView(data);
}

function _biQuebrasSetDefaultDates() {
  const fromEl = document.getElementById('bi-quebras-date-from');
  const toEl = document.getElementById('bi-quebras-date-to');
  if (!fromEl || !toEl) return;
  const today = getBrazilDateKey();
  if (!toEl.value) toEl.value = today;
  if (!fromEl.value) {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    fromEl.value = `${d.getFullYear()}-${month}-${day}`;
  }
}

function _biQuebrasRenderPage(kind) {
  if (kind === 'companies') {
    _biQuebrasRenderCompanyBoard(_biQuebrasCurrentCompanies);
    return;
  }
  if (kind === 'reasons') {
    _biQuebrasRenderReasonPanel(_biQuebrasLastPayload?.by_reason || []);
    if (_biQuebrasActiveTab === 'reasons') _biQuebrasRenderReasonChart(_biQuebrasLastPayload?.by_reason || []);
    return;
  }
  if (kind === 'products') {
    _biQuebrasRenderProductsPanel(_biQuebrasLastPayload?.top_products || []);
    return;
  }
  if (kind === 'drawer') {
    _biQuebrasRenderCompanyDrawer();
  }
}

function _biQuebrasChangePage(kind, delta) {
  const items = _biQuebrasGetCollection(kind);
  const pageSize = BI_QUEBRAS_PAGE_SIZE[kind] || Math.max(items.length, 1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  _biQuebrasPageState[kind] = Math.max(0, Math.min(totalPages - 1, (Number(_biQuebrasPageState[kind]) || 0) + delta));
  _biQuebrasRenderPage(kind);
}

function bindBiQuebrasEvents() {
  _biQuebrasEnsureLayout();
  _biQuebrasSetDefaultDates();
  _biQuebrasSyncScopeButtons();
  _biQuebrasSyncPresentationButton();

  document.addEventListener('DOMContentLoaded', () => {
    _biQuebrasEnsureLayout();
    _biQuebrasSetDefaultDates();
    _biQuebrasSyncScopeButtons();
    _biQuebrasSyncPresentationButton();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#btn-bi-quebras-load')) {
      event.preventDefault();
      _biQuebrasSetDefaultDates();
      loadBiQuebras();
      return;
    }

    if (target.closest('#btn-bi-quebras-mode')) {
      event.preventDefault();
      _biQuebrasTogglePresentationMode();
      return;
    }

    if (target.closest('#btn-bi-quebras-drawer-close')) {
      event.preventDefault();
      _biQuebrasCloseDrawer();
      return;
    }

    const scopeBtn = target.closest('[data-bi-quebras-cia-scope]');
    if (scopeBtn) {
      const nextScope = String(scopeBtn.getAttribute('data-bi-quebras-cia-scope') || '').trim();
      if (!BI_QUEBRAS_CIA_SCOPE_VALUES.has(nextScope) || nextScope === _biQuebrasSelectedCiaScope) return;
      _biQuebrasSelectedCiaScope = nextScope;
      _biQuebrasSelectedCompany = '';
      _biQuebrasDrawerOpen = false;
      _biQuebrasPageState.companies = 0;
      _biQuebrasPageState.drawer = 0;
      _biQuebrasSyncScopeButtons();
      loadBiQuebras();
      return;
    }

    const tabBtn = target.closest('[data-bi-quebras-tab]');
    if (tabBtn) {
      const nextTab = String(tabBtn.getAttribute('data-bi-quebras-tab') || '').trim();
      if (BI_QUEBRAS_TAB_IDS.includes(nextTab)) {
        _biQuebrasActiveTab = nextTab;
        _biQuebrasSyncTabs();
      }
      return;
    }

    const pageBtn = target.closest('[data-bi-quebras-page-nav]');
    if (pageBtn) {
      const raw = String(pageBtn.getAttribute('data-bi-quebras-page-nav') || '');
      const [kind, direction] = raw.split(':');
      if (kind && direction) {
        _biQuebrasChangePage(kind, direction === 'next' ? 1 : -1);
      }
      return;
    }

    const companyRow = target.closest('[data-bi-quebras-company]');
    if (companyRow) {
      _biQuebrasSelectCompany(companyRow.getAttribute('data-bi-quebras-company'));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (_biQuebrasDrawerOpen) {
      event.preventDefault();
      _biQuebrasCloseDrawer();
      return;
    }
    if (_biQuebrasFallbackPresentation) {
      _biQuebrasFallbackPresentation = false;
      _biQuebrasSyncPresentationButton();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) _biQuebrasFallbackPresentation = false;
    _biQuebrasSyncPresentationButton();
    _biQuebrasResizeChartsSoon();
  });
}

bindBiQuebrasEvents();
