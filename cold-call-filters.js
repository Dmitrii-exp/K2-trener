(() => {
  'use strict';

  const OBJECTIONS = [
    'Дорого',
    'Работаем с другими / есть поставщик',
    'Нет времени',
    'Не хочу менять поставщика',
    'Нет бюджета, нет денег, нет финансирования',
    'Жили же как-то без вас',
    'Я подумаю',
    'Ещё не смотрел',
    'Не интересно',
    'Не звоните сюда больше',
    'Всё есть',
    'Слышал негативные отзывы',
    'Сам знаю где купить / сам всё знаю и тп',
    'Сейчас не сезон',
    'Решает директор. Решает Москва. Решает центральный офис',
    'Был негативный опыт с вами',
    'Сейчас сезон',
    'Ничего не нужно',
    'Пока всё заморозили',
    'Я сам вам перезвоню',
    'Хорошие отношения с текущим поставщиком',
    'Есть поставщик рядом',
    'Был негативный опыт с аналогичным продуктом',
    'Отправляйте всё на почту',
    'Я вас не знаю. Мы о вас не слышали',
    'Пока нет заказов, нет покупателей',
    'Мы будем иметь вас в виду',
    'У директора брат работает у нашего поставщика',
    'Все у всех одинаково',
    'Долго везти',
    'Что я скажу нашему поставщику',
    'Перед новым годом не будем покупать'
  ];

  const state = { product: '', selected: [] };
  window.saleTrainingColdCallFilters = state;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function findColdCallRoot() {
    const nodes = [...document.querySelectorAll('body *')];
    return nodes.find(el => /Холодный звонок/.test(el.textContent || '') && /Настройка клиента/.test(el.textContent || '')) || null;
  }

  function findTextField(labelText) {
    const labels = [...document.querySelectorAll('label')];
    const label = labels.find(l => (l.textContent || '').includes(labelText));
    if (!label) return null;
    const parent = label.closest('.field') || label.parentElement;
    return parent?.querySelector('input,textarea');
  }

  function injectStyles() {
    if (document.getElementById('st-cold-filters-style')) return;
    const s = document.createElement('style');
    s.id = 'st-cold-filters-style';
    s.textContent = `
      .st-cold-filter-block{margin:16px 0 0}
      .st-cold-filter-label{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#85889a;margin-bottom:8px}
      .st-cold-product{width:100%;border:1px solid #e7e7ef;border-radius:13px;padding:13px 14px;background:#fff;color:#171827;outline:none;transition:.16s}
      .st-cold-product:focus{border-color:#7357ff;box-shadow:0 0 0 3px #7357ff18}
      .st-cold-filter-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #ddd8f3;border-radius:13px;padding:13px 14px;background:linear-gradient(135deg,#f7f4ff,#fff);color:#171827;font-weight:750;cursor:pointer;text-align:left}
      .st-cold-filter-btn:hover{border-color:#b9abff;background:#f8f5ff}
      .st-cold-filter-value{font-size:12px;color:#7357ff;margin-top:5px;font-weight:650}
      .st-cold-filter-overlay{position:fixed;inset:0;background:rgba(20,17,32,.42);backdrop-filter:blur(3px);z-index:9998;display:grid;place-items:center;padding:20px}
      .st-cold-filter-modal{width:min(720px,100%);max-height:min(760px,92vh);display:flex;flex-direction:column;background:#fff;border:1px solid #e4e0f0;border-radius:24px;box-shadow:0 30px 90px rgba(30,22,60,.25);overflow:hidden}
      .st-cold-filter-head{padding:22px 24px 18px;border-bottom:1px solid #e9e7ef;display:flex;justify-content:space-between;gap:15px}
      .st-cold-filter-head h3{margin:0;font-size:22px}.st-cold-filter-head p{margin:7px 0 0;color:#85889a;font-size:13px;line-height:1.45}
      .st-cold-filter-close{border:0;background:transparent;color:#77788a;font-size:25px;cursor:pointer}
      .st-cold-filter-list{padding:14px 18px;overflow:auto;display:grid;gap:8px}
      .st-cold-option{display:flex;align-items:center;gap:12px;width:100%;padding:13px 14px;border:1px solid #e7e5ed;border-radius:14px;background:#fff;text-align:left;cursor:pointer;transition:.12s}
      .st-cold-option:hover{border-color:#c9bfff;background:#fbfaff}.st-cold-option.is-selected{border-color:#7357ff;background:#f5f2ff}
      .st-cold-check{width:20px;height:20px;border:2px solid #c9c7d3;border-radius:6px;display:grid;place-items:center;flex:0 0 20px;color:#fff;font-size:13px}.is-selected .st-cold-check{background:#7357ff;border-color:#7357ff}
      .st-cold-num{width:24px;color:#85889a;font-size:12px}.st-cold-text{font-size:14px;line-height:1.35;flex:1}
      .st-cold-filter-foot{padding:14px 18px;border-top:1px solid #e9e7ef;display:flex;justify-content:flex-end;gap:10px;background:#fff}
      .st-cold-filter-foot button{min-width:120px;padding:11px 16px;border-radius:12px;font-weight:750;cursor:pointer}.st-cold-cancel{border:1px solid #e2e0e8;background:#fff;color:#171827}.st-cold-done{border:0;background:linear-gradient(135deg,#7357ff,#6548ed);color:#fff}
      @media(max-width:760px){.st-cold-filter-overlay{padding:10px}.st-cold-filter-modal{max-height:94vh;border-radius:20px}.st-cold-filter-foot{position:sticky;bottom:0}.st-cold-filter-foot button{flex:1}.st-cold-option{padding:12px}.st-cold-text{font-size:13px}}
    `;
    document.head.appendChild(s);
  }

  function openModal() {
    const draft = new Set(state.selected);
    const overlay = document.createElement('div');
    overlay.className = 'st-cold-filter-overlay';
    overlay.innerHTML = `<div class="st-cold-filter-modal" role="dialog" aria-modal="true">
      <div class="st-cold-filter-head"><div><h3>Фильтр клиента</h3><p>Выберите возражения, которые может использовать клиент во время разговора.</p></div><button class="st-cold-filter-close" aria-label="Закрыть">×</button></div>
      <div class="st-cold-filter-list">${OBJECTIONS.map((x,i)=>`<button type="button" class="st-cold-option ${draft.has(i)?'is-selected':''}" data-i="${i}"><span class="st-cold-check">${draft.has(i)?'✓':''}</span><span class="st-cold-num">${i+1}.</span><span class="st-cold-text">${esc(x)}</span></button>`).join('')}</div>
      <div class="st-cold-filter-foot"><button type="button" class="st-cold-cancel">Отмена</button><button type="button" class="st-cold-done">Готово (${draft.size})</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.st-cold-filter-close').onclick = close;
    overlay.querySelector('.st-cold-cancel').onclick = close;
    overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
    overlay.querySelectorAll('.st-cold-option').forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.i); draft.has(i) ? draft.delete(i) : draft.add(i);
      btn.classList.toggle('is-selected', draft.has(i));
      btn.querySelector('.st-cold-check').textContent = draft.has(i) ? '✓' : '';
      overlay.querySelector('.st-cold-done').textContent = `Готово (${draft.size})`;
    });
    overlay.querySelector('.st-cold-done').onclick = () => { state.selected = [...draft].sort((a,b)=>a-b); close(); refresh(); };
  }

  function refresh() {
    const root = findColdCallRoot();
    if (!root) return;
    injectStyles();
    const productField = findTextField('Факты о клиенте');
    if (productField && productField.dataset.stColdProductWrapped !== '1') {
      const block = document.createElement('div');
      block.className = 'st-cold-filter-block';
      block.innerHTML = `<div class="st-cold-filter-label"><span>Товар клиента</span><span>необязательно</span></div><input class="st-cold-product" id="stColdProduct" placeholder="Введите товар или услугу клиента" autocomplete="off"><div class="invite-note">AI будет учитывать товар при разговоре</div>`;
      productField.closest('.field')?.before(block);
      const input = block.querySelector('input');
      input.value = state.product;
      input.oninput = () => state.product = input.value.trim();
      productField.dataset.stColdProductWrapped = '1';
    }
    if (!root.querySelector('.st-cold-filter-block[data-filter]')) {
      const block = document.createElement('div');
      block.className = 'st-cold-filter-block';
      block.dataset.filter = '1';
      block.innerHTML = `<div class="st-cold-filter-label"><span>Возражения клиента</span><span>${state.selected.length ? state.selected.length+' выбрано' : 'необязательно'}</span></div><button type="button" class="st-cold-filter-btn"><span>Фильтр клиента<div class="st-cold-filter-value">${state.selected.length ? 'Выбрано: '+state.selected.length : 'Выберите возражения'}</div></span><span>⌄</span></button>`;
      const productBlock = root.querySelector('#stColdProduct')?.closest('.st-cold-filter-block');
      productBlock ? productBlock.after(block) : root.querySelector('.field')?.append(block);
      block.querySelector('button').onclick = openModal;
    }
  }

  function installContextBridge() {
    if (window.__stColdContextBridge) return;
    window.__stColdContextBridge = true;
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      if (state.product || state.selected.length) {
        const url = typeof input === 'string' ? input : input?.url || '';
        const body = init?.body;
        if (body && /functions|openai|ai|chat|gemini|anthropic/i.test(url)) {
          try {
            const parsed = JSON.parse(body);
            const context = `\n\nКОНТЕКСТ ХОЛОДНОГО ЗВОНКА — ОБЯЗАТЕЛЬНО УЧИТЫВАЙ ЕГО ВО ВСЁМ ДИАЛОГЕ:\nТовар клиента: ${state.product || 'не указан'}\nВозражения клиента, которые он может использовать: ${state.selected.map(i => OBJECTIONS[i]).join('; ') || 'не заданы'}\nНе перечисляй эти фильтры менеджеру. Используй их естественно как характеристики и возражения клиента.`;
            const add = value => typeof value === 'string' ? value + context : value;
            if (Array.isArray(parsed.messages)) parsed.messages = parsed.messages.map(m => m.role === 'system' ? {...m,content:add(m.content)} : m);
            if (typeof parsed.prompt === 'string') parsed.prompt += context;
            if (typeof parsed.input === 'string') parsed.input += context;
            init = {...init, body: JSON.stringify(parsed)};
          } catch (_) {}
        }
      }
      return originalFetch.call(this, input, init);
    };
  }

  function boot() {
    injectStyles();
    installContextBridge();
    refresh();
  }

  boot();
  new MutationObserver(refresh).observe(document.documentElement, {childList:true, subtree:true});
})();
