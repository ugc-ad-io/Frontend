// Revision payload + fee wording shared by the website's revision modals. Mirrors
// the app (ugcapp/src/brandHiring.ts) so both clients send the same request to
// POST /api/work/{work_id}/request-revision.

// The backend accepts 1 to 5 structured revision items per request.
export const MAX_REVISION_ITEMS = 5;

// How many of the 5 item slots a draft uses (a typed note takes one).
export const revisionItemCount = (commentCount, note) => commentCount + (String(note || '').trim() ? 1 : 0);

// comments: [{ description, timestamp_seconds? }]. The server only SHOWS the creator
// the items (notes never reach the creator's deal view), so a typed note is also sent
// as the last item with severity 'preference'; `notes` is kept for the server record.
export function buildRevisionPayload(comments, note, deadlineAt) {
  const items = comments.map((c) => {
    const item = { description: c.description, severity: 'must-fix' };
    if (Number.isFinite(c.timestamp_seconds)) item.timestamp_seconds = c.timestamp_seconds;
    return item;
  });
  const notes = String(note || '').trim().slice(0, 500);
  // No timestamp on the note item: the server reads that as "not tied to a frame".
  if (notes) items.push({ description: `Note: ${notes}`, severity: 'preference' });
  return { items, notes, deadline_at: deadlineAt };
}

const rupee = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const positive = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

// Fee banner for a revision dialog. Amounts come ONLY from the server (next/paid
// revision fee); when a number is missing the text says "charged from your wallet".
export function revisionFeeNotice({ freeRemaining, nextFee, paidFee } = {}) {
  const next = positive(nextFee);
  if (next || freeRemaining === 0) {
    return { kind: 'fee', text: `Paid revision - ${next ? `${rupee(next)} will be` : 'this one is'} charged from your wallet. Include every change you need in this one.` };
  }
  if (freeRemaining === 1) {
    const paid = positive(paidFee);
    return { kind: 'fee', text: `This is your last free revision - include all your changes now. Every revision after this is charged from your wallet${paid ? ` (${rupee(paid)} each)` : ''}.` };
  }
  if (typeof freeRemaining === 'number' && freeRemaining > 1) {
    return { kind: 'free', text: `${freeRemaining} free revisions remaining.` };
  }
  return null;
}
