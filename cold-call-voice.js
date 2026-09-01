(() => {
  'use strict';
  if (window.__stContinuousColdCallVoice) return;
  window.__stContinuousColdCallVoice = true;

  // Keep logout here for compatibility with the existing UI.
  window.logout = async function () {
    try {
      const { error } = await sb.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (e) {
      console.error('[SaleTrening] logout:', e);
      toast('Не удалось выйти. Попробуйте ещё раз.');
      return;
    }
    state.user = null;
    state.profile = null;
    state.company = null;
    state.session = null;
    state.messages = [];
    state.history = [];
    state.team = [];
    state.stats = null;
    state.report = null;
    state.view = 'home';
    if (window.authScreen) window.authScreen();
  };

  // TTS is intentionally NOT implemented here.
  // speakCallClient() in index.html is the single source of truth for client audio.
  // This prevents the previous browser-TTS/Yandex-TTS double playback.
  let active = false;
  let retryTimer = null;
  let hookedButton = null;

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const isCall = () => !!document.querySelector('.call-shell');
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const talkButton = () => buttons().find(b => /говорите|говори|начать говорить/i.test(text(b)) && !b.disabled);

  function stop() {
    active = false;
    clearTimeout(retryTimer);
    retryTimer = null;
    try { window.speechSynthesis?.cancel(); } catch {}
  }

  function armNextTurn() {
    if (!active || !isCall()) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!active || !isCall()) return;
      const b = talkButton();
      if (b && b !== hookedButton && !b.disabled) b.click();
      else if (b && !b.disabled) b.click();
    }, 300);
  }

  function hookTalkButton() {
    if (!isCall()) return;
    const b = talkButton();
    if (!b || b.dataset.stContinuousHookedV2 === '1') return;
    b.dataset.stContinuousHookedV2 = '1';
    hookedButton = b;
    b.addEventListener('click', () => {
      active = true;
      clearTimeout(retryTimer);
    }, { capture: true });
  }

  function scan() {
    if (!isCall()) {
      stop();
      hookedButton = null;
      return;
    }
    hookTalkButton();
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(scan, 1000);
  scan();
})();