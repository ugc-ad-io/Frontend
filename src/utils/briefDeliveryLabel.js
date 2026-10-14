export default function briefDeliveryLabel(item) {
  const edited = item.edited_required;
  const raw = item.raw_required !== false;
  const content = edited ? (raw ? 'Raw + Edited video' : 'Edited video') : 'Raw video';
  return edited ? `${content} (edited by ${item.edited_by === 'ugc' ? 'UGC.ad' : 'creator'})` : content;
}
