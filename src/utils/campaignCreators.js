// A brief can hire several creators. `selected_creators` is the source of truth;
// `selected_creator` (singular) is still written for older reads, so anything that
// asks "who is on this campaign?" must go through here rather than reading either
// field directly — otherwise creators 2..N are invisible.

/** Every creator hired on this campaign, as strings. Falls back to the legacy field. */
export function selectedCreators(campaign) {
  const list = Array.isArray(campaign?.selected_creators)
    ? campaign.selected_creators.map(String).filter(Boolean)
    : [];
  if (list.length) return list;
  return campaign?.selected_creator ? [String(campaign.selected_creator)] : [];
}

/** Is this creator hired on this campaign? */
export const isSelectedCreator = (campaign, creatorId) =>
  selectedCreators(campaign).includes(String(creatorId));

/** How many creators the brand wants to hire on this brief. */
export const creatorsWanted = (campaign) => Math.max(1, Number(campaign?.creators_wanted) || 1);

/** Open slots still to be filled. */
export const slotsLeft = (campaign) =>
  Math.max(0, creatorsWanted(campaign) - selectedCreators(campaign).length);

/**
 * Should creators still see this brief in Browse / be able to bid on it?
 * It stays open while there are slots left — not just until the first hire.
 */
export const isOpenForBids = (campaign) =>
  campaign?.status === 'active' && slotsLeft(campaign) > 0;

/**
 * The creator (not UGC.ad's editors) cuts the edited file, so their bid is quoted
 * as two payouts: raw video + edited video (sent as raw_amount / edited_amount;
 * the backend recomputes `amount` as their sum).
 */
export const needsEditSplit = (campaign) =>
  (campaign?.deliverable_items || []).some(
    (d) => d?.edited_required && (d?.edited_by || 'creator') === 'creator'
  );

/** "Raw ₹X + Edited ₹Y" for a bid quoted as a split, else ''. */
export const bidSplitLabel = (bid) =>
  bid?.raw_amount != null
    ? `Raw ₹${Number(bid.raw_amount).toLocaleString('en-IN')} + Edited ₹${Number(bid.edited_amount || 0).toLocaleString('en-IN')}`
    : '';
