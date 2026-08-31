(() => {
  'use strict';
  if (window.__stContinuousColdCallVoice) return;
  window.__stContinuousColdCallVoice = true;

  let active = false;
  let speaking = false;
  let lastSpoken = '';
  let observer = null;
  let retryTimer = null;

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const isCall = () => !!document.querySelector('.call-shell, .call-transcript, .call-live');
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const talkButton = () => buttons().find(b => /говорите|говори|начать говорить|микрофон/i.test(text(b)) && !b.disabled);

  function stopBrowserSpeech() {
    try { window.speechSynthesis?.cancel(); } catch {}
    speaking = false;
  }

  function speakClient(message) {
    const clean = String(message || '').trim();
    if (!clean || clean === lastSpoken || !('speechSynthesis' in window)) return;
    lastSpoken = clean;
    speaking = true;
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ru-RU';
    u.rate = 0.98;
    u.pitch = 1;
    u.volume = 1;
    u.onend = () => { speaking = false; if (active) armNextTurn(); };
    u.onerror = () => { speaking = false; if (active) armNextTurn(); };
    speechSynthesis.speak(u);
  }

  function latestClientMessage() {
    const root = document.querySelector('.call-transcript');
    if (!root) return null;
    const nodes = Array.from(root.querySelectorAll('.msg.client'));
    return nodes.length ? nodes[nodes.length - 1] : null;
  }

  function armNextTurn() {
    if (!active || speaking) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!active || speaking) return;
      const b = talkButton();
      if (b) b.click();
      else armNextTurn();
    }, 350);
  }

  function watchTranscript() {
    const root = document.querySelector('.call-transcript');
    if (!root || root === observer?.root) return;
    if (observer) observer.mo.disconnect();
    const mo = new MutationObserver(() => {
      if (!active) return;
      const node = latestClientMessage();
      const msg = text(node);
      if (msg && msg !== lastSpoken) speakClient(msg);
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    observer = { root, mo };
  }

  function activateOnTalk() {
    if (!isCall()) return false;
    const b = talkButton();
    if (!b || b.dataset.stContinuousHooked) return false;
    b.dataset.stContinuousHooked = '1';
    b.addEventListener('click', () => {
      active = true;
      watchTranscript();
    }, { capture: true });
    return true;
  }

  function scan() {
    activateOnTalk();
    watchTranscript();
    if (!isCall()) { active = false; lastSpoken = ''; stopBrowserSpeech(); }
  }

  const rootObserver = new MutationObserver(scan);
  rootObserver.observe(document.body, { childList: true, subtree: true });
  setInterval(scan, 1000);
  scan();
})();