// Single source of truth for "how much of a creator's profile is filled in" —
// used by the Dashboard hero bar and the Profile page. Onboarding only collects
// photo/name/content style+category/portfolio/social (see CreatorProfileSetup.js);
// everything else here is filled in later from /settings (CreatorProfileModal.js).
export function getProfileChecklist(user) {
  const p = user?.profile || {};
  return [
    // `mandatory` items are what the % below is based on — things a brand actually
    // needs to decide whether to hire this creator. The rest are shown as helpful
    // suggestions but never block reaching 100%.
    { key: 'avatar', label: 'Add a profile picture', to: '/settings', mandatory: true, done: Boolean(user?.profile_picture || user?.profile_photo || user?.avatar || p.profile_picture || p.profile_photo) },
    { key: 'banner', label: 'Add a banner image', to: '/settings', mandatory: false, done: Boolean(user?.banner || user?.banner_image) },
    { key: 'availability', label: 'Review and adjust availability', to: '/settings', mandatory: false, done: Boolean(user?.availability_calendar || user?.weekly_availability) },
    { key: 'identity', label: 'Add your age, gender, body type & skin tone', to: '/settings', mandatory: true,
      done: Boolean(p.age && p.gender && p.bodyType && p.skinTone) },
    { key: 'location', label: 'Add your city, state & pincode', to: '/settings', mandatory: true,
      done: Boolean(p.city && p.state && p.pincode) },
    { key: 'skills', label: 'Add your skills', to: '/settings', mandatory: false, done: Array.isArray(p.skills) && p.skills.length > 0 },
    { key: 'languages', label: 'Add languages you create in', to: '/settings', mandatory: true, done: Array.isArray(p.languages) && p.languages.length > 0 },
    { key: 'equipment', label: 'Add your recording setup', to: '/settings', mandatory: false, done: Array.isArray(p.coreSetup) && p.coreSetup.length > 0 },
    { key: 'delivery', label: 'Set your typical delivery time', to: '/settings', mandatory: false, done: Boolean(p.deliveryDays || p.delivery_days) },
    { key: 'intro', label: 'Record a 30-60 second intro video', to: '/settings', mandatory: true, done: Boolean(user?.intro_video || p.intro_video || (Array.isArray(user?.portfolio) && user.portfolio.length > 0)) },  // onboarding saves the first portfolio video as the intro
  ];
}

export function getProfilePct(user) {
  const list = getProfileChecklist(user).filter((item) => item.mandatory);
  return Math.round((list.filter((item) => item.done).length / list.length) * 100);
}

// Labels of what is still missing from the % (shown on the profile card).
export function getProfileMissing(user) {
  return getProfileChecklist(user).filter((item) => item.mandatory && !item.done).map((item) => item.label);
}
