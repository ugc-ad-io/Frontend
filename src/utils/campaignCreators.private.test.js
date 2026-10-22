import { isOpenForBids } from './campaignCreators';

test('a private brief is never open for bids or listed in Browse', () => {
  expect(isOpenForBids({ status: 'active', creators_wanted: 1 })).toBe(true);
  expect(isOpenForBids({ status: 'active', creators_wanted: 1, visibility: 'private' })).toBe(false);
});
