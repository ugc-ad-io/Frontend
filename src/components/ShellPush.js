import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { isShell, onNative } from '../utils/nativeBridge';
import { registerDevice, onTokenRefreshed, safePushPath } from '../utils/shellPush';

// Mounted once inside the router (App.js). Renders nothing; only active inside the mobile shell.
export default function ShellPush() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user && (user.id || user.user_id);

  useEffect(() => {
    if (!isShell()) return undefined;
    const offOpen = onNative('push:open', (p) => { const path = safePushPath(p && p.path); if (path) navigate(path); });
    const offToken = onNative('push:token', (p) => { if (uid) onTokenRefreshed(p); });
    return () => { offOpen(); offToken(); };
  }, [navigate, uid]);

  useEffect(() => { if (uid) registerDevice(uid); }, [uid]);

  return null;
}
