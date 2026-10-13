import { useEffect, useState } from 'react';

/**
 * A person's photo that falls back to `initial` (their name's first letter, or whatever the
 * surrounding avatar already shows when there is no photo) when the file can't be loaded —
 * a dead link, a 401/404. A photo that loads is left exactly as it was.
 *
 * Render it inside the avatar circle: it returns either the <img> or the plain text.
 */
export default function PhotoOrInitial({ src, initial = null, alt = '' }) {
  const [failed, setFailed] = useState(false);
  // A different photo (e.g. the creator re-uploaded) gets a fresh chance to load.
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) return initial;
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}
