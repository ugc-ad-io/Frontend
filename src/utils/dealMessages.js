const same = (a, b) => a != null && b != null && String(a) === String(b);

export function findCreatorDeal(deals, campaignId, creatorId) {
  if (creatorId == null) return null;
  return deals.find((deal) => same(deal.campaign?.id ?? deal.campaign_id, campaignId)
    && same(deal.creator?.id ?? deal.creator_id, creatorId)) || null;
}

// Defense in depth for API responses. The server must also scope messages to
// the authenticated participant and the individual deal, never just a campaign.
export function getDealMessages(deal, role, viewerId) {
  if (!deal) return [];
  const creatorId = deal.creator?.id ?? deal.creator_id;
  if (role === 'creator' && creatorId != null && !same(creatorId, viewerId)) return [];
  const dealId = deal.deal_id ?? deal.id;
  return (deal.chat_summary?.messages || []).filter((message) => {
    if (message.deal_id != null && !same(message.deal_id, dealId)) return false;
    if (message.creator_id != null && !same(message.creator_id, creatorId ?? viewerId)) return false;
    if (message.sender_type === 'creator' && message.sender_id != null
      && !same(message.sender_id, creatorId ?? viewerId)) return false;
    const system = message.sender_type === 'system' || message.system_message || message.sender_id === 'system';
    if (!system) return true;
    if (message.recipient_id != null && !same(message.recipient_id, viewerId)) return false;
    const audience = message.recipient_role || message.audience;
    if (['creator', 'brand', 'business'].includes(audience)
      && (audience === 'business' ? 'brand' : audience) !== role) return false;
    // Older selection notices have no audience metadata. Keep each version on
    // its intended side rather than exposing both notices to both participants.
    const body = message.message || '';
    if (/you['’]ve successfully selected/i.test(body)) return role === 'brand';
    if (/you['’]ve been selected|you have been selected/i.test(body)) return role === 'creator';
    return true;
  });
}
