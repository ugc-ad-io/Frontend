// App mode switch: the new UGCad mobile shell (React Native WebView on the live site) always gets the phone screens,
// the OLD native app's WebViews keep the plain website, a normal browser needs ?app=1 or an installed (standalone) PWA.

function load({ ua = 'Mozilla/5.0 Chrome', rnWebView = false, shellFlag = false, search = '', standalone = false } = {}) {
  let mod;
  jest.isolateModules(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
    window.matchMedia = () => ({ matches: standalone, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    if (rnWebView) window.ReactNativeWebView = { postMessage() {} }; else delete window.ReactNativeWebView;
    if (shellFlag) window.__UGCAD_SHELL__ = true; else delete window.__UGCAD_SHELL__;
    window.history.replaceState({}, '', `/${search}`);
    mod = require('./appMode');
  });
  return mod;
}

describe('appMode', () => {
  afterEach(() => { delete window.ReactNativeWebView; delete window.__UGCAD_SHELL__; });

  it('a normal browser tab stays on the website', () => {
    const m = load();
    expect(m.APP_UI).toBe(false);
    expect(m.IN_SHELL).toBe(false);
    expect(m.IN_OLD_APP).toBe(false);
  });

  it('?app=1 and an installed PWA turn the phone screens on', () => {
    expect(load({ search: '?app=1' }).APP_UI).toBe(true);
    expect(load({ standalone: true }).APP_UI).toBe(true);
  });

  it('the new shell is recognised by its user agent token or the injected flag, and always runs app mode', () => {
    const byUa = load({ ua: 'Mozilla/5.0 Chrome UGCadShell/1.0.0', rnWebView: true });
    expect(byUa.IN_SHELL).toBe(true);
    expect(byUa.APP_UI).toBe(true);
    expect(byUa.IN_OLD_APP).toBe(false);
    const byFlag = load({ rnWebView: true, shellFlag: true });
    expect(byFlag.IN_SHELL).toBe(true);
    expect(byFlag.APP_UI).toBe(true);
  });

  it('the old native app WebViews (no marker) keep the plain website, even with ?app=1 style flags', () => {
    const m = load({ rnWebView: true, search: '?app=1' });
    expect(m.IN_OLD_APP).toBe(true);
    expect(m.IN_SHELL).toBe(false);
    expect(m.APP_UI).toBe(false);
  });
});
