import axios from 'axios';
import * as bridge from './nativeBridge';
import { nativeAppleBody, nativeGoogleCredential } from './shellAuth';
import { safePushPath, postDeviceToken, registerDevice, unregisterDevice } from './shellPush';

jest.mock('axios', () => ({ post: jest.fn(), delete: jest.fn(), get: jest.fn() }));

// A fake shell: records what the page posts and lets a test answer with an ugcad-native event.
let posted;
const reply = (type, payload, id) => window.dispatchEvent(new CustomEvent('ugcad-native', { detail: { id: id || posted[posted.length - 1].id, type: `${type}:result`, payload } }));
function installShell(platform = 'ios') {
  posted = [];
  window.ReactNativeWebView = { postMessage: (m) => posted.push(JSON.parse(m)) };
  window.__UGCAD_SHELL__ = true;
  window.__UGCAD_PLATFORM__ = platform;
}
afterEach(() => {
  delete window.ReactNativeWebView; delete window.__UGCAD_SHELL__; delete window.__UGCAD_PLATFORM__;
  sessionStorage.clear(); jest.useRealTimers(); jest.clearAllMocks();
});

describe('sendNative', () => {
  it('outside the shell resolves not_in_shell and never throws', async () => {
    expect(await bridge.sendNative('auth:google')).toEqual({ ok: false, error: 'not_in_shell' });
    expect(await bridge.nativeGoogleSignIn()).toEqual({ ok: false, error: 'not_in_shell' });
    expect(await bridge.registerPush()).toEqual({ ok: false, error: 'not_in_shell' });
    expect(await bridge.permissionStatus('camera')).toEqual({ ok: false, error: 'not_in_shell' });
    expect(await bridge.requestPermission('photos')).toEqual({ ok: false, error: 'not_in_shell' });
    expect(await bridge.openAppSettings()).toEqual({ ok: false, error: 'not_in_shell' });
    expect(await bridge.downloadNative('https://x/y.csv', 'y.csv')).toEqual({ ok: false, error: 'not_in_shell' });
  });

  it('posts {id,type,payload} and resolves with the reply that has the same id', async () => {
    installShell();
    const p = bridge.sendNative('auth:google', { a: 1 });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({ id: expect.any(String), type: 'auth:google', payload: { a: 1 } });
    reply('auth:google', { ok: true, idToken: 'tok' }, 'some-other-id'); // someone else's reply is ignored
    reply('auth:google', { ok: true, idToken: 'tok' });
    expect(await p).toEqual({ ok: true, idToken: 'tok' });
  });

  it('two requests in flight each get their own reply', async () => {
    installShell();
    const a = bridge.sendNative('push:register');
    const b = bridge.sendNative('permissions:status', { kind: 'camera' });
    reply('permissions:status', { ok: true, status: 'blocked' }, posted[1].id);
    reply('push:register', { ok: true, token: 't1', platform: 'ios' }, posted[0].id);
    expect(await b).toEqual({ ok: true, status: 'blocked' });
    expect(await a).toEqual({ ok: true, token: 't1', platform: 'ios' });
  });

  it('times out with { ok:false, error:"timeout" }', async () => {
    installShell();
    jest.useFakeTimers();
    const p = bridge.sendNative('share', {}, { timeoutMs: 50 });
    jest.advanceTimersByTime(60);
    expect(await p).toEqual({ ok: false, error: 'timeout' });
  });

  it('helpers map to the contract messages', async () => {
    installShell();
    bridge.nativeAppleSignIn(); bridge.registerPush(); bridge.unregisterPushNative('t'); bridge.shareNative({ url: 'u' });
    bridge.downloadNative('https://a/b', 'b.csv'); bridge.permissionStatus('notifications'); bridge.requestPermission('camera'); bridge.openAppSettings(); bridge.appInfo();
    expect(posted.map((m) => [m.type, m.payload])).toEqual([
      ['auth:apple', {}], ['push:register', {}], ['push:unregister', { token: 't' }], ['share', { url: 'u' }],
      ['download', { url: 'https://a/b', filename: 'b.csv' }], ['permissions:status', { kind: 'notifications' }],
      ['permissions:request', { kind: 'camera' }], ['app:openSettings', {}], ['app:info', {}],
    ]);
  });

  it('openExternal only allows https/http/mailto/tel, and goes through the bridge in the shell', async () => {
    installShell();
    expect(await bridge.openExternal('javascript:alert(1)')).toEqual({ ok: false, error: 'bad_url' });
    const p = bridge.openExternal('https://ugcad.io/x');
    expect(posted[0]).toMatchObject({ type: 'open:external', payload: { url: 'https://ugcad.io/x' } });
    reply('open:external', { ok: true });
    expect(await p).toEqual({ ok: true });
  });

  it('openExternal outside the shell opens a tab', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    expect(await bridge.openExternal('mailto:a@b.co')).toEqual({ ok: true });
    expect(open).toHaveBeenCalledWith('mailto:a@b.co', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});

describe('onNative / isShell', () => {
  it('delivers unsolicited events by type and unsubscribes', () => {
    const got = [];
    const off = bridge.onNative('push:open', (p) => got.push(p));
    window.dispatchEvent(new CustomEvent('ugcad-native', { detail: { type: 'push:open', payload: { path: '/messages' } } }));
    window.dispatchEvent(new CustomEvent('ugcad-native', { detail: { type: 'app:resume', payload: {} } }));
    off();
    window.dispatchEvent(new CustomEvent('ugcad-native', { detail: { type: 'push:open', payload: { path: '/x' } } }));
    expect(got).toEqual([{ path: '/messages' }]);
  });

  it('isShell / shellPlatform follow the injected flags and the dev simulation', () => {
    expect(bridge.isShell()).toBe(false);
    window.__UGCAD_SHELL__ = true; window.__UGCAD_PLATFORM__ = 'android';
    expect(bridge.isShell()).toBe(true);
    expect(bridge.shellPlatform()).toBe('android');
    delete window.__UGCAD_SHELL__; delete window.__UGCAD_PLATFORM__;
    sessionStorage.setItem('ugcad_shell_sim', 'ios');
    expect(bridge.isShell()).toBe(true);
    expect(bridge.shellPlatform()).toBe('ios');
  });

  it('isCancel recognises a dismissed sign-in sheet', () => {
    expect(bridge.isCancel({ ok: false, error: 'cancelled' })).toBe(true);
    expect(bridge.isCancel({ ok: false, error: 'x', message: 'The user canceled the authorization attempt' })).toBe(true);
    expect(bridge.isCancel({ ok: false, error: 'timeout' })).toBe(false);
    expect(bridge.isCancel({ ok: true })).toBe(false);
  });
});

describe('shellAuth', () => {
  it('google: returns the credential the web button would send', async () => {
    installShell('android');
    const p = nativeGoogleCredential();
    reply('auth:google', { ok: true, idToken: 'g-id' });
    expect(await p).toEqual({ credential: 'g-id' });
  });

  it('apple: builds the exact /auth/apple body the old app sent (identity_token, role, full_name)', async () => {
    installShell('ios');
    const p = nativeAppleBody('business');
    reply('auth:apple', { ok: true, identityToken: 'apple-jwt', fullName: { givenName: ' Asha ', familyName: 'Rao' }, email: 'x@privaterelay.appleid.com' });
    expect(await p).toEqual({ body: { identity_token: 'apple-jwt', role: 'business', full_name: 'Asha Rao' } });
  });

  it('apple: no name (returning user) omits full_name; unknown role falls back to creator', async () => {
    installShell('ios');
    const p = nativeAppleBody('whatever');
    reply('auth:apple', { ok: true, identityToken: 'jwt', fullName: null });
    expect(await p).toEqual({ body: { identity_token: 'jwt', role: 'creator' } });
  });

  it('cancel is silent, errors carry a readable message', async () => {
    installShell('ios');
    let p = nativeAppleBody('creator');
    reply('auth:apple', { ok: false, error: 'cancelled' });
    expect(await p).toEqual({ cancelled: true });
    p = nativeAppleBody('creator');
    reply('auth:apple', { ok: false, error: 'unsupported' });
    expect((await p).error).toMatch(/not available/);
    p = nativeGoogleCredential();
    reply('auth:google', { ok: false, error: 'boom', message: 'Play services missing' });
    expect(await p).toEqual({ error: 'Play services missing' });
  });
});

describe('shellPush', () => {
  it('safePushPath only accepts in-app absolute paths', () => {
    expect(safePushPath('/messages?conv=1')).toBe('/messages?conv=1');
    ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:1', 'messages', '', null, undefined, '/a\nb'].forEach((v) => expect(safePushPath(v)).toBeNull());
  });

  it('postDeviceToken posts {token, platform, app_version} and swallows a 404', async () => {
    window.__UGCAD_SHELL_VERSION__ = '1.3.0';
    axios.post.mockResolvedValueOnce({});
    expect(await postDeviceToken('tok', 'ios')).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/notifications/device-token'), { token: 'tok', platform: 'ios', app_version: '1.3.0' });
    axios.post.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await postDeviceToken('tok2', 'ios')).toBe(false);
    delete window.__UGCAD_SHELL_VERSION__;
  });

  it('registerDevice asks the shell once per session, unregisterDevice sends push:unregister + DELETE with the session token', async () => {
    installShell('ios');
    localStorage.setItem('token', 'session-jwt');
    axios.post.mockResolvedValue({});
    axios.delete.mockResolvedValue({});
    const p = registerDevice('u-new');
    expect(posted[0].type).toBe('push:register');
    reply('push:register', { ok: true, token: 'fcm-1', platform: 'ios' });
    expect(await p).toBe(true);
    expect(await registerDevice('u-new')).toBe(false); // already done this session
    expect(posted).toHaveLength(1);

    unregisterDevice();
    expect(posted[1]).toMatchObject({ type: 'push:unregister', payload: { token: 'fcm-1' } });
    expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/notifications/device-token'), { data: { token: 'fcm-1' }, headers: { Authorization: 'Bearer session-jwt' } });
    localStorage.clear();
  });

  it('registerDevice does nothing outside the shell', async () => {
    expect(await registerDevice('u1')).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
