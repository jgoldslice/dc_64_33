# DC 64:33 Planner

> “Wherefore, be not weary in well-doing, for ye are laying the foundation of a great work. And out of small things proceedeth that which is great.” — Doctrine and Covenants 64:33

A simple, mobile-first daily and weekly planner, designed initially for iPhone 15 and eventually for an expanded foldable layout.

## Features

- Today: focus, tasks, schedule, and habits
- Week: goals, seven-day preview, top priorities, and habits
- Monthly goals with categories and expandable action items
- Two customizable accent colors and automatic light/dark appearance
- Local browser storage, JSON data export, and offline caching after the first load

## Publish with GitHub Pages

1. Open **Settings → Pages** in this GitHub repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/(root)**, then click **Save**.
4. Once GitHub Pages publishes, open https://jgoldslice.github.io/dc_64_33/ in Safari.
5. Use **Share → Add to Home Screen** to install the planner.

## Data safety

This is an early prototype. Tasks, events, habits, goals, and appearance choices are saved only in this browser's local storage, not synchronized across devices. **Settings → Export data** downloads a JSON backup. Clearing browser site data can erase the locally stored planner.

## Local development

Run `python3 -m http.server 8000` in the repository folder and open http://localhost:8000.
