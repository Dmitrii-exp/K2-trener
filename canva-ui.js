(() => {
  'use strict';

  // K2 recovery layer. The main app script executes before this file, so a
  // failed Supabase CDN request can leave the page white. Install a same-origin
  // service worker that proxies the primary CDN to a fallback on the next load.
  async function installRecoveryWorker() {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {scope:'/'});
      await navigator.serviceWorker.ready;
      return !!reg;
    } catch (e) {
      console.error('[K2] recovery service worker:', e);
      return false;
    }
  }

  function showRecoveryMessage() {
    const root = document.getElementById('root');
    if (root && !root.innerHTML.trim()) {
      root.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font:16px Arial;color:#555"><div style="max-width:560px;padding:28px;text-align:center;background:#fff;border:1px solid #e8e7ef;border-radius:18px"><b>SaleTrening не удалось запустить.</b><br><small style="display:block;margin-top:8px">Восстанавливаю подключение. Обновите страницу через несколько секунд.</small></div></div>';
    }
  }

  function applyUI() {
    if (document.getElementById('k2-recovery-ui')) return;
    const style = document.createElement('style');
    style.id = 'k2-recovery-ui';
    style.textContent = `
      :root{--k2-purple:#7357ff;--k2-bg:#f7f7fb;--k2-line:#e8e7ef;--k2-text:#171525}
      html,body{background:var(--k2-bg)!important;color:var(--k2-text)!important}
      .shell{background:var(--k2-bg)!important}
      .side{background:linear-gradient(180deg,#15131f,#1b1729)!important;color:#fff!important;border-right:1px solid #2b263b!important}
      .nav button.active{background:#2b2542!important;color:#fff!important;box-shadow:inset 3px 0 0 var(--k2-purple)!important}
      .content{max-width:1580px!important}
      .card{border-color:var(--k2-line)!important;border-radius:20px!important;box-shadow:0 5px 20px rgba(27,21,52,.035)!important}
      .hero-card{border-radius:24px!important;background:linear-gradient(135deg,#fff,#f3efff)!important;border-color:#e1dbf7!important}
      .primary{background:linear-gradient(135deg,#7357ff,#6548ed)!important;border-radius:13px!important}
      .scenario{background:linear-gradient(180deg,#fff,#fcfbff)!important}
    `;
    document.head.appendChild(style);
  }

  applyUI();

  (async () => {
    const hadApp = !!window.supabase;
    if (!hadApp) {
      const installed = await installRecoveryWorker();
      if (installed && !navigator.serviceWorker.controller) {
        // The worker uses clients.claim(), but force a single clean reload so
        // the very first Supabase request is intercepted by it.
        const key = 'k2_sw_recovery_reload_v1';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          location.reload();
          return;
        }
      }
      showRecoveryMessage();
    }
  })();
})();
