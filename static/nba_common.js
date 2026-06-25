// Common helpers for NBA static UI (external script to satisfy CSP)
(function(){
  'use strict';
  window.NBA = window.NBA || {};

  NBA.esc = function(s){
    const str = String(s ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  NBA.log = function(){
    try{ console.log.apply(console, arguments); }catch(e){}
  };

  window.addEventListener('error', (e)=>{
    console.error('[NBA UI] JS error', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e)=>{
    console.error('[NBA UI] Promise rejection', e.reason);
  });
})();
