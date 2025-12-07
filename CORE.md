# CORE.md — METERED Core Knowledge Base

> **Single source of truth** for what METERED is, where it’s going, and what’s actually being worked on.  
> For both **humans** (contributors, collaborators) and **agents** (AI tools, automation, scripts).

---

## 0. How to Use & Maintain This File

**This file MUST stay fresh.**  
Whenever you ship something, change direction, or kill an idea:

- ✅ Update the **Feature Status Table**
- ✅ Update the **Roadmap & Tasks** (mark done, move items, add new ones)
- ✅ Add links to new docs (architecture, API, product specs, etc.)

**At least once per month (or per sprint):**

1. Read this file top to bottom.
2. Ask: “What’s actually happening vs what’s written here?”
3. Update statuses and remove obviously dead items.
4. If something’s in “Upcoming” for >3 months with no motion, either:
   - move it to a “Someday/Maybe” section, or
   - recommit to it and give it an owner + target date.

> If it’s not in `CORE.md`, it’s not official.

---

## 1. What is METERED?

**METERED** is a **privacy-first calling and streaming platform** where:

- You get a **personal room link** (and stream link) you can share anywhere.
- People click that link to **call you or watch you**, right in the browser.
- **Only you, as the host**, can start your room or stream.
- It’s perfect for **quick, drop-in calls** *and* **scheduled sessions**:
  - Use your Metered link as the **location** in Google Calendar, Cal.com, Calendly, etc.
  - When it’s time, everyone joins via the same permanent room link.

The platform is evolving into **metered sessions**:

- Pay-per-minute or per-session
- Fair, transparent time tracking for calls and streams

There is a **public chatroom** where messages can become live sessions in one click, plus **widgets & embeds** so anyone can add “Call me on METERED” to their site.

Think of it as:

> “Your personal room link for private calls and streams — that works with your calendar and can meter your time.”

---

## 2. Mission, Vision, Goals

### 2.1 Mission

> **To turn real-time conversations into private, fair, and programmable sessions — for humans and AI agents — using a simple room link that fits how people already schedule their time.**

### 2.2 Vision

- A world where:
  - People and agents share **room links**, not phone numbers and cluttered meeting URLs.
  - Every meaningful call or stream can be **metered fairly** (by time or usage).
  - Communication infrastructure is **P2P-first**, **privacy-respecting**, and **agent-ready**.
  - **Organized users keep their calendars**; METERED becomes the room behind the invite.

METERED becomes the **real-time session layer**:

- For creators, coaches, NSFW workers, and experts who live off their minutes.
- For privacy-conscious communities who reject SIM/phone-number identity.
- For AI agents that need to negotiate, book, and join sessions in real time.
- For professionals who want a **stable, calendar-friendly room link**.

### 2.3 Goals

**12–18 Month Product Goals**

- Make personal **room and stream links**:
  - stable, easy to share, easy to remember
  - clearly better than “just use WhatsApp/Telegram/Zoom”.
- Ship **metered sessions**:
  - host sets rate (per minute / per session)
  - METERED tracks duration and presents a clear summary.
- Make METERED **calendar-friendly**:
  - Easy to use with Google Calendar, Cal.com, Calendly, etc.
  - Simple “Upcoming sessions” view for hosts inside METERED.
  - Friendly waiting-room for early guests.
- Provide simple **widgets & embeds**:
  - “Call me on METERED” buttons for websites, bios, and products.
- Migrate signaling from **Supabase → libp2p + WebRTC** for:
  - lower latency
  - better privacy story
  - “own your node” narrative at the infra/docs level, not in user-facing copy.

**12–18 Month Business Goals**

- Onboard **50–100 active hosts** using METERED at least weekly.
- Process meaningful GMV via **paid calls/streams**.
- Close **2–3 B2B / platform integrations** (communities, niche products, agent platforms).
- Secure at least one **non-dilutive grant** and 1–2 aligned angels/investors.

---

## 3. Core Product Pillars

1. **Personal Room & Stream Links**
   - Each host gets a stable room link and stream link.
   - That link is their “call me here” location across the internet.

2. **Private Calls & Streams**
   - Browser-based calls and streaming.
   - Host-only control over when the room starts and ends.

3. **Works With Your Calendar**
   - Use your METERED room link as the **location** in any scheduler (Google Calendar, Cal.com, Calendly).
   - Guests just click the same link at the agreed time.
   - METERED focuses on the **session**, not replacing full scheduling tools.

4. **Public Chatroom as Launchpad**
   - A lobby where users chat and share room/stream links.
   - Messages can become live sessions in one click.

5. **Metered Sessions (Time = Money)**
   - Optional metered mode for paid calls and streams.
   - Focused on fairness and simplicity for hosts and guests.

6. **Widgets & Embeds**
   - “Call me on METERED” buttons and floating widgets for websites and profiles.

7. **Agent & AI-Native (Under the Hood)**
   - Architecture designed so agents and automations can:
     - book sessions,
     - start calls,
     - manage metered billing.
   - libp2p + WebRTC + minimal infra — explained in deeper docs, not on the homepage.

---

## 4. Feature Status Table

> **Instructions:**  
> - Keep this table updated.  
> - Status values: `Done`, `WIP`, `Upcoming`, `Parked`.  
> - Add/remove features as priorities change.

| Feature                                  | Description                                                                      | Status   | Notes / Links                            |
| ---------------------------------------- | -------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| Personal room link                       | Each host has a stable room URL for calls.                                       | Done     | Implemented in prototype.                |
| Personal stream link                     | Each host has a stream URL for broadcasts.                                       | Done     | Initial streaming support present.       |
| Host-only start control                  | Only the host/owner of the link can start the room/stream.                       | Done     | Core security rule.                      |
| Public chatroom                          | Shared lobby where users chat and share meeting/stream links.                    | Done     | Messages → one-click sessions.           |
| Basic P2P WebRTC calling                 | Browser-based calls using WebRTC.                                                | Done/WIP | Stable but evolving UX/infra.            |
| Basic streaming                          | Browser-based streaming for multiple viewers.                                    | WIP      | Improve scalability & viewer UX.         |
| Supabase-based signaling                 | Using Supabase (DB/Realtime) for WebRTC signaling.                               | WIP      | Legacy; to be replaced.                  |
| libp2p-based signaling                   | Use libp2p + WebRTC transport + relay nodes for signaling & discovery.           | WIP      | Design in progress; implementation next. |
| “Use with calendar” support (docs & UX)  | Clear guidance & UI for using METERED with Google Calendar / Cal.com / Calendly. | WIP      | Copy + simple helpers (ICS, link).       |
| Light scheduling inside METERED          | Simple “schedule a time in this room” UI (not full calendar app).                | Upcoming | Keep minimal, calendar-aware.            |
| Waiting-room experience for early guests | Friendly screen if someone joins early via a scheduled link.                     | Upcoming | Show host name, time, simple info.       |
| Host “Today / Upcoming sessions” view    | List of upcoming sessions for a host tied to their room link(s).                 | Upcoming | No heavy scheduling; just overview.      |
| Metered sessions (time tracking)         | Track call duration for pay-per-minute/per-session use cases.                    | Upcoming | Design event model + UX.                 |
| Metered billing flows                    | Compute fees, show totals, integrate with payments (Stripe/crypto).              | Upcoming | Start simple: manual “mark as paid”.     |
| “Call Me on METERED” widget (HTML)       | Copy-paste button snippet that opens host’s room in new tab.                     | Done     | Snippet spec exists; share with hosts.   |
| Floating in-page call widget             | Optional floating circle button on sites.                                        | WIP      | Spec exists; integrate CDN or NPM.       |
| Creator/host dashboard                   | History, minutes, revenue, top sessions.                                         | Upcoming | After metered sessions v1.               |
| Multiple personas/profiles per host      | Allow hosts to manage multiple room identities.                                  | Upcoming | Important for NSFW / multi-identity.     |
| Agent/automation API                     | Programmatic session control for agents.                                         | Upcoming | Align with AGI/agent positioning.        |
| Integrations (widgets/embeds)            | Embedding rooms/streams into external sites & communities.                       | WIP      | Initial manual snippet; formalize later. |
| Recording & clip extraction              | Optional recording and clip creation.                                            | Parked   | Nice-to-have; privacy sensitive.         |
| Advanced privacy (Anon Mode, voice FX)   | Voice anonymization, avatar-only video, privacy presets.                         | Upcoming | Differentiator vs mainstream apps.       |
| Self-hostable relays / infra             | Allow communities to run their own libp2p relays & bootstrap nodes.              | Upcoming | Aligns with decentralization story.      |
| Pricing & billing backend                | Backend for fees, payouts, subscriptions.                                        | Upcoming | Must be robust & auditable.              |

> When a feature moves from **Upcoming → WIP → Done**, update this table first.  
> For larger features, also create a dedicated doc under `/docs`.

---

## 5. Roadmap & Tasks

> **Guideline:**  
> - “Now” = actively working this cycle (1–4 weeks).  
> - “Next” = realistic to ship this quarter.  
> - “Later” = important but not blocking current traction.

### 5.1 Now (Active Focus)

- [ ] Stabilize **room** and **stream** flows
  - Clean up join logic, host-only start enforcement.
- [ ] Polish **public chatroom UX**
  - One-click insertion of room/stream links.
  - Clear indication of which links are live vs waiting.
- [ ] Extract and bundle **Call Me widget**
  - As CDN-served JS or simple copy-paste docs for creators.
- [ ] Design **libp2p signaling integration**
  - Decide on topics (e.g. `metered/room/<id>/signal`).
  - Decide on relay/bootstrapping strategy.
- [ ] Implement a **simulation** of libp2p + WebRTC signaling
  - No media, just message flow (join/offer/answer/ice).
- [ ] Add **“Works with your calendar” story & helpers**
  - Landing page and docs showing how to:
    - use the room link as calendar location,
    - attach link to Cal.com / Calendly templates.

### 5.2 Next (Quarter-Level Targets)

- [ ] **Replace Supabase signaling with libp2p for real calls**
  - Dual mode (Supabase + libp2p) → full libp2p.
- [ ] **Metered Sessions v1**
  - Timer bound to call start/stop.
  - End-of-session summary (duration + total).
- [ ] **Host “Today / Upcoming” overview**
  - Simple list of scheduled sessions tied to their room.
- [ ] **Waiting-room experience**
  - Show session time + host info when someone joins early.
- [ ] **Creator-Facing Widget & Docs**
  - “Generate my widget” page.
  - Clear instructions for embed in websites/bios.
- [ ] **Minimal metrics & logging**
  - Per-session logs for debugging and analytics.

### 5.3 Later (Vision-Aligned)

- [ ] **Metered Sessions v2**
  - Proper billing flows.
  - Multi-currency support (fiat/crypto).
  - Host earnings overview.
- [ ] **Creator Dashboard**
  - Past sessions, earnings, repeat callers.
- [ ] **Persona Management**
  - Multiple room identities under one account.
- [ ] **Agent/Automation API**
  - Endpoints for agents to create/join sessions and listen for events.
- [ ] **Advanced Privacy**
  - Voice changer, avatar-only mode, privacy presets.
- [ ] **Self-hostable libp2p infra**
  - Relay/bootstraps for communities.
- [ ] **Recordings & Clips (opt-in)**
  - Privacy-respecting defaults (off by default).
  - Hooks for provenance / story protocols if needed.

---

## 6. Docs & Sub-READMEs

> **CORE.md = top of the pyramid.**  
> All deeper information should live in separate docs and be linked here.

Recommended structure:

- `CORE.md`  
  Central overview, mission, roadmap, feature status.

- `docs/ARCHITECTURE.md`
  - System diagram:
    - WebRTC
    - libp2p
    - relay nodes
    - Supabase (metadata only)
  - Signaling flow (current vs new).
  - P2P/privacy guarantees.

- `docs/PRODUCT.md`
  - Detailed description of:
    - Room/stream flows
    - Public chatroom
    - Metered sessions UX
    - “Works with calendars” behavior (using existing scheduling tools)
    - Target personas.

- `docs/API.md`
  - REST/WebSocket/libp2p APIs as they evolve.
  - Agent API design.

- `docs/WIDGETS.md`
  - Snippets for:
    - Inline call widget
    - Floating call button
    - Stream embeds

- `docs/ROADMAP-YYYY-QN.md`
  - Quarter-specific goals & milestones.

- `docs/SECURITY-PRIVACY.md`
  - Threat model.
  - Data retention policies.
  - Host-only control model.

**Instruction for contributors & agents:**

- Implementing a **new feature** → create/update a doc under `docs/` and link it from here.
- If a doc is outdated, add a banner:  
  `> ⚠ This document is partially outdated. See CORE.md for latest status.`

---

## 7. Review & Health Checks

Use this checklist during periodic reviews:

- [ ] Does the **Feature Status Table** reflect reality?
- [ ] Are there any “Upcoming” items with zero movement for 3+ months?
- [ ] Does the **Now/Next/Later** roadmap match what we’re actually doing?
- [ ] Have we updated docs for recent architectural changes (e.g. signaling via libp2p)?
- [ ] Does the **external story** (landing page, README) match this file?
- [ ] Are we building things that:
  - Make METERED easier to explain & market?
  - Help hosts earn and manage their time?
  - Respect existing workflows (calendars, schedules)?
  - Clearly differentiate from WhatsApp/Telegram/Zoom/Cal.com?

If the answer to any of these is “no”, update `CORE.md` first, then adjust code and docs to match.

---

## 8. Quick Positioning Summary (For Agents & New Contributors)

- **Core concept:**  
  A personal room (and stream) link for private calls and live sessions, that you can share anywhere and also attach to your calendar invites.

- **Key differentiators:**  
  - No phone numbers; no forced accounts for guests.
  - One stable link instead of new meeting URLs every time.
  - Works with existing scheduling tools (use it as the location).
  - Public chatroom where links can become sessions in one click.
  - Optional metered sessions (time = money).
  - P2P- and agent-friendly architecture under the hood (WebRTC + libp2p).

- **Always ask:**  
  “Does this change make METERED easier to explain, easier to adopt, and more useful for people who care about both **privacy** and **time**?”

If not, reconsider or park it.

---
