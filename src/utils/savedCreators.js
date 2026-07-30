// Client-side "saved creators" store for brands.
//
// Saves are kept in localStorage (per browser) as lean creator snapshots, so the
// Saved Creators page can render cards without re-fetching. Toggling a save fires
// a `ugc-saved-creators-changed` event so any open page/modal can react live.
// If we later add a backend endpoint, swap the get/set internals here.

const KEY = 'ugc_saved_creators';

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
  window.dispatchEvent(new CustomEvent('ugc-saved-creators-changed'));
};

const cid = (c) => String(c?.id ?? c?._id ?? c?.creator_id ?? '');

export const getSavedCreators = () => read();

export const getSavedCreatorIds = () => new Set(read().map(cid).filter(Boolean));

export const isCreatorSaved = (id) => read().some((c) => cid(c) === String(id));

// Add if not saved, remove if already saved. Returns the new saved state (bool).
export const toggleSavedCreator = (creator) => {
  const id = cid(creator);
  if (!id) return false;
  const list = read();
  const idx = list.findIndex((c) => cid(c) === id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.unshift({ ...creator, id, savedAt: Date.now() });
  write(list);
  return true;
};

export const removeSavedCreator = (id) => {
  write(read().filter((c) => cid(c) !== String(id)));
};
