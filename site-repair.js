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
        script.src='/cold-call-voice.js?v=20260905-voice-runtime-1';
        script.async=false;
        script.dataset.stVoiceRuntime='1';
        document.head.appendChild(script);
      }
    }catch(e){ console.error('[SaleTrening] voice runtime load failed',e); }
  }

  function patchColdCall(){
    try{
      /* The dedicated runtime is the ONLY owner of cold-call start-up. */
      if(typeof window.launchColdCall==='function' && !window.__stColdCallIsolated){
        window.__stColdCallIsolated=true;
        window.startColdCall=function(){
          var args=arguments;
          var id=args[0];
          if(!id){
            var difficulty=(args.length && args[0]) || document.querySelector('[onclick*="startColdCall"]')?.getAttribute('onclick')?.match(/startColdCall\(['"]([^'"]+)/)?.[1] || 'Средний';
            var s=typeof coldCallScenario==='function'?coldCallScenario(difficulty):null;
            id=s?.id;
          }
          return window.launchColdCall(id);
        };
        /* Prevent the legacy in-page implementation from being called directly. */
        window.__stLegacyColdCallDisabled=true;
        console.log('[SaleTrening] dedicated cold-call voice runtime active');
      }
    }catch(e){ console.error('[SaleTrening] cold-call isolation failed',e); }
  }

  window.addEventListener('load',function(){
    setTimeout(function(){
      loadVoiceRuntime();

      /* Cold-call voice names: stable UI names mapped to supported ProxyAPI TTS IDs. */
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

      /* Give the dynamically loaded voice file time to define launchColdCall, then bind it. */
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
