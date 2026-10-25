import { useNavigate } from 'react-router-dom';
import EmptyState from './EmptyState';
import { Skeleton } from './Skeleton';
import { BriefLogo, inr } from './briefUi';
import '../styles/creator-ui-briefs.css';

// Invites = direct bookings / custom-priced requests the creator still has to answer.
// (Same rule the My Deals hub uses for "Requested Deals".) Accept / decline / counter
// happens in the deal view, so each card just opens it.
const bookingStatus = (d) => d?.campaign?.booking_status;
export const isInviteDeal = (d) =>
  ['pending_creator', 'price_revision'].includes(bookingStatus(d)) && !d?.campaign?.brief_sent;

const isObjectId = (s) => /^[0-9a-f]{24}$/i.test(String(s || ''));
const brandName = (d) => {
  const raw = String(d?.brand?.name || d?.campaign?.brand_name || d?.campaign?.business_name || d?.campaign?.business_nickname || '').replace(/^@+/, '').trim();
  return raw && !isObjectId(raw) ? raw : 'Brand';
};

export default function BriefInvites({ invites, loading, error, onRetry }) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="cui-b-inv-grid" aria-hidden="true">
        {[0, 1].map((i) => <div className="cui-b-inv" key={i} style={{ padding: 20 }}><Skeleton height={60} radius={12} /><Skeleton height={14} style={{ marginTop: 16 }} /><Skeleton height={44} radius={999} style={{ marginTop: 16 }} /></div>)}
      </div>
    );
  }
  if (error && !invites.length) {
    return <EmptyState title="Could not load invites" message={error} action={{ label: 'Retry', onClick: onRetry }} />;
  }
  if (!invites.length) {
    return <EmptyState title="No invites right now" message="When a brand books you directly or proposes a custom price, the invite lands here for you to accept, decline or counter." />;
  }
  return (
    <>
      <div className="cui-b-tip">Brands that invite you set the price up front — open an invite to accept, decline or counter.</div>
      <div className="cui-b-inv-grid">
        {invites.map((d) => {
          const c = d.campaign || {};
          const brand = brandName(d);
          const countered = bookingStatus(d) === 'price_revision';
          const amount = countered ? c.proposed_amount : (d?.escrow?.held_amount ?? c.budget_max ?? c.budget_min ?? d?.my_bid?.amount);
          const videos = Number(c.video_count) || 1;
          const open = () => navigate(`/my-deals?campaign=${c.id || d.deal_id}`);
          return (
            <article className="cui-b-inv" key={d.deal_id || c.id}>
              <div className="cui-b-inv-head">
                <div className="cui-b-inv-row">
                  <BriefLogo name={brand} src={d?.brand?.logo_url || c.brand_logo_url} />
                  <div>
                    <small>{brand} {countered ? 'is reviewing your counter' : 'invited you'} · no bidding needed</small>
                    <b>{c.title || 'Untitled brief'}</b>
                  </div>
                  <span className="cui-b-inv-amt">{inr(amount)}</span>
                </div>
              </div>
              <div className="cui-b-inv-body">
                {c.product_description ? <p>{c.product_description}</p> : null}
                <div className="cui-b-inv-meta">
                  <span>{videos} {videos === 1 ? 'video' : 'videos'}</span>
                  <strong>{countered ? 'Counter sent - awaiting brand' : 'Awaiting your response'}</strong>
                </div>
                <div className="cui-b-inv-act">
                  <button type="button" className="cui-b-pill-btn" onClick={open}>{countered ? 'View counter' : 'Review invite'}</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
