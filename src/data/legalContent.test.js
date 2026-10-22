import { LEGAL_CONTENT } from './legalContent';

const all = JSON.stringify(LEGAL_CONTENT);

test('the four documents from the owner\'s Google Doc are all present and dated 28 September 2026', () => {
  expect(Object.keys(LEGAL_CONTENT).sort()).toEqual(['agreement', 'guidelines', 'privacy', 'terms']);
  Object.values(LEGAL_CONTENT).forEach((d) => {
    expect(d.updated).toBe('28 September 2026');
    expect(d.sections.length).toBeGreaterThanOrEqual(10);
  });
  expect(LEGAL_CONTENT.privacy.sections).toHaveLength(15);
  expect(LEGAL_CONTENT.terms.sections).toHaveLength(29);
  expect(LEGAL_CONTENT.agreement.sections).toHaveLength(31);
  expect(LEGAL_CONTENT.guidelines.sections).toHaveLength(10);
});

test('internal drafting notes and placeholders are not published', () => {
  expect(all).not.toMatch(/\[Insert|counsel|Regulatory note|to be added once finalized|⚠/);
});

test('tables and bullet lists survive the import', () => {
  const tables = LEGAL_CONTENT.agreement.sections.flatMap((s) => s.blocks).filter((b) => b.t === 'table');
  expect(tables.map((t) => t.rows.length)).toEqual([4, 5, 4, 4]);
  expect(LEGAL_CONTENT.guidelines.sections[1].blocks[0].items).toHaveLength(3);
});
