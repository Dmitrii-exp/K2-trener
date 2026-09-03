(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escText = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function safeTrainingList() {
    const p = $('page');
    if (!p) return;
    const scenarios = Array.isArray(window.state?.scenarios) ? state.scenarios : [];
    p.innerHTML = `<div class="top"><div><h2>ИИ-тренировки</h2><div class="muted">Выберите сценарий и начните живой диалог с AI-клиентом</div></div></div>` +
      (scenarios.length ? `<div class="scenario-grid">${scenarios.map(s => `<div class="card scenario"><div><span class="tag">${escText(s.difficulty || 'Средняя')}</span><span class="tag">${escText(s.client_mood || 'Нейтральный')}</span></div><div class="grow"><div class="scenario-title">${escText(s.title || 'Тренировка')}</div><div class="muted">${escText(s.description || s.objective || 'Практика продаж с AI-клиентом')}</div></div><button class="primary" data-start-training="${Number(s.id) || 0}">Начать тренировку</button></div>`).join('')}</div>` : `<div class="empty">Сценариев пока нет. Обновите страницу через несколько секунд.</div>`);
    p.querySelectorAll('[data-start-training]').forEach(btn => btn.addEventListener('click', () => {
      const id = Number(btn.dataset.startTraining);
      if (typeof window.startTraining === 'function') window.startTraining(id);
      else if (typeof window.toast === 'function') toast('Функция запуска тренировки ещё не загрузилась. Обновите страницу.');
    }));
  }

  function safePage() {
    if (!window.state || !$('page')) return;
    if (state.report && typeof window.reportPage === 'function') {
      $('page').innerHTML = window.reportPage();
      return;
    }
    if (state.session) {
      if (state.view === 'coldcall' && typeof window.trainingCallPage === 'function') return window.trainingCallPage();
      if (typeof window.trainingChat === 'function') return window.trainingChat();
    }
    if (state.view === 'training') return safeTrainingList();
    if (state.view === 'coldcall' && typeof window.coldCallHome === 'function') return $('page').innerHTML = window.coldCallHome();
    if (state.view === 'scenarios' && typeof window.scenarios === 'function') return $('page').innerHTML = window.scenarios();
    if (state.view === 'progress' && typeof window.progress === 'function') return $('page').innerHTML = window.progress();
    if (state.view === 'history' && typeof window.historyPage === 'function') return $('page').innerHTML = window.historyPage();
    if (state.view === 'ai' && typeof window.aiChat === 'function') return $('page').innerHTML = window.aiChat();
  }

  function install() {
    if (window.__stTrainingTabFix) return;
    window.__stTrainingTabFix = true;
    document.addEventListener('click', e => {
      const btn = e.target.closest('.nav button');
      if (!btn) return;
      const text = (btn.textContent || '').trim();
      if (!text.includes('Тренировки')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!window.state) return;
      state.view = 'training';
      try { safePage(); } catch (err) { console.error('[SaleTrening] training tab:', err); safeTrainingList(); }
      document.querySelectorAll('.nav button').forEach(x => x.classList.toggle('active', x === btn));
    }, true);
    window.__stSafeTrainingPage = safeTrainingList;
    setTimeout(() => {
      if (window.state?.view === 'training' && $('page') && !$('page').innerHTML.trim()) safeTrainingList();
    }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
