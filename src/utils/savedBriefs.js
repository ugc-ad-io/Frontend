// "Saved campaigns/briefs" store for creators.
//
// localStorage holds the full normalized brief objects so the Saved page renders
// instantly; toggles ALSO write through to the backend (/saved-briefs) so the
// saved set is durable and syncs across devices/cache-clears.
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

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
    axios.delete(`${API}/saved-briefs/${id}`).catch(() => {}); // durable, best-effort
    return false;
  }
  // Store a lean snapshot (drop the heavy raw campaign object to save space).
  const { campaign, ...lean } = brief;
  list.unshift({ ...lean, savedAt: Date.now() });
  write(list);
  axios.post(`${API}/saved-briefs/${id}`).catch(() => {}); // durable, best-effort
  return true;
};

export const removeSavedBrief = (id) => {
  write(read().filter((b) => briefId(b) !== String(id)));
  axios.delete(`${API}/saved-briefs/${id}`).catch(() => {});
};

// Pull the durable saved-brief ids from the backend and fetch any campaigns not
// already cached locally, so the Saved page works across devices. Returns the
// merged list of saved brief objects (also written back to localStorage).
export const hydrateSavedFromServer = async () => {
  try {
    const { data } = await axios.get(`${API}/saved-briefs`);
    const serverIds = Array.isArray(data?.campaign_ids) ? data.campaign_ids.map(String) : [];
    const local = read();
    const localIds = new Set(local.map(briefId));
    const missing = serverIds.filter((id) => !localIds.has(id));
    const fetched = await Promise.all(
      missing.map((id) => axios.get(`${API}/campaigns/${id}`).then((r) => ({ ...r.data, id, savedAt: Date.now() })).catch(() => null))
    );
    // Keep only briefs still saved on the server; add the newly fetched ones.
    const serverSet = new Set(serverIds);
    const merged = [...local.filter((b) => serverSet.has(briefId(b))), ...fetched.filter(Boolean)];
    write(merged);
    return merged;
  } catch {
    return read();
  }
};
