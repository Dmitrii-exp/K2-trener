(() => {
  'use strict';

  // Canva visual layer only. Do not touch Supabase auth, profile state,
  // boot(), invitation handlers, or application data.
  document.documentElement.dataset.saletreningUi='v10';

  function loadColdCallFilters(){
    if(window.__stColdFiltersLoaded || document.querySelector('script[data-st-cold-filters]')) return;
    const script=document.createElement('script');
    script.src='/cold-call-filters.js?v=restore-20260831';
    script.async=false;
    script.dataset.stColdFilters='1';
    script.onload=()=>{window.__stColdFiltersLoaded=true};
    script.onerror=()=>{console.warn('[SaleTrening] cold-call-filters.js failed to load')};
    document.head.appendChild(script);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadColdCallFilters,{once:true});
  else loadColdCallFilters();

})();

/* TRAINING_UI_V2: finish action belongs only to active training modes. */
(() => {
  'use strict';
  const escText = s => String(s ?? '');
  const $id = id => document.getElementById(id);

  function patchTrainingChat(){
    if(typeof window.trainingChat !== 'function' || window.trainingChat.__stV2) return;
    const fn=function(){
      const p=$id('page'); if(!p||!window.state?.session)return;
      const session=state.session, scenario=session.scenario||{};
      p.innerHTML=`<div class="top"><div><h2>${esc(scenario.title||'Тренировка')}</h2><div class="muted">${esc(scenario.client_role||'Клиент')} · ${esc(scenario.difficulty||'Средняя')}</div></div></div><div class="chat"><div id="messages" class="messages">${(state.messages||[]).map(m=>`<div class="msg ${m.speaker}"><b>${m.speaker==='client'?'Клиент':'Вы'}:</b> ${esc(m.content)}</div>`).join('')}</div><div class="composer"><button class="voice" onclick="voiceInput()" title="Голосовой ввод">🎙️</button><textarea id="msg" rows="2" placeholder="Ответьте клиенту..."></textarea><button class="primary" onclick="sendMessage()">Отправить</button></div><button class="secondary" style="width:100%;margin-top:10px" onclick="finishTraining()">⚑ Завершить тренировку</button><div class="muted" style="text-align:center;margin-top:7px">Тренировка будет завершена и отправлена на анализ AI</div></div>`;
      const messages=$id('messages'); if(messages)messages.scrollTop=messages.scrollHeight;
    };
    fn.__stV2=true; window.trainingChat=fn;
  }

  function patchTrainingCall(){
    if(typeof window.trainingCallPage !== 'function' || window.trainingCallPage.__stV2) return;
    const fn=function(){
      const p=$id('page'); if(!p||!window.state?.session)return;
      if(window.coldCall?.timer)clearInterval(coldCall.timer);
      const clientName=state.session.scenario?.client_role||'Клиент';
      p.innerHTML=`<div class="cold-call-stage">
        <section class="cold-call-portrait" aria-label="Голосовой холодный звонок">
          <div class="cold-call-name">${esc(clientName)}</div>
          <div class="cold-call-timer" id="callTimer">00:00</div>
          <div class="cold-call-controls">
            <button type="button" class="cold-call-control" aria-label="Динамик">
              <span class="cold-call-control-circle">
                <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 19h8l9-8v26l-9-8H8z" fill="currentColor"/><path d="M31 17c2.8 2.8 2.8 11.2 0 14M35.5 12.5c6 6 6 17 0 23" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>
              </span>
              <span>Динамик</span>
            </button>
            <button type="button" class="cold-call-control end" onclick="finishTraining()" aria-label="Отбой">
              <span class="cold-call-control-circle">
                <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 29c7-7 21-7 28 0l-4.5 5.2c-1 1.1-2.6 1.4-3.9.6l-4.1-2.4c-.9-.5-2.1-.5-3 0l-4.1 2.4c-1.3.8-2.9.5-3.9-.6z" fill="currentColor"/></svg>
              </span>
              <span>Отбой</span>
            </button>
            <button type="button" class="cold-call-control" aria-label="Выключить звук">
              <span class="cold-call-control-circle">
                <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="7" width="12" height="23" rx="6" fill="none" stroke="currentColor" stroke-width="3.2"/><path d="M12 23c0 7 5 12 12 12s12-5 12-12M24 35v6M18 41h12M10 10l28 28" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>
              </span>
              <span>Выкл. звук</span>
            </button>
          </div>
        </section>
      </div>`;
      coldCall.timer=setInterval(async()=>{
        const el=$id('callTimer');
        if(!el||!state.session){clearInterval(coldCall.timer);coldCall.timer=null;return}
        const sec=Math.floor((Date.now()-coldCall.startedAt)/1000);
        el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
        if(sec>=600&&!coldCall.processing){
          clearInterval(coldCall.timer);coldCall.timer=null;coldCall.processing=true;
          const n='У меня нет времени, мне не интересно, до свидания.';
          state.messages.push({speaker:'client',content:n});await saveSession();
          setTimeout(()=>finishTraining(),800);
        }
      },1000);
    };
    fn.__stV2=true; window.trainingCallPage=fn;
  }

  function patchReportPage(){
    if(typeof window.reportPage !== 'function' || window.reportPage.__stV2) return;
    const fn=function(){
      const r=state.report||{},x=r.session||{},s=r.score||{};
      const score=n=>{const v=Number(n);return Number.isFinite(v)&&v>0?Math.max(1,Math.min(20,Math.round(v))):null};
      const skills=[["Работа с возражениями",score(s.objection_score)],["Презентация продукта",score(s.value_score)],["Дожим / закрытие сделки",score(s.closing_score)],["Вовлечённость клиента в разговор / коммуникация",score(s.communication_score)],["Выявление потребности",score(s.discovery_score)]].filter(v=>v[1]!==null);
      const calculated=skills.reduce((a,v)=>a+v[1],0),stored=Number(s.overall_score),sessionTotal=Number(x.total_score);
      const total=Number.isFinite(stored)&&stored>0?Math.round(stored):Number.isFinite(sessionTotal)&&sessionTotal>0?Math.round(sessionTotal):calculated;
      const items=v=>Array.isArray(v)?v.filter(Boolean):(typeof v==='string'&&v.trim()?[v.trim()]:[]),strengths=items(s.strengths),weaknesses=items(s.weaknesses),recommendations=items(s.recommendations),transcript=Array.isArray(x.transcript)?x.transcript:[],names={};
      state.scenarios.forEach(z=>names[z.id]=z.title);
      const list=(a,e)=>a.length?`<ul style="margin:10px 0 0;padding-left:20px">${a.map(v=>`<li style="margin:7px 0">${esc(v)}</li>`).join('')}</ul>`:`<div class="muted" style="margin-top:10px">${e}</div>`;
      return `<div class="top"><div><h2>Отчёт тренировки</h2><div class="muted">${esc(names[x.scenario_id]||'Тренировка')} · ${new Date(x.created_at).toLocaleString('ru-RU')}</div></div><button class="secondary" onclick="state.report=null;page()">← Назад к тренировкам</button></div><div class="card" style="text-align:center;padding:28px"><div class="muted">ОБЩИЙ БАЛЛ</div><div class="metric" style="font-size:54px">${total}<span style="font-size:18px;color:var(--muted)"> / 100</span></div><div class="muted" style="margin-top:8px">Итоговый балл тренировки</div></div><div class="section card"><h3>Оценка навыков</h3>${skills.map(v=>`<div style="margin:18px 0"><div style="display:flex;justify-content:space-between;gap:12px"><span>${v[0]}</span><b>${v[1]} / 20</b></div><div class="bar" style="margin-top:8px"><i style="width:${v[1]*5}%"></i></div></div>`).join('')}<div style="display:flex;justify-content:space-between;margin-top:22px;padding-top:14px;border-top:1px solid var(--line)"><b>Итоговый балл</b><b>${total} / 100</b></div></div><div class="section card"><h3>Анализ тренировки</h3><div style="margin-top:18px"><b>🟢 Сильные стороны</b>${list(strengths,'Сильные стороны не указаны.')}</div><div style="margin-top:22px"><b>🔴 Слабые стороны</b>${list(weaknesses,'Слабые стороны не указаны.')}</div><div style="margin-top:22px"><b>💡 Рекомендации</b>${list(recommendations,'Рекомендации не указаны.')}</div>${x.ai_summary?`<div style="margin-top:22px"><b>Краткий вывод ИИ</b><p class="muted" style="line-height:1.55">${esc(x.ai_summary)}</p></div>`:''}</div><div class="section card"><h3>Полный диалог</h3><div class="messages" style="margin-top:14px;max-height:none">${transcript.length?transcript.map(m=>{const speaker=String(m?.speaker||m?.role||'').toLowerCase(),manager=['manager','user','employee'].includes(speaker),text=m?.content??m?.text??m?.message??'';return `<div class="msg ${manager?'manager':'client'}"><b>${manager?'Менеджер':'Клиент'}:</b> ${esc(text)}</div>`}).join(''):`<div class="empty">Полный диалог не сохранён.</div>`}</div></div>`;
    };
    fn.__stV2=true; window.reportPage=fn;
  }

  function apply(){
    try{patchTrainingChat();patchTrainingCall();patchReportPage()}catch(e){console.error('[SaleTrening] training UI patch',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  setTimeout(apply,50);
})();
