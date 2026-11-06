# Canvas — Version 5

> “Life is a canvas. So by God, start painting.”

Canvas is a minimalist, mobile-first life-design planner. Inspired by Doctrine and Covenants 64:33: “Out of small things proceedeth that which is great.”

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

### Storage warning

Canvas keeps text/project metadata in the original `jgold-planner-v1` localStorage key. Images, uploaded files, and sketch PNGs live in browser IndexedDB and **are not included in JSON backup exports**. For important projects, keep independent copies of the original files or downloads of your sketches. Clearing Safari/browser data or moving to a different device can remove local attachments. Browser storage quota may limit file sizes and total usage. There is no cloud sync.

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
