/* SaleTrening UI bootstrap V7 */
(function(){
  'use strict';
  if(window.__stTrainingUIBootstrapV7)return;
  window.__stTrainingUIBootstrapV7=true;
  function load(src){
    return new Promise(function(resolve,reject){
      if(document.querySelector('script[data-st-ui="'+src+'"]'))return resolve();
      var s=document.createElement('script');
      s.src=src;
      s.async=false;
      s.dataset.stUi=src;
      s.onload=resolve;
      s.onerror=reject;
      document.body.appendChild(s);
    });
  }
  function boot(){
    load('/training-ui-v7.js?v=20260904-1').catch(function(e){console.error('[SaleTrening] training UI load failed',e);});
    load('/cold-call-voice.js?v=20260904-1').catch(function(e){console.error('[SaleTrening] cold call UI load failed',e);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
