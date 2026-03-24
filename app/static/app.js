/**
 * app.js — Controle de SPA do sistema Estoque.
 * Gerencia alternância entre tela de login e dashboard,
 * autenticação via API e persistência de sessão no localStorage.
 */

const API_LOGIN  = '/api/auth/login-legacy';
const TOKEN_KEY  = 'estoque_token';
const USER_KEY   = 'estoque_user';

// ── Elementos ──────────────────────────────────────────────────
const viewLogin     = document.getElementById('view-login');
const viewDashboard = document.getElementById('view-dashboard');
const loginForm     = document.getElementById('login-form');
const loginError    = document.getElementById('login-error');
const btnLogin      = document.getElementById('btn-login');
const btnSpinner    = document.getElementById('btn-spinner');
const btnLogout     = document.getElementById('btn-logout');
const userDisplay   = document.getElementById('user-display');

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

  if (!username || !password) {
    loginError.textContent = 'Preencha usuário e senha.';
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
      loginError.textContent = err.detail || 'Usuário ou senha incorretos.';
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
  const label = user?.name || user?.username || 'Usuário';
  userDisplay.textContent = label;
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
  const token = getToken();
  const user  = getUser();

  if (token && user) {
    initDashboard(user);
  } else {
    showLogin();
  }
})();
