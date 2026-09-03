/* SaleTrening training launch fix — reversible, keeps original logic intact */
(function(){
  'use strict';
  var originalStart = window.startTraining;
  if(typeof originalStart !== 'function') return;
  if(window.__saleTrainingLaunchFix) return;
  window.__saleTrainingLaunchFix = true;

  function showError(message){
    try{
      if(typeof toast==='function') toast('Ошибка запуска тренировки: '+message);
      else alert('Ошибка запуска тренировки: '+message);
    }catch(_){ alert('Ошибка запуска тренировки: '+message); }
  }

  window.startTraining = async function(id){
    try{
      if(!id) throw new Error('Не передан ID сценария');
      if(!window.sb && typeof sb==='undefined') throw new Error('Supabase не инициализирован');
      if(typeof state==='undefined' || !state) throw new Error('Состояние приложения не инициализировано');
      if(!state.user || !state.user.id) throw new Error('Пользователь не авторизован');
      if(!state.profile) throw new Error('Профиль пользователя ещё не загружен');
      if(!state.profile.company_id) throw new Error('У пользователя не указана компания');
      if(!Array.isArray(state.scenarios)) throw new Error('Сценарии тренировок не загружены');
      var scenario = state.scenarios.find(function(x){ return x.id===id; });
      if(!scenario) throw new Error('Сценарий не найден: '+id);

      // Preserve the existing application flow; only expose the real failure instead of silently stopping.
      await originalStart(id);
    }catch(e){
      console.error('[SaleTrening] startTraining failed',e);
      showError(e && e.message ? e.message : String(e));
    }
  };
})();