(() => {
  'use strict';

  // K2 recovery layer: the application historically depended on a single
  // Supabase CDN request. If that request is blocked, the inline app script
  // stops before authScreen() and the user sees a completely white page.
  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function recoverMainApp() {
    if (window.supabase) return;
    const sources = [
      'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
      'https://fastly.jsdelivr.net/npm/@supabase/supabase-js@2'
    ];
    for (const src of sources) {
      try { await loadScript(src); if (window.supabase) break; } catch (_) {}
    }
    if (!window.supabase) {
      console.error('[K2] Supabase SDK could not be loaded from fallback CDNs.');
      return;
    }
    if (window.__K2_MAIN_EXECUTED) return;
    const scripts = [...document.scripts];
    const main = scripts.find(s => s.textContent && s.textContent.includes('const SUPABASE_URL='));
    if (!main) {
      console.error('[K2] Main application script was not found.');
      return;
    }
    window.__K2_MAIN_EXECUTED = true;
    try {
      // Re-run the original inline application script now that Supabase exists.
      (0, eval)(main.textContent);
    } catch (e) {
      window.__K2_MAIN_EXECUTED = false;
      console.error('[K2] Main application recovery failed:', e);
      const root = document.getElementById('root');
      if (root && !root.innerHTML.trim()) {
        root.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;font:16px Arial;color:#555"><div><b>SaleTrening не удалось запустить.</b><br><small>Откройте страницу ещё раз через несколько секунд.</small></div></div>';
      }
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
  if (!window.supabase) recoverMainApp();
})();
