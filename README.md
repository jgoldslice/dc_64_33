# Canvas — Version 5

> “Life is a canvas. So by God, start painting.”

Canvas is a minimalist, mobile-first life-design planner. Inspired by Doctrine and Covenants 64:33: “Out of small things proceedeth that which is great.”

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
