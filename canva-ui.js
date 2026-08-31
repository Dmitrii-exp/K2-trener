(() => {
  'use strict';

  // Canva visual layer only. Do not touch Supabase auth, profile state,
  // boot(), invitation handlers, or application data.
  const css = `
    :root{--st-purple:#7357ff;--st-purple-2:#9b86ff;--st-bg:#f6f7fb;--st-card:#fff;--st-text:#171827;--st-muted:#85889a;--st-line:#e7e7ef;--st-dark:#15131f;--st-dark-2:#25213a}
    html,body{background:var(--st-bg)!important;color:var(--st-text)!important;overflow-x:hidden}
    body{font-family:Inter,ui-sans-serif,Arial,sans-serif!important}
    .auth{background:radial-gradient(circle at 12% 15%,#e9e3ff,transparent 32%),radial-gradient(circle at 90% 85%,#eeeaff,transparent 30%),#f7f7fb!important;padding:28px!important}
    .auth-card{width:min(1040px,100%)!important;min-height:620px!important;display:block!important;position:relative!important;padding:42px 50px 42px 52%!important;overflow:hidden!important;border-radius:30px!important;border:1px solid #e2def0!important;box-shadow:0 30px 90px rgba(42,30,85,.14)!important;background:#fff!important}
    .auth-card:before{content:"SaleTrening";display:flex;align-items:flex-end;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:48%!important;height:100%!important;box-sizing:border-box!important;padding:42px!important;color:#fff!important;font-size:42px!important;font-weight:900!important;letter-spacing:-1.5px!important;background:linear-gradient(145deg,#171425 0%,#211b38 55%,#35265c 100%)!important;pointer-events:none!important;z-index:0!important}
    .auth-card>*{position:relative!important;z-index:1!important}.auth-card input,.auth-card textarea,.auth-card select,.auth-card button{position:relative!important;z-index:2!important;pointer-events:auto!important}
    .shell{grid-template-columns:264px minmax(0,1fr)!important;background:#f6f7fb!important}.side{background:linear-gradient(180deg,#15131f 0%,#1b1729 100%)!important;border-right:1px solid #2b263b!important;padding:22px 16px!important;box-shadow:12px 0 35px rgba(17,14,30,.08)!important}.side .logo{font-size:21px!important;padding:4px 10px 30px!important}.side .logo-b{width:44px!important;height:44px!important;border-radius:14px!important;background:linear-gradient(135deg,#7357ff,#9b86ff)!important;box-shadow:0 10px 24px rgba(115,87,255,.28)!important}.nav{gap:6px!important}.nav button{padding:12px 14px!important;border-radius:12px!important;color:#aaa7b8!important;font-weight:650!important}.nav button.active{background:linear-gradient(90deg,#2b2541,#211d32)!important;color:#fff!important;box-shadow:inset 3px 0 0 #7357ff!important}.nav button:hover{background:#211d32!important;color:#fff!important}.content{max-width:1500px!important;padding:34px 38px 50px!important}.top h2{font-size:30px!important;font-weight:850!important;letter-spacing:-.9px!important}.hero{grid-template-columns:minmax(0,1.75fr) minmax(290px,.8fr)!important;gap:18px!important}.hero-card{min-height:220px!important;padding:30px!important;border-radius:24px!important;background:linear-gradient(135deg,#fff 0%,#f4f0ff 100%)!important;border:1px solid #e2dcfa!important;box-shadow:0 16px 42px rgba(71,48,150,.08)!important}.hero h3{font-size:27px!important;letter-spacing:-.7px!important}.hero-robot{font-size:76px!important}.grid{gap:16px!important}.card{background:#fff!important;border:1px solid #e7e7ef!important;border-radius:20px!important;padding:21px!important;box-shadow:0 5px 20px rgba(25,20,55,.035)!important}.metric{font-size:33px!important}.section{margin-top:25px!important}.section h3{font-size:18px!important}.scenario-grid{gap:16px!important}.scenario{min-height:220px!important;border-radius:20px!important;background:linear-gradient(180deg,#fff,#fcfbff)!important}.scenario:hover{transform:translateY(-2px)!important;box-shadow:0 13px 30px rgba(25,20,55,.075)!important}.scenario-title{font-size:18px!important}.tag{background:#f0edff!important;color:#6045e0!important;padding:6px 9px!important;border-radius:999px!important}.quick{border-radius:15px!important;background:#fff!important}.primary{background:linear-gradient(135deg,#7357ff,#6548ed)!important;border-radius:13px!important}.secondary{border-radius:13px!important}.chat{border-radius:20px!important;box-shadow:0 16px 42px rgba(71,48,150,.06)!important}.messages{background:#fafaff!important}.msg.manager{background:#eeeaff!important}.call-shell{border-radius:24px!important;box-shadow:0 20px 60px rgba(20,16,35,.18)!important}.invite-locked{background:#f4f3f8!important;color:#626274!important;border-color:#ddd9ea!important;cursor:not-allowed!important}.invite-note{font-size:12px;color:var(--st-muted);line-height:1.45;margin-top:7px}
    @media(max-width:760px){
      html,body{width:100%!important;min-width:0!important;overflow-x:hidden!important}
      .shell{display:block!important;width:100%!important;min-height:100vh!important}
      .side{position:relative!important;top:auto!important;width:100%!important;height:auto!important;min-height:0!important;padding:10px 10px 9px!important;border-right:0!important;border-bottom:1px solid #2b263b!important;box-shadow:0 6px 20px rgba(17,14,30,.14)!important;z-index:10!important}
      .side .logo{padding:2px 5px 9px!important;font-size:19px!important}.side .logo-b{width:38px!important;height:38px!important;border-radius:12px!important}
      .nav{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}.nav button{width:100%!important;min-width:0!important;padding:9px 7px!important;border-radius:10px!important;font-size:12px!important;line-height:1.15!important;white-space:normal!important}.nav-icon{width:18px!important;font-size:14px!important}
      .side-bottom{margin-top:8px!important;padding-top:8px!important;border-top:1px solid #2b263b!important}.user-mini{margin:0 5px 6px!important;font-size:11px!important}.side-bottom button{width:100%!important;min-height:42px!important}
      .content{width:100%!important;max-width:none!important;padding:15px 11px 30px!important;margin:0!important;overflow:visible!important}
      .top{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:8px!important;margin-bottom:14px!important}.top h2{font-size:24px!important;line-height:1.12!important}.top-actions{width:100%!important;display:flex!important;flex-wrap:wrap!important;gap:7px!important}.top-actions>*{max-width:100%!important}
      .hero{display:block!important;margin-bottom:12px!important}.hero-card{width:100%!important;min-height:0!important;margin-bottom:10px!important;padding:18px!important;border-radius:18px!important;overflow:hidden!important}.hero h3{font-size:21px!important;line-height:1.2!important;max-width:100%!important}.hero-robot{display:none!important}
      .grid{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}.card{width:100%!important;min-width:0!important;padding:15px!important;border-radius:16px!important}.metric{font-size:28px!important}
      .section{margin-top:17px!important}.section-head{align-items:flex-start!important;flex-wrap:wrap!important;gap:7px!important}.section h3{font-size:17px!important}.scenario-grid{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}.scenario{width:100%!important;min-height:0!important;padding:15px!important}.scenario-title{font-size:16px!important}
      .quick-grid{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}.quick{width:100%!important;padding:13px!important}.progress-card{display:flex!important;align-items:center!important;gap:11px!important;min-width:0!important}.ring{flex:0 0 70px!important;width:70px!important;height:70px!important}
      .chat{width:100%!important;height:calc(100dvh - 200px)!important;min-height:420px!important;max-height:none!important;border-radius:16px!important}.messages{padding:13px!important}.msg{max-width:88%!important;font-size:14px!important;padding:10px 12px!important}.composer{display:flex!important;flex-wrap:wrap!important;gap:7px!important;padding:8px!important}.composer textarea{width:100%!important;min-height:70px!important;order:2!important}.composer .primary{flex:1 1 auto!important;min-height:44px!important}.voice{min-height:44px!important}
      .table{display:block!important;width:100%!important;overflow-x:auto!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch}.table th,.table td{padding:8px!important;font-size:12px!important}.empty{padding:26px 13px!important}.toast{left:10px!important;right:10px!important;bottom:10px!important;text-align:center!important}
      .call-shell{width:100%!important;max-width:none!important;border-radius:18px!important}.call-head{padding:19px 15px!important}.call-body{padding:13px!important}.call-live-text{font-size:17px!important}.call-controls{gap:7px!important}.call-btn{min-width:49px!important;height:50px!important;padding:0 13px!important}
      .auth{min-height:100dvh!important;padding:12px!important;place-items:center!important}.auth-card{width:100%!important;min-height:0!important;padding:0 17px 20px!important;border-radius:20px!important}.auth-card:before{position:relative!important;left:auto!important;top:auto!important;bottom:auto!important;width:calc(100% + 34px)!important;height:auto!important;min-height:115px!important;margin:0 -17px 18px!important;padding:23px!important;font-size:29px!important;align-items:flex-end!important}.auth-brand{gap:8px!important}.auth-brand .logo{font-size:18px!important}.auth-brand .logo-b{width:38px!important;height:38px!important}.auth-actions{display:flex!important;flex-direction:column!important;gap:8px!important}.auth-actions button{width:100%!important;min-height:44px!important}.field input,.field textarea,.field select{font-size:16px!important;min-height:44px!important}
    }
    @media(max-width:380px){.content{padding-left:9px!important;padding-right:9px!important}.side{padding-left:8px!important;padding-right:8px!important}.nav button{font-size:11px!important;padding:8px 5px!important}.top h2{font-size:22px!important}.hero-card{padding:15px!important}.card{padding:13px!important}}
  `;

  function applyVisualLayer(){
    let style=document.getElementById('saletrening-ui-v10');
    if(!style){style=document.createElement('style');style.id='saletrening-ui-v10';document.head.appendChild(style)}
    style.textContent=css;
    document.documentElement.dataset.saletreningUi='v10';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyVisualLayer,{once:true});
  else applyVisualLayer();

  // Restore the existing Cold Call filters/product field without touching app logic.
  function loadColdCallFilters(){
    if(window.__stColdFiltersLoaded || document.querySelector('script[data-st-cold-filters]')) return;
    const script=document.createElement('script');
    script.src='/cold-call-filters.js?v=restore-20260831';
    script.async=false;
    script.dataset.stColdFilters='1';
    script.onload=()=>{window.__stColdFiltersLoaded=true};
    script.onerror=()=>{console.warn('[SaleTrening] cold-call-filters.js failed to load')};
    document.head.appendChild(script);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadColdCallFilters,{once:true});
  else loadColdCallFilters();

  // Enable continuous cold-call voice dialogue. Existing call logic remains the source of truth.
  function loadColdCallVoice(){
    if(window.__stColdVoiceLoaded || document.querySelector('script[data-st-cold-voice]')) return;
    const script=document.createElement('script');
    script.src='/cold-call-voice.js?v=20260831-1';
    script.async=false;
    script.dataset.stColdVoice='1';
    script.onload=()=>{window.__stColdVoiceLoaded=true};
    script.onerror=()=>{console.warn('[SaleTrening] cold-call-voice.js failed to load')};
    document.head.appendChild(script);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadColdCallVoice,{once:true});
  else loadColdCallVoice();
})();