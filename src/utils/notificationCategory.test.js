import { notificationCategory, notificationAction, matchesNotificationTab } from './notificationCategory';

test('categorises by backend category, type, then link', () => {
  expect(notificationCategory({ category: 'payments' })).toBe('payment');
  expect(notificationCategory({ category: 'deal_updates', link: '/messages' })).toBe('campaign');
  expect(notificationCategory({ type: 'message', link: '/messages' })).toBe('message');
  expect(notificationCategory({ type: 'info', link: '/dashboard/business/wallet' })).toBe('payment');
  expect(notificationCategory({ type: 'info', link: '/dashboard/business/work-review' })).toBe('campaign');
  expect(notificationCategory({ type: 'info', link: '/dashboard/business/campaign/abc?creator=1' })).toBe('campaign');
  expect(notificationCategory({ type: 'info', link: '/settings' })).toBe('other');
  expect(notificationCategory({ type: 'info' })).toBe('other');
});

test('row action label only changes when the destination implies it', () => {
  expect(notificationAction({ link: '/messages' })).toBe('Reply');
  expect(notificationAction({ link: '/dashboard/business/work-review' })).toBe('Review');
  expect(notificationAction({ link: '/dashboard/business/pending-bids' })).toBe('Compare');
  expect(notificationAction({ link: '/dashboard/business/wallet' })).toBe('View');
  expect(notificationAction({ link: '/settings' })).toBe('Open');
  expect(notificationAction({})).toBe('Open');
});

test('tab matching', () => {
  const n = { read: false, link: '/messages' };
  expect(matchesNotificationTab(n, 'all')).toBe(true);
  expect(matchesNotificationTab(n, 'unread')).toBe(true);
  expect(matchesNotificationTab({ ...n, read: true }, 'unread')).toBe(false);
  expect(matchesNotificationTab(n, 'message')).toBe(true);
  expect(matchesNotificationTab(n, 'payment')).toBe(false);
});
