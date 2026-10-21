// Guards the installable-PWA files in public/ (they are copied as-is by CRA, so nothing else checks them).
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const read = (p) => fs.readFileSync(path.join(PUBLIC, p), 'utf8');
const pngSize = (p) => {
  const b = fs.readFileSync(path.join(PUBLIC, p));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const manifest = JSON.parse(read('manifest.json'));
const html = read('index.html');
const sw = read('sw.js');

describe('manifest.json', () => {
  test('has the fields Chrome needs to offer Install', () => {
    ['name', 'short_name', 'start_url', 'scope', 'theme_color', 'background_color', 'orientation'].forEach((k) => {
      expect(manifest[k]).toBeTruthy();
    });
    expect(manifest.display).toBe('standalone');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
  });

  test('lists 192 and 512 icons, "any" and "maskable", and every file exists at its declared size', () => {
    const have = new Set();
    manifest.icons.forEach((icon) => {
      const file = icon.src.replace(/^\//, '');
      expect(fs.existsSync(path.join(PUBLIC, file))).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(file)).toEqual({ w, h });
      have.add(`${icon.purpose}:${w}`);
    });
    ['any:192', 'any:512', 'maskable:192', 'maskable:512'].forEach((k) => expect(have.has(k)).toBe(true));
  });

  test('shortcuts point at routes that exist in App.js', () => {
    const app = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');
    manifest.shortcuts.forEach((s) => expect(app).toContain(`path="${s.url}"`));
  });
});

describe('index.html', () => {
  test('is installable and notch-safe on iOS and Android', () => {
    expect(html).toMatch(/<link rel="manifest"/);
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/name="apple-mobile-web-app-capable" content="yes"/);
    expect(html).toMatch(/name="mobile-web-app-capable" content="yes"/);
    expect(html).toMatch(/apple-mobile-web-app-status-bar-style/);
    expect(html).toMatch(/name="theme-color"[^>]*prefers-color-scheme: light/);
    expect(html).toMatch(/name="theme-color"[^>]*prefers-color-scheme: dark/);
  });

  test('every apple-touch-icon and launch image it links exists', () => {
    const hrefs = [...html.matchAll(/rel="apple-touch-(?:icon|startup-image)"[^>]*href="%PUBLIC_URL%\/([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    hrefs.forEach((h) => expect(fs.existsSync(path.join(PUBLIC, h))).toBe(true));
  });

  test('a launch image matches the device pixel size in its file name', () => {
    const imgs = [...html.matchAll(/splash-(\d+)x(\d+)\.png" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)/g)];
    expect(imgs.length).toBeGreaterThan(10);
    imgs.forEach(([, w, h, dw, dh, r]) => {
      expect(Number(w)).toBe(Number(dw) * Number(r));
      expect(Number(h)).toBe(Number(dh) * Number(r));
      expect(pngSize(`splash/splash-${w}x${h}.png`)).toEqual({ w: Number(w), h: Number(h) });
    });
  });
});

describe('service worker', () => {
  test('precaches only files that exist, including the offline page', () => {
    const offlineUrl = sw.match(/const OFFLINE_URL = '([^']+)'/)[1];
    const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
    const files = list.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => (s === 'OFFLINE_URL' ? offlineUrl : s.replace(/^'|'$/g, '')));
    expect(files).toContain('/offline.html');
    files.forEach((f) => expect(fs.existsSync(path.join(PUBLIC, f.replace(/^\//, '')))).toBe(true));
  });

  test('is versioned, has an update flow and never touches API/auth or non-GET traffic', () => {
    expect(sw).toMatch(/const VERSION = 'v\d+'/);
    expect(sw).toMatch(/SKIP_WAITING/);
    expect(sw).toMatch(/caches\.delete/);
    expect(sw).toMatch(/request\.method !== 'GET'\) return/);
    expect(sw).toMatch(/\(\?:api\|auth\)/);
    expect(sw).toMatch(/headers\.has\('authorization'\)/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin\) return/);
  });

  test('page loads fall back to the offline page, and the page is registered from src/index.js', () => {
    expect(sw).toMatch(/request\.mode === 'navigate'/);
    expect(sw).toMatch(/caches\.match\(OFFLINE_URL\)/);
    const index = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    expect(index).toMatch(/register\('\/sw\.js'/);
    expect(index).toMatch(/NODE_ENV !== 'production'/);
  });

  test('offline.html is self-contained and has a working retry', () => {
    const off = read('offline.html');
    expect(off).not.toMatch(/<link[^>]+stylesheet/);
    expect(off).toMatch(/id="retry"/);
    expect(off).toMatch(/viewport-fit=cover/);
  });
});
