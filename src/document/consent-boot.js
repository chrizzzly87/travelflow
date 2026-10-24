// A static document cannot read localStorage. Resolve only its consent visibility
// before first paint; the shared consent store owns choices and side effects.
(() => {
  let choice = null;
  try { choice = window.localStorage.getItem('tf_cookie_consent_choice_v1'); } catch { /* Storage may be unavailable. */ }
  document.documentElement.setAttribute('data-tf-consent', choice === 'all' || choice === 'essential' ? choice : 'unknown');
})();
