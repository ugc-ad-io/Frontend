
# UGCad.io — Platform Flow Documentation

> **Purpose:** A complete map of the software's flows across **Creator**, **Brand (Business)**, and **Admin** sides — both the **AS-IS (current, implemented)** flows and the **TO-BE (ideal, production-grade)** flows — plus the linkages and dependencies between them.
>
> **Source of truth:** Backend = `Backend/server.py` (FastAPI, ~9.1k lines) + `campaign_models.py`, `campaign_helpers.py`, `gigs.py`, `creator_features.py`, `storage.py`. Frontend = `C:\Users\meetr\Frontend\src` (React, react-router, axios).

## Document index

| File | Contents |
|------|----------|
| `00-OVERVIEW.md` (this) | System map, roles, entities, the two acquisition models, status vocabulawry |
| `01-CREATOR-FLOW.md` | Creator side — current vs ideal |
| `02-BRAND-FLOW.md` | Brand/Business side — current vs ideal |
| `03-ADMIN-FLOW.md` | Admin/Ops side — current vs ideal |
| `04-LINKAGES-AND-GAPS.md` | Cross-role linkages, dependency matrix, gap analysis & production roadmap |

> **Rendering note:** Diagrams are written in **Mermaid**. They render natively on GitHub, in VS Code (with a Mermaid preview extension), Obsidian, and most Markdown viewers.

---

## 1. What the product is

A **UGC (User-Generated Content) marketplace** connecting **Brands** that need short-form video content with **Creators** who produce it, mediated by an **Ops/Admin** team that gates trust, holds money in **escrow**, and resolves disputes.

It is an **India-first** platform: rupee (₹) pricing, GST validation on brand onboarding, **TDS** (Tax Deducted at Source) on creator payouts, and Razorpay/Cashfree payment rails.

### The three actors (+ ops sub-roles)

```mermaid
flowchart LR
    subgraph Demand
        B[🏢 Brand / Business<br/>role: business]
    end
    subgraph Platform
        A[🛡️ Admin / Ops<br/>admin · campaign_manager · support_staff]
        E[(💰 Escrow + Wallets)]
    end
    subgraph Supply
        C[🎬 Creator<br/>role: creator]
    end

    B -- "posts briefs / buys gigs / funds wallet" --> Platform
    C -- "bids / creates gigs / delivers content" --> Platform
    A -- "approves, moderates, rules disputes, releases money" --> E
    B <-- "matched & transacts with" --> C
```

| Role (backend value) | Who | Core job |
|---|---|---|
| `creator` | Content creator | Build profile → win work → deliver → get paid |
| `business` | Brand | Fund wallet → source content → review → approve → own the content |
| `admin` | Founder / super-admin | Everything, incl. money, bans, settings, roles |
| `campaign_manager` | Ops (senior) | Approvals, shortlists, disputes (capped), payouts |
| `support_staff` | Ops (regular) | Approvals, moderation, lower-authority ops |

> **Permission model** lives in `utils/adminRoles.js` (frontend gating) and `OPS_ROLES` in `server.py:3776` (backend enforcement). Capability-based: `can(user, capability)`. Dispute authority is **money-capped** by role (Ops Regular ₹25K, Ops Senior ₹1L, Founder unlimited).

---

## 2. The two acquisition models (critical to understand)

The platform supports **two parallel ways** a brand and creator transact. Understanding the difference is the key to the whole system.

```mermaid
flowchart TD
    Start([Brand needs content]) --> Choice{Which model?}

    Choice -->|"Model A — BRIEF<br/>(brand-initiated)"| A1[Brand posts a campaign brief]
    A1 --> A2[Creators discover & BID]
    A2 --> A3[Brand selects a bid]
    A3 --> A4[Escrow held → work → approve → pay]
    A4 --> AStatus[✅ FULLY IMPLEMENTED end-to-end]

    Choice -->|"Model B — GIG<br/>(creator-initiated)"| G1[Creator lists a gig/service]
    G1 --> G2[Admin approves the gig]
    G2 --> G3[Brand browses & opens gig]
    G3 --> G4[Brand selects package + duration]
    G4 --> G5[Checkout / order]
    G5 --> GStatus[⚠️ INCOMPLETE — checkout is a stub<br/>no order persisted, no escrow]

    style AStatus fill:#1b5e20,color:#fff
    style GStatus fill:#7f4f00,color:#fff
```

| | **Model A — Campaigns / Briefs** | **Model B — Gigs** |
|---|---|---|
| Initiated by | Brand | Creator |
| Discovery | Creators browse briefs (`BrowseBriefs`) | Brands browse gigs (`BrowseApprovedGigs`) |
| Matching | Bidding **or** ops-curated shortlist | Direct selection of a gig package |
| Admin gate | **None today** — briefs auto-publish (`server.py:3576`) | **Yes** — gig needs `approve` (`gigs.py`) |
| Money / escrow | ✅ Full escrow, TDS, payout, disputes | ❌ Not wired — purchase is a `toast()` stub (`GigDetailsPage.js:261`) |
| Status | **LIVE & complete** | **PARTIAL** — listing + approval + wishlist only |

> **Takeaway:** Today the platform effectively runs on **Model A (Briefs)**. Model B (Gigs) is a half-built second channel: creators can list, admins can approve, brands can browse/wishlist — but **no brand can actually buy a gig** because checkout is unimplemented.

---

## 3. Core entities & relationships

```mermaid
erDiagram
    USER ||--o{ CAMPAIGN : "owns (brand)"
    USER ||--o{ GIG : "owns (creator)"
    USER ||--o{ BID : "submits (creator)"
    CAMPAIGN ||--o{ BID : "receives"
    CAMPAIGN ||--|| ESCROW : "funds on select-creator"
    CAMPAIGN ||--o{ WORK_SUBMISSION : "has"
    CAMPAIGN ||--o| SHIPMENT : "may require"
    CAMPAIGN ||--o{ DISPUTE : "may raise"
    ESCROW ||--o| PAYOUT_RECEIPT : "produces on release"
    USER ||--o{ WITHDRAWAL : "requests (creator)"
    USER ||--|| WALLET : "has balance + ledger"
    CAMPAIGN ||--o{ CHAT_MESSAGE : "deal thread"
    USER ||--o{ REVIEW : "gives/receives"
    USER ||--o{ APPLICATION : "submits KYC"

    USER {
        string role "creator|business|admin|campaign_manager|support_staff"
        string approval_status "pending|approved|rejected"
        float balance "wallet"
    }
    CAMPAIGN {
        string status "draft|active|in_progress|work_submitted|completed"
        string selected_creator
        bool requires_shipment
    }
    GIG {
        string status "pending_approval|approved|rejected"
    }
    ESCROW {
        string status "held|on_hold|released|refunded|disputed"
        string payout_status "held|scheduled|released|refunded"
    }
    WORK_SUBMISSION {
        string status "submitted|revision_requested|approved"
    }
    WITHDRAWAL {
        string status "pending|processing|completed|rejected"
    }
    DISPUTE {
        string status "open|info_requested|appealed|resolved|closed"
    }
```

---

## 4. Status vocabulary (the state machines at a glance)

These statuses drive every screen. Full transition diagrams live in each role file; this is the master reference.

| Entity | States | Source |
|---|---|---|
| **User approval** | `pending → approved \| rejected` (rejected → re-apply) | `server.py:157-165`, `:6664` |
| **Application (KYC)** | `pending → more_info → approved \| rejected` | `applications.py:28-32` |
| **Campaign/Brief** | `draft → active → in_progress → work_submitted → completed` (`rejected` legacy) | `campaign_models.py:9-15` |
| **Gig** | `pending_approval → approved \| rejected` (`in_progress`,`completed`,`cancelled` future) | `gigs.py:46-52` |
| **Bid** | `pending → accepted (becomes selected_creator) \| rejected/lapsed` | `server.py /bid`, `/select-creator` |
| **Work submission** | `submitted → approved \| revision_requested → submitted …` (auto-approve @5d) | `server.py:171-175`, `:5434` |
| **Escrow** | `held → on_hold → released \| refunded \| disputed` | `server.py:4163`, `:5399`, `:5960` |
| **Payout (within escrow)** | `held → scheduled → released \| refunded` | `server.py:5322`, `:5384` |
| **Withdrawal** | `pending → processing → completed \| rejected` | `server.py:177-181`, `:6988` |
| **Shipment** | `pending → shipped/in_transit → delivered → received` (+ `disputed`) | `server.py:1307`, `:6484` |
| **Dispute** | `open → info_requested → appealed → resolved → closed` | `server.py:6012-6276` |
| **User account** | `active → suspended → banned` | `server.py:6924` |

---

## 5. The money flow (one picture)

```mermaid
flowchart LR
    BR[🏢 Brand] -->|"1 Recharge<br/>Razorpay/Cashfree"| W[(Brand Wallet<br/>balance)]
    W -->|"2 select-creator<br/>amount locked"| ES[(Escrow<br/>status=held)]
    ES -->|"3 work approved<br/>schedule_payout"| SCH[Escrow<br/>payout=scheduled<br/>− TDS − penalty]
    SCH -->|"4 release on schedule<br/>(or auto @5d)"| CW[(Creator Wallet<br/>balance ↑)]
    CW -->|"5 withdraw request"| WD[Withdrawal<br/>pending]
    WD -->|"6 admin approve"| BANK[🏦 Creator bank/UPI]

    ES -.->|"dispute → brand wins"| REF[(Refund to<br/>Brand Wallet)]

    style ES fill:#1a3a5c,color:#fff
    style SCH fill:#1a3a5c,color:#fff
```

**Key facts (verified in code):**
- Platform commission ≈ **20–25%** + **₹500 listing fee** per brief (`AdminSettings`, PostABrief Step 7).
- **Revisions:** first 2 free; ₹500 each after; admin escalation past 5 (`creator_features.py`, `server.py:5610`).
- **Late delivery penalty** ladder: minor 5% / moderate 10% / severe 15% (`server.py:5222`, `:5474`).
- **Auto-approval:** unreviewed work auto-approves & pays creator after **5 days** (`server.py:5434`).
- **TDS** withheld on payout unless `creator.tds_exempt` (`server.py:5322`).
- Payout speed tiered by creator level (New 12d → Elite 48h).

---

## 6. How to read the role files

Each of `01`/`02`/`03` is structured identically:

1. **Current (AS-IS) journey** — ordered steps + flowchart + the real screens/APIs.
2. **Current state machine** — what actually transitions today.
3. **Gaps & dead-ends** — what's stubbed, broken, or missing.
4. **Ideal (TO-BE) journey** — production-grade flow with the gaps closed.
5. **AS-IS vs TO-BE delta table.**

`04` ties it together: the cross-role sequence diagrams, the dependency matrix, and the prioritized roadmap to production.
