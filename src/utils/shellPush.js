// Push notifications for the mobile shell: register the device with the backend after login, drop it on logout,
// and turn a tapped notification into an in-app navigation. All of it is a no-op outside the shell.
import axios from 'axios';
import { isShell, shellPlatform, shellVersion, registerPush, unregisterPushNative } from './nativeBridge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const URL_TOKEN = `${BACKEND_URL}/api/notifications/device-token`;

let currentToken = null;   // last token the shell gave us
let registeredFor = null;  // user id the token was last POSTed for (once per session)

/** Only an in-app absolute path may come from a notification: '/x', never '//host', '\\host' or 'https:'. */
export const safePushPath = (raw) => (typeof raw === 'string' && /^\/(?![/\\])/.test(raw) && !/[\r\n]/.test(raw) ? raw : null);

/** POST the token. A 404 (backend without the endpoint yet) is silent; so is any other failure: push is a bonus, never a blocker. */
export async function postDeviceToken(token, platform) {
  if (!token) return false;
  try {
    await axios.post(URL_TOKEN, { token, platform: platform || shellPlatform() || 'android', app_version: shellVersion() || undefined });
    return true;
  } catch {
    return false;
  }
}

/** Ask the shell for a token (permission prompt on first use) and register it. Once per session per user unless force. */
export async function registerDevice(userId, { force = false } = {}) {
  if (!isShell() || !userId) return false;
  if (!force && registeredFor === userId) return false;
  registeredFor = userId;
  const res = await registerPush();
  if (!(res && res.ok && res.token)) { registeredFor = null; return false; }
  currentToken = res.token;
  return postDeviceToken(res.token, res.platform);
}

/** The shell refreshed the token (push:token). */
export async function onTokenRefreshed(payload) {
  if (!payload || !payload.token || payload.token === currentToken) return false;
  currentToken = payload.token;
  return postDeviceToken(payload.token, payload.platform);
}

/** Call BEFORE the session token is removed: the DELETE needs it, so it is passed explicitly. */
export function unregisterDevice() {
  const token = currentToken;
  const session = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
  currentToken = null;
  registeredFor = null;
  if (!isShell() || !token) return;
  unregisterPushNative(token);
  axios.delete(URL_TOKEN, { data: { token }, headers: session ? { Authorization: `Bearer ${session}` } : undefined }).catch(() => {});
}
