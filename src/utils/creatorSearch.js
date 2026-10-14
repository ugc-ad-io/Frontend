export function creatorSearchUrl(search, value) {
  const params = new URLSearchParams(search);
  const query = value.trim();
  if (query) params.set('q', query); else params.delete('q');
  const suffix = params.toString();
  return `/dashboard/business/browse-creator${suffix ? `?${suffix}` : ''}`;
}

export function matchesCreatorSearch(creator, query, categories = []) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [creator.nickname, creator.name, creator.full_name, creator.username,
    creator.profile?.fullName, creator.profile?.full_name, ...categories]
    .some(value => String(value || '').toLowerCase().includes(text));
}
