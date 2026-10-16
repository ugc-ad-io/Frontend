import { useEffect, useState } from 'react';

// Phone layout for the admin PWA: narrow screens, plus phones turned to landscape (short touch
// screens wider than 768px). Keep in sync with the phone shell @media in admin-theme.css.
const QUERY = '(max-width: 768px), (max-height: 500px) and (pointer: coarse)';

export default function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return undefined;
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return phone;
}
