import BrandGateHeader from './BrandGateHeader';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-gates.css';

/**
 * Shared frame for the approval-status screens (pending / more info / rejected):
 * logo bar + centred card with icon tile, status chip, title and lead copy.
 * tone: '' (navy, under review) | 'warn' | 'bad'
 */
export default function BrandGateShell({ icon: Icon, tone = '', chip, chipClass = '', title, lead, children, actions }) {
  return (
    <div className="bui-app bg-page">
      <BrandGateHeader />
      <main className="gt-main">
        <section className="gt-card">
          <span className={`gt-ic${tone ? ` gt-ic--${tone}` : ''}`} aria-hidden="true"><Icon size={32} /></span>
          <span className={`bui-status ${chipClass}`} style={{ height: 24, padding: '0 10px' }}>{chip}</span>
          <h1>{title}</h1>
          <p className="gt-lead">{lead}</p>
          {children}
          {actions && <div className="gt-actions">{actions}</div>}
        </section>
      </main>
    </div>
  );
}
