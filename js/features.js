(function () {
  'use strict';

  /* =====================================================================
   *  FEATURE 1: Custom A2HS (Add to Home Screen) Banner
   * ===================================================================== */

  /* ---------- Dismiss policy helpers ---------- */
  var LS_KEY = 'installBannerMeta';
  var RETRY_DAYS = 7;
  var MAX_DISMISS_BEFORE_LONG_WAIT = 5;
  var LONG_WAIT_DAYS = 14;

  function getInstallMeta() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }

  function setInstallMeta(meta) {
    localStorage.setItem(LS_KEY, JSON.stringify(meta));
  }

  function isAlreadyInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  }

  function shouldShowBanner() {
    if (isAlreadyInstalled()) return false;

    var meta = getInstallMeta();
    if (meta.installed) return false;
    if (!meta.dismissCount) return true;

    var elapsed = Date.now() - (meta.lastDismissed || 0);
    if (meta.dismissCount >= MAX_DISMISS_BEFORE_LONG_WAIT) {
      return elapsed >= LONG_WAIT_DAYS * 86400000;
    }
    return elapsed >= RETRY_DAYS * 86400000;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  /* ---------- Banner DOM helpers ---------- */
  var deferredPrompt = null;

  function getBanner() {
    return document.getElementById('installBanner');
  }

  function showChromeBanner() {
    var banner = getBanner();
    if (!banner) return;
    banner.querySelector('.install-chrome').style.display = '';
    banner.querySelector('.install-ios').style.display = 'none';
    requestAnimationFrame(function () {
      banner.classList.add('visible');
    });
  }

  function showIOSBanner() {
    var banner = getBanner();
    if (!banner) return;
    banner.querySelector('.install-chrome').style.display = 'none';
    banner.querySelector('.install-ios').style.display = '';
    requestAnimationFrame(function () {
      banner.classList.add('visible');
    });
  }

  function hideBanner() {
    var banner = getBanner();
    if (!banner) return;
    banner.classList.remove('visible');
  }

  function dismissBanner() {
    hideBanner();
    var meta = getInstallMeta();
    meta.dismissCount = (meta.dismissCount || 0) + 1;
    meta.lastDismissed = Date.now();
    setInstallMeta(meta);
  }

  /* ---------- Capture beforeinstallprompt early (just store, don't touch DOM) ---------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  /* ---------- Header install button visibility ---------- */
  function showHeaderBtn() {
    var btn = document.getElementById('installHeaderBtn');
    if (btn) btn.style.display = '';
  }

  function hideHeaderBtn() {
    var btn = document.getElementById('installHeaderBtn');
    if (btn) btn.style.display = 'none';
  }

  /* ---------- Init everything once DOM is ready ---------- */
  function init() {
    var banner = document.getElementById('installBanner');
    if (!banner) return;

    /* Hide header button when running as PWA standalone */
    if (isAlreadyInstalled()) {
      hideHeaderBtn();
    }

    /* Popup only if not already installed and not recently dismissed */
    if (!shouldShowBanner()) return;

    /* Show the appropriate variant */
    if (isIOS()) {
      showIOSBanner();
    } else {
      showChromeBanner();
    }

    /* Close / dismiss buttons */
    var closeEls = ['closeBtn', 'dismissBtn', 'dismissIOSBtn'];
    closeEls.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', function () {
          deferredPrompt = null;
          dismissBanner();
        });
      }
    });

    /* Install button inside the popup – needs the captured beforeinstallprompt event */
    var installBtnEl = document.getElementById('installBtn');
    if (installBtnEl) {
      installBtnEl.addEventListener('click', async function () {
        if (!deferredPrompt) {
          dismissBanner();
          return;
        }
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        hideBanner();
      });
    }

    /* Header install button – re-opens the popup on demand */
    var headerBtn = document.getElementById('installHeaderBtn');
    if (headerBtn) {
      headerBtn.addEventListener('click', function () {
        /* Reset dismiss so the popup always opens from manual click */
        setInstallMeta({});

        if (isIOS()) {
          showIOSBanner();
        } else {
          showChromeBanner();
        }
      });
    }

    /* If installed mid-session, hide popup + header button and remember */
    window.addEventListener('appinstalled', function () {
      hideBanner();
      hideHeaderBtn();
      setInstallMeta({ installed: true, dismissCount: 0 });
      deferredPrompt = null;
    });
  }

  /* =====================================================================
   *  INIT – wait for DOM
   * ===================================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
