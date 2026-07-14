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
