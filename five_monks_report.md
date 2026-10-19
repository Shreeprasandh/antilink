# The Five Monks Advisory Deliberation Report

**Session Anchor**: 2026-10-17T18:50:00+05:30  
**Project**: Antilink (`/Users/shreeprasandhk/shree_projects/antilink`)  
**Council Convened**: The Five Monks (The Contrarian, The Principal Advisor, The Expansionist, The Outsider, The Executor)  
**Synthesizer & Chairman**: Luna  
**Topic**: Comprehensive UI/UX Overhaul, Hierarchical Turn Grouping, Screen Wake Lock, Real-time Speech-to-Text, Single-Project Locking, and Resilient Remote Permission Approval  

---

## 1. Chamber Deliberations

### Chamber 1: The Contrarian (Failure Hunter & Pre-Mortem Inquisitor)
* **Trap A (Horizontal Scroll Blind-Fix)**: Adding a blanket `overflow-x: hidden` to the chat viewport or message bubbles will catastrophically truncate code snippets, JSON schemas, and command diffs. Code blocks must maintain an isolated horizontal scroll track (`overflow-x-auto`) with responsive bounds, while all surrounding text bubbles strictly enforce `min-w-0 break-words`.
* **Trap B (Textarea Viewport Reflow)**: On mobile devices, virtual keyboards dynamically resize the visual viewport (`visualViewport`). If the textarea height is hardcoded or relies on default `rows`, it generates phantom vertical scrollbars before the user even types. It must start at single-line baseline (`rows={1}`) with dynamic `scrollHeight` tracking capped at 120px.
* **Trap C (Mobile Web Speech Dropouts)**: Mobile browsers suspend the `SpeechRecognition` session after 3-5 seconds of silence or when background audio events occur. Naive speech listeners will hang silently. The speech engine must implement stateful restart on `onend`, silence threshold detection, and touch-to-talk toggle states with visual feedback.
* **Trap D (Remote Permission Race Conditions)**: Relying solely on `transcript.jsonl` writes can miss interactive permission prompts if Antigravity pauses execution before serializing the step. We must reinforce detection across both `transcript.jsonl` step status inspection (`WAITING_FOR_INPUT` / unconfirmed `tool_calls`) and active agent status streaming.

### Chamber 2: The Principal Advisor (First-Principles & Anti-XY Inquisitor)
* **Core Problem**: Sir needs a frictionless companion cockpit that behaves like an extension of his workstation—not a raw terminal dump.
* **Screen Wake Lock**: Mobile devices sleep aggressively to save battery. The native W3C **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`) is the cleanest, zero-overhead solution. It requires no background hacks and releases automatically when unmounted or disconnected.
* **Hierarchical Turn Grouping**: A single agent turn can execute 15-30 file reads and command checks. Rendering 30 separate cards floods the mobile viewport. Grouping consecutive tools into categorized summaries (`Explored 6 files`, `Ran 4 commands`, `... 20 more actions ...`) with progressive disclosure directly solves cognitive overload and vertical bloat.

### Chamber 3: The Expansionist (Visionary & Leverage Multiplier)
* **Antigravity Native Parity**: Implementing the exact hierarchical grouping (`● Explored X files`, `● Ran Y commands`) aligns Antilink 1:1 with the desktop CLI experience, creating instant mental familiarity.
* **True Remote Freedom**: A resilient, high-priority mobile permission approval sheet with physical haptic vibration and chime guarantees Sir can walk away from his desk without fear of the agent getting blocked on an unapproved terminal command.
* **Project Boundary Integrity**: Explicit single-project binding prevents accidental cross-project command injections when multiple repositories exist on the workstation.

### Chamber 4: The Outsider (Clean-Slate & Naive User Observer)
* **Visual Polish & Alignment**: The top header and bottom activity bar must adhere to standard mobile ergonometrics: minimum 44px touch targets, balanced padding (`calc(env(safe-area-inset-top) + 8px)`), and centered branding.
* **Archived Session Clarity**: When opening historical sessions from the drawer, users need immediate visual clarity. A prominent banner ("Viewing Archived Session • Sending a message will resume this conversation") eliminates ambiguity.

### Chamber 5: The Executor (Production Pragmatist)
* **Concrete File Targets**:
  1. `apps/web/src/components/AgentStream.tsx`: Textarea auto-grow, horizontal word-wrap containment, hierarchical turn grouping, real-time speech-to-text engine.
  2. `apps/web/src/components/Header.tsx` & `ActivityBar.tsx`: Nav bar alignment, safe-area spacing, and project badge.
  3. `apps/web/src/hooks/useWakeLock.ts`: Native HTML5 screen wake lock manager with visibility recovery.
  4. `packages/daemon/src/agentBridge.ts` & `server.ts`: Resilient permission detection and project workspace locking.
  5. `apps/web/src/components/ToolConfirmModal.tsx` / `ToolConfirmBanner`: Floating mobile-first permission card with instant 1-tap option buttons (1: Allow, 2: Allow Always, 4: Cancel).

---

## 2. Risk Index & Upside Multiplier

* **Risk Index**: **2.8 / 10** (Isolated UI refinements and daemon bridge enhancement; zero database mutations or breaking API changes)
* **Upside Multiplier**: **9.6 / 10** (Delivers gold-standard mobile ergonomics, native Antigravity turn parity, hands-free voice interaction, and foolproof remote permission gates)

---

## 3. The Chairman's Verdict & Verdict Ledger

* **Verdict**: **CONDITIONAL PASS**  
* **Condition**: Present the granular, step-by-step master plan to Sir and obtain explicit permission before executing code modifications across the 5 affected files.

### Historical Verdict Ledger Entry
| Timestamp | Trigger | Council | Verdict | Risk | Upside | Next Step |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-10-17T18:50:00+05:30` | User Comprehensive UX & Mobile Review | The Five Monks | `CONDITIONAL PASS` | 2.8 | 9.6 | Submit comprehensive execution plan for Sir's approval |
