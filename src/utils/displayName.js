// Single source of truth for how a person is shown across the app.
//
// We no longer surface the "@username" handle anywhere — brands and creators see
// a plain NAME. Prefer the real name; fall back to the handle text WITHOUT the
// "@" (so an account that only ever had a handle still reads as a name, not a
// username), then the email local-part, then a generic role label.
export function displayName(user, fallback = 'User') {
  if (!user) return fallback;
  const p = user.profile || {};
  // Trim, and ALWAYS strip a leading "@" — some accounts store the nickname as
  // "@FierceDragon774", so stripping only the username field wasn't enough.
  const first = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/^@+/, '') : '');
  return (
    // The REAL name the person typed comes first, so an auto-generated nickname
    // handle (e.g. "LuckyTiger764") never wins over an actual name on the profile.
    first(user.full_name) ||
    first(p.fullName) ||
    first(p.full_name) ||
    first(user.business_name) ||
    first(p.business_name) ||
    first(user.name) ||
    first(user.nickname) ||
    first(user.username) ||
    first(user.public_creator_id) ||
    (first(user.email).split('@')[0]) ||
    fallback
  );
}

// For a creator specifically (nicer default than "User").
export const creatorName = (user) => displayName(user, 'Creator');
// For a brand specifically.
export const brandName = (user) => displayName(user, 'Brand');
