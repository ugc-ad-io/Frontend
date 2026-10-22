import fs from 'fs';
import path from 'path';

// jsdom does no layout, so these guard the CSS that removed dead bands on the creator
// side (fix.md l.12, "empty spaces still not fixed on some pages").
const read = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const mkt = read('..', 'styles', 'creator-marketplace.css');
const deals = read('MyDealsPage.css');
const kyc = read('CreatorKYC.js');
const signup = read('CreatorSignup.js');

test('Messages stays full-bleed on phones despite the HoverSideRail 12px page gutter', () => {
  expect(mkt).toMatch(/@media \(max-width:768px\)\{\.cmk-app\.has-rail \.cmk-page\.cmk-page--flush\{padding-left:0;padding-right:0\}\}/);
});

test('Reviews does not stack a 48px margin on the page bottom padding', () => {
  expect(mkt).toMatch(/\.cmk-rev-recent\{margin-top:22px;margin-bottom:0;/);
});

test('empty state is not ~100px below the tab/filter row and is shorter on phones', () => {
  expect(mkt).toMatch(/\.cmk-tabs-row \+ \.cmk-emptystate,\.cmk-filter-row \+ \.cmk-emptystate\{margin-top:0;padding-top:36px\}/);
  expect(mkt).toMatch(/@media \(max-width:640px\)\{\.cmk-emptystate\{padding:36px 16px 28px\}/);
});

test('Deal Room loading/empty wrapper adds no padding on top of the layout page padding', () => {
  expect(deals).toMatch(/\.deal-page \{[^}]*padding: 0;/);
  expect(deals).not.toMatch(/padding: 16px 16px 92px/);
});

test('KYC phone page cancels the safe-area part of the layout bottom padding too', () => {
  expect(kyc).toContain('margin:-18px -16px calc(-96px - env(safe-area-inset-bottom))');
});

test('Creator signup uses dynamic viewport height like Auth', () => {
  expect(signup).toMatch(/min-height: 100vh;\s*min-height: 100dvh;\s*display: flex;/);
});
