import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle, Flag, ShieldAlert, Filter,
  Check, Ban, ArrowUpRight, Plus, X,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const displayHandle = (obj, nicknameKey = 'nickname', usernameKey = 'username') => {
  if (!obj) return '—';
  // Show a NAME, never an "@handle": prefer real name, then the nickname/username
  // with any leading "@" stripped, then a dash.
  const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/^@+/, '') : '');
  return (
    clean(obj.full_name) || clean(obj.business_name) || clean(obj.name) ||
    clean(obj[nicknameKey]) || clean(obj[usernameKey]) || '—'
  );
};

// Queue categories per the Chat Oversight spec (11.12)
const QUEUES = [
  { key: 'contact', label: 'Contact-info filter', icon: Filter,
    desc: 'Messages caught by the contact-info filter (phone, email, WhatsApp, "call me", etc.).' },
  { key: 'reported', label: 'User reports', icon: Flag,
    desc: 'Messages reported by users for harassment or spam.' },
  { key: 'strike', label: 'Strike watch', icon: ShieldAlert,
    desc: 'Messages from users already on strike watch — reviewed with extra scrutiny.' },
];

// Fallback rules so the panel renders even before the backend endpoint exists.
const DEFAULT_RULES = [
  { id: 'r-phone', type: 'regex', pattern: '\\b(?:\\+?\\d[ -]?){7,}\\b', label: 'Phone numbers', enabled: true },
  { id: 'r-email', type: 'regex', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', label: 'Email addresses', enabled: true },
  { id: 'r-wa', type: 'keyword', pattern: 'whatsapp, telegram, signal, snapchat', label: 'Off-platform apps', enabled: true },
  { id: 'r-callme', type: 'keyword', pattern: 'call me, text me, dm me, reach me at', label: 'Contact solicitations', enabled: true },
];

export default function AdminFlaggedMessages() {
  const [allChats, setAllChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // New: queue category + module view (queue vs. filter-rule management)
  const [queue, setQueue] = useState('contact');
  const [view, setView] = useState('queue');

  // New: per-message resolution + inline escalate target, keyed by message key
  const [resolutions, setResolutions] = useState({});
  const [escalating, setEscalating] = useState(null);

  // New: filter rules
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [proposing, setProposing] = useState(false);
  const [draftRule, setDraftRule] = useState({ type: 'keyword', label: '', pattern: '' });

  useEffect(() => {
    fetchAllChats();
    fetchRules();
  }, []);

  const fetchAllChats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/chats`);
      setAllChats(response.data);
    } catch {
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await axios.get(`${API}/admin/filter-rules`);
      if (Array.isArray(res.data) && res.data.length) setRules(res.data);
    } catch {
      // endpoint optional — keep DEFAULT_RULES
    }
  };

  const fetchChatMessages = async (user1Id, user2Id) => {
    try {
      const response = await axios.get(`${API}/admin/chat/${user1Id}/${user2Id}`);
      setChatMessages(response.data);
    } catch {
      toast.error('Failed to load chat messages');
    }
  };

  // ---- queue filtering ----
  // A chat surfaces in a queue if it carries the relevant signal. We stay
  // backwards-compatible: existing data only sets has_violations (contact-info).
  const inQueue = (chat, q) => {
    if (q === 'contact') return chat.has_violations;
    if (q === 'reported') return (chat.report_count || 0) > 0 || chat.reported;
    if (q === 'strike') {
      // A repeat offender's chat only belongs here if THIS conversation actually has
      // something to review. Without this, every clean chat of a struck user showed up
      // as a useless "0 flagged messages — view & action" card.
      const onWatch = chat.on_strike_watch || chat.user1?.on_strike_watch || chat.user2?.on_strike_watch;
      const hasSomething = (chat.violation_count || 0) > 0 || (chat.report_count || 0) > 0;
      return onWatch && hasSomething;
    }
    return false;
  };

  const queueChats = allChats.filter(c => inQueue(c, queue));
  const activeQueue = QUEUES.find(q => q.key === queue);
  const countFor = (q) => allChats.filter(c => inQueue(c, q)).length;

  // ---- per-message actions ----
  const msgKey = (msg, idx) =>
    `${selectedChat?.user1?.id}-${selectedChat?.user2?.id}-${idx}-${msg.timestamp}`;

  const resolveMessage = async (msg, idx, action, escalation) => {
    const key = msgKey(msg, idx);
    // optimistic
    setResolutions(prev => ({ ...prev, [key]: { action, escalation } }));
    setEscalating(null);

    const labels = {
      approve: 'Approved — message delivered, strike restored if applicable.',
      confirm: 'Violation confirmed — strike applied and user notified.',
      escalate: escalation === 'suspend'
        ? 'User suspended.' : 'User warned.',
    };

    try {
      await axios.post(`${API}/admin/message/moderate`, {
        user1Id: selectedChat?.user1?.id,
        user2Id: selectedChat?.user2?.id,
        timestamp: msg.timestamp,
        sender: msg.sender_username || msg.sender_nickname,
        action,
        escalation,
      });
      toast.success(labels[action]);
    } catch {
      // Backend endpoint may not exist yet — keep the optimistic UI but be honest.
      toast.message(labels[action], { description: 'Recorded locally — moderation endpoint not yet available.' });
    }
  };

  // ---- propose new filter rule ----
  const submitRule = async () => {
    if (!draftRule.label.trim() || !draftRule.pattern.trim()) {
      toast.error('Give the rule a label and a pattern.');
      return;
    }
    try {
      await axios.post(`${API}/admin/filter-rules/propose`, draftRule);
      // Re-read the real state from the server rather than inventing a local row —
      // appending an optimistic {enabled: true} object is what used to tell the
      // admin their rule was live while the stored row said otherwise.
      await fetchRules();
      toast.success('Rule added — it blocks matching messages from now on.');
      setDraftRule({ type: 'keyword', label: '', pattern: '' });
      setProposing(false);
    } catch (e) {
      // And a failed save is not an "added" rule.
      toast.error(apiErrorMessage(e, 'Could not save the rule.'));
    }
  };

  // Switch a rule on/off. This is also what promotes an older "Awaiting review"
  // rule to live — the backend refreshes the filter's cache, so it bites at once.
  const toggleRule = async (rule) => {
    const next = !rule.enabled;
    try {
      await axios.post(`${API}/admin/filter-rules/${rule.id}/toggle`, { enabled: next });
      await fetchRules();
      toast.success(next ? `"${rule.label}" is now active.` : `"${rule.label}" disabled.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not update the rule.'));
    }
  };

  const deleteRule = async (rule) => {
    try {
      await axios.delete(`${API}/admin/filter-rules/${rule.id}`);
      await fetchRules();
      toast.success(`"${rule.label}" deleted.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not delete the rule.'));
    }
  };

  const flaggedCount = (chat) =>
    chat.violation_count != null ? chat.violation_count : (chat.report_count || 0);

  return (
    <AdminLayout>
      <div className="afm-container">
        {/* Page title + subtitle already come from AdminLayout — don't repeat them here. */}
        {/* The boxes are read-only counts. They used to double as queue filters, which
            duplicated the pill tabs below — two controls doing the same thing. The tabs
            are the single filter now. */}
        <div className="afm-header">
          <div className="afm-stats">
            {QUEUES.map(q => (
              <div key={q.key} className="afm-stat" data-testid={`queue-stat-${q.key}`}>
                <span>{q.label}</span>
                <strong>{countFor(q.key)}</strong>
              </div>
            ))}
          </div>

          <button
            className={`afm-tab ${view === 'rules' ? 'is-active' : ''}`}
            onClick={() => { setView(view === 'rules' ? 'queue' : 'rules'); setSelectedChat(null); }}
            data-testid="tab-rules"
          >
            <Filter size={16} /> Filter rules
          </button>
        </div>

        {/* ============ FILTER RULE MANAGEMENT ============ */}
        {view === 'rules' ? (
          <div className="afm-rules">
            <div className="afm-rules-head">
              <div>
                <h2><Filter size={18} /> Filter rules</h2>
                <p>Regex patterns and keyword lists the contact-info filter runs against every message.
                  A rule you add goes live immediately — switch it off or delete it if it misfires.</p>
              </div>
              <button className="afm-btn-primary" onClick={() => setProposing(true)} data-testid="propose-rule">
                <Plus size={16} /> Add new rule
              </button>
            </div>

            {proposing && (
              <div className="afm-rule-form" data-testid="rule-form">
                <div className="afm-rule-form-head">
                  <strong>Add a new rule</strong>
                  <button className="afm-icon-btn" onClick={() => setProposing(false)}><X size={16} /></button>
                </div>
                <div className="afm-rule-form-row">
                  <label>
                    Type
                    <select
                      value={draftRule.type}
                      onChange={e => setDraftRule({ ...draftRule, type: e.target.value })}
                    >
                      <option value="keyword">Keyword list</option>
                    </select>
                  </label>
                  <label className="afm-grow">
                    Label
                    <input
                      placeholder="e.g. Crypto wallet addresses"
                      value={draftRule.label}
                      onChange={e => setDraftRule({ ...draftRule, label: e.target.value })}
                    />
                  </label>
                </div>
                <label className="afm-block">
                  {draftRule.type === 'regex' ? 'Regex pattern' : 'Keywords (comma-separated)'}
                  <input
                    placeholder={draftRule.type === 'regex' ? '\\b0x[a-fA-F0-9]{40}\\b' : 'venmo, cashapp, paypal.me'}
                    value={draftRule.pattern}
                    onChange={e => setDraftRule({ ...draftRule, pattern: e.target.value })}
                  />
                </label>
                <div className="afm-rule-form-actions">
                  <button className="afm-btn-primary" onClick={submitRule} data-testid="submit-rule">Add rule</button>
                </div>
              </div>
            )}

            <div className="afm-rule-list">
              {rules.map((rule, idx) => (
                <div key={rule.id || idx} className="afm-rule-item" data-testid={`rule-${idx}`}>
                  <div className="afm-rule-main">
                    <div className="afm-rule-title">
                      <span className={`afm-rule-type afm-rule-type-${rule.type}`}>{rule.type}</span>
                      <strong>{rule.label}</strong>
                      {rule.status === 'pending_review' && <span className="afm-rule-pending">pending review</span>}
                    </div>
                    <code className="afm-rule-pattern">{rule.pattern}</code>
                  </div>
                  <div className="afm-rule-actions">
                    <span className={`afm-rule-state ${rule.enabled ? 'on' : 'off'}`}>
                      {rule.enabled ? 'Active' : (rule.status === 'pending_review' ? 'Awaiting review' : 'Disabled')}
                    </span>
                    {/* A rule sitting at "Awaiting review" does nothing to messages.
                        This is the button that actually puts it in front of them. */}
                    <button
                      className={rule.enabled ? 'afm-rule-off' : 'afm-rule-approve'}
                      onClick={() => toggleRule(rule)}
                      data-testid={`toggle-rule-${idx}`}
                    >
                      {rule.enabled ? 'Switch off' : 'Approve & activate'}
                    </button>
                    <button
                      className="afm-rule-del"
                      onClick={() => deleteRule(rule)}
                      title="Delete rule"
                      data-testid={`delete-rule-${idx}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="afm-edge-note">
              <strong>Weekly edge-case review:</strong> patterns that produce false positives or misses are
              collected here each week to refine the rule set. Approve/confirm decisions in the queue feed this review.
            </div>
          </div>

        /* ============ MESSAGE DETAIL (with per-message actions) ============ */
        ) : loading ? (
          <div className="afm-empty">Loading...</div>
        ) : selectedChat ? (
          <div className="afm-chat-view">
            <div className="afm-chat-head">
              <button className="afm-btn-back" onClick={() => setSelectedChat(null)} data-testid="back-to-flagged">
                ← Back to queue
              </button>
              <div className="afm-participants">
                <span>{displayHandle(selectedChat.user1)}</span>
                <span className="afm-sep">↔</span>
                <span>{displayHandle(selectedChat.user2)}</span>
              </div>
            </div>
            <div className="afm-messages">
              {/* Show the WHOLE conversation, not just flagged lines. A chat can surface in the
                  strike-watch / reports queue because of the USER, with no individually-flagged
                  message — filtering to flagged-only made those open completely empty. */}
              {chatMessages.length === 0 ? (
                <p className="afm-no-messages">No messages in this conversation</p>
              ) : (
                chatMessages.map((msg, idx) => {
                  const key = msgKey(msg, idx);
                  const res = resolutions[key];
                  const isFlagged = !!(msg.filtered || msg.reported);
                  return (
                    <div key={idx} className={`afm-message ${isFlagged ? '' : 'is-clean'} ${res ? `is-${res.action}` : ''}`} data-testid={isFlagged ? `flagged-msg-${idx}` : `msg-${idx}`}>
                      <div className="afm-message-head">
                        <span className="afm-sender">{displayHandle(msg, 'sender_nickname', 'sender_username')}</span>
                        <span className="afm-time">{new Date(msg.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="afm-message-body">{msg.message}</div>
                      {isFlagged && (
                        <div className="afm-message-flag">
                          ⚠️ {msg.reported ? 'Reported by user' : 'Content filtered'} — reported to admin
                        </div>
                      )}

                      {!isFlagged ? null : res ? (
                        <div className={`afm-resolved afm-resolved-${res.action}`} data-testid={`resolution-${idx}`}>
                          {res.action === 'approve' && <><Check size={14} /> Approved — message delivered, strike restored</>}
                          {res.action === 'confirm' && <><AlertTriangle size={14} /> Violation confirmed — strike applied, user notified</>}
                          {res.action === 'escalate' && <><ArrowUpRight size={14} /> Escalated — user {res.escalation === 'suspend' ? 'suspended' : 'warned'}</>}
                        </div>
                      ) : escalating === key ? (
                        <div className="afm-escalate-choice" data-testid={`escalate-choice-${idx}`}>
                          <span>Escalate to:</span>
                          <button className="afm-act afm-act-warn" onClick={() => resolveMessage(msg, idx, 'escalate', 'warn')}>Warn user</button>
                          <button className="afm-act afm-act-suspend" onClick={() => resolveMessage(msg, idx, 'escalate', 'suspend')}><Ban size={14} /> Suspend user</button>
                          <button className="afm-act afm-act-cancel" onClick={() => setEscalating(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="afm-actions" data-testid={`msg-actions-${idx}`}>
                          <button className="afm-act afm-act-approve" onClick={() => resolveMessage(msg, idx, 'approve')} data-testid={`approve-${idx}`}>
                            <Check size={14} /> Approve (false positive)
                          </button>
                          <button className="afm-act afm-act-confirm" onClick={() => resolveMessage(msg, idx, 'confirm')} data-testid={`confirm-${idx}`}>
                            <AlertTriangle size={14} /> Confirm violation
                          </button>
                          <button className="afm-act afm-act-escalate" onClick={() => setEscalating(key)} data-testid={`escalate-${idx}`}>
                            <ArrowUpRight size={14} /> Escalate
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        /* ============ QUEUE LIST ============ */
        ) : (
          <>
            {/* sub-tabs for the three queue categories */}
            <div className="afm-queue-tabs">
              {QUEUES.map(q => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.key}
                    className={`afm-queue-tab ${queue === q.key ? 'is-active' : ''}`}
                    onClick={() => setQueue(q.key)}
                    data-testid={`queue-tab-${q.key}`}
                  >
                    <Icon size={15} /> {q.label}
                    <span className="afm-queue-count">{countFor(q.key)}</span>
                  </button>
                );
              })}
            </div>
            <p className="afm-queue-desc">{activeQueue?.desc}</p>

            {queueChats.length === 0 ? (
              <div className="afm-empty">
                <CheckCircle size={64} color="#22c55e" />
                <p>Nothing in the {activeQueue?.label.toLowerCase()} queue — looks clean!</p>
                <span>Items will appear here when detected.</span>
              </div>
            ) : (
              <div className="afm-grid">
                {queueChats.map((chat, idx) => (
                  <article
                    key={idx}
                    className="afm-card"
                    data-testid={`flagged-chat-${idx}`}
                    onClick={() => {
                      setSelectedChat(chat);
                      fetchChatMessages(chat.user1.id, chat.user2.id);
                    }}
                  >
                    <div className="afm-card-head">
                      <div className="afm-card-participant">
                        <span className="afm-name">{displayHandle(chat.user1)}</span>
                        <span className="afm-role">{chat.user1.role}</span>
                      </div>
                      <div className="afm-arrow">↔</div>
                      <div className="afm-card-participant">
                        <span className="afm-name">{displayHandle(chat.user2)}</span>
                        <span className="afm-role">{chat.user2.role}</span>
                      </div>
                    </div>
                    <div className="afm-card-preview">
                      <p>{chat.last_message}</p>
                      <span>{new Date(chat.last_message_at).toLocaleString()}</span>
                    </div>
                    <div className="afm-card-flag">
                      <AlertTriangle size={14} /> {flaggedCount(chat)} flagged message{flaggedCount(chat) !== 1 ? 's' : ''} — view & action
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .afm-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .afm-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
        .afm-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .afm-header h1 :global(svg) { color: #f59e0b; }
        .afm-header p { color: #718096; margin: 0; font-size: 0.92rem; max-width: 700px; line-height: 1.55; }
        .afm-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .afm-stat { background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); border: 2px solid #f59e0b; padding: 14px 22px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; min-width: 130px; }
        .afm-stat span { font-size: 0.72rem; color: #533f03; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
        .afm-stat strong { font-size: 1.6rem; color: #92400e; margin-top: 4px; }

        /* "Filter rules" sits at the right of the header, opposite the count boxes. */
        .afm-header { align-items: center; margin-bottom: 22px; }
        .afm-tab { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; padding: 10px 16px; background: #fff; border: 1px solid #e8ecff; border-radius: 10px; font-weight: 600; font-size: 0.92rem; color: #5b6573; cursor: pointer; }
        .afm-tab:hover { color: #07074e; border-color: #d6dbff; background: #f7f8ff; }
        .afm-tab.is-active { color: #fff; background: #07074e; border-color: #07074e; }

        .afm-queue-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .afm-queue-tab { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; background: white; border: 1.5px solid #e8ecff; border-radius: 999px; font-weight: 600; font-size: 0.85rem; color: #4a5568; cursor: pointer; transition: all 0.16s ease; }
        .afm-queue-tab:hover { border-color: #5b6bff; color: #07074e; }
        .afm-queue-tab.is-active { background: #07074e; border-color: #07074e; color: white; }
        .afm-queue-count { padding: 1px 8px; border-radius: 999px; background: #eef2ff; color: #1e1e7e; font-size: 0.74rem; font-weight: 700; }
        .afm-queue-tab.is-active .afm-queue-count { background: rgba(255,255,255,0.18); color: white; }
        .afm-queue-desc { color: #718096; font-size: 0.86rem; margin: 0 0 18px; }

        .afm-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .afm-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }
        .afm-empty span { color: #94a3b8; font-size: 0.9rem; }
        .afm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 18px; }
        .afm-card { background: white; border: 1.5px solid #e8ecff; border-left: 4px solid #ef4444; border-radius: 14px; padding: 20px; cursor: pointer; transition: all 0.2s ease; }
        .afm-card:hover { border-color: #ef4444; box-shadow: 0 6px 18px rgba(239,68,68,0.15); transform: translateY(-2px); }
        .afm-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
        .afm-card-participant { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
        .afm-name { font-weight: 700; color: #07074e; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .afm-role { font-size: 0.7rem; text-transform: uppercase; padding: 2px 8px; background: #eef2ff; color: #1e1e7e; border-radius: 999px; align-self: flex-start; font-weight: 600; letter-spacing: 0.04em; }
        .afm-arrow { color: #94a3b8; font-size: 1.2rem; }
        .afm-card-preview p { margin: 0 0 4px; color: #4a5568; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .afm-card-preview span { color: #94a3b8; font-size: 0.78rem; }
        .afm-card-flag { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 12px; background: #fee2e2; color: #991b1b; border-radius: 8px; font-size: 0.82rem; font-weight: 600; }

        .afm-chat-view { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; overflow: hidden; }
        .afm-chat-head { display: flex; align-items: center; gap: 20px; padding: 18px 22px; background: #f8f9ff; border-bottom: 1.5px solid #e8ecff; }
        .afm-btn-back { padding: 8px 14px; background: white; border: 1.5px solid #e2e8f0; border-radius: 8px; font-weight: 600; color: #4a5568; cursor: pointer; font-size: 0.85rem; }
        .afm-btn-back:hover { border-color: #5b6bff; color: #07074e; }
        .afm-participants { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #1a202c; }
        .afm-sep { color: #94a3b8; }
        .afm-messages { padding: 24px; max-height: 640px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
        .afm-no-messages { text-align: center; color: #94a3b8; padding: 40px; margin: 0; }
        .afm-message { background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 12px; padding: 14px 16px; transition: opacity 0.2s ease; }
        /* Non-flagged messages are shown for context — keep them neutral, not amber. */
        .afm-message.is-clean { background: #fff; border-color: #e8ebf0; }
        .afm-message.is-approve { background: #f0fdf4; border-color: #86efac; }
        .afm-message.is-confirm { background: #fef2f2; border-color: #fca5a5; }
        .afm-message.is-escalate { background: #fef2f2; border-color: #ef4444; }
        .afm-message-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .afm-sender { font-weight: 700; color: #07074e; font-size: 0.9rem; }
        .afm-time { color: #94a3b8; font-size: 0.78rem; }
        .afm-message-body { color: #1a202c; line-height: 1.5; word-wrap: break-word; }
        .afm-message-flag { display: inline-block; margin-top: 10px; padding: 4px 10px; background: #fef3c7; color: #92400e; border-radius: 6px; font-size: 0.72rem; font-weight: 700; }

        .afm-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #f1d4a3; }
        .afm-act { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 8px; font-weight: 600; font-size: 0.82rem; cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s ease; }
        .afm-act-approve { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
        .afm-act-approve:hover { background: #16a34a; color: #fff; border-color: #16a34a; }
        .afm-act-confirm { background: #fff7ed; color: #c2410c; border-color: #fdba74; }
        .afm-act-confirm:hover { background: #ffedd5; }
        .afm-act-escalate { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
        .afm-act-escalate:hover { background: #fee2e2; }
        .afm-escalate-choice { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #f1d4a3; font-size: 0.83rem; color: #4a5568; font-weight: 600; }
        .afm-act-warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
        .afm-act-warn:hover { background: #fef3c7; }
        .afm-act-suspend { background: #fef2f2; color: #b91c1c; border-color: #ef4444; }
        .afm-act-suspend:hover { background: #fee2e2; }
        .afm-act-cancel { background: white; color: #64748b; border-color: #e2e8f0; }
        .afm-resolved { display: inline-flex; align-items: center; gap: 7px; margin-top: 14px; padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; }
        .afm-resolved-approve { background: #dcfce7; color: #15803d; }
        .afm-resolved-confirm { background: #fee2e2; color: #b91c1c; }
        .afm-resolved-escalate { background: #fee2e2; color: #991b1b; }

        .afm-rules { background: white; border: 1.5px solid #e8ecff; border-radius: 16px; padding: 26px; }
        .afm-rules-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
        .afm-rules-head h2 { display: flex; align-items: center; gap: 9px; font-size: 1.2rem; color: #07074e; margin: 0 0 6px; }
        .afm-rules-head p { color: #718096; font-size: 0.86rem; margin: 0; max-width: 620px; line-height: 1.5; }
        .afm-btn-primary { display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; background: linear-gradient(100deg,#12124f,#07074e); color: #fff; border: none; border-radius: 10px; font-weight: 600; font-size: 0.86rem; cursor: pointer; white-space: nowrap; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .afm-btn-primary:hover { background: #2e2e94; }
        .afm-icon-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; }
        .afm-icon-btn:hover { color: #475569; }

        .afm-rule-form { border: 1.5px solid #c7d2fe; background: #f8f9ff; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .afm-rule-form-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; color: #07074e; }
        .afm-rule-form-row { display: flex; gap: 14px; margin-bottom: 12px; flex-wrap: wrap; }
        .afm-rule-form label, .afm-block { display: flex; flex-direction: column; gap: 5px; font-size: 0.78rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.03em; }
        .afm-block { margin-bottom: 14px; }
        .afm-grow { flex: 1; min-width: 200px; }
        .afm-rule-form input, .afm-rule-form select { padding: 9px 12px; border: 1.5px solid #d8def0; border-radius: 8px; font-size: 0.88rem; font-weight: 500; text-transform: none; letter-spacing: 0; color: #1a202c; }
        .afm-rule-form input:focus, .afm-rule-form select:focus { outline: none; border-color: #5b6bff; }
        .afm-rule-form-actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
        .afm-review-note { display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #b45309; font-weight: 600; }

        .afm-rule-list { display: flex; flex-direction: column; gap: 10px; }
        .afm-rule-item { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 16px; border: 1.5px solid #eef2f9; border-radius: 11px; }
        .afm-rule-main { min-width: 0; }
        .afm-rule-title { display: flex; align-items: center; gap: 9px; margin-bottom: 6px; flex-wrap: wrap; }
        .afm-rule-title strong { color: #07074e; font-size: 0.92rem; }
        .afm-rule-type { font-size: 0.66rem; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; font-weight: 700; letter-spacing: 0.04em; }
        .afm-rule-type-regex { background: #e9ecff; color: #6d7bff; }
        .afm-rule-type-keyword { background: #e0f2fe; color: #0369a1; }
        .afm-rule-pending { font-size: 0.66rem; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: #fef3c7; color: #92400e; font-weight: 700; letter-spacing: 0.04em; }
        .afm-rule-pattern { display: block; font-family: ui-monospace, Menlo, monospace; font-size: 0.8rem; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 760px; }
        .afm-rule-state { font-size: 0.76rem; font-weight: 700; padding: 4px 11px; border-radius: 999px; white-space: nowrap; }
        .afm-rule-state.on { background: #dcfce7; color: #15803d; }
        .afm-rule-state.off { background: #f1f5f9; color: #64748b; }
        .afm-rule-actions { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .afm-rule-approve { border: 0; cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 6px 12px; border-radius: 8px; background: #07074e; color: #fff; }
        .afm-rule-approve:hover { background: #14146b; }
        .afm-rule-off { border: 1.5px solid #e2e8f0; cursor: pointer; font-size: 0.76rem; font-weight: 700; padding: 5px 11px; border-radius: 8px; background: #fff; color: #64748b; }
        .afm-rule-off:hover { border-color: #cbd5e1; color: #475569; }
        .afm-rule-del { display: grid; place-items: center; border: 1.5px solid #eef2f9; cursor: pointer; padding: 5px; border-radius: 8px; background: #fff; color: #94a3b8; }
        .afm-rule-del:hover { border-color: #fecaca; color: #dc2626; background: #fef2f2; }
        .afm-edge-note { margin-top: 22px; padding: 14px 16px; background: #f8f9ff; border: 1px solid #e8ecff; border-radius: 11px; color: #475569; font-size: 0.84rem; line-height: 1.55; }
        .afm-edge-note strong { color: #07074e; }

        @media (max-width: 720px) {
          .afm-container { padding: 20px; }
          .afm-header { flex-direction: column; align-items: stretch; gap: 14px; }
          .afm-stats { justify-content: stretch; }
          .afm-stat { flex: 1; }
          .afm-tab { margin-left: 0; justify-content: center; }
        }
      `}</style>
    </AdminLayout>
  );
}
