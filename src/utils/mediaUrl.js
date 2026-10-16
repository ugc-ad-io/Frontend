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
