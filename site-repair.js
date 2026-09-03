/* SaleTrening emergency runtime repair */
(function(){
  'use strict';
  function showFatal(message){
    var root=document.getElementById('root');
    if(root && (!root.innerHTML || root.innerHTML.trim()==='')){
      root.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#f7f7fb;font-family:Arial;padding:24px"><div style="max-width:760px;background:#fff;border:1px solid #e7e7ef;border-radius:20px;padding:28px;box-shadow:0 15px 40px #0001"><h2 style="margin-top:0">SaleTrening</h2><p>Ошибка запуска приложения.</p><pre style="white-space:pre-wrap;background:#f6f6fa;padding:14px;border-radius:12px">'+String(message).replace(/[&<>]/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[x]})+'</pre><button onclick="location.reload()" style="padding:11px 16px;border:0;border-radius:10px;background:#7357ff;color:#fff">Обновить</button></div></div>';
    }
  }
  window.addEventListener('error',function(e){console.error('SaleTrening runtime error',e.error||e.message);setTimeout(function(){showFatal(e.message||'JavaScript error')},0)});
  window.addEventListener('unhandledrejection',function(e){console.error('SaleTrening promise error',e.reason);setTimeout(function(){showFatal(e.reason?.message||String(e.reason||'Promise error'))},0)});
  window.addEventListener('load',function(){
    setTimeout(function(){
      var root=document.getElementById('root');
      if(root && root.innerHTML.trim()==='') showFatal('Приложение не выполнило bootstrap. Проверьте загрузку Supabase и авторизацию.');
    },5000);
  });
})();
