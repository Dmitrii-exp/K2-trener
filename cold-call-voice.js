(() => {
  'use strict';
  if (window.__stProxyVoiceV3) return;
  window.__stProxyVoiceV3 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let activeAudio = null;
  let recorder = null;
  let stream = null;
  let chunks = [];
  let recording = false;
  let callOpen = false;
  let busy = false;
  let timerId = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function authHeaders(){
    const s = await sb.auth.getSession();
    const token = s?.data?.session?.access_token;
    if (!token) throw new Error('Сессия авторизации не найдена');
    return {Authorization:`Bearer ${token}`};
  }

  function injectStyles(){
    if(document.getElementById('st-phone-style-v3')) return;
    const style=document.createElement('style');
    style.id='st-phone-style-v3';
    style.textContent=`
      #st-phone-overlay{position:fixed;inset:0;background:rgba(10,9,18,.74);backdrop-filter:blur(8px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px}
      #st-phone{width:min(780px,96vw);height:min(850px,94vh);display:flex;flex-direction:column;background:#15131f;color:#fff;border:1px solid #39324f;border-radius:28px;box-shadow:0 30px 100px rgba(0,0,0,.48);overflow:hidden}
      .st-phone-head{padding:20px 26px 16px;text-align:center;background:linear-gradient(180deg,#27213e,#171522);position:relative}
      .st-phone-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border:0;border-radius:50%;background:#302a47;color:#fff;font-size:21px;cursor:pointer}
      .st-phone-status{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#aaa3bd}
      .st-phone-avatar{width:68px;height:68px;border-radius:50%;margin:10px auto 7px;display:grid;place-items:center;background:linear-gradient(135deg,#7357ff,#9b86ff);font-size:28px;box-shadow:0 10px 30px rgba(115,87,255,.3)}
      .st-phone-name{font-size:20px;font-weight:850}.st-phone-role{margin-top:3px;color:#aaa3bd;font-size:12px}.st-phone-timer{margin-top:8px;color:#d8d2ff;font-variant-numeric:tabular-nums}
      .st-phone-body{flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:10px}
      .st-phone-now{background:#211d32;border:1px solid #38314e;border-radius:17px;padding:12px 15px;min-height:70px}
      .st-phone-now-label{font-size:9px;color:#a9a3bd;text-transform:uppercase;letter-spacing:.1em}.st-phone-now-text{margin-top:5px;font-size:15px;line-height:1.4}
      .st-phone-transcript{flex:1;min-height:0;overflow:auto;background:#0f0e17;border-radius:17px;padding:10px}
      .st-phone-msg{display:flex;margin:7px 3px}.st-phone-msg.client{justify-content:flex-start}.st-phone-msg.manager{justify-content:flex-end}
      .st-phone-bubble{max-width:80%;padding:9px 12px;border-radius:15px;line-height:1.42;font-size:14px}.client .st-phone-bubble{background:#27223b;border:1px solid #3a3352}.manager .st-phone-bubble{background:#7357ff;color:#fff}
      .st-phone-label{font-size:9px;opacity:.68;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
      .st-phone-controls{padding:13px 17px 17px;border-top:1px solid #2d2840;background:#171522}
      .st-phone-main{width:100%;height:54px;border:0;border-radius:17px;background:#7357ff;color:#fff;font-weight:850;font-size:15px;cursor:pointer;box-shadow:0 10px 25px rgba(115,87,255,.24)}
      .st-phone-main.recording{background:#d84d5b}.st-phone-main:disabled{opacity:.55;cursor:wait}
      .st-phone-hint{text-align:center;color:#9d97b0;font-size:11px;margin-top:7px}.st-phone-end{margin:9px auto 0;display:block;border:0;background:transparent;color:#b8b1cb;cursor:pointer;font-size:12px}
    `;
    document.head.appendChild(style);
  }

  function clearTimer(){if(timerId){clearInterval(timerId);timerId=null;}}

  function closeDialogOnly(){
    callOpen=false; clearTimer();
    try{if(activeAudio){activeAudio.pause();activeAudio.currentTime=0;}}catch{}
    activeAudio=null;
    if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{}}
    if(stream)stream.getTracks().forEach(t=>t.stop());
    recorder=null;stream=null;chunks=[];recording=false;busy=false;
    document.getElementById('st-phone-overlay')?.remove();
  }

  function renderDialog(scenario){
    injectStyles();
    document.getElementById('st-phone-overlay')?.remove();
    const overlay=document.createElement('div'); overlay.id='st-phone-overlay';
    overlay.innerHTML=`<div id="st-phone">
      <div class="st-phone-head">
        <button class="st-phone-close" type="button" aria-label="Завершить разговор">×</button>
        <div class="st-phone-status">Голосовая тренировка · имитация звонка</div>
        <div class="st-phone-avatar">👤</div>
        <div class="st-phone-name">${esc(scenario?.client_name||scenario?.client||'Потенциальный клиент')}</div>
        <div class="st-phone-role">${esc(scenario?.title||scenario?.name||'Холодный звонок')}</div>
        <div class="st-phone-timer" id="st-phone-timer">00:00</div>
      </div>
      <div class="st-phone-body">
        <div class="st-phone-now"><div class="st-phone-now-label">Сейчас говорит</div><div class="st-phone-now-text" id="st-phone-now-text">Вы начинаете разговор. Нажмите «Говорить менеджеру».</div></div>
        <div class="st-phone-transcript" id="st-phone-transcript"></div>
      </div>
      <div class="st-phone-controls">
        <button id="st-phone-talk" class="st-phone-main" type="button">🎙 Говорить менеджеру</button>
        <div class="st-phone-hint">Говорите естественно. После паузы речь автоматически распознаётся, затем клиент отвечает голосом.</div>
        <button id="st-phone-end" class="st-phone-end" type="button">Завершить разговор</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.st-phone-close').onclick=finishCall;
    overlay.querySelector('#st-phone-end').onclick=finishCall;
    overlay.querySelector('#st-phone-talk').onclick=()=>recording?stopRecording():startRecording();
    window.__stPhoneStartedAt=Date.now();
    clearTimer();
    timerId=setInterval(()=>{const el=document.getElementById('st-phone-timer');if(!el)return;const sec=Math.floor((Date.now()-window.__stPhoneStartedAt)/1000);el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);
  }

  function appendMessage(speaker,content){
    const box=document.getElementById('st-phone-transcript'); const now=document.getElementById('st-phone-now-text'); if(!box)return;
    const row=document.createElement('div');row.className=`st-phone-msg ${speaker}`;
    row.innerHTML=`<div class="st-phone-bubble"><div class="st-phone-label">${speaker==='client'?'ИИ клиент':'Менеджер'}</div>${esc(content)}</div>`;
    box.appendChild(row);box.scrollTop=box.scrollHeight;if(now)now.textContent=content;
  }

  async function proxyTTS(input){
    if(!input)return;
    if(activeAudio){try{activeAudio.pause();activeAudio.currentTime=0;}catch{}}
    const h=await authHeaders();h['Content-Type']='application/json';
    const voice=document.getElementById('coldVoice')?.value||'coral';
    const r=await fetch(`${PROJECT}/proxy-tts`,{method:'POST',headers:h,body:JSON.stringify({input:String(input),voice,instructions:'Говори естественно по-русски как живой потенциальный клиент в телефонном разговоре. Разговорная интонация, естественные паузы и эмоции. Не читай как диктор.'})});
    if(!r.ok)throw new Error(`TTS: HTTP ${r.status}`);
    const blob=await r.blob();const url=URL.createObjectURL(blob);activeAudio=new Audio(url);activeAudio.onended=()=>URL.revokeObjectURL(url);await activeAudio.play();
  }

  async function proxySTT(blob){
    const h=await authHeaders();const fd=new FormData();fd.append('file',blob,'manager.webm');fd.append('prompt','Разговор менеджера по продажам с потенциальным клиентом. Русская речь, цены, бренды, модели, размеры шин и профессиональные термины.');
    const r=await fetch(`${PROJECT}/proxy-stt`,{method:'POST',headers:h,body:fd});const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.error||`STT: HTTP ${r.status}`);return String(d.text||'').trim();
  }

  function startSilenceDetector(){
    if(!stream)return;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    const ctx=new Ctx();const source=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=1024;source.connect(analyser);
    const data=new Uint8Array(analyser.fftSize);let heard=Date.now(),quiet=0;
    const tick=()=>{if(!recording||!recorder||recorder.state==='inactive'){try{ctx.close()}catch{};return;}analyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v;}const rms=Math.sqrt(sum/data.length);if(rms>.025){heard=Date.now();quiet=0}else if(Date.now()-heard>850){quiet+=100;if(quiet>1150){stopRecording();try{ctx.close()}catch{};return}}if(Date.now()-heard>15000){stopRecording();try{ctx.close()}catch{};return}setTimeout(tick,100)};tick();
  }

  async function startRecording(){
    if(busy||recording||!callOpen)return;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Браузер не поддерживает доступ к микрофону');
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recording=true;
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
      recorder=new MediaRecorder(stream,{mimeType:mime});recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=async()=>{
        const blob=new Blob(chunks,{type:mime});if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;recorder=null;recording=false;busy=true;
        const btn=document.getElementById('st-phone-talk');if(btn){btn.disabled=true;btn.classList.remove('recording');btn.textContent='⏳ Обрабатываем…';}
        try{
          const said=await proxySTT(blob);if(!said)throw new Error('Речь не распознана');
          state.messages=Array.isArray(state.messages)?state.messages:[];state.messages.push({speaker:'manager',content:said});appendMessage('manager',said);
          if(typeof saveSession==='function')await saveSession();
          const reply=await aiClientReply(said,false);if(!reply)throw new Error('ИИ не вернул ответ клиента');
          state.messages.push({speaker:'client',content:reply});appendMessage('client',reply);if(typeof saveSession==='function')await saveSession();
          await proxyTTS(reply);
        }catch(e){console.error('[SaleTrening] voice turn',e);if(typeof toast==='function')toast(`Ошибка голосового хода: ${e.message}`)}finally{busy=false;const b=document.getElementById('st-phone-talk');if(b){b.disabled=false;b.textContent='🎙 Говорить менеджеру'}}
      };
      recorder.start(250);const btn=document.getElementById('st-phone-talk');if(btn){btn.classList.add('recording');btn.textContent='⏹ Завершить фразу'}startSilenceDetector();
    }catch(e){recording=false;busy=false;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;recorder=null;console.error(e);if(typeof toast==='function')toast(`Не удалось включить микрофон: ${e.message}`)}
  }

  function stopRecording(){if(recorder&&recorder.state!=='inactive')recorder.stop()}

  async function launchColdCall(id){
    if(callOpen)return;
    try{
      if(!id)throw new Error('Не передан ID сценария');
      const override=window.__stColdCallScenarioOverride;
      const scenario=override&&String(override.id)===String(id)?override:state.scenarios?.find(x=>String(x.id)===String(id));
      if(!scenario)throw new Error('Сценарий не найден');
      if(!state.user?.id)throw new Error('Пользователь не авторизован');
      if(!state.profile?.company_id)throw new Error('Профиль компании не загружен');
      const result=await sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:id,status:'started',transcript:[],voice_mode:true}).select().single();
      if(result.error)throw new Error(result.error.message||'Не удалось создать голосовую сессию');
      state.session=Object.assign({},result.data,{scenario});state.messages=[];state.view='training';callOpen=true;window.__stColdCallActive=true;
      renderDialog(scenario);
      if(typeof toast==='function')toast('Звонок начат. Менеджер начинает разговор.');
      /* В холодном звонке ИИ НИКОГДА не начинает первым. Первый ход всегда менеджера. */
    }catch(e){console.error('[SaleTrening] cold call launch',e);closeDialogOnly();if(typeof toast==='function')toast(`Ошибка запуска голосовой тренировки: ${e.message}`);else alert(`Ошибка запуска голосовой тренировки: ${e.message}`)}
  }

  async function finishCall(){
    if(!state.session){closeDialogOnly();return}
    if(busy)return;
    try{if(typeof saveSession==='function')await saveSession();}catch(e){console.error('[SaleTrening] save before finish',e)}
    closeDialogOnly();window.__stColdCallActive=false;delete window.__stColdCallScenarioOverride;
    try{
      if(typeof finishTraining==='function')await finishTraining();
      else{state.session=null;state.messages=[];state.view='history';if(typeof render==='function')render();}
    }catch(e){console.error('[SaleTrening] finish voice call',e);if(typeof toast==='function')toast(`Ошибка завершения: ${e.message}`)}
  }

  window.launchColdCall=launchColdCall;
  window.finishColdCall=finishCall;
})();
