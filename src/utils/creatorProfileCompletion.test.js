import { getProfileNudge } from './creatorProfileCompletion';

test('lists only the asked-for items that are still empty, and clears as they are filled', () => {
  const user = { profile_nudge: { items: ['photo', 'banner', 'kyc'] }, profile: {} };
  expect(getProfileNudge(user)).toEqual({
    left: ['photo', 'banner', 'kyc'],
    text: 'profile photo, banner image, PAN card and Aadhaar card (front and back)',
    to: '/profile',
  });

  const photoDone = { ...user, profile_photo: 'https://s3/p.jpg', banner: 'https://s3/b.jpg' };
  expect(getProfileNudge(photoDone)).toMatchObject({ left: ['kyc'], to: '/kyc' });

  expect(getProfileNudge({ ...photoDone, kyc: { status: 'pending' } }).left).toEqual([]);
  // A reopened KYC does not count as done.
  expect(getProfileNudge({ ...photoDone, kyc: { status: 'not_submitted' } }).left).toEqual(['kyc']);
});

test('a video added on /profile counts as the intro video; no nudge means no pop-up', () => {
  const user = { profile_nudge: { items: ['intro'] }, profile: { portfolio_items: [] } };
  expect(getProfileNudge(user).text).toBe('intro video');
  expect(getProfileNudge({ ...user, portfolio: [{ videoUrl: 'x' }] }).left).toEqual([]);
  expect(getProfileNudge({ profile: {} }).left).toEqual([]);
});
