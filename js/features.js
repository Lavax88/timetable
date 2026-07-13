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

    /* On mobile, always show if not standalone — ignore dismiss policy */
    if (isMobile()) return true;

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

  function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function supportsInstall() {
    return 'onbeforeinstallprompt' in window;
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
    banner.querySelector('.install-unsupported').style.display = 'none';
    requestAnimationFrame(function () {
      banner.classList.add('visible');
    });
  }

  function showIOSBanner() {
    var banner = getBanner();
    if (!banner) return;
    banner.querySelector('.install-chrome').style.display = 'none';
    banner.querySelector('.install-ios').style.display = '';
    banner.querySelector('.install-unsupported').style.display = 'none';
    requestAnimationFrame(function () {
      banner.classList.add('visible');
    });
  }

  function showUnsupportedBanner() {
    var banner = getBanner();
    if (!banner) return;
    banner.querySelector('.install-chrome').style.display = 'none';
    banner.querySelector('.install-ios').style.display = 'none';
    banner.querySelector('.install-unsupported').style.display = '';
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
    /* Don't nullify deferredPrompt here — beforeinstallprompt fires only once
       per page load, so the event must survive dismiss/reopen cycles. */
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

    /* ---- Wire all popup buttons — always, regardless of dismiss policy ---- */

    var headerBtn = document.getElementById('installHeaderBtn');
    if (headerBtn) {
      headerBtn.addEventListener('click', function () {
        if (isIOS()) {
          showIOSBanner();
        } else if (supportsInstall()) {
          showChromeBanner();
        } else {
          showUnsupportedBanner();
        }
      });
    }

    ['closeBtn', 'dismissBtn', 'dismissIOSBtn', 'dismissUnsupportedBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', function () {
          dismissBanner();
        });
      }
    });

    var installBtnEl = document.getElementById('installBtn');
    if (installBtnEl) {
      installBtnEl.addEventListener('click', async function () {
        if (!deferredPrompt) {
          /* Event hasn't arrived yet — show feedback and wait up to 12s */
          installBtnEl.textContent = 'Preparing\u2026';
          for (var i = 0; i < 30; i++) {
            if (deferredPrompt) break;
            await new Promise(function (r) { setTimeout(r, 400); });
          }
          if (!deferredPrompt) {
            installBtnEl.textContent = 'Install App';
            return;
          }
          installBtnEl.textContent = 'Install App';
        }
        try {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch (_) {
          /* prompt was already consumed — nothing we can do */
        }
        deferredPrompt = null;
        hideBanner();
      });
    }

    window.addEventListener('appinstalled', function () {
      hideBanner();
      hideHeaderBtn();
      setInstallMeta({ installed: true, dismissCount: 0 });
      deferredPrompt = null;
    });

    /* ---- Auto-popup ---- */
    if (!shouldShowBanner()) return;

    if (isIOS()) {
      showIOSBanner();
    } else if (supportsInstall()) {
      showChromeBanner();
      if (!deferredPrompt) {
        var pollTimer = setInterval(function () {
          if (deferredPrompt) clearInterval(pollTimer);
        }, 400);
        setTimeout(function () { clearInterval(pollTimer); }, 12000);
      }
    }
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
