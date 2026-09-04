/* SaleTrening — Text Training UI V7 */
(function(){
  'use strict';
  if(window.__stTextTrainingV7)return;
  window.__stTextTrainingV7=true;

  var busy=false;
  var modal=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function toast(msg){var el=document.getElementById('toast');if(el){el.textContent=String(msg);el.classList.remove('hidden');clearTimeout(window.__stTextToast);window.__stTextToast=setTimeout(function(){el.classList.add('hidden')},4500)}console.log('[SaleTrening]',msg)}
  function wait(p,ms){var t;return Promise.race([p,new Promise(function(_,reject){t=setTimeout(function(){reject(new Error('Операция не завершилась за '+Math.round(ms/1000)+' сек.'))},ms)})]).finally(function(){clearTimeout(t)})}

  function styles(){
    if(document.getElementById('st-text-v7-style'))return;
    var s=document.createElement('style');s.id='st-text-v7-style';
    s.textContent=`
      #st-text-v7{position:fixed;inset:0;z-index:99999;background:rgba(18,15,31,.64);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:24px}
      .st-text-modal{width:min(960px,96vw);height:min(780px,92vh);background:#fff;border:1px solid #e4e1ed;border-radius:26px;box-shadow:0 35px 110px rgba(18,12,45,.3);display:grid;grid-template-rows:auto 1fr auto auto;overflow:hidden}
      .st-text-head{padding:22px 26px;border-bottom:1px solid #e8e7ef;display:flex;justify-content:space-between;gap:20px;align-items:flex-start;background:linear-gradient(135deg,#fff,#faf8ff)}
      .st-text-kicker{font-size:11px;font-weight:850;letter-spacing:.13em;color:#7357ff}.st-text-title{font-size:25px;font-weight:850;margin:5px 0 4px;letter-spacing:-.5px}.st-text-meta{font-size:13px;color:#85889a}
      .st-text-close{width:40px;height:40px;border:0;border-radius:12px;background:#f1eff6;color:#5d5a68;font-size:25px;cursor:pointer}.st-text-close:hover{background:#e9e5f2}
      .st-text-messages{padding:26px;overflow:auto;background:#faf9ff}.st-text-row{display:flex;margin:12px 0}.st-text-row.manager{justify-content:flex-end}.st-text-bubble{max-width:76%;padding:14px 17px;border-radius:18px;border:1px solid #e4e2eb;background:#fff;line-height:1.5;font-size:15px;box-shadow:0 3px 12px rgba(30,20,70,.025)}.st-text-row.manager .st-text-bubble{background:#eeeaff;border-color:#ddd5ff}.st-text-name{font-size:11px;font-weight:850;color:#7357ff;margin-bottom:5px}.st-text-empty{text-align:center;padding:70px 20px;color:#85889a}
      .st-text-status{padding:10px 26px;border-top:1px solid #e8e7ef;font-size:12px;color:#85889a;background:#fff}.st-text-status.busy{color:#7357ff;font-weight:700}
      .st-text-compose{display:flex;gap:10px;padding:13px 26px;background:#fff}.st-text-compose textarea{flex:1;min-height:54px;resize:none;border:1px solid #dddbe7;border-radius:14px;padding:13px;outline:none;font-size:15px}.st-text-compose textarea:focus{border-color:#7357ff;box-shadow:0 0 0 3px #7357ff18}.st-text-send{min-width:150px;border:0;border-radius:14px;background:linear-gradient(135deg,#7357ff,#6548ed);color:#fff;font-weight:800;padding:0 20px;cursor:pointer}.st-text-send:disabled{opacity:.55;cursor:wait}
      .st-text-finish{margin:0 26px 20px;border:1px solid #e1dfe8;background:#fff;border-radius:13px;padding:11px;font-weight:750;color:#171827;cursor:pointer}.st-text-finish:hover{background:#faf9ff}
      @media(max-width:700px){#st-text-v7{padding:8px}.st-text-modal{width:100%;height:96vh;border-radius:20px}.st-text-head{padding:18px}.st-text-messages{padding:16px}.st-text-bubble{max-width:90%}.st-text-compose{padding:10px 16px;flex-direction:column}.st-text-send{height:48px}.st-text-finish{margin:0 16px 14px}}
    `;document.head.appendChild(s);
  }

  function close(){if(modal){modal.remove();modal=null}busy=false}
  function render(){
    if(!modal||!state.session)return;
    var s=state.session.scenario||{};var msgs=Array.isArray(state.messages)?state.messages:[];
    modal.innerHTML='<div class="st-text-modal">'+
      '<div class="st-text-head"><div><div class="st-text-kicker">ТЕКСТОВАЯ ТРЕНИРОВКА</div><div class="st-text-title">'+esc(s.title||'Тренировка')+'</div><div class="st-text-meta">'+esc(s.client_role||'Клиент')+' · '+esc(s.difficulty||'Средняя')+'</div></div><button class="st-text-close" type="button" aria-label="Закрыть">×</button></div>'+
      '<div class="st-text-messages" id="st-text-messages">'+(msgs.length?msgs.map(function(m){var manager=m&&m.speaker==='manager';return '<div class="st-text-row '+(manager?'manager':'client')+'"><div class="st-text-bubble"><div class="st-text-name">'+(manager?'Вы / Менеджер':'Клиент')+'</div><div>'+esc(m&&m.content)+'</div></div></div>'}).join(''):'<div class="st-text-empty">Клиент готовит первую реплику…</div>')+'</div>'+
      '<div class="st-text-status '+(busy?'busy':'')+'">'+(busy?'ИИ формулирует ответ клиента…':'Ваш ход — ответьте клиенту')+'</div>'+
      '<div class="st-text-compose"><textarea id="st-text-input" rows="2" placeholder="Напишите ответ клиенту…" '+(busy?'disabled':'')+'></textarea><button id="st-text-send" class="st-text-send" '+(busy?'disabled':'')+'>Отправить</button></div>'+
      '<button id="st-text-finish" class="st-text-finish" type="button">Завершить тренировку</button></div>';
    var box=document.getElementById('st-text-messages');if(box)box.scrollTop=box.scrollHeight;
    var input=document.getElementById('st-text-input');
    if(input){input.focus();input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}})}
    document.getElementById('st-text-send').onclick=send;
    document.getElementById('st-text-finish').onclick=finish;
    modal.querySelector('.st-text-close').onclick=function(){toast('Тренировка остаётся активной');input&&input.focus()};
  }

  function open(){
    styles();close();modal=document.createElement('div');modal.id='st-text-v7';document.body.appendChild(modal);render();
  }

  async function send(){
    if(busy)return;var input=document.getElementById('st-text-input');var text=input&&input.value.trim();
    if(!text){toast('Напишите ответ клиенту');return}
    if(!state.session){toast('Активная тренировка не найдена');return}
    busy=true;state.messages=Array.isArray(state.messages)?state.messages:[];state.messages.push({speaker:'manager',content:text});render();
    try{
      if(typeof aiClientReply!=='function')throw new Error('Функция AI-клиента не найдена');
      var reply=await wait(aiClientReply(text,false),30000);
      if(!reply)throw new Error('AI не вернул реплику клиента');
      state.messages.push({speaker:'client',content:reply});
      if(typeof saveSession==='function')await wait(saveSession(),10000);
    }catch(e){
      console.error('[SaleTrening] text turn',e);
      toast('Не удалось получить ответ клиента: '+(e.message||e));
    }finally{busy=false;render()}
  }

  async function launch(id){
    try{
      if(typeof state==='undefined'||!state)throw new Error('Состояние приложения не загружено');
      if(typeof sb==='undefined'||!sb)throw new Error('Supabase не инициализирован');
      var scenario=state.scenarios&&state.scenarios.find(function(x){return String(x.id)===String(id)});
      if(!scenario)throw new Error('Сценарий не найден');
      if(!state.user||!state.user.id)throw new Error('Пользователь не авторизован');
      if(!state.profile||!state.profile.company_id)throw new Error('Профиль компании не загружен');
      var q=await wait(sb.from('saletrening_sessions').insert({employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:scenario.id,status:'started',transcript:[],voice_mode:false}).select().single(),15000);
      if(q.error)throw new Error(q.error.message||'Не удалось создать сессию');
      state.session=Object.assign({},q.data,{scenario:scenario});state.messages=[];state.view='training';busy=true;open();toast('Тренировка запущена');
      try{
        if(typeof aiClientReply!=='function')throw new Error('Функция AI-клиента не найдена');
        var opening=await wait(aiClientReply('',true),30000);
        if(opening)state.messages.push({speaker:'client',content:opening});
        if(typeof saveSession==='function')await wait(saveSession(),10000);
      }catch(e){toast('Сессия открыта. Первую реплику AI получить не удалось: '+(e.message||e));}
      busy=false;render();
    }catch(e){busy=false;console.error('[SaleTrening] launch',e);toast('Ошибка запуска тренировки: '+(e.message||e))}
  }

  async function finish(){
    if(busy){toast('Дождитесь ответа AI');return}
    if(!state.session){close();return}
    var fn=window.finishTraining;
    close();
    if(typeof fn==='function')await fn();
  }

  function extractId(el){
    var code=el.getAttribute('onclick')||'';var m=code.match(/startTraining\s*\(\s*([^\),]+)\s*\)/);if(m)return String(m[1]).trim().replace(/^['\"]|['\"]$/g,'');
    var card=el.closest('.scenario');if(card){var b=card.querySelector('button[onclick*="startTraining"]');if(b&&b!==el){var c=b.getAttribute('onclick')||'';var n=c.match(/startTraining\s*\(\s*([^\),]+)\s*\)/);if(n)return String(n[1]).trim().replace(/^['\"]|['\"]$/g,'')}}
    return null;
  }

  function intercept(){
    document.addEventListener('click',function(e){
      var el=e.target&&e.target.closest?e.target.closest('button,[role="button"],a'):null;if(!el)return;
      var id=extractId(el);var label=(el.textContent||'').trim();
      if(!id&&/Начать тренировку/.test(label))id=extractId(el.closest('.scenario')?.querySelector('button[onclick*="startTraining"]')||el);
      if(!id)return;
      e.preventDefault();e.stopImmediatePropagation();launch(id);
    },true);
    window.__launchTextTrainingV7=launch;
  }

  function boot(){styles();intercept();window.startTraining=function(id){return launch(id)};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
