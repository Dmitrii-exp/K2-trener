(() => {
  'use strict';

  /* SALETrening UI FORCE v5 — Cloudflare */
  /* This file is intentionally self-contained so the visual layer is applied
     after the application styles and survives cached/old inline CSS. */
  const css = `
    :root{
      --st-purple:#7357ff;--st-purple-2:#9b86ff;--st-bg:#f6f7fb;
      --st-card:#ffffff;--st-text:#171827;--st-muted:#85889a;
      --st-line:#e7e7ef;--st-dark:#15131f;--st-dark-2:#25213a;
    }
    html,body{background:var(--st-bg)!important;color:var(--st-text)!important}
    body{font-family:Inter,ui-sans-serif,Arial,sans-serif!important}

    /* AUTH — modern SaleTrening visual */
    .auth{
      background:radial-gradient(circle at 12% 15%,#e9e3ff 0,transparent 32%),
                 radial-gradient(circle at 90% 85%,#eeeaff 0,transparent 30%),#f7f7fb!important;
      padding:28px!important;
    }
    .auth-card{
      width:min(1040px,100%)!important;min-height:620px!important;
      display:grid!important;grid-template-columns:1.05fr .95fr!important;
      padding:0!important;overflow:hidden!important;border-radius:30px!important;
      border:1px solid #e2def0!important;
      box-shadow:0 30px 90px rgba(42,30,85,.14)!important;
    }
    .auth-card:before{
      content:"SaleTrening";display:flex;align-items:flex-end;
      padding:42px;color:#fff;font-size:42px;font-weight:900;letter-spacing:-1.5px;
      background:linear-gradient(145deg,#171425 0%,#211b38 55%,#35265c 100%);
      position:relative;min-height:100%;
    }
    .auth-card>*:not(:first-child){position:relative}
    .auth-brand{padding-top:34px!important}
    .auth-card h1{font-size:34px!important;letter-spacing:-1px!important}

    /* APP SHELL */
    .shell{grid-template-columns:264px minmax(0,1fr)!important;background:#f6f7fb!important}
    .side{
      background:linear-gradient(180deg,#15131f 0%,#1b1729 100%)!important;
      border-right:1px solid #2b263b!important;padding:22px 16px!important;
      box-shadow:12px 0 35px rgba(17,14,30,.08)!important;
    }
    .side .logo{font-size:21px!important;padding:4px 10px 30px!important}
    .side .logo-b{
      width:44px!important;height:44px!important;border-radius:14px!important;
      background:linear-gradient(135deg,#7357ff,#9b86ff)!important;
      box-shadow:0 10px 24px rgba(115,87,255,.28)!important;
    }
    .nav{gap:6px!important}
    .nav button{
      padding:12px 14px!important;border-radius:12px!important;
      color:#aaa7b8!important;font-weight:650!important;
    }
    .nav button.active{
      background:linear-gradient(90deg,#2b2541,#211d32)!important;
      color:#fff!important;box-shadow:inset 3px 0 0 #7357ff!important;
    }
    .nav button:hover{background:#211d32!important;color:#fff!important}

    .content{max-width:1500px!important;padding:34px 38px 50px!important}
    .top h2{font-size:30px!important;font-weight:850!important;letter-spacing:-.9px!important}
    .top .muted{margin-top:5px!important}

    /* HERO / DASHBOARD */
    .hero{grid-template-columns:minmax(0,1.75fr) minmax(290px,.8fr)!important;gap:18px!important}
    .hero-card{
      min-height:220px!important;padding:30px!important;border-radius:24px!important;
      background:linear-gradient(135deg,#fff 0%,#f4f0ff 100%)!important;
      border:1px solid #e2dcfa!important;
      box-shadow:0 16px 42px rgba(71,48,150,.08)!important;
    }
    .hero h3{font-size:27px!important;letter-spacing:-.7px!important}
    .hero-robot{font-size:76px!important}

    .grid{gap:16px!important}
    .card{
      background:#fff!important;border:1px solid #e7e7ef!important;
      border-radius:20px!important;padding:21px!important;
      box-shadow:0 5px 20px rgba(25,20,55,.035)!important;
    }
    .metric{font-size:33px!important}
    .section{margin-top:25px!important}
    .section h3{font-size:18px!important}
    .scenario-grid{gap:16px!important}
    .scenario{
      min-height:220px!important;border-radius:20px!important;
      background:linear-gradient(180deg,#fff,#fcfbff)!important;
    }
    .scenario:hover{transform:translateY(-2px)!important;box-shadow:0 13px 30px rgba(25,20,55,.075)!important}
    .scenario-title{font-size:18px!important}
    .tag{background:#f0edff!important;color:#6045e0!important;padding:6px 9px!important}
    .quick-grid{gap:12px!important}
    .quick{border-radius:15px!important;background:#fff!important}
    .primary{background:linear-gradient(135deg,#7357ff,#6548ed)!important;border-radius:13px!important}
    .secondary{border-radius:13px!important}

    /* CHAT / TABLE */
    .chat{border-radius:20px!important;box-shadow:0 16px 42px rgba(71,48,150,.06)!important}
    .messages{background:#fafaff!important}
    .msg.manager{background:#eeeaff!important}

    /* COLD CALL */
    .call-shell{border-radius:24px!important;box-shadow:0 20px 60px rgba(20,16,35,.18)!important}

    @media(max-width:760px){
      .auth-card{display:block!important;min-height:auto!important}
      .auth-card:before{min-height:150px!important;padding:28px!important;font-size:34px!important}
      .auth-brand{padding:25px!important}
      .content{padding:18px 14px!important}
    }
  `;

  function applyVisualLayer(){
    if(document.getElementById('saletrening-ui-v5')) return;
    const style=document.createElement('style');
    style.id='saletrening-ui-v5';
    style.textContent=css;
    document.head.appendChild(style);
    document.documentElement.dataset.saletreningUi='v5';
  }

  function showRecoveryMessage(){
    const root=document.getElementById('root');
    if(root && !root.innerHTML.trim()){
      root.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font:16px Arial;color:#555"><div style="max-width:560px;padding:28px;text-align:center;background:#fff;border:1px solid #e8e7ef;border-radius:18px"><b>SaleTrening не удалось запустить.</b><br><small style="display:block;margin-top:8px">Восстанавливаю подключение. Обновите страницу через несколько секунд.</small></div></div>';
    }
  }

  applyVisualLayer();

  /* Keep the visual layer active if the app replaces the root after startup. */
  new MutationObserver(() => applyVisualLayer()).observe(document.documentElement,{childList:true,subtree:true});

  /* Supabase CDN recovery retained from the previous stable implementation. */
  (async()=>{
    const hasSupabase=!!window.supabase;
    if(hasSupabase) return;
    if(!('serviceWorker' in navigator)) { showRecoveryMessage(); return; }
    try{
      const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller){
        const key='k2_sw_recovery_reload_v2';
        if(!sessionStorage.getItem(key)){
          sessionStorage.setItem(key,'1');location.reload();return;
        }
      }
      showRecoveryMessage();
    }catch(e){
      console.error('[SaleTrening] recovery service worker:',e);
      showRecoveryMessage();
    }
  })();
})();
