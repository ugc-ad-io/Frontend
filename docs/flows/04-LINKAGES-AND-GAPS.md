# Linkages, Dependencies & Production Roadmap

> How the three sides connect, what each side **depends on** from the others, where the chain **breaks today**, and the prioritized path to a production-grade platform.

---

## 1. The full cross-role lifecycle (Model A — Briefs, the live path)

This is the canonical end-to-end sequence that all three actors participate in.

```mermaid
sequenceDiagram
    autonumber
    actor B as 🏢 Brand
    participant SYS as Platform/Escrow
    actor A as 🛡️ Admin/Ops
    actor C as 🎬 Creator

    Note over B,C: ── ONBOARDING (gated by Admin) ──
    B->>SYS: PUT /profile/business (pending)
    C->>SYS: PUT /profile/creator (pending)
    A->>SYS: approve creator & brand KYC
    SYS-->>B: approved
    SYS-->>C: approved

    Note over B,C: ── BRIEF & MATCHING ──
    B->>SYS: recharge wallet
    B->>SYS: POST /campaigns/draft → submit (auto-active)
    C->>SYS: GET /campaigns (discover)
    C->>SYS: POST /campaigns/:id/bid
    opt Request matches
        B->>A: request shortlist
        A->>SYS: curate shortlist
        SYS-->>B: shortlist
    end
    B->>SYS: select-creator → ESCROW HELD (in_progress)
    SYS-->>C: you won the deal

    Note over B,C: ── DELIVERY ──
    opt requires_shipment
        B->>SYS: POST /shipment/update (tracking)
        A-->>SYS: label/ship if exception (4h SLA)
        C->>SYS: POST /receipt (unboxing, Mark Received)
    end
    C->>SYS: POST /work/submit (work_submitted, watermarked)
    B->>SYS: GET /work/:id (review)
    alt revision
        B->>SYS: request-revision (free×2, then ₹500)
        C->>SYS: resubmit
    else approve / auto @5d
        B->>SYS: POST /work/:id/approve
        SYS->>SYS: schedule_payout (− TDS − penalty)
        SYS-->>C: escrow released → wallet ↑ (completed)
        B->>SYS: POST /reviews (rate creator)
    end

    Note over B,C: ── EXCEPTIONS & MONEY OUT ──
    opt dispute
        C->>SYS: raise-dispute (escrow on_hold)
        A->>SYS: rule (favor_creator/brand/split)
        SYS-->>SYS: release or refund
    end
    C->>SYS: POST /withdrawal/request
    A->>SYS: approve withdrawal
    SYS-->>C: 🏦 payout to bank/UPI
```

---

## 2. Dependency matrix — who depends on whom

| This step… | …is blocked until | Owner | Cross-dependency |
|---|---|---|---|
| Creator can bid | creator `approval_status=approved` | Admin | **Creator → Admin** |
| Brand can post brief | brand `approval_status=approved` | Admin | **Brand → Admin** |
| Creator can be paid | brand funded wallet + selected + approved work | Brand | **Creator → Brand** |
| Brief visible to creators | brief submitted (auto-publish) | Brand | **Creator → Brand** |
| Gig visible to brands | gig `approved` | Admin | **Creator → Admin** |
| Escrow released | brand approves OR 5-day auto-approve | Brand/System | **Creator → Brand/System** |
| Withdrawal paid | admin approves withdrawal | Admin | **Creator → Admin** |
| Shipment received gate | brand ships + creator confirms | Brand+Creator | **mutual** |
| Dispute resolved | admin ruling (within role money-cap) | Admin | **Brand+Creator → Admin** |
| Chat stays open | brand wallet ≥ min_chat_balance (₹5K) | Brand | **Creator ↔ Brand → Brand wallet** |

### Dependency graph

```mermaid
flowchart LR
    ADMIN[🛡️ Admin] -->|approves| CREATOR[🎬 Creator]
    ADMIN -->|approves| BRAND[🏢 Brand]
    ADMIN -->|approves gigs| CREATOR
    ADMIN -->|approves withdrawals| CREATOR
    ADMIN -->|rules disputes| CREATOR
    ADMIN -->|rules disputes| BRAND
    BRAND -->|funds escrow, approves work| CREATOR
    CREATOR -->|delivers content| BRAND
    BRAND -->|posts briefs| CREATOR
    CREATOR -->|lists gigs ⚠️ dead-end| BRAND
    ADMIN -->|sets economics| ESCROW[(Escrow/Wallet)]
    BRAND --> ESCROW
    ESCROW --> CREATOR

    style CREATOR fill:#1a3a5c,color:#fff
    style BRAND fill:#1a3a5c,color:#fff
    style ADMIN fill:#3a1a5c,color:#fff
```

**Critical-path insight:** the Admin gates **both ends of supply and demand** *and* the money exit. Any latency in KYC approval, dispute ruling, or withdrawal approval directly throttles GMV. This is the #1 reason the ideal flow (file `03`) pushes for **risk-tiered automation** of these gates.

---

## 3. Where the chain breaks today (consolidated gap register)

| Severity | Gap | Side | File / ref | Consequence |
|---|---|---|---|---|
| 🔴 Critical | **Gig checkout unimplemented** (Model B) | Brand+Creator | `GigDetailsPage.js:261` | Half the marketplace (creator-initiated) earns ₹0 |
| 🔴 Critical | **Wallet recharge not fully wired** to gateway | Brand | `BusinessDashboard.js:531` | Brands struggle to fund → no escrow → no deals |
| 🔴 Critical | **Withdrawal & payout fully manual** | Creator+Admin | `server.py:6988` | Ops bottleneck; slow creator payouts |
| 🟠 High | **Legacy brief-approval vs auto-publish** mismatch | Brand+Admin | `AdminCampaigns.js` vs `server.py:3576` | Dead admin path; no brief quality control |
| 🟠 High | **No real-time** (10s polling everywhere) | All | most pages | Laggy deal room/chat, stale data |
| 🟠 High | **Reject = dead end** (creator & brand) | Creator+Brand | dashboards | Lost supply/demand, no appeal |
| 🟠 High | **Shipping labels manual** | Admin | `AdminShipping.js:147` | SLA risk, ops toil |
| 🟡 Medium | **Dummy analytics** (earnings chart, some metrics) | Creator+Brand | dashboards | Misleading; no real proof of value |
| 🟡 Medium | **Creator-directory may 404** | Brand | `BusinessDashboard.js:439` | Browse-creator empty |
| 🟡 Medium | **Dispute vs escalate ambiguity** | Creator | `MyDealsPage.js:367` | Mis-routed exceptions |
| 🟡 Medium | **Redundant/duplicate admin surfaces** | Admin | AdminCampaigns/AllCampaigns; GigMgmt/Applications | Maintenance + confusion |
| 🟢 Low | Google sign-up stub; settings/messages thin | All | `CreatorSignup.js:53` | Minor friction |

---

## 4. AS-IS vs TO-BE at a glance (per side)

```mermaid
flowchart LR
    subgraph NOW["AS-IS (today)"]
        N1[Manual KYC gates]
        N2[Briefs only — gigs dead]
        N3[Polling, no realtime]
        N4[Manual money in & out]
        N5[Reactive ops, dummy analytics]
    end
    subgraph IDEAL["TO-BE (production)"]
        I1[Risk-tiered auto KYC]
        I2[Both channels transactional]
        I3[Realtime deal room + chat]
        I4[Automated payment + payout rails]
        I5[Risk engine + live dashboards]
    end
    N1 --> I1
    N2 --> I2
    N3 --> I3
    N4 --> I4
    N5 --> I5
```

---

## 5. Prioritized roadmap to production

```mermaid
flowchart TD
    P0["PHASE 0 — Make the money move<br/>① Wire wallet recharge to Razorpay/Cashfree<br/>② Implement gig checkout → escrow (Model B)<br/>③ Automate payouts (RazorpayX/Cashfree Payouts)"]
    P1["PHASE 1 — Close the dead-ends<br/>④ Reject→re-apply/appeal loops (creator & brand)<br/>⑤ Resolve brief-approval contradiction (pick one)<br/>⑥ Fix creator-directory; remove duplicate admin pages"]
    P2["PHASE 2 — Real-time & trust<br/>⑦ WebSocket/SSE deal room + chat + notifications<br/>⑧ Auto compliance check (submission vs brief)<br/>⑨ Shiprocket API auto-label + webhook tracking"]
    P3["PHASE 3 — Scale ops with intelligence<br/>⑩ Risk/fraud scoring feeding all gates<br/>⑪ Unified SLA ops inbox + dual-control on money<br/>⑫ Real analytics/ROAS, matching engine, content library"]

    P0 --> P1 --> P2 --> P3

    style P0 fill:#5c1a1a,color:#fff
    style P1 fill:#7f4f00,color:#fff
    style P2 fill:#1a3a5c,color:#fff
    style P3 fill:#1b5e20,color:#fff
```

| Phase | Theme | Why first | Unblocks |
|---|---|---|---|
| **0** | Money plumbing | Without funding + payout + gig checkout, the marketplace can't transact at scale | All revenue |
| **1** | Remove dead-ends & contradictions | Stops silent supply/demand leakage and confusion | Conversion, data integrity |
| **2** | Real-time + trust automation | UX parity with competitors; reduces disputes | Retention, lower dispute rate |
| **3** | Ops intelligence | Lets the team scale GMV without linear headcount | Margin, throughput |

---

## 6. One-page mental model

```mermaid
flowchart TB
    subgraph SUPPLY["SUPPLY — Creator"]
        direction TB
        c1[Onboard] --> c2[Win work] --> c3[Deliver] --> c4[Get paid]
    end
    subgraph TRUST["TRUST — Admin/Ops + Escrow"]
        direction TB
        a1[Gate identity] --> a2[Hold money] --> a3[Resolve conflict] --> a4[Release money]
    end
    subgraph DEMAND["DEMAND — Brand"]
        direction TB
        b1[Onboard+fund] --> b2[Source content] --> b3[Review] --> b4[Own content]
    end

    SUPPLY <--> TRUST <--> DEMAND
```

> **The product in one sentence:** Admin **gates trust and holds money** so that Brands can **source content with confidence** and Creators can **get paid reliably** — and the path to production is to **automate that trust + money machinery** so it works without a human on every step.
