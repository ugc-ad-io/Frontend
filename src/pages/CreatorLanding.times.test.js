import fs from 'fs';
import path from 'path';

// Source guard: the creator-page testimonial phones must not all show the same clock time.
test('every testimonial phone has its own status-bar time', () => {
  const src = fs.readFileSync(path.join(__dirname, 'CreatorLanding.js'), 'utf8');
  const times = [...src.matchAll(/review_0\d\.mp4/g)].length;
  const set = [...src.matchAll(/time: '(\d{1,2}:\d{2})', handle/g)].map((m) => m[1]);
  expect(times).toBe(6);
  expect(set).toHaveLength(6);
  expect(new Set(set).size).toBe(6);
  expect(src).toContain('<span className="cl-tcard__time">{time}</span>');
});
