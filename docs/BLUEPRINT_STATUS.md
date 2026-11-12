# Blueprint — Development Status

**Last documentation update:** 2026-11-11  
**Repository:** https://github.com/jgoldslice/dc_64_33  
**Baseline commit inspected before adding these documentation files:** `05c6e74dbf4a1df2719a4aeba28076a8a113fe88`  
**Verification scope:** Fetched root README and index.html; checked that AGENTS.md and this status file were absent; inspected recent commit identifiers. This is **not** a full source-code audit, automated test run, or iOS device test.

> **Operating rule:** Update this file after substantive development. Separate verified current state from the owner's design requests and past reports. The default branch's live commit and test status can change between chats; fetch them again.

## 2026-11-11 — Full-app layout and swipe polish v9.25 (web published; physical-device QA outstanding)

**Trigger:** Owner's physical iPad screenshot showed clipped Library images and a too-narrow project switcher. Owner also reported inconsistent swiping across tab windows and requested a broader app polish scan.

**Confirmed root causes and changes on GitHub `main`:**
- Library card images were displayed with `object-fit:cover` inside a fixed 16:10 tile. Updated to `contain` with the theme wash as letterbox background. The full-image viewer and Overview already use `contain`, so this aligns the Library with those views.
- A Library with only one or two items reserved three card columns, leaving disproportionate whitespace; sparse grids now use one capped-width column or two equal columns. List mode remains a single column regardless of count.
- Project switcher had a `240px` max-width in `polish-v81.css` even when an iPad had significantly more room. It now flexes to the available header width (up to 520px); compact layouts wrap a name longer than 25 characters onto its own full-width picker row. `polish-v81.js` sets the native select's `title` to the full selected project name.
- Main navigation in `fluid-navigation-v94.js` blocked all swipes whenever any project workspace was open, despite Overview being non-editing content. Overview and safe project regions may now swipe to adjacent main tabs; Notes, Sketch, Library drag surfaces, project action lists, nested horizontal scrollers, and interactive controls remain protected.
- A very quick touchend could cancel a pending animation frame and calculate settle timing from stale position. Pending positions are flushed before settling and the actual release x-coordinate is painted immediately, reducing abrupt swipe jumps without changing tab transition semantics or introducing view clones.
- Swept the current code for responsive concerns across Today, Week, Plan, Brainstorm, Notes, Library, modal sizing, long labels and swipe ownership. Existing layout code already addressed many prior phone/iPad issues; no unverified broad rewrites were made.

**Data/compatibility:** Pure web JS/CSS and existing service-worker cache version. No state schema, keys, IndexedDB attachments, native share Swift/plugin/host scripts, Xcode configuration, or backup format changed. No image binary modification.

**Tests authored:** Existing `tests/responsive-layout-v922.spec.cjs`, `tests/blueprint-v94-gestures.spec.cjs` and `tests/blueprint-fluidity-v91.spec.cjs` now cover long titles, uncropped image cards, safe project swipe/navigation exclusions, and release-before-frame responsiveness. New `tests/blueprint-polish-audit-v925.spec.cjs` checks all main views across eight phone/iPad/landscape breakpoints and a sparse Library gallery/list. Browser CI outcomes must be checked separately; native iOS touch, VoiceOver, Pencil, split-view dynamics and real FPS are **not** established by Chromium tests.

**Install on local Capacitor wrapper:** Copy only changed web assets `library-order-v923.css`, `polish-v81.css`, `polish-v81.js`, `fluid-navigation-v94.js`, and optionally `sw.js` from `main` into the owner's existing `canvas-ios/www`. Run `npx cap copy ios` and rebuild the main App scheme in Xcode. Do not overwrite the working native Share Extension Swift files or `blueprint-native-share-*.js`, and do not uninstall/clear application data.

**Follow-up QA backlog (not claims of new bugs):** Real-finger drag and swipe on iPad including fast successive swipes and cancel/reverse; Apple Pencil plus iPad Notes geometry; low-memory share import with large photo batches; long project names in narrow iPad Split View; iOS system keyboard and Dynamic Type; backup/export roundtrip before relying on daily use.

## 2026-11-11 — Library touch reorder and image actions v9.24 (iPad verification pending)

- **Observed on the physical iPad:** Holding a Library image selected/highlighted its content and displayed selection handles rather than dragging to reorder. Native share-import previously repaired on that device; the displayed Library contained several imported images.
- **Implemented on GitHub `main`:** `library-order-v923.js` explicitly cancels long-press text selection and native context menus on ordered cards, clears any pending selection on drag activation, and adds an ellipsis menu at the top-right of each Library image card. The menu offers Rename and Delete; a quick tap still opens the image. Keyboard Alt+arrow reordering remains in place, menus are excluded from drag initiation, and Escape dismisses menus.
- **Persistence:** Rename changes only the existing record's `title`, verifies `save(true)`, rolls back on failure, and updates the Overview. Delete invokes the already existing `v6DeleteResource` confirmation + guarded manifest write + shared-blob-reference protection. No data schema or App Group transfer files were modified.
- **Styling:** `library-order-v923.css` prevents iOS text selection/callouts in the Library cards; adds 44px menu controls, light/dark theme support, and responsive popover. `sw.js` cache bumped to `canvas-v924-library-image-actions`.
- **Regression tests:** `tests/library-order-v923.spec.cjs` covers rename persistence and blob retention, confirmation-based deletion and other-item retention, and cancelled context/selection events. Full browser GitHub Actions suite and real iPad long-hold still need verification before calling device behavior fixed.
- **Native install:** Existing Capacitor app is not automatically updated by the web push. Sync **only the changed web JS/CSS** from GitHub to the user's local `canvas-ios/www` and run `npx cap copy ios` plus Xcode App build; preserve the recently repaired native Share Extension Swift and native host/inbox scripts. Do not uninstall or clear user data.

## 2026-11-11 — Library ordering and three-item mixed Overview v9.23

- **Requested:** Project Overview previously showed only recent images, so saved links—including a YouTube Shorts item seen in the owner's iPhone screenshots—did not appear. Owner requested the first three items in the Library regardless of type, and press-and-hold ordering of pictures and links.
- **Implemented on GitHub `main`:** `project-overview-v919.js` now uses `project.library.slice(0,3)` in persisted order, with image thumbnails, clickable link/file tiles and YouTube thumbnails. `library-order-v923.js` organizes the full Library (pictures, links, YouTube preview cards, files and code) into a single consistent order, supports long-hold drag on touch/mouse, click suppression after dragging, Alt+arrow keyboard reordering, and saves only a reordering of existing record references with `save(true)`. No attachment bytes or schema keys are changed. `library-order-v923.css` adds responsive layout and feedback; `index.html` loads both assets, and `sw.js` precaches them in a new cache version.
- **Automated tests:** Updated `tests/project-overview-v919.spec.cjs` and added `tests/library-order-v923.spec.cjs`, including mixed ordering, 3-item cap, mouse/touch reorder, keyboard reorder, save/readback, and reload persistence. GitHub Actions [browser smoke run 43144496770](https://github.com/jgoldslice/dc_64_33/actions/runs/43144496770) **passed** on commit `d5bef37c265802dec16d099b59643136c0cd86d7`. This verifies Chromium behavior but **not native iPhone gesture performance**.
- **Web deployment:** [GitHub Pages run 43144496715](https://github.com/jgoldslice/dc_64_33/actions/runs/43144496715) succeeded for the same commit. Note that an existing installed Capacitor app does **not** automatically update with GitHub web deployments.
- **iOS status:** Native Share Extension previously succeeded on the physical iPhone; new Library reordering and three-item preview require bringing the updated web JS/CSS into the owner's local `canvas-ios/www`, running `npx cap copy ios`, rebuilding in Xcode, and verifying on iPhone. Do not overwrite local native `SceneDelegate.swift`, Swift plugin, or native share scripts.
- **Next device QA:** Press/hold and drag a photo over a YouTube link; check that Library/Overview order matches and survives app restart. Validate that a normally tapped link still opens, dragging does not accidentally open it, touch scrolling is preserved, and newly shared native resources import to the correct project.

## 2026-11-11 — Responsive layout optimization v9.22 (web deployed; 202 browser tests passed)

- **Requested / merged:** Optimize Blueprint card, tab and control placement across iPhone, iPad portrait/landscape, sidebar and narrow Split View. [PR #42](https://github.com/jgoldslice/dc_64_33/pull/42) was merged into `main` at `b074906c13a3640ef08a1a507f5e707732790e59` on 2026-11-11.
- **Implemented (CSS only):** `today-responsive-v917.css` uses the usable Today workspace width through a named CSS container instead of viewport width; paired Schedule/Habits and Tasks/Priorities remain where at least 520px is available. Reduced forced minimum card heights while retaining capped scrolling and aligned rows on wider layouts. `project-overview-v919.css` now pairs Notes and To-Do only when the project container has 540px free (works with iPad sidebar and Split View), with responsive 2/4 image thumbnails. `layout-habits-v916.css` removes the forced 540px horizontal phone tracker, showing each full habit name on its own line followed by seven equal-width check targets with 44px hit areas. `weekly-blueprint-v918.css` standardizes important weekly controls at 44px and keeps four Goals tabs legible. `sw.js` bumps the cache version for eventual web publication.
- **Data safety:** No persistent data schema, localStorage / IndexedDB readers or writers, backup formats, note/drawing engine, share extension, or app icon touched. No automatic native Xcode update.
- **Tests authored:** `tests/responsive-layout-v922.spec.cjs` covers available-width transitions at 320, 390, 650, 740, 768, 834, 900, 1024 and 1194px; paired rows; mobile habit seven-day layout, tap target and persistence; Project Overview columns and horizontal overflow. **Static source checks passed** on 2026-11-11 for balanced CSS braces, absence of merge conflicts, key responsive rules, cache version and JavaScript test-file parsing. **Chromium suite verified:** Initial main-branch [run 43098744546](https://github.com/jgoldslice/dc_64_33/actions/runs/43098744546) passed 201/202; the sole failure was a test assertion that assumed the default Today cards contained no sample data. The test now clears sample events/tasks/habits/projects before asserting empty-state dimensions, without modifying production app logic. Corrected code commit `4b8d17c50dd0f79ea4c68fa60d519f89e0322ae7` passed **202/202** Chromium tests ([run 43122872186](https://github.com/jgoldslice/dc_64_33/actions/runs/43122872186)).
- **Physical-device verification:** Not yet tested on iPhone/iPad; touch, font scaling, Split View, iOS software keyboard and real Apple Pencil still require testing. **Web deployed:** GitHub Pages publication **succeeded** for tested code commit `4b8d17c50dd0f79ea4c68fa60d519f89e0322ae7` ([run 43122872251](https://github.com/jgoldslice/dc_64_33/actions/runs/43122872251)). Website: https://jgoldslice.github.io/dc_64_33/. Native Capacitor/Xcode installed app not updated.
- **Original code commits:** Today `b8affd72b217dcfde82f1a7473ce71edaf30a298`, Project Overview `bb6c998e2787c506f7cc4bbad660f336f4ad42cb`, Habit Tracker `808c8779e33444f3b6e0f3d08c81bb0682b6e5bd`, weekly buttons `3ee18f3ebf5a44eca67405629855d25f4af70e6a`, tests `647f1fc0e0120f73ac5589e63acfd61faa0fd139`, offline cache `0857618fc140dc7c186727b79f144d44fd48e6b6`.
- **Next:** Verify on physical iPhone/iPad (especially iPad Split View, Habit Tracker touch behavior and Notes/Apple Pencil). Synchronize and build the separate native Capacitor/Xcode wrapper only after checking its actual local location and backup. Native Share Extension draft PR #41 and native PencilKit draft PR #40 remain separate and are not deployed. Some historical GitHub Actions runs may remain queued; the latest code-commit test and deployment are both complete.

## 2026-11-11 — Project Library capture layout polish (web v9.21)

- **Requested:** On iPhone, the project Library's "Save to a project" sheet made the Link / Photo / file choice buttons disproportionately tall and visually mismatched with the system Choose Files control. Owner supplied an iPhone screenshot.
- **Root cause / implemented:** Mobile `.v919-capture-sheet` used a full-viewport CSS grid whose auto rows expanded to fill available height. A focused styling change in `project-overview-v919.css` switches the phone sheet to a vertical flex stack with compact two-choice 44px segmented controls, a matching native file-picker button, and safe-area-aware footer placement. The existing project selection, link, image/PDF upload, confirmation, keyboard focus, and storage paths are unchanged.
- **Commits on `main`:** `927676cb42bad6b5546b39c7e0612810ae63a042` (CSS), `d77cfa43e2c10c58b3fd6a1499ff8d9f17371134` (regression tests in `tests/project-overview-v919.spec.cjs`), and `3c87e2007e58be46e7a5d3932a0c30be8a01cd23` (offline cache `canvas-v921-compact-project-capture` in `sw.js`).
- **Automated-test verified:** Full GitHub Actions browser smoke suite **passed** at commit `3c87e2007e58be46e7a5d3932a0c30be8a01cd23` ([run 43085899646](https://github.com/jgoldslice/dc_64_33/actions/runs/43085899646)). New test checks both capture modes, touch-target geometry, selection indicators, native file chooser visibility, footer and viewport bounds at 320, 375, 390, 430 and 834px widths, and cancel without writing to the library. Browser tests do not prove iOS Safari rendering.
- **Web deployed:** GitHub Pages publish **succeeded** for `3c87e2007e58be46e7a5d3932a0c30be8a01cd23` ([run 43085899713](https://github.com/jgoldslice/dc_64_33/actions/runs/43085899713)). **Physical-device verified:** pending; ask owner to refresh on iPhone and check the Link / Photo selector and file picker. **Native iOS wrapper deployed:** not verified.
- **Data safety:** No schema change, migration, backup format change, library state change, or deletion. CSS, a browser regression test, and the service-worker cache name only.

## 2026-11-11 — iOS Safari form focus zoom (web v9.20)

- **Requested / reproduced in screenshot:** When a text field (such as Add Habit → Title) receives focus on iPhone Safari, the page magnifies and may remain zoomed after dismissal. The field inherited a 12px size from its label, below the approximately 16px Safari focus threshold.
- **Implemented and pushed to `main`:** Commit `580126e2bdd2135d1648bb31817ae46b938dfe8d` updates `index.html` with a touch-pointer form-control minimum font size (16px), responsive planner modal bounds, and seven-column weekday grid containment. It deliberately retains normal user pinch zoom and does not change saved planner data. Commit `f5510815ee4c66350338cf48a4f6798308490cf5` updates the `sw.js` offline cache version; new test at `f68dcc1ead642a667a65896920f248d3d97188a0` (`tests/ios-form-focus-v920.spec.cjs`).
- **Automated-test verified:** Full GitHub Actions Chromium browser suite **passed** for `f5510815ee4c66350338cf48a4f6798308490cf5` ([run 43084881494](https://github.com/jgoldslice/dc_64_33/actions/runs/43084881494)). It includes regression checks for minimum 16px Habit/Goal form fonts, narrow 320px/390px dialog bounds, weekday controls, and the accessible viewport setting. This cannot replicate iOS Safari's own keyboard-triggered magnification.
- **Web publication:** GitHub Pages workflow **succeeded** for `f5510815ee4c66350338cf48a4f6798308490cf5` ([run 43084881563](https://github.com/jgoldslice/dc_64_33/actions/runs/43084881563)). **Physical-device verified:** no. **Native iOS installed build updated:** no evidence; separate local Capacitor/Xcode sync still required.
- **Data / compatibility:** CSS and service-worker cache name only; no localStorage, IndexedDB, backup format, or migrations touched. Test on a real iPhone by refreshing the web app, entering and dismissing Add Habit, and checking that it stays at the intended scale and dialog fits with keyboard open; test in landscape too.
- **Other verified source status:** Project Overview / Library previews and in-app link/photo capture are present in `main` since v9.19 (`4f1a4fe792e2fd7df3284ae2aa19db2ae802ef1c`). An optional Apple Shortcuts link-sharing flow is documented in `docs/PROJECT_CAPTURE_IOS_SHARE.md`; a native iOS photo Share Extension is **not** implemented. The v9.19 Chromium suite passed at `05c6e74dbf4a1df2719a4aeba28076a8a113fe88` ([run 43061692206](https://github.com/jgoldslice/dc_64_33/actions/runs/43061692206)). Real iPhone/iPad Pencil and responsive touch QA remain pending.

## What was confirmed in the repository

- The root README identifies the product as **Blueprint** and describes it as a mobile-first planner for goals, weekly planning, tasks, habits, notes, and ideas.
- The root `index.html` sets the document title and Apple home-screen title to **Blueprint**.
- The README describes previous work including a rebrand/direct-to-Goals navigation, iPad layout and touch targets, swipeable week navigation, and notebook zoom. **These are README claims, not independently tested behaviors.**
- The native Capacitor/Xcode project has previously been maintained locally on a Mac outside the confirmed GitHub root. Its current contents and synchronization state were **not inspected**.
- No application tests, builds, device installs, performance benchmarks, or data migrations were performed while initializing these documents.

## Development state (evidence levels)

| Item | Current status | Evidence / next verification |
| --- | --- | --- |
| Blueprint app identity | Source inspected | `index.html` title; README |
| Today, Week, Goals, Brainstorm | Documented in README/history | Inspect current UI and test responsive layouts |
| Notebook and swipe features | Described in README | Automated tests and iPhone/iPad touch QA still needed |
| Project Overview cards | Implemented; browser-suite verified on v9.19 | `project-overview-v919.js`, CSS; iPhone/iPad device QA pending |
| Share from iOS into project Library | Partial | In-app link/photo capture available; Shortcut links documented; native iOS Share Extension still not built |
| iPhone toolbar/tabs overflow | v9.19 responsive code present; device QA pending | Reproduce and confirm on real iPhone |
| Apple Pencil coordinates, zoom, text boxes | Previously reported issues; current status unknown | Test on physical iPad with Pencil |
| Data backup/persistence | Existing behavior mentioned in README | Test export/import and migration safety on copy of data |
| iOS build/deployment | Web v9.22 published; native build unverified | Run 43122872251 deployed code commit 4b8d17c, native Xcode app requires separate local build |
| Documentation / agent continuity | AGENTS.md available | Follow and maintain these files |
| iPhone Safari form focus zoom | Implemented and Chromium regression-suite verified | v9.20: 16px touch text-entry minimum; physical Safari check pending |
| Project capture modal oversized resource buttons | Fixed in v9.21; browser-suite verified and web published | Compact 44px switch, matching file picker, flex sheet; iPhone device confirmation pending |

## Prioritized verification and improvement backlog

These entries are **candidates for investigation**, not assertions that the features are broken or missing today.

1. Audit whether project **Overview** and its Notes / To-Do / Library cards are present and functional.
2. Determine current status of native iOS share-sheet integration and its constraints.
3. Reproduce and fix toolbar/tab overflow on iPhone; test iPad portrait/landscape and Split View.
4. Run an Apple Pencil / Notes regression pass: drawing alignment, ink sharpness, pan and pinch, resize handles, accidental highlighting, and persistence.
5. Confirm Today dashboard fit, Week swipe continuity, event editing, keyboard behavior, and accessibility.
6. Verify persistent storage/backup export and the GitHub → Capacitor → Xcode → device update process.

## Test and deployment log

| Date | Action | Result |
| --- | --- | --- |
| 2026-11-11 | Documentation initialization and limited repository inspection | README/index inspected; no tests or app builds executed; physical devices not accessed |
| 2026-11-11 | v9.20 Safari form focus styling, weekday modal containment, offline cache refresh | Chromium CI passed (run 43084881494); GitHub Pages publish succeeded (run 43084881563); real-device check pending |
| 2026-11-11 | v9.21 Project capture segmented choice, file picker and responsive sheet | Chromium CI passed (run 43085899646); GitHub Pages publish succeeded (run 43085899713); real-device check pending |
| 2026-11-11 | v9.22 responsive Today/Projects/Habits/touch layout (PR #42) | Merged b074906c13a3; test fixture fix 4b8d17c50d; 202/202 Chromium passed (run 43122872186); GitHub Pages publish succeeded (run 43122872251); physical-device QA pending |

## How to update this status file after future work

Record:
- Date, exact branch and current commit SHA
- Change summary and affected files
- Requested vs implemented vs automated-test verified vs physical-device verified vs deployed
- Automated test commands with passing/failing result
- Known issues, regressions, and owner testing tasks
- Changes requiring local Xcode/Capacitor synchronization
- Next highest-priority action

Do not replace the whole document with optimistic summaries. Carry forward incomplete work, correct stale information with evidence, and preserve an auditable short history.

## ChatGPT Project sync limitation

A file committed to GitHub is **not automatically uploaded or synchronized** to ChatGPT Project files. Codex and repository-aware tools can consult this file from GitHub. ChatGPT chats without repository access must use an uploaded copy or explicitly retrieve the current repository version. ChatGPT Project instructions are a separate setting managed in the Project interface.
