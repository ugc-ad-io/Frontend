# Creator Side — Flow (Current vs Ideal)

> Role: `creator`. Entry landing: `/creator`. Gated by `approval_status === 'approved'`.

---

## PART A — CURRENT (AS-IS) FLOW

### A.1 End-to-end journey (current)

```mermaid
flowchart TD
    L["/creator landing"] --> SU["/auth signup<br/>email + password<br/>POST /auth/signup"]
    SU --> PS["/profile-setup/creator<br/>4-step wizard"]
    PS -->|"PUT /profile/creator<br/>profile_completed=true"| PEND[approval_status = pending]
    PEND --> GATE{Admin decision}
    GATE -->|rejected| REJ["Dashboard shows<br/>'Not Approved — contact support'<br/>❌ dead end"]
    GATE -->|approved| DASH["/dashboard/creator<br/>full access"]

    DASH --> PATHS{Find work}

    PATHS -->|"Path 1 — BID"| BB["/browse-briefs<br/>GET /campaigns (poll 10s)"]
    BB --> BID["Pitch modal<br/>POST /campaigns/:id/bid"]
    BID --> MB["/my-bids<br/>GET /bids/my"]
    MB --> SEL{Brand selects me?}

    PATHS -->|"Path 2 — GIG"| CG["/create-gig<br/>POST /gigs → pending_approval"]
    CG --> GA{Admin approves gig?}
    GA -->|approved| LISTED["Gig visible to brands<br/>⚠️ but brands can't buy"]
    GA -->|rejected| CGX[Edit & resubmit]

    SEL -->|yes| DEAL["/my-deals — Deal Room<br/>GET /deals/my"]
    DEAL --> SHIP{Shipment required?}
    SHIP -->|yes| RCV["Upload unboxing video<br/>POST /deals/:id/receipt<br/>Mark Received"]
    SHIP -->|no| WORK
    RCV --> WORK["Create content<br/>POST /deals/:id/content<br/>→ work_submitted"]
    WORK --> REV{Brand reviews}
    REV -->|request revision| RVN["Revision tracker<br/>resubmit"]
    RVN --> WORK
    REV -->|approve| PAID["Escrow released → wallet ↑<br/>(or auto-approve @5d)"]
    PAID --> WD["/withdrawal<br/>POST /withdrawal/request"]
    WD --> WDADMIN{Admin approves}
    WDADMIN -->|yes| BANK[🏦 Money to bank/UPI]
    PAID --> RVW["/reviews — brand rates me"]
    PAID --> LVL["Creator level ↑<br/>faster payouts"]

    style REJ fill:#5c1a1a,color:#fff
    style LISTED fill:#7f4f00,color:#fff
    style PAID fill:#1b5e20,color:#fff
```

### A.2 Screens, what they do, key APIs

| Step | Screen (`src/pages`) | What the creator does | Key API(s) |
|---|---|---|---|
| Land | `CreatorLanding.js` | Marketing; CTA to signup | — (static) |
| Sign up | `CreatorSignup.js` | Email + password (Google = "coming soon" stub) | `POST /auth/signup` |
| Profile | `CreatorProfileSetup.js` | 4 steps: basics → contact → portfolio/skills/socials/languages → equipment/availability/rate | `POST /upload/file`, `PUT /profile/creator` |
| Dashboard | `CreatorDashboard.js` | Stats, level banner, active campaigns, earnings chart; **blocked until approved** | `GET /campaigns`, `/reviews/creator/:id`, `/auth/me` |
| Find work A | `BrowseBriefs.js` | Filter briefs (search, category, payout range, match score), **bid** | `GET /campaigns`, `/payout-ranges`; `POST /campaigns/:id/bid` |
| Bids | `MyBidsPage.js` | Track pending bids | `GET /bids/my` |
| Find work B | `CreateGig.js` | Create a service listing (title, category, budget, deadline, niches, styles, platforms, attachments) | `POST /gigs` |
| Deal room | `MyDealsPage.js` | The core workspace: brief, activity feed, shipment receipt, content submission, revisions, chat, payout summary | `GET /deals/my`; `POST /deals/:id/{receipt,content,chat,revision-response,damage-report,dispute,escalate}` |
| Active work | `MyActiveWorkPage.js` | Filtered list of assigned campaigns | `GET /campaigns` |
| Submit | `WorkSubmission.js` | Upload deliverables | `POST /work/submit` |
| Portfolio | `PortfolioPage.js` | Add/remove showcase items | `PATCH /profile/portfolio` |
| Reviews | `ReviewsPage.js` | Read brand ratings | `GET /reviews/creator/:id` |
| Payout | `WithdrawalPage.js` / `PayoutWithLayout.js` | KPIs, payment history, bank details, **request withdrawal** | `GET /payout/overview`, `/withdrawal/history`; `POST /withdrawal/request` |

### A.3 Creator state — what actually transitions

```mermaid
stateDiagram-v2
    [*] --> ProfilePending: signup + PUT /profile/creator
    ProfilePending --> Approved: admin approve-profile
    ProfilePending --> Rejected: admin reject
    Rejected --> [*]: dead end (contact support)

    Approved --> Bidding: POST /campaigns/:id/bid
    Bidding --> Selected: brand select-creator
    Selected --> AwaitReceipt: if requires_shipment
    Selected --> InProgress: if no shipment
    AwaitReceipt --> InProgress: POST /receipt (Mark Received)
    InProgress --> Submitted: POST /content (work_submitted)
    Submitted --> Revision: brand request-revision
    Revision --> Submitted: resubmit
    Submitted --> ApprovedWork: brand approve OR auto @5d
    ApprovedWork --> Paid: escrow released → balance↑
    Paid --> Withdrawn: withdrawal approved
    Withdrawn --> [*]
```

### A.4 Gaps & dead-ends (current)

| # | Gap | Where | Impact |
|---|---|---|---|
| 1 | **Google sign-up** is a toast stub | `CreatorSignup.js:53` | Only email/password works |
| 2 | **Gig channel dead for creators** — they can list & get approved, but no brand can buy | `CreateGig.js` + `GigDetailsPage.js:261` | Wasted effort; Model B is a dead end |
| 3 | **Rejected profile = hard dead end** — no re-apply / appeal UI | `CreatorDashboard.js` | Lost supply |
| 4 | **`/messages` & `/settings`** referenced in nav, thin/partial pages | nav links | Confusing navigation |
| 5 | **No real-time** — everything polls every 10s (`t=Date.now()`) | most pages | Laggy deal room & chat |
| 6 | **Dispute vs Escalate** both hit similar endpoints | `MyDealsPage.js:367` | Ambiguous creator intent |
| 7 | **Earnings chart is dummy data** (Jan–Jun hardcoded) | `CreatorDashboard.js` | Misleading metric |
| 8 | **Portfolio has no in-place edit / versioning** | `PortfolioPage.js` | Limited curation |
| 9 | **No onboarding nudge** between approval and first bid | flow gap | Slow time-to-first-bid |

---

## PART B — IDEAL (TO-BE) FLOW

### B.1 Production-grade creator journey

```mermaid
flowchart TD
    L["/creator landing<br/>+ social proof, earnings calculator"] --> SU["Signup<br/>email · Google · phone OTP"]
    SU --> VERIFY["Email + phone verification"]
    VERIFY --> PS["Guided profile builder<br/>w/ completeness meter + examples"]
    PS --> KYC["KYC + payout setup<br/>(PAN, bank, optional video intro)"]
    KYC --> AUTOCHK["Automated pre-checks<br/>(handle-vs-realname, dup account,<br/>portfolio quality score)"]
    AUTOCHK --> GATE{Risk-tiered review}
    GATE -->|low risk| FAST[Auto-approve in minutes]
    GATE -->|needs review| MAN[Ops review < 24h SLA]
    GATE -->|reject| APPEAL["Reject w/ reason + 1-click<br/>fix & re-apply ✅ (not dead end)"]
    APPEAL --> PS

    FAST --> ONB
    MAN --> ONB["Onboarding checklist<br/>(complete rate card, 1st portfolio,<br/>recommended briefs)"]
    ONB --> HOME["Home feed: ranked briefs<br/>by match score + invites"]

    HOME --> WORK{Acquire work}
    WORK -->|Bid on brief| BID["Smart bid w/ guidance<br/>(suggested price, win-rate hint)"]
    WORK -->|Gig sold| GIGSALE["Gig order received<br/>(Model B fully wired)"]
    WORK -->|Direct invite| INV["Brand/ops invite → accept"]

    BID --> DEAL
    GIGSALE --> DEAL
    INV --> DEAL["Unified Deal Room (real-time)<br/>brief · milestones · chat · files"]

    DEAL --> SHIP{Shipment?}
    SHIP -->|yes| TRACK["Live courier tracking +<br/>unboxing + auto-damage flow"]
    SHIP -->|no| PROD
    TRACK --> PROD["Content production<br/>milestones + draft preview"]
    PROD --> SUB["Submit (watermarked) +<br/>auto compliance check vs brief"]
    SUB --> REVW{Brand review}
    REVW -->|revision| PROD
    REVW -->|approve / auto @SLA| ESC["Escrow released<br/>transparent fee + TDS receipt"]
    ESC --> WALLET["Wallet + instant/scheduled payout<br/>by tier"]
    WALLET --> PAYOUT["Withdraw: auto-payout rails<br/>(RazorpayX) + status tracking"]
    ESC --> REP["Reputation engine:<br/>rating, level, badges, payout speed ↑"]
    REP --> HOME

    style APPEAL fill:#1b5e20,color:#fff
    style GIGSALE fill:#1b5e20,color:#fff
    style ESC fill:#1b5e20,color:#fff
```

### B.2 What changes from current → ideal

| Area | Current (AS-IS) | Ideal (TO-BE) |
|---|---|---|
| Auth | Email/password only; Google stub | Email + Google + phone OTP; verified email/phone |
| Approval | Manual binary, reject = dead end | Risk-tiered (auto-approve low risk), <24h SLA, reject-with-fix loop |
| Onboarding | Drop into empty dashboard | Checklist + recommended briefs + earnings calculator |
| Work discovery | Browse + poll; dummy match score | Ranked feed, real match score, invites, win-rate hints |
| Gig channel | Listing dead-ends (no checkout) | Fully transactional (order → escrow → deliver) |
| Deal room | 10s polling | Real-time (WebSocket/SSE), milestones, draft previews |
| Compliance | Manual; brand catches issues | Auto-check submission against brief must-include/avoid |
| Payouts | Manual admin approval per withdrawal | Automated payout rails (RazorpayX/Cashfree Payouts) + receipts |
| Reputation | Level by count; dummy chart | Real analytics, badges, transparent payout-speed ladder |
| Reject/Disputes | Hard dead ends | Appeal + guided resolution paths |

### B.3 Ideal creator state machine (adds the missing transitions)

```mermaid
stateDiagram-v2
    [*] --> Unverified
    Unverified --> Verified: email+phone OTP
    Verified --> AutoApproved: low-risk auto
    Verified --> InReview: needs ops
    InReview --> Active: approve
    InReview --> NeedsFix: reject w/ reason
    NeedsFix --> InReview: fix & resubmit
    AutoApproved --> Active

    Active --> Engaged: bid / gig-sale / invite
    Engaged --> Producing: deal won (+receipt if shipped)
    Producing --> InReview2: submit (auto-compliance pass)
    InReview2 --> Producing: revision
    InReview2 --> Settled: approve / auto-SLA
    Settled --> PaidOut: automated payout
    Settled --> Disputed: dispute raised
    Disputed --> Settled: ruling
    PaidOut --> Active: reputation updated
```
