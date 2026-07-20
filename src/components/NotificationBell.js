import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Several notifications were stored (and are still emitted) with links to routes that
// don't exist, so clicking them called navigate() on a dead path and nothing happened.
// This rewrites the known-bad/legacy paths to the real ones — and because it runs on
// read, it fixes notifications ALREADY sitting in the DB, not just new ones.
const LEGACY_LINK_MAP = {
  '/deals': '/my-deals',
  '/payouts': '/withdrawal',
  '/creator-dashboard': '/dashboard/creator',
  '/dashboard/creator/inbox': '/messages',
  '/dashboard/business/deals': '/dashboard/business/all-campaigns',
  '/admin/match-queue': '/dashboard/admin/campaigns',
  '/admin/campaigns': '/dashboard/admin/campaigns',
  '/dashboard/admin/flagged-messages': '/dashboard/admin/flagged',
};
const resolveNotifLink = (link) => {
  if (!link) return null;
  const [path, rest] = String(link).split(/(?=[?#])/);
  return (LEGACY_LINK_MAP[path] || path) + (rest || '');
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  // Notification ids we've already popped a toast for. Seeded on first load so we
  // don't spam toasts for notifications that arrived before this page opened.
  const seenIdsRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    // Poll the LIST (not just the count) so a new message can be popped as a toast.
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications/my-notifications`);
      const list = Array.isArray(response.data) ? response.data : [];
      setNotifications(list);

      // First load: remember what's already there, don't toast any of it.
      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(list.map((n) => n.id));
        return;
      }

      // Anything new + still unread since the last poll → pop a toast.
      const fresh = list.filter((n) => n.id && !seenIdsRef.current.has(n.id) && !n.read);
      fresh.forEach((n) => {
        seenIdsRef.current.add(n.id);
        toast(n.title || 'New notification', {
          description: n.message,
          action: n.link
            ? { label: 'Open', onClick: () => navigate(n.link) }
            : undefined,
        });
      });
      // Keep the seen-set in sync with everything we've now rendered.
      list.forEach((n) => n.id && seenIdsRef.current.add(n.id));
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/notifications/unread-count`);
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count');
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/read`);
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read`);
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);
    const target = resolveNotifLink(notification.link);
    if (target) {
      navigate(target);
      setShowDropdown(false);
    }
  };

  // Only these four tones have styling. Anything else (e.g. the backend's
  // "message" type) fell through to an unstyled, background-less icon — map it
  // onto `info` so every notification renders with a proper coloured badge.
  const TONE = (type) => (['success', 'warning', 'error'].includes(type) ? type : 'info');

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✕';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell-button"
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) fetchNotifications();
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={handleMarkAllRead}>
                <Check size={16} /> Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <Bell size={48} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''} ${TONE(notification.type)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>
                      {notification.title}
                      {notification.source === 'admin' && (
                        <span className="notification-admin-chip">
                          {notification.sender_label || 'Admin'}
                        </span>
                      )}
                    </h4>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  {!notification.read && (
                    <button
                      className="mark-read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification.id);
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        .notification-bell-container {
          position: relative;
        }

        .notification-bell-button {
          position: relative;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          background: #fff;
          border: 1px solid #e7e9f1;
          border-radius: 12px;
          cursor: pointer;
          color: #6b7088;
          transition: border-color 0.2s, transform 0.2s;
        }

        .notification-bell-button:hover {
          border-color: #d6d9ee;
          transform: translateY(-1px);
        }

        .notification-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: white;
          border: 2px solid #fff;
          border-radius: 9px;
          padding: 0 4px;
          font-size: 0.68rem;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
        }

        .notification-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          width: 400px;
          max-height: 600px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .notification-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .mark-all-read {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #667eea;
          font-size: 0.875rem;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .mark-all-read:hover {
          background-color: #f3f4f6;
        }

        .notification-list {
          max-height: 500px;
          overflow-y: auto;
        }

        .no-notifications {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #9ca3af;
        }

        .no-notifications p {
          margin-top: 12px;
          font-size: 0.875rem;
        }

        .notification-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .notification-item:hover {
          background-color: #f9fafb;
        }

        .notification-item.unread {
          background-color: #eff6ff;
        }

        .notification-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        .notification-item.info .notification-icon {
          background-color: #dbeafe;
          color: #2563eb;
        }

        .notification-item.success .notification-icon {
          background-color: #d1fae5;
          color: #059669;
        }

        .notification-item.warning .notification-icon {
          background-color: #fef3c7;
          color: #d97706;
        }

        .notification-item.error .notification-icon {
          background-color: #fee2e2;
          color: #dc2626;
        }

        .notification-content {
          flex: 1;
        }

        .notification-content h4 {
          margin: 0 0 4px 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .notification-admin-chip {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #4338ca;
          background: #eef2ff;
          border: 1px solid #dfe4ff;
          border-radius: 999px;
          padding: 2px 8px;
          line-height: 1.4;
        }

        .notification-content p {
          margin: 0 0 8px 0;
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.4;
        }

        .notification-time {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .mark-read-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #9ca3af;
          transition: color 0.2s;
        }

        .mark-read-btn:hover {
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .notification-dropdown {
            width: 90vw;
            right: -50%;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;
