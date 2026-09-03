(() => {
  'use strict';
  if (window.__stProxyVoiceV1) return;
  window.__stProxyVoiceV1 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let activeAudio = null;
  let recorder = null;
  let stream = null;
  let chunks = [];
  let silenceTimer = null;
  let maxTimer = null;
  let speaking = false;

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const isCall = () => !!document.querySelector('.call-shell');
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const talkButton = () => buttons().find(b => /говорите|говори|начать говорить|остановить/i.test(text(b)) && !b.disabled);
  const authHeaders = async () => {
    const s = await sb.auth.getSession();
    const token = s?.data?.session?.access_token;
    if (!token) throw new Error('Сессия авторизации не найдена');
    return { Authorization: `Bearer ${token}` };
  };

  async function proxyTTS(input) {
    if (activeAudio) { try { activeAudio.pause(); activeAudio.currentTime = 0; } catch {} }
    const h = await authHeaders();
    h['Content-Type'] = 'application/json';
    const r = await fetch(`${PROJECT}/proxy-tts`, { method:'POST', headers:h, body:JSON.stringify({
      input,
      voice:'coral',
      instructions:'Говори естественно по-русски, как живой клиент в телефонном разговоре. Не читай как диктор. Используй живую разговорную интонацию, паузы и естественную эмоциональную реакцию. Не переигрывай.'
    })});
    if (!r.ok) throw new Error(`TTS: HTTP ${r.status} ${await r.text()}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    activeAudio = new Audio(url);
    activeAudio.onended = () => URL.revokeObjectURL(url);
    await activeAudio.play();
  }

  window.speakCallClient = async function(input) {
    if (!input) return;
    try { await proxyTTS(String(input)); }
    catch (e) { console.error('[SaleTrening] ProxyAPI TTS:', e); toast(`Не удалось озвучить клиента: ${e.message}`); }
  };

  async function proxySTT(blob) {
    const h = await authHeaders();
    const fd = new FormData();
    fd.append('file', blob, 'manager.webm');
    fd.append('prompt', 'Разговор менеджера по продажам с клиентом. Распознавай русскую речь, названия товаров, брендов, моделей, размеров шин, цены, числа и профессиональные термины максимально точно.');
    const r = await fetch(`${PROJECT}/proxy-stt`, { method:'POST', headers:h, body:fd });
    const d = await r.json().catch(()=>({}));
    if (!r.ok || !d.ok) throw new Error(d.error || `STT: HTTP ${r.status}`);
    return String(d.text || '').trim();
  }

  function setTalkLabel(label) {
    const b = talkButton();
    if (b) b.textContent = label;
  }

  function cleanupRecorder() {
    clearTimeout(silenceTimer); clearTimeout(maxTimer);
    silenceTimer = null; maxTimer = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; recorder = null; speaking = false;
  }

  async function finishRecording() {
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  }

  async function startRecording() {
    if (speaking) return;
    stream = await navigator.mediaDevices.getUserMedia({audio:true});
    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, {type: recorder?.mimeType || 'audio/webm'});
      cleanupRecorder();
      setTalkLabel('Обрабатываем речь…');
      try {
        const said = await proxySTT(blob);
        if (!said) throw new Error('Речь не распознана');
        if (!state.session) throw new Error('Активная сессия не найдена');
        state.messages = Array.isArray(state.messages) ? state.messages : [];
        state.messages.push({speaker:'manager',content:said});
        if (typeof window.render === 'function') window.render();
        const reply = await aiClientReply(said, false);
        if (!reply) throw new Error('Luna не вернула ответ клиента');
        state.messages.push({speaker:'client',content:reply});
        if (typeof window.render === 'function') window.render();
        if (typeof saveSession === 'function') await saveSession();
        await window.speakCallClient(reply);
        setTalkLabel('Говорите');
      } catch (e) {
        console.error('[SaleTrening] ProxyAPI voice turn:', e);
        toast(`Ошибка голосового хода: ${e.message}`);
        setTalkLabel('Говорите');
      }
    };
    recorder.start(250);
    setTalkLabel('Говорите… нажмите для завершения');

    // Simple silence detector: finish after ~1.2s of silence, with a 15s hard limit.
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let heardAt = Date.now();
    let quietSince = null;
    const tick = () => {
      if (!recorder || recorder.state === 'inactive') { try { ctx.close(); } catch {} return; }
      analyser.getByteTimeDomainData(data);
      let sum = 0; for (let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum += v*v; }
      const rms = Math.sqrt(sum/data.length);
      if (rms > 0.025) { heardAt = Date.now(); quietSince = null; }
      else if (Date.now()-heardAt > 900) { if (!quietSince) quietSince=Date.now(); if (Date.now()-quietSince>1200) { finishRecording(); try{ctx.close()}catch{} return; } }
      if (Date.now()-heardAt > 15000) { finishRecording(); try{ctx.close()}catch{} return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Capture the cold-call talk button before the old browser SpeechRecognition handler.
  document.addEventListener('click', e => {
    const b = e.target?.closest?.('button');
    if (!b || !isCall() || !/говорите|говори|начать говорить/i.test(text(b))) return;
    e.preventDefault(); e.stopImmediatePropagation();
    startRecording().catch(err => { cleanupRecorder(); toast(`Нет доступа к микрофону: ${err.message}`); setTalkLabel('Говорите'); });
  }, true);

  // Cancel browser speech synthesis if an old handler tries to start it.
  setInterval(() => { if (isCall()) { try { window.speechSynthesis?.cancel(); } catch {} } }, 500);

  // Keep logout compatibility.
  window.logout = async function () {
    try { const {error}=await sb.auth.signOut({scope:'local'}); if(error) throw error; }
    catch(e){ console.error('[SaleTrening] logout:',e); toast('Не удалось выйти. Попробуйте ещё раз.'); return; }
    state.user=null; state.profile=null; state.company=null; state.session=null; state.messages=[]; state.history=[]; state.team=[]; state.stats=null; state.report=null; state.view='home';
    if (window.authScreen) window.authScreen();
  };
})();