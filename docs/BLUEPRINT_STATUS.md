# Blueprint — Development Status

**Last documentation update:** 2026-11-11  
**Repository:** https://github.com/jgoldslice/dc_64_33  
**Baseline commit inspected before adding these documentation files:** `05c6e74dbf4a1df2719a4aeba28076a8a113fe88`  
**Verification scope:** Fetched root README and index.html; checked that AGENTS.md and this status file were absent; inspected recent commit identifiers. This is **not** a full source-code audit, automated test run, or iOS device test.

> **Operating rule:** Update this file after substantive development. Separate verified current state from the owner's design requests and past reports. The default branch's live commit and test status can change between chats; fetch them again.

## 2026-11-11 — Native Share Extension Mac preparation improvements (DRAFT; NOT SHIPPED)

- Prepared an opt-in Capacitor bridge subclass (`native-share-extension/BlueprintShareBridgeViewController.swift`) to register the local `BlueprintShare` plugin; the actual host Xcode storyboard and target membership are **not** changed.
- Added `native-share-extension/scripts/prepare-ios.sh` to stage Swift and JavaScript files alongside the separate Mac Capacitor project. It backs up `project.pbxproj`, refuses to replace divergent staged files, and **does not edit Xcode targets, sign, build, install, or touch user data**.
- Added `native-share-extension/scripts/test-prepare-ios.sh` to check staging idempotency, source copies, overwrite protection, and unchanged Xcode project metadata using a temporary mock project; added it to the PR smoke workflow. **The new CI check has not yet been confirmed passing.**
- Updated the integration README to call out app/extension App Group entitlements, `CFBundleDisplayName=Blueprint`, and mutually exclusive `NSExtensionPrincipalClass` versus `NSExtensionMainStoryboard` keys. The actual Apple signing and Capacitor version still require checking on the Mac.
- **Release gate:** No native Swift compile, Xcode signing, iOS device installation, or photo sharing test has occurred. Keep this draft isolated until the owner wires and verifies the actual app and exports a complete backup.

## 2026-11-11 — Native Share Sheet implementation staged (DRAFT PR #41)

- **Requested:** Minimize friction when sharing links, photos and PDFs from iPhone apps into a selected Blueprint project Library. A Share Extension should show Blueprint in compatible system Share Sheets and remember the last destination.
- **Implemented as isolated source:** Branch `feature/native-share-extension-staging`, [draft PR #41](https://github.com/jgoldslice/dc_64_33/pull/41), based on live `main` commit `80483390389b4b5de58c0fe8c64e301fa6f0be43`. Added `native-share-extension/BlueprintShareInbox.swift`, `BlueprintShareViewController.swift`, `BlueprintSharePlugin.swift`, `web/inbox.js`, `web/host-entry.js`, `Tests/BlueprintShareInboxTests.swift`, `README.md`, and `tests/blueprint-share-inbox.spec.cjs`. No production web entry point, storage schema or backup format was changed.
- **Architecture:** The extension reads a lightweight project-list snapshot from a shared App Group, shows a project picker with last-used selection, copies transient NSItemProvider files within their completion callbacks, and atomically queues validated envelopes with SHA-256 checksums. It does **not** claim a queued file is already imported. The installed native app's opt-in Capacitor bridge imports the item to the existing IndexedDB + Library manifest, verifies readback and `save(true)`, then acknowledges and removes the queued envelope. Missing projects, storage failures and corrupt files are retained for retries. A corrupted queue manifest is reported without blocking unrelated valid pending items.
- **Automated-test verified (JavaScript only):** [GitHub Actions run 43090016639](https://github.com/jgoldslice/dc_64_33/actions/runs/43090016639) passed **205 Chromium tests** on source commit `c59f9f627ee143fbcde5d630eb553dc41fd4d24b`, including 7 new importer regression scenarios and the existing Blueprint browser suite. Earlier run 43088818191 failed because a new test fixture omitted its default argument; that issue was corrected. The latest passing CI only verifies the JavaScript importer and existing browser app, **not** Swift compilation.
- **Native tests:** Swift XCTest source is authored but **not compiled/run** (requires actual Xcode target). iOS Share Extension target, Info.plist activation rules, App Group signing entitlements, plugin registration, native app asset inclusion, real iPhone verification and Capacitor synchronization are **pending**. No native deployment and no Share Sheet integration in the live web app have occurred.
- **Next action:** On Mac, inspect actual Capacitor/Xcode project before changes; export complete Blueprint backup. Follow `native-share-extension/README.md` to wire target and entitlement; compile/debug, open installed Blueprint once to publish project index, share from Photos/Safari/Files, validate queue-to-Library import and offline/error recovery. Do not merge/deploy draft until native tests and physical iPhone verification pass.

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
| iOS build/deployment | Web v9.21 published; native build unverified | Test the published GitHub Pages site and inspect local Capacitor/Xcode app separately |
| Documentation / agent continuity | AGENTS.md available | Follow and maintain these files |
| iPhone Safari form focus zoom | Implemented and Chromium regression-suite verified | v9.20: 16px touch text-entry minimum; physical Safari check pending |
| Project capture modal oversized resource buttons | Fixed in v9.21; browser-suite verified and web published | Compact 44px switch, matching file picker, flex sheet; iPhone device confirmation pending |
| Native iOS Share Sheet into project Library | Draft source implemented; JS tests passed; native unverified | PR #41; real Xcode extension/App Group/plugin registration and device QA pending |

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
| 2026-11-11 | Native Share Extension source staged on feature branch (PR #41) | 205 Chromium tests passed (run 43090016639); native Swift not compiled; Xcode/physical iPhone unverified; no deployment |

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
