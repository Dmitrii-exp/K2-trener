(() => {
  'use strict';
  if (window.__stColdCallPageMode) return;
  window.__stColdCallPageMode = true;

  function applyPageMode() {
    const overlay = document.getElementById('st-phone-overlay');
    const phone = document.getElementById('st-phone');
    if (!overlay || !phone) return false;

    document.documentElement.classList.add('st-cold-call-page');
    document.body.classList.add('st-cold-call-page');

    // Keep the existing runtime cleanup intact: the overlay stays as the
    // lifecycle container, but visually becomes the whole page rather than a modal.
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.padding = '0';
    overlay.style.display = 'block';
    overlay.style.background = '#0b0a11';
    overlay.style.backdropFilter = 'none';
    overlay.style.zIndex = '100000';

    phone.style.width = '100vw';
    phone.style.height = '100vh';
    phone.style.maxWidth = 'none';
    phone.style.maxHeight = 'none';
    phone.style.border = '0';
    phone.style.borderRadius = '0';
    phone.style.boxShadow = 'none';
    phone.style.background = '#15131f';

    const head = phone.querySelector('.st-phone-head');
    const body = phone.querySelector('.st-phone-body');
    const controls = phone.querySelector('.st-phone-controls');
    if (head) {
      head.style.borderRadius = '0';
      head.style.paddingTop = 'calc(16px + env(safe-area-inset-top))';
    }
    if (body) body.style.paddingBottom = '12px';
    if (controls) controls.style.paddingBottom = 'calc(17px + env(safe-area-inset-bottom))';

    const close = phone.querySelector('.st-phone-close');
    if (close) {
      close.textContent = '×';
      close.setAttribute('aria-label', 'Завершить тренировку');
    }

    document.body.style.overflow = 'hidden';
    return true;
  }

  function restorePage() {
    document.documentElement.classList.remove('st-cold-call-page');
    document.body.classList.remove('st-cold-call-page');
    document.body.style.overflow = '';
  }

  function watchOverlay() {
    if (window.__stColdCallPageObserver) return;
    const observer = new MutationObserver(() => {
      if (document.getElementById('st-phone-overlay')) {
        applyPageMode();
      } else {
        restorePage();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__stColdCallPageObserver = observer;
  }

  function patchLauncher() {
    if (typeof window.launchColdCall !== 'function') return false;
    if (window.launchColdCall.__stPageWrapped) return true;
    const original = window.launchColdCall;
    const wrapped = async function() {
      const result = await original.apply(this, arguments);
      requestAnimationFrame(() => {
        applyPageMode();
        watchOverlay();
      });
      return result;
    };
    wrapped.__stPageWrapped = true;
    window.launchColdCall = wrapped;
    return true;
  }

  function boot() {
    if (patchLauncher()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (patchLauncher() || tries >= 80) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
