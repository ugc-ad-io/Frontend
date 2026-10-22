import fs from 'fs';
import path from 'path';

// jsdom does no layout, so this guards the shared brand shell: Messages is a full-height pane and
// must get the same flush class CreatorTopNavLayout gives it, or the page padding (18px top +
// ~96px bottom on a phone) adds a blank band under the composer.
const src = fs.readFileSync(path.join(__dirname, 'BrandTopNavLayout.js'), 'utf8');
const creatorSrc = fs.readFileSync(path.join(__dirname, 'CreatorTopNavLayout.js'), 'utf8');

test('brand shell flushes the page padding on /messages like the creator shell does', () => {
  expect(src).toMatch(/const isMessages = pathname === '\/messages' \|\| pathname\.startsWith\('\/messages\/'\)/);
  expect(src).toMatch(/<main className=\{`cmk-wrap cmk-page\$\{isMessages \? ' cmk-page--flush' : ''\}`\}>/);
  expect(creatorSrc).toContain("cmk-page--flush");
});
