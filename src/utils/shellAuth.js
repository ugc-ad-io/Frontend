// Native sign-in for the mobile shell: turns the bridge replies into what the backend /auth/google and /auth/apple expect.
// Each helper resolves { cancelled:true } (user closed the sheet: do nothing), { error:'text for a toast' } or the request body.
import { nativeGoogleSignIn, nativeAppleSignIn, isCancel } from './nativeBridge';

const friendly = (res, provider) => {
  const code = res && res.error;
  if (code === 'timeout') return `${provider} sign-in took too long. Please try again.`;
  if (code === 'unsupported') return `${provider} sign-in is not available on this device.`;
  if (code === 'not_in_shell') return `${provider} sign-in needs the UGCad app.`;
  if (code === 'denied') return `${provider} sign-in was not allowed. Please try again.`;
  return (res && res.message) || `${provider} sign-in failed. Please try again.`;
};

/** { credential } for POST /auth/google (same field the web button sends). */
export async function nativeGoogleCredential() {
  const res = await nativeGoogleSignIn();
  if (res && res.ok && res.idToken) return { credential: res.idToken };
  if (isCancel(res)) return { cancelled: true };
  return { error: friendly(res, 'Google') };
}

/** Body for POST /auth/apple: { identity_token, role, full_name? } exactly as the old app (ugcapp appleAuth) sent it.
 *  Apple gives the name only on the very first authorization, so it must be forwarded now. */
export async function nativeAppleBody(role) {
  const res = await nativeAppleSignIn();
  if (!(res && res.ok && res.identityToken)) {
    if (isCancel(res)) return { cancelled: true };
    return { error: res && res.ok ? 'Apple did not return a sign-in token. Please try again.' : friendly(res, 'Apple') };
  }
  const n = res.fullName || {};
  const fullName = [n.givenName, n.familyName].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
  return { body: { identity_token: res.identityToken, role: role === 'business' ? 'business' : 'creator', ...(fullName ? { full_name: fullName } : null) } };
}
