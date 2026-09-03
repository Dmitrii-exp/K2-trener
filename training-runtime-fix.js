/* SaleTrening training launcher V5 — direct DOM render, no dependency on trainingChat */
(function(){
  'use strict';
  if(window.__stTrainingLauncherV5)return;
  window.__stTrainingLauncherV5=true;

  function show(msg){
    var el=document.getElementById('toast');
    if(el){el.textContent=String(msg);el.classList.remove('hidden');clearTimeout(window.__stTrainingToast);window.__stTrainingToast=setTimeout(function(){el.classList.add('hidden')},7000)}
    console.error('[SaleTrening training]',msg);
  }

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]});
  }

  function withTimeout(promise,ms){
    var timer;
    return Promise.race([
      promise,
      new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error('Операция не завершилась за '+Math.round(ms/1000)+' сек.'))},ms)})
    ]).finally(function(){clearTimeout(timer)});
  }

  function renderDirect(){
    var p=document.getElementById('page');
    if(!p||!state||!state.session||!state.session.scenario)throw new Error('Не удалось найти экран тренировки');
    var s=state.session.scenario;
    var messages=Array.isArray(state.messages)?state.messages:[];
    p.innerHTML='<div class="top"><div><h2>'+esc(s.title)+'</h2><div class="muted">'+esc(s.client_role||'Клиент')+' · '+esc(s.difficulty||'Средняя')+'</div></div></div>'+ 
      '<div class="chat"><div id="messages" class="messages">'+
      (messages.length?messages.map(function(m){var client=m&&m.speaker==='client';return '<div class="msg '+(client?'client':'manager')+'"><b>'+(client?'Клиент':'Вы')+':</b> '+esc(m&&m.content)+'</div>'}).join(''):'<div class="empty" style="background:transparent;border:0">Клиент готовит первую реплику…</div>')+
      '</div><div class="composer"><button class="voice" onclick="voiceInput()" title="Голосовой ввод">🎙️</button><textarea id="msg" rows="2" placeholder="Ответьте клиенту..."></textarea><button class="primary" onclick="sendMessage()">Отправить</button></div><button class="secondary" style="width:100%;margin-top:10px" onclick="finishTraining()">⚑ Завершить тренировку</button><div class="muted" style="text-align:center;margin-top:7px">Тренировка будет завершена и отправлена на анализ AI</div></div>';
    var box=document.getElementById('messages');
    if(box)box.scrollTop=box.scrollHeight;
  }

  async function launch(id){
    try{
      if(!id)throw new Error('Не передан ID сценария');
      if(typeof state==='undefined'||!state)throw new Error('Состояние приложения не загружено');
      if(typeof sb==='undefined'||!sb)throw new Error('Supabase не инициализирован');
      var scenario=state.scenarios&&state.scenarios.find(function(x){return String(x.id)===String(id)});
      if(!scenario)throw new Error('Сценарий не найден: '+id);
      if(!state.user||!state.user.id)throw new Error('Пользователь не авторизован');
      if(!state.profile||!state.profile.company_id)throw new Error('Профиль компании не загружен');

      show('Создаём тренировку…');
      var result=await withTimeout(sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:id,status:'started',transcript:[],voice_mode:false}).select().single(),15000);
      if(result.error)throw new Error(result.error.message||'Не удалось создать сессию тренировки');

      state.session=Object.assign({},result.data,{scenario:scenario});
      state.messages=[];
      state.view='training';

      /* Render independently of the original trainingChat() function. */
      renderDirect();
      show('Тренировка запущена. Клиент готовит первую реплику…');

      try{
        if(typeof aiClientReply!=='function')throw new Error('AI-функция aiClientReply не найдена');
        var opening=await withTimeout(aiClientReply('',true),20000);
        if(opening)state.messages.push({speaker:'client',content:opening});
        if(typeof saveSession==='function')await withTimeout(saveSession(),10000);
        renderDirect();
      }catch(aiError){
        console.error('[SaleTrening] opening AI failed',aiError);
        if(typeof saveSession==='function')try{await saveSession()}catch(_){ }
        renderDirect();
        show('Тренировка запущена, но первая реплика AI не получена: '+(aiError&&aiError.message?aiError.message:String(aiError)));
      }
    }catch(e){
      console.error('[SaleTrening] V5 launch failed',e);
      show('Ошибка запуска тренировки: '+(e&&e.message?e.message:String(e)));
    }
  }

  function intercept(){
    document.addEventListener('click',function(e){
      var el=e.target&&e.target.closest?e.target.closest('button,[role="button"],a'):null;
      if(!el)return;
      var code=el.getAttribute('onclick')||'';
      if(!code)return;
      var m=code.match(/startTraining\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if(!m)m=code.match(/startTraining\s*\(\s*([^\)]+)\s*\)/);
      if(!m)return;
      var id=String(m[1]).trim().replace(/^['"]|['"]$/g,'');
      e.preventDefault();
      e.stopImmediatePropagation();
      launch(id);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',intercept);else intercept();
})();
