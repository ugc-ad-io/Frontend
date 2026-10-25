import { Inbox } from 'lucide-react';
import '../styles/brand-ui-states.css';
import '../styles/brand-ui-mobile-b.css';
import '../styles/creator-ui-popups.css';

/**
 * Shared friendly empty-state block: an icon tile, a title, a helper line
 * and an optional call-to-action button. Used across creator + brand pages so
 * every "no data yet" screen looks intentional and consistent.
 */
export default function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="cmk-emptystate bui-es">
      {Icon && <span className="cmk-emptystate-ic"><Icon size={30} /></span>}
      {title && <h3>{title}</h3>}
      {message && <p>{message}</p>}
      {action && (
        <button type="button" className="cmk-emptystate-btn" onClick={action.onClick}>
          {action.icon && <action.icon size={18} />} {action.label}
        </button>
      )}
    </div>
  );
}
