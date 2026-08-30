(() => {
  'use strict';
  const STYLE_ID='canva-sale-ui-real-v1';
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
:root{
 --c-purple:#7457ff;--c-purple-2:#9a84ff;--c-ink:#171525;--c-ink-2:#211c32;
 --c-bg:#f6f6fa;--c-card:#fff;--c-line:#e9e8ef;--c-muted:#8b8c9c;
 --c-green:#20b486;--c-red:#e85b69;--c-shadow:0 14px 38px rgba(28,22,52,.07)
}
html,body{background:var(--c-bg)!important;color:var(--c-ink)!important}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
.canva-shell{grid-template-columns:272px minmax(0,1fr)!important;background:var(--c-bg)!important}
.canva-side{background:linear-gradient(180deg,#15131f 0%,#1a1728 100%)!important;padding:20px 14px!important;border-right:1px solid #2b263b!important;box-shadow:10px 0 32px rgba(18,15,31,.08)!important}
.canva-side .logo{padding:6px 12px 28px!important;font-size:21px!important;letter-spacing:-.4px}
.canva-side .logo-b{width:44px!important;height:44px!important;border-radius:14px!important;background:linear-gradient(135deg,var(--c-purple),var(--c-purple-2))!important;box-shadow:0 10px 26px rgba(116,87,255,.3)!important}
.canva-side .nav{gap:5px!important}
.canva-side .nav button{position:relative;border:0!important;background:transparent!important;color:#aaa6b8!important;padding:12px 14px!important;border-radius:12px!important;font-size:14px!important;font-weight:650!important;transition:.16s ease!important}
.canva-side .nav button.active{background:linear-gradient(90deg,#2b2542,#211d31)!important;color:#fff!important;box-shadow:inset 3px 0 0 var(--c-purple),0 5px 18px rgba(0,0,0,.08)!important}
.canva-side .nav button:hover{background:#242037!important;color:#fff!important;transform:translateX(2px)!important}
.canva-side .nav-icon{width:23px!important;color:#b9adff!important;font-size:16px!important}
.canva-side .side-bottom{border-top:1px solid #2b263b;padding-top:16px!important}
.canva-side .user-mini{color:#aaa6b8!important}
.canva-side .secondary{background:#211d31!important;color:#fff!important;border-color:#373047!important}
.canva-content{padding:0 38px 52px!important;max-width:1560px!important}
.canva-content:before{content:"";display:block;height:1px}
.canva-toolbar{height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 24px;border-bottom:1px solid var(--c-line)}
.canva-toolbar .toolbar-left{display:flex;align-items:center;gap:14px}
.canva-toolbar .eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--c-purple)}
.canva-toolbar .toolbar-title{font-size:15px;font-weight:750}
.canva-toolbar .toolbar-right{display:flex;align-items:center;gap:10px}
.canva-toolbar .search{width:240px;border:1px solid var(--c-line);background:#fff;border-radius:12px;padding:10px 13px;color:var(--c-muted);font-size:13px}
.canva-toolbar .date{padding:10px 12px;border:1px solid var(--c-line);border-radius:12px;background:#fff;font-size:12px;color:#55566a}
.canva-toolbar .avatar{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#eeeaff;color:var(--c-purple);font-weight:850}
.canva-content #page>.top{margin-bottom:22px!important}
.canva-content #page>.top h2{font-size:32px!important;letter-spacing:-1px!important;font-weight:850!important}
.canva-content .hero{gap:20px!important}
.canva-content .hero-card{border:1px solid #e1dcf7!important;border-radius:26px!important;box-shadow:var(--c-shadow)!important;background:linear-gradient(135deg,#fff 0%,#f3efff 100%)!important;min-height:236px!important;padding:32px!important}
.canva-content .hero-card h3{font-size:29px!important;max-width:620px}
.canva-content .hero-card .muted{max-width:640px;font-size:14px;line-height:1.65}
.canva-content .hero-robot{font-size:84px!important;right:34px!important;bottom:18px!important}
.canva-content .card{border:1px solid var(--c-line)!important;border-radius:20px!important;box-shadow:0 5px 20px rgba(28,22,52,.035)!important;background:#fff!important}
.canva-content .card:hover{box-shadow:0 12px 32px rgba(28,22,52,.065)!important}
.canva-content .metric{font-size:34px!important;font-weight:850!important}
.canva-content .metric-label{font-size:11px!important;text-transform:uppercase;letter-spacing:.08em;color:#9899a8!important;font-weight:750!important}
.canva-content .scenario{min-height:230px!important;padding:21px!important;background:linear-gradient(180deg,#fff,#fcfbff)!important}
.canva-content .scenario-title{font-size:18px!important;letter-spacing:-.25px}
.canva-content .tag{background:#f0edff!important;color:#6348e5!important;border:1px solid #e5defe!important}
.canva-content .primary{background:linear-gradient(135deg,var(--c-purple),#6548ed)!important;border-radius:13px!important;box-shadow:0 9px 20px rgba(116,87,255,.2)!important}
.canva-content .secondary{border-radius:13px!important}
.canva-content .quick{border-radius:17px!important;padding:18px!important;background:#fff!important}
.canva-content .chat{border-radius:22px!important;box-shadow:var(--c-shadow)!important}
.canva-content .messages{background:#faf9ff!important}
.canva-content .msg{border-radius:16px!important}
.canva-content .msg.manager{background:#eeeaff!important}
.canva-content .table th{background:#faf9ff!important;text-transform:uppercase;font-size:10px!important;letter-spacing:.06em}
.canva-content .section{margin-top:26px!important}
.canva-content .section-head h3{font-size:19px!important}
.canva-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:0 0 20px}
.canva-kpi{padding:20px 21px;border-radius:20px;background:#fff;border:1px solid var(--c-line);box-shadow:0 5px 20px rgba(28,22,52,.035)}
.canva-kpi .kpi-icon{width:36px;height:36px;border-radius:11px;background:#eeeaff;color:var(--c-purple);display:grid;place-items:center;font-weight:900;margin-bottom:12px}
.canva-kpi .kpi-value{font-size:28px;font-weight:850;letter-spacing:-.8px}
.canva-kpi .kpi-label{margin-top:3px;color:var(--c-muted);font-size:12px}
.canva-content .call-shell{border-radius:26px!important;box-shadow:var(--c-shadow)!important}
@media(max-width:1050px){.canva-content{padding:0 24px 40px!important}.canva-toolbar .search{width:170px}.canva-kpi-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.canva-content{padding:0 14px 30px!important}.canva-toolbar{height:auto;min-height:68px;padding:12px 0;flex-wrap:wrap}.canva-toolbar .search{display:none}.canva-toolbar .toolbar-right{margin-left:auto}.canva-kpi-row{grid-template-columns:1fr}.canva-content #page>.top h2{font-size:27px!important}}
`;
  document.head.appendChild(style);

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
        const firstName=window.state?.profile?.first_name||window.state?.user?.email||'Профиль';
        bar.innerHTML='<div class="toolbar-left"><div><div class="eyebrow">SALE TRAINING</div><div class="toolbar-title">AI Sales Coach</div></div></div><div class="toolbar-right"><div class="search">⌕  Поиск по тренировкам</div><div class="date">Сегодня · '+new Date().toLocaleDateString('ru-RU')+'</div><div class="avatar">'+String(firstName).slice(0,1).toUpperCase()+'</div></div>';
        content.insertBefore(bar,content.firstChild);
      }
    }
    enhanceHome();
  }
  function enhanceHome(){
    const page=document.getElementById('page');
    if(!page)return;
    if(!page.querySelector('.canva-kpi-row') && page.querySelector('.hero')){
      const cards=[...page.querySelectorAll(':scope>.grid>.card')];
      if(cards.length>=4){
        const row=document.createElement('div');row.className='canva-kpi-row';
        const icons=['✓','↗','★','◷'];
        cards.slice(0,4).forEach((c,i)=>{const k=document.createElement('div');k.className='canva-kpi';k.innerHTML='<div class="kpi-icon">'+icons[i]+'</div>'+c.innerHTML;row.appendChild(k)});
        const grid=page.querySelector(':scope>.grid');grid.replaceWith(row);
      }
    }
  }
  const mo=new MutationObserver(()=>enhance());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();
