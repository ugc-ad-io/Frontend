// Creator level ladder — shared by the admin Users list and the creator profile
// so "Promote Level" shows the same tier everywhere.
//
// The backend stores `level` as a NUMBER (1..5) and also sends `level_key` /
// `level_label`. Historically the UI read the raw number as a tier key, so
// level 2 fell through to 'new' and promoting looked like it did nothing.
// resolveLevelKey() accepts either form.

export const LEVEL_ORDER = ['new', 'verified', 'l1', 'l2', 'elite'];

export const LEVEL_LABEL = { new: 'New', verified: 'Verified', l1: 'L1', l2: 'L2', elite: 'Elite' };

export const LEVEL_META = {
  new: { title: 'New Creator', badge: 'New' },
  verified: { title: 'Verified Creator', badge: 'Verified' },
  l1: { title: 'L1 Rising Star', badge: 'L1 (Rising)' },
  l2: { title: 'L2 Pro Creator', badge: 'L2 (Pro)' },
  elite: { title: 'Elite Creator', badge: 'Elite' },
};

/** Accepts a tier key ('verified'), a number (2), or a numeric string ('2'). */
export function resolveLevelKey(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (LEVEL_LABEL[s]) return s;                 // already a tier key
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1) {
    return LEVEL_ORDER[Math.min(LEVEL_ORDER.length, Math.round(n)) - 1] || 'new';
  }
  return 'new';
}

export const levelLabelOf = (value) => LEVEL_LABEL[resolveLevelKey(value)];
export const levelMetaOf = (value) => LEVEL_META[resolveLevelKey(value)] || LEVEL_META.new;
