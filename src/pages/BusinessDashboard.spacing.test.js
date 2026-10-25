import fs from 'fs';
import path from 'path';

// jsdom does no layout, so this guards the CSS that removed the blank band on Sent Briefs:
// the actions row only holds the phone-only Filter, so above 620px it must not take space,
// and flex-gap containers must not stack child margins on top of the gap.
const src = fs.readFileSync(path.join(__dirname, 'BusinessDashboard.js'), 'utf8');

test('Sent Briefs empty actions row is hidden above phone width', () => {
  expect(src).toMatch(/@media \(min-width: 621px\) \{ \.sent-briefs-actions-row \{ display: none !important; \} \}/);
});

test('flex-gap containers do not double their spacing with child margins', () => {
  expect(src).toMatch(/\.all-campaigns-section > \.cf-filter-row,\s*\.shipments-section > \.ship-toolbar,\s*\.cb-section > \.cb-campaign-filter \{ margin-top: 0; margin-bottom: 0; \}/);
});

test('Manage Shipment: a tab with no rows shows a message instead of a header-only table / blank gap', () => {
  expect(src).toMatch(/rows\.length === 0 \? \(\s*<div className="bui-empty-row">Nothing in /);
});
