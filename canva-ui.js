(() => {
  'use strict';
  const STYLE_ID='canva-sale-ui-real-v5';
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{
 --c-purple:#7357ff;--c-purple2:#9b86ff;--c-ink:#171525;--c-bg:#f7f7fb;--c-card:#fff;
 --c-line:#e8e7ef;--c-muted:#85889a;--c-dark:#15131f;--c-dark2:#25213a;
 --c-green:#20b486;--c-shadow:0 12px 34px rgba(27,21,52,.055)
}
*{box-sizing:border-box}
html,body{background:var(--c-bg)!important;color:var(--c-ink)!important}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
.shell.canva-shell{display:grid!important;grid-template-columns:270px minmax(0,1fr)!important;min-height:100vh!important;background:var(--c-bg)!important}
.side.canva-side{background:linear-gradient(180deg,#15131f 0%,#1b1729 100%)!important;color:#fff!important;padding:20px 14px!important;border-right:1px solid #2b263b!important;box-shadow:12px 0 35px rgba(16,13,28,.08)!important}
.canva-side .logo{padding:6px 12px 30px!important;font-size:21px!important;letter-spacing:-.5px!important}
.canva-side .logo-b{width:44px!important;height:44px!important;border-radius:14px!important;background:linear-gradient(135deg,var(--c-purple),var(--c-purple2))!important;box-shadow:0 10px 25px rgba(115,87,255,.3)!important}
.canva-side .nav{gap:5px!important}
.canva-side .nav button{border:0!important;background:transparent!important;color:#aaa7b8!important;padding:12px 14px!important;border-radius:12px!important;font-size:14px!important;font-weight:650!important;transition:.16s ease!important}
.canva-side .nav button.active{background:linear-gradient(90deg,#2b2542,#211d32)!important;color:#fff!important;box-shadow:inset 3px 0 0 var(--c-purple),0 5px 18px rgba(0,0,0,.08)!important}
.canva-side .nav button:hover{background:#242037!important;color:#fff!important;transform:translateX(2px)!important}
.canva-side .nav-icon{width:24px!important;color:#bdb2ff!important;font-size:16px!important}
.canva-side .side-bottom{border-top:1px solid #2b263b!important;padding-top:16px!important}
.canva-side .user-mini{color:#aaa7b8!important;margin-bottom:12px!important}
.canva-side .secondary{background:#211d31!important;color:#fff!important;border-color:#373047!important}
.content.canva-content{padding:0 40px 54px!important;max-width:1580px!important}
.canva-toolbar{height:78px;display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 0 27px;border-bottom:1px solid var(--c-line)}
.canva-toolbar .toolbar-left{display:flex;align-items:center;gap:13px}.canva-toolbar .eyebrow{font-size:10px;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:var(--c-purple)}
.canva-toolbar .toolbar-title{font-size:15px;font-weight:800}.canva-toolbar .toolbar-right{display:flex;align-items:center;gap:10px}
.canva-toolbar .search{width:235px;height:40px;display:flex;align-items:center;border:1px solid var(--c-line);background:#fff;border-radius:12px;padding:0 13px;color:#9a9bab;font-size:13px}
.canva-toolbar .date{height:40px;display:flex;align-items:center;padding:0 12px;border:1px solid var(--c-line);border-radius:12px;background:#fff;font-size:12px;color:#5e6070}
.canva-toolbar .avatar{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:#eeeaff;color:var(--c-purple);font-weight:850}
.canva-content #page>.top{margin-bottom:22px!important}.canva-content #page>.top h2{font-size:32px!important;font-weight:850!important;letter-spacing:-1.1px!important}
.canva-content #page>.top .muted{margin-top:5px}
.canva-content .hero{grid-template-columns:minmax(0,1.7fr) minmax(290px,.78fr)!important;gap:20px!important;margin-bottom:20px!important}
.canva-content .hero-card{min-height:238px!important;padding:32px!important;border-radius:26px!important;border:1px solid #e1dbf7!important;background:linear-gradient(135deg,#fff 0%,#f3efff 100%)!important;box-shadow:0 18px 45px rgba(72,49,150,.08)!important}
.canva-content .hero-card:after{width:300px!important;height:300px!important;right:-115px!important;top:-125px!important;background:#7357ff0d!important}
.canva-content .hero-card h3{font-size:29px!important;letter-spacing:-.7px!important;max-width:650px!important}.canva-content .hero-card .muted{max-width:650px!important;font-size:14px!important;line-height:1.65!important}
.canva-content .hero-robot{font-size:82px!important;right:34px!important;bottom:17px!important}
.canva-content .grid{gap:16px!important}.canva-content .card{border:1px solid var(--c-line)!important;border-radius:20px!important;background:#fff!important;box-shadow:0 5px 20px rgba(27,21,52,.035)!important;transition:.16s ease!important}
.canva-content .card:hover{box-shadow:0 12px 32px rgba(27,21,52,.065)!important}.canva-content .metric{font-size:34px!important;font-weight:850!important;letter-spacing:-1px!important}.canva-content .metric-label{font-size:10px!important;text-transform:uppercase;letter-spacing:.09em;color:#9698a8!important;font-weight:800!important}
.canva-kpi-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 22px}.canva-kpi{min-height:142px;padding:20px 21px;border-radius:20px;background:#fff;border:1px solid var(--c-line);box-shadow:0 5px 20px rgba(27,21,52,.035)}
.canva-kpi .kpi-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#eeeaff;color:var(--c-purple);font-size:16px;font-weight:900;margin-bottom:13px}.canva-kpi .metric{margin-top:0!important}.canva-kpi .metric-label{display:block;margin-top:4px}
.canva-content .section{margin-top:27px!important}.canva-content .section-head{margin-bottom:14px!important}.canva-content .section-head h3{font-size:19px!important;font-weight:820!important;letter-spacing:-.25px!important}
.canva-content .scenario-grid{gap:16px!important}.canva-content .scenario{min-height:226px!important;padding:21px!important;border-radius:20px!important;background:linear-gradient(180deg,#fff,#fcfbff)!important}.canva-content .scenario-title{font-size:18px!important;letter-spacing:-.25px!important}.canva-content .tag{background:#f0edff!important;color:#6045e0!important;border:1px solid #e5defe!important;padding:6px 9px!important;border-radius:999px!important}
.canva-content .primary{border-radius:13px!important;background:linear-gradient(135deg,#7357ff,#6548ed)!important;box-shadow:0 9px 20px rgba(115,87,255,.2)!important}.canva-content .secondary{border-radius:13px!important}
.canva-content .quick-grid{gap:14px!important}.canva-content .quick{border-radius:17px!important;padding:18px!important;background:#fff!important;transition:.16s ease!important}.canva-content .quick:hover{transform:translateY(-2px)!important;box-shadow:0 10px 25px rgba(27,21,52,.06)!important;border-color:#d7ceff!important}
.canva-content .progress-card{min-height:142px!important;padding:22px!important}.canva-content .ring{width:88px!important;height:88px!important}.canva-content .bar{height:9px!important}.canva-content .chat{height:590px!important;border-radius:22px!important;box-shadow:var(--c-shadow)!important}.canva-content .messages{background:#faf9ff!important;padding:22px!important}.canva-content .msg{border-radius:16px!important;padding:13px 15px!important}.canva-content .msg.manager{background:#eeeaff!important}.canva-content .composer{padding:14px!important}.canva-content .composer textarea{border-radius:13px!important}.canva-content .table{background:#fff!important}.canva-content .table th{background:#faf9ff!important;text-transform:uppercase!important;font-size:10px!important;letter-spacing:.06em!important}
.canva-content .auth-card{border-radius:30px!important}.canva-content .call-shell{border-radius:26px!important;box-shadow:var(--c-shadow)!important}
@media(max-width:1050px){.content.canva-content{padding:0 25px 42px!important}.canva-toolbar .search{width:170px}.canva-kpi-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.shell.canva-shell{grid-template-columns:1fr!important}.side.canva-side{height:auto!important;position:relative!important;padding:12px!important;box-shadow:none!important}.canva-content{padding:0 14px 30px!important}.canva-toolbar{height:auto;min-height:68px;padding:12px 0;flex-wrap:wrap}.canva-toolbar .search{display:none}.canva-toolbar .toolbar-right{margin-left:auto}.canva-kpi-row{grid-template-columns:1fr}.canva-content #page>.top h2{font-size:27px!important}.canva-content .hero-card{min-height:0!important;padding:23px!important}.canva-content .hero-robot{display:none!important}}
`;
  document.head.appendChild(style);

  function initials(name){return String(name||'S').trim().slice(0,1).toUpperCase()}
  function enhance(){
    const root=document.getElementById('root');
    const shell=root?.querySelector('.shell');
    if(!shell)return;
    shell.classList.add('canva-shell');
    const side=shell.querySelector('.side');
    const content=shell.querySelector('.content');
    if(side)side.classList.add('canva-side');
    if(content){
      content.classList.add('canva-content');
      let bar=content.querySelector(':scope>.canva-toolbar');
      if(!bar){
        bar=document.createElement('div');
        bar.className='canva-toolbar';
        const name=window.state?.profile?.first_name||window.state?.user?.email||'Профиль';
        bar.innerHTML='<div class="toolbar-left"><div><div class="eyebrow">SALE TRAINING</div><div class="toolbar-title">AI Sales Coach</div></div></div><div class="toolbar-right"><div class="search">⌕&nbsp;&nbsp;Поиск по тренировкам</div><div class="date">Сегодня · '+new Date().toLocaleDateString('ru-RU')+'</div><div class="avatar">'+initials(name)+'</div></div>';
        content.insertBefore(bar,content.firstChild);
      }
    }
    enhanceHome();
  }
  function enhanceHome(){
    const page=document.getElementById('page');
    if(!page||!page.querySelector('.hero'))return;
    const grid=page.querySelector(':scope>.grid');
    if(grid&&!page.querySelector('.canva-kpi-row')){
      const cards=[...grid.children];
      if(cards.length>=4){
        const row=document.createElement('div');row.className='canva-kpi-row';
        const icons=['✓','↗','★','◷'];
        cards.slice(0,4).forEach((c,i)=>{const k=document.createElement('div');k.className='canva-kpi';k.innerHTML='<div class="kpi-icon">'+icons[i]+'</div>'+c.innerHTML;row.appendChild(k)});
        grid.replaceWith(row);
      }
    }
  }
  const mo=new MutationObserver(()=>enhance());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();