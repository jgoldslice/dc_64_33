# Canvas — Version 5

> “Life is a canvas. So by God, start painting.”

Canvas is a minimalist, mobile-first life-design planner. Inspired by Doctrine and Covenants 64:33: “Out of small things proceedeth that which is great.”

## Canvas v8.17 — Swipable weeks and a fixed notebook viewing window

- **Add Event** uses a horizontally scrollable, CSS-snap date bar with a previous/current/next week. The redundant previous/next-week arrow buttons are removed. Swipe left or right to move through weeks repeatedly; the bar recycles around the selected week after each snap. The selected weekday follows the scroll, and the event name/time remain untouched until Save or Cancel. Keyboard left/right also shifts a week.
- **Week at a Glance** uses a native horizontal three-week scroller. The actual current week remains the center panel; adjacent weeks render as previews during finger/trackpad movement and refresh when scrolling settles. The small redundant arrows inside the card are removed, but the main Week header's Previous/Next controls remain as accessible alternatives. Click a day to add an event as before.
- **Notebook zoom stays inside the notebook:** The pad is now a fixed-size internal scroll viewport on phone/iPad, rather than resizing the surrounding document and pushing other sections around. The actual note objects and strokes still scale together from 50%–500% and can be panned within the pad. Zoom-center correction uses the note's own vertical scroll instead of scrolling the whole browser page.
- The Pages sidebar and toolbar remain stationary, and the project notebook data, attachments, event storage and exported backup format are unchanged. Safari gesture events are prevented only when originating inside the notebook.
- Additional browser regression checks cover native week scrolling, repeated date navigation, event detail preservation, fixed notebook bounds at multiple zoom levels, inner scrolling and Safari gesture interception. Real iPad Safari/Apple Pencil QA remains advised.

## Canvas v8.16 — Paper-like page turns and sliding calendar weeks

- Fixed a paper-swipe visual jump: snapshots now use the actual on-screen coordinates of the current app view (including iPad navigation, content padding, and vertical scroll) instead of appearing at the origin of an overlay. A subtle reversible hinge rotation, directional edge shadow, and 3px gesture-tied lift approximate a paper turn, inspired by Apple Books. The app's real DOM, data, and scroll remain untouched.
- The swipe animation is interactive while dragging and completes or cancels on release. Reduce Motion remains respected, and editable controls are excluded from global swipes. It is an efficient web CSS treatment, not a native Apple Books curl renderer.
- The **Week at a Glance** calendar can move to previous/next weeks by swiping horizontally or tapping compact arrows inside the calendar. Existing week arrows at the top are unchanged. Horizontal calendar gestures do not trigger a main-tab page turn, and vertical scrolling remains enabled.
- **Add Event** now has previous/next-week controls and swipeable weekday chips. Event name/time entries are retained when browsing weeks, and the same weekday stays selected. You can schedule as far forward/backward as needed without leaving the form.
- After adding an event on a different week, the Week calendar shows the week where the event was saved. Events still use the existing state storage and backup schema; no migration.
- Regression tests check calendar gestures, date correctness and persistence, event modal navigation, page-turn snapshot alignment, and reduced-motion handling. Real Safari touch testing remains advisable.

## Canvas v8.15 — Notebook zoom (50%–500%)

- Notes now support **pinch-to-zoom** on touchscreens and **Ctrl/Command + trackpad wheel** inside the notebook, without zooming the rest of Canvas.
- A compact **− / percentage / +** toolbar provides predictable steps of 50%, 75%, 100%, 125%, 150%, 175%, 200%, 250%, 300%, 400%, and 500%. Tap the displayed percentage to return to **100%**. Controls disable at the two limits.
- Zoom scales the **whole ruled page**, including typed text, inserted pictures, handwritten strokes and selection handles. It reserves scaled scrolling space so the page stays scrollable even at 500%.
- Uses the existing SVG screen transformation for Pencil positions; note insertion, moving, and resizing continue to use unscaled coordinates, so zoom **does not change stored sizes, locations, drawings, or backup data**.
- Zoom is a temporary view setting, initially 100% and reset to 100% when switching pages. iPad and compact/phone layouts use the same behavior.
- Automated browser tests exercise both boundaries, zoom steps, synthetic pinch events, simulated zoomed Pencil input, text box positioning, page switching and responsive layout. On-device Safari/Apple Pencil verification is still advisable.

## Canvas v8.14 — Wider Brainstorm notebook and compact project switching

- Removed **A place to think** and **Capture what comes to mind** from the Brainstorm header while keeping its title.
- On an open project, the second **Projects** column no longer takes up roughly a quarter of the tablet workspace. **Project switching** instead lives in a compact selector in the project header, beside the existing Projects back link and project actions.
- The **notebook's Pages** sidebar stays next to the ruled sheet and uses the extra space for a wider writing/drawing surface, including iPad landscape.
- Switch directly from one project to another through the header selector without returning to the project library. All project content, page names, drawings, attachments, actions and previous notes remain tied to their original project.
- Narrow iPad Split View and phones keep the selector on a separate compact header line to avoid horizontal overflow. Main Brainstorm project-library view still shows all project folders and supports creating projects.
- No data migration or backup format change. Automated regression tests cover iPad width, page navigation, project switching, UI text, phone/compact layout and unchanged project settings.

## Canvas v8.13 — Delete completed tasks directly from Blueprint

- In **Blueprint → Tasks → All Tasks**, checking off a task immediately reveals a **Delete** action beside **Edit** on that row. Incomplete tasks retain **Edit** only.
- The Delete button requires confirmation, including the task title, before removal. Cancel leaves the task complete and unchanged. Unchecking a task removes the inline Delete control.
- Uses the existing shared task deletion logic, retaining the editor's Delete option and existing cleanup of linked Brainstorm idea actions.
- The action works in mobile and tablet layouts and remains available for previously completed tasks after reload. No saved-data migration or backup format change.

## Canvas v8.12 — Textbox tool and deliberate note insertion

- Reintroduced the **Textbox** icon to the notebook's Text tools. Select it, then tap empty paper to insert a text box at that point. The new box opens for editing and the tool automatically returns to Select, preventing accidental additional boxes.
- When Textbox isn't selected, tapping empty paper only deselects the current object and dismisses its text keyboard. It never creates a new box.
- Tapping existing text or images never inserts another box, even if the Textbox tool is armed; objects remain selectable, movable, resizable, and editable.
- Pressing the bullet-list formatting button or changing text size without an active editor does not create extra text boxes.
- Existing project notes, pictures, strokes, and backup formats are unchanged. Phone and iPad layouts use the same rule.

## Canvas v8.11 — OneNote-style notebook editing and page navigation

- **Select instead of long-press:** Tap any notebook text box or picture once to reveal a selection outline, eight edge/corner resize handles, a center Move control, and a small Edit (text) / Delete action bar. The previous six-dot grip is removed.
- Drag the selected object or its Move control to reposition it. Use left/right, top/bottom, or corner handles to resize from any edge; both positions and sizes persist in the existing notebook project.
- Tap selected text again, or choose Edit, to type normally. New text boxes are added only with the explicit Textbox tool. Pen and Eraser modes remain independent of object selection and keep their existing ink behavior.
- **Named page list on iPad:** A slim vertical Pages sidebar appears to the left of the ruled notebook whenever the actual notebook is wide enough. Tap to switch pages, **+** to add, and **•••** beside a page to rename it. It shares the existing note-page data with the dropdown, rather than creating a second copy.
- Narrow Split View, Stage Manager, and iPhone windows retain the compact top page picker. The page list adapts to the notebook's available width, not a guessed device type.
- Objects may now store an optional explicit height after vertical resizing; old content without it keeps the original natural height. Backup files continue using the existing Canvas state format.
- Automated browser tests cover keyboard and pointer selection, image/text resizing, persistence, named page switching and renaming, and responsive tablet layout. Physical iPad Safari and Apple Pencil testing are still recommended.

## Canvas v8.10 — Continuous eraser and cleaner notebook tools

- The notebook toolbar uses **icons only**; the visible Text, Pen, and Misc headings are removed. The three groups keep their descriptive accessibility labels.
- The eraser icon is a clear outlined eraser without the extra diagonal slash inside the drawing.
- **Tap or drag** in Eraser mode to remove any handwritten stroke touched by the eraser path. Long, sparse strokes are correctly detected even when the eraser crosses between their saved vertices. Sweeping across multiple marks in one gesture removes all intersected strokes, leaving unrelated marks, photos, and note text alone.
- Supports mouse, finger, and browser Pencil pointer events; preserves original pen/stroke format and saves erasures as they happen, including midway through a drag.
- Eraser behavior is **stroke-based**: touching part of one pen stroke removes that entire stroke. Fine-grained segment erasing remains a possible future addition.
- Automated regressions cover tap erase, continuous multi-stroke drag, sparse line crossings, safe blank-space gestures, persistence after reload, and simulated iPad Pencil input. On-device Safari/Pencil testing is still worthwhile.

## Canvas v8.9 — iPad Pencil alignment and notebook icons

- Replaced the notebook's former backspace-style eraser glyph with a recognizable **eraser icon**, and the grid-like Image glyph with a **photo icon**. Existing tool names and operations are unchanged.
- Corrected a drawing-offset bug: some iPad breakpoints forced the page to be at least 800 or 980 CSS pixels tall, while the SVG ink layer used the stored 740-pixel height as its viewBox. The SVG then centered ink with a vertical offset. Ink now tracks the **displayed** surface dimensions with a matching viewBox and no centering, and Pencil pointer contact is converted with the SVG screen transformation matrix.
- Uses available coalesced pointer coordinates for smoother stroke capture and retains the original stroke-point storage schema, undo/erase behavior, autosaving and complete backups.
- The web app uses browser Pointer Events; it does not gain native **PencilKit** by this change. A future native iPadOS build can integrate PencilKit for lower-latency inking, advanced pressure/tilt and system drawing tools.
- Browser regression tests include simulated pen input at iPad portrait and landscape sizes, compact windows, persistence across reload, and existing notebook toolbar behavior. Real Apple Pencil/Safari verification on hardware is still advisable.

## Canvas v8.8 — Delete goal from Blueprint

- Expand a goal and select **Delete goal** beside **Edit goal**. Confirm the deletion to remove that goal; Cancel leaves everything unchanged.
- Existing linked tasks and habits are **preserved** and become unlinked, exactly as they did when deleting through the goal edit dialog. Unrelated goals, tasks, and habits remain unchanged.
- Inline deletion uses the same logic as the existing Edit Goal → Delete button. Goal removal cannot be undone unless restored from a backup.

## Canvas v8.7 — Simple Week calendar event entry

- In **Week → Week at a Glance**, tap the **+** button to add an event to any day in the displayed week. Choose a day, enter the **event name** and **time**, and save.
- Tap any weekday or either half of the weekend calendar cell to open the same simple event form with that day's date already chosen. The form contains **only the event name and time** for day-tap entry.
- New events use the existing event data model and automatically appear in Week and Today as appropriate; they persist through reload and are included in current Canvas backups.
- Day cards are keyboard accessible (Enter/Space); Escape cancels. Video-link previews are unchanged.

## Canvas v8.6 — Video link previews

- Paste a YouTube **Shorts**, standard `watch?v=`, or `youtu.be` URL into **Brainstorm → Project → Library → + Add → Link**. The Gallery and List views show a thumbnail card with a large Play button, instead of a long URL.
- Existing saved YouTube links receive the preview automatically without changing their saved records; regular links, code, images, and files are unchanged.
- Tapping Play loads a privacy-enhanced YouTube embedded player within Canvas; **Open on YouTube** still opens the original link. Some videos cannot be embedded because of uploader restrictions or Safari content blockers; the original link remains usable.
- The image thumbnail is fetched from YouTube's image host when a card appears. The playable iframe is not loaded until Play is tapped. An offline view shows the card with a play icon, but an internet connection is required for the actual video.
- Video titles, likes, view counts, and comments aren't fetched automatically (no YouTube metadata API). Give the link a descriptive title if desired.
- The existing project Library entry remains a plain URL in all complete backup exports/imports; no video file is downloaded or stored in Canvas.

## Canvas v8.5 — Data integrity and safe restore

- **Complete backups now include SHA-256 integrity checks.** The v2 JSON backup stores a checksum for the planner state and each attached image, file, saved sketch, and available unfinished sketch draft.
- **Import validation happens before replacing local data.** Damaged state, missing media, corrupted bytes, duplicate attachment keys, malformed entries, and unsupported versions are rejected without applying the import.
- **Older v1 complete backups remain importable.** Their original format does not include the new checksums, so old files cannot provide equivalent corruption detection. Legacy text-only backups still require an extra warning and do not reconstruct missing media.
- **Attachment writes now wait for transaction completion.** A request-level IndexedDB success no longer incorrectly counts as a successful saved file when the transaction aborts.
- **Failed imports attempt to restore the old planner and draft sketches** and remove newly staged attachments. If browser storage also prevents recovery, Canvas displays an explicit warning; preserve the browser data and your independent backup.
- **No background/cloud backup or cross-device syncing.** Exports are manual. Keep copies outside Safari, and test restoring to a separate browser/device before treating an export as your only copy.
- Media from replaced projects are deliberately not automatically purged; avoiding accidental deletion takes precedence over aggressive space cleanup.

## iPad layout (Canvas v8.4)

The existing Canvas web app adapts to iPad-sized browser windows; there is no separate iPad account or duplicate data format.

- In full-width iPad portrait and landscape, the four existing destinations (Today, Week, Blueprint, Brainstorm) appear in a leading sidebar that can collapse to icons.
- Projects and notebooks expand with available width. On wider iPads, the project switcher and current project's editor appear side by side.
- In narrow Split View / Stage Manager windows, Canvas automatically returns to its compact bottom navigation. iPhone layout and touch editing remain unchanged.
- The existing notebook accepts supported touch/stylus pointer input. Apple Pencil-specific pressure, hover and handwriting recognition are **not** new features of v8.4.
- This is responsive PWA support, **not** a separately packaged native iPadOS app. Browser storage is per device/browser: content does **not** synchronize automatically between iPhone and iPad. Use the complete backup export/import to move data, and retain a copy before restoring.
- Browser checks cover 834 × 1194 and 1366 × 1024 tablet viewports and a compact 600 × 900 window. Physical iPad Safari and Apple Pencil behavior still require hands-on QA.

## Navigation

- **Today** — focus, events, deadline tasks, and habits.
- **Week** — weekly focus, calendar, top priorities, and weekly habit tracking.
- **Blueprint** — a drafting-compass tab containing Tasks, Goals, and Habits.
- **Brainstorm** — quick ideas, notes, and inspiration.

Tap the primary/secondary-colored palette in the header to open Customize.

## New in V5

- **Brainstorm:** Jot ideas in an autosaved draft, tap *Keep Idea* to save a note, and edit its optional title and full text with automatic saving. Convert an idea to a goal or task without deleting the original. A conversion creates the goal/task and opens its editor.
- **Blueprint:** Tasks, Goals, and Habits stay together; the tab is renamed from My Plan.
- **Goals:** No monthly timeframe. Add a goal with a selected category and one or more steps in the same form. Reorder, add, or remove steps when editing. Convert a step to a linked task; checking a linked task or step updates the other.
- **Categories:** Filter goals, create custom categories, and manage their names. Goals in the same category share a section. Rename updates the goals. Categories containing goals cannot be deleted until those goals are moved.
- **Opening animation:** A cloud, lightning strike, light bulb, paint brush, and brush stroke symbolize inspiration becoming action. No words appear until the end. Customize with *Animation + message*, *Animation only*, *Message only*, or *None*. Set a custom opening message and tap *Preview Opening* to replay a self-closing preview. Tap the opening to skip; Reduced Motion is respected.
- **App identity:** Canvas branding, with the existing two-color palette icon, color controls, and minimal layout.

## Data and privacy

All personal data is **stored locally in the browser**, under the original `jgold-planner-v1` storage key, so upgrading does not intentionally replace saved planner data. V5 adds optional fields (categories, ideas, a draft, and opening settings) while retaining existing tasks, habits, events, goals, previous weekly-goals data, and user color settings. No cloud synchronization or automatic cross-device backups are available; use **Customize → Your Data → Export backup** regularly. Browser data deletion or using a different device can lose local entries.

The existing repository name and GitHub Pages URL have been retained to avoid breaking the published app:
https://jgoldslice.github.io/dc_64_33/

## Implementation

Dependency-free HTML/CSS/JavaScript in `index.html`; SVG Home Screen icon and manifest; network-first, offline-fallback service worker with a V5 cache name. Full Apple Pencil support on future foldable hardware is not implemented; feasibility depends on the device’s stylus and browser support.

## New in V6 — Brainstorm Projects

- **Project folders:** Create, rename, open, and remove independent project workspaces. Ideas may be filed in a project from their popup or created directly while inside a project. Existing unfiled ideas remain available.
- **Notes:** Add sections with editable headings and bullet-point items. Edits save as you type.
- **Actions:** Project-specific checklists; convert any action into a linked Blueprint task. Checking off either the task or the project action updates the other.
- **Sketch:** Touch/mouse/stylus pointer drawing, primary/secondary color pen, eraser, undo, clear, saved named sketches, and a local draft autosaved after drawing strokes.
- **Library:** Save HTTP(S) links, code snippets, and uploaded image/files up to 40 MB each. Uploaded file bytes and sketches are kept in **IndexedDB** on that device; photos show thumbnails where supported. Code can be copied. Links open in a new tab.
- **ChatGPT handoff:** Prepare a full text summary of the project (notes, ideas, actions, link/code references), copy it, and open ChatGPT. It does **not** automatically create a ChatGPT Project or attach images/files: attach those separately.

### Historical v6 storage warning (superseded by v7.4 complete backups)

At v6, Canvas kept text/project metadata in the original `jgold-planner-v1` localStorage key. Images, uploaded files, and sketch PNGs lived in browser IndexedDB and **were not included in the older JSON backup exports**. Current v7.4+ complete exports are intended to include referenced media; verify the restored files on a separate device/browser before relying on them. For important projects, keep independent copies of the original files or downloads of your sketches. Clearing Safari/browser data or moving to a different device can remove local attachments. Browser storage quota may limit file sizes and total usage. There is no cloud sync.

## Canvas v7.4 — Project workspace refinement

- **Project Actions:** Persistent List / Board toggle per project, with To Do / In Progress / Done status controls and linked Blueprint task completion. Board columns are grouped sections, not drag-and-drop.
- **Project Notes:** Preserves the existing freeform notebook and adds optional Heading, Paragraph, Checklist, Code, and Image blocks with reorder controls. Note images use IndexedDB.
- **Project Library:** Existing gallery and full-screen viewer remain, with an additional Gallery / List toggle per project.
- **Backups:** Customize → Export backup writes a `canvas-complete-backup` JSON containing planner data, referenced IndexedDB media, and sketch drafts. Import supports new complete backups and legacy text-only backups. Backups can be large because they embed media as base64.
- **No floating + button** was added. Existing Add controls remain.
- **Offline:** `sw.js` caches `v74.js` and `v74.css`.

### v7.4 manual verification
1. Swipe between views, then open a project and confirm gesture protection.
2. Move project actions between statuses in List and Board and verify linked Blueprint task completion.
3. Add and reorder note blocks, save and reload, then confirm content persists.
4. Upload an image and save a sketch, export a complete backup, and import into a separate clean browser profile.
5. Verify files, sketches, tasks, and project data survive import.
6. Test offline after the updated app has loaded online.

Keep independent copies of irreplaceable files until the complete backup and restore workflow has been tested on-device.
## Canvas v7.5 — Today/Home polish and named colors

- **Today = Home:** The existing Today tab remains the single landing/home screen. Tap the Canvas wordmark in the header to return to Today. No extra Home tab or dashboard was created.
- **Customization:** Every palette swatch displays its color name under the swatch, with a visible selection indicator. The selected color displays its name and hex code; custom-picked colors are labeled Custom.
- **Mobile polish:** Clearer selected-state contrast, improved focus indicators and touch targets for frequently used controls, and better narrow-screen wrapping of project action controls.
- **Project safety:** Removing an action asks for confirmation and leaves the linked Blueprint task intact. Removing a note image block also cleans up its stored image.
- **Offline:** The service worker pre-caches the new polish.css stylesheet. After deployment, reload once online before relying on offline use.

### v7.5 on-device checks
1. Open Customize and cycle through Sage, Gold, White, Black, and a custom hex color for both Primary and Secondary. Verify labels, selection ring, and dark/light contrast.
2. Tap the Canvas title from Week, Blueprint, Brainstorm, and Customize: it should return to Today without resetting saved content.
3. Try swipe navigation, note blocks, project action List/Board, and file galleries, including on a narrow iPhone screen.
4. Remove a project action that has a linked Blueprint task; confirm the task remains in Blueprint.
5. Test offline reopening after an online refresh; keep independent backup copies until on-device restore is tested.

## Canvas v7.6 — OneNote-inspired project pages (review branch)

- **Simpler Notes:** The old structured-content dropdown and card-based paragraph/heading/checklist editor are hidden. Project notes open as notebook pages instead.
- **Multiple pages:** Create, rename, switch, and delete pages within each project. Each page has free-positioned text boxes and images; drag the small handle to reposition items.
- **Minimal formatting:** The handwritten-style font is the default, with only bold, italic and bullet-list controls. Tap an empty area to add another text box.
- **Drawing:** Pen strokes, stroke eraser, and undo are built into each page. Existing saved Sketch items remain in Library.
- **Images:** Add or paste pictures; resize with +/−. Image data stays in IndexedDB and is referenced by the complete backup manifest.
- **Tabs:** Project navigation becomes Notes / To-Do / Library. Existing project Actions data and Blueprint links are unchanged.
- **Persistence:** Existing notebook text and note blocks are copied into the first page when needed. Their original fields remain present as a recovery copy; individual page content autosaves locally.

### Important limitations and tests

This is a lightweight notebook, not the full OneNote application. It uses a vertically extendable page rather than an infinite pan/zoom canvas. Drawing, image placement and formatted text require iPhone/Safari interaction testing; these changes are proposed for review rather than published to the default branch. Test bold/italic/list selection, caret retention, drag handles, image paste and upload, pen annotations over photos, page switching, backup export/import and old-note migration on-device. Existing device-local data has no automatic cloud sync: export a complete backup before testing.


## Canvas v7.7 — Goal-first Blueprint and four-section Today

- **Goal-first cards:** Each goal gets its own card. Its title is the dominant text and category is displayed as small metadata above the name. Goal progress and linked step status remain intact.
- **Step actions:** The arrow buttons are replaced by a tappable step name with a contextual menu for Create Task or Create/Edit Habit. Existing linked tasks/habits are preserved; the Task option is disabled if one is already linked.
- **Simplified Today:** The visible Today layout is exactly Today at a Glance → Habits → Top Priorities → Projects. The previous Today Focus text is retained in state but its card is hidden.
- **Top Priorities:** Shows up to five incomplete prioritized tasks and uses the same priority ordering as the Week and Tasks views. View all opens Blueprint Tasks.
- **Project shortcuts:** Shows up to four folders on Today, with links directly into their Brainstorm workspaces; View all opens the project folder list.
- **Offline:** Add v77.js and v77.css to the service-worker asset manifest and bump the cache version.

Test goal step completion and task/habit conversion, iPhone tap menus, project shortcut navigation, priority edits and project creation/rename, and offline reload. This PR remains unmerged until tested on-device.


## Canvas v7.8 — Notebook gesture and toolbar clarity

- **Resize:** Drag the six-dot handle in the upper-left corner of a text box or image. Dragging right makes the box wider, dragging left narrower. The box's saved width is independent of its location.
- **Move:** Press and hold on the text or picture itself for approximately 450 ms, then drag. A normal text tap continues editing. Movement is limited to the visible page edges without changing saved width.
- **Consistent image controls:** Images now resize with the same six-dot handle as text (the extra +/- image buttons are removed).
- **Page actions:** Page 1 selects a page, + Page adds a page, and ••• opens a clearly labeled Rename page / Delete page menu. This avoids using two visually identical pen icons.
- **Formatting / draw toolbar:** Bold (B), Italic (I), bullet list, Select (arrow), add Text (T), insert Picture, draw Pen, stroke Eraser, and Undo last ink stroke.
- **Offline:** Service-worker cache bumped for changed project-note JavaScript and styles.
- **Tests:** New browser checks exercise text and image resize and long-press move, and verify saved text box width and position survive reloading.

Keep a complete backup before trying the gesture changes on an important project. Automated Chromium tests complement but do not replace real iOS Safari testing; in particular, holding on editable text may interact with native text selection.

## Canvas v7.9 — Minimal Notes toolbar

- **Text:** One Bullets control. All text uses the existing handwritten font; no font picker, bold, or italic buttons. Previously saved bold/italic markup is retained.
- **Pen:** Draw, Erase, and Undo last drawing stroke. Tap an active Draw/Eraser button again to return to regular typing mode.
- **Misc:** Insert picture only. Other insert options are intentionally deferred.
- **Text boxes:** Tap empty note space to create a text box automatically; the separate Text-box and Select buttons are removed. Existing six-dot resize and press-and-hold move gestures stay intact.
- **Layout:** Three compact labeled icon groups fit mobile widths. Data structure and existing notes are unchanged.

## Canvas v8.0 — iPhone Notes touch and typography repair

- Note text boxes are completely transparent over pictures, even when focused or overlapped. Images are beneath text objects in stacking order.
- Text toolbar now offers just three sizes in the same handwritten font: Small (15px mobile), Medium (18px mobile, the previous size), Large (24px mobile). Each text box saves its choice separately; the selected size also becomes the page's default for future boxes.
- Short touch on text still focuses editing; long-hold touch suppresses iOS native select-all/context menu while initiating the 450ms move gesture. A separate touch cancellation handler restores focus and attempts to place the caret at the touched point.
- Existing notes with no size metadata render Medium. This update preserves all previously saved text, image, ink, and page data.
- If iOS text copy/selection needs refinement on physical hardware, evaluate an explicit Edit mode or dedicated move handle rather than allowing the default long-press to compete with dragging.
