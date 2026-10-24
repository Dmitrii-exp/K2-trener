(() => {
  'use strict';
  if (window.STGeminiLive) return;
  const endpoint = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1/gemini-live-preview';
  let active = null;
  const voiceOptions = [['Charon','Charon — спокойный'],['Puck','Puck — энергичный'],['Fenrir','Fenrir — выразительный'],['Orus','Orus — уверенный'],['Kore','Kore — собранный'],['Aoede','Aoede — мягкий']];

  function open() {
    if (active) { active.dialog.focus(); return; }
    if (typeof state !== 'undefined' && state.session) { toast('Сначала завершите текущую тренировку.'); return; }
    const restoreFocus = document.activeElement;
    const character = document.getElementById('coldCharacter')?.value || 'Лояльный';
    const facts = document.getElementById('coldFacts')?.value || '';
    const dialog = document.createElement('dialog');
    dialog.className = 'gemini-preview';
    dialog.setAttribute('aria-labelledby','gemini-preview-title');
    dialog.setAttribute('aria-describedby','gemini-preview-description');
    dialog.innerHTML = `<div class="gemini-head"><h2 id="gemini-preview-title">Gemini Live · пробный звонок</h2><button type="button" class="secondary gemini-close" aria-label="Закрыть пробный звонок" autofocus>×</button></div>
      <p id="gemini-preview-description" class="gemini-description">Сравните скорость ответа, русский голос и перебивания. До 3 минут. Баллы и достижения за этот звонок не начисляются.</p>
      <div class="gemini-fields"><div><label for="gemini-preview-voice">Голос клиента</label><select id="gemini-preview-voice"></select></div><div><label for="gemini-preview-difficulty">Сложность</label><select id="gemini-preview-difficulty"><option>Средний</option><option>Сложный</option></select></div></div>
      <div class="gemini-status"><span id="gemini-preview-status" role="status" aria-live="polite">Нажмите «Начать звонок». Вы говорите первым.</span><span class="gemini-timer" aria-label="Длительность звонка">00:00</span></div>
      <div class="gemini-transcript" role="log" aria-label="Расшифровка пробного звонка" aria-live="off"><p class="muted">Здесь появится расшифровка разговора.</p></div>
      <div class="gemini-actions"><button type="button" class="primary gemini-start">Начать звонок</button><button type="button" class="secondary gemini-mute" disabled aria-pressed="false">Микрофон вкл.</button><button type="button" class="danger gemini-stop" disabled>Завершить</button></div>
      <p class="gemini-footnote">Звонок расходует API Google. Аудио передаётся в Google; расшифровка остаётся в этом окне и не сохраняется в историю тренировок. Требуется действующая подписка или доступ администратора.</p>`;
    const $ = selector => dialog.querySelector(selector);
    const voice = $('#gemini-preview-voice'), difficulty = $('#gemini-preview-difficulty');
    for (const [value,label] of voiceOptions) voice.add(new Option(label,value));
    const status = $('#gemini-preview-status'), clock = $('.gemini-timer'), transcript = $('.gemini-transcript');
    const startButton = $('.gemini-start'), stopButton = $('.gemini-stop'), muteButton = $('.gemini-mute');
    let generation = 0, running = false, starting = false, socket = null, context = null, microphone = null;
    let source = null, capture = null, silent = null, controller = null, tick = null, deadline = null, setupTimeout = null;
    let startedAt = 0, nextAudio = 0, messages = [], cursors = {}, outputNodes = new Set(), muted = false;
    const setStatus = (text,error=false) => { status.textContent = text; status.classList.toggle('gemini-error',error); };
    function buttons() {
      startButton.disabled = running || starting;
      startButton.textContent = starting ? 'Подключение…' : 'Начать звонок';
      stopButton.disabled = !running && !starting;
      muteButton.disabled = !running;
      voice.disabled = running || starting; difficulty.disabled = running || starting;
    }
    function clearAudio() {
      for (const node of outputNodes) { try { node.stop(); node.disconnect(); } catch {} }
      outputNodes.clear(); nextAudio = context?.currentTime || 0;
    }
    function stop(message) {
      generation++; running = false; starting = false;
      controller?.abort(); controller = null;
      clearInterval(tick); clearTimeout(deadline); clearTimeout(setupTimeout);
      tick = deadline = setupTimeout = null;
      clearAudio();
      if (capture) { capture.port.onmessage = null; capture.disconnect(); capture = null; }
      try { source?.disconnect(); silent?.disconnect(); } catch {} source = silent = null;
      microphone?.getTracks().forEach(track => track.stop()); microphone = null;
      if (socket) { socket.onclose = socket.onerror = socket.onmessage = socket.onopen = null; try { socket.close(1000); } catch {} socket = null; }
      if (context) { context.close().catch(()=>{}); context = null; }
      muted = false; muteButton.textContent = 'Микрофон вкл.'; muteButton.setAttribute('aria-pressed','false');
      buttons(); if (message) setStatus(message);
    }
    function fail(message) { stop(); setStatus(message,true); }
    function append(speaker,text) {
      if (!text || typeof text !== 'string') return;
      let item = cursors[speaker];
      if (!item) { item = {speaker,text:''}; messages.push(item); cursors[speaker] = item; }
      item.text = (item.text + text).slice(0,8000);
      if (messages.length > 100) messages.splice(0,messages.length-100);
      const shouldScroll = transcript.scrollHeight-transcript.scrollTop-transcript.clientHeight < 60;
      transcript.replaceChildren();
      for (const message of messages) {
        const p = document.createElement('p'), strong = document.createElement('strong'), content = document.createElement('span');
        strong.textContent = message.speaker === 'manager' ? 'Вы' : 'Клиент'; content.textContent = message.text;
        p.append(strong,content); transcript.append(p);
      }
      if (shouldScroll) transcript.scrollTop = transcript.scrollHeight;
    }
    function play(data,mime) {
      if (!running || !context || !data) return;
      if (mime && !mime.startsWith('audio/pcm')) throw new Error('format');
      const raw = atob(data);
      if (!raw.length || raw.length % 2 || raw.length > 2*1024*1024) throw new Error('audio');
      const bytes = Uint8Array.from(raw,c=>c.charCodeAt(0)), view = new DataView(bytes.buffer);
      const rate = Number(String(mime||'').match(/rate=(\d+)/)?.[1] || 24000);
      if (rate < 8000 || rate > 96000) throw new Error('rate');
      const buffer = context.createBuffer(1,raw.length/2,rate), channel = buffer.getChannelData(0);
      for (let i=0;i<channel.length;i++) channel[i] = view.getInt16(i*2,true)/32768;
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination);
      nextAudio = Math.max(nextAudio,context.currentTime+0.02);
      if (nextAudio-context.currentTime > 15) throw new Error('backlog');
      node.start(nextAudio); nextAudio += buffer.duration; outputNodes.add(node);
      node.onended = () => { outputNodes.delete(node); node.disconnect(); };
    }
    async function start() {
      if (starting || running) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { fail('Для звонка нужен современный браузер с доступом к микрофону.'); return; }
      const run = ++generation; starting = true; messages = []; cursors = {}; buttons();
      transcript.replaceChildren(); clock.textContent = '00:00'; setStatus('Подключаем Gemini…');
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        context = new AudioContextClass(); await context.resume();
        if (run !== generation) return;
        controller = new AbortController();
        const abortTimer = setTimeout(()=>controller?.abort(),20000);
        let data;
        try {
          const auth = await sb.auth.getSession();
          if (run !== generation) return;
          const jwt = auth?.data?.session?.access_token;
          if (!jwt) throw new Error('Необходимо войти в аккаунт.');
          const response = await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({voice:voice.value,difficulty:difficulty.value,character,facts}),signal:controller.signal,cache:'no-store'});
          data = await response.json().catch(()=>({}));
          if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось подключить Gemini.');
        } finally { clearTimeout(abortTimer); }
        if (run !== generation) return;
        if (!/^auth_tokens\/[A-Za-z0-9_.~+\/=-]+$/.test(data.token||'') || data.token.length > 8192 || !['v1alpha','v1beta'].includes(data.api_version)) throw new Error('Сервер вернул некорректные параметры подключения.');
        setStatus('Разрешите доступ к микрофону…');
        const mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
        if (run !== generation) { mic.getTracks().forEach(track=>track.stop()); return; }
        microphone = mic;
        await context.audioWorklet.addModule('/gemini-pcm-worklet.js?v=20261024');
        if (run !== generation) return;
        const expires = Date.parse(data.expires_at), remaining = Math.min(180000,expires-Date.now());
        if (!Number.isFinite(remaining) || remaining < 1000) throw new Error('Время подключения истекло. Попробуйте снова.');
        const ws = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.'+data.api_version+'.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(data.token));
        data.token = ''; socket = ws;
        ws.onopen = () => { if (run === generation) ws.send(JSON.stringify({setup:{model:'models/'+data.model}})); };
        ws.onerror = () => { if (run === generation) fail('Не удалось установить соединение с Google. Проверьте сеть и доступ к Gemini.'); };
        ws.onclose = () => { if (run === generation) stop('Соединение с Gemini завершено. Баллы не начислялись.'); };
        let incoming = Promise.resolve();
        ws.onmessage = event => {
          incoming = incoming.then(async()=>{
            if (run !== generation) return;
            const message = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
            if (run !== generation) return;
            if (message.error) { fail('Gemini отклонил подключение. Проверьте модель, ключ и квоты Google AI API.'); return; }
            if (message.setupComplete) {
              clearTimeout(setupTimeout); starting = false; running = true; startedAt = Date.now(); buttons();
              source = context.createMediaStreamSource(microphone); capture = new AudioWorkletNode(context,'gemini-pcm-capture'); silent = context.createGain(); silent.gain.value = 0;
              source.connect(capture); capture.connect(silent); silent.connect(context.destination);
              capture.port.onmessage = ({data:packet}) => {
                if (run !== generation || !running || ws.readyState !== WebSocket.OPEN) return;
                if (ws.bufferedAmount > 256*1024) { fail('Соединение не успевает передавать звук. Повторите звонок при стабильной сети.'); return; }
                const bytes = new Uint8Array(packet); let text = ''; for (const b of bytes) text += String.fromCharCode(b);
                ws.send(JSON.stringify({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:btoa(text)}}}));
              };
              setStatus('Соединение установлено. Вы говорите первым.');
              tick = setInterval(()=>{const seconds=Math.floor((Date.now()-startedAt)/1000);clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},1000);
            }
            const content = message.serverContent;
            if (!content) return;
            if (content.interrupted) { clearAudio(); delete cursors.client; setStatus('Слушаю вас…'); }
            if (content.inputTranscription?.text) append('manager',content.inputTranscription.text);
            if (content.outputTranscription?.text) append('client',content.outputTranscription.text);
            for (const part of content.modelTurn?.parts || []) if (part.inlineData?.data) { play(part.inlineData.data,part.inlineData.mimeType); setStatus('Клиент отвечает. Можно перебивать.'); }
            if (content.turnComplete) { cursors = {}; setStatus('Ваш ход — говорите.'); }
          }).catch(()=>{ if (run === generation) fail('Не удалось обработать голосовой поток Gemini. Повторите звонок.'); });
        };
        setupTimeout = setTimeout(()=>{if(run===generation)fail('Gemini не подтвердил подключение. Проверьте доступ к модели.');},15000);
        deadline = setTimeout(()=>{if(run===generation)stop('Пробный звонок завершён: лимит — 3 минуты. Баллы не начислялись.');},remaining);
      } catch (error) {
        if (run === generation) fail(error.name === 'NotAllowedError' ? 'Доступ к микрофону запрещён. Разрешите его в настройках браузера.' : error.name === 'AbortError' ? 'Подключение заняло слишком много времени. Попробуйте ещё раз.' : error.message || 'Не удалось начать звонок.');
      }
    }
    const hide = () => { if (dialog.open) dialog.close(); };
    const leave = () => { stop(); hide(); };
    startButton.onclick = start;
    stopButton.onclick = () => stop('Звонок завершён. Баллы не начислялись. Можно выбрать другой голос и попробовать снова.');
    muteButton.onclick = () => { muted=!muted;microphone?.getAudioTracks().forEach(track=>{track.enabled=!muted;});muteButton.textContent=muted?'Микрофон выкл.':'Микрофон вкл.';muteButton.setAttribute('aria-pressed',String(muted)); };
    $('.gemini-close').onclick = hide;
    const visibility = () => { if (document.hidden && (running||starting)) stop('Звонок остановлен, поскольку окно было скрыто.'); };
    dialog.onclose = () => { stop();active=null;window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',visibility);dialog.remove();restoreFocus?.focus(); };
    window.addEventListener('pagehide',leave); document.addEventListener('visibilitychange',visibility);
    document.body.append(dialog); active={dialog}; dialog.showModal();
  }
  window.STGeminiLive = { open };
})();
