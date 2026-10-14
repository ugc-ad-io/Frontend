import { creatorSearchUrl, matchesCreatorSearch } from './creatorSearch';
test('search finds full profile names and categories without case sensitivity', () => {
  const creator = { nickname: 'creator123', profile: { fullName: 'Anshika Sharma' } };
  expect(matchesCreatorSearch(creator, ' ANSHIKA ')).toBe(true);
  expect(matchesCreatorSearch(creator, 'beauty', ['Beauty'])).toBe(true);
  expect(matchesCreatorSearch(creator, 'unmatched')).toBe(false);
});
test('typing updates query and clearing removes search while preserving other filters', () => {
  expect(creatorSearchUrl('?category=beauty', 'anshika')).toBe('/dashboard/business/browse-creator?category=beauty&q=anshika');
  expect(creatorSearchUrl('?category=beauty&q=anshika', '')).toBe('/dashboard/business/browse-creator?category=beauty');
  expect(matchesCreatorSearch({}, '')).toBe(true);
});
