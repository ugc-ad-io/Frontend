// Single source of truth for how a person is shown across the app.
//
// We no longer surface the "@username" handle anywhere — brands and creators see
// a plain NAME. Prefer the real name; fall back to the handle text WITHOUT the
// "@" (so an account that only ever had a handle still reads as a name, not a
// username), then the email local-part, then a generic role label.
export function displayName(user, fallback = 'User') {
  if (!user) return fallback;
  const first = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return (
    first(user.nickname) ||
    first(user.full_name) ||
    first(user.name) ||
    first(user.business_name) ||
    // Strip a leading "@" if a handle sneaks through — never show it as a handle.
    first(user.username).replace(/^@/, '') ||
    first(user.public_creator_id).replace(/^@/, '') ||
    first(user.email).split('@')[0] ||
    fallback
  );
}

// For a creator specifically (nicer default than "User").
export const creatorName = (user) => displayName(user, 'Creator');
// For a brand specifically.
export const brandName = (user) => displayName(user, 'Brand');
