(() => {
  'use strict';
  if (window.__stColdCallPageV3) return;
  window.__stColdCallPageV3 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let stream = null;
  let recorder = null;
  let chunks = [];
  let listening = false;
  let processing = false;
  let speechDetected = false;
  let vadTimer = null;
  let callTimer = null;
  let startedAt = 0;
  let activeAudio = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  async function authHeaders(json=false){
    const s = await sb.auth.getSession();
    const token = s?.data?.session?.access_token;
    if (!token) throw new Error('Сессия авторизации не найдена');
    const h = {Authorization:`Bearer ${token}`};
    if (json) h['Content-Type']='application/json';
    return h;
  }

  function pickMime(){
    for (const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']) {
      try { if (window.MediaRecorder?.isTypeSupported?.(m)) return m; } catch {}
    }
    return '';
  }

  async function ensureStream(){
    if (stream?.active) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Браузер не поддерживает микрофон');
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  }

  function stopAudio(){
    try { if (activeAudio) { activeAudio.pause(); activeAudio.currentTime=0; } } catch {}
    activeAudio = null;
  }

  function stopMic(){
    listening=false;
    if (vadTimer) clearTimeout(vadTimer);
    vadTimer=null;
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch {}
    recorder=null;
    if (stream) stream.getTracks().forEach(t=>t.stop());
    stream=null;
    chunks=[];
  }

  function cleanup(){
    if (callTimer) clearInterval(callTimer);
    callTimer=null;
    stopMic();
    stopAudio();
    processing=false;
    window.__stColdCallActive=false;
    delete window.__stColdCallScenarioOverride;
  }

  function setStatus(text){
    const el=$('cc3-status'); if(el) el.textContent=text;
  }

  function render(){
    const p=$('page');
    if(!p||!state.session) return;
    const scenario=state.session.scenario||{};
    p.innerHTML=`
      <div class="top">
        <div><h2>Холодный звонок</h2><div class="muted">Живой диалог с AI-клиентом · ${esc(coldCall?.difficulty||scenario.difficulty||'Средний')}</div></div>
        <button class="secondary" type="button" id="cc3-back">← Выйти из тренировки</button>
      </div>
      <div id="cc3-page" style="background:#15131f;color:#fff;border-radius:22px;overflow:hidden;box-shadow:0 14px 40px rgba(25,20,55,.12)">
        <div style="padding:24px 28px;text-align:center;background:linear-gradient(180deg,#25203a,#171522)">
          <div style="font-size:11px;color:#aaa3bd;text-transform:uppercase;letter-spacing:.12em">Голосовая тренировка</div>
          <div style="width:78px;height:78px;border-radius:50%;margin:13px auto 8px;display:grid;place-items:center;background:linear-gradient(135deg,#7357ff,#9b86ff);font-size:34px">👤</div>
          <div style="font-size:21px;font-weight:850">${esc(scenario.client_role||'Потенциальный клиент')}</div>
          <div style="color:#aaa3bd;margin-top:4px">${esc(coldCall?.difficulty||'Средний')} · <span id="cc3-timer">00:00</span></div>
        </div>
        <div style="padding:20px 22px 24px">
          <div style="background:#211d32;border:1px solid #39324f;border-radius:16px;padding:15px 17px;margin-bottom:14px">
            <div style="font-size:10px;color:#aaa3bd;text-transform:uppercase;letter-spacing:.1em">Статус</div>
            <div id="cc3-status" style="margin-top:6px;font-size:16px">Вы говорите первым. Начинайте разговор.</div>
          </div>
          <div id="cc3-transcript" style="background:#0f0e17;border-radius:16px;padding:13px;min-height:260px;max-height:48vh;overflow:auto">
            ${state.messages.map(m=>`<div style="display:flex;justify-content:${m.speaker==='manager'?'flex-end':'flex-start'};margin:8px 3px"><div style="max-width:82%;padding:10px 13px;border-radius:15px;background:${m.speaker==='manager'?'#7357ff':'#27223b'};border:1px solid ${m.speaker==='manager'?'#7357ff':'#3a3352'};line-height:1.42"><div style="font-size:9px;opacity:.68;text-transform:uppercase;margin-bottom:3px">${m.speaker==='manager'?'Менеджер':'AI-клиент'}</div>${esc(m.content)}</div></div>`).join('')}
          </div>
          <div style="display:flex;gap:9px;margin-top:12px;align-items:stretch">
            <textarea id="cc3-text" rows="2" placeholder="Можно ответить текстом или говорить в микрофон…" style="flex:1;resize:none;border:1px solid #3b3550;background:#211d32;color:#fff;border-radius:14px;padding:12px 13px;outline:none"></textarea>
            <button id="cc3-send" class="primary" type="button" style="min-width:120px">Отправить</button>
          </div>
          <div style="display:flex;gap:10px;margin-top:10px;justify-content:center;flex-wrap:wrap">
            <button id="cc3-mic" class="primary" type="button" style="min-width:190px">🎙 Начать говорить</button>
            <button id="cc3-end" class="secondary" type="button">Завершить разговор</button>
          </div>
          <div class="muted" style="text-align:center;margin-top:9px;color:#9d97b0">Говорите → пауза → AI-клиент отвечает голосом → ваш следующий ход. Текстовый диалог сохраняется ниже.</div>
        </div>
      </div>`;
    $('cc3-back').onclick=finish;
    $('cc3-end').onclick=finish;
    $('cc3-mic').onclick=()=>listening?stopRecording():startRecording();
    $('cc3-send').onclick=()=>sendTyped();
    $('cc3-text').onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')sendTyped()};
    const box=$('cc3-transcript'); if(box) box.scrollTop=box.scrollHeight;
  }

  function setMic(text,disabled=false){const b=$('cc3-mic');if(b){b.textContent=text;b.disabled=disabled}}

  function appendMessage(speaker,text){
    state.messages=Array.isArray(state.messages)?state.messages:[];
    state.messages.push({speaker,content:text});
    const box=$('cc3-transcript'); if(!box)return;
    const row=document.createElement('div'); row.style=`display:flex;justify-content:${speaker==='manager'?'flex-end':'flex-start'};margin:8px 3px`;
    row.innerHTML=`<div style="max-width:82%;padding:10px 13px;border-radius:15px;background:${speaker==='manager'?'#7357ff':'#27223b'};border:1px solid ${speaker==='manager'?'#7357ff':'#3a3352'};line-height:1.42"><div style="font-size:9px;opacity:.68;text-transform:uppercase;margin-bottom:3px">${speaker==='manager'?'Менеджер':'AI-клиент'}</div>${esc(text)}</div>`;
    box.appendChild(row); box.scrollTop=box.scrollHeight;
  }

  async function tts(text){
    const h=await authHeaders(true);
    const voice=document.getElementById('coldVoice')?.value||coldCall?.voice||'coral';
    const r=await fetch(`${PROJECT}/proxy-tts`,{method:'POST',headers:h,body:JSON.stringify({input:String(text),voice,instructions:'Говори естественно по-русски как живой потенциальный клиент в телефонном разговоре. Разговорная интонация, естественные паузы и эмоции. Не читай как диктор.'})});
    if(!r.ok)throw new Error(`TTS HTTP ${r.status}`);
    const blob=await r.blob(); if(!blob.size)throw new Error('TTS вернул пустой аудиофайл');
    const url=URL.createObjectURL(blob); stopAudio(); activeAudio=new Audio(url); activeAudio.preload='auto';
    activeAudio.onended=()=>{URL.revokeObjectURL(url);activeAudio=null};
    try{await activeAudio.play()}catch(e){URL.revokeObjectURL(url);activeAudio=null;throw e}
  }

  async function stt(blob,mime){
    const h=await authHeaders();
    const fd=new FormData();
    const typ=String(mime||blob.type); const ext=typ.includes('mp4')?'m4a':typ.includes('ogg')?'ogg':'webm';
    fd.append('file',blob,`manager.${ext}`);
    fd.append('prompt','Разговор менеджера по продажам с потенциальным клиентом. Русская речь, цены, бренды, модели, размеры шин и профессиональные термины.');
    const r=await fetch(`${PROJECT}/proxy-stt`,{method:'POST',headers:h,body:fd});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.error||`STT HTTP ${r.status}`);
    return String(d.text||'').trim();
  }

  function startVAD(){
    if(!stream)return;
    const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx)return;
    const ctx=new Ctx(); ctx.resume().catch(()=>{});
    let analyser,source; try{analyser=ctx.createAnalyser();analyser.fftSize=1024;source=ctx.createMediaStreamSource(stream);source.connect(analyser)}catch{return}
    const data=new Uint8Array(analyser.fftSize),started=Date.now();let lastSpeech=0,above=0;
    const tick=()=>{
      if(!listening||!recorder||recorder.state==='inactive'){try{source.disconnect()}catch{};try{ctx.close()}catch{};return}
      analyser.getByteTimeDomainData(data);let sum=0;for(const n of data){const v=(n-128)/128;sum+=v*v}
      const rms=Math.sqrt(sum/data.length),now=Date.now();
      if(rms>.018){above++;if(above>=2){speechDetected=true;lastSpeech=now}}else above=0;
      if(speechDetected&&now-lastSpeech>1050){stopRecording();return}
      if(!speechDetected&&now-started>30000){stopRecording();return}
      if(speechDetected&&now-started>45000){stopRecording();return}
      vadTimer=setTimeout(tick,100);
    };tick();
  }

  async function startRecording(){
    if(processing||listening||!state.session)return;
    try{
      await ensureStream(); chunks=[];speechDetected=false;
      const mime=pickMime(); recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      const actual=recorder.mimeType||mime||'audio/webm';
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=async()=>{listening=false;if(vadTimer)clearTimeout(vadTimer);vadTimer=null;const blob=new Blob(chunks,{type:actual});chunks=[];recorder=null;await processVoice(blob,actual)};
      recorder.start(250);listening=true;setMic('⏹ Остановить запись');setStatus('Слушаю вас… говорите. После паузы AI-клиент ответит.');startVAD();
    }catch(e){cleanup();setStatus('Ошибка микрофона: '+e.message);setMic('🎙 Начать говорить');toast('Ошибка микрофона: '+e.message)}
  }

  function stopRecording(){if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch{}}else listening=false}

  async function processVoice(blob,mime){
    if(!blob?.size||!speechDetected){if(state.session&&!processing){setMic('🎙 Начать говорить');setStatus('Речь не обнаружена. Попробуйте ещё раз.')}return}
    processing=true;setMic('⏳ Обрабатываю…',true);setStatus('Распознаю речь менеджера…');
    try{const text=await stt(blob,mime);if(!text)throw new Error('Речь не распознана');await sendTurn(text,true)}
    catch(e){console.error('[SaleTrening] STT turn',e);setStatus('Ошибка STT: '+e.message);toast('Ошибка распознавания: '+e.message);setMic('🎙 Начать говорить')}
    finally{processing=false;if(state.session)setMic('🎙 Начать говорить')}
  }

  async function sendTyped(){
    if(processing||!state.session)return;const input=$('cc3-text'),text=input?.value.trim();if(!text)return;input.value='';await sendTurn(text,false);
  }

  async function sendTurn(text,fromVoice){
    processing=true;setMic(fromVoice?'⏳ AI отвечает…':'⏳ AI отвечает…',true);setStatus('AI-клиент формирует ответ…');
    try{
      appendMessage('manager',text);await saveSession();
      const reply=await aiClientReply(text,false);if(!reply)throw new Error('AI не вернул реплику клиента');
      appendMessage('client',reply);await saveSession();setStatus('AI-клиент отвечает голосом…');await tts(reply);setStatus('Ваш ход — говорите или ответьте текстом.');
    }catch(e){console.error('[SaleTrening] cold dialogue',e);setStatus('Ошибка AI-клиента: '+e.message);toast('Ошибка AI-клиента: '+e.message)}
    finally{processing=false;if(state.session)setMic('🎙 Начать говорить')}
  }

  async function saveSessionSafe(){try{if(typeof saveSession==='function')await saveSession()}catch(e){console.error(e)}}
  async function saveSession(){return saveSessionSafe()}

  async function finish(){
    if(processing){toast('Дождитесь завершения ответа AI-клиента');return}
    const old=window.finishTraining;cleanup();
    if(typeof old==='function')return old();
    state.session=null;state.view='history';if(typeof loadAll==='function')await loadAll();if(typeof render==='function')render();
  }

  async function startColdCallV3(difficulty='Средний'){
    try{
      cleanup();
      const resolved=typeof coldCallScenario==='function'?coldCallScenario(difficulty):null;
      const scenarios=Array.isArray(state.scenarios)?state.scenarios:[];
      const base=resolved&&resolved.id?resolved:scenarios[0];
      if(!base?.id)throw new Error('В базе нет активных сценариев');
      const hard=String(difficulty).toLowerCase().includes('слож');
      const scenario=Object.assign({},base,{title:'Холодный звонок — '+difficulty,cold_call:true,resistance_level:hard?7:4,cold_call_difficulty:(hard?7:4)+'/10',client_role:'Потенциальный клиент',client_mood:hard?'Занят, скептически настроен':'Сдержанный, но готов продолжить разговор',objective:'Заинтересовать клиента и договориться о следующем шаге'});
      window.__stColdCallScenarioOverride=scenario;window.__stColdCallActive=true;
      coldCall.character=$('coldCharacter')?.value||'Лояльный';coldCall.facts=$('coldFacts')?.value?.trim()||'';coldCall.voice=$('coldVoice')?.value||'coral';coldCall.difficulty=difficulty;coldCall.processing=false;
      const r=await sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:scenario.id,status:'started',transcript:[],voice_mode:true}).select().single();
      if(r.error)throw new Error(r.error.message||'Не удалось создать сессию');
      state.session=Object.assign({},r.data,{scenario});state.messages=[];state.view='coldcall';
      render();
      // render() may route to the legacy trainingCallPage; replace it immediately with our normal page.
      setTimeout(()=>{render();render();},0);
      startedAt=Date.now();
      callTimer=setInterval(()=>{const t=$('cc3-timer');if(!t)return;const s=Math.floor((Date.now()-startedAt)/1000);t.textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`},1000);
      // Replace the legacy call page after the application's render cycle.
      setTimeout(()=>{render();const p=$('page');if(p&&state.session){/* keep current normal page if already rendered */} },20);
      setTimeout(()=>startRecording(),120);
    }catch(e){cleanup();console.error('[SaleTrening] start cold v3',e);toast('Ошибка запуска голосовой тренировки: '+e.message)}
  }

  // Override only the cold-call start action. Standard text training is untouched.
  function install(){
    window.startColdCall=startColdCallV3;
    if(typeof window.trainingCallPage==='function'&&!window.__stTrainingCallPageV3){
      window.__stTrainingCallPageV3=true;
      window.trainingCallPage=render;
    }
  }
  install();
  let tries=0;const timer=setInterval(()=>{install();if(++tries>100)clearInterval(timer)},250);
})();
