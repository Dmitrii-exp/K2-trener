/* SaleTrening emergency runtime repair */
(function(){
  'use strict';
  function showFatal(message){
    var root=document.getElementById('root');
    if(root && (!root.innerHTML || root.innerHTML.trim()==='')){
      root.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font-family:Arial;padding:24px"><div style="max-width:760px;background:#fff;border:1px solid #e7e7ef;border-radius:20px;padding:28px;box-shadow:0 15px 40px #0001"><h2 style="margin-top:0">SaleTrening</h2><p>Ошибка запуска приложения.</p><pre style="white-space:pre-wrap;background:#f6f6fa;padding:14px;border-radius:12px">'+String(message).replace(/[&<>]/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[x]})+'</pre><button onclick="location.reload()" style="padding:11px 16px;border:0;border-radius:10px;background:#7357ff;color:#fff">Обновить</button></div></div>';
    }
  }
  window.addEventListener('error',function(e){console.error('SaleTrening runtime error',e.error||e.message);setTimeout(function(){showFatal(e.message||'JavaScript error')},0)});
  window.addEventListener('unhandledrejection',function(e){console.error('SaleTrening promise error',e.reason);setTimeout(function(){showFatal(e.reason?.message||String(e.reason||'Promise error'))},0)});
  window.SALETRENING_TRAINING_SUBSCRIPTION_GATE = false;

  function loadVoiceRuntime(){
    try{
      if(window.__stVoiceRuntimeLoader) return;
      window.__stVoiceRuntimeLoader=true;
      var existing=document.querySelector('script[data-st-voice-runtime="1"]');
      if(!existing){
        var script=document.createElement('script');
        script.src='/cold-call-voice.js?v=20260905-voice-runtime-5';
        script.async=false;
        script.dataset.stVoiceRuntime='1';
        document.head.appendChild(script);
      }
    }catch(e){ console.error('[SaleTrening] voice runtime load failed',e); }
  }

  function installColdAiBridge(){
    try{
      if(window.__stColdAiBridgeInstalled || typeof window.aiClientReply!=='function') return;
      var original=window.aiClientReply;
      window.aiClientReply=async function(userMessage,opening){
        var was=typeof state!=='undefined' ? state.view : null;
        if(window.__stColdCallActive && typeof state!=='undefined') state.view='coldcall';
        try{return await original(userMessage,opening)}
        finally{if(window.__stColdCallActive && typeof state!=='undefined') state.view='coldcall';else if(typeof state!=='undefined'&&was!==null) state.view=was;}
      };
      window.__stColdAiBridgeInstalled=true;
    }catch(e){console.error('[SaleTrening] cold AI bridge failed',e);}
  }

  function startResolvedColdCall(difficulty){
    difficulty=String(difficulty||'Средний');
    var replacedIndex=-1, originalScenario=null, syntheticScenario=null;
    try{
      if(typeof coldCallScenario !== 'function') throw new Error('Функция выбора сценария холодного звонка не загрузилась');
      var resolved=coldCallScenario(difficulty);
      var id=resolved && resolved.id;
      var scenarios=(typeof state!=='undefined' && Array.isArray(state.scenarios))?state.scenarios:[];

      /* В базе проекта сейчас могут отсутствовать отдельные строки «Холодный звонок».
         Тогда используем существующий активный сценарий как технический FK, но передаём
         в AI полноценный синтетический объект холодного звонка. */
      if(!id){
        if(!scenarios.length) throw new Error('В базе нет активных сценариев');
        originalScenario=scenarios[0];
        id=originalScenario.id;
        syntheticScenario=Object.assign({},originalScenario,{
          title:'Холодный звонок — '+difficulty,
          description:'Голосовая тренировка холодного звонка: выход на клиента и назначение следующего шага.',
          difficulty:difficulty,
          client_role:'Потенциальный клиент',
          client_mood:difficulty==='Сложный'?'Занят, скептически настроен':'Сдержанный',
          objective:'Заинтересовать клиента и договориться о следующем шаге'
        });
        replacedIndex=scenarios.indexOf(originalScenario);
        if(replacedIndex>=0) scenarios[replacedIndex]=syntheticScenario;
        resolved=syntheticScenario;
      }

      if(typeof window.launchColdCall!=='function') throw new Error('Голосовой модуль ещё не загрузился');
      installColdAiBridge();

      if(typeof coldCall!=='undefined'){
        coldCall.character=document.getElementById('coldCharacter')?.value||'Лояльный';
        coldCall.facts=document.getElementById('coldFacts')?.value?.trim()||'';
        coldCall.voice=document.getElementById('coldVoice')?.value||'coral';
        coldCall.difficulty=difficulty;
        coldCall.processing=false;
      }

      window.__stColdCallActive=true;
      console.log('[SaleTrening] cold call scenario resolved',{id:id,difficulty:difficulty,title:resolved.title||'' ,synthetic:!!syntheticScenario});
      return Promise.resolve(window.launchColdCall(id)).finally(function(){
        window.__stColdCallActive=false;
        if(replacedIndex>=0 && originalScenario) scenarios[replacedIndex]=originalScenario;
      });
    }catch(e){
      window.__stColdCallActive=false;
      if(replacedIndex>=0 && originalScenario && typeof state!=='undefined' && Array.isArray(state.scenarios)) state.scenarios[replacedIndex]=originalScenario;
      console.error('[SaleTrening] cold call start failed',e);
      if(typeof toast==='function') toast('Ошибка запуска голосовой тренировки: '+(e.message||e));
      else alert('Ошибка запуска голосовой тренировки: '+(e.message||e));
    }
  }

  function patchColdCall(){
    try{
      installColdAiBridge();
      if(typeof window.launchColdCall==='function' && !window.__stColdCallIsolated){
        window.__stColdCallIsolated=true;
        window.startColdCall=function(difficulty){ return startResolvedColdCall(difficulty); };
        window.__stLegacyColdCallDisabled=true;
        console.log('[SaleTrening] dedicated cold-call voice runtime active');
      }
    }catch(e){ console.error('[SaleTrening] cold-call isolation failed',e); }
  }

  window.addEventListener('load',function(){
    setTimeout(function(){
      loadVoiceRuntime();
      try{
        var coldVoice=document.getElementById('coldVoice');
        if(coldVoice){
          coldVoice.innerHTML='';
          [['onyx','Олег'],['ash','Николай'],['coral','Даша']].forEach(function(v){
            var option=document.createElement('option');
            option.value=v[0];
            option.textContent=v[1];
            coldVoice.appendChild(option);
          });
          coldVoice.value=coldVoice.value||'onyx';
        }
      }catch(e){ console.error('[SaleTrening] cold voice names patch failed',e); }

      var root=document.getElementById('root');
      if(root && root.innerHTML.trim()==='') showFatal('Приложение не выполнило bootstrap. Проверьте загрузку Supabase и авторизацию.');

      try{
        if(typeof state==='undefined' || !state || typeof window.startTraining!=='function') return;
        var originalStartTraining=window.startTraining;
        if(originalStartTraining.__saleTrainingWrapped) return;
        var startTraining=async function(id){
          try{
            if(window.SALETRENING_TRAINING_SUBSCRIPTION_GATE) return await originalStartTraining(id);
            if(!id) throw new Error('Не передан ID сценария');
            var scenario=state.scenarios && state.scenarios.find(function(x){return x.id===id});
            if(!scenario) throw new Error('Сценарий не найден: '+id);
            if(!state.user || !state.user.id) throw new Error('Пользователь не авторизован');
            if(!state.profile || !state.profile.company_id) throw new Error('Профиль компании не загружен');
            if(typeof sb==='undefined' || !sb) throw new Error('Supabase не инициализирован');
            var result=await sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:id,status:'started',transcript:[],voice_mode:false}).select().single();
            if(result.error) throw new Error(result.error.message||'Не удалось создать тренировочную сессию');
            state.session=Object.assign({},result.data,{scenario:scenario});
            state.messages=[];
            if(typeof saveSession==='function') await saveSession();
            state.view='training';
            if(typeof trainingChat==='function') trainingChat();
            var opening=await aiClientReply('',true);
            state.messages.push({speaker:'client',content:opening});
            if(typeof saveSession==='function') await saveSession();
            if(typeof trainingChat==='function') trainingChat();
          }catch(e){
            console.error('[SaleTrening] startTraining failed',e);
            var msg=e&&e.message?e.message:String(e);
            if(typeof toast==='function') toast('Ошибка запуска тренировки: '+msg); else alert('Ошибка запуска тренировки: '+msg);
          }
        };
        startTraining.__saleTrainingWrapped=true;
        window.startTraining=startTraining;
      }catch(e){ console.error('[SaleTrening] training patch failed',e); }

      patchColdCall();
      var tries=0;
      var timer=setInterval(function(){
        tries++;
        patchColdCall();
        if(window.__stColdCallIsolated || tries>=20) clearInterval(timer);
      },250);
    },1000);
  });
})();
