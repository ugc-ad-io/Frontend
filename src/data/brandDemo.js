// Sample data shown ONLY when a brand section returns nothing from the backend.
// Real data always takes precedence — these are pure UI-demo fallbacks so empty
// accounts don't render blank sections.

export const DEMO_CAMPAIGNS = [
  {
    id: 'demo-c1',
    title: 'Summer Skincare Collection',
    category: 'Beauty',
    status: 'active',
    brief_text: 'Authentic morning-routine UGC featuring our glow serum. Looking for relatable skincare creators who can show real results and a clean, bright aesthetic.',
    budget_min: 5000,
    budget_max: 20000,
    requires_shipment: true,
    shipment_option: 'yes',
    selected_creator: null,
    created_at: '2026-06-18T09:00:00Z',
    bids: [
      { id: 'demo-b1', creator_id: 'demo-cr-1', public_creator_id: 'CRE-1042', creator_nickname: 'jennifer.l', category: 'Beauty • Skincare', amount: 1800, estimated_delivery_days: 3, proposal: "I'd love to create authentic content that connects with your audience and showcases your products beautifully." },
      { id: 'demo-b2', creator_id: 'demo-cr-2', public_creator_id: 'CRE-2087', creator_nickname: 'sarah.huge', category: 'Lifestyle • Fashion', amount: 1600, estimated_delivery_days: 4, proposal: 'I can create high-quality UGC that drives engagement and builds trust with your audience.' },
      { id: 'demo-b3', creator_id: 'demo-cr-3', public_creator_id: 'CRE-3310', creator_nickname: 'rohan.creator', category: 'Fitness • Health', amount: 2000, estimated_delivery_days: 3, proposal: 'Fitness and wellness content is my niche. I’ll help you promote your brand effectively.' },
    ],
  },
  {
    id: 'demo-c2',
    title: 'Festive Fashion Haul',
    category: 'Fashion',
    status: 'in_progress',
    brief_text: 'Try-on haul reel for our festive collection. Energetic, trend-led editing with strong hooks in the first 3 seconds.',
    budget_min: 12000,
    budget_max: 12000,
    requires_shipment: true,
    shipment_option: 'yes',
    selected_creator: 'demo-cr-2',
    created_at: '2026-06-10T11:30:00Z',
    bids: [
      { id: 'demo-b4', creator_id: 'demo-cr-2', public_creator_id: 'CRE-2087', creator_nickname: 'sarah.huge', category: 'Lifestyle • Fashion', amount: 12000, estimated_delivery_days: 5, proposal: 'Festive styling is my specialty — expect punchy, scroll-stopping edits.' },
    ],
  },
  {
    id: 'demo-c3',
    title: 'Protein Snack Launch',
    category: 'Food',
    status: 'work_submitted',
    brief_text: 'Snackable testimonial-style content highlighting taste and macros for our new protein bar.',
    budget_min: 8000,
    budget_max: 15000,
    requires_shipment: true,
    shipment_option: 'yes',
    selected_creator: 'demo-cr-3',
    created_at: '2026-06-05T08:15:00Z',
    bids: [
      { id: 'demo-b5', creator_id: 'demo-cr-3', public_creator_id: 'CRE-3310', creator_nickname: 'rohan.creator', category: 'Fitness • Health', amount: 11000, estimated_delivery_days: 4, proposal: 'Perfect fit for my fitness audience — clean macros-focused storytelling.' },
    ],
  },
  {
    id: 'demo-c4',
    title: 'Smart Home Gadget Demo',
    category: 'Tech',
    status: 'completed',
    brief_text: 'Crisp product-demo content showing setup and three everyday use-cases for our smart plug.',
    budget_min: 20000,
    budget_max: 20000,
    requires_shipment: false,
    shipment_option: 'no',
    selected_creator: 'demo-cr-4',
    created_at: '2026-05-22T14:00:00Z',
    bids: [
      { id: 'demo-b6', creator_id: 'demo-cr-4', public_creator_id: 'CRE-4501', creator_nickname: 'tech.with.amir', category: 'Tech • Gadgets', amount: 20000, estimated_delivery_days: 6, proposal: 'Detailed yet snappy demos are my thing.' },
    ],
  },
  {
    id: 'demo-c5',
    title: 'Fitness Apparel Promo',
    category: 'Fitness',
    status: 'active',
    brief_text: 'High-energy gym reels featuring our new performance leggings. Strong movement shots and confident delivery.',
    budget_min: 6000,
    budget_max: 10000,
    requires_shipment: false,
    shipment_option: 'no',
    selected_creator: null,
    created_at: '2026-06-20T16:45:00Z',
    bids: [
      { id: 'demo-b7', creator_id: 'demo-cr-3', public_creator_id: 'CRE-3310', creator_nickname: 'rohan.creator', category: 'Fitness • Health', amount: 1900, estimated_delivery_days: 3, proposal: 'Gym content is exactly my lane — expect dynamic, motivational edits.' },
      { id: 'demo-b8', creator_id: 'demo-cr-5', public_creator_id: 'CRE-5120', creator_nickname: 'priya.moves', category: 'Fitness • Yoga', amount: 1700, estimated_delivery_days: 4, proposal: 'Calm, aspirational movement content with great natural lighting.' },
      { id: 'demo-b9', creator_id: 'demo-cr-6', public_creator_id: 'CRE-6033', creator_nickname: 'arjun.fit', category: 'Fitness • Strength', amount: 2100, estimated_delivery_days: 2, proposal: 'Fast turnaround, punchy hooks, strong CTA.' },
      { id: 'demo-b10', creator_id: 'demo-cr-7', public_creator_id: 'CRE-7088', creator_nickname: 'neha.active', category: 'Lifestyle • Fitness', amount: 1500, estimated_delivery_days: 5, proposal: 'Relatable everyday-athlete storytelling that converts.' },
    ],
  },
];

export const DEMO_WORK_SUBMISSIONS = [
  {
    id: 'demo-w1',
    campaign_id: 'demo-c3',
    campaign_title: 'Protein Snack Launch',
    creator_id: 'demo-cr-3',
    public_creator_id: 'CRE-3310',
    description: 'First cut of the testimonial reel + 3 photo stills. Open to one round of revisions on the hook.',
    submitted_at: '2026-06-24T10:20:00Z',
    created_at: '2026-06-24T10:20:00Z',
    work_files: ['/uploads/demo/protein-reel-v1.mp4', '/uploads/demo/protein-still-1.jpg', '/uploads/demo/protein-still-2.jpg'],
  },
  {
    id: 'demo-w2',
    campaign_id: 'demo-c2',
    campaign_title: 'Festive Fashion Haul',
    creator_id: 'demo-cr-2',
    public_creator_id: 'CRE-2087',
    description: 'Full try-on haul reel delivered in 9:16. Raw files attached as requested.',
    submitted_at: '2026-06-25T15:05:00Z',
    created_at: '2026-06-25T15:05:00Z',
    work_files: ['/uploads/demo/festive-haul.mp4', '/uploads/demo/festive-raw.zip'],
  },
];

// Already in the normalized shape used by the directory grid (see normalizeCreatorDirectoryItem).
export const DEMO_CREATOR_DIRECTORY = [
  { id: 'demo-cr-1', publicCreatorId: 'CRE-1042', handle: '@jennifer.l', displayId: 'CRE-1042', avatar: '', category: 'Beauty', languages: ['English', 'Hindi'], cityTier: 'Metro', deliverablesCompleted: 34, portfolioPreview: '', style: 'Testimonial', budgetRange: 'Rs. 5,000 - Rs. 10,000' },
  { id: 'demo-cr-2', publicCreatorId: 'CRE-2087', handle: '@sarah.huge', displayId: 'CRE-2087', avatar: '', category: 'Fashion', languages: ['English'], cityTier: 'Metro', deliverablesCompleted: 51, portfolioPreview: '', style: 'Lifestyle reel', budgetRange: 'Rs. 10,000 - Rs. 25,000' },
  { id: 'demo-cr-3', publicCreatorId: 'CRE-3310', handle: '@rohan.creator', displayId: 'CRE-3310', avatar: '', category: 'Fitness', languages: ['English', 'Marathi'], cityTier: 'Tier-2', deliverablesCompleted: 28, portfolioPreview: '', style: 'Product demo', budgetRange: 'Rs. 5,000 - Rs. 10,000' },
  { id: 'demo-cr-4', publicCreatorId: 'CRE-4501', handle: '@tech.with.amir', displayId: 'CRE-4501', avatar: '', category: 'Tech', languages: ['English', 'Hindi'], cityTier: 'Metro', deliverablesCompleted: 42, portfolioPreview: '', style: 'Unboxing', budgetRange: 'Rs. 10,000 - Rs. 25,000' },
  { id: 'demo-cr-5', publicCreatorId: 'CRE-5120', handle: '@priya.moves', displayId: 'CRE-5120', avatar: '', category: 'Fitness', languages: ['English', 'Tamil'], cityTier: 'Tier-2', deliverablesCompleted: 19, portfolioPreview: '', style: 'Storytelling', budgetRange: 'Under Rs. 5,000' },
  { id: 'demo-cr-6', publicCreatorId: 'CRE-6033', handle: '@arjun.fit', displayId: 'CRE-6033', avatar: '', category: 'Lifestyle', languages: ['English', 'Hindi', 'Telugu'], cityTier: 'Metro', deliverablesCompleted: 63, portfolioPreview: '', style: 'Product demo', budgetRange: 'Rs. 25,000+' },
];

// Raw-shape creators for the Overview reel grid (BrandOverview reads nickname /
// portfolio_preview / profile_photo). Portrait fallback videos fill empty previews.
export const DEMO_OVERVIEW_CREATORS = [
  { id: 'demo-cr-1', nickname: 'jennifer.l', premium: true },
  { id: 'demo-cr-2', nickname: 'sarah.huge', premium: false },
  { id: 'demo-cr-3', nickname: 'rohan.creator', premium: true },
  { id: 'demo-cr-4', nickname: 'tech.with.amir', premium: false },
  { id: 'demo-cr-5', nickname: 'priya.moves', premium: false },
  { id: 'demo-cr-6', nickname: 'arjun.fit', premium: true },
  { id: 'demo-cr-7', nickname: 'neha.active', premium: false },
  { id: 'demo-cr-8', nickname: 'kabir.shoots', premium: false },
];

// Work-review rows (BrandWorkReview shape). Thumbnails use the bundled public
// sample reels via absolute origin URLs so previews + durations render.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const reel = (n) => `${ORIGIN}/creator/${n}`;
export const DEMO_WORK_REVIEW = [
  { id: 'demo-wr-1', title: 'Summer Glow Serum — Morning Routine', campaign: 'Summer Skincare Collection', creatorId: 'demo-cr-1', creator: '@jennifer.l', photo: '', files: [reel('video_27.mp4')], submittedAt: '2026-06-25T09:30:00Z', status: 'approved' },
  { id: 'demo-wr-2', title: 'Festive Try-On Haul Reel', campaign: 'Festive Fashion Haul', creatorId: 'demo-cr-2', creator: '@sarah.huge', photo: '', files: [reel('video_29.mp4')], submittedAt: '2026-06-26T14:10:00Z', status: 'approved' },
  { id: 'demo-wr-3', title: 'Protein Bar Taste Test', campaign: 'Protein Snack Launch', creatorId: 'demo-cr-3', creator: '@rohan.creator', photo: '', files: [reel('video_30.mp4')], submittedAt: '2026-06-24T11:00:00Z', status: 'pending_review' },
  { id: 'demo-wr-4', title: 'Smart Plug 3 Use-Cases Demo', campaign: 'Smart Home Gadget Demo', creatorId: 'demo-cr-4', creator: '@tech.with.amir', photo: '', files: [reel('video_32.mp4')], submittedAt: '2026-06-23T16:45:00Z', status: 'pending_review' },
  { id: 'demo-wr-5', title: 'Performance Leggings Gym Reel', campaign: 'Fitness Apparel Promo', creatorId: 'demo-cr-5', creator: '@priya.moves', photo: '', files: [reel('video_33.mp4')], submittedAt: '2026-06-22T08:20:00Z', status: 'pending_review' },
  { id: 'demo-wr-6', title: 'Strength Apparel Hype Cut', campaign: 'Fitness Apparel Promo', creatorId: 'demo-cr-6', creator: '@arjun.fit', photo: '', files: [reel('video_34.mp4')], submittedAt: '2026-06-21T19:05:00Z', status: 'pending_review' },
  { id: 'demo-wr-7', title: 'Skincare Testimonial v1', campaign: 'Summer Skincare Collection', creatorId: 'demo-cr-7', creator: '@neha.active', photo: '', files: [reel('video_35.mp4')], submittedAt: '2026-06-20T13:35:00Z', status: 'revision_requested' },
];

export const DEMO_WALLET = {
  available_balance: 84500,
  minimum_chat_balance: 5000,
  chat_unlocked: true,
  plan_name: 'Brand Growth',
  recharge_bonus: { current_tier_percent: 8, next_tier_amount: 50000, next_tier_percent: 12, progress: 64 },
  bonus_tiers: [],
  transactions: [
    { id: 'demo-t1', date: '2026-06-25T12:30:00Z', type: 'Wallet Recharge', reference: 'RZP-8841', direction: 'credit', amount: 50000, status: 'success' },
    { id: 'demo-t2', date: '2026-06-24T18:05:00Z', type: 'Escrow Hold', reference: 'Festive Fashion Haul', direction: 'debit', amount: 12000, status: 'success' },
    { id: 'demo-t3', date: '2026-06-22T09:10:00Z', type: 'Recharge Bonus', reference: '+8% tier', direction: 'credit', amount: 4000, status: 'success' },
    { id: 'demo-t4', date: '2026-06-20T14:45:00Z', type: 'Payout Released', reference: 'Smart Home Gadget Demo', direction: 'debit', amount: 20000, status: 'success' },
    { id: 'demo-t5', date: '2026-06-15T10:00:00Z', type: 'Wallet Recharge', reference: 'RZP-8620', direction: 'credit', amount: 25000, status: 'success' },
  ],
};

export const DEMO_DASHBOARD = {
  metrics: {
    active_deals: 4,
    active_deals_change_this_week: 2,
    live_campaigns: 2,
    in_escrow: 32000,
    delivered_this_month: 7,
    delivered_monthly_change_percent: 18,
    wallet_balance: 84500,
    approval_rate: 92,
    avg_rating: 4.7,
  },
  live_campaigns: 2,
  budget_usage: {
    used: 76000,
    total: 120000,
    categories: [
      { label: 'Beauty', percent: 38 },
      { label: 'Fashion', percent: 27 },
      { label: 'Fitness', percent: 21 },
      { label: 'Tech', percent: 14 },
    ],
  },
  pending_actions: [
    { type: 'review_work', label: 'Review submitted work', count: 2, target_url: '/dashboard/business/work-review' },
    { type: 'shipment', label: 'Ship products to creators', count: 1, target_url: '/dashboard/business/shipments' },
    { type: 'message', label: 'Unread creator messages', count: 3, target_url: '/messages' },
  ],
  creator_funnel: { live: 2, applied: 11, shortlisted: 4, selected: 3 },
  top_campaigns: [],
  active_deals: [],
};
