# Brand / Business Side — Flow (Current vs Ideal)

> Role: `business` (= **brand**). Landing: `/`. Gated by `approval_status === 'approved'`. Main hub: `BusinessDashboard.js` (renders sub-pages via a `page` prop).

---

## PART A — CURRENT (AS-IS) FLOW

### A.1 End-to-end journey (current)

```mermaid
flowchart TD
    L["/ landing"] --> SU["Signup → business role"]
    SU --> PS["/profile-setup/business<br/>name, website, country, industry,<br/>phone, Instagram, GSTIN<br/>PUT /profile/business"]
    PS --> PEND[approval_status = pending]
    PEND --> GATE{Admin decision}
    GATE -->|rejected| REJ["❌ 'Profile not approved'"]
    GATE -->|approved| HOME["/brand-home + /dashboard/business<br/>overview metrics"]

    HOME --> FUND["Fund wallet<br/>/dashboard/business/wallet<br/>POST /business/wallet/recharge"]
    FUND -.->|"⚠️ Razorpay not fully wired"| FUNDX[stub]

    HOME --> PATH{Source content}

    PATH -->|"Path A — POST BRIEF"| PB["/dashboard/business/post-brief<br/>8-step wizard (PostABrief)"]
    PB --> PUB{Publish option}
    PUB -->|"Publish & Invite"| ACTIVE["Brief LIVE → status=active<br/>(auto-publish, NO admin gate)"]
    PUB -->|"Publish & Request Matches"| MATCH["match_requested=true<br/>ops curates shortlist"]

    ACTIVE --> BIDS["/dashboard/business/pending-bids<br/>review creator bids"]
    MATCH --> SHORT["/campaign/:id<br/>see ops shortlist"]

    BIDS --> SELECT["Select creator<br/>POST /campaigns/:id/select-creator<br/>→ escrow held, status=in_progress"]
    SHORT --> INVITE["Invite shortlist creator<br/>(others released)"]
    INVITE --> SELECT

    SELECT --> SHIP{requires_shipment?}
    SHIP -->|yes| TRACK["/shipment?campaign=:id<br/>add tracking, courier slip<br/>POST /shipment/update"]
    SHIP -->|no| WAIT
    TRACK --> WAIT["Creator delivers<br/>→ status=work_submitted"]
    WAIT --> WR["/work-review/:id (WorkReview)<br/>watermarked preview"]
    WR --> DEC{Decision}
    DEC -->|request revision| RVN["POST /work/:id/request-revision<br/>(1st 2 free, then ₹500)"]
    RVN --> WAIT
    DEC -->|approve| APP["POST /work/:id/approve<br/>→ escrow released to creator<br/>→ status=completed"]
    APP --> RATE["Leave 1–5★ review<br/>POST /reviews"]
    APP --> OWN["Brand owns clean content"]

    PATH -->|"Path B — BUY GIG"| BG["/browse-approved-gigs"]
    BG --> GD["/gig/:gigId (GigDetailsPage)<br/>pick package + duration"]
    GD --> CONT["'Continue' → toast() only<br/>❌ no order, no payment"]

    style REJ fill:#5c1a1a,color:#fff
    style FUNDX fill:#7f4f00,color:#fff
    style CONT fill:#7f4f00,color:#fff
    style APP fill:#1b5e20,color:#fff
```

> **Important reconciliation:** Frontend `AdminCampaigns.js` implies an admin *approves* briefs, but the **backend auto-publishes** briefs on submit (`server.py:3576-3577`, status → `active`, reason "auto-published"). So the brief approval gate is **legacy/inactive**. Gigs, by contrast, **do** require admin approval.

### A.2 Screens & sub-pages

| Area | Screen / sub-page | What the brand does | Key API(s) |
|---|---|---|---|
| Landing | `Landing.js` | Marketing, signup | — |
| Profile | `BusinessProfileSetup.js` | Business details + GSTIN | `PUT /profile/business` |
| Welcome | `BrandWelcomePage.js` | Status, curated gigs, search | `GET /campaigns`, `/gigs?status=approved`, `/categories` |
| Overview | `BusinessDashboard page="overview"` | Metrics, performance chart, creator funnel, active deals | `GET /business/dashboard`, `/campaigns` |
| Post brief | `PostABrief.js` (8 steps) | Basics → deliverables → must-include → must-avoid → style → usage rights → timeline/budget → review/publish | `POST /campaigns/draft`, `PATCH /campaigns/:id`, `POST /campaigns/:id/submit` |
| Bids | `page="pending-bids"` | Review bids; view profile; chat; select | `GET /campaigns`; `POST /campaigns/:id/select-creator` |
| Shortlist | `CampaignDetails.js` | View ops shortlist, invite, request new | `GET /campaigns/:id/shortlist`; `POST …/invite`, `…/request-new` |
| Browse creators | `page="browse-creator"` | Directory w/ filters; invite | `GET /business/creator-directory`; `POST …/:id/invite` |
| Browse gigs | `BrowseApprovedGigs.js` | Filter approved gigs | `GET /gigs?status=approved` |
| Gig detail | `GigDetailsPage.js` | Package/duration; wishlist; (buy = stub) | `GET /gigs/:id`, `/profile/:creatorId`, `/reviews/creator/:id`; `POST /gigs/:id/wishlist` |
| Work review | `WorkReview.js` | Approve / request revision; rate | `GET /work/:id`; `POST /work/:id/approve`, `…/request-revision`; `POST /reviews` |
| Shipments | `page="shipments"` + `ShipmentTracking.js` | Add tracking, checklist, view unboxing | `GET /shipment/:campaignId`; `POST /shipment/update` |
| Wallet | `page="wallet"` | Balance, recharge, transactions | `GET /business/wallet`; `POST /business/wallet/recharge` |
| All campaigns | `page="all-campaigns"` | List/manage campaigns + drafts | `GET /campaigns`, `?status=draft` |

### A.3 Brand state — what actually transitions

```mermaid
stateDiagram-v2
    [*] --> Pending: PUT /profile/business
    Pending --> Approved: admin approve
    Pending --> Rejected: admin reject
    Approved --> Funded: wallet recharge

    Funded --> Draft: POST /campaigns/draft
    Draft --> Active: submit (auto-publish)
    Active --> InProgress: select-creator (escrow held)
    InProgress --> WorkSubmitted: creator delivers
    WorkSubmitted --> Revision: request-revision
    Revision --> WorkSubmitted: creator resubmits
    WorkSubmitted --> Completed: approve (escrow released)
    Completed --> [*]
```

### A.4 Gaps & dead-ends (current)

| # | Gap | Where | Impact |
|---|---|---|---|
| 1 | **Wallet recharge not fully wired** to Razorpay SDK | `BusinessDashboard.js:531` | Brands can't reliably add funds |
| 2 | **Gig purchase (Path B) is a stub** — "Continue" only toasts | `GigDetailsPage.js:261` | Entire direct-buy channel non-functional |
| 3 | **Contact-creator from gig browse** is a toast stub | `BrowseApprovedGigs.js:124` | Can't initiate from gig |
| 4 | **Creator-directory** may 404 if backend missing | `BusinessDashboard.js:439` | Browse-creator empty |
| 5 | **Escrow funding ambiguity** — escrow created on select-creator but wallet debit timing unclear vs recharge | backend | Reconciliation risk |
| 6 | **Brief approval is legacy** — frontend admin approval contradicts backend auto-publish | `AdminCampaigns.js` vs `server.py:3576` | Confusing/dead admin path |
| 7 | **Dispute from brand side** skeletal in shipment | `ShipmentTracking.js:310` | No resolution path UI |
| 8 | **No campaign performance after-the-fact** (views, ROAS) | overview | Limited proof of value |

---

## PART B — IDEAL (TO-BE) FLOW

### B.1 Production-grade brand journey

```mermaid
flowchart TD
    L["/ landing + ROI proof"] --> SU["Signup (email/Google/SSO)"]
    SU --> PS["Business profile + GST verify (API)<br/>+ domain email verify"]
    PS --> KYB["Automated KYB checks<br/>(GST validity, restricted-category screen)"]
    KYB --> GATE{Risk tier}
    GATE -->|clear| FAST[Auto-approve]
    GATE -->|review| OPS[Ops review <24h]
    GATE -->|reject| FIX["Reject w/ reason + re-apply ✅"]
    FIX --> PS
    FAST --> HOME
    OPS --> HOME["Dashboard: spend, performance,<br/>content library, ROAS"]

    HOME --> FUND["Wallet (real Razorpay/Cashfree)<br/>auto-invoice + GST credit note"]
    FUND --> SOURCE{Source content}

    SOURCE -->|A Post brief| PB["Guided brief builder<br/>+ budget recommender + templates"]
    PB --> MATCHENG["Matching engine:<br/>auto-shortlist by fit score"]
    MATCHENG --> CHOOSE["Review bids/shortlist<br/>side-by-side compare"]

    SOURCE -->|B Buy gig| GIG["Gig storefront → package →<br/>CHECKOUT (wired) → escrow"]
    SOURCE -->|C Invite| DIR["Creator directory →<br/>direct invite/offer"]

    CHOOSE --> AWARD["Award + auto-escrow hold<br/>(funds verified in wallet)"]
    GIG --> AWARD
    DIR --> AWARD

    AWARD --> SHIPQ{Physical product?}
    SHIPQ -->|yes| LOG["Logistics: auto-label (Shiprocket),<br/>live tracking, auto receipt confirm"]
    SHIPQ -->|no| MON
    LOG --> MON["Deal room (real-time):<br/>milestones, drafts, chat"]
    MON --> REVIEW["Review w/ compliance summary<br/>(brief adherence auto-scored)"]
    REVIEW --> DEC{Decide}
    DEC -->|"revision — paid past free tier"| MON
    DEC -->|approve / auto-SLA| RELEASE["Release escrow − fees<br/>→ creator paid, brand gets clean assets"]
    RELEASE --> LIB["Content library + usage-rights<br/>tracking + license expiry alerts"]
    RELEASE --> RATE["Two-way rating"]
    LIB --> PERF["Performance & ROAS analytics"]

    style FIX fill:#1b5e20,color:#fff
    style GIG fill:#1b5e20,color:#fff
    style RELEASE fill:#1b5e20,color:#fff
```

### B.2 Current → ideal delta

| Area | Current | Ideal |
|---|---|---|
| Onboarding | Manual GSTIN text field | GST verified via API; KYB auto-screen; reject-with-fix loop |
| Wallet | Recharge stub | Live payments + auto GST invoices/credit notes |
| Gig channel | Browse only (no buy) | Full storefront → checkout → escrow → delivery |
| Matching | Manual ops shortlist or raw bids | Fit-score matching engine + side-by-side bid compare |
| Escrow | Created on select, debit timing fuzzy | Verified hold against funded wallet; clear ledger |
| Shipping | Manual tracking entry | Auto-label + live tracking + auto receipt |
| Review | Watermark preview, manual judgment | Auto compliance score vs brief; structured feedback |
| Post-sale | None | Content library, usage-rights/license tracking, ROAS |
| Approval gate | Legacy/contradictory | Removed for briefs (consistent) or risk-based moderation |

### B.3 Ideal brand state machine

```mermaid
stateDiagram-v2
    [*] --> KYB
    KYB --> Active: approve/auto
    KYB --> NeedsFix: reject
    NeedsFix --> KYB
    Active --> Funded: wallet topped (real payment)
    Funded --> Sourcing: brief / gig / invite
    Sourcing --> Awarded: award (escrow verified-hold)
    Awarded --> InProduction: (+logistics if physical)
    InProduction --> Reviewing: creator submits (auto-compliance)
    Reviewing --> InProduction: revision
    Reviewing --> Completed: approve/auto-SLA (escrow released)
    Reviewing --> Disputed: dispute
    Disputed --> Completed: ruling
    Completed --> Library: assets + license tracking
    Library --> [*]
```
