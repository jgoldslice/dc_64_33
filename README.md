# dc6433

> “Wherefore, be not weary in well-doing, for ye are laying the foundation of a great work. And out of small things proceedeth that which is great.” — Doctrine and Covenants 64:33

A minimal, mobile-first daily and weekly planner for iPhone 15, with a future foldable layout planned.

## Version 4

- **Today:** Daily focus with handwritten-style notebook lines, timed events, deadline tasks, and habits.
- **Week:** Weekly focus, seven-day calendar overview, top priorities, and habit tracker. No separate weekly-goals list.
- **My Plan:** One section with **Tasks**, **Goals**, and **Habits** tabs.
- **Tasks:** Title, optional deadline, priority, and connected goal. Newly prioritized tasks go to the bottom of a Roman numeral–ranked priority list. Move priorities up and down as desired. Tasks with deadlines show on calendar; events retain start times.
- **Goals:** Categorized goals with expandable actions. Convert actions into linked tasks, and their completion states remain linked.
- **Customize:** Tap the two-tone palette icon beside the app name. Set primary and secondary colors, including metallic/monochrome colors, with Light/Dark/System appearance. Primary color lightly tints cards; secondary color defines icons and checkmarks.
- Offline-ready installable web app with JSON import and export.

## Data safety

Planner entries are stored **locally in this browser on this device** using the original `jgold-planner-v1` storage key. V4 preserves existing tasks, events, goal actions, habit completions, theme settings, and old weekly goals in backups (although the old Weekly Goals interface has been removed). Legacy planned work dates and times are retained in historical data, but V4 only uses task deadlines on the calendar, and task edits clear the old scheduling fields. There is no cloud sync or automated backup yet. Export a JSON backup before clearing Safari website data or moving devices.

## Deploy

The **Publish dc6433** GitHub Actions workflow publishes this repository to https://jgoldslice.github.io/dc_64_33/.

Open that address in Safari on iPhone, then choose **Share → Add to Home Screen**.

## Implementation

Static HTML, CSS, and vanilla JavaScript in `index.html`, a web manifest, SVG icon, and a cache-first-install/network-first service worker for offline support.
