import normalizeBrief, { deliveryWindowDays } from './normalizeBrief';

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

test('delivery window comes from the brief deadline, not a made-up default', () => {
  expect(deliveryWindowDays({ draft_delivery_by: inDays(2) })).toBe(2);
  expect(deliveryWindowDays({ final_delivery_by: inDays(10), draft_delivery_by: inDays(2) })).toBe(10);
  expect(deliveryWindowDays({ estimated_delivery_days: 4 })).toBe(4);
  expect(deliveryWindowDays({ due_date: inDays(-1) })).toBe(0);
});

test('a brief with no deadline has an unknown window and is not forced into "5 days"', () => {
  expect(deliveryWindowDays({})).toBeNull();
  const b = normalizeBrief({ id: 'c1', title: 'T' });
  expect(b.deliveryDays).toBeNull();
  expect(b.deliveryLabel).toBe('See brief');
});

test('"Within 3 days" can now match a brief due in 2 days', () => {
  const b = normalizeBrief({ id: 'c2', title: 'T', draft_delivery_by: inDays(2) });
  expect(b.deliveryDays).toBeLessThanOrEqual(3);
});
