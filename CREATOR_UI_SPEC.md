# Creator UI — Complete Functional Spec

A full map of the Creator side: architecture, every sidebar item, every page, every
button, all API calls, and gating rules. Built from the live code. Use this as the
reference (or build prompt) when mirroring the Brand/Business side.

---

## 1. Architecture & Shared Chrome

- **Shell + sidebar + topbar** come from `src/components/DashboardLayout.js`.
- **All visual styling** comes from one stylesheet: `src/pages/CreatorDashboard.css`
  (`pcd-` class system). Changing tokens there restyles every Creator page.
- **Brand mark:** "UGCad.io" with a square "U" logo (top of sidebar).
- **Topbar (every page):** page title + description (left), then Search icon button,
  Notification bell (green unread dot), Profile chip (avatar + chevron → `/settings`),
  and a **Logout** button (clears auth → `/`). A hamburger appears < 900px to open the
  sidebar as a drawer.
- **Sidebar profile (bottom):** avatar + display name + role label ("Approved Creator").
- **Routing/guards:** every route is wrapped in `ProtectedRoute`. No user → `/auth`.
  Wrong role → `/`. All creator routes use `allowedRoles={['creator']}` except
  `/messages` (`creator`+`business`) and `/settings` (all roles).
- **Approval gating:** the Dashboard and most data pages only fetch data when
  `user.approval_status === 'approved'`. If `pending`/`rejected`, the Dashboard shows a
  full-screen status card instead of content.
- **Live data:** most pages poll their API every ~10s (Messages polls 3–5s).

---

## 2. Sidebar Menu (11 items)

| # | Label | Icon | Route | Page component |
|---|-------|------|-------|----------------|
| 1 | Dashboard | LayoutDashboard | `/dashboard/creator` | CreatorDashboard |
| 2 | Create a Gig | Upload | `/create-gig` | CreateGig |
| 3 | My Active Work | Zap | `/my-active-work` | MyActiveWorkPage |
| 4 | My Bids | Bookmark | `/my-bids` | MyBidsPage |
| 5 | Reviews | Star | `/reviews` | ReviewsPage |
| 6 | Portfolio | User | `/portfolio` | PortfolioPage |
| 7 | Browse Briefs | Briefcase | `/browse-briefs` | BrowseBriefs |
| 8 | My Deals | FileCheck | `/my-deals` | MyDealsPage |
| 9 | Messages | MessageSquare | `/messages` | MessagesPage |
| 10 | Payout | IndianRupee | `/withdrawal` | PayoutWithLayout |
| 11 | Settings | Settings | `/settings` | ProfileSettings |

Related (not in sidebar): `/campaign/:id` (campaign detail), `/chat/:userId`,
`/work/submit`, `/shipment`.

---

## 3. Dashboard — `/dashboard/creator`

**Purpose:** Creator home — KPIs, level progress, active campaigns, earnings, updates.

**APIs:** `GET /api/auth/me` (refresh user); `GET /api/campaigns`;
`GET /api/reviews/creator/:userId`; `GET /api/campaigns?status=completed&creator_id=:id`.
Submitting a bid: `POST /api/campaigns/:id/bid`. Polls every 10s.

**Sections & controls (top → bottom):**
1. **4 stat cards:** Active Deals, Pending Payout, Total Earned, Creator Rating
   (each shows a value + trend chip). Display only.
2. **Level banner (navy):** current level (New / L1 Rising Star / L2 Pro), progress bar
   to next level by completed-works count, Rating + Completed Works metrics.
   Levels: 0–9 works = New, 10–19 = L1, 20+ = L2.
3. **Active Campaigns table:** columns Brief Name, Quality, Brand Handle, Stage, Due
   Date, Payout, Action. **"Open"** button per row → `/campaign/:id`.
   **"View all deals →"** header button → `/my-active-work`. Empty row when none.
4. **Earnings Analytics card:** SVG area chart + range `<select>` (Last 6 Months / This
   Year).
5. **Updates card:** notification list + **"Mark all read"** (no-op placeholder).
6. **Creator Achievements card:** 4 badge tiles (Fast Deliverer, Brief Faithful, 5 Star
   Streak, Elite Creator) + "X of 7 Unlocked".
7. **Rate Card (navy):** Minimum Rate, Tier Multiplier, Custom Limit, Payout Window +
   **"Edit Rate Card"** → `/settings`.
8. **Bid modal** (if opened from elsewhere): fields Bid Amount, Delivery Days, Proposal;
   **Cancel** / **Submit Bid** (`POST /api/campaigns/:id/bid`).

**Gating:** `approval_status==='pending'` → "Profile Under Review" status card with
**"Back to Home"** (logout). `rejected` → "Profile Not Approved" card.

---

## 4. Create a Gig — `/create-gig`

**Purpose:** Post a service offering (gig) for admin approval.

**APIs:** `POST /api/upload/file` (per attachment); `POST /api/gigs`.

**Form (single page, 3 logical groups):**
- **Basic Information:** Gig Title (req, ≤100), Category (req, select: Social Media
  Content, Product Reviews, Unboxing Videos, Tutorials/How-to, Sponsored Content, Brand
  Ambassador Work, General Content Creation, Photography, Video Production, Other),
  Description (req, ≤5000), Budget ($, req, >0), Deadline (datetime-local, future).
- **Creator Details (optional multi-select checkboxes):** Niche (16), Video Styles (10),
  Filming Style (8), Platforms (8: Instagram, TikTok, YouTube, Facebook, Snapchat,
  Twitter/X, LinkedIn, Pinterest).
- **Attachments:** upload up to 5 files (≤10MB each). Each preview has an **X** remove.
- **Tips** info block.

**Buttons:**
- **Back** (arrow, header) → `/dashboard/creator`.
- **Cancel** → `/dashboard/creator`.
- **Create Gig** (→ "Creating…" while loading): validates required fields, `POST /api/gigs`,
  toast "Gig created successfully! Sent for admin approval", redirects to dashboard after 1.5s.

---

## 5. My Active Work — `/my-active-work`

**Purpose:** Campaigns where this creator was selected and work is in progress.

**APIs:** `GET /api/campaigns` (filtered to `selected_creator===user.id` and status
`in_progress`/`active`/`work_submitted`). Polls 10s. Fetches only if approved.

**Per-campaign card buttons:**
- **Open Deal Room** (Upload icon) → `/my-deals`.
- **Message** (MessageSquare) → `/chat/:business_id`.
- **Track Shipment** (Package, only if `requires_shipment`) → `/shipment?campaign=:id`.

**States:** Loading "Loading…"; Empty "No active campaigns. Browse and bid on campaigns
to get started."; error toast "Failed to load active work".

---

## 6. My Bids — `/my-bids`

**Purpose:** Track submitted bids that are still pending (not yet awarded).

**APIs:** `GET /api/bids/my`. Polls 10s. Fetches only if approved.
Filter: shows bids with status `pending`/`submitted`/`bid_submitted` AND campaign not
yet assigned to a creator.

**Per-bid card:** status badge + title; data list of Your Bid, Campaign Budget, Brand,
Delivery, Campaign Status, Submitted; optional proposal block.
- **View Campaign** (Eye icon) → `/campaign/:id`.

**States:** Loading "Loading…"; Empty "No bids submitted yet."; error toast
"Failed to load bids". No modals.

---

## 7. Reviews — `/reviews`

**Purpose:** Star ratings + written reviews brands left on completed campaigns.

**APIs:** `GET /api/reviews/creator/:userId`; then per review `GET /api/campaigns/:id`
and `GET /api/profile/:reviewerId` to enrich with campaign title + brand name. Polls 10s.

**Per review card (display only):** campaign title, "By {brand}", 5-star rating, review
text, review date. No buttons.

**States:** Loading "Loading…"; Empty "No reviews yet. Complete campaigns to receive
reviews."; error toast "Failed to load reviews".

---

## 8. Portfolio — `/portfolio`

**Purpose:** Showcase work — upload/manage portfolio items (images/videos + meta).

**APIs:** `GET /api/auth/me` (load portfolio); `POST /api/upload/file` (per file);
`PATCH /api/profile/portfolio` (save whole array on add and on remove).

**Layout:** header "My Portfolio" + **Add Work** button (Plus). Grid of cards: media
(with multi-file count badge), title, description (clamped), Project Cost, Duration, and
a **Remove** button (X, confirms then deletes).

**Add Portfolio Item modal:**
- Upload Images/Videos (up to 10; img ≤10MB, PDF ≤25MB, video ≤50MB; each preview has a
  remove **x**).
- Title (req, ≤120), Description (≤1000), Project Cost (≤50), Project Duration (≤50).
- **Cancel** (close) / **Add to Portfolio** (→ "Saving…"; disabled until ≥1 file). Close
  **X** in header.

**States:** Loading; Empty "No portfolio items yet. Click 'Add Work'…"; upload/save error
toasts; "Uploading…" tile state.

---

## 9. Browse Briefs — `/browse-briefs`

**Purpose:** Discover/filter open campaign briefs and submit bids.

**APIs:** `GET /api/campaigns` (filter status `active` & no `selected_creator`);
`GET /api/payout-ranges` (range filter options); `POST /api/campaigns/:id/bid`. Polls 10s.

**Left filter panel:**
- **Search** input ("Search opportunities…") — filters title/brand/description/tags.
- **Clear all** — resets all filters.
- **Category** section: "All Briefs" + dynamic tags w/ counts.
- **Payout Range** section: dynamic checkboxes from API (min/max).
- **Industry Type** section: Skincare & Haircare, Fashion, Service-based, Healthcare,
  Electronics, Food & Beverage (toggle checks).

**Results toolbar:** "Showing **N** matching opportunities"; **Sort** select (Recommended /
Highest Payout / Closing Soon / Newest); **Grid**/**List** view toggle.

**Brief card:** cover image, **Save** (bookmark, visual only — no handler), "Best Match"
badge on featured, brand logo + verified tick, match %, tags, budget, location, deadline.
- **Card title** → `/campaign/:id`.
- **Pitch Now** → opens Submit Bid modal. If already bid, shows **View Bid** → `/campaign/:id`.

**Submit Bid modal:** Bid Amount (#, ≥1), Delivery Days (#, ≥1), Proposal (textarea).
**Cancel** / **Submit Bid** (`POST …/bid`).

**States:** "Loading campaigns…" / "No matching briefs found. Try clearing filters."

---

## 10. My Deals — `/my-deals`  (the deal room — most complex page)

**Purpose:** End-to-end deal workspace: content delivery, shipments, revisions, chat,
disputes.

**APIs:** `GET /api/deals/my`; `POST /api/upload/file`; and per-deal:
`POST /api/deals/:id/receipt`, `/content`, `/chat`, `/damage-report`, `/dispute`,
`/escalate`, `/action-card`, `/revision-response`.

**Layout: 3 columns (tabbed on mobile: deals / workspace / chat).**

**Left — deal navigation:** collapsible groups **Active Deals**, **Awaiting My Action**,
**Past Deals**, **Disputed Deals** (each with count + chevron). Click a deal to select it.

**Center — workspace:**
- **Status header:** brand + deal ID; 5 metric pills (Current State, Active Party, Creator
  Status, Deadline, Escrow held); a **dynamic primary action button** (Mark Received /
  Submit Content / Submit Revision / Add Evidence / Archive Deal); **More** menu
  (**Raise Dispute**, **Get Help**, **Archive if completed**).
- **Full Campaign Brief** (collapsible) + **View full brief in new tab** → `/campaign/:id`.
- **Activity Feed:** chronological state transitions; **Show X more activities** toggle.
- **Shipping/Receipt:** **Upload Unboxing Video** zone (MP4/MOV ≤2 min) → **Mark Received**
  (disabled until uploaded). Damage state shows **Add Evidence** / **Message Support**.
- **Damage Report card** (if damaged): details + **View Uploaded Evidence** + evidence links.
- **Content Submission:** Final Video upload + conditional Caption/Thumbnail/Raw Footage
  uploads (driven by `required_assets`); version history; **Submit Final Delivery**
  (disabled until required assets present).
- **Revision Tracker:** revisions used/limit + brand feedback; buttons **Accept and revise**,
  **Flag scope creep**, **Partially accept and dispute remaining items**.

**Right — panel (tabs: Chat / Progress):**
- **Chat:** pinned state/deadline alert; message list (creator/brand/system); **Support
  Actions** menu (Milestone Update, Escalate to Admin, Raise Dispute, Damage Report);
  composer with **emoji picker** (12 emojis), **file attach** (img/video/PDF/doc), text
  input, **Send** (`POST …/chat`).
- **Progress:** state-progression tracker (current = Clock, done = CheckCheck).
- **Payout Summary:** Escrow Held, Net Payable, deductions, estimated payout date.
- **Help menu:** Escalate to Admin, Raise Dispute, Report Damaged / Wrong Product.

**Mobile:** floating action button mirrors the primary action.

**States:** Loading; Empty "No active deals yet…"; "No activity yet."; "No messages yet.";
upload/submit error toasts.

---

## 11. Messages — `/messages`

**Purpose:** Unified creator↔brand chat with attachments, typing indicators, and
structured **Action Cards**.

**APIs:** `GET /api/auth/me`; `GET /api/chat/conversations` (5s poll);
`GET /api/chat/:otherId` (3s poll); `GET /api/chat/warnings`;
`GET/POST /api/chat/:otherId/typing` (typing, throttled 2.5s); `POST /api/upload/file`;
`POST /api/chat/send`; `POST /api/chat/action-cards`;
`POST /api/chat/action-cards/:cardId/respond`.

**Left — conversation list:** header "Messages"; **Search** ("Search messages…"); filter
tabs **All / Active Deals / New Chat / Archived**; rows show avatar (+online dot), name,
time-ago, last-message preview, deal badge, unread count.

**Center — chat:** header with **View profile** (→ `/profile/:id`), **Report user** (toast
"Report flow coming soon"), **Mute notifications** (toast), **More**. Message thread with
bubbles, system pills, read/delivered status, typing indicator.
- **Action cards** render inline (Custom Offer, Counter Offer, Revision Request, etc.) with
  fields + accept/reject action buttons on incoming open cards.
- **Quick action chips** open the composer: Custom Offer, Private Invitation, Counter Offer,
  Revision Request, Milestone Update, Damage Report, Escalate to Admin, Raise Dispute
  (filtered by role/deal state — creators mainly get Milestone Update when a deal is active).
- **Action card composer** (inline): dynamic fields per type; **Cancel** / **Send Card**.
- **Composer:** emoji picker (12), **Paperclip** attach (≤5 files; img ≤10MB, PDF ≤25MB,
  video ≤50MB), text input, **Send**. Policy banner can disable free-form chat
  (Action-Cards-only mode); messages are policy-filtered (3-strike warnings).

**Right (no chat selected):** "Select a conversation to start messaging."

---

## 12. Payout — `/withdrawal`

Route renders **PayoutWithLayout** (history within the sidebar layout). A richer
**WithdrawalPage** component also exists (KPIs + payment-method management + request flow).

**APIs:** `GET /api/withdrawal/history` (PayoutWithLayout). WithdrawalPage adds
`GET /api/payout/overview`, `POST /api/withdrawal/request`, `PUT /api/profile/payment-info`.

**PayoutWithLayout content:** title "Payout & Withdrawals"; **Search** by withdrawal ID;
**Status** filter (All / Paid / Processing / Pending / Disputed); table (TXN ID, Amount,
Status, Date, Method). Empty: "No withdrawals found".

**WithdrawalPage extras:** 4 KPI cards (Pending Release, Paid This Month, All-Time
Earnings, Payout Window); **Export CSV**; per-row **View**; **Edit Details** / **Add
Account** (bank/UPI modal: Account Holder, Bank Name, Account #, IFSC, UPI → **Save
Details**); **Request Withdrawal** modal (Amount ≥10, UPI/Bank toggle → **Submit
Withdrawal Request**); Payout-Speed-by-Level + earnings insight.

---

## 13. Settings — `/settings`

**Purpose:** Profile, password, and 2FA (shared component also serves Business).

**Creator APIs:** `GET /api/auth/me`; `GET /api/profile/2fa/status`;
`PUT /api/profile/update-info`; `POST /api/profile/upload-photo`;
`POST /api/profile/change-password`; `POST /api/profile/2fa/setup|verify|disable`;
`GET /api/campaigns?status=completed&creator_id=:id` (for level card).

**Tabs (left):**
- **Profile:** Creator Level card; **Change Photo** (JPG/PNG/WebP ≤2MB); Bio (≤500),
  Description (≤1000); Gender select; Languages multi-select (18); Country (18+Other); Age
  Range (6 bands); **Save Changes**.
- **Password:** Current / New / Confirm (≥8, must match) → **Change Password**.
- **Two-Factor Auth:** if off → **Setup 2FA** (QR + manual key + 6-digit code →
  **Verify & Enable**); if on → password field → **Disable 2FA**.

---

## 14. Status / Approval Screens

- **Pending:** full-screen card "Profile Under Review" + **Back to Home** (logout).
- **Rejected:** "Profile Not Approved" + contact-support copy + **Back to Home**.
- Shown by the Dashboard before any creator content loads.

---

## 15. Cross-cutting Patterns (for mirroring to Brand)

- One layout (`DashboardLayout`) + one stylesheet (`CreatorDashboard.css`) drive
  everything; pages only supply `navItems`, `title`, `description`, and content.
- Every list page: 10s poll, Loading → Empty → data, approval-gated fetch.
- Uploads always go through `POST /api/upload/file` → returns `{ file_url }`.
- Money formatted as `Rs. …`; statuses rendered via `pcd-status` color variants.
- Primary actions are context-driven (deal-room button label changes by state).
