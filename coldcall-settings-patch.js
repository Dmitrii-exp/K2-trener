
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
