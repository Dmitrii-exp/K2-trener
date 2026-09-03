/* SaleTrening training runtime fix V1 */
(function(){
  'use strict';
  function toast(msg){
    var el=document.getElementById('toast');
    if(el){el.textContent=String(msg);el.style.display='block';clearTimeout(window.__stToastTimer);window.__stToastTimer=setTimeout(function(){el.style.display='none'},7000)}
    console.error('[SaleTrening training]',msg);
  }
  function waitForStart(){
    if(typeof window.startTraining!=='function'){setTimeout(waitForStart,100);return}
    if(window.__stTrainingWrapped)return;
    var original=window.startTraining;
    window.startTraining=async function(id){
      try{
        toast('Запускаем тренировку…');
        var result=await original(id);
        setTimeout(function(){
          var messages=document.getElementById('messages');
          var composer=document.getElementById('msg');
          if(!messages || !composer){
            toast('Тренировка не открылась. Проверьте подключение к Supabase и сессию пользователя.');
          }
        },1200);
        return result;
      }catch(e){
        toast('Ошибка запуска тренировки: '+(e&&e.message?e.message:String(e)));
        throw e;
      }
    };
    window.__stTrainingWrapped=true;
  }
  function clickFallback(e){
    var b=e.target.closest && e.target.closest('button');
    if(!b)return;
    var code=b.getAttribute('onclick')||'';
    if(!/startTraining\s*\(/.test(code))return;
    if(typeof window.startTraining!=='function'){
      e.preventDefault();
      toast('Функция запуска тренировки не загрузилась. Обновите страницу.');
    }
  }
  document.addEventListener('click',clickFallback,true);
  window.addEventListener('error',function(e){
    if(/startTraining|training|aiClientReply|saletrening_sessions|Supabase/i.test(String(e.message||'')))toast('Ошибка тренировки: '+(e.message||'неизвестная ошибка'));
  });
  waitForStart();
})();
