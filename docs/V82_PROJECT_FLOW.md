# Canvas v8.2 — Less friction, safer project work

## Why this update
Continue the "less is more" design philosophy without adding another visible dashboard element.

### What changes
- **Project continuity:** Remember the most recently selected Notes, To-Do or Library tab for each project, including after refresh. Notebook page selection still persists separately.
- **Project header:** "Develop ↗" is accessible from the header; the three-dot button now opens a keyboard-accessible popover containing **Rename project**, **Export complete backup**, and **Delete project**. The old conspicuous Delete button in the footer is hidden. The export action exports *all Canvas data and attachments*, not just this project, and is labeled accordingly.
- **Today:** Surface up to three incomplete overdue tasks inside the existing Today at a Glance card; when more remain, provide a "View N more overdue tasks" link to Blueprint Tasks. No fifth home card.
- **Media deletion:** Deleting a project collects both Library and notebook-page file keys. It preserves blobs referenced in other projects, and deletes truly orphaned files. Linked Blueprint tasks and saved ideas remain as before.
- **Service worker:** Stop deleting unrelated Cache Storage names on the same GitHub Pages origin; treat offline navigation as HTML, but never return the app shell as a missing JS/image. Restrict request handling to this app's path.
- **Accessibility:** Project settings menu gets arrow-key navigation, Escape to close, focus handling and touch-sized targets.

### Design principles used
- Apple Human Interface Guidelines: contextually placed tools, predictable navigation, accessible controls.
- Google Material: generous interactive tap areas without oversized decorative icons.
- Microsoft Fluent: preserve focus, use small, purposeful contextual menus.
- Atlassian: reuse tokens for spacing/colors and make destructive actions explicit.

### Safeguards
- No product name or branding change.
- No extra default tabs, font families, AI integration or gamification.
- No automatic cloud sync.
- All data changes remain backward compatible and optional.
- Each behavior has automated browser checks; real iPhone Safari still warrants a touch test.

### Future candidate (not in this release)
- Make Notes editing/selecting and long-press move completely conflict-free under WebKit. Avoid introducing an extra button until a real phone test demonstrates whether a deliberate mode is necessary.
