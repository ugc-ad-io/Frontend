// User-generated-content safety (App Store 1.2 / Play UGC policy): report a user and block a user.
// Report -> POST /report-user (existing backend route: reported_user_id, deal_id, reason, details).
// Block  -> POST /blocks {user_id}, DELETE /blocks/{user_id}, GET /blocks (contract endpoints). While the backend does not have them yet the
//           block is kept on this device (localStorage, per account) so the chat is still hidden and sending is still prevented here.
import { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const key = (me) => `ugcad_blocked_users:${me}`;

export const REPORT_REASONS = [
  ['spam', 'Spam or scam'], ['harassment', 'Harassment or abuse'], ['off_platform', 'Trying to move off-platform'],
  ['payment_issue', 'Payment or fraud issue'], ['inappropriate', 'Inappropriate content'], ['other', 'Other'],
];

let owner = null;
let blocked = new Set();
const subs = new Set();
const readLocal = (me) => { try { return new Set(JSON.parse(localStorage.getItem(key(me)) || '[]')); } catch { return new Set(); } };
const emit = (next) => {
  blocked = next;
  try { if (owner) localStorage.setItem(key(owner), JSON.stringify([...next])); } catch { /* storage blocked */ }
  subs.forEach((f) => f(next));
};
const ids = (data) => (Array.isArray(data) ? data : Array.isArray(data?.blocks) ? data.blocks : [])
  .map((x) => (typeof x === 'string' ? x : x?.user_id || x?.blocked_user_id || x?.id)).filter(Boolean);

export const isBlocked = (id) => blocked.has(id);

/** Load this account's block list (device copy first, then the server's when it has /blocks). */
export async function loadBlockedFor(me) {
  if (!me) return;
  if (owner !== me) { owner = me; emit(readLocal(me)); }
  try {
    const { data } = await axios.get(`${API}/blocks`);
    emit(new Set([...blocked, ...ids(data)]));
  } catch { /* backend without /blocks yet, or offline: the device copy is used */ }
}

/** Block: hide the chat and stop messages. { synced:false } means only this device knows (backend has no /blocks). */
export async function blockUser(userId) {
  if (!userId) return { ok: false };
  emit(new Set([...blocked, userId]));
  try { await axios.post(`${API}/blocks`, { user_id: userId }); return { ok: true, synced: true }; } catch { return { ok: true, synced: false }; }
}

export async function unblockUser(userId) {
  const next = new Set(blocked); next.delete(userId); emit(next);
  try { await axios.delete(`${API}/blocks/${encodeURIComponent(userId)}`); return { ok: true, synced: true }; } catch { return { ok: true, synced: false }; }
}

/** Report a user (optionally a specific message/deal). Throws the axios error so the caller can show the backend's message. */
export async function reportUser({ userId, dealId, reason, details, messageId }) {
  const note = [messageId ? `[message ${messageId}]` : '', details || ''].filter(Boolean).join(' ').trim();
  const res = await axios.post(`${API}/report-user`, { reported_user_id: userId, deal_id: dealId || null, reason, details: note });
  return res.data;
}

/** Live block list for the signed-in account. */
export function useBlocked(me) {
  const [set, setSet] = useState(() => blocked);
  useEffect(() => {
    subs.add(setSet);
    loadBlockedFor(me);
    return () => { subs.delete(setSet); };
  }, [me]);
  return set;
}

export const __resetForTests = () => { owner = null; blocked = new Set(); subs.clear(); };
