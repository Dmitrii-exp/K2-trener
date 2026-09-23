(() => {
  'use strict';
  if (window.__stProxyVoiceV5) return;
  window.__stProxyVoiceV5 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let stream = null, recorder = null, chunks = [], analyser = null, analyserSource = null, vadTimer = null;
  let audio = null, audioCtx = null, recording = false, processing = false, callOpen = false, continuousMode = false;
  const LIVE_VOICES = ['ash','ballad','echo','verse','cedar','marin','alloy','coral','sage','shimmer'];
  const LIVE_VOICE = 'ash';
  let livePc = null, liveDc = null, liveAudio = null, liveSessionId = null;
  let liveInputBuffers = new Map(), liveOutputBuffers = new Map(), liveOutputTimers = new Map();
  let speechDetected = false, startedAt = 0, timer = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  async function authHeaders(json=false){
    const s=await sb.auth.getSession();
    const token=s?.data?.session?.access_token;
    if(!token) throw new Error('Сессия авторизации не найдена');
    return json ? {Authorization:`Bearer ${token}`,'Content-Type':'application/json'} : {Authorization:`Bearer ${token}`};
  }

  function stopMic(){
    recording=false;
    if(vadTimer){clearTimeout(vadTimer);vadTimer=null;}
    try{analyserSource?.disconnect()}catch{}
    analyserSource=null;analyser=null;
    try{if(recorder&&recorder.state!=='inactive')recorder.stop()}catch{}
    recorder=null;chunks=[];
    if(stream)stream.getTracks().forEach(t=>t.stop());
    stream=null;
  }

  function closeAudio(){try{audio?.pause()}catch{}audio=null;try{audioCtx?.close()}catch{}audioCtx=null;}

  async function closeLive(){
    try{
      if(liveDc?.readyState==='open'){
        liveDc.send(JSON.stringify({type:'session.close'}));
        await new Promise(resolve=>setTimeout(resolve,350));
      }
    }catch(e){console.warn('[SaleTrening] GPT-Live close',e)}
    try{liveDc?.close()}catch{}
    try{livePc?.close()}catch{}
    try{liveAudio?.pause()}catch{}
    if(liveAudio)liveAudio.srcObject=null;
    liveDc=null;livePc=null;liveAudio=null;liveSessionId=null;
    liveInputBuffers.clear();liveOutputBuffers.clear();
    liveOutputTimers.forEach(t=>clearTimeout(t));liveOutputTimers.clear();
  }

  function cleanup(){
    callOpen=false;
    continuousMode=false;
    if(timer){clearInterval(timer);timer=null;}
    stopMic();
    closeAudio();
    closeLive().catch(()=>{});
    processing=false;
    window.__stColdCallActive=false;
    delete window.__stColdCallScenarioOverride;
  }

  function css(){
    if($('st-cold-page-style'))return;
    const s=document.createElement('style');s.id='st-cold-page-style';
    s.textContent=`
      .st-cold-page{width:100%;max-width:1120px;min-width:0;box-sizing:border-box;margin:0 auto;padding:0 0 30px;overflow:hidden}
      .st-cold-head{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:18px}
      .st-cold-head h2{margin:0;font-size:30px;font-weight:850;letter-spacing:-.7px}
      .st-cold-sub{margin-top:5px;color:var(--muted)}
      .st-cold-card{width:100%;max-width:100%;min-width:0;box-sizing:border-box;background:#15131f;color:#fff;border-radius:22px;overflow:hidden;box-shadow:0 16px 45px rgba(25,20,55,.12)}
      .st-cold-top{padding:24px 26px;background:linear-gradient(180deg,#27213e,#171522);text-align:center}
      .st-cold-avatar{width:72px;height:72px;border-radius:50%;margin:2px auto 9px;display:grid;place-items:center;background:linear-gradient(135deg,#7357ff,#9b86ff);font-size:31px}
      .st-cold-name{font-size:21px;font-weight:850}.st-cold-meta{margin-top:5px;color:#aaa3bd;font-size:12px}.st-cold-time{margin-top:9px;color:#d8d2ff;font-variant-numeric:tabular-nums}
      .st-cold-live{margin:16px;background:#211d32;border:1px solid #39324f;border-radius:16px;padding:14px}.st-cold-live-label{font-size:10px;color:#aaa3bd;text-transform:uppercase;letter-spacing:.1em}.st-cold-live-text{margin-top:5px;font-size:16px;line-height:1.45}
      .st-cold-main{padding:0 16px 16px;box-sizing:border-box;min-width:0}.st-cold-transcript{background:#0f0e17;border-radius:17px;padding:12px;min-height:260px;max-height:48vh;overflow:auto}.st-cold-msg{display:flex;margin:8px 2px}.st-cold-msg.manager{justify-content:flex-end}.st-cold-msg.client{justify-content:flex-start}.st-cold-bubble{max-width:82%;padding:10px 13px;border-radius:15px;line-height:1.45;font-size:14px}.st-cold-msg.client .st-cold-bubble{background:#27223b;border:1px solid #3a3352}.st-cold-msg.manager .st-cold-bubble{background:#7357ff;color:#fff}.st-cold-label{font-size:9px;opacity:.68;margin-bottom:3px;letter-spacing:.07em}
      .st-cold-compose{display:flex;gap:9px;margin-top:12px}.st-cold-compose textarea{flex:1;min-width:0;resize:none;border:1px solid #3b3550;background:#211d32;color:#fff;border-radius:13px;padding:12px;outline:none}.st-cold-send{border:0;border-radius:13px;padding:0 18px;background:#7357ff;color:#fff;font-weight:800}.st-cold-controls{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-top:10px}.st-cold-mic,.st-cold-end{border:0;border-radius:13px;padding:12px 20px;color:#fff;font-weight:800}.st-cold-mic{background:#7357ff;min-width:190px}.st-cold-mic.recording{background:#d84d5b}.st-cold-end{background:#302b43}.st-cold-hint{text-align:center;color:#9d97b0;font-size:11px;margin-top:9px}.st-cold-back{border:1px solid var(--line);border-radius:12px;padding:10px 15px;background:#fff;color:var(--text);font-weight:650}
      @media(max-width:760px){.st-cold-head{align-items:flex-start;flex-direction:column}.st-cold-head h2{font-size:25px}.st-cold-compose{flex-wrap:wrap}.st-cold-send{height:45px;flex:1}.st-cold-transcript{max-height:none;min-height:280px}}
    `;document.head.appendChild(s);
  }

  function bubble(speaker,text){return `<div class="st-cold-msg ${speaker}"><div class="st-cold-bubble"><div class="st-cold-label">${speaker==='manager'?'МЕНЕДЖЕР':'AI-КЛИЕНТ'}</div>${esc(text)}</div></div>`;}

  function render(){
    const p=$('page');if(!p||!state.session)return;css();
    const scenario=state.session.scenario||{};const difficulty=coldCall?.difficulty||scenario.difficulty||'Средний';
    p.innerHTML=`<div class="st-cold-page"><div class="st-cold-head"><div><h2>Холодный звонок</h2><div class="st-cold-sub">Живой диалог с AI-клиентом · ${esc(difficulty)}</div></div><button id="st-cold-back" class="st-cold-back">← Назад</button></div><div class="st-cold-card"><div class="st-cold-top"><div class="st-cold-avatar">👤</div><div class="st-cold-name">Потенциальный клиент</div><div class="st-cold-meta">Холодный звонок · ${esc(difficulty)}</div><div class="st-cold-time" id="st-cold-time">00:00</div></div><div class="st-cold-live"><div class="st-cold-live-label">Статус</div><div id="st-cold-live" class="st-cold-live-text">Вы говорите первым. Начинайте разговор.</div></div><div class="st-cold-main"><div class="st-cold-controls"><button id="st-cold-mic" class="st-cold-mic">🎙 Начать говорить</button><button id="st-cold-end" class="st-cold-end">Завершить разговор</button></div><div class="st-cold-hint">${coldCall?.advanced?"Продвинутый звонок: GPT-Live слушает и отвечает напрямую, с естественными перебиваниями и без отдельного STT/TTS.":"Говорите естественно. После паузы клиент отвечает автоматически. Диалог сохраняется в истории тренировки."}</div></div></div></div>`;
    $('st-cold-back').onclick=()=>{if(!processing){cleanup();state.session=null;state.messages=[];state.view='coldcall';render()}};
    $('st-cold-end').onclick=finish;$('st-cold-mic').onclick=()=>{if(coldCall?.advanced){if(!livePc)startAdvancedLiveConversation()}else if(!continuousMode)startContinuousConversation()};updateUI();scrollTranscript();
  }

  function scrollTranscript(){const x=$('st-cold-transcript');if(x)x.scrollTop=x.scrollHeight;}
  function setStatus(text){const x=$('st-cold-live');if(x)x.textContent=text;}
  function updateUI(){
    const b=$('st-cold-mic');
    if(!b)return;
    if(recording){
      b.textContent='🔴 Говорите…';
      b.classList.add('recording');
      b.disabled=true;
    }else if(processing){
      b.textContent='⏳ ИИ отвечает…';
      b.classList.remove('recording');
      b.disabled=true;
    }else if(continuousMode){
      b.textContent='🔴 Разговор идёт автоматически';
      b.classList.add('recording');
      b.disabled=true;
    }else if(coldCall?.advanced&&livePc){
      b.textContent='🔴 Продвинутый звонок активен';
      b.classList.add('recording');
      b.disabled=true;
    }else{
      b.textContent='🎙 Начать говорить';
      b.classList.remove('recording');
      b.disabled=false;
    }
  }

  async function startAdvancedLiveConversation(){
    if(!callOpen||processing||livePc)return;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Браузер не поддерживает микрофон');
      const pc=new RTCPeerConnection(); livePc=pc;
      const dc=pc.createDataChannel('oai-events'); liveDc=dc;
      dc.onmessage=e=>handleLiveEvent(e.data);
      dc.onerror=e=>console.error('[SaleTrening] GPT-Live data channel',e);
      liveAudio=new Audio(); liveAudio.autoplay=true; liveAudio.playsInline=true;
      pc.ontrack=e=>{const track=e.streams?.[0];if(track){liveAudio.srcObject=track;liveAudio.play().catch(()=>{})}};
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      mic.getTracks().forEach(t=>pc.addTrack(t,mic)); stream=mic;
      const character=coldCall?.character||'Лояльный';
      const facts=coldCall?.facts||'';
      const difficulty=coldCall?.difficulty||'Средний';
      const objections=(state.clientObjections||state.client_settings?.objections||state.session?.objections||[]).slice(0,12);
      const scenario=state.session?.scenario||{};
      const instructions=[
        'Ты потенциальный клиент в тренировочном холодном B2B-звонке.',
        'Говори только на естественном русском языке, как живой человек по телефону: разговорно, без дикторской подачи, без длинных монологов.',
        'Не помогай менеджеру продавать и не объясняй ему правильную технику продаж.',
        'Не говори, что ты ИИ, модель, голосовой ассистент или что это тренировка.',
        'Твоя роль: '+character+'. Уровень сложности: '+difficulty+'.',
        'Сценарий: '+(scenario.title||'Холодный звонок')+'. Цель менеджера: '+(scenario.objective||'заинтересовать и договориться о следующем шаге')+'.',
        facts?'Факты о клиенте: '+facts+'.':'',
        objections.length?'Возможные возражения клиента: '+objections.join('; ')+'.':'',
        'Ты отвечаешь на последнюю реплику менеджера и сохраняешь контекст. Не используй все возражения сразу.',
        'Менеджер говорит первым. После его первой реплики ответь как клиент.',
        'Если менеджер перебивает или меняет тему, реагируй естественно. Если задаёт конкретный вопрос — отвечай как клиент, но не раскрывай сразу всю информацию.',
        'Отвечай обычно 1–3 короткими фразами. Иногда задавай встречный вопрос или выражай сомнение.'
      ].filter(Boolean).join('\n');
      const history=(state.messages||[]).slice(-20).map(m=>({type:'message',role:m.speaker==='manager'?'user':'assistant',content:[{type:m.speaker==='manager'?'input_text':'output_text',text:String(m.content||'') }]})).filter(x=>x.content[0].text);
      const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
      const answerResp=await fetch(PROJECT+'/gpt-live-session',{method:'POST',headers:await authHeaders(true),body:JSON.stringify({sdp:offer.sdp,session:{voice:(LIVE_VOICES.includes(coldCall?.liveVoice)?coldCall.liveVoice:LIVE_VOICE),instructions,input:history}}),cache:'no-store'});
      const raw=await answerResp.text(); let j={}; try{j=raw?JSON.parse(raw):{}}catch{}
      if(!answerResp.ok||!j.ok){
        const detail=j.detail?.error?.message||j.detail?.message||j.detail?.error||'';
        throw new Error(j.error+(detail?': '+detail:'')||raw||('GPT-Live HTTP '+answerResp.status));
      }
      if(!j.transport?.sdp)throw new Error('GPT-Live не вернул SDP answer');
      liveSessionId=j.session?.id||null; await pc.setRemoteDescription({type:'answer',sdp:j.transport.sdp});
      dc.onopen=()=>{setStatus('Продвинутый звонок подключён. Вы говорите первым.');updateUI()};
      pc.onconnectionstatechange=()=>{const s=pc.connectionState;if(s==='failed'||s==='disconnected'){setStatus('Соединение продвинутого звонка прервано.');if(typeof toast==='function')toast('GPT-Live: соединение прервано')}};
      setStatus('Подключаю продвинутый звонок…'); updateUI();
    }catch(e){
      console.error('[SaleTrening] GPT-Live start',e);
      try{stream?.getTracks().forEach(t=>t.stop())}catch{} stream=null;
      try{liveDc?.close()}catch{} try{livePc?.close()}catch{} liveDc=null;livePc=null;liveAudio=null;
      setStatus('Ошибка продвинутого звонка: '+e.message); if(typeof toast==='function')toast('GPT-Live: '+e.message);
    }
  }

  function flushLiveTranscriptBuffers(){
    for(const t of liveInputBuffers.values()){
      const final=String(t||'').trim();
      if(final)addMessage('manager',final);
    }
    liveInputBuffers.clear();
    for(const [key,t] of liveOutputBuffers.entries()){
      const final=String(t||'').trim();
      if(final)addMessage('client',final);
      const timerId=liveOutputTimers.get(key);
      if(timerId)clearTimeout(timerId);
      liveOutputTimers.delete(key);
    }
    liveOutputBuffers.clear();
  }

  function addLiveOutput(itemId,text){
    const clean=String(text||'').trim(); if(!clean)return;
    const key=itemId||'output-'+Date.now();
    liveOutputBuffers.set(key,(liveOutputBuffers.get(key)||'')+clean);
    const old=liveOutputTimers.get(key); if(old)clearTimeout(old);
    liveOutputTimers.set(key,setTimeout(async()=>{
      const final=String(liveOutputBuffers.get(key)||'').trim();
      if(final){
        addMessage('client',final);
        try{await save()}catch(e){console.warn('[SaleTrening] GPT-Live save client',e)}
      }
      liveOutputBuffers.delete(key);liveOutputTimers.delete(key);
    },700));
  }

  function handleLiveEvent(raw){
    let e;try{e=typeof raw==='string'?JSON.parse(raw):raw}catch{return}
    const type=String(e?.type||'');
    if(type==='session.started'||type==='session.updated'){setStatus('Продвинутый звонок активен. Говорите.');return}
    if(type==='conversation.item.input_audio_transcription.delta'||type==='input_transcript.delta'){const id=e.item_id||'input';liveInputBuffers.set(id,(liveInputBuffers.get(id)||'')+String(e.delta||''));return}
    if(type==='conversation.item.input_audio_transcription.completed'||type==='input_transcript.completed'||type==='input_transcript.done'){const id=e.item_id||'input';const text=String(e.transcript||liveInputBuffers.get(id)||'').trim();liveInputBuffers.delete(id);if(text){addMessage('manager',text);save().catch(err=>console.warn('[SaleTrening] GPT-Live save manager',err));setStatus('Клиент отвечает…')}return}
    if(type==='response.output_audio_transcript.delta'||type==='output_transcript.delta'||type==='response.output_text.delta'){addLiveOutput(e.item_id||e.response_id||'output',String(e.delta||''));return}
    if(type==='response.output_audio_transcript.done'||type==='output_transcript.done'){const id=e.item_id||e.response_id||'output';const text=String(e.transcript||e.text||'').trim();if(text)addLiveOutput(id,text);return}
    if(type==='error'){console.error('[SaleTrening] GPT-Live event error',e);const msg=e.error?.message||e.message||'Ошибка GPT-Live';setStatus('Ошибка GPT-Live: '+msg);if(typeof toast==='function')toast('GPT-Live: '+msg)}
  }
  async function startContinuousConversation(){
    if(processing||recording||!callOpen||continuousMode)return;
    continuousMode=true;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Браузер не поддерживает доступ к микрофону');
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(Ctx){
        audioCtx=audioCtx||new Ctx();
        await audioCtx.resume().catch(()=>{});
      }
      setStatus('Слушаю вас… Говорите первым. После паузы клиент ответит автоматически.');
      updateUI();
      await startRecording();
    }catch(e){
      console.error('[SaleTrening] continuous voice start',e);
      continuousMode=false;
      setStatus('Ошибка микрофона: '+e.message);
      updateUI();
      if(typeof toast==='function')toast('Не удалось начать разговор: '+e.message);
    }
  }

  function addMessage(speaker,text){state.messages=Array.isArray(state.messages)?state.messages:[];state.messages.push({speaker,content:text});}
  async function save(){if(typeof saveSession==='function')await saveSession();}
  function pickMime(){for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']){try{if(MediaRecorder.isTypeSupported?.(m))return m}catch{}}return '';}
  async function ensureStream(){if(stream?.active)return;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Браузер не поддерживает микрофон');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(window.AudioContext||window.webkitAudioContext){audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();await audioCtx.resume().catch(()=>{})}}

  function startVAD(){
    if(!stream||!audioCtx)return;try{analyser=audioCtx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.2;analyserSource=audioCtx.createMediaStreamSource(stream);analyserSource.connect(analyser);const data=new Uint8Array(analyser.fftSize),begin=Date.now();let lastSpeech=0,above=0;const tick=()=>{if(!recording||!recorder||recorder.state==='inactive'){try{analyserSource?.disconnect()}catch{}return}analyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v}const rms=Math.sqrt(sum/data.length),now=Date.now();if(rms>.018){above++;if(above>=2){speechDetected=true;lastSpeech=now}}else above=0;if(speechDetected&&now-lastSpeech>350){stopRecording();return}if(!speechDetected&&now-begin>30000){stopRecording();return}if(speechDetected&&now-begin>45000){stopRecording();return}vadTimer=setTimeout(tick,100)};tick()}catch(e){console.warn('[SaleTrening] VAD unavailable',e)}}
  function stopRecording(){if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch(e){console.warn(e)}}else recording=false;}
  async function recognize(blob,mime){const fd=new FormData(),typ=String(mime||blob.type),ext=typ.includes('mp4')?'m4a':typ.includes('ogg')?'ogg':'webm';fd.append('file',blob,`manager.${ext}`);fd.append('prompt','Разговор менеджера по продажам с потенциальным клиентом. Русская речь, цены, бренды, модели, размеры шин и профессиональные термины.');const r=await fetch(`${PROJECT}/proxy-stt`,{method:'POST',headers:await authHeaders(),body:fd});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||`STT HTTP ${r.status}`);return String(j.text||'').trim()}
  async function speak(text){const r=await fetch(`${PROJECT}/proxy-tts`,{method:'POST',headers:await authHeaders(true),body:JSON.stringify({input:String(text),voice:document.getElementById('coldVoice')?.value||coldCall?.voice||'coral',instructions:'Говори естественно по-русски как живой потенциальный клиент в телефонном разговоре. Разговорная интонация, естественные паузы и эмоции. Не читай как диктор.'})});if(!r.ok)throw new Error(`TTS HTTP ${r.status}`);const blob=await r.blob();if(!blob.size)throw new Error('TTS вернул пустой аудиофайл');const url=URL.createObjectURL(blob);try{audio=new Audio(url);audio.preload='auto';await audio.play();await new Promise(resolve=>{audio.onended=resolve})}finally{URL.revokeObjectURL(url);audio=null}}
  async function aiClientReplyStreamAndSpeak(userMessage){
    if(!state.session?.scenario)throw new Error('Нет активной тренировки');
    const s=await sb.auth.getSession();
    const token=s?.data?.session?.access_token;
    if(!token)throw new Error('Сессия авторизации истекла');
    const settings=state.clientSettings||state.client_settings||state.session.client_settings||state.session.scenario.client_settings||{};
    const objections=state.clientObjections||state.client_objections||state.session.objections||state.session.client_objections||[];
    const r=await fetch(PROJECT+'/chat-client',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({
        session_id:state.session.id,
        scenario_id:state.session.scenario.id,
        message:userMessage,
        transcript:state.messages,
        scenario:state.session.scenario,
        client_settings:settings,
        objections,
        cold_call:{character:coldCall?.character||'Лояльный',facts:coldCall?.facts||'',voice:coldCall?.voice||'coral',difficulty:coldCall?.difficulty||'Средний'},
        stream:true
      }),
      cache:'no-store'
    });
    if(!r.ok)throw new Error((await r.text())||('HTTP '+r.status));
    const contentType=String(r.headers.get('content-type')||'').toLowerCase();
    if(contentType.includes('application/json')){
      const j=await r.json().catch(()=>({}));
      if(j?.ok===false)throw new Error(j?.error||'AI-клиент вернул ошибку');
      const reply=String(j?.reply||j?.message||j?.content||'').trim();
      if(!reply)throw new Error('AI не вернул реплику клиента');
      await speak(reply);
      return reply;
    }
    if(!r.body)throw new Error('AI не вернул поток ответа');
    const reader=r.body.getReader(),decoder=new TextDecoder();
    let buf='',full='',spoken=0,ttsQueue=Promise.resolve();
    const speakSentence=s=>{const clean=s.trim();if(clean)ttsQueue=ttsQueue.then(()=>speak(clean));};
    const consume=chunk=>{
      buf+=chunk;
      const lines=buf.split(/\r?\n/);buf=lines.pop()||'';
      for(const line of lines){
        const raw=line.trim();
        if(!raw.startsWith('data:'))continue;
        const data=raw.slice(5).trim();
        if(data==='[DONE]')continue;
        try{
          const j=JSON.parse(data);
          const delta=j?.choices?.[0]?.delta?.content||j?.choices?.[0]?.text||j?.delta||j?.text||j?.output_text?.delta||j?.output_text||'';
          if(delta){
            full+=String(delta);
            const tail=full.slice(spoken);
            const m=tail.match(/^([\s\S]*?[.!?…](?:[»”'\")])?)(?:\s+|$)/);
            if(m){
              const sentence=m[1].trim();
              spoken+=m[0].length;
              speakSentence(sentence);
            }
          }
        }catch{}
      }
    };
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      consume(decoder.decode(value,{stream:true}));
    }
    consume(decoder.decode());
    const tail=full.slice(spoken).trim();
    if(tail)speakSentence(tail);
    await ttsQueue;
    if(!full.trim())throw new Error('AI не вернул реплику клиента');
    return full.trim();
  }

  async function processSpeech(blob,mime){
    recording=false;
    if(vadTimer){clearTimeout(vadTimer);vadTimer=null}
    try{analyserSource?.disconnect()}catch{}
    analyserSource=null;
    analyser=null;
    recorder=null;

    if(!blob?.size||!speechDetected){
      setStatus('Речь не обнаружена. Слушаю вас снова…');
      updateUI();
      if(continuousMode&&callOpen&&!processing){
        setTimeout(()=>{if(continuousMode&&callOpen&&!processing)startRecording().catch(console.error)},120);
      }
      return;
    }

    processing=true;
    updateUI();
    setStatus('Распознаю речь менеджера…');

    try{
      const text=await recognize(blob,mime);
      if(!text)throw new Error('Речь не распознана');

      addMessage('manager',text);
      save().catch(e=>console.warn('[SaleTrening] background save manager',e));

      setStatus('AI-клиент формирует ответ…');
      const reply=await aiClientReplyStreamAndSpeak(text);
      if(!reply)throw new Error('AI не вернул реплику клиента');

      addMessage('client',reply);
      save().catch(e=>console.warn('[SaleTrening] background save',e));
      setStatus('Ваш ход — говорите. После паузы клиент ответит автоматически.');
    }catch(e){
      console.error('[SaleTrening] voice turn',e);
      setStatus('Ошибка голосового хода: '+e.message);
      if(typeof toast==='function')toast('Ошибка голосового хода: '+e.message);
    }finally{
      processing=false;
      updateUI();
      if(continuousMode&&callOpen){
        setTimeout(()=>{
          if(continuousMode&&callOpen&&!processing){
            setStatus('Слушаю вас… Говорите.');
            startRecording().catch(e=>{
              console.error('[SaleTrening] restart recording',e);
              setStatus('Ошибка повторного запуска микрофона: '+e.message);
              if(typeof toast==='function')toast('Ошибка микрофона: '+e.message);
            });
          }
        },250);
      }
    }
  }

  async function startRecording(){
    if(processing||recording||!callOpen||!continuousMode)return;
    try{
      await ensureStream();
      chunks=[];
      speechDetected=false;

      const m=pickMime();
      recorder=m?new MediaRecorder(stream,{mimeType:m}):new MediaRecorder(stream);
      const actual=recorder.mimeType||m||'audio/webm';

      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=async()=>{
        const blob=new Blob(chunks,{type:actual});
        chunks=[];
        await processSpeech(blob,actual);
      };
      recorder.onerror=e=>console.error('[SaleTrening] MediaRecorder',e);

      recorder.start(250);
      recording=true;
      updateUI();
      setStatus('Слушаю вас… Говорите. После паузы я передам фразу AI-клиенту.');
      startVAD();
    }catch(e){
      recording=false;
      if(recorder){try{if(recorder.state!=='inactive')recorder.stop()}catch{}}
      recorder=null;
      if(stream){try{stream.getTracks().forEach(t=>t.stop())}catch{}}
      stream=null;
      setStatus('Ошибка микрофона: '+e.message);
      updateUI();
      if(typeof toast==='function')toast('Ошибка микрофона: '+e.message);
    }
  }

  async function typedTurn(){if(processing||!callOpen)return;const input=$('st-cold-input');const text=input?.value.trim();if(!text)return;input.value='';await turn(text)}
  async function turn(text){if(processing||!callOpen||!state.session)return;processing=true;updateUI();addMessage('manager',text);setStatus('AI-клиент формирует ответ…');await save();try{const reply=await aiClientReply(text,false);if(!reply)throw new Error('AI не вернул реплику клиента');addMessage('client',reply);await save();setStatus('AI-клиент отвечает голосом…');try{await speak(reply)}catch(e){console.error('[SaleTrening] TTS',e);if(typeof toast==='function')toast('Ошибка TTS: '+e.message)}setStatus('Ваш ход — говорите или ответьте текстом.')}catch(e){console.error('[SaleTrening] AI client',e);setStatus('Ошибка AI-клиента: '+e.message);if(typeof toast==='function')toast('Ошибка AI-клиента: '+e.message)}finally{processing=false;updateUI()}}
  async function finish(){
    if(processing){if(typeof toast==='function')toast('Дождитесь ответа AI-клиента');return}
    if(!state.session)return;
    processing=true;
    updateUI();
    try{
      if(livePc||liveDc){
        await new Promise(resolve=>setTimeout(resolve,120));
        flushLiveTranscriptBuffers();
        await save();
      }
      const f=window.finishTraining;
      if(typeof f==='function')await f();
    }catch(e){
      console.error('[SaleTrening] finish cold call',e);
      try{await save()}catch{}
      if(typeof toast==='function')toast('Не удалось завершить тренировку: '+(e?.message||e));
    }finally{
      cleanup();
      processing=false;
      updateUI();
    }
  }
  async function launchColdCall(){
    const override=window.__stColdCallScenarioOverride;
    const difficulty=coldCall?.difficulty||override?.difficulty||'Средний';
    cleanup();
    try{
      const base=override||((typeof coldCallScenario==='function'&&coldCallScenario(difficulty))||state.scenarios?.[0]);
      if(!base?.id)throw new Error('В базе нет активных сценариев');
      const hard=String(difficulty).toLowerCase().includes('слож');
      const scenario={...base,cold_call:true,difficulty,resistance_level:hard?7:4,cold_call_difficulty:(hard?7:4)+'/10'};
      const r=await sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:scenario.id,status:'started',transcript:[],voice_mode:true}).select().single();
      if(r.error)throw new Error(r.error.message||'Не удалось создать сессию');
      state.session={...r.data,scenario};
      state.messages=[];
      state.view='coldcall';
      window.__stColdCallActive=true;
      callOpen=true;
      startedAt=Date.now();
      render();
      if(timer)clearInterval(timer);
      timer=setInterval(()=>{
        const x=$('st-cold-time');
        if(!x||!callOpen){clearInterval(timer);timer=null;return}
        const sec=Math.floor((Date.now()-startedAt)/1000);
        x.textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
      },1000);
      if(coldCall?.advanced){
        await startAdvancedLiveConversation();
      }else{
        setStatus('Нажмите «Начать говорить» один раз. После этого разговор пойдёт автоматически.');
      }
    }catch(e){
      cleanup();
      console.error('[SaleTrening] launchColdCall',e);
      if(typeof toast==='function')toast('Ошибка запуска голосовой тренировки: '+e.message);
    }
  }
  window.launchColdCall=launchColdCall;
})();
