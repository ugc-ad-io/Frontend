import { resolveNotifLink } from './notificationLinks';
test('legacy shipment links open the campaign with creator context', () => {
  expect(resolveNotifLink('/campaigns/brief-1?creator=c')).toBe('/dashboard/business/campaign/brief-1?creator=c');
  expect(resolveNotifLink('/dashboard/business/campaigns/brief-1')).toBe('/dashboard/business/campaign/brief-1');
  expect(resolveNotifLink('/dashboard/business/campaign/brief-1?creator=c')).toBe('/dashboard/business/campaign/brief-1?creator=c');
  expect(resolveNotifLink(null)).toBe(null);
});
