(function () {
  'use strict';
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; });
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
  function init() {
    const headerBtn = document.getElementById('installHeaderBtn');
    if (headerBtn && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)) { headerBtn.style.display = 'none'; }
  }
})();
