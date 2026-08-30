/* COMPANY_INVITE_EMAIL_V1 */
/* TRIGGER_INVITATION_WIRING_V5 */
(function(){
  const qs=new URLSearchParams(location.search);
  const token=qs.get('invite')||localStorage.getItem('saletrening_invite_token')||'';
  const invitedEmail=(qs.get('email')||'').trim().toLowerCase();
  const inviteFlow=qs.get('type')==='invite'&&!!token;

  window.createCompanyInvitation=async function(){
    if(!state?.user||!state?.profile){toast('Профиль ещё загружается. Обновите страницу через секунду.');return}
    if(!state.profile.company_id||!['director','admin','manager'].includes(state.profile.role)){toast('Нет прав для приглашения сотрудников');return}
    const email=document.getElementById('inviteEmail')?.value.trim().toLowerCase();
    const role=document.getElementById('inviteRole')?.value||'employee';
    if(!email){toast('Укажи email сотрудника');return}
    const {data,error}=await sb.functions.invoke('send-company-invitation',{body:{email,role,origin:location.origin}});
    if(error){toast(error.message||'Не удалось отправить приглашение');return}
    if(data?.error){toast(data.error);return}
    const out=document.getElementById('inviteResult');
    if(out)out.innerHTML=`<div class="card" style="margin-top:14px;background:#faf9ff"><b>Приглашение отправлено</b><div class="muted" style="margin-top:6px">Письмо с приглашением автоматически отправлено на ${esc(email)}. Срок действия — 7 дней.</div></div>`;
    if(document.getElementById('inviteEmail'))document.getElementById('inviteEmail').value='';
  };

  if(!inviteFlow)return;

  const originalBoot=window.boot;
  function showRegistration(email){
    const safe=esc(String(email||''));
    const root=document.getElementById('root');
    if(!root)return;
    root.innerHTML=`<div class="auth"><div class="auth-card"><div class="auth-brand"><div class="logo"><div class="logo-b">S</div>SaleTrening</div><span class="auth-badge">ПРИГЛАШЕНИЕ</span></div><h1>Завершите регистрацию.</h1><div class="sub">Вы приглашены в команду SaleTrening. Email из приглашения закреплён и не может быть изменён.</div><div class="field"><label>Имя</label><input id="inviteFirst" placeholder="Дмитрий"></div><div class="field"><label>Email</label><input id="inviteEmailLocked" type="email" value="${safe}" readonly style="background:#f5f5f8;color:#555;cursor:not-allowed"></div><div class="field"><label>Пароль</label><input id="invitePass" type="password" placeholder="Минимум 6 символов"></div><div class="auth-actions"><button class="primary" onclick="completeInviteRegistration()">Завершить регистрацию</button></div><div class="auth-note">Email автоматически закреплён за приглашением руководителя.</div></div></div>`;
  }
  window.completeInviteRegistration=async function(){
    const first=document.getElementById('inviteFirst')?.value.trim()||'';
    const password=document.getElementById('invitePass')?.value||'';
    if(password.length<6){toast('Пароль должен содержать минимум 6 символов');return}
    const {data,error}=await sb.auth.updateUser({password,data:{first_name:first}});
    if(error){toast(error.message);return}
    try{await acceptPendingInvitation(data?.user?.id);await originalBoot(data.user)}catch(e){console.error('completeInviteRegistration:',e);toast(e.message||'Не удалось принять приглашение')}
  };
  window.boot=async function(user){
    const sessionEmail=String(user?.email||'').trim().toLowerCase();
    if(invitedEmail&&sessionEmail&&sessionEmail!==invitedEmail){await sb.auth.signOut();authScreen();return}
    showRegistration(sessionEmail||invitedEmail);
  };
  window.signUp=function(){toast('Для регистрации сотрудника используйте ссылку из приглашения на указанный Email.');};
  window.addEventListener('load',async function(){
    const {data}=await sb.auth.getSession();
    if(data?.session)window.boot(data.session.user);
    else{const input=document.getElementById('email');if(input&&invitedEmail){input.value=invitedEmail;input.readOnly=true;input.style.background='#f5f5f8';input.style.color='#555';input.style.cursor='not-allowed'}}
  });
})();

/* AI_CLIENT_SETTINGS_UI_V4 */
(function(){
  const OBJECTIONS=[
    'Дорого','Работаем с другими / есть поставщик','Нет времени','Не хочу менять поставщика',
    'Нет бюджета, нет денег, нет финансирования','Жили же как-то без вас','Я подумаю','Ещё не смотрел',
    'Не интересно','Не звоните сюда больше','Всё есть','Слышал негативные отзывы',
    'Сам знаю где купить / сам всё знаю и тп','Сейчас не сезон','Решает директор. Решает Москва. Решает центральный офис',
    'Был негативный опыт с вами','Сейчас сезон','Ничего не нужно','Пока всё заморозили','Я сам вам перезвоню',
    'Хорошие отношения с текущим поставщиком','Есть поставщик рядом','Был негативный опыт с аналогичным продуктом',
    'Отправляйте всё на почту','Я вас не знаю. Мы о вас не слышали','Пока нет заказов, нет покупателей',
    'Мы будем иметь вас в виду','У директора брат работает у нашего поставщика','Все у всех одинаково',
    'Долго везти','Что я скажу нашему поставщику','Перед новым годом не будем менять поставщика'
  ];
  const PRODUCT_KNOWLEDGE={
    'Шины':'Ты опытный пользователь шин. Знаешь типоразмеры, оси, индексы нагрузки и скорости, давление, сезонность, условия эксплуатации, износ, пробег, бренды, цены и поставщиков. Имеешь практический опыт эксплуатации шин. Задавай предметные вопросы и сравнивай предложения как реальный покупатель.',
    'Автомобили':'Ты опытный пользователь автомобилей. Знаешь эксплуатацию, обслуживание, надежность, расход, типичные проблемы, стоимость владения и сравнение моделей. Говори как реальный владелец с практическим опытом.',
    'Оборудование':'Ты опытный пользователь профессионального оборудования. Знаешь производительность, технические характеристики, надежность, обслуживание, расходники, простои и стоимость владения. Оценивай предложение с практической точки зрения.',
    'Услуги':'Ты опытный клиент услуг. Сравниваешь цену, качество, сроки, гарантии, сервис, риски и реальные результаты. Задавай практические вопросы и не принимай общие обещания без уточнений.',
    'Недвижимость':'Ты опытный покупатель недвижимости. Знаешь рынок, состояние объектов, документы, расположение, инфраструктуру, расходы, ремонт и риски. Сравнивай варианты как реальный покупатель.',
    'Свой товар / тема':'Ты опытный пользователь выбранного товара или темы. У тебя есть практический опыт использования, сравнения и покупки. Задавай предметные вопросы, выявляй несоответствия и не принимай заявления менеджера без уточнений.'
  };
  const PRODUCT_OPTIONS=Object.keys(PRODUCT_KNOWLEDGE);
  const esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const encode=v=>btoa(unescape(encodeURIComponent(JSON.stringify(v))));
  const decode=v=>{try{return JSON.parse(decodeURIComponent(escape(atob(v))))}catch{return null}};
  function scenarioConfig(s){
    const prompt=String(s?.system_prompt||'');
    const m=prompt.match(/AI_CLIENT_SETTINGS_V3_JSON:([A-Za-z0-9+/=]+)$/);
    const embedded=m?decode(m[1]):null;
    return {...(embedded||{}),objections:Array.isArray(embedded?.objections)?embedded.objections:(Array.isArray(s?.objections)?s.objections:[]),random:!!embedded?.random,randomCount:Number(embedded?.randomCount)||0,product:embedded?.product||'',productCustom:embedded?.productCustom||'',productKnowledge:embedded?.productKnowledge||''};
  }
  function savePrompt(s,c){
    const base=String(s?.system_prompt||'').replace(/\s*AI_CLIENT_SETTINGS_V3_JSON:[A-Za-z0-9+/=]+$/,'').trim();
    return (base?base+'\n':'')+'AI_CLIENT_SETTINGS_V3_JSON:'+encode(c);
  }
  let selectedId='';
  let openLibrary=false;
  function currentScenario(){
    const id=Number(document.getElementById('aiScenarioSelect')?.value||selectedId||0);
    return (state.scenarios||[]).find(s=>Number(s.id)===id)||null;
  }
  function renderSettings(){
    const host=document.getElementById('ai-client-settings-v4');if(!host)return;
    const s=currentScenario();
    if(!s){host.innerHTML='<div class="empty">Выберите сценарий, чтобы настроить AI-клиента.</div>';return}
    const c=scenarioConfig(s);selectedId=String(s.id);
    host.innerHTML=`<div class="card" style="margin:0;background:#fff"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0">Настройки AI-клиента</h3><div class="muted" style="margin-top:5px">AI-клиент будет вести диалог с учётом выбранного товара, опыта его эксплуатации и выбранных возражений.</div></div><span class="pill">${esc2(s.title)}</span></div>
      <div class="field" style="margin-top:18px"><label>Сценарий</label><select id="aiScenarioSelect">${(state.scenarios||[]).map(x=>`<option value="${x.id}" ${Number(x.id)===Number(s.id)?'selected':''}>${esc2(x.title)}</option>`).join('')}</select></div>
      <div class="field"><label>Товар / тема, которую предлагает менеджер</label><select id="aiProduct"><option value="">Не выбран</option>${PRODUCT_OPTIONS.map(x=>`<option value="${esc2(x)}" ${x===c.product?'selected':''}>${esc2(x)}</option>`).join('')}</select><input id="aiProductCustom" value="${esc2(c.productCustom)}" placeholder="Если выбрано «Свой товар / тема» — укажите название" style="margin-top:8px"></div>
      <div class="field"><label>Знания и опыт AI-клиента о выбранном товаре / теме</label><textarea id="aiProductKnowledge" rows="5" placeholder="Опишите, что клиент знает об эксплуатации, характеристиках, ценах, конкурентах и типичных проблемах.">${esc2(c.productKnowledge||PRODUCT_KNOWLEDGE[c.product]||'')}</textarea><div class="muted" style="margin-top:5px">Например: для шин AI-клиент ведёт себя как реальный пользователь шин с опытом эксплуатации и сравнения поставщиков.</div></div>
      <div class="field"><label style="display:flex;align-items:center;gap:9px"><input id="aiRandom" type="checkbox" ${c.random?'checked':''} style="width:auto"> 🎲 Случайные возражения</label><div class="muted">AI добавит к выбранным вручную ещё указанное количество возражений из библиотеки.</div><input id="aiRandomCount" type="number" min="0" max="11" value="${Math.max(0,Math.min(11,c.randomCount))}" style="margin-top:8px;width:130px" ${c.random?'':'disabled'}></div>
      <div class="field"><label>Возражения клиента</label><div id="aiSelectedObjections" style="display:grid;gap:8px"></div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:10px"><button id="aiAllObjections" class="secondary" type="button">＋ Все возражения</button><button id="aiCustomObjection" class="secondary" type="button">＋ Своё возражение</button></div></div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button id="aiSaveSettings" class="primary" type="button">Сохранить настройки AI-клиента</button></div></div>`;
    const sel=host.querySelector('#aiProduct'),custom=host.querySelector('#aiProductCustom'),knowledge=host.querySelector('#aiProductKnowledge'),random=host.querySelector('#aiRandom'),randomCount=host.querySelector('#aiRandomCount'),scenarioSel=host.querySelector('#aiScenarioSelect');
    const selected=host.querySelector('#aiSelectedObjections');
    const renderSelected=()=>{const list=c.objections||[];selected.innerHTML=list.length?list.map((x,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #bfe9d8;border-radius:12px;background:#f5fff9"><span style="flex:1"><b>${i+1}.</b> ${esc2(x)}</span><button class="secondary" type="button" data-remove="${i}">Удалить</button></div>`).join(''):'<div class="empty" style="padding:18px">Возражения не выбраны.</div>';selected.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{c.objections.splice(Number(b.dataset.remove),1);renderSelected()})};
    renderSelected();
    scenarioSel.onchange=()=>{selectedId=scenarioSel.value;renderSettings()};
    sel.onchange=()=>{c.product=sel.value;c.productKnowledge=PRODUCT_KNOWLEDGE[c.product]||'';knowledge.value=c.productKnowledge};
    custom.oninput=()=>c.productCustom=custom.value;
    knowledge.oninput=()=>c.productKnowledge=knowledge.value;
    random.onchange=()=>{c.random=random.checked;randomCount.disabled=!random.checked};
    randomCount.oninput=()=>c.randomCount=Math.max(0,Math.min(11,Number(randomCount.value)||0));
    host.querySelector('#aiCustomObjection').onclick=()=>{const x=prompt('Введите своё возражение клиента');if(!x?.trim())return;c.objections=c.objections||[];if(!c.objections.includes(x.trim()))c.objections.push(x.trim());renderSelected()};
    host.querySelector('#aiAllObjections').onclick=()=>showLibrary(c);
    host.querySelector('#aiSaveSettings').onclick=async()=>{
      const payload={...c,product:sel.value,productCustom:custom.value.trim(),productKnowledge:knowledge.value.trim(),random:random.checked,randomCount:Math.max(0,Math.min(11,Number(randomCount.value)||0)),objections:c.objections||[]};
      const prompt=savePrompt(s,payload);
      const r=await sb.from('saletrening_scenarios').update({objections:payload.objections,system_prompt:prompt}).eq('id',s.id);
      if(r.error){toast('Ошибка сохранения: '+r.error.message);return}
      const idx=(state.scenarios||[]).findIndex(x=>Number(x.id)===Number(s.id));
      if(idx>=0){state.scenarios[idx]={...state.scenarios[idx],objections:payload.objections,system_prompt:prompt};state.clientSettings=payload;state.clientObjections=payload.objections}
      toast('Настройки AI-клиента сохранены');renderSettings();
    };
  }
  function showLibrary(c){
    if(document.getElementById('ai-objection-library'))return;
    const m=document.createElement('div');m.id='ai-objection-library';m.style='position:fixed;inset:0;background:#0008;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    m.innerHTML=`<div class="card" style="width:min(850px,100%);max-height:90vh;overflow:auto;background:#171625;color:#fff"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Все возражения</h2><button id="aiCloseLibrary" class="secondary" type="button">✕</button></div><div class="muted" style="margin:10px 0 16px;color:#aaa7b8">Выбранное возражение перейдёт в основной список</div><div id="aiLibraryList">${OBJECTIONS.map((x,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:12px;margin:7px 0;border:1px solid #3a3555;border-radius:12px"><span style="min-width:32px;color:#aaa7b8">${i+1}.</span><span style="flex:1">${esc2(x)}</span><button class="primary" type="button" data-add="${i}">${c.objections.includes(x)?'Выбрано':'Добавить'}</button></div>`).join('')}</div></div>`;
    document.body.appendChild(m);m.querySelector('#aiCloseLibrary').onclick=()=>m.remove();m.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const x=OBJECTIONS[Number(b.dataset.add)];if(!c.objections.includes(x))c.objections.push(x);b.textContent='Выбрано';renderSettings();showLibrary(c)});
  }
  function mount(){
    if(typeof state==='undefined'||typeof sb==='undefined')return;
    if(state.view!=='scenarios')return;
    if(document.getElementById('ai-client-settings-v4'))return;
    const p=document.getElementById('page');if(!p)return;
    const host=document.createElement('div');host.id='ai-client-settings-v4';host.className='section';host.style.maxWidth='1000px';host.style.margin='20px auto 0';
    p.appendChild(host);selectedId=String((state.scenarios||[])[0]?.id||'');renderSettings();
  }
  const observer=new MutationObserver(()=>{try{mount()}catch(e){console.error('AI client settings UI:',e)}});
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(mount,800);
})();

/* COLD_CALL_SETTINGS_UI_V1 */
(function(){
  const OBJECTIONS=[
    'Дорого','Работаем с другими / есть поставщик','Нет времени','Не хочу менять поставщика',
    'Нет бюджета, нет денег, нет финансирования','Жили же как-то без вас','Я подумаю','Ещё не смотрел',
    'Не интересно','Не звоните сюда больше','Всё есть','Слышал негативные отзывы',
    'Сам знаю где купить / сам всё знаю и тп','Сейчас не сезон','Решает директор. Решает Москва. Решает центральный офис',
    'Был негативный опыт с вами','Сейчас сезон','Ничего не нужно','Пока всё заморозили','Я сам вам перезвоню',
    'Хорошие отношения с текущим поставщиком','Есть поставщик рядом','Был негативный опыт с аналогичным продуктом',
    'Отправляйте всё на почту','Я вас не знаю. Мы о вас не слышали','Пока нет заказов, нет покупателей',
    'Мы будем иметь вас в виду','У директора брат работает у нашего поставщика','Все у всех одинаково',
    'Долго везти','Что я скажу нашему поставщику','Перед новым годом не будем менять поставщика'
  ];
  const KNOWLEDGE={
    'Шины':'Ты опытный пользователь шин. Знаешь типоразмеры, оси, индексы нагрузки и скорости, давление, сезонность, условия эксплуатации, износ, пробег, бренды, цены и поставщиков. Имеешь практический опыт эксплуатации шин. Задавай предметные вопросы и сравнивай предложения как реальный покупатель.',
    'Автомобили':'Ты опытный пользователь автомобилей. Знаешь эксплуатацию, обслуживание, надежность, расход, типичные проблемы, стоимость владения и сравнение моделей. Говори как реальный владелец с практическим опытом.',
    'Оборудование':'Ты опытный пользователь профессионального оборудования. Знаешь производительность, технические характеристики, надежность, обслуживание, расходники, простои и стоимость владения. Оценивай предложение с практической точки зрения.',
    'Услуги':'Ты опытный клиент услуг. Сравниваешь цену, качество, сроки, гарантии, сервис, риски и реальные результаты. Задавай практические вопросы и не принимай общие обещания без уточнений.',
    'Недвижимость':'Ты опытный покупатель недвижимости. Знаешь рынок, состояние объектов, документы, расположение, инфраструктуру, расходы, ремонт и риски. Сравнивай варианты как реальный покупатель.',
    'Свой товар / тема':'Ты опытный пользователь выбранного товара или темы. Имеешь практический опыт использования, сравнения и покупки. Задавай предметные вопросы и не принимай заявления менеджера без уточнений.'
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function getSelected(){return Array.from(document.querySelectorAll('#coldObjections input[data-objection]:checked')).map(x=>x.value)}
  function renderObjections(selected){
    const box=document.getElementById('coldObjections');if(!box)return;
    box.innerHTML=OBJECTIONS.map((x,i)=>`<label style="display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;margin:5px 0;background:#fff"><input data-objection type="checkbox" value="${esc(x)}" ${selected.includes(x)?'checked':''} style="width:auto;margin-top:3px"><span>${i+1}. ${esc(x)}</span></label>`).join('');
  }
  function renderLibrary(){
    const old=document.getElementById('cold-objection-library');if(old)old.remove();
    const selected=getSelected();
    const m=document.createElement('div');m.id='cold-objection-library';m.style='position:fixed;inset:0;background:#0008;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    m.innerHTML=`<div class="card" style="width:min(850px,100%);max-height:90vh;overflow:auto;background:#171625;color:#fff"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Все возражения</h2><button id="coldCloseLibrary" class="secondary" type="button">✕</button></div><div class="muted" style="margin:10px 0 16px;color:#aaa7b8">Выберите возражения, которые AI-клиент может использовать в звонке.</div><div id="coldLibraryList">${OBJECTIONS.map((x,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:12px;margin:7px 0;border:1px solid #3a3555;border-radius:12px"><span style="min-width:32px;color:#aaa7b8">${i+1}.</span><span style="flex:1">${esc(x)}</span><button class="primary" type="button" data-add="${i}">${selected.includes(x)?'Выбрано':'Добавить'}</button></div>`).join('')}</div></div>`;
    document.body.appendChild(m);
    m.querySelector('#coldCloseLibrary').onclick=()=>m.remove();
    m.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const x=OBJECTIONS[Number(b.dataset.add)];const c=getSelected();if(!c.includes(x))c.push(x);renderObjections(c);b.textContent='Выбрано'});
  }
  function renderColdCallHome(){
    const p=document.getElementById('page');if(!p)return;
    p.innerHTML=`<div class="top"><div><h2>Холодный звонок</h2><div class="muted">Голосовая тренировка в режиме телефонного разговора</div></div></div>
    <div class="card" style="max-width:1000px;margin:auto">
      <h3>Настройка клиента</h3>
      <div class="field" style="margin-top:14px"><label>Характер клиента</label><select id="coldCharacter"><option>Лояльный</option><option>Скептик</option><option>Грубит</option><option>Занятой</option><option>Аналитик</option></select></div>
      <div class="field"><label>Категория товара / услуги</label><select id="coldProduct"><option value="">Выберите категорию</option>${Object.keys(KNOWLEDGE).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Конкретный товар / тема <span class="muted">(необязательно)</span></label><input id="coldProductCustom" placeholder="Например: грузовые шины 315/70 R22.5, балансировочный станок, сервис шин..."/></div>
      <div class="field"><label>Голос клиента</label><select id="coldVoice"><option value="filipp">Филипп — мужской</option><option value="ermil">Ермил — мужской</option><option value="zahar">Захар — мужской</option><option value="alexander">Александр — мужской</option><option value="kirill">Кирилл — мужской</option><option value="anton">Антон — мужской</option></select></div>
      <div class="field"><label>Знания и опыт клиента</label><textarea id="coldKnowledge" rows="4" placeholder="Опишите опыт клиента, его парк, поставщиков, требования, цены и условия."></textarea></div>
      <div class="field"><label>Факты о клиенте <span class="muted">(необязательно)</span></label><textarea id="coldFacts" rows="4" placeholder="Например: сейчас покупает у конкурента, нужен объём 100 шин, важна гарантия..."></textarea></div>
      <div class="field"><label>Возражения клиента</label><div class="muted" style="margin-bottom:8px">Выберите конкретные возражения, которые AI должен использовать во время звонка.</div><div id="coldObjections"></div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:10px"><button id="coldAllObjections" class="secondary" type="button">＋ Все возражения</button><button id="coldCustomObjection" class="secondary" type="button">＋ Своё возражение</button></div></div>
      <div class="field"><label style="display:flex;align-items:center;gap:9px"><input id="coldRandom" type="checkbox" style="width:auto"> 🎲 Случайные возражения</label><div class="muted">Добавить случайные возражения к выбранным вручную.</div><input id="coldRandomCount" type="number" min="0" max="11" value="0" disabled style="margin-top:8px;width:130px"/></div>
      <h3 style="margin-top:24px">Выберите уровень сложности</h3>
      <div class="grid" style="margin-top:18px"><div class="card"><h3>Средний</h3><p class="muted">Клиент более лоялен, идёт на контакт, слушает и задаёт вопросы.</p><button class="primary" onclick="startColdCall('Средний')">☎ Начать</button></div><div class="card"><h3>Сложный</h3><p class="muted">Клиент менее охотно идёт на контакт и требует сильной аргументации.</p><button class="primary" onclick="startColdCall('Сложный')">☎ Начать</button></div></div>
      <p class="muted" style="margin-top:18px">Вы говорите первым. Лимит звонка — 10 минут.</p>
    </div>`;
    renderObjections([]);
    document.getElementById('coldProduct').onchange=()=>{const p=document.getElementById('coldProduct').value;const k=document.getElementById('coldKnowledge');if(k&&!k.value)k.value=KNOWLEDGE[p]||''};
    document.getElementById('coldRandom').onchange=e=>document.getElementById('coldRandomCount').disabled=!e.target.checked;
    document.getElementById('coldAllObjections').onclick=()=>renderLibrary();
    document.getElementById('coldCustomObjection').onclick=()=>{const x=prompt('Введите своё возражение клиента');if(!x?.trim())return;const c=getSelected();if(!c.includes(x.trim()))c.push(x.trim());renderObjections(c)};
  }
  window.startColdCall=async function(difficulty='Средний'){
    const s=coldCallScenario(difficulty);if(!s.id){toast('Сценарий «Холодный звонок» не найден в базе');return}
    const product=document.getElementById('coldProduct')?.value||'';
    const productCustom=document.getElementById('coldProductCustom')?.value.trim()||'';
    const productKnowledge=document.getElementById('coldKnowledge')?.value.trim()||KNOWLEDGE[product]||'';
    const facts=document.getElementById('coldFacts')?.value.trim()||'';
    const character=document.getElementById('coldCharacter')?.value||'Лояльный';
    const voice=document.getElementById('coldVoice')?.value||'filipp';
    let objections=getSelected();
    const random=document.getElementById('coldRandom')?.checked||false;
    const randomCount=Math.max(0,Math.min(11,Number(document.getElementById('coldRandomCount')?.value)||0));
    if(random&&randomCount){const pool=OBJECTIONS.filter(x=>!objections.includes(x)).sort(()=>Math.random()-.5);objections=objections.concat(pool.slice(0,randomCount))}
    state.clientSettings={product,productCustom,productKnowledge,character,facts,voice,random,randomCount,objections};state.clientObjections=objections;
    coldCall.character=character;coldCall.facts=facts;coldCall.voice=voice;coldCall.difficulty=difficulty;coldCall.product=product;coldCall.productCustom=productCustom;coldCall.productKnowledge=productKnowledge;coldCall.objections=objections;coldCall.random=random;coldCall.randomCount=randomCount;
    const payload={employee_id:state.user.id,company_id:state.profile.company_id,scenario_id:s.id,status:'started',transcript:[],voice_mode:true};
    const {data,error}=await sb.from('saletrening_sessions').insert(payload).select().single();if(error){toast(error.message);return}
    state.session={...data,scenario:s};state.messages=[];coldCall.startedAt=Date.now();coldCall.silenceNudged=false;coldCall.processing=false;state.view='coldcall';trainingCallPage();setTimeout(startVoiceListening,350);
  };
  const originalPage=window.page;
  window.page=function(){if(state.view==='coldcall'&&!state.session){renderColdCallHome();return}return originalPage.apply(this,arguments)};
  window.renderColdCallHome=renderColdCallHome;
  const observer=new MutationObserver(()=>{try{if(state?.view==='coldcall'&&!state?.session&&document.getElementById('page')&&!document.getElementById('coldProduct'))renderColdCallHome()}catch(e){console.error('Cold call settings UI:',e)}});
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{if(state?.view==='coldcall'&&!state?.session)renderColdCallHome()},900);
})();
/* COLD_CALL_OBJECTIONS_COMPACT_V1 */
(function(){
  const MARK='data-cold-objections-compact';
  const OBJECTIONS=[
    'Дорого','Работаем с другими / есть поставщик','Нет времени','Не хочу менять поставщика',
    'Нет бюджета, нет денег, нет финансирования','Жили же как-то без вас','Я подумаю','Ещё не смотрел',
    'Не интересно','Не звоните сюда больше','Всё есть','Слышал негативные отзывы',
    'Сам знаю где купить / сам всё знаю и тп','Сейчас не сезон','Решает директор. Решает Москва. Решает центральный офис',
    'Был негативный опыт с вами','Сейчас сезон','Ничего не нужно','Пока всё заморозили','Я сам вам перезвоню',
    'Хорошие отношения с текущим поставщиком','Есть поставщик рядом','Был негативный опыт с аналогичным продуктом',
    'Отправляйте всё на почту','Я вас не знаю. Мы о вас не слышали','Пока нет заказов, нет покупателей',
    'Мы будем иметь вас в виду','У директора брат работает у нашего поставщика','Все у всех одинаково',
    'Долго везти','Что я скажу нашему поставщику','Перед новым годом не будем менять поставщика'
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getSelected=()=>Array.from(document.querySelectorAll('#coldObjections input[data-objection]:checked')).map(x=>x.value);
  const syncHidden=(values)=>{
    const box=document.getElementById('coldObjections');if(!box)return;
    box.querySelectorAll('input[data-objection]').forEach(x=>x.parentElement?.remove());
    const hidden=document.createElement('div');hidden.style='display:none';
    values.forEach(x=>{const label=document.createElement('label');label.innerHTML=`<input data-objection type="checkbox" value="${esc(x)}" checked>`;hidden.appendChild(label)});
    box.appendChild(hidden);
  };
  function renderSummary(box){
    const values=getSelected();
    let summary=box.querySelector('[data-objection-summary]');
    if(!summary){summary=document.createElement('div');summary.setAttribute('data-objection-summary','');box.appendChild(summary)}
    summary.innerHTML=values.length
      ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#f1edff;color:#5b3ee8;font-weight:600">Выбрано: ${values.length}</span><span class="muted" style="font-size:13px">${esc(values.slice(0,3).join(' • '))}${values.length>3?' • …':''}</span></div>`
      : '<div class="muted" style="padding:10px 0">Возражения не выбраны</div>';
  }
  function openModal(){
    document.getElementById('cold-objections-modal')?.remove();
    let selected=new Set(getSelected());
    const modal=document.createElement('div');modal.id='cold-objections-modal';
    modal.style='position:fixed;inset:0;background:rgba(15,13,28,.62);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML=`<div style="width:min(720px,100%);max-height:min(760px,92vh);display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.28);overflow:hidden">
      <div style="padding:18px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h2 style="margin:0;font-size:20px">Возражения клиента</h2><div class="muted" style="margin-top:5px">Выберите возражения, которые AI будет использовать в звонке.</div></div><button id="coldObjClose" class="secondary" type="button">✕</button></div>
      <div id="coldObjList" style="padding:14px 20px;overflow:auto;flex:1">${OBJECTIONS.map((x,i)=>`<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 11px;margin:5px 0;border:1px solid #e8e5ef;border-radius:10px;cursor:pointer;background:${selected.has(x)?'#f7f4ff':'#fff'}"><input data-modal-objection type="checkbox" value="${esc(x)}" ${selected.has(x)?'checked':''} style="width:auto;margin-top:3px"><span>${i+1}. ${esc(x)}</span></label>`).join('')}</div>
      <div style="padding:12px 20px;border-top:1px solid #eee;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button id="coldObjCustom" class="secondary" type="button">＋ Своё возражение</button><span id="coldObjCount" class="muted" style="margin-left:auto">Выбрано: ${selected.size}</span></div>
      <div style="padding:14px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;background:#faf9fc"><button id="coldObjCancel" class="secondary" type="button">Отмена</button><button id="coldObjDone" class="primary" type="button">Готово</button></div>
    </div>`;
    document.body.appendChild(modal);
    const updateCount=()=>{selected=new Set(Array.from(modal.querySelectorAll('[data-modal-objection]:checked')).map(x=>x.value));modal.querySelector('#coldObjCount').textContent=`Выбрано: ${selected.size}`};
    modal.querySelectorAll('[data-modal-objection]').forEach(x=>x.onchange=()=>{x.closest('label').style.background=x.checked?'#f7f4ff':'#fff';updateCount()});
    modal.querySelector('#coldObjCustom').onclick=()=>{const x=prompt('Введите своё возражение клиента');if(!x?.trim())return;const value=x.trim();if(!Array.from(modal.querySelectorAll('[data-modal-objection]')).some(i=>i.value===value)){const list=modal.querySelector('#coldObjList');const label=document.createElement('label');label.style='display:flex;align-items:flex-start;gap:10px;padding:10px 11px;margin:5px 0;border:1px solid #e8e5ef;border-radius:10px;cursor:pointer;background:#f7f4ff';label.innerHTML=`<input data-modal-objection type="checkbox" value="${esc(value)}" checked style="width:auto;margin-top:3px"><span>${esc(value)}</span>`;list.appendChild(label);label.querySelector('input').onchange=()=>{label.style.background=label.querySelector('input').checked?'#f7f4ff':'#fff';updateCount()};updateCount()}};
    modal.querySelector('#coldObjCancel').onclick=()=>modal.remove();
    modal.querySelector('#coldObjClose').onclick=()=>modal.remove();
    modal.querySelector('#coldObjDone').onclick=()=>{syncHidden(Array.from(selected));renderSummary(document.getElementById('coldObjections'));modal.remove()};
    modal.onclick=e=>{if(e.target===modal)modal.remove()};
  }
  function compactify(){
    const box=document.getElementById('coldObjections');if(!box||box.getAttribute(MARK))return;
    const values=getSelected();
    box.setAttribute(MARK,'1');
    box.innerHTML='';
    syncHidden(values);
    renderSummary(box);
    const actions=document.createElement('div');actions.style='display:flex;gap:9px;flex-wrap:wrap;margin-top:8px';
    const choose=document.createElement('button');choose.type='button';choose.className='secondary';choose.textContent='⚙ Выбрать возражения';choose.onclick=openModal;
    actions.appendChild(choose);box.appendChild(actions);
    const parent=box.closest('.field');
    if(parent){
      parent.querySelectorAll('#coldAllObjections,#coldCustomObjection').forEach(x=>x.style.display='none');
      const help=parent.querySelector('.muted');if(help)help.textContent='Настройте возражения в компактном списке. Полный список открывается в отдельном окне.';
    }
  }
  const observer=new MutationObserver(()=>setTimeout(compactify,0));
  function init(){if(!document.body)return;observer.observe(document.body,{childList:true,subtree:true});compactify()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
