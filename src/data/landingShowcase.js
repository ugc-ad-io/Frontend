// Landing page showcase clips — the ONE place to swap videos/faces.
//
// `face` tags who is on screen so landingShowcase.test.js can fail if the same face shows
// up twice among the cards visible together (first 10 on desktop, first 6 on phone, and each
// of the two marquee rows). Two clips are placeholders until the owner's new videos arrive:
//   - id 4  (tail of the list, was "Let me share a little" /home/video_06.mp4) — same woman
//           as id 2. Replace src/poster/face with the owner's new clip #1.
//   - id 1  (first card) is the owner's Debo clip (/ma/video_debo.mp4); the second clip is
//           still to come for id 4.
// To swap: drop the .mp4 in public/ma (or public/home), a 360x640 poster in public/posters,
// and edit that entry's src / poster / face. Also update FIND_HIRE_VIDEOS in pages/Landing.js
// (it hardcodes id 4's /home/video_06.mp4 and needs a sibling .jpg next to the clip).

// Hero gallery poster stills — every /public/home/*.jpg exists (unlike the /ma clips,
// which have no sibling still), so no card ever shows a broken image.
// Order keeps the three clips of the same woman (03, 04, 06) 6+ cards apart.
export const HERO_POSTERS = [
  '03', '05', '07', '10', '13', '15', '04', '16',
  '19', '21', '22', '06', '23', '24', '25', '26',
].map((n) => ({ poster: `/home/video_${n}.jpg`, video: `/home/video_${n}.mp4` }));

// Sixteen showcase video slots — local UGC clips. Array order = display order.
export const showcaseVideos = [
  { id: 1, industryId: 'apps',    label: 'Apps/Software',    isVideo: true, face: 'debo-pink', // owner clip #1 (Debo.mp4, compressed to 360x640 / 12 s / ~0.6 MB)
    src: '/ma/video_debo.mp4',
    brand: 'Color By Number', creator: 'Abigail', logoBg: 'linear-gradient(135deg, #3A3A66, #fb923c)', logoText: 'CN', tier: 'RISING', rating: 4.8, avatar: '/avatars/a01.jpg', poster: '/posters/p18.jpg' },
  { id: 2, industryId: 'apps',    label: 'Apps/Software',    isVideo: true, face: 'jewellery',
    src: '/ma/video_04.mp4',
    brand: 'Gener8',          creator: 'Chelsea', logoBg: 'linear-gradient(135deg, #1F1F4E, #07074e)', logoText: '8', tier: 'PRO', rating: 4.9, avatar: '/avatars/a02.jpg', poster: '/posters/p02.jpg' },
  { id: 3, industryId: 'family',  label: 'Family/Kids',      isVideo: true, face: 'yellow-top',
    src: '/ma/video_05.mp4',
    brand: 'Gatorade',        creator: 'Becki',   logoBg: 'linear-gradient(135deg, #fb923c, #f59e0b)', logoText: 'G', tier: 'ELITE', rating: 5.0, avatar: '/avatars/a03.jpg', poster: '/posters/p03.jpg' },
  { id: 5, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true, face: 'curly-beige',
    src: '/home/video_07.mp4',
    brand: 'Thix Hair',       creator: 'Lara',    logoBg: 'linear-gradient(135deg, #34d399, #14b8a6)', logoText: 'T', tier: 'ELITE', rating: 4.9, avatar: '/avatars/a05.jpg', poster: '/posters/p05.jpg' },
  { id: 6, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true, face: 'sleeveless-beige',
    src: '/home/video_10.mp4',
    brand: 'AirShine',        creator: 'Priya',   logoBg: 'linear-gradient(135deg, #1F1F4E, #1F1F4E)', logoText: 'A', tier: 'RISING', rating: 4.8, avatar: '/avatars/a06.jpg', poster: '/posters/p06.jpg' },
  { id: 7, industryId: 'pets',    label: 'Pets',             isVideo: true, face: 'cap-man',
    src: '/home/video_13.mp4',
    brand: 'Pawfect',         creator: 'Riya',    logoBg: 'linear-gradient(135deg, #1F1F4E, #a855f7)', logoText: 'Pf', tier: 'ELITE', rating: 4.9, avatar: '/avatars/a07.jpg', poster: '/posters/p07.jpg' },
  { id: 8, industryId: 'food',    label: 'Food/Beverage',    isVideo: true, face: 'green-kurta',
    src: '/home/video_15.mp4',
    brand: 'BrewHaus',        creator: 'Sofia',   logoBg: 'linear-gradient(135deg, #78350f, #f59e0b)', logoText: 'BH', tier: 'PRO', rating: 4.8, avatar: '/avatars/a08.jpg', poster: '/posters/p08.jpg' },
  { id: 9, industryId: 'fitness', label: 'Fitness/Supplements', isVideo: true, face: 'white-tee-man',
    src: '/home/video_16.mp4',
    brand: 'FitFuel',         creator: 'Noah',    logoBg: 'linear-gradient(135deg, #14532d, #22c55e)', logoText: 'FF', tier: 'RISING', rating: 4.7, avatar: '/avatars/a09.jpg', poster: '/posters/p09.jpg' },
  { id: 10, industryId: 'health', label: 'Health/Wellness',  isVideo: true, face: 'white-kurta-man',
    src: '/home/video_19.mp4',
    brand: 'VitaGlow',        creator: 'Emma',    logoBg: 'linear-gradient(135deg, #0e7490, #06b6d4)', logoText: 'VG', tier: 'ELITE', rating: 5.0, avatar: '/avatars/a10.jpg', poster: '/posters/p10.jpg' },
  { id: 11, industryId: 'travel', label: 'Travel',           isVideo: true, face: 'long-brown-hair',
    src: '/home/video_21.mp4',
    brand: 'NomadPack',       creator: 'Liam',    logoBg: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', logoText: 'NP', tier: 'PRO', rating: 4.8, avatar: '/avatars/a11.jpg', poster: '/posters/p11.jpg' },
  { id: 12, industryId: 'finance', label: 'Finance/Insurance', isVideo: true, face: 'bag-woman',
    src: '/home/video_22.mp4',
    brand: 'CoinKeep',        creator: 'Ava',     logoBg: 'linear-gradient(135deg, #3A3A66, #fbbf24)', logoText: 'CK', tier: 'RISING', rating: 4.7, avatar: '/avatars/a12.jpg', poster: '/posters/p12.jpg' },
  { id: 13, industryId: 'home',   label: 'Home/Household',   isVideo: true, face: 'blue-set',
    src: '/home/video_23.mp4',
    brand: 'NestHome',        creator: 'Olivia',  logoBg: 'linear-gradient(135deg, #7c2d12, #fb7185)', logoText: 'NH', tier: 'PRO', rating: 4.9, avatar: '/avatars/a13.jpg', poster: '/posters/p13.jpg' },
  { id: 14, industryId: 'gaming', label: 'Gaming',           isVideo: true, face: 'curly-beige', // looks like id 5 — kept 9 cards apart
    src: '/home/video_24.mp4',
    brand: 'PlayVerse',       creator: 'Ethan',   logoBg: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', logoText: 'PV', tier: 'ELITE', rating: 4.8, avatar: '/avatars/a14.jpg', poster: '/posters/p14.jpg' },
  { id: 15, industryId: 'charity', label: 'Charity',         isVideo: true, face: 'red-blazer',
    src: '/home/video_25.mp4',
    brand: 'CareCircle',      creator: 'Mia',     logoBg: 'linear-gradient(135deg, #831843, #ec4899)', logoText: 'CC', tier: 'RISING', rating: 4.9, avatar: '/avatars/a15.jpg', poster: '/posters/p15.jpg' },
  { id: 16, industryId: 'services', label: 'Consumer Services', isVideo: true, face: 'glasses-man',
    src: '/home/video_26.mp4',
    brand: 'SwiftServe',      creator: 'Lucas',   logoBg: 'linear-gradient(135deg, #1F1F4E, #0ea5e9)', logoText: 'SS', tier: 'PRO', rating: 4.7, avatar: '/avatars/a16.jpg', poster: '/posters/p16.jpg' },
  // SWAP: owner clip #1 replaces this entry's src/poster/face. Same woman as id 2 until then,
  // so it sits last (never in the first 10 cards / mobile first 6 / marquee row 1).
  { id: 4, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true, face: 'jewellery',
    src: '/home/video_06.mp4',
    brand: 'Glowly',          creator: 'Maya',    logoBg: 'linear-gradient(135deg, #fb7185, #f43f5e)', logoText: 'Gl', tier: 'PRO', rating: 4.7, avatar: '/avatars/a04.jpg', poster: '/posters/p04.jpg' },
];
