(() => {
  'use strict';
  if (window.__stProxyVoiceV5) return;
  window.__stProxyVoiceV5 = true;

  const PROJECT = 'https://svxykakyrloqzloerygb.supabase.co/functions/v1';
  let stream = null, recorder = null, chunks = [], analyser = null, analyserSource = null, vadTimer = null;
  let audio = null, audioCtx = null, recording = false, processing = false, callOpen = false, continuousMode = false;
  // GPT-Live voices documented by OpenAI. Gender labels are explicit in the UI;
  // keep the technical API names here so the selected voice is passed unchanged.
  const LIVE_VOICES = ['meridian','stone','ripple','vesper','cinder','beacon','willow','quartz','gleam','delta'];
  const LIVE_VOICE = 'meridian';
  let livePc = null, liveDc = null, liveAudio = null, liveSessionId = null;
  let launching = false;
  let liveManagerRecorder = null, liveClientRecorder = null;
  let liveManagerChunks = [], liveClientChunks = [];
  let liveManagerMime = "", liveClientMime = "";
  let liveManagerStopPromise = null, liveClientStopPromise = null;
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

  function startLiveRecorder(which, mediaStream){
    if(!mediaStream?.getTracks?.().length)return;
    try{
      const mime=pickMime();
      const rec=mime?new MediaRecorder(mediaStream,{mimeType:mime}):new MediaRecorder(mediaStream);
      const actual=rec.mimeType||mime||'audio/webm';
      const chunks=[];
      const promise=new Promise(resolve=>{
        rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
        rec.onstop=()=>resolve({blob:new Blob(chunks,{type:actual}),mime:actual});
        rec.onerror=e=>{console.warn('[SaleTrening] GPT-Live recorder',which,e);resolve({blob:null,mime:actual})};
      });
      rec.start(500);
      if(which==='manager'){liveManagerRecorder=rec;liveManagerChunks=chunks;liveManagerMime=actual;liveManagerStopPromise=promise}
      else {liveClientRecorder=rec;liveClientChunks=chunks;liveClientMime=actual;liveClientStopPromise=promise}
    }catch(e){console.warn('[SaleTrening] GPT-Live recorder start',which,e)}
  }

  async function stopLiveRecorders(){
    const stop=(rec,promise)=>{try{if(rec&&rec.state!=='inactive')rec.stop()}catch{}return promise||Promise.resolve({blob:null,mime:''})};
    const [manager,client]=await Promise.all([
      stop(liveManagerRecorder,liveManagerStopPromise),
      stop(liveClientRecorder,liveClientStopPromise)
    ]);
    liveManagerRecorder=null;liveClientRecorder=null;
    liveManagerChunks=[];liveClientChunks=[];
    liveManagerStopPromise=null;liveClientStopPromise=null;
    return {manager,client};
  }

  async function recoverLiveTranscriptFromAudio(){
    const missingManager=!state.messages?.some(m=>m.speaker==='manager'&&String(m.content||'').trim());
    const missingClient=!state.messages?.some(m=>m.speaker==='client'&&String(m.content||'').trim());
    if(!missingManager&&!missingClient)return;
    const recordings=await stopLiveRecorders();
    setStatus('Восстанавливаю расшифровку разговора…');
    const jobs=[];
    if(missingManager&&recordings.manager?.blob?.size){
      jobs.push(recognize(recordings.manager.blob,recordings.manager.mime||liveManagerMime)
        .then(text=>({speaker:'manager',text})).catch(e=>({speaker:'manager',error:e})));
    }
    if(missingClient&&recordings.client?.blob?.size){
      jobs.push(recognize(recordings.client.blob,recordings.client.mime||liveClientMime)
        .then(text=>({speaker:'client',text})).catch(e=>({speaker:'client',error:e})));
    }
    const results=await Promise.all(jobs);
    for(const r of results){
      if(r?.text) addMessage(r.speaker,r.text);
      else if(r?.error) console.warn('[SaleTrening] GPT-Live fallback STT',r.speaker,r.error);
    }
  }

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
    stopLiveRecorders().catch(e=>console.warn("[SaleTrening] recorder cleanup",e));
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
      .st-cold-page{width:100%;min-width:0;margin:0 auto;padding:0 0 24px;display:flex;flex-direction:column;align-items:center}
      .st-cold-head{width:min(100%,900px);display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 12px}
      .st-cold-head h2{margin:0;font-size:21px;font-weight:850;letter-spacing:-.5px}.st-cold-sub{margin-top:3px;color:var(--muted);font-size:12px}
      .st-cold-back{border:1px solid var(--line);border-radius:12px;padding:9px 14px;background:#fff;color:var(--text);font-weight:700;min-height:40px;cursor:pointer}
      .st-cold-card{position:relative;width:390px;max-width:100%;height:min(760px,calc(100dvh - 125px));min-height:620px;padding:7px;box-sizing:border-box;background:#111018;border-radius:48px;overflow:hidden;box-shadow:0 28px 70px rgba(22,18,38,.28),0 0 0 1px rgba(20,18,29,.5)}
      .st-cold-card:before{content:"";position:absolute;inset:3px;border-radius:45px;border:1px solid rgba(255,255,255,.16);pointer-events:none;z-index:5}
      .st-cold-card:after{content:"";position:absolute;z-index:7;top:15px;left:50%;transform:translateX(-50%);width:104px;height:27px;border-radius:18px;background:#08070c;pointer-events:none}
      .st-cold-top{height:100%;position:relative;border-radius:41px;overflow:hidden;display:flex;flex-direction:column;color:#fff;background:radial-gradient(circle at 50% 20%,rgba(132,105,255,.35),transparent 30%),linear-gradient(165deg,#29243c 0%,#171522 45%,#0f0e16 100%)}
      .st-cold-top:before{content:"SaleTrening";height:48px;padding:18px 20px 0;box-sizing:border-box;color:rgba(255,255,255,.58);font-size:10px;font-weight:800;letter-spacing:.04em}
      .st-cold-contact{display:flex;flex-direction:column;align-items:center;text-align:center;padding:38px 24px 10px}
      .st-cold-avatar{width:94px;height:94px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#8f79ff,#6349e8);box-shadow:0 16px 38px rgba(111,85,232,.3);font-size:38px;color:#fff}
      .st-cold-name{margin-top:18px;font-size:25px;font-weight:800;letter-spacing:-.5px}.st-cold-meta{margin-top:6px;color:rgba(255,255,255,.6);font-size:13px}
      .st-cold-time{margin-top:8px;color:#fff;font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
      .st-cold-live{margin:14px 20px 0;padding:12px 14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);border-radius:16px;text-align:center}
      .st-cold-live-label{display:none}.st-cold-live-text{font-size:11px;line-height:1.4;color:rgba(255,255,255,.64)}
      .st-cold-main{flex:1;min-height:0;display:flex;flex-direction:column}
      .st-cold-transcript{flex:1;min-height:0;overflow:auto;padding:14px 18px 4px;scrollbar-width:thin;mask-image:linear-gradient(to bottom,transparent 0,#000 20px,#000 100%)}
      .st-cold-msg{display:flex;margin:7px 0}.st-cold-msg.manager{justify-content:flex-end}.st-cold-msg.client{justify-content:flex-start}
      .st-cold-bubble{max-width:82%;padding:9px 11px;border-radius:15px;line-height:1.4;font-size:11px}.st-cold-msg.client .st-cold-bubble{background:rgba(255,255,255,.09);color:#f6f4ff;border-bottom-left-radius:5px}.st-cold-msg.manager .st-cold-bubble{background:#7357ff;color:#fff;border-bottom-right-radius:5px}.st-cold-label{font-size:8px;opacity:.55;margin-bottom:3px;letter-spacing:.05em}
      .st-cold-empty{text-align:center;color:rgba(255,255,255,.42);font-size:12px;line-height:1.5;padding:26px 18px}
      .st-cold-compose{display:flex;gap:7px;margin:0 18px 8px;padding:5px 5px 5px 12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.07);border-radius:18px}
      .st-cold-compose textarea{flex:1;min-width:0;min-height:34px;max-height:68px;resize:none;border:0;background:transparent;color:#fff;padding:8px 2px;outline:none;font-size:11px}.st-cold-compose textarea::placeholder{color:rgba(255,255,255,.38)}
      .st-cold-send{border:0;border-radius:13px;width:36px;height:36px;padding:0;background:#7357ff;color:#fff;font-weight:900;cursor:pointer}
      .st-cold-controls{display:flex;align-items:flex-end;justify-content:center;gap:28px;padding:4px 20px 16px}
      .st-cold-control-wrap{display:flex;flex-direction:column;align-items:center;gap:7px;color:rgba(255,255,255,.7);font-size:9px}
      .st-cold-round{width:54px;height:54px;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.12);cursor:pointer}
      .st-cold-round svg{width:23px;height:23px}.st-cold-end{width:62px;height:62px;border:0;border-radius:50%;display:grid;place-items:center;background:#e4515d;color:#fff;cursor:pointer;box-shadow:0 10px 24px rgba(228,81,93,.24)}.st-cold-end svg{width:27px;height:27px;transform:rotate(135deg)}
      .st-cold-mic{width:54px;height:54px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);color:#fff;cursor:pointer}.st-cold-mic svg{width:23px;height:23px}.st-cold-mic.recording{background:#7357ff}.st-cold-mic:disabled{opacity:1;cursor:default}
      .st-cold-hint{display:none}.st-cold-home{width:108px;height:4px;border-radius:5px;background:rgba(255,255,255,.72);margin:0 auto 7px}
      @media(max-width:760px){.st-cold-page{padding:0}.st-cold-head{display:none}.st-cold-card{width:min(100%,410px);height:calc(100dvh - 20px);min-height:590px;border-radius:42px}.st-cold-top{border-radius:36px}.st-cold-card:before{border-radius:39px}.st-cold-contact{padding-top:42px}.st-cold-avatar{width:88px;height:88px}.st-cold-name{font-size:23px}.st-cold-controls{padding-bottom:12px}}
      @media(max-height:700px){.st-cold-contact{padding-top:24px}.st-cold-avatar{width:72px;height:72px;font-size:30px}.st-cold-name{margin-top:12px;font-size:21px}.st-cold-live{margin-top:8px}.st-cold-controls{padding-bottom:9px}}
    `;document.head.appendChild(s);
  }
  function bubble(speaker,text){return `<div class="st-cold-msg ${speaker}"><div class="st-cold-bubble"><div class="st-cold-label">${speaker==='manager'?'МЕНЕДЖЕР':'AI-КЛИЕНТ'}</div>${esc(text)}</div></div>`;}

  function render(){
    const p=$('page');if(!p||!state.session)return;css();
    const scenario=state.session.scenario||{};const difficulty=coldCall?.difficulty||scenario.difficulty||'Средний';
    const micIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const phoneIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4c1-1 2-1 3 0l2 3c.5 1 .3 2-.5 2.7l-1.4 1.1c1.1 2.2 2.9 4 5.1 5.1l1.1-1.4c.7-.8 1.7-1 2.7-.5l3 2c1 .7 1 2 .2 2.9l-1.4 1.4c-1.2 1.2-3 1.5-4.6.9C9.7 18.8 5.2 14.3 2.8 7.8 2.2 6.2 2.5 4.4 3.7 3.2z" fill="currentColor"/></svg>';
    const speakerIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4z" fill="currentColor"/><path d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    p.innerHTML=`<div class="st-cold-page"><div class="st-cold-head"><div><h2>Холодный звонок</h2><div class="st-cold-sub">Живой разговор с AI-клиентом · ${esc(difficulty)}</div></div><button id="st-cold-back" class="st-cold-back">← Назад</button></div><div class="st-cold-card"><div class="st-cold-top"><div class="st-cold-contact"><div class="st-cold-avatar">👤</div><div class="st-cold-name">Потенциальный клиент</div><div class="st-cold-meta">AI-клиент · ${esc(difficulty)}</div><div class="st-cold-time" id="st-cold-time">00:00</div></div><div class="st-cold-live"><div class="st-cold-live-label">Статус</div><div id="st-cold-live" class="st-cold-live-text">Соединение установлено. Вы говорите первым.</div></div><div class="st-cold-main"><div id="st-cold-transcript" class="st-cold-transcript">${(state.messages||[]).map(m=>bubble(m.speaker,m.content)).join("")||'<div class="st-cold-empty">Вы говорите первым.<br>Начните разговор с клиентом.</div>'}</div><div class="st-cold-compose"><textarea id="st-cold-input" rows="1" placeholder="Ответить текстом…"></textarea><button id="st-cold-send" class="st-cold-send" title="Отправить" aria-label="Отправить">↑</button></div></div><div class="st-cold-controls"><div class="st-cold-control-wrap"><button id="st-cold-mic" class="st-cold-mic" aria-label="Микрофон">${micIcon}</button><span>Микрофон</span></div><div class="st-cold-control-wrap"><button id="st-cold-end" class="st-cold-end" aria-label="Завершить звонок">${phoneIcon}</button><span>Завершить</span></div><div class="st-cold-control-wrap"><button type="button" class="st-cold-round" aria-label="Динамик">${speakerIcon}</button><span>Динамик</span></div></div><div class="st-cold-hint">${coldCall?.advanced?"Продвинутый звонок активен":"Разговор сохраняется автоматически"}</div><div class="st-cold-home"></div></div></div></div>`;
    $('st-cold-back').onclick=()=>{if(!processing){cleanup();state.session=null;state.messages=[];state.view='coldcall';window.render()}};
    $('st-cold-end').onclick=finish;$('st-cold-mic').onclick=()=>{if(coldCall?.advanced){if(!livePc)startAdvancedLiveConversation()}else if(!continuousMode)startContinuousConversation()};$('st-cold-send').onclick=typedTurn;$('st-cold-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();typedTurn()}};updateUI();scrollTranscript();
  }
  function scrollTranscript(){const x=$('st-cold-transcript');if(x)x.scrollTop=x.scrollHeight;}
  function setStatus(text){const x=$('st-cold-live');if(x)x.textContent=text;}
  function updateUI(){
    const b=$('st-cold-mic');if(!b)return;
    b.classList.toggle('recording',recording||continuousMode||(coldCall?.advanced&&!!livePc));
    b.disabled=!!(recording||processing||continuousMode||(coldCall?.advanced&&livePc));
    b.setAttribute('aria-label',processing?'ИИ отвечает':(recording||continuousMode||livePc?'Разговор активен':'Начать говорить'));
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
      pc.ontrack=e=>{
        const track=e.streams?.[0];
        if(track){
          liveAudio.srcObject=track;
          liveAudio.play().catch(()=>{});
          if(!liveClientRecorder)startLiveRecorder('client',e.streams[0]);
        }
      };
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      mic.getTracks().forEach(t=>pc.addTrack(t,mic)); stream=mic;
      startLiveRecorder('manager',mic);
      const character=coldCall?.character||'Лояльный';
      const facts=coldCall?.facts||'';
      const difficulty=coldCall?.difficulty||'Средний';
      const objections=(state.clientObjections||state.client_settings?.objections||state.session?.objections||[]).slice(0,12);
      const scenario=state.session?.scenario||{};
      const instructions=[
        'Ты ВСЕГДА только потенциальный КЛИЕНТ в тренировочном холодном B2B-звонке. Никогда не становись продавцом, менеджером, поставщиком, консультантом или оператором.',
        'Менеджер — единственная сторона, которая ведёт продажу: он начинает разговор, задаёт вопросы, выявляет потребность, предлагает товар и условия и ведёт к сделке. Ты не должен брать инициативу по продаже на себя.',
        'Если менеджер здоровается или представляется (например: «Здравствуйте, я Лёша»), ответь как клиент коротко и естественно: например «Здравствуйте» или «Добрый день». Не представляйся продавцом и не отвечай «Что хотели?» без необходимости. Дай менеджеру самому вовлечь тебя в разговор.',
        'Не начинай тему продажи сам. Не предлагай товар, цену, скидку, доставку или условия сделки без того, чтобы менеджер вывел разговор к этому.',
        'Не придумывай за менеджера его вопросы, предложения, действия или аргументы. Реагируй только на то, что реально сказал менеджер.',
        'Встречные вопросы задавай только когда это естественно необходимо для ответа или когда менеджер уже вовлёк тебя в предметное обсуждение. Не используй вопросы, чтобы самому вести разговор.',
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
        'Отвечай обычно 1–3 короткими фразами. Иногда задавай встречный вопрос или выражай сомнение.',
        'ВАЖНО: «сбросьте на почту» — это не автоматическое завершение звонка, а только одно из возможных возражений или способов продолжить контакт. Если менеджер грамотно отрабатывает эту реплику, не повторяй её механически.',
        'Если менеджер хорошо выявил потребность, снял сомнения и создал ценность, постепенно переходи к предметному обсуждению: конкретный товар, количество, цена, наличие, поставка, оплата и условия сделки.',
        'Если предложение менеджера тебя устраивает, можешь прямо сказать, что готов двигаться дальше: попросить счёт, уточнить реквизиты/условия оплаты, подтвердить количество и сказать, что ставите заказ в оплату. Например: «Хорошо, мне подходит. Сбрасывайте счёт, ставим в оплату».',
        'Не создавай новое искусственное возражение после того, как ключевое возражение уже качественно снято. Если менеджер действительно убедил тебя, меняй позицию клиента в сторону покупки.',
        'При хорошем разговоре допускай реальное закрытие сделки в этом же звонке. Цель клиента — принять решение на основании диалога, а не любой ценой закончить разговор отправкой письма.'
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
    for(const [key,timerId] of liveOutputTimers.entries()){
      if(String(key).startsWith('in:')){
        if(timerId)clearTimeout(timerId);
        liveOutputTimers.delete(key);
      }
    }
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
    // Do not trim individual GPT-Live deltas: leading/trailing spaces are
    // meaningful because a delta can begin/end in the middle of a sentence.
    // Trimming every delta was causing words to be glued together in the UI.
    const part=String(text??''); if(!part)return;
    const key=itemId||'output-'+Date.now();
    liveOutputBuffers.set(key,(liveOutputBuffers.get(key)||'')+part);
    const old=liveOutputTimers.get(key); if(old)clearTimeout(old);
    liveOutputTimers.set(key,setTimeout(async()=>{
      const final=String(liveOutputBuffers.get(key)||'').replace(/\\s+/g,' ').trim();
      if(final){
        addMessage('client',final);
        try{await save()}catch(e){console.warn('[SaleTrening] GPT-Live save client',e)}
      }
      liveOutputBuffers.delete(key);liveOutputTimers.delete(key);
    },900));
  }

  function handleLiveEvent(raw){
    let e;try{e=typeof raw==='string'?JSON.parse(raw):raw}catch{return}
    const type=String(e?.type||'');
    if(type==='session.started'||type==='session.updated'){setStatus('Продвинутый звонок активен. Говорите.');return}
    if(type==='session.input_transcript.delta'||type==='conversation.item.input_audio_transcription.delta'||type==='input_transcript.delta'){
      const id=e.item_id||e.segment_id||'input';
      liveInputBuffers.set(id,(liveInputBuffers.get(id)||'')+String(e.delta||e.text||''));
      clearTimeout(liveOutputTimers.get('in:'+id));
      liveOutputTimers.set('in:'+id,setTimeout(async()=>{
        const text=String(liveInputBuffers.get(id)||'').trim();
        if(text){addMessage('manager',text);liveInputBuffers.delete(id);try{await save()}catch(err){console.warn('[SaleTrening] GPT-Live save manager',err)}setStatus('Клиент отвечает…')}
        liveOutputTimers.delete('in:'+id);
      },500));
      return;
    }
    if(type==='session.input_transcript.completed'||type==='conversation.item.input_audio_transcription.completed'||type==='input_transcript.completed'||type==='input_transcript.done'){
      const id=e.item_id||e.segment_id||'input';
      const text=String(e.transcript||e.text||liveInputBuffers.get(id)||'').trim();
      if(text){
        liveInputBuffers.delete(id);
        addMessage('manager',text);
        save().catch(err=>console.warn('[SaleTrening] GPT-Live save manager',err));
        setStatus('Клиент отвечает…');
      }
      return;
    }
    if(type==='session.output_transcript.delta'||type==='response.output_audio_transcript.delta'||type==='output_transcript.delta'||type==='response.output_text.delta'){
      addLiveOutput(e.item_id||e.response_id||e.segment_id||'output',String(e.delta||e.text||''));
      return;
    }
    if(type==='session.output_transcript.completed'||type==='response.output_audio_transcript.done'||type==='output_transcript.done'){
      const id=e.item_id||e.response_id||e.segment_id||'output';
      const text=String(e.transcript||e.text||'').trim();
      if(text)addLiveOutput(id,text);
      return;
    }
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

  function addMessage(speaker,text){
    state.messages=Array.isArray(state.messages)?state.messages:[];
    const value=String(text??'').replace(/\\s+/g,' ').trim();
    if(!value)return;
    const last=state.messages[state.messages.length-1];
    // GPT-Live may emit several transcript chunks for one speaker. Merge
    // consecutive chunks into one bubble so the dialogue stays readable.
    if(last?.speaker===speaker){
      const separator=/[\\s([«„—-]$/.test(String(last.content||''))||/^[,.;:!?…»”'")\\]]/.test(value)?'':' ';
      last.content=String(last.content||'').trimEnd()+separator+value;
      return;
    }
    state.messages.push({speaker,content:value});
  }
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
  async function turn(text){if(processing||!callOpen||!state.session)return;processing=true;updateUI();addMessage('manager',text);setStatus('AI-клиент формирует ответ…');try{await save();const reply=await aiClientReply(text,false);if(!reply)throw new Error('AI не вернул реплику клиента');addMessage('client',reply);await save();setStatus('AI-клиент отвечает голосом…');try{await speak(reply)}catch(e){console.error('[SaleTrening] TTS',e);if(typeof toast==='function')toast('Ошибка TTS: '+e.message)}setStatus('Ваш ход — говорите или ответьте текстом.')}catch(e){console.error('[SaleTrening] AI client',e);setStatus('Ошибка AI-клиента: '+e.message);if(typeof toast==='function')toast('Ошибка AI-клиента: '+e.message)}finally{processing=false;updateUI()}}
  async function finish(){
    if(processing){if(typeof toast==='function')toast('Дождитесь ответа AI-клиента');return}
    if(!state.session)return;
    processing=true;
    updateUI();
    try{
      if(livePc||liveDc){
        await new Promise(resolve=>setTimeout(resolve,350));
        // Give GPT-Live transcript deltas a short window, then use the recorded
        // WebRTC directions as a reliable fallback if one/both speaker captions are missing.
        flushLiveTranscriptBuffers();
        await recoverLiveTranscriptFromAudio();
        await save();
        await closeLive();
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
    if(launching||callOpen)return;
    launching=true;
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
    }finally{launching=false}
  }
  window.launchColdCall=launchColdCall;
})();
