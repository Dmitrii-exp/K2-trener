(() => {
  'use strict';
  if (window.__stColdCallPageModeV2) return;
  window.__stColdCallPageModeV2 = true;

  const HIDDEN_ATTR = 'data-st-cold-hidden';

  function hideAppContent(content, keep) {
    [...content.children].forEach(el => {
      if (el === keep) return;
      if (!el.hasAttribute(HIDDEN_ATTR)) {
        el.setAttribute(HIDDEN_ATTR, '1');
        el.dataset.stColdDisplay = el.style.display || '';
        el.style.display = 'none';
      }
    });
  }

  function restoreAppContent() {
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(el => {
      el.style.display = el.dataset.stColdDisplay || '';
      el.removeAttribute(HIDDEN_ATTR);
      delete el.dataset.stColdDisplay;
    });
    document.documentElement.classList.remove('st-cold-call-page');
    document.body.classList.remove('st-cold-call-page');
    document.body.style.overflow = '';
  }

  function loadV4() {
    if (window.__stColdCallPageV4 || document.querySelector('script[data-st-cold-v4="1"]')) return;
    const s=document.createElement('script');
    s.src='/cold-call-page-v4.js?v=20260906-cold-v4';
    s.async=false;
    s.dataset.stColdV4='1';
    document.head.appendChild(s);
  }

  function applyPageMode() {
    const host = document.getElementById('st-phone-overlay');
    const phone = document.getElementById('st-phone');
    if (!host || !phone) return false;
    const content = document.querySelector('.content') || document.getElementById('root');
    if (!content) return false;

    document.documentElement.classList.add('st-cold-call-page');
    document.body.classList.add('st-cold-call-page');
    if (host.parentElement !== content) content.appendChild(host);
    hideAppContent(content, host);

    host.style.cssText = 'position:static;width:100%;height:auto;min-height:calc(100vh - 60px);padding:0;margin:0;background:transparent;backdrop-filter:none;z-index:auto;display:block;';
    phone.style.cssText += 'width:100%;height:auto;min-height:calc(100vh - 60px);max-width:none;max-height:none;border:0;border-radius:18px;box-shadow:none;background:#15131f;overflow:hidden;';

    const head = phone.querySelector('.st-phone-head');
    const body = phone.querySelector('.st-phone-body');
    const controls = phone.querySelector('.st-phone-controls');
    const transcript = phone.querySelector('.st-phone-transcript');
    const now = phone.querySelector('.st-phone-now');
    if (head) { head.style.borderRadius = '18px 18px 0 0'; head.style.paddingTop = '20px'; }
    if (body) { body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.minHeight = '0'; body.style.padding = '18px'; }
    if (now) now.style.order = '1';
    if (transcript) { transcript.style.order = '2'; transcript.style.maxHeight = 'none'; transcript.style.minHeight = '220px'; transcript.style.flex = '1 1 auto'; transcript.style.marginTop = '12px'; }
    if (controls) { controls.style.order = '3'; controls.style.paddingBottom = '20px'; }
    const close = phone.querySelector('.st-phone-close');
    if (close) { close.textContent = '←'; close.setAttribute('aria-label', 'Выйти из тренировки'); }
    document.body.style.overflow = 'auto';
    return true;
  }

  function watch() {
    if (window.__stColdCallPageObserverV2) return;
    const observer = new MutationObserver(() => {
      if (document.getElementById('st-phone-overlay')) applyPageMode();
      else restoreAppContent();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__stColdCallPageObserverV2 = observer;
  }

  function patchLauncher() {
    if (typeof window.launchColdCall !== 'function') return false;
    if (window.launchColdCall.__stPageWrappedV2) return true;
    const original = window.launchColdCall;
    const wrapped = async function () {
      const result = await original.apply(this, arguments);
      requestAnimationFrame(() => { applyPageMode(); watch(); });
      return result;
    };
    wrapped.__stPageWrappedV2 = true;
    window.launchColdCall = wrapped;
    return true;
  }

  function boot() {
    loadV4();
    watch();
    if (patchLauncher()) return;
    let tries = 0;
    const timer = setInterval(() => { tries++; loadV4(); if (patchLauncher() || tries >= 100) clearInterval(timer); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
