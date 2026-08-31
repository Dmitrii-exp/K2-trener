(() => {
  'use strict';

  // Canva visual layer only. Do not touch Supabase auth, profile state,
  // boot(), invitation handlers, or application data.
  const css = `
    :root{--st-purple:#7357ff;--st-purple-2:#9b86ff;--st-bg:#f6f7fb;--st-card:#fff;--st-text:#171827;--st-muted:#85889a;--st-line:#e7e7ef;--st-dark:#15131f;--st-dark-2:#25213a}
    html,body{background:var(--st-bg)!important;color:var(--st-text)!important}
    body{font-family:Inter,ui-sans-serif,Arial,sans-serif!important}
    .auth{background:radial-gradient(circle at 12% 15%,#e9e3ff 0,transparent 32%),radial-gradient(circle at 90% 85%,#eeeaff 0,transparent 30%),#f7f7fb!important;padding:28px!important}
    .auth-card{width:min(1040px,100%)!important;min-height:620px!important;display:block!important;position:relative!important;padding:42px 50px 42px 52%!important;overflow:hidden!important;border-radius:30px!important;border:1px solid #e2def0!important;box-shadow:0 30px 90px rgba(42,30,85,.14)!important;background:#fff!important}
    .auth-card:before{content:"SaleTrening";display:flex;align-items:flex-end;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:48%!important;height:100%!important;box-sizing:border-box!important;padding:42px!important;color:#fff!important;font-size:42px!important;font-weight:900!important;letter-spacing:-1.5px!important;background:linear-gradient(145deg,#171425 0%,#211b38 55%,#35265c 100%)!important;pointer-events:none!important;z-index:0!important}
    .auth-card>*{position:relative!important;z-index:1!important}
    .auth-card input,.auth-card textarea,.auth-card select,.auth-card button{position:relative!important;z-index:2!important;pointer-events:auto!important}
    .shell{grid-template-columns:264px minmax(0,1fr)!important;background:#f6f7fb!important}
    .side{background:linear-gradient(180deg,#15131f 0%,#1b1729 100%)!important;border-right:1px solid #2b263b!important;padding:22px 16px!important;box-shadow:12px 0 35px rgba(17,14,30,.08)!important}
    .side .logo{font-size:21px!important;padding:4px 10px 30px!important}
    .side .logo-b{width:44px!important;height:44px!important;border-radius:14px!important;background:linear-gradient(135deg,#7357ff,#9b86ff)!important;box-shadow:0 10px 24px rgba(115,87,255,.28)!important}
    .nav{gap:6px!important}.nav button{padding:12px 14px!important;border-radius:12px!important;color:#aaa7b8!important;font-weight:650!important}
    .nav button.active{background:linear-gradient(90deg,#2b2541,#211d32)!important;color:#fff!important;box-shadow:inset 3px 0 0 #7357ff!important}
    .nav button:hover{background:#211d32!important;color:#fff!important}
    .content{max-width:1500px!important;padding:34px 38px 50px!important}
    .top h2{font-size:30px!important;font-weight:850!important;letter-spacing:-.9px!important}
    .hero{grid-template-columns:minmax(0,1.75fr) minmax(290px,.8fr)!important;gap:18px!important}
    .hero-card{min-height:220px!important;padding:30px!important;border-radius:24px!important;background:linear-gradient(135deg,#fff 0%,#f4f0ff 100%)!important;border:1px solid #e2dcfa!important;box-shadow:0 16px 42px rgba(71,48,150,.08)!important}
    .hero h3{font-size:27px!important;letter-spacing:-.7px!important}.hero-robot{font-size:76px!important}
    .grid{gap:16px!important}.card{background:#fff!important;border:1px solid #e7e7ef!important;border-radius:20px!important;padding:21px!important;box-shadow:0 5px 20px rgba(25,20,55,.035)!important}
    .metric{font-size:33px!important}.section{margin-top:25px!important}.section h3{font-size:18px!important}
    .scenario-grid{gap:16px!important}.scenario{min-height:220px!important;border-radius:20px!important;background:linear-gradient(180deg,#fff,#fcfbff)!important}
    .scenario:hover{transform:translateY(-2px)!important;box-shadow:0 13px 30px rgba(25,20,55,.075)!important}.scenario-title{font-size:18px!important}
    .tag{background:#f0edff!important;color:#6045e0!important;padding:6px 9px!important;border-radius:999px!important}
    .quick{border-radius:15px!important;background:#fff!important}.primary{background:linear-gradient(135deg,#7357ff,#6548ed)!important;border-radius:13px!important}.secondary{border-radius:13px!important}
    .chat{border-radius:20px!important;box-shadow:0 16px 42px rgba(71,48,150,.06)!important}.messages{background:#fafaff!important}.msg.manager{background:#eeeaff!important}
    .call-shell{border-radius:24px!important;box-shadow:0 20px 60px rgba(20,16,35,.18)!important}
    .invite-locked{background:#f4f3f8!important;color:#626174!important;border-color:#ddd9ea!important;cursor:not-allowed!important}
    .invite-note{font-size:12px;color:var(--st-muted);line-height:1.45;margin-top:7px}
    @media(max-width:760px){.auth-card{display:block!important;min-height:auto!important;padding:0 25px 25px!important}.auth-card:before{position:relative!important;left:auto!important;top:auto!important;bottom:auto!important;width:calc(100% + 50px)!important;height:auto!important;min-height:150px!important;margin:0 -25px 25px!important;padding:28px!important;font-size:34px!important}.content{padding:18px 14px!important}}
  `;

  function applyVisualLayer(){
    let style=document.getElementById('saletrening-ui-v9');
    if(!style){
      style=document.createElement('style');
      style.id='saletrening-ui-v9';
      document.head.appendChild(style);
    }
    style.textContent=css;
    document.documentElement.dataset.saletreningUi='v9';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyVisualLayer,{once:true});
  else applyVisualLayer();
})();