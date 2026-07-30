import { useEffect } from 'react';

// Measures the sticky top nav's REAL rendered height and publishes it as
// --cmk-nav-height on the document root. The mobile drawer/backdrop read that
// variable to know where the header ends — previously it was guessed with
// hardcoded per-breakpoint fallbacks (72px / 62px) that fell out of sync
// whenever the header's actual height didn't match the guess, leaving a gap
// under the header (visible as a thin line of the page's background showing
// through). Measuring it directly makes the drawer always start exactly where
// the header ends, at any width, font size, or content change.
export default function useNavHeightVar(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = () => {
      document.documentElement.style.setProperty('--cmk-nav-height', `${el.offsetHeight}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener('resize', set);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', set);
    };
  }, [ref]);
}
