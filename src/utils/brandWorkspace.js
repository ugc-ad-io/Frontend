// Which brand "workspace" a user belongs to.
//
// A campaign's `business_id` is NOT the id of whoever created it — the backend
// stamps it with _brand_ws_id(user) (server.py), which is:
//
//     user.team_of || user.id
//
// so every member of a brand team writes to, and reads, the OWNER's id. A brand
// owner has no `team_of`, so for them the two are the same value; for an invited
// team member they are different.
//
// Comparing `campaign.business_id === user.id` therefore looks right and works
// fine for the owner, but silently matches NOTHING for a team member: their own
// brand's campaigns all carry the owner's id. That is what made "All Campaigns"
// render "No campaigns yet" on an account that had live, approved campaigns, and
// what made the same account read as not-the-owner on a campaign detail page.
//
// Always compare against brandWorkspaceId(), never against user.id.

/** The brand workspace this user reads and writes. Mirrors _brand_ws_id(). */
export function brandWorkspaceId(user) {
  if (!user) return null;
  return user.team_of || user.id || null;
}

/**
 * Does this campaign belong to the user's brand workspace?
 *
 * Compares as strings so an id that arrives as a number on one side and a string
 * on the other still matches. Returns false when either side is missing rather
 * than letting `undefined === undefined` report a false match.
 */
export function ownsCampaign(user, campaign) {
  const ws = brandWorkspaceId(user);
  const owner = campaign?.business_id;
  if (!ws || !owner) return false;
  return String(owner) === String(ws);
}
