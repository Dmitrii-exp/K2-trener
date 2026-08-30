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
