// Creator notification + privacy preferences. The server (users.notification_prefs /
// users.privacy via GET /auth/me, PUT /profile/preferences) is the source of truth.

export const DEFAULT_NOTIF = {
  brief_matches: true, bid_updates: true, messages: true, payout_alerts: true, weekly_digest: false,
};
export const DEFAULT_PRIVACY = { public_profile: true, show_earnings: false, allow_messages: true };

export const mergeNotif = (server) => ({ ...DEFAULT_NOTIF, ...(server && typeof server === 'object' ? server : {}) });

// `allow_messages` is the one key (the website always saved it; the app now does too).
// An older app build saved `allow_direct_messages`: read it once if `allow_messages` is not
// set, and drop it, so both clients agree.
export function mergePrivacy(server) {
  const { allow_direct_messages, ...rest } = server && typeof server === 'object' ? server : {};
  const out = { ...DEFAULT_PRIVACY, ...rest };
  if (rest.allow_messages === undefined && typeof allow_direct_messages === 'boolean') {
    out.allow_messages = allow_direct_messages;
  }
  return out;
}

// Save one preference group. Never throws: on failure hands back the last saved
// value so the caller can roll the toggles back and show the error.
export async function persistPrefs(put, key, next, lastSaved) {
  try {
    await put({ [key]: next });
    return { ok: true, value: next };
  } catch (error) {
    return { ok: false, value: lastSaved, error };
  }
}
