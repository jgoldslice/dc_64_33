# Canvas / dc6433 — Apple-style polish audit (DRAFT, NOT SHIPPED)
**Status:** research and code proposals only. Never merge these into main or deploy without an explicit go-ahead.  
**Design principle:** A calm planner and creative workspace: Today tells me what matters; Blueprint connects goals to meaningful action; Brainstorm stores creative projects. Every visible control must earn its place.

## Non-negotiable boundaries
- Maintain **Today → Week → Blueprint → Brainstorm** navigation and **Today at a Glance → Habits → Top Priorities → Projects** homepage.
- Keep **Goals → Steps**; keep project **Notes / To-Do / Library**; no extra default tabs.
- One handwriting-style font for Notes, three sizes (S/M/L), bullets, ink draw/erase/undo, image insert. No rich Word-style formatting bar.
- Notes must remain movable/resizable, save original editable objects, have transparent text overlays, and avoid accidental iPhone text-selection menus.
- No embedded AI, no subscriptions, gamification, achievement feed, social features, or artificial engagement hooks.
- Preserve theme selection and user data; don't rename "Canvas" until chosen.
- No hardware-specific "iPhone Duo" assumptions. Use width, pointer capability, orientation and available layout space; an external/future device's stylus support is unknown.

## Decision rules for every proposed feature
1. Does it eliminate a frustration that has occurred while using the app?
2. Does it reduce taps or cognitive load without introducing a new default control?
3. Does it work on a 320 px phone, 390 px iPhone, landscape, and a wide/unfolded view?
4. Can the user understand the action without a tutorial and recover from mistakes?
5. Does it preserve existing local data and survive restart, import/export and offline use?
6. Could the same benefit be achieved by removing something instead?
7. Is it compatible with VoiceOver, keyboard and reduced-motion settings?

Legend: P0 = reliability/accessibility must-have, P1 = high-value UX, P2 = future adaptive device polish, P3 = optional only if requested. Effort S = hours, M = days, L = larger change. Items marked *evidence* are based on inspected current repository behavior, not just speculation.

## P0 — Stability, touch safety, data integrity (16)
| ID | Priority/Effort | Proposal / why |
|---|---|---|
| 01 | P0 / S | Make tappable areas at least ~44 × 44 CSS px even when the visual checkbox/icon is smaller; current ~15–39 px visual controls can be hard to hit (*evidence*). |
| 02 | P0 / M | Real iPhone Safari regression pack for short tap, long press, text selection, editing, resizing, scrolling, drawing and paste; Chromium alone cannot validate WebKit. |
| 03 | P0 / M | Stable gesture arbitration: notebook drag vs text edit vs page scroll; never let one pointer gesture trigger two actions. |
| 04 | P0 / S | Add visible pressed/focus/disabled states to icon-only buttons; tactile feedback without extra words. |
| 05 | P0 / M | End-to-end full-backup restore check covering note-pages, images, sketches, tasks, linked habits and project library. Existing app splits localStorage/IndexedDB (*evidence*). |
| 06 | P0 / M | Protect shared image/file blobs from premature deletion; before deleting from Library, check references in notes and sketches. |
| 07 | P0 / S | Persist each notebook object's font size, width, x/y, z-order, image key and page independently. |
| 08 | P0 / M | Copy/paste selection in editable notes must work deliberately, without restoring accidental long-hold select-all; provide a clear editing alternative if long hold collides. |
| 09 | P0 / S | Avoid fixed-bottom-nav overlap with keyboard and the browser toolbar using safe-area + visualViewport tests. |
| 10 | P0 / S | Never let horizontal tab swipes fire inside notebook content, drawings, horizontal scrollers or modal/sheet contexts. Existing global touch handler has protections; regression-test them (*evidence*). |
| 11 | P0 / M | Save indicator on save failure and nonblocking "Retry / Export backup" recovery; current localStorage failure is an alert (*evidence*). |
| 12 | P0 / S | Prevent duplicate object generation during legacy Notes migration; re-import must be idempotent and reversible. |
| 13 | P0 / S | Restore focus and cursor after modal completion, saving Notes, or switching project pages. |
| 14 | P0 / S | Test destructive actions (delete project/page/image) with clear consequence language and a non-urgent recovery path. |
| 15 | P0 / M | Interaction tests on phone + wide mode plus 200%, 300% dynamic text, light/dark/system and reduced motion. |
| 16 | P0 / M | Production readiness: crash logging/diagnostics opt-in only; don't collect analytics or personal notes without permission. |

## P1 — Navigation and a lighter Apple-like feel (17)
| ID | Priority/Effort | Proposal / why |
|---|---|---|
| 17 | P1 / S | Restore each tab's previous scroll position when returning to it; current tab() always scrolls to top (*evidence*). |
| 18 | P1 / S | Keep all four bottom tabs stable and clearly labeled; resist adding a fifth. |
| 19 | P1 / S | Give the back button a consistent location and return to the last project/home state; no surprise resets. |
| 20 | P1 / S | Small haptic-style press animation via CSS; real haptics only if a supported native API exists. |
| 21 | P1 / S | Replace modal browser prompts for Rename/Delete page with consistent small action sheets, not new full-screen forms. |
| 22 | P1 / M | Slide-up sheets for task/goal editing on phones; respect safe areas, keyboard, swipe-to-dismiss and escape. |
| 23 | P1 / S | Preserve selected Blueprint tab (Tasks/Goals/Habits) when switching away and back. |
| 24 | P1 / S | Projects shortcut order: recently opened first, with alphabetical fallback; today currently slices first four (*evidence*). |
| 25 | P1 / S | Quiet "Last edited" metadata within a project overflow menu, not a permanent label on every folder. |
| 26 | P1 / M | Context action to turn selected notebook text into a project To-Do; not an always-visible toolbar item. |
| 27 | P1 / M | Only one unified completion model for project To-Do / Blueprint Task links; avoid phantom duplicates. |
| 28 | P1 / M | Today at a Glance: distinguish tasks due today from scheduled for today; never silently omit overdue tasks. |
| 29 | P1 / S | Show **at most three** top priorities by default, with "Show all" if genuinely needed; assess before altering the current five. |
| 30 | P1 / S | Display empty states as one actionable line, not large empty panels or onboarding cards. |
| 31 | P1 / S | Avoid decorative metadata count badges on Brainstorm folders (already removed by prior user preference). |
| 32 | P1 / S | Reduce repeated border/shadow layers in nested cards and notebooks; maintain color contrast. |
| 33 | P1 / S | Use consistent spacing / corner radius / typography tokens so cards feel related. |

## P1 — Notebook tools and swiping (12)
| ID | Priority/Effort | Proposal / why |
|---|---|---|
| 34 | P1 / M | Notebook drag handle vs long hold: preserve one dependable gesture and clear selection feedback. Evaluate moving via a small contextual handle if native selection remains disruptive. |
| 35 | P1 / M | Pinch-to-zoom on a note page, but only after robust touch conflict tests; do **not** change text size while pinching. |
| 36 | P1 / S | Two-finger panning over notebook canvas; one-finger draw only in Pen mode. |
| 37 | P1 / M | Keep image aspect ratio during resizing and preserve exact display bounds across browser reopen. |
| 38 | P1 / S | On editing text, temporarily hide object resize/delete affordances or keep them out of the typing hit area. |
| 39 | P1 / S | Allow contextual "Bring forward / Send backward" only when overlapping objects require it, not a toolbar icon. |
| 40 | P1 / S | Improve handwritten font fallback to a consistent bundled/system-safe stack, avoiding unexpected fonts across iOS and web. Never distribute third-party licensed font files. |
| 41 | P1 / S | Autosave should not re-render the active rich-text element while typing; maintain caret and scroll. |
| 42 | P1 / M | Undo most recent text/position/image action (separate from Ink undo) via system-standard undo; defer until safe history model exists. |
| 43 | P1 / M | Sketch memory limits: downscale huge photos to display previews while preserving originals, and avoid base64 images in localStorage. |
| 44 | P1 / S | Page selector preserves current page, has accessible names and no accidental delete when scrolling. |
| 45 | P1 / M | Snapshot tests of overlapping transparent text + images in dark and light themes, especially at narrow widths. |

## P2 — Future wide-screen / unfolded iPhone concept (10)
| ID | Priority/Effort | Proposal / why |
|---|---|---|
| 46 | P2 / M | Use responsive width/container queries, not a hard-coded "Duo" check. Apple HIG recommends size-class adaptation. |
| 47 | P2 / M | In unfolded/wide Brainstorm, show optional project sidebar + active Notes/To-Do/Library detail; fold to one pane when narrow. |
| 48 | P2 / M | Optional Notes page rail + editor side by side only when there is genuine horizontal space. |
| 49 | P2 / M | Wide Week: calendar and priorities in two columns; keep Today as four recognizable areas. |
| 50 | P2 / S | The same bottom navigation can remain on compact screens; on wide layout consider a sidebar as an alternate presentation, not additional destinations. |
| 51 | P2 / M | Preserve scroll, selected page and keyboard focus while resizing/unfolding/rotating; no navigation reset. |
| 52 | P2 / M | Pointer + stylus (if hardware supports it): distinguish finger for scrolling and pen for ink, with an explicit override. |
| 53 | P2 / S | Adapt safe areas to changing window insets; don't assume a center fold, exact screen ratio, or Apple Pencil support. |
| 54 | P2 / M | Support split-view multitasking / multi-window later if native framework supports it; state must stay coherent. |
| 55 | P2 / S | Wide mode must not enlarge toolbar buttons into sprawling UI; maintain concise density. |

## P3 — Optional additions ONLY after real need (8)
| ID | Priority/Effort | Proposal / why |
|---|---|---|
| 56 | P3 / S | Optional project pinning or reorder, hidden behind project overflow. |
| 57 | P3 / M | Files app drag/drop into a project library, if native or web APIs handle it reliably. |
| 58 | P3 / M | Share Sheet / Shortcuts integration for quick project capture, native-app phase. |
| 59 | P3 / M | Offline image thumbnail indexing for large libraries, only if performance warrants it. |
| 60 | P3 / M | Gentle one-time gesture hint that disappears after successful use, not a persistent tip banner. |
| 61 | P3 / S | Export a single notebook page as an image/PDF, but preserve full editable backup separately. |
| 62 | P3 / M | Cross-device sync after defining conflict resolution, privacy guarantees and backups. Do not introduce a server prematurely. |
| 63 | P3 / M | Search across project names and typed notes; only add when users have enough projects to need it. |

## Subtractions and deliberate non-features (12)
- Do **not** add an AI assistant, chat bubble or AI button inside the app.
- Do **not** add Bold, Italic, headings, themes/font menus to Notes by default.
- Do **not** add Goals, Habits or To-Do as separate bottom-navigation tabs.
- Do **not** add long onboarding, animation on every view switch, or permanent tooltips.
- Do **not** add productivity scores, streak-shaming, achievements or gamified leaderboards.
- Do **not** duplicate project tasks as separate unrelated items in multiple views.
- Do **not** turn quick ideas into goals/tasks directly; ideas become projects.
- Do **not** surface Rename/Delete on the main project card; keep under overflow.
- Do **not** autoplay opening animation every time the user returns from multitasking.
- Do **not** add swipes that compete with iOS's screen-edge back gesture.
- Do **not** use a fixed device model to decide single/dual column layout.
- Do **not** rename Canvas or replace its icon/quote until a name is chosen.

## Technical implementation order and release gates

**Pilot A (reliability):** #01, 02, 03, 05, 08, 10, 11, 12, 15. Tests first. Record before/after mobile videos. No additional features.

**Pilot B (feel):** #04, 17, 19, 21, 23, 30, 32, 33. Ensure no change in saved data and no more than one extra action per task.

**Pilot C (notebook):** #34, 37, 38, 39, 41, 45. Do not attempt zoom or layering until core gestures are solid on iPhone Safari.

**Pilot D (wide):** #46, 47, 48, 49, 51, 52. Treat dual-pane layouts as optional based on *available width*. Test fold/unfold through CSS viewport resizing; device features are assumptions until confirmed.

**Release checklist:** export complete backup → verify round-trip import → run browser suite → iOS Safari manual test → test dark/light/reduced-motion → merge only after user approval → verify deployment → preserve rollback commit.

## Draft code in this branch (not linked to the live app)
- \`proposals/apple-polish/gesture-router.js\`: reusable pointer and swipe classifier; edge/exclusion protection, no side effects until installed.
- \`proposals/apple-polish/adaptive-layout.css\`: optional safe-area, larger touch target and two-pane CSS layer designed around width, not hardware branding.
- \`proposals/apple-polish/mobile-interactions.spec.cjs\`: future Playwright test scenarios (not included in current production test workflow).
- Nothing in these files is imported from index.html or the service worker. These are review-only artifacts.
