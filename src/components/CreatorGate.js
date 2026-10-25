import { Check } from 'lucide-react';
import CreatorOnboardBar from './CreatorOnboardBar';
import { SUPPORT_EMAIL } from './ContactSupportBox';
import '../styles/creator-ui-onboarding.css';

const STAGES = ['Submitted', 'In review', 'Live'];

/**
 * Creator approval screen (board C16): icon tile + status pill, title, lead, optional 3-step
 * progress, then free content and the action buttons. tone: '' (navy, in review) | 'warn' | 'bad' | 'ok'.
 * `stage` (0-2) is the step currently reached; leave undefined to hide the progress bar.
 */
export default function CreatorGate({ icon: Icon, tone = '', chip, title, lead, stage, children, actions }) {
  const t = tone ? ` is-${tone}` : '';
  const card = (
    <section className="cui-s-gcard">
      <div className="cui-s-gtop">
        <span className={`cui-s-gic${t}`} aria-hidden="true"><Icon size={26} /></span>
        <span className={`cui-s-pill${t}`}>{chip}</span>
      </div>
      <h1 className="cui-s-gt">{title}</h1>
      <p className="cui-s-gl">{lead}</p>
      {stage != null && (
        <div className="cui-s-prog">
          <div className="cui-s-prog-b" aria-hidden="true">
            {STAGES.map((s, i) => <span key={s} className={i <= stage ? 'is-on' : ''} />)}
          </div>
          <div className="cui-s-prog-l">
            {STAGES.map((s, i) => <span key={s} className={i === stage ? 'is-now' : ''}>{s}</span>)}
          </div>
        </div>
      )}
      {children}
      {actions && <div className="cui-s-gact">{actions}</div>}
    </section>
  );
  return (
    <div className="cui-s">
      <CreatorOnboardBar right={<span className="cui-s-help">Need help? <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a></span>} />
      <main className="cui-s-gmain">{card}</main>
    </div>
  );
}

/** A small tick row used under the progress bar. */
export function GateCheck({ children }) {
  return <div><i aria-hidden="true"><Check size={12} /></i><span>{children}</span></div>;
}
