// Client-side "saved campaigns/briefs" store for creators.
//
// Saves are kept in localStorage (per browser) as the full normalized brief
// objects, so the Saved page can render cards without re-fetching. Toggling a
// save fires a `ugc-saved-changed` event so any open page (Browse, Saved) can
// react live. If we later add a backend endpoint, swap the get/set internals
// here and the rest of the app keeps working.

const KEY = 'ugc_saved_briefs';

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* quota / disabled — ignore */ }
  // Let open pages know the saved set changed.
  window.dispatchEvent(new CustomEvent('ugc-saved-changed'));
};

const briefId = (b) => String(b?.id ?? b?._id ?? '');

export const getSavedBriefs = () => read();

export const getSavedIds = () => new Set(read().map(briefId).filter(Boolean));

export const isBriefSaved = (id) => read().some((b) => briefId(b) === String(id));

// Add if not saved, remove if already saved. Returns the new saved state (bool).
export const toggleSavedBrief = (brief) => {
  const id = briefId(brief);
  if (!id) return false;
  const list = read();
  const idx = list.findIndex((b) => briefId(b) === id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  // Store a lean snapshot (drop the heavy raw campaign object to save space).
  const { campaign, ...lean } = brief;
  list.unshift({ ...lean, savedAt: Date.now() });
  write(list);
  return true;
};

export const removeSavedBrief = (id) => {
  write(read().filter((b) => briefId(b) !== String(id)));
};
