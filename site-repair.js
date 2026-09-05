/* SaleTrening emergency runtime repair V2 */
(function(){
  'use strict';

  function showFatal(message){
    var root=document.getElementById('root');
    if(root && (!root.innerHTML||root.innerHTML.trim()==='')){
      root.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font-family:Arial;padding:24px"><div style="max-width:760px;background:#fff;border:1px solid #e7e7ef;border-radius:20px;padding:28px"><h2>SaleTrening</h2><p>Ошибка запуска приложения.</p><pre style="white-space:pre-wrap;background:#f6f6fa;padding:14px;border-radius:12px">'+String(message).replace(/[&<>]/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[x]})+'</pre><button onclick="location.reload()" style="padding:11px 16px;border:0;border-radius:10px;background:#7357ff;color:#fff">Обновить</button></div></div>';
    }
  }
  window.addEventListener('error',function(e){console.error('SaleTrening runtime error',e.error||e.message);setTimeout(function(){showFatal(e.message||'JavaScript error')},0)});
  window.addEventListener('unhandledrejection',function(e){console.error('SaleTrening promise error',e.reason);setTimeout(function(){showFatal(e.reason?.message||String(e.reason||'Promise error'))},0)});
  window.SALETRENING_TRAINING_SUBSCRIPTION_GATE=false;

  function loadVoiceRuntime(){
    try{
      if(window.__stVoiceRuntimeLoader)return;
      window.__stVoiceRuntimeLoader=true;
      var existing=document.querySelector('script[data-st-voice-runtime="1"]');
      if(!existing){
        var script=document.createElement('script');
        script.src='/cold-call-voice.js?v=20260905-voice-runtime-6';
        script.async=false;script.dataset.stVoiceRuntime='1';document.head.appendChild(script);
      }
    }catch(e){console.error('[SaleTrening] voice runtime load failed',e)}
  }

  function installColdAiBridge(){
    try{
      if(window.__stColdAiBridgeInstalled||typeof window.aiClientReply!=='function')return;
      var original=window.aiClientReply;
      window.aiClientReply=async function(userMessage,opening){
        var was=typeof state!=='undefined'?state.view:null;
        if(window.__stColdCallActive&&typeof state!=='undefined')state.view='coldcall';
        try{return await original(userMessage,opening)}
        finally{if(window.__stColdCallActive&&typeof state!=='undefined')state.view='coldcall';else if(typeof state!=='undefined'&&was!==null)state.view=was}
      };
      window.__stColdAiBridgeInstalled=true;
    }catch(e){console.error('[SaleTrening] cold AI bridge failed',e)}
  }

  function startResolvedColdCall(difficulty){
    difficulty=String(difficulty||'Средний');
    try{
      if(typeof coldCallScenario!=='function')throw new Error('Функция выбора сценария холодного звонка не загрузилась');
      var resolved=coldCallScenario(difficulty);
      var scenarios=(typeof state!=='undefined'&&Array.isArray(state.scenarios))?state.scenarios:[];
      var id=resolved&&resolved.id;
      var base=resolved&&id?resolved:scenarios[0];
      if(!base||!base.id)throw new Error('В базе нет активных сценариев');

      var resistance=difficulty.toLowerCase().includes('слож')?7:4;
      var scenario=Object.assign({},base,{
        id:base.id,
        title:'Холодный звонок — '+difficulty,
        description:'Имитация холодного звонка. Менеджер начинает разговор первым. Клиент отвечает естественно и не должен чрезмерно сопротивляться.',
        difficulty:difficulty,
        client_role:'Потенциальный клиент',
        client_mood:difficulty.toLowerCase().includes('слож')?'Занят, скептически настроен':'Сдержанный, но готов продолжить разговор',
        objective:'Заинтересовать клиента и договориться о следующем шаге',
        cold_call:true,
        resistance_level:resistance,
        cold_call_difficulty:`${resistance}/10`
      });

      window.__stColdCallScenarioOverride=scenario;
      window.__stColdCallActive=true;
      installColdAiBridge();
      if(typeof coldCall!=='undefined'){
        coldCall.character=document.getElementById('coldCharacter')?.value||'Лояльный';
        coldCall.facts=document.getElementById('coldFacts')?.value?.trim()||'';
        coldCall.voice=document.getElementById('coldVoice')?.value||'coral';
        coldCall.difficulty=difficulty;
        coldCall.processing=false;
      }
      if(typeof window.launchColdCall!=='function')throw new Error('Голосовой модуль ещё не загрузился');
      console.log('[SaleTrening] cold call ready',{id:id,difficulty:difficulty,resistance:resistance,settings:!!(document.getElementById('coldCharacter')||document.getElementById('coldFacts'))});
      return window.launchColdCall(id);
    }catch(e){
      window.__stColdCallActive=false;delete window.__stColdCallScenarioOverride;
      console.error('[SaleTrening] cold call start failed',e);
      if(typeof toast==='function')toast('Ошибка запуска голосовой тренировки: '+(e.message||e));else alert('Ошибка запуска голосовой тренировки: '+(e.message||e));
    }
  }

  function patchColdCall(){
    try{
      installColdAiBridge();
      if(typeof window.launchColdCall==='function'&&!window.__stColdCallIsolated){
        window.__stColdCallIsolated=true;
        window.startColdCall=function(difficulty){return startResolvedColdCall(difficulty)};
        console.log('[SaleTrening] manager-first cold-call runtime active');
      }
    }catch(e){console.error('[SaleTrening] cold-call isolation failed',e)}
  }

  function patchStandardTraining(){
    try{
      if(typeof state==='undefined'||!state||typeof window.startTraining!=='function')return;
      var original=window.startTraining;
      if(original.__saleTrainingWrapped)return;
      var wrapped=async function(id){
        try{
          if(window.SALETRENING_TRAINING_SUBSCRIPTION_GATE)return await original(id);
          if(!id)throw new Error('Не передан ID сценария');
          var scenario=state.scenarios&&state.scenarios.find(function(x){return x.id===id});
          if(!scenario)throw new Error('Сценарий не найден: '+id);
          if(!state.user?.id)throw new Error('Пользователь не авторизован');
          if(!state.profile?.company_id)throw new Error('Профиль компании не загружен');
          var result=await sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:id,status:'started',transcript:[],voice_mode:false}).select().single();
          if(result.error)throw new Error(result.error.message||'Не удалось создать тренировочную сессию');
          state.session=Object.assign({},result.data,{scenario:scenario});state.messages=[];state.view='training';
          if(typeof trainingChat==='function')trainingChat();
          var opening=await aiClientReply('',true);state.messages.push({speaker:'client',content:opening});
          if(typeof saveSession==='function')await saveSession();
          if(typeof trainingChat==='function')trainingChat();
        }catch(e){console.error('[SaleTrening] startTraining failed',e);if(typeof toast==='function')toast('Ошибка запуска тренировки: '+(e.message||e))}
      };
      wrapped.__saleTrainingWrapped=true;window.startTraining=wrapped;
    }catch(e){console.error('[SaleTrening] standard training patch failed',e)}
  }

  window.addEventListener('load',function(){
    setTimeout(function(){
      loadVoiceRuntime();
      patchStandardTraining();
      patchColdCall();
      var tries=0;var timer=setInterval(function(){tries++;patchColdCall();installColdAiBridge();if(window.__stColdCallIsolated||tries>=40)clearInterval(timer)},250);
      try{
        var coldVoice=document.getElementById('coldVoice');
        if(coldVoice){
          coldVoice.innerHTML='';[['onyx','Олег'],['ash','Николай'],['coral','Даша']].forEach(function(v){var o=document.createElement('option');o.value=v[0];o.textContent=v[1];coldVoice.appendChild(o)});
          coldVoice.value=coldVoice.value||'onyx';
        }
      }catch(e){console.error('[SaleTrening] cold voice names patch failed',e)}
      var root=document.getElementById('root');if(root&&root.innerHTML.trim()==='')showFatal('Приложение не выполнило bootstrap. Проверьте загрузку Supabase и авторизацию.');
    },1000);
  });
})();
