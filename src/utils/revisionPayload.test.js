import { buildRevisionPayload, revisionItemCount, revisionFeeNotice, MAX_REVISION_ITEMS } from './revisionPayload';

test('items carry description, severity and the video moment; deadline is sent', () => {
  const p = buildRevisionPayload([{ description: 'Fix intro', timestamp_seconds: 4.5 }, { description: 'Brighter' }], '', '2026-01-01T00:00:00.000Z');
  expect(p).toEqual({
    items: [
      { description: 'Fix intro', severity: 'must-fix', timestamp_seconds: 4.5 },
      { description: 'Brighter', severity: 'must-fix' },
    ],
    notes: '',
    deadline_at: '2026-01-01T00:00:00.000Z',
  });
});

test('a typed note is also the last item as a preference without a timestamp, and is capped at 500', () => {
  const p = buildRevisionPayload([{ description: 'A', timestamp_seconds: 0 }], `  ${'x'.repeat(600)}  `, 'd');
  expect(p.notes).toHaveLength(500);
  expect(p.items).toHaveLength(2);
  expect(p.items[0].timestamp_seconds).toBe(0);
  expect(p.items[1]).toEqual({ description: `Note: ${'x'.repeat(500)}`, severity: 'preference' });
});

test('a note takes one of the five slots', () => {
  expect(MAX_REVISION_ITEMS).toBe(5);
  expect(revisionItemCount(4, '')).toBe(4);
  expect(revisionItemCount(4, '  ')).toBe(4);
  expect(revisionItemCount(4, 'hi')).toBe(5);
  expect(revisionItemCount(5, 'hi')).toBe(6);
});

test('fee banners use only server numbers', () => {
  expect(revisionFeeNotice({ freeRemaining: 0, nextFee: 700 }).text).toContain('₹700 will be charged');
  expect(revisionFeeNotice({ freeRemaining: 0 }).text).toBe('Paid revision - this one is charged from your wallet. Include every change you need in this one.');
  expect(revisionFeeNotice({ freeRemaining: 1, nextFee: 0, paidFee: 700 }).text).toContain('(₹700 each)');
  expect(revisionFeeNotice({ freeRemaining: 1 }).text).not.toMatch(/₹/);
  expect(revisionFeeNotice({ freeRemaining: 3 })).toEqual({ kind: 'free', text: '3 free revisions remaining.' });
  expect(revisionFeeNotice({})).toBeNull();
  // never the old hard-coded prices
  expect(JSON.stringify([revisionFeeNotice({ freeRemaining: 1 }), revisionFeeNotice({ freeRemaining: 0 })])).not.toMatch(/500|300/);
});
