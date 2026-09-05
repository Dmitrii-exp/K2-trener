(() => {
  'use strict';
  if (window.__stProxyVoiceV5) return;
  window.__stProxyVoiceV5 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let stream = null, recorder = null, chunks = [], analyser = null, analyserSource = null, vadTimer = null;
  let audio = null, audioCtx = null, recording = false, processing = false, callOpen = false;
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

  function cleanup(){
    callOpen=false;
    if(timer){clearInterval(timer);timer=null;}
    stopMic();
    closeAudio();
    processing=false;
    window.__stColdCallActive=false;
    delete window.__stColdCallScenarioOverride;
  }

  function css(){
    if($('st-cold-page-style'))return;
    const s=document.createElement('style');s.id='st-cold-page-style';
    s.textContent=`
      .st-cold-page{max-width:1120px;margin:0 auto;padding-bottom:30px}
      .st-cold-head{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:18px}
      .st-cold-head h2{margin:0;font-size:30px;font-weight:850;letter-spacing:-.7px}
      .st-cold-sub{margin-top:5px;color:var(--muted)}
      .st-cold-card{background:#15131f;color:#fff;border-radius:22px;overflow:hidden;box-shadow:0 16px 45px rgba(25,20,55,.12)}
      .st-cold-top{padding:24px 26px;background:linear-gradient(180deg,#27213e,#171522);text-align:center}
      .st-cold-avatar{width:72px;height:72px;border-radius:50%;margin:2px auto 9px;display:grid;place-items:center;background:linear-gradient(135deg,#7357ff,#9b86ff);font-size:31px}
      .st-cold-name{font-size:21px;font-weight:850}.st-cold-meta{margin-top:5px;color:#aaa3bd;font-size:12px}.st-cold-time{margin-top:9px;color:#d8d2ff;font-variant-numeric:tabular-nums}
      .st-cold-live{margin:16px;background:#211d32;border:1px solid #39324f;border-radius:16px;padding:14px}.st-cold-live-label{font-size:10px;color:#aaa3bd;text-transform:uppercase;letter-spacing:.1em}.st-cold-live-text{margin-top:5px;font-size:16px;line-height:1.45}
      .st-cold-main{padding:0 16px 16px}.st-cold-transcript{background:#0f0e17;border-radius:17px;padding:12px;min-height:260px;max-height:48vh;overflow:auto}.st-cold-msg{display:flex;margin:8px 2px}.st-cold-msg.manager{justify-content:flex-end}.st-cold-msg.client{justify-content:flex-start}.st-cold-bubble{max-width:82%;padding:10px 13px;border-radius:15px;line-height:1.45;font-size:14px}.st-cold-msg.client .st-cold-bubble{background:#27223b;border:1px solid #3a3352}.st-cold-msg.manager .st-cold-bubble{background:#7357ff;color:#fff}.st-cold-label{font-size:9px;opacity:.68;margin-bottom:3px;letter-spacing:.07em}
      .st-cold-compose{display:flex;gap:9px;margin-top:12px}.st-cold-compose textarea{flex:1;min-width:0;resize:none;border:1px solid #3b3550;background:#211d32;color:#fff;border-radius:13px;padding:12px;outline:none}.st-cold-send{border:0;border-radius:13px;padding:0 18px;background:#7357ff;color:#fff;font-weight:800}.st-cold-controls{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-top:10px}.st-cold-mic,.st-cold-end{border:0;border-radius:13px;padding:12px 20px;color:#fff;font-weight:800}.st-cold-mic{background:#7357ff;min-width:190px}.st-cold-mic.recording{background:#d84d5b}.st-cold-end{background:#302b43}.st-cold-hint{text-align:center;color:#9d97b0;font-size:11px;margin-top:9px}.st-cold-back{border:1px solid var(--line);border-radius:12px;padding:10px 15px;background:#fff;color:var(--text);font-weight:650}
      @media(max-width:760px){.st-cold-head{align-items:flex-start;flex-direction:column}.st-cold-head h2{font-size:25px}.st-cold-compose{flex-wrap:wrap}.st-cold-send{height:45px;flex:1}.st-cold-transcript{max-height:none;min-height:280px}}
    `;document.head.appendChild(s);
  }

  function bubble(speaker,text){return `<div class="st-cold-msg ${speaker}"><div class="st-cold-bubble"><div class="st-cold-label">${speaker==='manager'?'МЕНЕДЖЕР':'AI-КЛИЕНТ'}</div>${esc(text)}</div></div>`;}

  function render(){
    const p=$('page');if(!p||!state.session)return;css();
    const scenario=state.session.scenario||{};const difficulty=coldCall?.difficulty||scenario.difficulty||'Средний';
    p.innerHTML=`<div class="st-cold-page"><div class="st-cold-head"><div><h2>Холодный звонок</h2><div class="st-cold-sub">Живой диалог с AI-клиентом · ${esc(difficulty)}</div></div><button id="st-cold-back" class="st-cold-back">← Назад</button></div><div class="st-cold-card"><div class="st-cold-top"><div class="st-cold-avatar">👤</div><div class="st-cold-name">Потенциальный клиент</div><div class="st-cold-meta">Холодный звонок · ${esc(difficulty)}</div><div class="st-cold-time" id="st-cold-time">00:00</div></div><div class="st-cold-live"><div class="st-cold-live-label">Статус</div><div id="st-cold-live" class="st-cold-live-text">Вы говорите первым. Начинайте разговор.</div></div><div class="st-cold-main"><div id="st-cold-transcript" class="st-cold-transcript">${(state.messages||[]).map(m=>bubble(m.speaker,m.content)).join('')}</div><div class="st-cold-compose"><textarea id="st-cold-input" rows="2" placeholder="Напишите ответ менеджера…"></textarea><button id="st-cold-send" class="st-cold-send">Отправить</button></div><div class="st-cold-controls"><button id="st-cold-mic" class="st-cold-mic">🎙 Начать говорить</button><button id="st-cold-end" class="st-cold-end">Завершить разговор</button></div><div class="st-cold-hint">Говорите первым → пауза → AI-клиент отвечает голосом → продолжайте разговор. Текст всего разговора сохраняется ниже.</div></div></div></div>`;
    $('st-cold-back').onclick=()=>{if(!processing){cleanup();state.session=null;state.messages=[];state.view='coldcall';render()}};
    $('st-cold-end').onclick=finish;$('st-cold-send').onclick=typedTurn;$('st-cold-input').onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')typedTurn()};$('st-cold-mic').onclick=()=>recording?stopRecording():startRecording();updateUI();scrollTranscript();
  }

  function scrollTranscript(){const x=$('st-cold-transcript');if(x)x.scrollTop=x.scrollHeight;}
  function setStatus(text){const x=$('st-cold-live');if(x)x.textContent=text;}
  function updateUI(){const b=$('st-cold-mic');if(!b)return;if(recording){b.textContent='⏹ Остановить запись';b.classList.add('recording');b.disabled=false}else if(processing){b.textContent='⏳ AI отвечает…';b.classList.remove('recording');b.disabled=true}else{b.textContent='🎙 Начать говорить';b.classList.remove('recording');b.disabled=false}}
  function addMessage(speaker,text){state.messages=Array.isArray(state.messages)?state.messages:[];state.messages.push({speaker,content:text});const x=$('st-cold-transcript');if(x){x.insertAdjacentHTML('beforeend',bubble(speaker,text));x.scrollTop=x.scrollHeight}}
  async function save(){if(typeof saveSession==='function')await saveSession();}
  function pickMime(){for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']){try{if(MediaRecorder.isTypeSupported?.(m))return m}catch{}}return '';}
  async function ensureStream(){if(stream?.active)return;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Браузер не поддерживает микрофон');stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(window.AudioContext||window.webkitAudioContext){audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();await audioCtx.resume().catch(()=>{})}}

  function startVAD(){
    if(!stream||!audioCtx)return;try{analyser=audioCtx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.2;analyserSource=audioCtx.createMediaStreamSource(stream);analyserSource.connect(analyser);const data=new Uint8Array(analyser.fftSize),begin=Date.now();let lastSpeech=0,above=0;const tick=()=>{if(!recording||!recorder||recorder.state==='inactive'){try{analyserSource?.disconnect()}catch{}return}analyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v}const rms=Math.sqrt(sum/data.length),now=Date.now();if(rms>.018){above++;if(above>=2){speechDetected=true;lastSpeech=now}}else above=0;if(speechDetected&&now-lastSpeech>1050){stopRecording();return}if(!speechDetected&&now-begin>30000){stopRecording();return}if(speechDetected&&now-begin>45000){stopRecording();return}vadTimer=setTimeout(tick,100)};tick()}catch(e){console.warn('[SaleTrening] VAD unavailable',e)}}
  function stopRecording(){if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch(e){console.warn(e)}}else recording=false;}
  async function recognize(blob,mime){const fd=new FormData(),typ=String(mime||blob.type),ext=typ.includes('mp4')?'m4a':typ.includes('ogg')?'ogg':'webm';fd.append('file',blob,`manager.${ext}`);fd.append('prompt','Разговор менеджера по продажам с потенциальным клиентом. Русская речь, цены, бренды, модели, размеры шин и профессиональные термины.');const r=await fetch(`${PROJECT}/proxy-stt`,{method:'POST',headers:await authHeaders(),body:fd});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||`STT HTTP ${r.status}`);return String(j.text||'').trim()}
  async function speak(text){const r=await fetch(`${PROJECT}/proxy-tts`,{method:'POST',headers:await authHeaders(true),body:JSON.stringify({input:String(text),voice:document.getElementById('coldVoice')?.value||coldCall?.voice||'coral',instructions:'Говори естественно по-русски как живой потенциальный клиент в телефонном разговоре. Разговорная интонация, естественные паузы и эмоции. Не читай как диктор.'})});if(!r.ok)throw new Error(`TTS HTTP ${r.status}`);const blob=await r.blob();if(!blob.size)throw new Error('TTS вернул пустой аудиофайл');const url=URL.createObjectURL(blob);try{audio=new Audio(url);audio.preload='auto';await audio.play();await new Promise(resolve=>{audio.onended=resolve})}finally{URL.revokeObjectURL(url);audio=null}}
  async function processSpeech(blob,mime){recording=false;if(vadTimer){clearTimeout(vadTimer);vadTimer=null}try{analyserSource?.disconnect()}catch{}analyserSource=null;analyser=null;recorder=null;if(!blob?.size||!speechDetected){setStatus('Речь не обнаружена. Попробуйте ещё раз.');updateUI();return}processing=true;updateUI();setStatus('Распознаю речь менеджера…');try{const text=await recognize(blob,mime);if(!text)throw new Error('Речь не распознана');await turn(text)}catch(e){console.error('[SaleTrening] STT turn',e);setStatus('Ошибка STT: '+e.message);if(typeof toast==='function')toast('Ошибка STT: '+e.message)}finally{processing=false;updateUI();if(callOpen&&state.session)setStatus('Ваш ход — говорите или ответьте текстом.')}}
  async function startRecording(){if(!callOpen||processing||recording)return;try{await ensureStream();chunks=[];speechDetected=false;const m=pickMime();recorder=m?new MediaRecorder(stream,{mimeType:m}):new MediaRecorder(stream);const actual=recorder.mimeType||m||'audio/webm';recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onstop=async()=>{const blob=new Blob(chunks,{type:actual});chunks=[];await processSpeech(blob,actual)};recorder.onerror=e=>console.error('[SaleTrening] MediaRecorder',e);recorder.start(250);recording=true;updateUI();setStatus('Слушаю вас… Говорите первым. После паузы я передам фразу AI-клиенту.');startVAD()}catch(e){recording=false;setStatus('Ошибка микрофона: '+e.message);updateUI();if(typeof toast==='function')toast('Ошибка микрофона: '+e.message)}}
  async function typedTurn(){if(processing||!callOpen)return;const input=$('st-cold-input');const text=input?.value.trim();if(!text)return;input.value='';await turn(text)}
  async function turn(text){if(processing||!callOpen||!state.session)return;processing=true;updateUI();addMessage('manager',text);setStatus('AI-клиент формирует ответ…');await save();try{const reply=await aiClientReply(text,false);if(!reply)throw new Error('AI не вернул реплику клиента');addMessage('client',reply);await save();setStatus('AI-клиент отвечает голосом…');try{await speak(reply)}catch(e){console.error('[SaleTrening] TTS',e);if(typeof toast==='function')toast('Ошибка TTS: '+e.message)}setStatus('Ваш ход — говорите или ответьте текстом.')}catch(e){console.error('[SaleTrening] AI client',e);setStatus('Ошибка AI-клиента: '+e.message);if(typeof toast==='function')toast('Ошибка AI-клиента: '+e.message)}finally{processing=false;updateUI()}}
  function finish(){if(processing){if(typeof toast==='function')toast('Дождитесь ответа AI-клиента');return}const f=window.finishTraining;cleanup();if(typeof f==='function')f();}
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
      state.session={...r.data,scenario};state.messages=[];state.view='coldcall';window.__stColdCallActive=true;callOpen=true;startedAt=Date.now();render();
      if(timer)clearInterval(timer);timer=setInterval(()=>{const x=$('st-cold-time');if(!x||!callOpen){clearInterval(timer);timer=null;return}const sec=Math.floor((Date.now()-startedAt)/1000);x.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`},1000);
    }catch(e){cleanup();console.error('[SaleTrening] launchColdCall',e);if(typeof toast==='function')toast('Ошибка запуска голосовой тренировки: '+e.message)}
  }
  window.launchColdCall=launchColdCall;
})();
