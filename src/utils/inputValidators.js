// Shared input validators/sanitizers so number fields only take numbers and
// link fields only take valid links. Import and use in form onChange handlers.

// Keep only digits (for price / age / days / quantity-type fields).
export const digitsOnly = (value) => String(value ?? '').replace(/[^0-9]/g, '');

// Digits + a single decimal point (for money that may have paise, etc.).
export const decimalOnly = (value) => {
  let v = String(value ?? '').replace(/[^0-9.]/g, '');
  const i = v.indexOf('.');
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
  return v;
};

// True when the string is a real http(s) URL (used to validate website / link fields).
export const isValidUrl = (value) => {
  const v = String(value ?? '').trim();
  if (!v) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return !!u.hostname && u.hostname.includes('.');
  } catch {
    return false;
  }
};

// True when the string is a social @handle or a profile link (no random text).
export const isValidHandle = (value) => {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (/^@?[A-Za-z0-9._]{2,40}$/.test(v)) return true; // plain handle
  return isValidUrl(v);
};

// onKeyDown guard: block any character key that isn't a digit (allows control keys).
export const blockNonDigitKey = (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (allowed.includes(e.key)) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
};
