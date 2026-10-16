import { useEffect, useState } from 'react';

// Phone layout breakpoint for the admin PWA. Same 768px the admin CSS uses.
const QUERY = '(max-width: 768px)';

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
