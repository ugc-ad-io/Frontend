import { useEffect, useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import BottomSheet from './BottomSheet';
import './select-sheet.css';

/**
 * App mode (installed app / mobile shell): every native <select> opens this bottom-sheet list instead of the
 * OS picker, so iOS and Android look the same. One mount in App.js covers every screen: the real <select> stays
 * in the page (it keeps showing the value and React keeps its onChange), only its tap is intercepted.
 * A select with the attribute data-native, a multi-select or a disabled one keeps the default behaviour.
 */
const isCustom = (el) => !!el && el.tagName === 'SELECT' && !el.multiple && !(el.size > 1) && !el.disabled && !el.hasAttribute('data-native');

function readOptions(select) {
  const rows = [];
  const walk = (node, group) => {
    Array.from(node.children).forEach((c) => {
      if (c.tagName === 'OPTGROUP') {
        rows.push({ kind: 'group', label: c.label });
        walk(c, c.label);
      } else if (c.tagName === 'OPTION' && !c.hidden) {
        rows.push({ kind: 'opt', value: c.value, label: c.textContent.trim() || c.label || c.value, disabled: c.disabled || (group && c.parentElement.disabled) });
      }
    });
  };
  walk(select, '');
  return rows;
}

function titleFor(select) {
  const aria = select.getAttribute('aria-label');
  if (aria) return aria;
  const byFor = select.id && Array.from(document.querySelectorAll('label')).find((l) => l.htmlFor === select.id);
  const label = byFor || select.closest('label') || select.closest('div')?.querySelector('label');
  const text = label ? label.textContent.replace(/\*/g, '').trim() : '';
  return text.slice(0, 60) || 'Choose an option';
}

// Same as the user picking it: React's onChange listens for a bubbling `change` after the value changed.
function commit(select, value) {
  if (select.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(select, value);
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export default function SelectSheet() {
  const [state, setState] = useState(null); // { select, title, rows, value }

  const open = useCallback((select) => {
    if (!isCustom(select)) return;
    setState({ select, title: titleFor(select), rows: readOptions(select), value: select.value });
  }, []);

  useEffect(() => {
    let touch = null;
    let lastTouchOpen = 0;
    const target = (e) => (e.target && e.target.closest ? e.target.closest('select') : null);

    const onTouchStart = (e) => { const t = e.touches && e.touches[0]; touch = t ? { x: t.clientX, y: t.clientY, el: target(e) } : null; };
    const onTouchEnd = (e) => {
      const el = target(e);
      const t = e.changedTouches && e.changedTouches[0];
      if (!isCustom(el) || !touch || touch.el !== el || !t) return;
      if (Math.abs(t.clientX - touch.x) > 10 || Math.abs(t.clientY - touch.y) > 10) return; // a scroll, not a tap
      e.preventDefault(); // no focus, no synthesized mouse events: the OS picker never opens
      lastTouchOpen = Date.now();
      open(el);
    };
    const onMouseDown = (e) => { if (isCustom(target(e))) e.preventDefault(); };
    const onClick = (e) => {
      const el = target(e);
      if (!isCustom(el)) return;
      e.preventDefault();
      if (Date.now() - lastTouchOpen > 500) open(el);
    };
    const onKey = (e) => {
      const el = target(e);
      if (isCustom(el) && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(el); }
    };

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const close = () => setState(null);
  const pick = (value) => { const s = state && state.select; setState(null); if (s) commit(s, value); };

  return (
    <BottomSheet open={!!state} onClose={close} title={state ? state.title : ''}>
      {state && (
        <ul className="ap-sel" role="listbox" aria-label={state.title}>
          {state.rows.map((r, i) => (r.kind === 'group' ? (
            <li key={`g${i}`} className="ap-sel-group" role="presentation">{r.label}</li>
          ) : (
            <li key={`${r.value}-${i}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={r.value === state.value}
                disabled={r.disabled}
                className={`ap-sel-opt${r.value === state.value ? ' is-on' : ''}`}
                onClick={() => pick(r.value)}
              >
                <span>{r.label}</span>
                {r.value === state.value ? <Check size={18} /> : null}
              </button>
            </li>
          )))}
        </ul>
      )}
    </BottomSheet>
  );
}
