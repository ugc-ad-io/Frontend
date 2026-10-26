// "App mode": the installed app (PWA launched from the home screen) shows the phone screens in
// src/app. The website in a normal browser keeps the desktop pages. Same URLs either way.
//
// Preview the app screens in any browser with ?app=1 (remembered), switch back with ?app=0.
// sessionStorage ugcad_app_ui=1 turns it on for one tab only (used for testing).
const FLAG = 'ugcad_app_ui';

function detect() {
  try {
    if (typeof window === 'undefined' || window.ReactNativeWebView) return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('app') === '1') window.localStorage.setItem(FLAG, '1');
    if (params.get('app') === '0') { window.localStorage.removeItem(FLAG); window.sessionStorage.removeItem(FLAG); }
    const standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
    return standalone
      || window.localStorage.getItem(FLAG) === '1'
      || window.sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export const APP_UI = detect();

if (APP_UI && typeof document !== 'undefined') {
  // html.ugc-app scopes every app-only platform rule (src/app/shell/app-platform.css) away from the website.
  document.documentElement.classList.add('ugc-app');
  // Android/Chrome tints the status bar from theme-color: match the app's top bar so there is no stripe.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', '#f4f5ff'));
  // On-screen keyboard resizes the layout viewport (Chrome Android 108+) instead of panning the page over it. The website
  // keeps the browser default, hence set here and not in index.html. iOS ignores it (shell/platform.js covers iOS).
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/interactive-widget/.test(vp.content)) vp.setAttribute('content', `${vp.content}, interactive-widget=resizes-content`);
}
