// Single source of truth for "how much of a creator's profile is filled in" —
// used by the Dashboard hero bar and the Profile page. Onboarding only collects
// photo/name/content style+category/portfolio/social (see CreatorProfileSetup.js);
// everything else here is filled in later from /settings (CreatorProfileModal.js).
export function getProfileChecklist(user) {
  const p = user?.profile || {};
  return [
    { key: 'avatar', label: 'Add a profile picture', to: '/settings', done: Boolean(user?.profile_picture || user?.avatar) },
    { key: 'banner', label: 'Add a banner image', to: '/settings', done: Boolean(user?.banner || user?.banner_image) },
    { key: 'availability', label: 'Review and adjust availability', to: '/settings', done: Boolean(user?.availability_calendar || user?.weekly_availability) },
    { key: 'bio', label: 'Add a short bio', to: '/settings', done: Boolean((p.bio || '').trim()) },
    { key: 'identity', label: 'Add your age, gender, body type & skin tone', to: '/settings',
      done: Boolean(p.age && p.gender && p.bodyType && p.skinTone) },
    { key: 'location', label: 'Add your city, state & pincode', to: '/settings',
      done: Boolean(p.city && p.state && p.pincode) },
    { key: 'skills', label: 'Add your skills', to: '/settings', done: Array.isArray(p.skills) && p.skills.length > 0 },
    { key: 'languages', label: 'Add languages you create in', to: '/settings', done: Array.isArray(p.languages) && p.languages.length > 0 },
    { key: 'equipment', label: 'Add your recording setup', to: '/settings', done: Array.isArray(p.coreSetup) && p.coreSetup.length > 0 },
    { key: 'delivery', label: 'Set your typical delivery time', to: '/settings', done: Boolean(p.deliveryDays || p.delivery_days) },
    { key: 'intro', label: 'Record a 30-60 second intro video', to: '/settings', done: Boolean(user?.intro_video || p.intro_video) },
  ];
}

export function getProfilePct(user) {
  const list = getProfileChecklist(user);
  return Math.round((list.filter((item) => item.done).length / list.length) * 100);
}
