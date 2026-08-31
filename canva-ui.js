(() => {
  'use strict';

  /* SALETrening UI FORCE v6 — Cloudflare */
  const css = `
    :root{--st-purple:#7357ff;--st-purple-2:#9b86ff;--st-bg:#f6f7fb;--st-card:#ffffff;--st-text:#171827;--st-muted:#85889a;--st-line:#e7e7ef;--st-dark:#15131f;--st-dark-2:#25213a}
    html,body{background:var(--st-bg)!important;color:var(--st-text)!important}
    body{font-family:Inter,ui-sans-serif,Arial,sans-serif!important}
    .auth{background:radial-gradient(circle at 12% 15%,#e9e3ff 0,transparent 32%),radial-gradient(circle at 90% 85%,#eeeaff 0,transparent 30%),#f7f7fb!important;padding:28px!important}
    .auth-card{width:min(1040px,100%)!important;min-height:620px!important;display:grid!important;grid-template-columns:1.05fr .95fr!important;padding:0!important;overflow:hidden!important;border-radius:30px!important;border:1px solid #e2def0!important;box-shadow:0 30px 90px rgba(42,30,85,.14)!important}
    .auth-card:before{content:"SaleTrening";display:flex;align-items:flex-end;padding:42px;color:#fff;font-size:42px;font-weight:900;letter-spacing:-1.5px;background:linear-gradient(145deg,#171425 0%,#211b38 55%,#35265c 100%);position:relative;min-height:100%}
    .auth-card>*:not(:first-child){position:relative}.auth-brand{padding-top:34px!important}.auth-card h1{font-size:34px!important;letter-spacing:-1px!important}
    .shell{grid-template-columns:264px minmax(0,1fr)!important;background:#f6f7fb!important}.side{background:linear-gradient(180deg,#15131f 0%,#1b1729 100%)!important;border-right:1px solid #2b263b!important;padding:22px 16px!important;box-shadow:12px 0 35px rgba(17,14,30,.08)!important}.side .logo{font-size:21px!important;padding:4px 10px 30px!important}.side .logo-b{width:44px!important;height:44px!important;border-radius:14px!important;background:linear-gradient(135deg,#7357ff,#9b86ff)!important;box-shadow:0 10px 24px rgba(115,87,255,.28)!important}.nav{gap:6px!important}.nav button{padding:12px 14px!important;border-radius:12px!important;color:#aaa7b8!important;font-weight:650!important}.nav button.active{background:linear-gradient(90deg,#2b2541,#211d32)!important;color:#fff!important;box-shadow:inset 3px 0 0 #7357ff!important}.nav button:hover{background:#211d32!important;color:#fff!important}.content{max-width:1500px!important;padding:34px 38px 50px!important}.top h2{font-size:30px!important;font-weight:850!important;letter-spacing:-.9px!important}.top .muted{margin-top:5px!important}.hero{grid-template-columns:minmax(0,1.75fr) minmax(290px,.8fr)!important;gap:18px!important}.hero-card{min-height:220px!important;padding:30px!important;border-radius:24px!important;background:linear-gradient(135deg,#fff 0%,#f4f0ff 100%)!important;border:1px solid #e2dcfa!important;box-shadow:0 16px 42px rgba(71,48,150,.08)!important}.hero h3{font-size:27px!important;letter-spacing:-.7px!important}.hero-robot{font-size:76px!important}.grid{gap:16px!important}.card{background:#fff!important;border:1px solid #e7e7ef!important;border-radius:20px!important;padding:21px!important;box-shadow:0 5px 20px rgba(25,20,55,.035)!important}.metric{font-size:33px!important}.section{margin-top:25px!important}.section h3{font-size:18px!important}.scenario-grid{gap:16px!important}.scenario{min-height:220px!important;border-radius:20px!important;background:linear-gradient(180deg,#fff,#fcfbff)!important}.scenario:hover{transform:translateY(-2px)!important;box-shadow:0 13px 30px rgba(25,20,55,.075)!important}.scenario-title{font-size:18px!important}.tag{background:#f0edff!important;color:#6045e0!important;padding:6px 9px!important}.quick-grid{gap:12px!important}.quick{border-radius:15px!important;background:#fff!important}.primary{background:linear-gradient(135deg,#7357ff,#6548ed)!important;border-radius:13px!important}.secondary{border-radius:13px!important}.chat{border-radius:20px!important;box-shadow:0 16px 42px rgba(71,48,150,.06)!important}.messages{background:#fafaff!important}.msg.manager{background:#eeeaff!important}.call-shell{border-radius:24px!important;box-shadow:0 20px 60px rgba(20,16,35,.18)!important}
    .invite-locked{background:#f4f3f8!important;color:#626174!important;border-color:#ddd9ea!important;cursor:not-allowed!important}
    .invite-note{font-size:12px;color:var(--st-muted);line-height:1.45;margin-top:7px}
    @media(max-width:760px){.auth-card{display:block!important;min-height:auto!important}.auth-card:before{min-height:150px!important;padding:28px!important;font-size:34px!important}.auth-brand{padding:25px!important}.content{padding:18px 14px!important}}
  `;

  function applyVisualLayer(){
    let style=document.getElementById('saletrening-ui-v6');
    if(!style){style=document.createElement('style');style.id='saletrening-ui-v6';document.head.appendChild(style)}
    style.textContent=css;
    document.documentElement.dataset.saletreningUi='v6';
  }

  function showRecoveryMessage(){
    const root=document.getElementById('root');
    if(root && !root.innerHTML.trim()) root.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font:16px Arial;color:#555"><div style="max-width:560px;padding:28px;text-align:center;background:#fff;border:1px solid #e8e7ef;border-radius:18px"><b>SaleTrening не удалось запустить.</b><br><small style="display:block;margin-top:8px">Восстанавливаю подключение. Обновите страницу через несколько секунд.</small></div></div>';
  }

  applyVisualLayer();
  new MutationObserver(applyVisualLayer).observe(document.documentElement,{childList:true,subtree:true});

  /* Finish manager invitation flow: send the invitation email through the
     already deployed Supabase Edge Function and let auth-invite.js handle the
     locked-email registration screen after the magic-link redirect. */
  window.createCompanyInvitation=async function(){
    if(!window.state?.user||!window.state?.profile){toast('Профиль ещё загружается. Обновите страницу через секунду.');return}
    const profile=window.state.profile;
    if(!profile.company_id||!['director','admin','manager'].includes(profile.role)){toast('Нет прав для приглашения сотрудников');return}
    const email=(document.getElementById('inviteEmail')?.value||'').trim().toLowerCase();
    const role=document.getElementById('inviteRole')?.value||'employee';
    const out=document.getElementById('inviteResult');
    if(!email){toast('Укажи email сотрудника');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Проверь email сотрудника');return}
    const button=document.querySelector('#inviteBox button.primary');
    if(button){button.disabled=true;button.textContent='Отправляем…'}
    try{
      const session=await sb.auth.getSession();
      const token=session?.data?.session?.access_token;
      if(!token)throw new Error('Сессия руководителя истекла. Войдите снова.');
      const {data,error}=await sb.functions.invoke('send-company-invitation',{body:{email,role,origin:location.origin}});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.message||'Не удалось отправить приглашение');
      if(out)out.innerHTML=`<div class="card" style="margin-top:14px;background:#faf9ff"><b>Приглашение отправлено</b><div class="muted" style="margin-top:6px">Письмо отправлено на <strong>${esc(email)}</strong>. Email менеджера закреплён за приглашением и не редактируется.</div><div class="invite-note">После перехода по ссылке менеджер увидит только поля «Имя» и «Пароль».</div></div>`;
      toast('Приглашение отправлено на почту');
    }catch(e){
      console.error('[SaleTrening] invitation:',e);
      if(out)out.innerHTML=`<div class="card" style="margin-top:14px;background:#fff5f5;border-color:#f0cccc"><b>Не удалось отправить письмо</b><div class="muted" style="margin-top:6px">${esc(e?.message||'Проверьте настройки почтового сервиса Supabase')}</div></div>`;
      toast(e?.message||'Ошибка отправки приглашения');
    }finally{if(button){button.disabled=false;button.textContent='Создать приглашение'}}
  };

  /* Supabase CDN recovery retained from the stable implementation. */
  (async()=>{
    if(window.supabase) return;
    if(!('serviceWorker' in navigator)){showRecoveryMessage();return}
    try{
      await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller){
        const key='k2_sw_recovery_reload_v2';
        if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');location.reload();return}
      }
      showRecoveryMessage();
    }catch(e){console.error('[SaleTrening] recovery service worker:',e);showRecoveryMessage()}
  })();
})();
