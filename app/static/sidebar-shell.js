/**
 * Abre/fecha drawer da sidebar em páginas sem app.js (ex.: landing).
 * IDs alinhados ao shell global: btn-menu-toggle, btn-menu-close, sidebar-overlay, sidebar-menu.
 */
(function () {
  const sidebarMenu = document.getElementById('sidebar-menu');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const btnMenuToggle = document.getElementById('btn-menu-toggle');
  const btnMenuClose = document.getElementById('btn-menu-close');

  function openSidebar() {
    if (!sidebarMenu || !sidebarOverlay) return;
    sidebarMenu.classList.add('open');
    sidebarOverlay.classList.add('open');
    document.body.classList.add('sidebar-drawer-open');
  }

  function closeSidebar() {
    if (!sidebarMenu || !sidebarOverlay) return;
    sidebarMenu.classList.remove('open');
    sidebarOverlay.classList.remove('open');
    document.body.classList.remove('sidebar-drawer-open');
  }

  if (btnMenuToggle) btnMenuToggle.addEventListener('click', openSidebar);
  if (btnMenuClose) btnMenuClose.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      window.location.href = '/app';
    });
  }
})();
