import fs from 'fs';
import path from 'path';
import { showcaseVideos, HERO_POSTERS } from './landingShowcase';

const faces = (list) => list.map((v) => v.face);
const noRepeat = (list) => new Set(faces(list)).size === list.length;
const pub = (p) => path.join(__dirname, '..', '..', 'public', p);

describe('landing showcase data', () => {
  const mid = Math.ceil(showcaseVideos.length / 2);

  test('no face repeats among the cards visible together', () => {
    expect(noRepeat(showcaseVideos.slice(0, 10))).toBe(true); // desktop grid (2 rows of 5)
    expect(noRepeat(showcaseVideos.slice(0, 6))).toBe(true);  // phone grid (3 rows of 2)
    expect(noRepeat(showcaseVideos.slice(0, mid))).toBe(true); // marquee row 1 / mobile hero row
    expect(noRepeat(showcaseVideos.slice(mid))).toBe(true);    // marquee row 2
  });

  test('ids are unique and every clip + poster file exists', () => {
    expect(new Set(showcaseVideos.map((v) => v.id)).size).toBe(showcaseVideos.length);
    showcaseVideos.forEach((v) => {
      expect(fs.existsSync(pub(v.src))).toBe(true);
      expect(fs.existsSync(pub(v.poster))).toBe(true);
    });
  });

  test('hero gallery keeps the clips of the same woman (03, 04, 06) at least 4 cards apart', () => {
    const idx = ['03', '04', '06'].map((n) => HERO_POSTERS.findIndex((p) => p.video.endsWith(`video_${n}.mp4`)));
    idx.sort((a, b) => a - b);
    expect(idx[1] - idx[0]).toBeGreaterThanOrEqual(4);
    expect(idx[2] - idx[1]).toBeGreaterThanOrEqual(4);
    expect(HERO_POSTERS.length - idx[2] + idx[0]).toBeGreaterThanOrEqual(4); // marquee wrap-around
  });
});
