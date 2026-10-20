// "Saved creators" store for brands, backed by the server (shared by the whole
// brand team workspace): GET/POST/DELETE /api/business/saved-creators[/{id}].
//
// The server only stores creator ids. We keep them in a module-level Set so every
// card/modal/page reads the same state, update it optimistically on toggle, roll
// back (and toast) when the request fails, and fire `ugc-saved-creators-changed`
// so open components re-render. Ids an older build kept in localStorage
// (`ugc_saved_creators`) are pushed to the server once, then the key is cleared.
import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api/business/saved-creators`;
const KEY = 'ugc_saved_creators';
const EVENT = 'ugc-saved-creators-changed';

let ids = new Set();
let loaded = false;
let loading = null;          // in-flight load promise (shared, so migration runs once)
const pending = new Set();   // ids with a request in flight (blocks double taps)

const cid = (c) => String(c?.id ?? c?._id ?? c?.creator_id ?? (typeof c === 'string' ? c : ''));
const emit = () => window.dispatchEvent(new CustomEvent(EVENT));

const readLegacyIds = () => {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr.map(cid).filter(Boolean) : [];
  } catch {
    return [];
  }
};

// One-time upload of the old browser-only saves. The key is cleared only when no
// request failed for a network/server reason (a 4xx such as "creator not found"
// is final, so retrying it forever would be pointless).
const migrateLegacy = async () => {
  const legacy = readLegacyIds().filter((id) => !ids.has(id));
  let retryLater = false;
  await Promise.all(legacy.map((id) => axios.post(`${API}/${encodeURIComponent(id)}`)
    .then(() => { ids.add(id); })
    .catch((e) => { if (!e?.response || e.response.status >= 500) retryLater = true; })));
  if (!retryLater) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
};

// Fetch the server list (and migrate legacy saves) once; later calls reuse it.
// A failed load is not cached, so the next call retries.
export const loadSavedCreators = () => {
  if (loaded) return Promise.resolve([...ids]);
  if (!loading) {
    loading = (async () => {
      try {
        const { data } = await axios.get(API);
        ids = new Set((Array.isArray(data?.creator_ids) ? data.creator_ids : []).map(String));
        await migrateLegacy();
        loaded = true;
        emit();
      } catch { /* not a brand / offline: stay empty, retry on next call */ }
      loading = null;
      return [...ids];
    })();
  }
  return loading;
};

export const isSavedCreatorsLoaded = () => loaded;
export const getSavedCreatorIds = () => new Set(ids);
export const isCreatorSaved = (id) => ids.has(String(id));

// Add if not saved, remove if already saved. Resolves to the final saved state
// (the previous state when the request failed and was rolled back).
export const toggleSavedCreator = async (creator) => {
  const id = cid(creator);
  if (!id) return false;
  if (pending.has(id)) return ids.has(id);
  pending.add(id);
  try {
    if (!loaded) await loadSavedCreators();
    const was = ids.has(id);
    if (was) ids.delete(id); else ids.add(id);
    emit();
    try {
      if (was) await axios.delete(`${API}/${encodeURIComponent(id)}`);
      else await axios.post(`${API}/${encodeURIComponent(id)}`);
      return !was;
    } catch (e) {
      if (was) ids.add(id); else ids.delete(id);
      emit();
      const detail = e?.response?.data?.detail;
      toast.error(!e?.response ? "You're offline. Check your connection and try again."
        : (typeof detail === 'string' ? detail : 'Could not update saved creators'));
      return was;
    }
  } finally {
    pending.delete(id);
  }
};

export const removeSavedCreator = (id) => (isCreatorSaved(id) ? toggleSavedCreator(String(id)) : Promise.resolve(false));

// React hook: current saved-id Set (re-renders on any change). Pass enabled=false
// for non-brand viewers so the brand-only endpoint is never called.
export const useSavedCreatorIds = (enabled = true) => {
  const [set, setSet] = useState(() => getSavedCreatorIds());
  useEffect(() => {
    if (!enabled) return undefined;
    const sync = () => setSet(getSavedCreatorIds());
    window.addEventListener(EVENT, sync);
    loadSavedCreators().then(sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [enabled]);
  return set;
};

// Test helper: forget module state.
export const __resetSavedCreators = () => { ids = new Set(); loaded = false; loading = null; pending.clear(); };
