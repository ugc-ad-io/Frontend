// Bridge to the UGCad mobile shell (React Native app whose WebView opens this site). Contract: SHELL_CONTRACT.md.
// Website -> native: window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, payload })).
// Native -> website: window 'ugcad-native' CustomEvent with detail { id, type, payload } (reply type is "<type>:result").
// Outside the shell every call resolves { ok:false, error:'not_in_shell' } and nothing throws.
import { IN_SHELL } from './appMode';

const SIM_KEY = 'ugcad_shell_sim';

// Development only: sessionStorage.ugcad_shell_sim = 'ios' | 'android' pretends to be the shell (never in a production build).
function simPlatform() {
  try {
    if (process.env.NODE_ENV === 'production') return '';
    const v = window.sessionStorage.getItem(SIM_KEY);
    return v === 'ios' || v === 'android' ? v : '';
  } catch {
    return '';
  }
}

export function isShell() {
  if (typeof window === 'undefined') return false;
  return IN_SHELL || window.__UGCAD_SHELL__ === true || !!simPlatform();
}

/** 'ios' | 'android' | '' (not in the shell). */
export function shellPlatform() {
  if (typeof window === 'undefined') return '';
  return window.__UGCAD_PLATFORM__ || simPlatform() || '';
}

export const shellVersion = () => (typeof window !== 'undefined' && window.__UGCAD_SHELL_VERSION__) || '';

let seq = 0;
const nextId = () => `w${Date.now().toString(36)}-${(seq += 1)}`;
const canPost = () => typeof window !== 'undefined' && !!window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function';

/** Send one request to the shell. Always resolves: the reply payload, { ok:false, error:'timeout' } or { ok:false, error:'not_in_shell' }. */
export function sendNative(type, payload = {}, { timeoutMs = 60000 } = {}) {
  if (!canPost()) return Promise.resolve({ ok: false, error: 'not_in_shell' });
  return new Promise((resolve) => {
    const id = nextId();
    let timer = null;
    const done = (value) => {
      window.removeEventListener('ugcad-native', onEvent);
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    function onEvent(ev) {
      const d = ev && ev.detail;
      if (!d || d.id !== id) return;
      const p = d.payload;
      done(p && typeof p === 'object' ? p : { ok: true });
    }
    window.addEventListener('ugcad-native', onEvent);
    timer = setTimeout(() => done({ ok: false, error: 'timeout' }), timeoutMs);
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, payload }));
    } catch (e) {
      done({ ok: false, error: 'post_failed', message: String((e && e.message) || e) });
    }
  });
}

/** Listen to events the shell sends on its own (push:token, push:open, app:resume). Returns an unsubscribe function. */
export function onNative(type, handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (ev) => {
    const d = ev && ev.detail;
    if (d && d.type === type) handler(d.payload || {}, d);
  };
  window.addEventListener('ugcad-native', fn);
  return () => window.removeEventListener('ugcad-native', fn);
}

const LONG = { timeoutMs: 180000 }; // a sign-in sheet can stay open for minutes

export const nativeGoogleSignIn = () => sendNative('auth:google', {}, LONG);
export const nativeAppleSignIn = () => sendNative('auth:apple', {}, LONG);
export const registerPush = () => sendNative('push:register', {}, { timeoutMs: 120000 });
export const unregisterPushNative = (token) => sendNative('push:unregister', { token }, { timeoutMs: 10000 });
export const shareNative = (data) => sendNative('share', data || {});
export const downloadNative = (url, filename) => sendNative('download', { url, filename }, { timeoutMs: 300000 });
export const appInfo = () => sendNative('app:info', {}, { timeoutMs: 5000 });

/** Open a link outside the app (system browser / mail / phone). In a plain browser it opens a new tab. */
export async function openExternal(url) {
  if (!/^(https?:|mailto:|tel:)/i.test(String(url || ''))) return { ok: false, error: 'bad_url' };
  if (!canPost()) {
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* popup blocked */ }
    return { ok: true };
  }
  return sendNative('open:external', { url }, { timeoutMs: 10000 });
}

/** True when a sign-in reply means "the user closed the sheet": stay silent. */
export const isCancel = (res) => !!res && res.ok === false && /cancel|dismiss|1001|12501/i.test(`${res.error || ''} ${res.message || ''}`);

// OS permissions go through the shell too. kind: 'camera' | 'microphone' | 'photos' | 'notifications'.
// Reply { ok:true, status:'granted'|'denied'|'blocked'|'limited'|'unavailable' }. File uploads do NOT use this: <input type=file> opens the native picker.
export const permissionStatus = (kind) => sendNative('permissions:status', { kind }, { timeoutMs: 10000 });
/** Ask only when permissionStatus says it is needed; outside the shell resolves { ok:false, error:'not_in_shell' } (the browser asks itself). */
export const requestPermission = (kind) => sendNative('permissions:request', { kind }, LONG);
/** Opens the OS settings page of the app (for a 'blocked' permission). */
export const openAppSettings = () => sendNative('app:openSettings', {}, { timeoutMs: 10000 });
