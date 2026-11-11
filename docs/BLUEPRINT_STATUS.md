# Blueprint — Development Status

**Last documentation update:** 2026-11-11  
**Repository:** https://github.com/jgoldslice/dc_64_33  
**Baseline commit inspected before adding these documentation files:** `05c6e74dbf4a1df2719a4aeba28076a8a113fe88`  
**Verification scope:** Fetched root README and index.html; checked that AGENTS.md and this status file were absent; inspected recent commit identifiers. This is **not** a full source-code audit, automated test run, or iOS device test.

> **Operating rule:** Update this file after substantive development. Separate verified current state from the owner's design requests and past reports. The default branch's live commit and test status can change between chats; fetch them again.

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
| Project Overview cards | Historical requested change; unverified | Inspect current project navigation and rendering |
| Share from iOS into project Library | Historical requested change; unverified | Inspect native iOS targets and web sharing flows |
| iPhone toolbar/tabs overflow | Previously reported; unresolved status unknown | Reproduce on physical iPhone and narrow browser widths |
| Apple Pencil coordinates, zoom, text boxes | Previously reported issues; current status unknown | Test on physical iPad with Pencil |
| Data backup/persistence | Existing behavior mentioned in README | Test export/import and migration safety on copy of data |
| iOS build/deployment | Not verified | Inspect local Capacitor/Xcode project and actual device build |
| Documentation / agent continuity | AGENTS.md created 2026-11-11 | Follow and maintain these files |

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
