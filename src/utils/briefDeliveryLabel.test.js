import briefDeliveryLabel from './briefDeliveryLabel';
test('edited-only briefs never ask for raw video', () => {
  expect(briefDeliveryLabel({ raw_required: false, edited_required: true, edited_by: 'ugc' })).toBe('Edited video (edited by UGC.ad)');
});
test('raw and combined delivery are distinguished', () => {
  expect(briefDeliveryLabel({ raw_required: true, edited_required: false })).toBe('Raw video');
  expect(briefDeliveryLabel({ raw_required: true, edited_required: true })).toBe('Raw + Edited video (edited by creator)');
});
