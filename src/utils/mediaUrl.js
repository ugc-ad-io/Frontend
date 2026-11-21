const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Native video requests cannot use Axios's Authorization header. The upload
// endpoint accepts a token query parameter; send it only to our own backend.
export function mediaUrl(value) {
  if (!value) return '';
  const absolute = /^https?:\/\//i.test(value) ? value : `${BACKEND_URL}${String(value).startsWith('/') ? '' : '/'}${value}`;
  try {
    const url = new URL(absolute);
    if (url.origin === new URL(BACKEND_URL).origin && url.pathname.startsWith('/uploads/')) {
      const token = localStorage.getItem('token');
      if (token) url.searchParams.set('token', token);
      return url.href;
    }
  } catch { /* Preserve the existing URL if it cannot be parsed. */ }
  return absolute;
}

// A user's photo can sit at the top level (upload-photo) or under profile.* (creator onboarding
// saves profile.profile_picture). Screens that read only the top level showed the initial instead
// of the photo (creator dashboard, app header). Returns a ready-to-use URL or ''.
export function userPhoto(user) {
  const pr = (user && user.profile) || {};
  const raw = user?.profile_photo || user?.profile_picture || user?.avatar || pr.profile_photo || pr.profile_picture || '';
  return raw ? mediaUrl(raw) : '';
}
