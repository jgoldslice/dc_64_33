# Blueprint v9.1 — Fluidity Review (DRAFT)

**Branch:** \`draft/blueprint-v91-fluidity\`  
**PR:** https://github.com/jgoldslice/dc_64_33/pull/38  
**Base:** \`main\` at \`2dafaa3143e529aedcc3a829f15144c332521986\`

This is a *review-only draft*. No merge, deployment, user-data migration or PencilKit integration. PR #36 (iPad-first layout) and PR #37 (native PencilKit) are separate and remain unmerged.

## Design research

- Apple HIG Motion: https://developer.apple.com/design/human-interface-guidelines/motion — purposeful, cancelable motion; less frequent animation.
- Apple HIG Gestures: https://developer.apple.com/design/human-interface-guidelines/gestures — direct manipulation, consistent gestures, alternatives to touch.
- Apple Xcode responsiveness: https://developer.apple.com/documentation/xcode/understanding-user-interface-responsiveness — frame pacing and latency especially during continuous touch.
- Apple HIG Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars — preserve content space in narrow windows.
- Apple HIG Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility — respect Reduce Motion.

The implementation uses standard DOM/CSS transitions and native CSS scroll-snap where practical. No Apple proprietary code was copied.

## Baseline audit (source inspection)

- \`page-turn.js\` previously deep-cloned *both* tab views for each swipe, created a 3D overlay, and used up to 310 ms of settling. These are **code-level baseline observations**, not measured latency numbers.
- \`week-events-v87.js\` correctly used native scroll-snap but included multiple 280 ms fallback timers. Conservative date-picker settling was necessary to avoid corrupting a user's selected event day.
- Project opening had \`scrollIntoView({behavior:'smooth'})\`, which could animate the *entire document* while entering an iPad notebook.
- \`ipad-v84.css\` used 200 ms sidebar transitions. The app already handled Reduce Motion and provided 44 px targets in most tablet contexts.
- Pencil ink rendering/saving and the native PencilKit draft are deliberately out of scope.

## Three distinct iterations

### Iteration 1 — responsive, non-cloning tab navigation

- Replaced deep-cloned 3D page snapshots with transitions on the actual live tab views. Source and destination are temporarily fixed in place and restored after completion/cancellation.
- Live transforms track horizontal finger movement while respecting native vertical scroll, edge gestures, modal dialogs, input fields, Notes SVG and Pencil controls.
- Reduced-motion users change tabs immediately.
- Early navigation tests verify tab changes, reversal, cancellation, alignment, and **zero deep DOM clones** per gesture.
- Checkpoint: GitHub Actions run 42763617333 — **132 passed**.

### Iteration 2 — release and calendar settling

- Added sample-based release velocity; a short deliberate flick can commit, while a slow partial drag cancels.
- Made a new gesture able to interrupt an in-progress settling transition.
- Tightened transition duration to a remaining-distance/velocity function, with maximum 220 ms.
- Shortened **main calendar** scroll-snap fallback from 280 ms to 155 ms; native \`scrollend\` remains primary.
- Measured a single Chromium CI live-pane preparation sample at **0.10 ms**, as printed by the test. This is **not** physical-device input latency, FPS, or a general statistical estimate.
- Checkpoint: GitHub Actions run 42763969004 — **135 passed**.

### Iteration 3 — workspace polish and regression stress

- Replaced document-wide smooth scrolling when entering a project with an instant scroll plus a very short, restrained project-title entry animation.
- Ensured project menus never compete with animated Notes pane stacking contexts.
- Tuned iPad sidebar expansion/collapse to a consistent 155 ms easing.
- Added a short event sheet entry animation (disabled by Reduce Motion).
- Added stress tests for rapid navigation, cancellation, layout resizing, project navigation, Pencil isolation and accessibility settings.
- Retained the conservative 280 ms fallback for **event date selection**, because an intermediate test caught a race where shorter settling could override the selected date. Added locking/clearing pending timers when the date strip is rebuilt.
- Bumped service worker asset cache version so the new code is supplied to returning offline users after merge.

## Performance evidence and caveats

| Characteristic | Source baseline | Draft result |
|---|---:|---:|
| Deep DOM snapshots per tab swipe | 2 | 0 (automated test verifies no deep clones) |
| Longest non-reduced-motion tab settling | 310 ms | 220 ms cap, often less |
| Main calendar scroll fallback | 280 ms | 155 ms (with native scrollend taking precedence) |
| Event date-picker fallback | 280 ms | 280 ms; correctness preserved |
| iPad sidebar duration | 200 ms | 155 ms |
| Live pane preparation | No comparable baseline measurement | Single CI example: 0.10 ms |

**No valid 60 FPS / 120 FPS claim:** Playwright desktop Chromium CI cannot measure real iPhone/iPad Safari touch latency, frame pacing, Apple Pencil sampling, GPU compositing or battery consumption. No benchmark in this PR establishes parity with native Apple apps.

## Physical-device acceptance checklist

1. On iPhone: swipe Today → Week → Goals → Brainstorm and back; reverse mid-gesture and repeatedly tap bottom navigation during a transition.
2. On iPad portrait and landscape: test sidebar expand/collapse and project entry; open project settings menu and activate controls, including the destructive action **only in a disposable test project**.
3. Week calendar: drag slowly, flick rapidly, reverse directions, and verify exactly one change per gesture. Test the Add Event date strip separately, including adjacent weeks, selected dates and no inadvertent changes.
4. Notebook: select Pen, write, pinch and pan; verify strokes never accidentally change top-level tabs. Check Notes viewport stays in place with keyboard, split view, rotation, and app backgrounding.
5. Enable Reduce Motion: no sliding main tabs, entrance animations or unexpected 3D motion.
6. Test 20+ navigation cycles on real Safari and the Capacitor build, watching for frame drops, freezing, visual snapping and lost touches.
7. Export a complete backup before testing. Confirm all projects, calendar entries, notes and attachments survive refresh/relaunch.

## Remaining work / limits

- This is a web/Capacitor interaction refinement, **not** a native UIKit navigation rewrite.
- True swipe interruption/retargeting while mid-transition should be validated on iOS touch hardware. Automatic unit tests cover state integrity and synthetic gestures, not native touch physics.
- A persistent in-app motion controller could unify project, tabs and week gestures further, but it would introduce more state management. Avoid unless physical tests find demonstrable inconsistencies.
- PR #36 iPad layout and PR #37 PencilKit prototype will need integration/rebase review after this PR, if approved.
