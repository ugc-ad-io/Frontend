import { X } from 'lucide-react';
import SplitBidFields from './SplitBidFields';
import { BidFeeNotice } from './BidGate';
import { needsEditSplit } from '../utils/campaignCreators';
import { maxCampaignBid } from '../utils/bidBudget';
import '../styles/creator-ui-apply.css';

/**
 * The application form shown in the right column of the brief detail (board C03).
 * On phones it becomes a full-screen sheet with the submit bar pinned to the bottom.
 * All state and the submit handler live in the page (BrowseBriefs); this is markup only.
 */
export default function BriefApplyForm({
  brief, split, setSplit, bidAmount, setBidAmount, deliveryDays, setDeliveryDays,
  proposal, setProposal, submitting, onSubmit, onCancel, percent,
}) {
  return (
    <div className="cui-b-apply is-form">
      <form onSubmit={onSubmit} className="cui-b-form">
        <div className="cui-b-fhead">
          <div>
            <h2>Apply to this brief</h2>
            <p className="cui-b-sub">{brief.title || 'Campaign'} · {brief.brand || 'Brand'}</p>
          </div>
          <button type="button" className="cui-b-x" aria-label="Close" onClick={onCancel} disabled={submitting}><X size={20} /></button>
        </div>

        <div className="cui-b-fbody">
          {needsEditSplit(brief.campaign || brief) ? (
            <SplitBidFields value={split} max={maxCampaignBid(brief)} onChange={(v, total) => { setSplit(v); setBidAmount(String(total)); }} />
          ) : (
            <label>Your price per video (₹)
              <input type="number" inputMode="numeric" min="1" max={maxCampaignBid(brief) || undefined} required value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Enter your bid amount" />
            </label>
          )}
          <BidFeeNotice amount={bidAmount} percent={percent} />
          <label>Estimated delivery (days)
            <input type="number" inputMode="numeric" step="1" min="1" required value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} placeholder="How many days to complete?" />
          </label>
          <label>Why you? (the brand sees this)
            <textarea rows={4} required value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Describe your approach, experience, and why you're the right fit..." />
          </label>
        </div>

        <div className="cui-b-ffoot">
          <button type="submit" className="cui-b-cta" disabled={submitting}>{submitting ? 'Sending…' : 'Send application'}</button>
          <button type="button" className="cui-b-cancel" onClick={onCancel} disabled={submitting}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
