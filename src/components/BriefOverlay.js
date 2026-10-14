import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Measure the real navigation bounds, including its expanded width and padding.
export default function BriefOverlay({ children, className, onClick, ...props }) {
  const [bounds, setBounds] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const rail = document.querySelector('.hsr');
    const header = document.querySelector('.cmk-nav');
    const update = () => {
      const railBox = rail?.getBoundingClientRect();
      const left = window.innerWidth > 760 && railBox?.width ? Math.max(0, railBox.right) : 0;
      const top = 0; // Cover the header too so search stays behind the blurred backdrop.
      setBounds(previous => previous.left === left && previous.top === top ? previous : { left, top });
    };
    update();
    const observer = new ResizeObserver(update);
    if (rail) observer.observe(rail);
    if (header) observer.observe(header);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, []);
  return createPortal(
    <div {...props} className={className} onClick={onClick} style={{ position: 'fixed', left: bounds.left, top: bounds.top, right: 0, bottom: 0, zIndex: 2000 }}>
      {children}
    </div>, document.body,
  );
}
