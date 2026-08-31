(() => {
  'use strict';
  /* SALETrening UI FORCE v8 — boot recovery */
  const root = document.getElementById('root');
  const showBoot = (message = 'SaleTrening загружается…') => {
    if (root && !root.innerHTML.trim()) {
      root.innerHTML = '<div id="boot-recovery" style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font:16px Arial;color:#555"><div style="max-width:620px;padding:30px;text-align:center;background:#fff;border:1px solid #e8e7ef;border-radius:20px;box-shadow:0 20px 60px rgba(40,30,80,.08)"><b style="font-size:20px">SaleTrening</b><div style="margin-top:10px">'+message+'</div><small style="display:block;margin-top:12px;color:#85889a">Подключение к сервисам проверяется автоматически.</small></div></div>';
    }
  };
  showBoot();
  window.addEventListener('error', (event) => {
    console.error('[SaleTrening] runtime error:', event.error || event.message);
    const r = document.getElementById('root');
    if (r && !r.querySelector('.auth,.shell,#boot-runtime-error')) {
      const old = document.getElementById('boot-recovery');
      if (old) old.remove();
      r.insertAdjacentHTML('afterbegin','<div id="boot-runtime-error" style="position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#f7f7fb;font:16px Arial;color:#555"><div style="max-width:680px;padding:30px;text-align:center;background:#fff;border:1px solid #eadff2;border-radius:20px;box-shadow:0 20px 60px rgba(40,30,80,.12)"><b>SaleTrening не удалось запустить</b><div style="margin-top:10px">Ошибка JavaScript. Обновите страницу через несколько секунд.</div><small style="display:block;margin-top:10px;color:#85889a">Консоль браузера и логи Vercel содержат подробности.</small><button onclick="location.reload()" style="margin-top:18px;border:0;border-radius:12px;padding:11px 18px;background:#7357ff;color:#fff;font-weight:700;cursor:pointer">Обновить</button></div></div>');
    }
  });
  window.addEventListener('unhandledrejection', (event) => console.error('[SaleTrening] unhandled rejection:', event.reason));

  const css = `:root{--st-purple:#7357ff;--st-purple-2:#9b86ff;--st-bg:#f6f7fb;--st-card:#fff;--st-text:#171827;--st-muted:#85889a;--st-line:#e7e7ef;--st-dark:#15131f;--st-dark-2:#25213a}html,body{background:var(--st-bg)!important;color:var(--st-text)!important}body{font-family:Inter,ui-sans-serif,Arial,sans-serif!important}.auth{background:radial-gradient(circle at 12% 15%,#e9e3ff 0,transparent 32%),radial-gradient(circle at 90% 85%,#eeeaff 0,transparent 30%),#f7f7fb!important;padding:28px!important}.auth-card{width:min(1040px,100%)!important;min-height:620px!important;display:block!important;position:relative!important;padding:42px 50px 42px 52%!important;overflow:hidden!important;border-radius:30px!important;border:1px solid #e2def0!important;box-shadow:0 30px 90px rgba(42,30,85,.14)!important;background:#fff!important}.auth-card:before{content:"SaleTrening";display:flex;align-items:flex-end;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:48%!important;height:100%!important;box-sizing:border-box!important;padding:42px!important;color:#fff!important;font-size:42px!important;font-weight:900!important;letter-spacing:-1.5px!important;background:linear-gradient(145deg,#171425 0%,#211b38 55%,#35265c 100%)!important;pointer-events:none!important;z-index:0!important}.auth-card>*:not(:first-child){position:relative!important;z-index:1!important}.auth-card h1{font-size:34px!important;letter-spacing:-1px!important}.auth-card input,.auth-card textarea,.auth-card select,.auth-card button{position:relative!important;z-index:2!important;pointer-events:auto!important}.shell{grid-template-columns:264px minmax(0,1fr)!important;background:#f6f7fb!important}.side{background:linear-gradient(180deg,#15131f 0%,#1b1729 100%)!important;border-right:1px solid #2b263b!important;padding:22px 16px!important;box-shadow:12px 0 35px rgba(17,14,30,.08)!important}.side .logo{font-size:21px!important;padding:4px 10px 30px!important}.side .logo-b{width:44px!important;height:44px!important;border-radius:14px!important;background:linear-gradient(135deg,#7357ff,#9b86ff)!important;box-shadow:0 10px 24px rgba(115,87,255,.28)!important}.nav{gap:6px!important}.nav button{padding:12px 14px!important;border-radius:12px!important;color:#aaa7b8!important;font-weight:650!important}.nav button.active{background:linear-gradient(90deg,#2b2541,#211d32)!important;color:#fff!important;box-shadow:inset 3px 0 0 #7357ff!important}.nav button:hover{background:#211d32!important;color:#fff!important}.content{max-width:1500px!important;padding:34px 38px 50px!important}.top h2{font-size:30px!important;font-weight:850!important;letter-spacing:-.9px!important}.hero{grid-template-columns:minmax(0,1.75fr) minmax(290px,.8fr)!important;gap:18px!important}.hero-card{min-height:220px!important;padding:30px!important;border-radius:24px!important;background:linear-gradient(135deg,#fff 0%,#f4f0ff 100%)!important;border:1px solid #e2dcfa!important;box-shadow:0 16px 42px rgba(71,48,150,.08)!important}.hero h3{font-size:27px!important;letter-spacing:-.7px!important}.hero-robot{font-size:76px!important}.grid{gap:16px!important}.card{background:#fff!important;border:1px solid #e7e7ef!important;border-radius:20px!important;padding:21px!important;box-shadow:0 5px 20px rgba(25,20,55,.035)!important}.metric{font-size:33px!important}.section{margin-top:25px!important}.section h3{font-size:18px!important}.scenario-grid{gap:16px!important}.scenario{min-height:220px!important;border-radius:20px!important;background:linear-gradient(180deg,#fff,#fcfbff)!important}.scenario:hover{transform:translateY(-2px)!important;box-shadow:0 13px 30px rgba(25,20,55,.075)!important}.scenario-title{font-size:18px!important}.tag{background:#f0edff!important;color:#6045e0!important;padding:6px 9px!important;border-radius:999px!important}.quick{border-radius:15px!important;background:#fff!important}.primary{background:linear-gradient(135deg,#7357ff,#6548ed)!important;border-radius:13px!important}.secondary{border-radius:13px!important}.chat{border-radius:20px!important;box-shadow:0 16px 42px rgba(71,48,150,.06)!important}.messages{background:#fafaff!important}.msg.manager{background:#eeeaff!important}.call-shell{border-radius:24px!important;box-shadow:0 20px 60px rgba(20,16,35,.18)!important}.invite-locked{background:#f4f3f8!important;color:#626174!important;border-color:#ddd9ea!important;cursor:not-allowed!important}.invite-note{font-size:12px;color:var(--st-muted);line-height:1.45;margin-top:7px}@media(max-width:760px){.auth-card{display:block!important;min-height:auto!important;padding:0 25px 25px!important}.auth-card:before{position:relative!important;left:auto!important;top:auto!important;bottom:auto!important;width:calc(100% + 50px)!important;height:auto!important;min-height:150px!important;margin:0 -25px 25px!important;padding:28px!important;font-size:34px!important;pointer-events:none!important}.content{padding:18px 14px!important}}`;
  function applyVisualLayer(){let style=document.getElementById('saletrening-ui-v8');if(!style){style=document.createElement('style');style.id='saletrening-ui-v8';document.head.appendChild(style)}style.textContent=css;document.documentElement.dataset.saletreningUi='v8'}
  applyVisualLayer();
  new MutationObserver(applyVisualLayer).observe(document.documentElement,{childList:true,subtree:true});

  // PROFILE RECOVERY FIX V1: never leave the UI in the "profile is loading" state.
  window.__stRecoverProfile = async function(force = false){
    const app = window.state;
    const client = window.sb;
    if(!app || !client) throw new Error('Приложение ещё не инициализировалось');
    if(!app.user){
      const session = await client.auth.getSession();
      if(session.error) throw session.error;
      if(!session.data?.session?.user) throw new Error('Сессия авторизации не найдена');
      app.user = session.data.session.user;
    }
    const uid = app.user.id;
    const q = await client.from('profiles').select('*').eq('id',uid).maybeSingle();
    if(q.error) throw q.error;
    if(!q.data) throw new Error('Профиль пользователя не найден в базе данных');
    app.profile = q.data;
    if(q.data.company_id){
      const c = await client.from('companies').select('*').eq('id',q.data.company_id).maybeSingle();
      if(c.error) console.warn('[SaleTrening] company load:',c.error);
      app.company = c.data || null;
    } else app.company = null;
    return q.data;
  };

  // Replace invitation action with a self-healing version: profile is re-read before permission checks.
  window.createCompanyInvitation=async function(){
    const out=document.getElementById('inviteResult');
    const button=document.querySelector('#inviteBox button.primary');
    try{
      await window.__stRecoverProfile(true);
      const profile=window.state.profile;
      if(!profile.company_id||!['director','admin','manager'].includes(profile.role)) throw new Error('Нет прав для приглашения сотрудников');
      const email=(document.getElementById('inviteEmail')?.value||'').trim().toLowerCase();
      const role=document.getElementById('inviteRole')?.value||'employee';
      if(!email) throw new Error('Укажи email сотрудника');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Проверь email сотрудника');
      const session=await sb.auth.getSession();
      const accessToken=session?.data?.session?.access_token;
      if(!accessToken) throw new Error('Сессия руководителя истекла. Войдите снова.');
      if(button){button.disabled=true;button.textContent='Отправляем…'}
      const {data,error}=await sb.functions.invoke('send-company-invitation',{body:{email,role,origin:location.origin}});
      if(error) throw error;
      if(!data?.ok) throw new Error(data?.message||'Не удалось отправить приглашение');
      if(out) out.innerHTML=`<div class="card" style="margin-top:14px;background:#faf9ff"><b>Приглашение отправлено</b><div class="muted" style="margin-top:6px">Письмо отправлено на <strong>${esc(email)}</strong>. Email менеджера закреплён за приглашением и не редактируется.</div><div class="invite-note">После перехода по ссылке менеджер увидит только поля «Имя» и «Пароль».</div></div>`;
      toast('Приглашение отправлено на почту');
    }catch(e){
      console.error('[SaleTrening] invitation/profile:',e);
      if(out) out.innerHTML=`<div class="card" style="margin-top:14px;background:#fff5f5;border-color:#f0cccc"><b>Не удалось выполнить действие</b><div class="muted" style="margin-top:6px">${esc(e?.message||'Ошибка загрузки профиля')}</div></div>`;
      toast(e?.message||'Ошибка');
    }finally{if(button){button.disabled=false;button.textContent='Создать приглашение'}}
  };

  // If the original boot has already been defined, wrap it. The wrapper performs an
  // immediate profile read and only falls back to the original loader for the rest.
  const waitForBoot = () => {
    if(typeof window.boot !== 'function') return setTimeout(waitForBoot,50);
    if(window.__stBootWrapped) return;
    window.__stBootWrapped=true;
    const originalBoot=window.boot;
    window.boot=async function(user){
      try{
        if(user) window.state.user=user;
        await window.__stRecoverProfile(true);
        // The original boot also loads scenarios/stats/history and renders the app.
        // It may perform the same profile query, but this query is now guaranteed to succeed first.
        return await originalBoot.call(this,user);
      }catch(e){
        console.error('[SaleTrening] boot/profile recovery:',e);
        const r=document.getElementById('root');
        if(r) r.innerHTML=`<div class="auth"><div class="auth-card" style="padding:42px;min-height:0!important"><h1>Не удалось загрузить профиль</h1><div class="sub">${esc(e?.message||'Неизвестная ошибка')}</div><div class="auth-actions"><button class="primary" onclick="location.reload()">Повторить</button><button class="secondary" onclick="sb.auth.signOut().then(()=>location.reload())">Выйти и войти снова</button></div></div></div>`;
      }
    };
  };
  waitForBoot();

  const s=document.createElement('script');s.src='/cold-call-filters.js?v=3';s.defer=true;document.head.appendChild(s);
})();