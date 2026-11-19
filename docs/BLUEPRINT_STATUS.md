# Blueprint — Development Status

**Last documentation update:** 2026-11-18  
**Repository:** https://github.com/jgoldslice/dc_64_33  
**Baseline commit inspected before adding these documentation files:** `05c6e74dbf4a1df2719a4aeba28076a8a113fe88`  
**Verification scope:** Fetched root README and index.html; checked that AGENTS.md and this status file were absent; inspected recent commit identifiers. This is **not** a full source-code audit, automated test run, or iOS device test.

> **Operating rule:** Update this file after substantive development. Separate verified current state from the owner's design requests and past reports. The default branch's live commit and test status can change between chats; fetch them again.

## 2026-11-18 — v9.43 Plan Add actions follow cards (feature branch; automated/device QA pending)

**Owner screenshot and request:** On the Tasks tab the `+ Task` row still occupies empty space between the Plan tabs and the content cards. Place it *below* the task cards, so the first card is immediately under the tabs. Apply the consistent placement across Goals, Habits, and Area overview.

**Implementation on `feature/plan-add-buttons-below-cards-v943`:**
- Move the existing `data-open="task"` button after the Priority Order and All Tasks stack; move `+ Goal` after `#goalsList`, `+ Habit` after the tracker and management cards, and `+ Area` after the Area card grid.
- Retain the same delegated creation actions and accessible tab labels, card headings, item lists, goal/area relationships, and weekly planning entry. Use a compact 10px margin before the Add actions; no empty action row above the cards.
- `tests/plan-add-actions-v943.spec.cjs` exercises DOM and bounding-box placement at iPad and narrow-device widths, along with Task creation modal availability, other Plan sections, and Area ordering. `sw.js` cache key revised.
- No changes to storage, backup/export formats, PencilKit, native Capacitor files or task/habit/goal data.

**Verification:** Pending GitHub Actions and iPhone/iPad physical-device check. A GitHub merge does not rebuild the installed iOS app.

## 2026-11-18 — v9.42 compact Plan section headings (merged; browser verified; iPad QA pending)

**Latest owner request:** Remove redundant Plan page-level headings/subtitles such as "Areas", "Your responsibilities", "All tasks and priorities", and "Daily consistency" while retaining the section tabs, the Add actions, the actual Goal/Task/Habit cards and useful headings within those cards. This is a narrow presentation cleanup, not a data or model change.

**Implemented and merged from `feature/plan-minimal-headings-v942`:**
- `areas-v939.js` removes the duplicate Areas title and eyebrow from the Areas overview while preserving the `+ Area` button, responsive Area tiles, and accessible tab names.
- `index.html` removes Tasks and Habits helper subtitles and right-aligns their existing `+ Task` and `+ Habit` actions without altering card contents, names, progress or storage.
- `plan-layout-v910.css` and `areas-v939.css` close the empty gap between Plan tabs, action rows, and the cards. `sw.js` revs the asset cache. Existing browser tests for Areas were adjusted to assert the new minimal header, and `tests/plan-minimal-headings-v942.spec.cjs` was added.
- No changes to goals/tasks/habits records, IDs, attachment storage, PencilKit, backups, or Capacitor native files.

**Verification:** [GitHub Actions browser run #389](https://github.com/jgoldslice/dc_64_33/actions/runs/44466028347) passed **303/303 Playwright tests**, including the new compact Plan headings tests, and JavaScript syntax validation. [PR #70](https://github.com/jgoldslice/dc_64_33/pull/70) merged to main as `3630998efe7655ea3c94442a2c00d24529e726fd`. No physical-device QA, Capacitor/Xcode compilation, or native-app deployment was performed. The browser build can update independently of the installed iOS app.

## 2026-11-18 — v9.41 PencilKit viewport pinch/pan (merged; browser verified; native Xcode wiring/device QA pending)

**Owner request and iPad screenshots:** Native PencilKit tool picker and drawing are working, but while PencilKit is enabled the user cannot pinch zoom or move the Notes sheet with fingers; web-mode zoom and +/- buttons already exist. Preserve the native handwriting tool picker and existing strokes.

**Implemented and merged from `feature/pencilkit-viewport-gestures-v941`:**
- `v76.js` exposes a dedicated `handlePencilViewportGesture` bridge on `BlueprintNotesBridge`. The native events `start/change/end/cancel` move the existing bounded sheet zoom and scroll (50%–500%); zoom is centered on the previous finger midpoint, then moved to the latest midpoint, and the page-level scroll position is preserved. Stale events after page changes are ignored by the bridge. Touch interaction does not rewrite any note/drawing data.
- `pencilkit-inline-v936.js` listens for `blueprint:pencil-navigation` only while native drawing is active and rejects mismatching project/page identifiers. It schedules native `showInline` geometry refresh after viewport motion; web SVG mode and older native plugins are unaffected.
- `native-pencilkit/BlueprintPencilNavigation.swift` adds a **separate, optional native helper** that attaches finger-only recognizers to the existing native PKCanvasView, keeps the Pencil for ink, and sends JSON-encoded navigation events to the WKWebView. Uses associated-object retention to avoid adding stored state to the existing native plugin. `native-pencilkit/README.md` documents the required minimal hook and QA.
- `tests/pencilkit-navigation-v941.spec.cjs` adds browser tests for simulated native pinch, pan, zoom limits, drawing-data preservation, and inactive/stale events. `sw.js` cache revision bumped.

**Important limitations:** The actual current native `ios/App/BlueprintPencilPlugin.swift` resides on the owner's Mac and is **not in this GitHub repository**, so it could not be modified or compiled through GitHub. The helper will **not run** until the owner integrates it into the Xcode app target and adds `BlueprintPencilNavigation.install` from the existing `showInline` native canvas path. Native content alignment, gesture recognizer priority, touch behavior, and PKToolPicker availability require physical iPad verification. Native drawings remain separately stored and outside the complete Blueprint backup/sync flow.

**Verification:** GitHub Actions [browser run #385](https://github.com/jgoldslice/dc_64_33/actions/runs/44463827245) completed successfully: **301/301 Playwright browser tests passed**, including four new native-gesture simulation cases, and JavaScript syntax checks passed. PR [#69](https://github.com/jgoldslice/dc_64_33/pull/69) merged to `main` at `6f3cb671481343871c666a96ab6036d00b37018c`. No Swift/Xcode compilation, native-plugin modification, install, or real iPad touch/Apple Pencil testing has been performed. Swift helper is **source provided only** until manually integrated into the local plugin.
## 2026-11-18 — v9.40 Area context menus (merged on main; browser verified; iPad QA pending)

**Owner request and screenshot:** Remove the redundant Manage Areas panel and header control. A normal tap on an Area card should still open it, while pressing and holding on the card should open a small menu with Rename and Delete. Preserve the current compact iPad Plan layout.

**Implementation merged from `feature/areas-long-press-menu-v940`:**
- `areas-v939.js`: delegated pointer long-press (520 ms) with drag/scroll/cancel handling, suppressed card click after a hold, native `contextmenu` for mouse/trackpad and Shift+F10 / ContextMenu for keyboard. Popup contains Area name, Rename, Delete, Cancel; Escape and outside-tap dismiss it. The virtual Unassigned tile has no rename/delete, since it is not a saved Area.
- Existing rename logic updates goal category and explicit task/habit/project area references. Existing delete logic refuses to remove Areas with linked items and confirms deletion of empty Areas. No data schema or backup change.
- `areas-v939.css`: small anchored iOS-style context menu with accessible tap targets, no native text selection/callout on Area cards, removed unused Manage Areas styling. `sw.js`: new offline cache revision.
- `tests/areas-v940-context-menu.spec.cjs`: browser regressions for normal tap, context menu on right-click, touch hold click suppression, scroll cancellation, keyboard menu, rename propagation, protected populated deletion, confirmed empty deletion.

**Verification:** [GitHub Actions browser smoke run #382](https://github.com/jgoldslice/dc_64_33/actions/runs/44461023057) passed JavaScript syntax checks and **297/297 Playwright tests** (including five new Area-menu interaction regressions). [PR #68](https://github.com/jgoldslice/dc_64_33/pull/68) merged to main as `6dc52055951e8a8e363b880616c7c89958117955`. The browser tests simulate touch input, but iPad Safari long-press behavior remains **physical-device unverified**. GitHub Pages publication, iOS Xcode compilation, and native-app installation were not independently verified. The local Capacitor/Xcode app is not changed by GitHub publication.

## 2026-11-18 — v9.39 adaptive Plan → Areas dashboard (merged; browser QA passed; iOS QA pending)

**Owner-approved design:** Version B (compact cards), no goal progress bars in the Area dashboard. Areas may contain any combination of goals, independent tasks, habits, and Brainstorm projects; an Area with only tasks/habits is valid. The Plan tab opens on Areas, with one adaptive dashboard per Area.

**Implemented and merged from `feature/areas-dashboard-v939`:**
- `areas-v939.js` and `areas-v939.css`: responsive Areas overview and single-Area dashboard; hide missing/empty sections; show a useful empty-Area welcome; show up to three records per section with See all; expand goals to reveal their associated steps/tasks/habits without duplicating them in independent task/habit cards. No progress bars in these new Area cards.
- Reuses the existing `state.categories` and `goal.category` as the Area source of truth, keeping original category labels and older saved records intact. Tasks, habits and projects acquire *optional* additive `area` fields in the existing planner JSON. Goal-linked tasks/habits inherit the goal's Area dynamically; project-linked tasks can inherit their project's Area. Unassigned records remain accessible in a conditional Unassigned tile.
- Add to Area offers Task, Habit, Goal and Project with default Area assignment. Existing task/habit/goal dialogs have Area choices; existing projects can be reassigned from their Area dashboard. Renaming an Area updates explicit assignments, and deletion is refused while records still reference it. Deleting a goal preserves its Area on formerly linked tasks/habits.
- Existing Today/Week planners, the other Plan panels and the Weekly Blueprint launcher remain intact. No migration, new localStorage key, IndexedDB changes, note/PencilKit changes, attachment changes, data reset or backup-format version bump. New assets were added to `sw.js` and its cache key incremented.
- `tests/areas-v939.test.cjs` exercises goal inheritance, independent task/habit-only Areas, projects, unassigned records, old assignments and HTML/cache wiring.

**Verification:** GitHub Actions browser smoke run [#377](https://github.com/jgoldslice/dc_64_33/actions/runs/44459169208) **passed 292/292 Playwright browser cases** and JavaScript syntax checks on feature head `4c2d282bdf5ca9c201e9668c390de7881c218dd5`; this includes two new browser tests for independent task/habit-only Areas and Goal-inherited tasks. PR [#67](https://github.com/jgoldslice/dc_64_33/pull/67) merged to main as `ee9df6b29ed915038354635ad0e5aae2db32a4ab`. The eight standalone Node model cases in `tests/areas-v939.test.cjs` were authored but **not separately executed**. No Xcode compilation, real-iPhone or real-iPad testing, or install was performed. The separate local Capacitor/Xcode wrapper is **not** automatically updated by this GitHub merge.

**Release/QA:** Before installing on a real device, verify existing JSON backup/export/import, add/rename/delete Areas, Goal inheritance, no-goal/no-project Areas, unassigned records, task/habit updates, project navigation, iPhone compact width, iPad Split View and offline reload. Preserve local data, use the checked-in `scripts/stage-ios-web.py` staging command when preparing a native build, then `npx cap copy ios` and install via Xcode without deleting the existing app.

## 2026-11-18 — v9.38 compact Notes toolbar: Textbox size menu and PencilKit label (web committed; iPad QA pending)

**Latest owner request:** Clean the Notes toolbar by combining font size into the T/Textbox tool, remove the visible Web tools switch, and use the constant label **PencilKit** rather than alternating "Draw on page" and "Edit content".

**Implemented on main:**
- In `v76.js`, the original Textbox action stays one tap to place a text box. A small chevron in the same compact split control opens the existing `#v80TextSize` selector in an accessible, viewport-positioned popover (Small/Medium/Large). This reuses all current page defaults, selected-box font-size updates, caret/data-saving logic and backup format. Escape, outside tap, selecting a size, primary T action, scroll and resize dismiss the popover. `v76.css` styles the combined control and uses 16px in the size selector to avoid iOS input zoom.
- In `pencilkit-entry-v92.js`, the **Web tools** switch is removed from the UI, while older SVG code/data are fully preserved. The redundant web pen/eraser/lasso/colors/ink undo and Save sketch group collapse **only** when the native Swift plugin reports `embeddedAvailable:true`; browsers and older unsupported native versions retain the original controls as a fallback.
- `pencilkit-inline-v936.js` uses the stable **PencilKit** label in regular Notes and Focus regardless of active/inactive state; `aria-pressed`, styling and descriptive accessibility labels indicate drawing state. Native `PKToolPicker` remains the ink toolbar, while Blueprint's text/image/page tools remain available.
- Updated regression tests `tests/pencilkit-toolbar-v934.test.cjs`, `tests/pencilkit-inline-v936.test.cjs`, and `tests/pencilkit-focus-v937.test.cjs`; added `tests/notes-text-size-popover-v938.test.cjs`. Refreshed the offline cache key in `sw.js`. No Swift code, native drawing file format, note schema, saved SVG strokes, images, IndexedDB attachments, or backup format was changed.

**Verification actually performed:** All modified JavaScript files parsed with a V8 function parser. Thirteen focused test cases (font-size menu open/apply/dismiss; PencilKit-only toolbar and older fallback; native drawing/Focus state) passed when their committed test scripts were evaluated in an isolated V8 harness using mocked Node modules and simulated DOM/native bridge. This is **not** a full Node/Playwright or GitHub Actions test run, and there is no updated Xcode compilation or physical iPad verification in this session. The previously user-verified native drawing persistence is unaffected by source edits but was not retested. No local iPad deployment is claimed.

**Install:** From a current `~/Documents/dc_64_33` checkout `git pull --ff-only origin main` and run `python3 scripts/stage-ios-web.py ~/Documents/ChatGPT/dc6433/canvas-ios/www`; then in `~/Documents/ChatGPT/dc6433/canvas-ios` run `npx cap copy ios`, build/install with the existing Xcode App target. No new Swift installer needed for v9.38.

**Known limitation:** Native `PKDrawing` sidecars remain outside complete Blueprint backups and cross-device sync. Never delete/clear legacy ink or local app data as a shortcut; native PencilKit drawing and Focus presentation need real-device QA.

## 2026-11-18 — v9.37 native PencilKit in Focus mode (web committed; Mac/iPad installation pending)

**Owner-reported device finding:** In-page native PencilKit now works in normal Notes on iPad, but entering Focus loses the native tool picker and the old web Pen tools are unavailable. This is **not** evidence that the native drawing files were lost.

**Root cause verified in current code:** `notes-workspace-v928.js` physically reparents `#v76Editor` to `document.body` in Focus mode, hides the usual Notes toolbar, and automatically sets the web SVG pen. Meanwhile `pencilkit-inline-v936.js` computed the native viewport clip using `#projectNotes`, which is no longer a visible ancestor during Focus. That sends empty geometry and removes the native overlay/PKToolPicker. The Focus menu only included legacy SVG actions.

**Implemented in GitHub (web):**
- `pencilkit-inline-v936.js` clips native ink to the moved `#v76Editor` when focused, not the hidden former `#projectNotes` pane. Focus state is included in the `showInline` payload so native code can reacquire PencilKit tool-picker visibility once on each Focus transition.
- Adds compact **Draw with PencilKit / Edit content** to the existing Focus header; entering Focus activates native drawing. The native tool picker handles pen, eraser, lasso, color and undo when available.
- `notes-workspace-v928.js` signals Focus enter/exit via `blueprint:notes-focus-change`, and does not activate the old SVG pen on supported native devices. Browser/PWA and older native builds retain web Focus tools.
- `notes-workspace-v928.css` removes legacy **Tools**, **Web tools** and legacy ink menu from the supported iOS presentation while preserving source code and all existing SVG strokes for fallback/recovery. No permanent deletion, migration or modification to existing note data.
- `tests/pencilkit-focus-v937.test.cjs` adds simulated DOM coverage for Focus clipping, native editing, content editing, returning to normal Notes, and unsupported native fallback; `sw.js` cache version refreshed.

**Separate local Swift patch package:** `blueprint-pencilkit-focus-v937.zip` includes a guarded installer that updates only the known Xcode-compiled top-level `ios/App/BlueprintPencilPlugin.swift`, **not** the duplicate file in `ios/App/App`. It backs up the original and adds `focused` handling and a re-assertion of the `PKToolPicker` first responder only after Focus transitions, not on every scroll event. It does not change `PKDrawing` files, the drawing storage layout, App Group sharing, or the web backup format. The installer refuses unknown source structures and is idempotent.

**Verification:** Current inline JS source parsed in a V8 JavaScript function parser. A simulated run of actual `pencilkit-inline-v936.js` confirmed ordinary Notes mode, Focus mode with the old Notes pane having a zero-width bounding rectangle, visible positive-size Focus clip, native drawing mode and Focus header controls, return to content editing, Focus exit, and older plugin fallback. Standalone Swift parser `swiftc -frontend -parse` passed for the native reference patch; guarded installer logic was exercised using a test Xcode-style file and a Swift parser shim, including repeat-install no-op. GitHub test file was committed but full GitHub Actions/Playwright and physical iPad Focus testing are **not** confirmed. The actual local Mac Swift app is not modified by pushing GitHub.

**Release gates:** Install the narrow Swift patch and stage current GitHub web files, run `npx cap copy ios`, build/install via Xcode without deleting the app, then verify normal/Focus transitions, native toolbar, finger pan/pinch, 50/100/200% zoom, page changes, Done, and relaunch persistence. Native `PKDrawing` sidecars are still separate from SVG/text/image notes and excluded from complete backups and cross-device sync. Do not delete legacy ink or reset storage.

## 2026-11-18 — v9.36 opt-in in-page PencilKit preview (Swift installation and iPad QA pending)

**Request:** Owner confirmed that the previous "Native ink" still opened a full-screen test page. This was expected from its actual `openEditor` implementation: the v9.35 change only collapsed redundant web ink buttons, and did not embed PencilKit. The requested behavior is drawing on the existing Blueprint Notes sheet, with native Apple drawing tools and web text/images/pages preserved.

**Implemented in GitHub web app:** Added `pencilkit-inline-v936.js`, loaded after `notes-workspace-v928.js` in `index.html`, precached by `sw.js`, and styled in `v76.css`. The script is strictly gated on iOS `BlueprintPencil.capabilities()` returning `embeddedAvailable:true`. On supported native builds it replaces the full-screen entry button with an opt-in **Draw on page / Edit content** toggle. It relays current project/page IDs, unscaled page dimensions, zoomed on-screen surface bounds, and clipped viewport bounds through Capacitor's proven `nativePromise` bridge. It refreshes on page changes, project/nav clicks, scroll, resize, rotation and view visibility changes, and hides the native overlay when Notes is no longer visible. Existing unsupported native builds keep the full-screen button and the complete web drawing fallback. No planner JSON/IndexedDB schema, SVG strokes, text, images or backup formats are modified.

**Native Swift patch provided as a separate install ZIP (not in this web-only repository):** Updates existing `BlueprintPencilPlugin.swift` with `showInline`/`hideInline` and `embeddedAvailable:true`, plus a transparent, logically scaled and clipped `PKCanvasView` added on top of the current WKWebView Notes viewport. `PKToolPicker` is shown only when drawing. In web text/image mode the native overlay remains rendered read-only but passes interaction to the web page. The native coordinator uses the *same* Application Support hashed project/page `PKDrawing` sidecars as the existing tested full-screen editor, saves changes with a short debounce and on app background and leaves unreadable files untouched. In case of a save failure it retains drawing in memory rather than removing the view. The existing full-screen `openEditor` remains in the native plugin, and the web app preserves the older full-screen launcher if the inline capability is absent or initialization fails.

**Verification actually performed:** On Linux, `swiftc -frontend -parse` passed for both Swift source files (syntax-only, without Apple SDK typecheck); installer shell syntax checked. In a simulated JS DOM running the actual GitHub JS source, the supported-capability path showed the native overlay read-only on the current Notes page, selected in-page drawing on toggle, returned to web object editing, switched the native drawing to another saved page, hid the overlay after leaving Notes, and preserved the old modal entry on an older capability response. The script was JS-syntax parsed. Added `tests/pencilkit-inline-v936.test.cjs` with similar cases. **GitHub Actions/Playwright, Xcode compilation and actual iPad inline/touch/zoom tests were not run in this session.** This is an experimental opt-in stage, not a device-verified or deployed replacement.

**Important iPad QA gate:** Test the Pencil-only touch routing, finger scroll/pinch passthrough, coordinate alignment at 50/100/200% and after scrolling/rotation/Split View, native tool-picker visibility, switching pages/projects, return to the Today tab, and reopen/relaunch persistence. For this stage, native ink is still saved as a separate sidecar, excluded from Blueprint's complete backups and cross-device sync. Keep older web drawing intact, do not uninstall the app, do not use meaningful irreplaceable native drawings until backup/export is integrated. If the inline mode misaligns or blocks touch, use the existing web drawing fallback or revert only the native Swift files from the timestamped installer backup.

## 2026-11-18 — iOS Notes PencilKit-first toolbar (web-side implementation; device QA pending)

**User request:** Replace Blueprint's duplicate ink controls with Apple's PencilKit toolbar, or at least reduce the duplication. Native `PKToolPicker` lives inside a native `PKCanvasView`; it cannot be mounted directly over the existing HTML/SVG surface without an embedded UIKit canvas and coordinated coordinates/gestures.

**Implemented on main:** In `pencilkit-entry-v92.js`, the native-only **Native ink** launcher moves into the Pen group position in the Notes toolbar. After the currently installed iOS plugin explicitly confirms `capabilities.available===true` and `schemaVersion===1`, the old web pen/eraser/lasso/color/ink-undo group and web **Save sketch** control collapse; an accessible **Web tools** button restores or hides them for editing existing SVG strokes. On older/unsupported native builds, the original SVG controls stay visible and functional. Switching away from legacy SVG ink also changes the web mode to Select to prevent an invisible SVG overlay consuming Pencil/touch input. Text, image, page and zoom tools are untouched. `v76.css` styles the primary button and collapsed group. `sw.js` cache ID updated. `tests/pencilkit-toolbar-v934.test.cjs` adds native-supported, toggle-restoration, missing-plugin, and old-schema test cases. No native Swift code, planner storage, migration, drawing content, or complete backup formats modified.

**Verification:** Current JS source parsed successfully with a JavaScript function parser. A pure JavaScript simulated DOM exercise of the actual source confirmed that supported native capability collapses the old pen and sketch groups, Web tools toggles restore/re-collapse, Native ink invokes `openEditor` and resets the button, and unsupported builds preserve all old tools. GitHub test file committed but Node/Playwright CI results and physical iPad toolbar layout/performance are **not yet verified** in this session. Installed iOS app is not updated by this push; web staging, Capacitor copy and Xcode build/install are required.

**Limitations:** The floating Apple tool picker is still shown in a separate full-screen native editor—not directly in Blueprint's web Notes page. Existing SVG marks and native `PKDrawing` sidecars are separate, and native drawings are still excluded from existing complete backups. Next architecture work is mixed-content embedding with coordinated pan/zoom and non-destructive native backup export/restore; do not remove legacy editor yet.

## 2026-11-18 — Native PencilKit persistence verified by owner on iPad

**Physical-device verification (owner report):** In the installed local Xcode build, native PencilKit launches from Blueprint's project Notes, accepts Apple Pencil ink, persists the drawing after tapping Done, reloads the same project/page drawing when reopened, and retains it across closing and relaunching Blueprint. This supersedes the earlier reports that the button remained stuck on Opening and that `capabilities` timed out on an older build. Exact current native Swift source/commit, measured latency, multi-page isolation, crash recovery, and full backup/restore are **not** independently verified.

**Safe next integration boundary:** Native `PKDrawing` remains a separate Application Support sidecar, not rendered inline with SVG, text or image objects in the web Notes page. It is not part of the current Blueprint complete backup. Do **not** silently switch all Notes users to native ink or discard existing strokes. Before making PencilKit the default ink engine, implement a non-destructive export/import roundtrip for the sidecars, test old backup compatibility, and establish a shared page coordinate/zoom model with UIKit touch forwarding. Then link toolbar modes to the embedded native canvas and test Apple Pencil and finger gestures on real iPad.

**Status:** Native test editor and per-page retention: device-verified by owner. Unified Notes UI / native backup: requested, not yet implemented. No GitHub changes to the native wrapper made in this status update.

## 2026-11-18 — PencilKit stuck on "Opening…": native response lifecycle fix (device QA pending)

**Owner report:** The new native-ink toolbar button stays on "Opening…" and the native editor does not become visible. **Confirmed code bug:** In the separately installed Swift prototype package, `openEditor` resolved the Capacitor promise only inside the editor's `onClose` callback. The current web action awaited that promise before restoring the button, so it could appear permanently busy. This explains the pending label; an invisible native view may have an additional UIKit presentation problem not verifiable without Xcode logs.

**GitHub implementation:** Updated `pencilkit-entry-v92.js` to require an `opened: true` acknowledgement from the native editor and to time out native `capabilities` (8 s) / `openEditor` (12 s) calls with an actionable error and unconditional button recovery. Updated offline cache ID in `sw.js`; added `tests/pencilkit-open-response-v934.test.cjs` as regression coverage. No localStorage, IndexedDB, notes schema, SVG ink, or backup logic altered.

**Local Swift patch, separately packaged:** `BlueprintPencilPlugin.swift` now resolves `openEditor` after the UIKit navigation controller finishes appearing, rather than after dismissal, and rejects failed presentations. The Swift plugin and drawing view also print `BLUEPRINT PENCIL` request/presentation/appearance logs for debugging. `BlueprintPencilViewController.swift` otherwise retains autosave, explicit save-on-Done, page-specific Application Support sidecars and Pencil-only drawing. The files must be installed in the separately maintained `canvas-ios` local App target; not committed to this web-only GitHub repository. Existing native Share plugin is unchanged.

**Actual verification:** A local Node `node --test` harness passed six mocked JavaScript flow checks (successful open, unresolved open timeout, missing capabilities, stale native response, web-only guard, invalid page guard). Linux `swiftc -frontend -parse` succeeded for both Swift files (syntax-only; not type checking against Apple's SDK). Neither the updated Swift code nor the new GitHub test file has been built/run in Xcode/Playwright CI in this session; physical iPad retest is pending.

**Important limitations:** Native `PKDrawing` sidecars are still excluded from Blueprint's complete backup and are separate from existing SVG/text/image layers. No automatic mixed-canvas/toolbar tool mapping or sync is claimed. Do not uninstall the app or delete local data to troubleshoot.

## 2026-11-18 — PencilKit entry diagnostics and Notes toolbar placement (device QA pending)

**Reported by owner:** The original Swift test editor compiled and opened on iPad, but the follow-on `PencilKit` web action did nothing. The optional `pencilkit-entry-v92.js` previously hid its action until an asynchronous `capabilities` call succeeded, swallowing errors; this could make a stale local Swift plugin or stale staged web build look like a dead button. The local wrapper and native files cannot be inspected from GitHub.

**Implemented on main:** Native-only `Native ink` action now appears in the existing Notes toolbar (with project-header fallback) and reports actual errors for missing `capabilities` / `openEditor`. It obtains stable project/page identifiers from `BlueprintNotesBridge.current()`, not an uninitialized raw page list, and calls the manually registered Capacitor 8 plugin through `nativePromise`. It continues warning that sidecars are not in complete backups or visible in the mixed web page. No automatic launch, PencilKit canvas embedding, SVG migration, or toolbar-to-native tool remapping is claimed. Cache version bumped to invalidate prior JavaScript.

**Verification:** Code reviewed, not run in browser CI or current iPad binary. User must stage new web bundle and ensure the two upgraded local Swift files from the separate installer were installed. Xcode compilation, persistent reopen, autosave, undo, pan/zoom, and restore remain unverified. Full native integration requires a coherent mixed-content coordinate/rendering model, PencilKit tool control APIs and audited backup roundtrips; do not simply replace SVG Notes.

## 2026-11-18 — Native PencilKit sidecar integration (local installation required)

**Verified by owner on physical iPad:** The initial local Xcode PencilKit prototype compiled, registered as `BlueprintPencil` and opened successfully through `Capacitor.nativePromise('BlueprintPencil','open',{})`. The existing app and native Share plugin continued running. This confirms the *prototype* only, not the new persistent editor.

**Repository implementation:** Updated `pencilkit-entry-v92.js` to communicate over Capacitor 8's verified `nativePromise` path, check `capabilities` before showing the existing PencilKit project action, and use `openEditor` with the existing project/page identifiers. The prior optional entry did not work with the owner's explicitly registered Capacitor 8 plugin, which was missing from the JavaScript global proxy registry. Updated service-worker cache identifier to load the revised entry. No existing SVG stroke schema, page data, backup format, web drawing behavior, or native Share integration was modified.

**Local Swift integration provided separately:** Revised `BlueprintPencilPlugin.swift` and `BlueprintPencilViewController.swift` source package for the owner's separate `canvas-ios` Xcode project, which is **not maintained in this repository**. The revised `capabilities`/`openEditor` plugin uses a stable project/page-scoped Application Support sidecar, PKDrawing serialization, save-on-change debounce and save on background/close, native drawing tools, Pencil-only inking and touch pan/zoom. On read/decode failure the editor rejects rather than overwriting unreadable art. Existing native `open` remains a disposable diagnostics route. **Not built or tested in Xcode yet**; the owner must install both files, build, and run save/relaunch/pan/zoom device QA. Do not claim native production deployment.

**Data limitation / release blocker:** These PencilKit files are *outside* the existing complete Blueprint backup/export and do not sync to other devices; no export/import or coordinated migration of native art into the mixed text/image/SVG note layer has been implemented. UI explicitly retains the warning. Until an audited native-backup integration exists, this is an opt-in experimental sidecar editor for disposable test notes. Never uninstall/erase the app or rely on existing complete backups to protect native test drawings. Work remains to add verified, non-destructive native drawing backup/restore and mixed-content presentation.

**Verification:** Repository edits reviewed against current `v76.js`, `pencilkit-entry-v92.js`, existing backup contract and current status. No GitHub Actions, automated browser tests, Swift compilation, or persistent-device QA run for this change. 

## 2026-11-18 — v9.33 ready for Xcode device testing

Integrated the Weekly Blueprint recovery and Goal Step navigation fix, nested planner and backup validation, and the simplified web compass icon. Weekly Step move/delete buttons now update the draft, while the planning stage controls navigate between stages. The browser suite passed on weekly fix `c39212ab`. [PR #64](https://github.com/jgoldslice/dc_64_33/pull/64) merged as `75d15ead7d4020e980cafc3f95c61e35bece68b7`. [Combined Chromium CI](https://github.com/jgoldslice/dc_64_33/actions/runs/44408766988) passed all 290 tests on `a5b0e828`. The release scan also verified all 45 HTML asset references against the offline manifest, all 46 precached files, and standalone and inline JavaScript syntax.

On the Mac, run `python3 scripts/stage-ios-web.py ~/Documents/ChatGPT/dc6433/canvas-ios/www` from an updated web checkout after fetching origin/main. The helper copies the service-worker asset list from that revision and preserves recognized local native-share script tags. It stops before copying if a managed file has unfamiliar edits. In the wrapper run `npx cap copy ios`, open the existing Xcode project and run the App scheme on each device. A fixture exercised the asset update, preservation of a native share hook, a repeated run, and rejection of a customized asset. Physical Pencil input, Share Extension import, and suspend/relaunch still need device QA. The native home-screen AppIcon is managed in the separate Xcode asset catalog.

## 2026-11-18 — v9.33 nested saved-data protection (review branch)

**Issue confirmed in latest main:** Startup guarded malformed JSON and top-level arrays, but nested malformed task/goal/habit/project records could be silently dropped or normalized to empty content on the next save. That could erase damaged user data before recovery.

**Implemented on `feature/v933-nested-data-guard`:** Before normalizing stored planner JSON, validate that known collections contain object records (not null, primitives or arrays), that Goal/Idea Step collections and Project Library/Notes/page collections are arrays when present, and that habit completion maps, schedules and editable ink point arrays are structurally valid. If any known field is malformed, preserve the exact raw original data, disable saving, and offer raw recovery export. Do **not** impose a new schema on unknown future fields or absent optional legacy fields. No user content, IDs, backup formats, or native code migrated.

**Tests:** Adds `tests/nested-storage-guard-v933.spec.cjs` with eight malformed nested-data startup scenarios, exact-byte write protection and partial legacy snapshots. Also extends the `v74.js` complete-backup validator to reject malformed nested structures *before* importing any files, including a checksum-valid v2 archive. New `tests/nested-backup-guard-v933.spec.cjs` covers four damaged archive types and confirms existing storage is unchanged. Missing optional legacy fields and historic plain-text project Notes remain accepted. CI and physical iOS testing pending. No data reset or CloudKit.


## 2026-11-18 — v9.33 Phase 4/5: relationship integrity and small-screen readability (feature PR; QA pending)

**Implemented on `feature/v933-linked-record-polish`:**
- Removing a Goal Step now removes a recurring Habit's obsolete `actionId` but preserves its `goalId`, weekly target, schedule, check-in history and metadata. A habitual behavior still supports the parent Goal after its individual Step is deleted. Goal-linked Tasks keep the existing explicit Step unlinking behavior.
- Editing existing Goal Steps preserves their additional/unknown metadata rather than reconstructing the object with just ID/title/done. Event, Task and Habit extra fields remain intact during their editors' normal `Object.assign` updates.
- Two-line titles with anywhere wrapping in Project Overview and Library image cards avoid truncating long descriptions into illegible one-line snippets. Card visuals, touch targets, drag reordering and resource IDs are unchanged.
- Regression tests: `tests/goal-relationship-v933.spec.cjs` covers deleting a Goal Step and retained Habit/Task relationships, extra Goal Step fields, Event/Habit data, and persistence. `tests/responsive-polish-v933.spec.cjs` covers 320px–1180px viewport widths and preservation of in-progress Event form entries when the selected week changes.
- Changed `index.html`, `library-order-v923.css`, `project-overview-v919.css`, `sw.js`, and two test files. No migrations, native project edits, new persisted fields, or modification to existing note ink.

**Verification status:** Browser CI and device QA pending. Responsive browser widths are simulated—not physical Split View/Dynamic Type measurements. No Xcode/Capacitor synchronization performed.

## 2026-11-18 — v9.33 Weekly Blueprint recovery and safe saves (latest-main release branch)

**Implemented in `feature/v933-weekly-release`:** Corrupted/unreadable Weekly Blueprint draft JSON is write-protected with a raw export/confirmation-gated reset UI. Rapid free-text edits are batched and flushed on blur, visibility changes, pagehide and unload; immediate actions and Apply/Undo remain immediately saved. Failure to save leaves the draft in memory and provides an exit warning. When planning removes a Goal Step, the related Habit retains its parent Goal, with only the obsolete Step link cleared, and preserved step metadata survives editing.

**Critical fix:** The first weekly draft branch passed 267/268 browser tests but had a null-draft dereference in its recovery path. This release branch explicitly guards `draft` before accessing `selectedDay`, and includes the dependent Goal–Habit improvements from the later branch.

**Tests:** `tests/weekly-draft-v933.spec.cjs` exercises rapid draft editing, background flush, corrupt-draft export/reset, quota warnings and linked Goal/Habit behavior. Full browser CI and physical-device QA are pending. No schema migration, native Swift code or PencilKit integration.

## 2026-11-18 — v9.33 Media-save safety (reapplied to latest main; CI pending)

**Confirmed risk:** The legacy Notes image-block Delete path previously deleted its attachment even if the updated planner manifest failed to save. Sketch Save could overwrite a prior image and clear its drawing/draft before verifying that the Library metadata was durable.

**Implemented in `feature/v933-media-save-final`:** Notes image-block deletion now verifies the manifest before deleting unreferenced bytes; failures restore the block. Saving a sketch writes a new image key and commits its Library metadata with `save(true)` before clearing the drawing/draft or reclaiming an older image. Failed and ambiguous saves keep both versions recoverable. IndexedDB/blob and backup formats are unchanged.

**Verification:** Same code passed [267/267 tests](https://github.com/jgoldslice/dc_64_33/actions/runs/44406014179) on the earlier branch, before reapplication against the updated Goal/Habit branch. Re-run full CI on this merged-ready head; device QA remains outstanding.

## 2026-11-18 — v9.33 Phase 2: autosave, targeted rendering and Library loading (feature branch; QA pending)

**Implemented on `feature/v933-performance`:**
- Ordinary text input for Today/Week focus, opening message, Brainstorm draft and project notebook is batched (250 ms) and flushed on blur, pagehide, visibility hidden, beforeunload, or any immediate planner save. Existing cross-window stale-write guard remains the single writer; no new cache or data store. The draft indicator says Saving… until actually persisted.
- `render('habits')` updates Habit tracking and associated Goal progress without recreating tasks/calendar; `render('tasks')` updates Today/Plan tasks, priorities, affected weekly calendar and related Goals/Ideas without rebuilding Habit checkboxes. Structural edits still call full `render()`. The Weekly Blueprint wrapper forwards partial-render scopes.
- Task ordering is sorted once per render and looked up from an ID→rank map, instead of sorting priorities for every row.
- Hidden project Notes/Actions/Library/Sketches no longer redraw whenever the project overview refreshes; panels render on open. The Library only reads blobs for images approaching the visible viewport using IntersectionObserver, releases image URLs/observers when leaving and guards stale asynchronous results.
- Changed `index.html`, `weekly-blueprint-v918.js`, `sw.js`; added `tests/blueprint-performance-v933.spec.cjs` with real browser tests and a 600-task timing comparison.

**Verification:** Static inline-script parsing passed. Full browser CI and timing results not yet confirmed. Actual iPhone/iPad touch, low-memory, Split View and Pencil behavior remain physical-device QA gates. No native Swift/Capacitor files touched, no migration and no schema/backup format change.

## 2026-11-18 — v9.33 Phase 2/3: focused renders and efficient project loading (review branch)

**Implemented in `feature/v933-performance`:**
- Added a 250 ms batched text-save pathway for ordinary Focus, brainstorm draft, opening message and project notebook typing; immediately flushes outstanding text on blur, visibility-hidden, pagehide, and beforeunload. Task/event/habit/check actions still call immediate save, which also flushes pending text state. Existing saved-data guards and retry/recovery warnings remain in effect.
- Task priority ranks are computed once per full or task-focused render instead of sorting every time a task row is displayed.
- Extracted focused Task and Habit render functions. Task checkbox changes redraw task lists, weekly calendar and dependent goals/ideas; Habit checkbox changes redraw habit sections and dependent goals. Structural changes still call full render, preserving the legacy fallback. The Weekly Blueprint overview wrapper now forwards render scopes.
- Project renderer no longer rebuilds unrelated hidden Library, action, sketch, or notebook panels on every project visit. Its Overview previews refresh when that panel is visible. Library thumbnails are read lazily using IntersectionObserver, with a no-observer fallback and per-project stale-response guards. Original media keys/bytes remain untouched.
- `tests/performance-v933.spec.cjs` covers typing/blur/background saving, targeted DOM stability, hidden Library behavior and a reproducible browser planner stress dataset (220 tasks, 36 habits and 35 goals). It logs browser timings but does not claim device speedups without measurement.
- No framework migration, storage schema change, native Swift change or alteration to Notes ink data/backup formats.

**Verification:** Browser CI and responsive regression checks are pending on this feature branch. Physical iPad/iPhone performance and native Capacitor/Xcode validation remain outstanding. Review any timer failure or cross-window conflict before shipping; never infer device FPS from Playwright.

## 2026-11-18 — v9.33 Phase 1: guard local data and preserve task fields (merged)

**Requested:** Full app-wide reliability and performance overhaul; begin with preventing irreversible overwrites and preserving backwards-compatible backup/record formats.

**Implemented and merged:** [PR #50](https://github.com/jgoldslice/dc_64_33/pull/50), merge commit `960e8d9b644b5b2fe2fad8cadaba7a9719950386`.
- Startup rejects malformed or non-object planner JSON and invalid known collection shapes before enabling writes; original unreadable bytes are never overwritten by a normalized demo state. A persistent warning offers an exact raw-data export and blocks misleading complete-backup exports. Existing data and the storage key remain intact.
- Failed writes (including quota issues and cross-window changes) retain in-memory edits and expose a recovery export. Existing stale-manifest protection remains active.
- Edit Task preserves hidden `scheduledDate`, `scheduledTime`, project/idea links, completion status and other uninvolved properties. Changing parent Goal explicitly clears an obsolete Goal Step link without erasing independent project links.
- Read-only Customize → Your Data → Check local storage audits persisted record counts and referenced IndexedDB blobs without modifying records; reports potential missing files and storage usage.
- Ported only the applicable parts of historical draft PR #43 onto current main; did **not** merge the stale draft or native PR #40/#41.
- Added `tests/local-storage-v926.spec.cjs` for malformed data, safe recovery, missing attachments, quota failure and task-field preservation. Cache includes diagnostic file.
- Changed `index.html`, `v74.js`, `sw.js`; added `local-storage-health-v926.js` and tests. No schema key reset, migration, native Swift or PencilKit changes.

**Verification:** GitHub Actions [PR browser run 44401108946](https://github.com/jgoldslice/dc_64_33/actions/runs/44401108946) passed **250/250 browser tests**. Native iPhone/iPad QA is still outstanding; no installed app was changed.

## 2026-11-18 — Notes low-latency ink v9.32 (merged; physical-device QA outstanding)

**Requested:** Make handwriting visible sooner after Pencil contact and reduce the delay/sag between drawing and visible ink, without disturbing other Notes work.

**Root-cause analysis in current `v76.js`:** The existing drawing path recomputed a full pressure-sensitive SVG ribbon for every animation-frame update (including all preceding points) and called `getScreenCTM().inverse()` separately for every coalesced Pencil sample. This can become expensive on long pen strokes; first movement was also deferred to `requestAnimationFrame`.

**Implemented and merged:** [PR #49](https://github.com/jgoldslice/dc_64_33/pull/49) squash-merged into `main` as `779c6836bb8725b67cdabd05f3f4174e22578502` (feature head `4c7adacac2a4206e31f2d1a41d84d149f0de2e41`).
- On pointerdown immediately show the pen-contact dot. The first pointermove now writes its incremental SVG centerline immediately in the input handler, without waiting for the next `requestAnimationFrame`; subsequent moves batch into one animation-frame update. The preview appends only new sampled points; it does **not** recompute previous pressure-geometry on each movement.
- On pointerup (or Pencil pointercancel) refine the single live SVG path into the existing smooth, fully pressure-sensitive filled outline. The original complete x/y/pressure point arrays, ink IDs, color, width, undo, pen-versus-finger ownership, lasso, export, storage and backup formats are unchanged. The preview is deliberately a fast centerline; complete pressure shaping becomes visible on stroke completion.
- If WebKit supplies predicted Pencil events (supported in modern Safari), render up to three bounded future tip positions (within 16 logical px of the last real point) on the temporary preview only. Discard/replace them as confirmed input arrives; never include predictions in saved strokes, undo entries or JSON backups.
- For coalesced pointers, reuse one inverted SVG coordinate transform per packet rather than recomputing it for each point. Eraser packets also share a single transform. Long-stroke page-growth calculations now use one pass without `Math.max(...largeArray)` allocation/spread.
- A screen resize/rotation during an active Pencil stroke updates the ink viewBox but avoids rebuilding all existing SVG strokes, so live handwriting is not discarded or delayed by an unnecessary full redraw.
- Files: `v76.js`, new `tests/notes-ink-latency-v932.spec.cjs`, offline `sw.js`, and this status update. No schema migration, new storage keys, native PencilKit or other Swift changes.

**Verification:** Static JS syntax passed. GitHub Actions [feature-branch browser run 44397077674](https://github.com/jgoldslice/dc_64_33/actions/runs/44397077674) passed **242/242 Playwright tests** on `4c7adacac2a4206e31f2d1a41d84d149f0de2e41`. Tests include instant first-ink DOM mutation before animation-frame scheduling, 180 real coalesced pressure samples via one transform, a bounded temporary predicted tip excluded from saved ink, pressure-vector finalization, undo, mouse and resize compatibility, plus existing Notes/Blueprint regressions. Actual Apple Pencil-to-photon latency and display frame rate have **not** been measured on physical iPad; synthetic input proves code execution order, not latency milliseconds. The owner should compare Safari after web deployment using blank/graph pages, 100–500% zoom, writing at different speeds, finger pan/pinch and erase/Undo. Native Capacitor/Xcode app is still separate and not updated by GitHub alone.

## 2026-11-18 — Notes icon-only toolbar v9.31 (merged; on-device QA outstanding)

**Requested from actual iPad Safari screenshot:** Move Lasso into the Pen tool group directly after Eraser; render Lasso as an icon rather than a word; replace the labeled Blank/Graph select with a graph-paper icon that toggles each page's background. Reduce unnecessary horizontal toolbar width while keeping 44px minimum targets.

**Implemented and merged:** [PR #48](https://github.com/jgoldslice/dc_64_33/pull/48) squash-merged into `main` as `d0cfb97a6f0de3c67d22198307654f81962ba2ba` (feature head `12838fc4e3f85118adab26593ae0e82cd43c52ed`).
- `notes-workspace-v928.js` now inserts a looped-rope SVG Lasso button directly after the existing Eraser, while an icon-only graph-paper toggle sits alongside Picture in the nearby Misc group, so the wider Pen group does not overflow on 320px devices. They reuse the existing SVG sizes/primary palette and accessible names/titles, with visible pressed states.
- Tapping Graph switches between Blank and Graph on the current page, preserving the original optional `paperStyle` state and existing backup behavior. The button's aria-label and aria-pressed change accordingly. When changing pages the icon restores the selected page's style. The Focus-mode Tools menu uses the same toggle and synchronizes with the main toolbar.
- Removed the separate Lasso group and the Paper label/select, removing an entire toolbar group and freeing space. No changes to ink strokes, pressure, lasso selection, touch gesture ownership, drawing data, copy/paste, or persistence keys.
- Updated `notes-workspace-v928.css` styles in place, `tests/notes-workspace-v928.spec.cjs` and `tests/canvas.spec.cjs` regression cases, and `sw.js` offline cache identifier. JavaScript syntax and stylesheet brace structure passed static checks.

**Verification:** GitHub Actions [PR run 44393270401](https://github.com/jgoldslice/dc_64_33/actions/runs/44393270401) passed **237/237 Playwright browser tests**, including six phone/iPad viewport sizes, 320px toolbar fit, icon placement beside Eraser/Picture, per-page Blank/Graph toggling, Focus synchronization and legacy Notes interactions. Earlier CI run 44392804747 failed 320px toolbar overflow with both buttons in the Pen group; moving Graph beside Picture fixed the layout and the full suite passed. Real-device iPad Apple Pencil/Safari verification and the separate Capacitor/Xcode update are still outstanding. Keep user data and native Share Extension files intact.

## 2026-11-18 — Notes contextual lasso actions v9.30 (merged; on-device QA outstanding)

**Requested:** The iPad Safari screenshot showed Copy, Paste and Delete making the Notes toolbar crowded, with labels wrapping. Move these actions to the page like a native selection popover.

**Implemented and merged:** [PR #47](https://github.com/jgoldslice/dc_64_33/pull/47) squash-merged into `main` as `8fdbcff8c545b2fd1112796266c1c8a7f0b1284f` (feature head `a2ca64db42f2ef4137246706354b23a22c458684`).
- The regular Notes toolbar keeps the Lasso tool, but no longer shows permanent Copy/Paste/Delete controls. Focus-mode Tools likewise keeps Pen/Lasso/Eraser/Undo and Paper without redundant clipboard controls.
- After lasso-selecting ink, tapping the selected strokes' bounding region with Pencil, mouse or finger brings up a small floating **Copy | Delete** menu. Dragging the selection still moves it; gestures that draw a new lasso do not automatically open the menu.
- Once a selection is copied to Blueprint's existing in-app ink clipboard, tapping otherwise blank paper in Lasso mode offers a floating **Paste** action. Blank-paper tap in ordinary Select mode also offers Paste, without affecting the Textbox tool. Paste places editable SVG strokes starting at the tapped page coordinates, rather than shifting copies by a fixed offset; Undo still removes the pasted strokes.
- Dismissing the menu is supported by tapping outside, changing tools/pages, starting ink drawing, scrolling, resizing and Escape. A finger pan/multitouch pinch cannot paste because it does not qualify as a tap. Popup placement is clamped to the visible viewport with 44px minimum buttons and accessible labels.
- Files changed: `notes-workspace-v928.js`, `notes-workspace-v928.css`, `tests/notes-workspace-v928.spec.cjs`, `tests/canvas.spec.cjs` and `sw.js` cache version. No new database table, planner state field, backup change, native Swift code or alteration to Pencil input serialization.

**Verification:** JavaScript syntax and CSS structural checks passed. [GitHub Actions browser run 44390658939](https://github.com/jgoldslice/dc_64_33/actions/runs/44390658939) passed **235/235 Playwright tests** on feature SHA `a2ca64db42f2ef4137246706354b23a22c458684`. Coverage includes selected-ink Copy/Delete, tapped-position Paste, finger taps and swipe safety, narrow viewport popup layout, compact toolbar, and previous drawing/Undo/pressure regression tests. Main-branch publish may run separately. Physical iPad Apple Pencil/Safari QA, Xcode/Capacitor installation and native Share Extension behavior have **not** been verified by this browser suite; do not imply a web push updated the installed iPad app.

## 2026-11-18 — Notes ink Undo and Pencil pressure v9.29 (merged; physical-device QA outstanding)

**Request:** Undo must restore strokes removed by the eraser; new Apple Pencil handwriting should respond to stylus pressure rather than always use a fixed width.

**Implemented and merged into `main`:** [PR #46](https://github.com/jgoldslice/dc_64_33/pull/46) squash-merged as `ddeb80fa46449b196c334bf55ce89e6011c3999d` from feature head `10d9f2c10d2540bf3942f3baf7bf4f2778adafa5`.
- Replaced the old Undo = remove final stroke rule in `v76.js` with a per-page, capped 40-command inverse-action history. Drawing commits a `draw` undo; an entire eraser gesture stores the removed strokes and original positions and restores them in order on Undo; canceled erases revert without creating a history entry. Lasso move, paste, and delete now use the *same* chronological history through `BlueprintNotesBridge.pushInkUndo`, avoiding a separate Undo stack taking priority over later pen/eraser edits.
- Apple Pencil PointerEvent pressure is saved on newly sampled points as optional `p` (0..1); quadratic SVG centerlines remain unchanged for all pre-existing strokes. New Pencil strokes render as variable-width filled SVG ribbon paths, smoothing local pressure and preserving rounded caps. Mouse strokes remain fixed-width. Low/zero pressure on pointerup reuses the last live pressure to avoid unintended release taper.
- Changes retain all x/y raw points, IDs, stroke colors and existing backup JSON layout; `p` is a backward-compatible optional point field, copied by existing lasso/backup logic. The existing source SVG stays editable and sketch export reads the same SVG DOM; no native PencilKit files or storage keys changed.
- Extended `tests/notes-undo-pressure-v929.spec.cjs` to exercise multi-stroke erasure and exact restoration/order, draw-before-erase Undo ordering, pointer cancellation, pressure sampling and SVG path shape, legacy drawing, JSON persistence and reload. Updated the old toolbar-button-count test and fixed accessible 44px controls and narrow paper picker CSS discovered in earlier v9.28 browser CI.

**Verification:** Isolated JavaScript syntax and SVG pressure-path geometry checks passed. GitHub Actions [PR browser run 44387293751](https://github.com/jgoldslice/dc_64_33/actions/runs/44387293751) **passed all 232 Playwright tests** on `10d9f2c10d2540bf3942f3baf7bf4f2778adafa5`. Earlier red runs identified toolbar target-size/overflow, resized-image test viewport handling, and test fixture mode/navigation errors, all subsequently corrected. The final browser run checks lasso, Undo, responsive layout and pressure SVG serialization, but does **not** establish physical Pencil force/tilt quality or iOS gesture fidelity. Main-branch publish checks and native Capacitor/Xcode installation must be confirmed separately.

**Next QA:** On the real iPad draw light/strong Pencil pressure on a new page; erase across strokes, Undo while switching tools, lasso move/copy/paste and Undo in sequence, 200–500% zoom, finger pan/pinch, app relaunch and complete backup/export roundtrip. Record any failure without clearing local device data.

## 2026-11-18 — Notes workspace v9.28 (merged together with v9.29; iPad QA pending)

**Requested:** OneNote-like lasso move/copy/paste, full-screen page focus, graph-paper background, and sharper/smoother Apple Pencil ink.

**Implemented in PR #46 / main merge `ddeb80fa46449b196c334bf55ce89e6011c3999d`:**
- An SVG stroke lasso can select intersecting ink strokes, drag them together, Copy/Paste inside Blueprint and across pages, delete selection, and undo lasso edits. These are still vector strokes with unique IDs, not flattened images. This is an in-app clipboard, not the iOS general clipboard.
- Per-page Blank/Graph selector: graph-paper grid is a repeating CSS background anchored to the page and scales with notebook zoom. Optional paperStyle property goes into existing notePage records and backups; old pages stay blank. Graph backgrounds are not baked into exported sketch PNGs.
- Full-screen Focus temporarily moves the *same live editor* above the navigation and page sidebar, showing only the page and a compact Tools/Done control. Exiting restores the original editor position without copying pages.
- A narrow integration bridge in v76.js uses its original stroke store, render pathway, coordinates, and save functions. It honors Pencil/mouse contacts and keeps fingers for panning/pinching. This feature does not change native Swift or enable the experimental PencilKit sidecar.
- Source files: v76.js, notes-workspace-v928.js, notes-workspace-v928.css, index.html, sw.js, tests/notes-workspace-v928.spec.cjs.

**Verification status:** Browser-tested in the 232/232 passing PR CI run above. Physical Apple Pencil, iPadOS touch and native app installation remain unverified. Web pressure-sensitive vector strokes are implemented in v9.29; native PencilKit pressure/tilt dynamics, system clipboard support, device-specific low-latency rendering, lassoing text/images, and high-zoom WebKit sharpening remain further work.

**Data/rollout:** No schema reset, new storage key, or destructive migration. Existing project attachment blobs, note pages and backup formats are retained; graph paper adds only an optional property. Do backup/export restore checks and physical Pencil/finger/zoom tests on iPad before relying on this release. The Mac Capacitor/Xcode wrapper is separate and not updated by a web push; preserve native App Group/Share Extension and never clear device data.

## 2026-11-18 — Goal-linked habits v9.27 (merged into main; iOS device QA outstanding)

**Requested:** From Goal cards, add a recurring Habit directly, retain one shared habit record, and display the parent Goal in smaller italic type throughout Habits. The piano example also needs an optional flexible target (e.g., 4 practice days per week instead of mandatory fixed weekdays).

**Implemented and merged:** [PR #45](https://github.com/jgoldslice/dc_64_33/pull/45) was squash-merged to `main` as `67cc749192f59fc4fd3a7f0a784230ccf40668dd` (feature head `efe747d48f64403a04d7b36448e0683e2c244bcb`).
- A direct `+ Habit` control appears beside `+ Step` on each Goal card, opens the existing Habit modal with its Connected Goal preselected, and creates a normal entry in `state.habits`. Users can also link, relink or unlink a Habit from its regular editor.
- Existing Goal cards list linked Habits separately from one-time Steps, with a current-week completion count. The Today, Week and Plan → Habits trackers and manager show the parent goal in small italic text. All checkboxes still operate on the same habit record; no second data store or duplicate schedule exists.
- Added an optional integer `weeklyTarget` (1 through 7 and no larger than the number of selected repeat days). Example: leave all seven weekdays available and target four completions per week. Legacy Habits keep their prior schedule-based progress. A changed link preserves existing completion history.
- Editing or removing Goal Steps preserves independent, goal-only Habits. Existing step-linked Habits still unlink when their step is removed. Deleting a Goal unlinks its Habits without deleting them.
- Touched `index.html`, `weekly-blueprint-v918.js`, new `goal-habits-v927.css`, `sw.js` offline cache, and browser regression tests. Old planner state and `jgold-planner-v1` backups remain readable; no storage key or IndexedDB migration is introduced.

**Evidence status:** New `tests/goal-linked-habits-v927.spec.cjs` covers creation, 4-day target, Today/Week synchronization, relink/unlink, Step changes, persistence, and Goal deletion; updated goal-button regression expectation. **Browser automated tests passed** in GitHub Actions [PR run 44379161706](https://github.com/jgoldslice/dc_64_33/actions/runs/44379161706) (221/221). The initial run 44378702335 yielded 217 passes and four new-test selector failures; those tests were corrected and fully rerun. Push-triggered `main` workflows ([browser run 44379585737](https://github.com/jgoldslice/dc_64_33/actions/runs/44379585737), [web publish run 44379585744](https://github.com/jgoldslice/dc_64_33/actions/runs/44379585744)) were queued at this documentation check and require separate success confirmation. Physical iPhone/iPad verification and native Xcode installation are **not verified**.

**Notes fidelity investigation (not a drawing-engine change):** `v76.js` saves ink as vector SVG paths, using mid-point quadratic smoothing and a fixed width; however, it zooms the entire note surface by a CSS `scale()` up to 500%. WebKit's transformed SVG compositing and stroke processing can look softer than native, device-resolution PencilKit ink, especially at extreme magnification. The separate native PencilKit prototype remains experimental and its drawing data is not in the complete-backup pathway; no untested replacement or note migration was made. Further iPad Pencil QA and a safe zoom/rendering experiment are required.

**iOS rollout:** Native Capacitor project on the owner's Mac was not accessible in this session. Do not uninstall the app, erase local planner data, replace App Group/Share Extension files, or claim that the GitHub branch installed itself on either device. After verified web release, copy changed web files into the actual local `www` directory, run its confirmed Capacitor copy/sync command, rebuild via Xcode, and check on iPhone/iPad.

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
