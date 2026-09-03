(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escText = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function safeTrainingList() {
    const p = $('page');
    if (!p) return;
    const scenarios = Array.isArray(window.state?.scenarios) ? window.state.scenarios : [];
    p.innerHTML = `<div class="top"><div><h2>ИИ-тренировки</h2><div class="muted">Выберите сценарий и откройте текстовый диалог с AI-клиентом</div></div></div>` +
      (scenarios.length ? `<div class="scenario-grid">${scenarios.map(s => `<div class="card scenario"><div><span class="tag">${escText(s.difficulty || 'Средняя')}</span><span class="tag">${escText(s.client_mood || 'Нейтральный')}</span></div><div class="grow"><div class="scenario-title">${escText(s.title || 'Тренировка')}</div><div class="muted">${escText(s.description || s.objective || 'Практика продаж с AI-клиентом')}</div></div><button class="primary" data-start-text-training="${Number(s.id) || 0}">Начать тренировку</button></div>`).join('')}</div>` : `<div class="empty">Сценариев пока нет. Обновите страницу через несколько секунд.</div>`);
    p.querySelectorAll('[data-start-text-training]').forEach(btn => btn.addEventListener('click', () => startTextTraining(Number(btn.dataset.startTextTraining))));
  }

  function renderTextChat() {
    if (!window.state?.session || !$('page')) return false;
    const s = window.state.session.scenario || {};
    const tr = Array.isArray(window.state.transcript) ? window.state.transcript : [];
    $('page').innerHTML = `<div class="top"><div><h2>${escText(s.title || 'Текстовая тренировка')}</h2><div class="muted">Диалог с AI-клиентом</div></div><button class="secondary" id="endTextTraining">Завершить</button></div><div class="chat"><div class="messages" id="textTrainingMessages">${tr.map(m => `<div class="msg ${m.speaker==='manager'?'manager':'client'}">${escText(m.content)}</div>`).join('')}</div><div class="composer"><textarea id="textTrainingInput" rows="2" placeholder="Введите ответ клиенту..."></textarea><button class="primary" id="sendTextTraining">Отправить</button></div></div>`;
    const send = async () => {
      const input = $('textTrainingInput');
      const message = String(input?.value || '').trim();
      if (!message || !window.state?.session) return;
      input.value = '';
      const msgs = $('textTrainingMessages');
      if (msgs) msgs.insertAdjacentHTML('beforeend', `<div class="msg manager">${escText(message)}</div>`);
      const transcript = Array.isArray(window.state.transcript) ? window.state.transcript : [];
      try {
        const r = await sb.functions.invoke('chat-client', {body:{message,scenario:window.state.session.scenario,transcript}});
        if (r.error) throw r.error;
        const reply = String(r.data?.reply || '').trim();
        window.state.transcript = [...transcript,{speaker:'manager',content:message},{speaker:'client',content:reply}];
        renderTextChat();
      } catch (e) {
        if (typeof window.toast === 'function') window.toast(e?.message || 'Ошибка AI');
      }
    };
    $('sendTextTraining')?.addEventListener('click', send);
    $('textTrainingInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }});
    $('endTextTraining')?.addEventListener('click', async () => {
      if (typeof window.endTraining === 'function') await window.endTraining();
      else { window.state.session = null; window.state.transcript = []; window.state.view = 'training'; safeTrainingList(); }
    });
    return true;
  }

  async function startTextTraining(id) {
    const scenarios = Array.isArray(window.state?.scenarios) ? window.state.scenarios : [];
    const scenario = scenarios.find(x => Number(x.id) === Number(id));
    if (!scenario) return;
    // Standard training is always text. Do not pass or inherit voice mode.
    window.state.view = 'training';
    window.state.session = {scenario};
    window.state.transcript = [];
    renderTextChat();
    try {
      const r = await sb.functions.invoke('chat-client', {body:{opening:true,scenario,transcript:[],mode:'text',voice:false}});
      if (r.error) throw r.error;
      const reply = String(r.data?.reply || '').trim();
      window.state.transcript = reply ? [{speaker:'client',content:reply}] : [];
      renderTextChat();
    } catch (e) {
      if (typeof window.toast === 'function') window.toast(e?.message || 'Не удалось запустить AI-клиента');
    }
  }

  function install() {
    if (window.__stTrainingTabFixV3) return;
    window.__stTrainingTabFixV3 = true;
    document.addEventListener('click', e => {
      const btn = e.target.closest('.nav button');
      if (!btn || !(btn.textContent || '').trim().includes('Тренировки')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!window.state) return;
      window.state.session = null; window.state.transcript = []; window.state.report = null; window.state.view = 'training';
      try { safeTrainingList(); } catch (err) { console.error('[SaleTrening] training tab:', err); }
      document.querySelectorAll('.nav button').forEach(x => x.classList.toggle('active', x === btn));
    }, true);
    window.__stSafeTrainingPage = safeTrainingList;
  }
  window.__stRenderTextChat = renderTextChat;
  window.__stStartTextTraining = startTextTraining;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
