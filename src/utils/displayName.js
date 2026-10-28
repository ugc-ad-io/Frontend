// Single source of truth for how a person is shown across the app.
//
// We no longer surface the "@username" handle anywhere — brands and creators see
// a plain NAME. Prefer the real name; fall back to the handle text WITHOUT the
// "@" (so an account that only ever had a handle still reads as a name, not a
// username), then the email local-part, then a generic role label.
// The server hands every new account a random first name + 2 digits ("Zoya92", see generate_nickname in
// server.py) until the person sets a real name. That is not their name: never show it.
const PLACEHOLDER_NICK = /^(Aarav|Vivaan|Aditya|Arjun|Reyansh|Rohan|Kabir|Ishaan|Dev|Krishna|Ananya|Diya|Aadhya|Saanvi|Priya|Ira|Myra|Riya|Kiara|Meera|Neha|Kunal|Nikhil|Sara|Aisha|Tara|Karan|Sana|Yash|Zoya)\d{2}$/;

export function displayName(user, fallback = 'User') {
  if (!user) return fallback;
  const p = user.profile || {};
  // Trim, and ALWAYS strip a leading "@" — some accounts store the nickname as
  // "@FierceDragon774", so stripping only the username field wasn't enough.
  const first = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/^@+/, '') : '');
  const handle = (v) => { const h = first(v); return PLACEHOLDER_NICK.test(h) ? '' : h; };
  const placeholder = PLACEHOLDER_NICK.test(first(user.nickname)) || PLACEHOLDER_NICK.test(first(user.username));
  // Their own email name ("arushi.khare27@x" -> "Arushi") reads better than a random one while no name is set.
  const emailWord = placeholder ? first(user.email).split('@')[0].split(/[._+\-0-9]+/).filter(Boolean)[0] || '' : '';
  return (
    // The REAL name the person typed comes first, so an auto-generated nickname
    // handle (e.g. "LuckyTiger764") never wins over an actual name on the profile.
    first(user.full_name) ||
    first(p.fullName) ||
    first(p.full_name) ||
    first(user.business_name) ||
    first(p.business_name) ||
    first(user.name) ||
    handle(user.nickname) ||
    handle(user.username) ||
    (emailWord ? emailWord.charAt(0).toUpperCase() + emailWord.slice(1) : '') ||
    first(user.public_creator_id) ||
    (first(user.email).split('@')[0]) ||
    fallback
  );
}

// For a creator specifically (nicer default than "User").
export const creatorName = (user) => displayName(user, 'Creator');
// For a brand specifically.
export const brandName = (user) => displayName(user, 'Brand');

// First name only — prefers the explicit first_name field (new signups store it),
// otherwise takes the first word of the display name. Used where we greet / label
// someone by first name instead of their full name.
export function firstName(user, fallback = 'User') {
  if (!user) return fallback;
  const p = user.profile || {};
  const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/^@+/, '') : '');
  const explicit = clean(user.first_name) || clean(p.first_name) || clean(p.firstName);
  if (explicit) return explicit;
  return (displayName(user, fallback).split(/\s+/)[0]) || fallback;
}
export const creatorFirstName = (user) => firstName(user, 'Creator');
