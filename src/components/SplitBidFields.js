// Bid inputs for a brief where the creator (not UGC.ad) edits the video: one payout
// for the raw video and one for the edited video. The parent keeps its own bid total
// in sync via onChange, so its budget check and `amount` payload work unchanged.
export default function SplitBidFields({ value, onChange, max }) {
  const set = (key, raw) => {
    const next = { ...value, [key]: String(raw || '').replace(/[^0-9]/g, '') };
    onChange(next, (Number(next.raw) || 0) + (Number(next.edited) || 0));
  };
  const total = (Number(value.raw) || 0) + (Number(value.edited) || 0);
  return (
    <>
      <label>
        Payout for raw video (₹)
        <input type="text" inputMode="numeric" required value={value.raw} onChange={(e) => set('raw', e.target.value)} placeholder="e.g. 1000" />
      </label>
      <label>
        Payout for edited video (₹)
        <input type="text" inputMode="numeric" required value={value.edited} onChange={(e) => set('edited', e.target.value)} placeholder="e.g. 1000" />
      </label>
      <small>
        This brief needs you to edit the video too. Total bid: ₹{total.toLocaleString('en-IN')}
        {max ? ` (max ₹${Number(max).toLocaleString('en-IN')})` : ''}
      </small>
    </>
  );
}

export const EMPTY_SPLIT = { raw: '', edited: '' };

/** Extra payload fields for a split bid (the backend recomputes `amount` from them). */
export const splitPayload = (split) => ({ raw_amount: Number(split.raw) || 0, edited_amount: Number(split.edited) || 0 });
