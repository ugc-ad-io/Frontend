// Fully client-side TOTP (RFC 6238) two-factor helpers — no backend.
//
// This powers a self-contained 2FA demo: we generate a real secret, build a
// standard otpauth:// URL (scannable by Google Authenticator / Authy), and
// verify 6-digit codes in the browser using Web Crypto (HMAC-SHA1). Enabled
// state + secret are persisted in localStorage under a per-user key.
//
// NOTE: This is client-only. Because there is no server, the "protection" is
// cosmetic — anyone can clear localStorage. It exists to demo the full 2FA UX.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Generate a random base32 secret (default 20 bytes → 32 chars, TOTP standard).
export function generateSecret(byteLength = 20) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

// Decode a base32 string to a Uint8Array (ignores padding / spacing / case).
function base32Decode(input) {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

// Compute the TOTP code for a given secret + counter (time-step index).
async function hotp(secretBytes, counter) {
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  // 64-bit counter, big-endian. High 32 bits are 0 until year ~2242, so fine.
  view.setUint32(4, counter);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
  const offset = sig[sig.length - 1] & 0x0f;
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

// Verify a 6-digit code against the secret, allowing ±1 time-step of drift.
export async function verifyToken(secret, token, step = 30) {
  const code = String(token || '').replace(/\D/g, '');
  if (code.length !== 6) return false;
  const secretBytes = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  for (const w of [-1, 0, 1]) {
    if ((await hotp(secretBytes, counter + w)) === code) return true;
  }
  return false;
}

// Build the otpauth:// URI that authenticator apps scan.
export function otpauthURL(secret, account, issuer = 'UGCad.io') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Local persistence (stands in for the backend) ─────────────────────────
const key = (userId) => `ugc_2fa_${userId || 'me'}`;

export function get2FA(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : { enabled: false, secret: null };
  } catch {
    return { enabled: false, secret: null };
  }
}

export function save2FA(userId, state) {
  localStorage.setItem(key(userId), JSON.stringify(state));
}

export function clear2FA(userId) {
  localStorage.removeItem(key(userId));
}
