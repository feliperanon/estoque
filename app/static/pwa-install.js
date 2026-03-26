(function setupPwaInstall() {
  const installBtn = document.getElementById('btn-install-app');
  const feedbackEl = document.getElementById('install-feedback');
  let deferredPrompt = null;

  function setFeedback(message) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
  }

  function showInstallButton(show) {
    if (!installBtn) return;
    installBtn.hidden = !show;
    installBtn.disabled = !show;
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('/static/service-worker.js');
    } catch {
      setFeedback('Nao foi possivel habilitar o modo offline neste navegador.');
    }
  }

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton(true);
    setFeedback('Aplicativo pronto para instalar e usar offline.');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstallButton(false);
    setFeedback('Aplicativo instalado com sucesso.');
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        setFeedback('Use o menu do navegador e escolha "Instalar aplicativo".');
        return;
      }

      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      showInstallButton(false);

      if (choice.outcome !== 'accepted') {
        setFeedback('Instalacao cancelada. Voce pode tentar novamente depois.');
      }
    });
  }

  if (isStandaloneMode()) {
    showInstallButton(false);
    setFeedback('Aplicativo instalado e pronto para uso offline.');
  } else if (installBtn) {
    // Mostra botao com fallback para navegadores que nao disparam beforeinstallprompt.
    showInstallButton(true);
  }

  registerServiceWorker();
})();
