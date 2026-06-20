# UI Build Guide — turning the spec into screens

You have `CREATOR_UI_SPEC.md` (what each screen *does*). This file is the *how to build
it* layer: design tokens, the layout shell, and copy-paste prompts for any UI generator
(v0.dev, Google Stitch, 21st Magic, Figma AI) or a developer.

Build order: **1) Design system → 2) Layout shell → 3) One screen at a time.**

---

## 1. Design System (paste this first — everything else references it)

```
DESIGN SYSTEM — "Creator Workspace" (compact, polished, professional light SaaS)

Brand: UGCad.io. A creator-marketplace dashboard. Deep-navy sidebar, light content.

COLORS
- Canvas / app background: #f6f7fc
- Surface (cards): #ffffff
- Sidebar: navy gradient #101046 → #0a0a30
- Primary text (ink): #15163a
- Secondary text: #585c7e
- Muted text: #9296ba
- Brand accent (periwinkle): #5b6bff  / strong #4452f0 / soft tint #eef0ff
- Success #15a35b (tint #e7f6ee) · Warning #d98314 (tint #fdf2e0) · Danger #e11d48 (tint #fdeaef)
- Hairline border: #e9ebf4

TYPE
- Headings: "Readex Pro" (display); Body: "Just Sans"/Inter. Never hardcode other fonts.
- Scale (compact): H1 22px · section H2 16px · component H3 14px · body 13.5px · small 11px
- Heading weight 650, letter-spacing -0.01em. Numbers/stats 23px/700.

SHAPE & DEPTH
- Radii: xs 8 · sm 10 · md 13 · card 16 · pill 999
- Shadows (soft, layered):
  xs 0 1px 2px rgba(18,22,60,.05)
  card 0 1px 2px rgba(18,22,60,.05), 0 2px 6px rgba(18,22,60,.04)
  hover 0 8px 24px -14px rgba(18,22,60,.22)
- Spacing: 4px grid. Card padding 16–20. Grid gaps 16–20. Content padding 24–28.

INTERACTION
- Hover: cards lift translateY(-2px) + hover shadow + brand-tinted border.
- Inputs: 1px border → focus = brand border + 3px brand ring (rgba(91,107,255,.16)).
- Primary button: periwinkle gradient, white text, soft glow. Secondary: white + hairline.
- Status chips: pill, soft tint bg + matching text (success/warn/danger/brand).
- Respect prefers-reduced-motion. Mobile: sidebar becomes a left drawer < 900px.
```

> These exact values live in `src/pages/CreatorDashboard.css` (the `--pcd-*` tokens).
> If you change them there, the whole app restyles.

---

## 2. Layout Shell (build once, every screen sits inside it)

```
Build an app shell:
- Left SIDEBAR (248px, sticky, navy gradient): "UGCad.io" logo (square "U" mark) at top;
  vertical nav list (icon + label, rounded 10px items; active item = periwinkle gradient
  pill with glow; optional count badge on the right); at the bottom a profile card
  (avatar + name + "Approved Creator").
- TOPBAR (sticky, frosted light): page Title + subtitle on the left; on the right a
  Search icon button, a Bell (with green unread dot), a Profile chip (avatar + chevron),
  and a Logout button. Hamburger appears < 900px to open the sidebar drawer.
- CONTENT area: #f6f7fc canvas, padding 24–28, scrolls independently.
Nav items (icon · label · route):
  LayoutDashboard Dashboard /dashboard/creator · Upload "Create a Gig" /create-gig ·
  Zap "My Active Work" /my-active-work · Bookmark "My Bids" /my-bids · Star Reviews /reviews ·
  User Portfolio /portfolio · Briefcase "Browse Briefs" /browse-briefs · FileCheck "My Deals"
  /my-deals · MessageSquare Messages /messages · IndianRupee Payout /withdrawal ·
  Settings Settings /settings.
Icons: lucide-react. Stack: React + plain CSS (matches existing app).
```

---

## 3. Per-Screen Prompt Template (fill in from CREATOR_UI_SPEC.md)

```
Using the DESIGN SYSTEM and SHELL above, build the "<SCREEN NAME>" screen.

PURPOSE: <one line from the spec>
LAYOUT: <columns / grid / single form — describe regions top to bottom>
COMPONENTS: <cards, table, filters, modal… each with its fields>
EVERY CONTROL: <list each button/input + what it does — nav target / opens modal / submits>
DATA: <which API each section reads/writes — for realistic placeholders>
STATES: loading skeleton, empty state (exact copy), error toast.
RESPONSIVE: 2-col → 1-col on tablet; sidebar drawer on mobile.
Keep it compact and polished. Output React + CSS using the token values above.
```

---

## 4. Worked Examples (ready to paste)

### Example A — Dashboard
```
Build the "Dashboard" screen inside the shell.
PURPOSE: Creator home — KPIs, level progress, active campaigns, earnings, updates.
LAYOUT (top→bottom):
1) Row of 4 STAT CARDS: Active Deals, Pending Payout, Total Earned, Creator Rating —
   each: icon chip (top-left), trend pill (top-right), big number (23px), label.
2) LEVEL BANNER (navy gradient, full width): trophy + "L1 Rising Star" + progress bar to
   next level with "12 / 20 works", and right-side metrics Rating + Completed Works.
3) ACTIVE CAMPAIGNS card: table (Brief Name, Quality, Brand Handle, Stage[status chip],
   Due Date, Payout, Action[Open button]); header link "View all deals →". Empty row state.
4) Two-column: EARNINGS ANALYTICS (area chart + range select) | UPDATES list (+ "Mark all read").
5) Two-column: ACHIEVEMENTS (4 badge tiles + "4 of 7 Unlocked") | RATE CARD (navy: Min Rate,
   Tier Multiplier, Custom Limit, Payout Window + "Edit Rate Card" button).
CONTROLS: "Open"→/campaign/:id · "View all deals"→/my-active-work · "Edit Rate Card"→/settings.
STATES: if approval pending → full-screen "Profile Under Review" card with "Back to Home".
```

### Example B — Browse Briefs
```
Build "Browse Briefs": two columns.
LEFT FILTER PANEL (264px, sticky card): Search ("Search opportunities…"), "Clear all";
  collapsible sections — Category (All Briefs + tags w/ counts), Payout Range (radios),
  Industry Type (6 checkboxes). Selected check = periwinkle box/dot.
RIGHT RESULTS: toolbar ("Showing N matching opportunities" · Sort select · Grid/List toggle);
  responsive grid of BRIEF CARDS — cover image w/ dark gradient, bookmark btn, "Best Match"
  badge, brand logo+verified tick overlaid at bottom; body: title (2-line clamp), description,
  tags (match% / fast), footer with budget (big) + location + deadline chip + "Pitch Now" btn.
CONTROLS: card title & "View Bid"→/campaign/:id · "Pitch Now"→Submit Bid modal
  (Bid Amount, Delivery Days, Proposal → Cancel / Submit Bid).
STATES: "Loading campaigns…" / "No matching briefs found. Try clearing filters."
```

### Example C — Portfolio
```
Build "Portfolio": header "My Portfolio" + "Add Work" (periwinkle) button; responsive grid
of media cards (image/video, multi-file count badge, title, 3-line description, "Project
Cost" + duration row, red "Remove" button on hover).
"Add Work" opens a MODAL: upload up to 10 files (img/video, each preview removable), Title*,
Description, Project Cost, Project Duration; footer Cancel / "Add to Portfolio" (disabled
until ≥1 file). Empty: "No portfolio items yet. Click 'Add Work'…".
```

---

## 5. Which tool for what

| Goal | Use |
|------|-----|
| Generate React screens fast from a prompt | **v0.dev** or **21st Magic** (`/ui` component builder) |
| Full multi-screen design + design system | **Google Stitch** (feed Section 1 as the design_md) |
| Match your real app exactly | Build directly in this repo against `CreatorDashboard.css` (tokens already done) |
| Polished individual components | **21st Magic** refiner on an existing component |

**Recommended flow:** paste Section 1 (design system) → paste Section 2 (shell) → then one
Section-4 example at a time. Review each screen before generating the next. Reuse the
Section-3 template for the remaining screens (Bids, Reviews, Active Work, Deals, Messages,
Payout, Settings, Create Gig) by copying their entries from `CREATOR_UI_SPEC.md`.

---

## 6. Build checklist (per screen)
- [ ] Sits inside the shell (sidebar + topbar), correct nav item active
- [ ] Uses only design-system tokens (no stray colors/fonts)
- [ ] Every button from the spec exists and does the right thing
- [ ] Loading + empty + error states present (exact copy from spec)
- [ ] Responsive: 2-col→1-col, sidebar drawer < 900px
- [ ] Data wired to the listed API endpoints (or realistic placeholders)
```
