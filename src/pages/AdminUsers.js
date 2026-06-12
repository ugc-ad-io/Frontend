import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Search, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminUsers() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ nickname: '', email: '', role: '', balance: 0 });

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/users`);
      setAllUsers(response.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (u) => {
    setSelectedUser(u);
    setEditData({ nickname: u.nickname || '', email: u.email, role: u.role, balance: u.balance || 0 });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    try {
      await axios.post(`${API}/admin/user/update`, { user_id: selectedUser.id, ...editData });
      toast.success('User updated successfully');
      setShowEditModal(false);
      fetchAllUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleBan = async (userId, currentlyBanned) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    const confirmMessage = currentlyBanned
      ? 'Are you sure you want to unban this user?'
      : 'Are you sure you want to ban this user? They will not be able to log in.';
    if (!window.confirm(confirmMessage)) return;

    let banReason = null;
    if (!currentlyBanned) {
      banReason = prompt('Enter ban reason:');
      if (!banReason) return;
    }

    try {
      await axios.post(`${API}/admin/user/ban`, { user_id: userId, banned: !currentlyBanned, ban_reason: banReason });
      toast.success(`User ${action}ned successfully`);
      fetchAllUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || `Failed to ${action} user`);
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const qNoHash = q.replace(/^#/, '');
  const filtered = q
    ? allUsers.filter(u => {
        const cid = (u.public_creator_id || '').toLowerCase();
        const nick = (u.nickname || '').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        const mail = (u.email || '').toLowerCase();
        return cid.includes(q) || cid.replace(/^#/, '').includes(qNoHash) || nick.includes(q) || uname.includes(q) || mail.includes(q);
      })
    : allUsers;

  return (
    <AdminLayout>
      <div className="au-container">
        <div className="au-header">
          <div>
            <h1><Users size={26} /> All Users</h1>
            <p>Manage every user on the platform — search, edit, or ban</p>
          </div>
          <div className="au-stats">
            <div className="au-stat"><span>Total</span><strong>{allUsers.length}</strong></div>
            <div className="au-stat"><span>Creators</span><strong>{allUsers.filter(u => u.role === 'creator').length}</strong></div>
            <div className="au-stat"><span>Brands</span><strong>{allUsers.filter(u => u.role === 'business').length}</strong></div>
            <div className="au-stat"><span>Banned</span><strong>{allUsers.filter(u => u.banned).length}</strong></div>
          </div>
        </div>

        <div className="au-search-wrap">
          <Search size={16} className="au-search-icon" />
          <input
            type="text"
            className="au-search-input"
            placeholder="Search Creator ID, username, email, or nickname…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="users-search-input"
          />
          {searchTerm && (
            <button type="button" className="au-search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>

        <div className="au-table-wrap">
          <table className="au-table">
            <thead>
              <tr>
                <th>Creator ID / Handle</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="au-empty-row">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="au-empty-row">{searchTerm ? `No users match "${searchTerm}"` : 'No users found'}</td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className={u.banned ? 'au-row-banned' : ''} data-testid={`user-row-${u.id}`}>
                    <td>
                      <strong className="au-primary">
                        {u.role === 'creator' ? (u.public_creator_id || u.username ? `@${u.username}` : u.nickname || '—') : (u.username ? `@${u.username}` : u.nickname || '—')}
                      </strong>
                      {u.banned && <span className="au-ban-badge">BANNED</span>}
                    </td>
                    <td className="au-mono">{u.username ? `@${u.username}` : <span className="au-muted">—</span>}</td>
                    <td>{u.email}</td>
                    <td><span className="au-badge">{u.role}</span></td>
                    <td><span className={`au-badge au-badge-${u.approval_status}`}>{u.approval_status}</span></td>
                    <td>${u.balance?.toFixed(2) || '0.00'}</td>
                    <td>
                      <div className="au-actions">
                        <button className="au-btn au-btn-edit" onClick={() => handleEdit(u)}>Edit</button>
                        <button className={`au-btn ${u.banned ? 'au-btn-unban' : 'au-btn-ban'}`} onClick={() => handleBan(u.id, u.banned)}>
                          {u.banned ? 'Unban' : 'Ban'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && selectedUser && (
        <div className="au-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()}>
            <div className="au-modal-head">
              <h2>Edit User</h2>
              <button onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="au-modal-body">
              <label>Nickname<input type="text" value={editData.nickname} onChange={(e) => setEditData({...editData, nickname: e.target.value})} /></label>
              <label>Email<input type="email" value={editData.email} onChange={(e) => setEditData({...editData, email: e.target.value})} /></label>
              <label>Role
                <select value={editData.role} onChange={(e) => setEditData({...editData, role: e.target.value})}>
                  <option value="creator">Creator</option>
                  <option value="business">Business</option>
                  <option value="admin">Admin</option>
                  <option value="campaign_manager">Campaign Manager</option>
                  <option value="support_staff">Support Staff</option>
                </select>
              </label>
              <label>Balance<input type="number" value={editData.balance} onChange={(e) => setEditData({...editData, balance: parseFloat(e.target.value) || 0})} /></label>
            </div>
            <div className="au-modal-actions">
              <button className="au-btn au-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="au-btn au-btn-primary" onClick={handleUpdate}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .au-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .au-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
        .au-header h1 { display: flex; align-items: center; gap: 12px; font-size: var(--fs-h1); font-weight: var(--fw-head); color: #07074e; margin: 0 0 6px; }
        .au-header h1 :global(svg) { color: #07074e; }
        .au-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .au-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .au-stat { background: white; border: 1.5px solid #e8ecff; padding: 12px 18px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; min-width: 90px; }
        .au-stat span { font-size: 0.72rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .au-stat strong { font-size: 1.3rem; color: #07074e; margin-top: 4px; }
        .au-search-wrap { position: relative; margin-bottom: 20px; max-width: 480px; }
        .au-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .au-search-input { width: 100%; padding: 11px 38px 11px 40px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.9rem; background: white; }
        .au-search-input:focus { outline: none; border-color: #07074e; box-shadow: 0 0 0 3px rgba(7,7,78,0.08); }
        .au-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; border: none; background: #e2e8f0; color: #4a5568; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .au-table-wrap { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; overflow-x: auto; }
        .au-table { width: 100%; border-collapse: collapse; }
        .au-table th, .au-table td { padding: 14px 18px; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .au-table th { background: #f8f9ff; font-size: 0.78rem; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.04em; }
        .au-table td { font-size: 0.88rem; color: #1a202c; }
        .au-row-banned { background: #fef2f2; }
        .au-primary { font-weight: 700; color: #07074e; }
        .au-mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.85rem; color: #4a5568; }
        .au-muted { color: #cbd5e0; }
        .au-ban-badge { display: inline-block; margin-left: 8px; font-size: 0.65rem; font-weight: 700; padding: 2px 7px; background: #991b1b; color: white; border-radius: 4px; letter-spacing: 0.04em; }
        .au-badge { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #1e1e7e; text-transform: capitalize; }
        .au-badge-approved { background: #dcfce7; color: #166534; }
        .au-badge-pending { background: #fef3c7; color: #92400e; }
        .au-badge-rejected { background: #fee2e2; color: #991b1b; }
        .au-empty-row { text-align: center; padding: 40px !important; color: #94a3b8; font-style: italic; }
        .au-actions { display: flex; gap: 6px; }
        .au-btn { padding: 6px 12px; border: none; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease; }
        .au-btn-edit { background: #eef2ff; color: #1e1e7e; }
        .au-btn-edit:hover { background: #e0e7ff; }
        .au-btn-ban { background: #fee2e2; color: #991b1b; }
        .au-btn-ban:hover { background: #fecaca; }
        .au-btn-unban { background: #dcfce7; color: #166534; }
        .au-btn-unban:hover { background: #bbf7d0; }
        .au-btn-primary { background: #07074e; color: white; padding: 10px 18px; font-size: 0.9rem; }
        .au-btn-primary:hover { background: #1e1e7e; }
        .au-btn-secondary { background: #e2e8f0; color: #4a5568; padding: 10px 18px; font-size: 0.9rem; }
        .au-btn-secondary:hover { background: #cbd5e0; }
        .au-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .au-modal { background: white; border-radius: 16px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .au-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1.5px solid #e8ecff; }
        .au-modal-head h2 { margin: 0; font-size: var(--fs-h2); color: #07074e; }
        .au-modal-head button { background: none; border: none; cursor: pointer; color: #4a5568; }
        .au-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
        .au-modal-body label { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; font-weight: 600; color: #2d3748; }
        .au-modal-body input, .au-modal-body select { padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; }
        .au-modal-body input:focus, .au-modal-body select:focus { outline: none; border-color: #07074e; }
        .au-modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1.5px solid #e8ecff; }
        @media (max-width: 720px) {
          .au-container { padding: 20px; }
          .au-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
