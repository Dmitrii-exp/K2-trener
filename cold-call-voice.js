(() => {
  'use strict';
  if (window.__stProxyVoiceV2) return;
  window.__stProxyVoiceV2 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let activeAudio = null;
  let recorder = null;
  let stream = null;
  let chunks = [];
  let recording = false;
  let callOpen = false;
  let busy = false;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const authHeaders = async () => {
    const s = await sb.auth.getSession();
    const token = s?.data?.session?.access_token;
    if (!token) throw new Error('Сессия авторизации не найдена');
    return { Authorization: `Bearer ${token}` };
  };

  function injectStyles() {
    if (document.getElementById('st-phone-style')) return;
    const style = document.createElement('style');
    style.id = 'st-phone-style';
    style.textContent = `
      #st-phone-overlay{position:fixed;inset:0;background:rgba(10,9,18,.72);backdrop-filter:blur(7px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:22px}
      #st-phone{width:min(760px,96vw);height:min(820px,94vh);display:flex;flex-direction:column;background:#15131f;color:#fff;border:1px solid #39324f;border-radius:30px;box-shadow:0 30px 100px rgba(0,0,0,.45);overflow:hidden}
      .st-phone-head{padding:24px 28px 18px;text-align:center;background:linear-gradient(180deg,#25203a,#171522);position:relative}
      .st-phone-close{position:absolute;right:18px;top:16px;width:38px;height:38px;border:0;border-radius:50%;background:#302a47;color:#fff;font-size:20px;cursor:pointer}
      .st-phone-status{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a9a3bd}
      .st-phone-avatar{width:74px;height:74px;border-radius:50%;margin:12px auto 8px;display:grid;place-items:center;background:linear-gradient(135deg,#7357ff,#9b86ff);font-size:31px;box-shadow:0 10px 30px rgba(115,87,255,.3)}
      .st-phone-name{font-size:21px;font-weight:850}.st-phone-role{margin-top:4px;color:#a9a3bd;font-size:13px}
      .st-phone-timer{margin-top:10px;color:#d8d2ff;font-variant-numeric:tabular-nums}
      .st-phone-body{flex:1;min-height:0;padding:18px;display:flex;flex-direction:column;gap:12px}
      .st-phone-now{background:#211d32;border:1px solid #38314e;border-radius:18px;padding:14px 16px;min-height:78px}
      .st-phone-now-label{font-size:10px;color:#a9a3bd;text-transform:uppercase;letter-spacing:.1em}.st-phone-now-text{margin-top:5px;font-size:16px;line-height:1.4}
      .st-phone-transcript{flex:1;min-height:0;overflow:auto;background:#0f0e17;border-radius:18px;padding:12px}
      .st-phone-msg{display:flex;margin:8px 4px}.st-phone-msg.client{justify-content:flex-start}.st-phone-msg.manager{justify-content:flex-end}
      .st-phone-bubble{max-width:78%;padding:10px 13px;border-radius:16px;line-height:1.42;font-size:14px}.client .st-phone-bubble{background:#27223b;border:1px solid #3a3352}.manager .st-phone-bubble{background:#7357ff;color:#fff}
      .st-phone-label{font-size:10px;opacity:.7;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
      .st-phone-controls{padding:14px 18px 20px;border-top:1px solid #2d2840;background:#171522}
      .st-phone-main{width:100%;height:56px;border:0;border-radius:18px;background:#7357ff;color:#fff;font-weight:850;font-size:15px;cursor:pointer;box-shadow:0 10px 25px rgba(115,87,255,.24)}
      .st-phone-main.recording{background:#d84d5b}.st-phone-main:disabled{opacity:.55;cursor:wait}
      .st-phone-hint{text-align:center;color:#9d97b0;font-size:11px;margin-top:8px}
      .st-phone-end{margin:10px auto 0;display:block;border:0;background:transparent;color:#b8b1cb;cursor:pointer;font-size:12px}
    `;
    document.head.appendChild(style);
  }

  function closeDialog() {
    callOpen = false;
    try { if (activeAudio) { activeAudio.pause(); activeAudio.currentTime = 0; } } catch {}
    activeAudio = null;
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
    if (stream) stream.getTracks().forEach(t => t.stop());
    recorder = null; stream = null; chunks = []; recording = false; busy = false;
    document.getElementById('st-phone-overlay')?.remove();
  }

  function renderDialog(scenario) {
    injectStyles();
    document.getElementById('st-phone-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'st-phone-overlay';
    overlay.innerHTML = `<div id="st-phone">
      <div class="st-phone-head">
        <button class="st-phone-close" type="button" aria-label="Закрыть">×</button>
        <div class="st-phone-status">Голосовая тренировка · звонок</div>
        <div class="st-phone-avatar">👤</div>
        <div class="st-phone-name">${esc(scenario?.client_name || scenario?.client || 'Клиент')}</div>
        <div class="st-phone-role">${esc(scenario?.title || scenario?.name || 'Холодный звонок')}</div>
        <div class="st-phone-timer" id="st-phone-timer">00:00</div>
      </div>
      <div class="st-phone-body">
        <div class="st-phone-now"><div class="st-phone-now-label">Сейчас говорит</div><div class="st-phone-now-text" id="st-phone-now-text">ИИ готовит первую реплику клиента…</div></div>
        <div class="st-phone-transcript" id="st-phone-transcript"></div>
      </div>
      <div class="st-phone-controls">
        <button id="st-phone-talk" class="st-phone-main" type="button">🎙 Говорить менеджеру</button>
        <div class="st-phone-hint">Нажмите и говорите. После паузы речь автоматически распознаётся.</div>
        <button id="st-phone-end" class="st-phone-end" type="button">Завершить тренировку</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.st-phone-close').onclick = closeDialog;
    overlay.querySelector('#st-phone-end').onclick = finishCall;
    overlay.querySelector('#st-phone-talk').onclick = () => recording ? stopRecording() : startRecording();
    window.__stPhoneStartedAt = Date.now();
    window.__stPhoneTimer = setInterval(() => {
      const el = document.getElementById('st-phone-timer');
      if (!el) return;
      const sec = Math.floor((Date.now() - window.__stPhoneStartedAt) / 1000);
      el.textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    },1000);
  }

  function appendMessage(speaker, content) {
    const box = document.getElementById('st-phone-transcript');
    const now = document.getElementById('st-phone-now-text');
    if (!box) return;
    const row = document.createElement('div');
    row.className = `st-phone-msg ${speaker}`;
    row.innerHTML = `<div class="st-phone-bubble"><div class="st-phone-label">${speaker === 'client' ? 'ИИ клиент' : 'Менеджер'}</div>${esc(content)}</div>`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    if (now) now.textContent = content;
  }

  async function proxyTTS(input) {
    if (!input) return;
    if (activeAudio) { try { activeAudio.pause(); activeAudio.currentTime = 0; } catch {} }
    const h = await authHeaders();
    h['Content-Type'] = 'application/json';
    const r = await fetch(`${PROJECT}/proxy-tts`, {method:'POST',headers:h,body:JSON.stringify({input:String(input),voice:document.getElementById('coldVoice')?.value || 'coral',instructions:'Говори естественно по-русски как живой клиент в телефонном разговоре. Разговорная интонация, естественные паузы и эмоции. Не читай как диктор.'})});
    if (!r.ok) throw new Error(`TTS: HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    activeAudio = new Audio(url);
    activeAudio.onended = () => URL.revokeObjectURL(url);
    await activeAudio.play();
  }

  async function proxySTT(blob) {
    const h = await authHeaders();
    const fd = new FormData();
    fd.append('file',blob,'manager.webm');
    fd.append('prompt','Разговор менеджера по продажам с клиентом. Русская речь, цены, бренды, модели, размеры шин и профессиональные термины.');
    const r = await fetch(`${PROJECT}/proxy-stt`,{method:'POST',headers:h,body:fd});
    const d = await r.json().catch(()=>({}));
    if (!r.ok || !d.ok) throw new Error(d.error || `STT: HTTP ${r.status}`);
    return String(d.text || '').trim();
  }

  async function startRecording() {
    if (busy || recording || !callOpen) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Браузер не поддерживает доступ к микрофону');
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[]; recording=true;
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    recorder = new MediaRecorder(stream,{mimeType:mime});
    recorder.ondataavailable = e => { if(e.data?.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks,{type:mime});
      if (stream) stream.getTracks().forEach(t=>t.stop());
      stream=null; recorder=null; recording=false; busy=true;
      const btn=document.getElementById('st-phone-talk'); if(btn){btn.disabled=true;btn.classList.remove('recording');btn.textContent='⏳ Распознаём речь…';}
      try {
        const said=await proxySTT(blob);
        if(!said) throw new Error('Речь не распознана');
        state.messages=Array.isArray(state.messages)?state.messages:[];
        state.messages.push({speaker:'manager',content:said});
        appendMessage('manager',said);
        const reply=await aiClientReply(said,false);
        if(!reply) throw new Error('Luna не вернула ответ клиента');
        state.messages.push({speaker:'client',content:reply});
        appendMessage('client',reply);
        if(typeof saveSession==='function') await saveSession();
        await proxyTTS(reply);
      } catch(e) {
        console.error('[SaleTrening] voice turn',e);
        if(typeof toast==='function') toast(`Ошибка голосового хода: ${e.message}`);
      } finally {
        busy=false;
        const b=document.getElementById('st-phone-talk'); if(b){b.disabled=false;b.textContent='🎙 Говорить менеджеру';}
      }
    };
    recorder.start(250);
    const btn=document.getElementById('st-phone-talk'); if(btn){btn.classList.add('recording');btn.textContent='⏹ Завершить фразу';}
    startSilenceDetector();
  }

  function stopRecording(){ if(recorder && recorder.state!=='inactive') recorder.stop(); }

  function startSilenceDetector(){
    if(!stream) return;
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const source=ctx.createMediaStreamSource(stream); const analyser=ctx.createAnalyser(); analyser.fftSize=1024; source.connect(analyser);
    const data=new Uint8Array(analyser.fftSize); let heard=Date.now(); let quiet=0;
    const tick=()=>{
      if(!recording || !recorder || recorder.state==='inactive'){try{ctx.close()}catch{};return;}
      analyser.getByteTimeDomainData(data); let sum=0; for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v;} const rms=Math.sqrt(sum/data.length);
      if(rms>0.025){heard=Date.now();quiet=0;} else if(Date.now()-heard>900){quiet+=100; if(quiet>1200){stopRecording();try{ctx.close()}catch{};return;}}
      if(Date.now()-heard>15000){stopRecording();try{ctx.close()}catch{};return;}
      setTimeout(tick,100);
    }; tick();
  }

  async function launchColdCall(id) {
    if(callOpen) return;
    try {
      if(!id) throw new Error('Не передан ID сценария');
      const scenario=state.scenarios?.find(x=>x.id===id);
      if(!scenario) throw new Error('Сценарий не найден');
      if(!state.user?.id) throw new Error('Пользователь не авторизован');
      if(!state.profile?.company_id) throw new Error('Профиль компании не загружен');
      const result=await sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:id,status:'started',transcript:[],voice_mode:true}).select().single();
      if(result.error) throw new Error(result.error.message||'Не удалось создать голосовую сессию');
      state.session=Object.assign({},result.data,{scenario});
      state.messages=[]; state.view='training'; callOpen=true;
      renderDialog(scenario);
      const opening=await aiClientReply('',true);
      if(!opening) throw new Error('Luna не вернула первую реплику');
      state.messages.push({speaker:'client',content:opening});
      appendMessage('client',opening);
      if(typeof saveSession==='function') await saveSession();
      await proxyTTS(opening);
    } catch(e) {
      console.error('[SaleTrening] cold call launch',e);
      closeDialog();
      if(typeof toast==='function') toast(`Ошибка запуска голосовой тренировки: ${e.message}`); else alert(`Ошибка запуска: ${e.message}`);
    }
  }

  async function finishCall(){
    if(busy || !state.session) return;
    if(recording) stopRecording();
    try {
      if(typeof saveSession==='function') await saveSession();
      closeDialog();
      if(typeof finishTraining==='function') await finishTraining();
      else { state.session=null; state.messages=[]; state.view='history'; if(typeof render==='function') render(); }
    } catch(e) {
      console.error('[SaleTrening] finish voice call',e);
      if(typeof toast==='function') toast(`Ошибка завершения: ${e.message}`);
    }
  }

  window.speakCallClient = proxyTTS;

  // Intercept the actual cold-call launcher before the legacy handler. This also works if the old call UI fails to render.
  document.addEventListener('click', e => {
    const target=e.target?.closest?.('button,[onclick]');
    if(!target) return;
    const attr=target.getAttribute?.('onclick') || '';
    const label=(target.textContent||'').replace(/\s+/g,' ').trim();
    if(!/startColdCall\s*\(/i.test(attr)) return;
    const m=attr.match(/startColdCall\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/i);
    if(!m) return;
    e.preventDefault(); e.stopImmediatePropagation();
    launchColdCall(m[1]);
  },true);

  window.addEventListener('beforeunload',()=>{try{window.__stPhoneTimer&&clearInterval(window.__stPhoneTimer)}catch{};closeDialog();});

  window.logout = async function(){
    try{const {error}=await sb.auth.signOut({scope:'local'});if(error)throw error;}
    catch(e){console.error('[SaleTrening] logout:',e);if(typeof toast==='function')toast('Не удалось выйти. Попробуйте ещё раз.');return;}
    state.user=null;state.profile=null;state.company=null;state.session=null;state.messages=[];state.history=[];state.team=[];state.stats=null;state.report=null;state.view='home';if(window.authScreen)window.authScreen();
  };
})();