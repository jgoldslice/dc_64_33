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
