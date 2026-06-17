import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../App';

/**
 * Sticky admin topbar — modelled on the reference admin shell.
 * Holds only the user identity + a dropdown (name/email + Sign out)
 * on the far right; the page title lives in the content `.page-head`.
 */
export default function AdminTopbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const name = user?.nickname || user?.full_name || 'Admin';
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="admin-topbar">
      <div className="admin-user">
        <button
          type="button"
          className="admin-user-btn"
          onClick={() => setOpen((o) => !o)}
          data-testid="admin-user-menu-btn"
        >
          <span className="admin-topbar-avatar">{initials}</span>
          <span className="admin-user-name">{name}</span>
          <span className="admin-user-caret"><ChevronDown size={14} /></span>
        </button>

        {open && (
          <>
            <div className="admin-user-backdrop" onClick={() => setOpen(false)} />
            <div className="admin-user-menu">
              <div className="admin-user-menu-head">
                <div className="admin-user-menu-name">{name}</div>
                <div className="admin-user-menu-email">{user?.email || user?.role}</div>
              </div>
              <button
                type="button"
                className="admin-user-menu-item"
                onClick={handleLogout}
                data-testid="logout-btn"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
