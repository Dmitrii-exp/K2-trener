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
