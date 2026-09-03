/* SaleTrening training launcher V4 — render first, AI second */
(function(){
  'use strict';
  if(window.__stTrainingLauncherV4)return;
  window.__stTrainingLauncherV4=true;

  function show(msg){
    var el=document.getElementById('toast');
    if(el){el.textContent=String(msg);el.classList.remove('hidden');clearTimeout(window.__stTrainingToast);window.__stTrainingToast=setTimeout(function(){el.classList.add('hidden')},7000)}
    console.error('[SaleTrening training]',msg);
  }

  async function withTimeout(promise,ms){
    var timer;
    try{
      return await Promise.race([
        promise,
        new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error('AI-клиент не ответил за '+Math.round(ms/1000)+' сек.'))},ms)})
      ]);
    }finally{clearTimeout(timer)}
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
      var result=await withTimeout(
        sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:id,status:'started',transcript:[],voice_mode:false}).select().single(),
        15000
      );
      if(result.error)throw new Error(result.error.message||'Не удалось создать сессию тренировки');

      state.session=Object.assign({},result.data,{scenario:scenario});
      state.messages=[];
      state.view='training';

      /* Critical: show the training UI immediately. Do not wait for AI or saveSession. */
      if(typeof trainingChat==='function')trainingChat();
      show('Тренировка запущена. Клиент готовит первую реплику…');

      try{
        if(typeof aiClientReply!=='function')throw new Error('AI-функция aiClientReply не найдена');
        var opening=await withTimeout(aiClientReply('',true),20000);
        if(opening)state.messages.push({speaker:'client',content:opening});
        if(typeof saveSession==='function')await withTimeout(saveSession(),10000);
        if(typeof trainingChat==='function')trainingChat();
      }catch(aiError){
        console.error('[SaleTrening] opening AI failed',aiError);
        if(typeof saveSession==='function')try{await saveSession()}catch(_){ }
        if(typeof trainingChat==='function')trainingChat();
        show('Тренировка запущена, но первая реплика AI не получена: '+(aiError&&aiError.message?aiError.message:String(aiError)));
      }
    }catch(e){
      console.error('[SaleTrening] V4 launch failed',e);
      show('Ошибка запуска тренировки: '+(e&&e.message?e.message:String(e)));
    }
  }

  function intercept(){
    document.addEventListener('click',function(e){
      var el=e.target&&e.target.closest?e.target.closest('button,[role="button"],a'):null;
      if(!el)return;
      var code=el.getAttribute('onclick')||'';
      if(!code)return;
      var m=code.match(/startTraining\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)/);
      if(!m)m=code.match(/startTraining\s*\(\s*([^\)]+)\s*\)/);
      if(!m)return;
      var id=String(m[1]).trim().replace(/^['\"]|['\"]$/g,'');
      e.preventDefault();
      e.stopImmediatePropagation();
      launch(id);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',intercept);else intercept();
})();

/* Force production deployment marker — no runtime behavior change. */
