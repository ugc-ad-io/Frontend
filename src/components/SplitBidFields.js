// One per-video bid includes both raw and edited files. Keep the parent callback
// contract while sending only the combined amount to the backend.
export default function SplitBidFields({ value, onChange, max }) {
  const set = (key, raw) => {
    const next = { ...value, [key]: String(raw || '').replace(/[^0-9]/g, ''), edited: '' };
    onChange(next, Number(next.raw) || 0);
  };
  const total = Number(value.raw) || 0;
  return (
    <>
      <label>
        Combined payout per video (₹)
        <input type="text" inputMode="numeric" required value={value.raw} onChange={(e) => set('raw', e.target.value)} placeholder="e.g. 1000" />
      </label>
      <small>
        One bid includes both the raw video and the edited video. Payout per video: ₹{total.toLocaleString('en-IN')}
        {max ? ` (max ₹${Number(max).toLocaleString('en-IN')})` : ''}
      </small>
    </>
  );
}

export const EMPTY_SPLIT = { raw: '', edited: '' };

/** Legacy callers no longer send separate prices; amount is the inclusive bid. */
export const splitPayload = () => ({});
