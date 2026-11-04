# dc6433

> “Wherefore, be not weary in well-doing, for ye are laying the foundation of a great work. And out of small things proceedeth that which is great.” — Doctrine and Covenants 64:33

A simple, mobile-first daily and weekly planner for iPhone 15, designed to adapt to larger displays in the future.

## Version 2 features

- **Today:** Editable reflective question, single Today at a Glance for timed events and tasks, and daily habits.
- **Week:** Weekly focus and goals, a six-card weekly layout (Monday–Friday plus a shared Weekend card for Saturday and Sunday), top priorities, and weekly habit tracking.
- **Goals:** Monthly goals categorized by life area, with expandable action items.
- **Habits:** View, create, edit, delete, schedule repeat days, and record completions.
- **Customize:** Light/Dark/System appearance; editable primary (default sage) and secondary (default sand) colors; import/export of JSON backups.
- A local-first installable web app supporting offline access after the first successful load.

## Local data

The app preserves the original **jgold-planner-v1** localStorage key for backwards compatibility, and adds safe defaults for missing settings and habit schedules. Existing tasks, events, goals, and habit completions remain stored on the same device. **Cloud synchronization and automated backups are not implemented.** Export a backup before clearing Safari data or switching devices.

## GitHub Pages

The existing **Publish dc6433** GitHub Actions workflow deploys this repository's root static files to https://jgoldslice.github.io/dc_64_33/.

To add it to iPhone Home Screen, open the site in Safari → Share → Add to Home Screen.

## Architecture

The main page is dependency-free HTML, CSS, and vanilla JavaScript, bundled in `index.html`. The service worker caches the page, manifest, and icon for offline use.
