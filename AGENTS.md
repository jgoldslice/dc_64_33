# Blueprint — Agent Instructions

> Canonical development guidance for coding agents working on Blueprint. This file gives enduring context; it is **not** proof of which features are currently shipped. Always inspect the repository and `docs/BLUEPRINT_STATUS.md`.

## Product and goals

Blueprint (formerly Canvas) is a personal planning, goal-setting, and creative project workspace. It combines Today and weekly planning, goals, steps, tasks, habits, Brainstorm projects, Notes, sketches, and project libraries. Its design philosophy is intentional living: small, deliberate actions accumulate into meaningful progress.

Repository: https://github.com/jgoldslice/dc_64_33

Prioritize a dependable, uncluttered experience that feels natural on iPhone and iPad. The owner values concise, concrete explanations and prefers that explicitly requested work be implemented, tested, and documented rather than left as a proposal.

## Actual architecture: verify before assuming

- The GitHub repository has historically contained a web application built with HTML, CSS, and JavaScript. Read its current entry points, asset references, scripts, tests, and README before changing anything.
- A separate local Capacitor/Xcode wrapper has been used to install the web app on iOS. The previously reported path is `~/Documents/ChatGPT/dc6433/canvas-ios/ios/App/App.xcodeproj`. **This is historical and must be checked on the actual Mac.**
- Do **not** assume the native iOS project or its generated web assets are synchronized with GitHub. A GitHub push does not update an installed app automatically.
- Do not invent npm, Capacitor, Xcode, or test commands. Discover what the current repository/project actually supports, and use the confirmed commands.

## Product areas and design direction

### Today
A fast daily overview including Today at a Glance, Habits, Top Priorities, and project access. Make purposeful use of the viewport. Avoid unnecessary page scrolling where the available space permits, but never solve fit problems by clipping text, shrinking controls below usable touch sizes, or sacrificing accessibility.

### This Week
Weekly calendar and event planning with smooth horizontal week navigation, responsive touch interaction, and accessible non-gesture alternatives. Preserve event dates, time zones, and unsaved form entries when navigating.

### Goals
Organize goals, steps, related to-dos, habits, and motivation. Avoid duplicate planning interfaces, unnecessary configuration, or confusing labels. Maintain links between connected records.

### Brainstorm / Projects
Projects organize Notes, To-Do, sketches, and Library materials. The desired project experience includes a compact **Overview** of Notes, To-Do, and approximately 3–4 useful Library images/figures. Treat that as a requirement to check against existing implementation, not proof it is already deployed. Project navigation should foreground the currently open project.

### Notes / Sketch
Support touch and Apple Pencil with sharp, low-latency strokes, correct coordinates under zoom/pan, undo, erasing, and a small pen-color palette (black, white, red, yellow, blue, green). Text and images should be individually selectable, movable, and resizable without accidentally creating new objects. Avoid unintended text selection, drawing loss, and layout overflow. Native PencilKit may be worth evaluating but must never be described as present unless verified.

### Library and sharing
Projects may contain images, figures, links, files, and useful references. A native iOS share extension—or a clearly disclosed staged alternative—has been requested. Determine what is feasible in the existing web/Capacitor/native architecture. Do not represent a web-only share action as an operating-system share extension.

## UI standards

- Favor an Apple-like, **not Apple-copied**, interface: restrained motion, responsive controls, natural gestures, crisp text and drawing.
- Keep headers compact and layouts consistent across Today, Week, Goals, and Brainstorm.
- Design for iPhone, iPad portrait/landscape, Split View, keyboard appearance, safe areas, Dynamic Type, and different display sizes.
- Avoid crowded toolbars, clipped labels, inaccessible touch targets, abrupt page switches, and surplus whitespace.
- Respect Reduce Motion; make gestures cancellable and keep keyboard/accessibility routes available.
- Support light/dark/system themes and the established configurable primary/secondary colors.
- Target smooth interaction on capable displays; report frame rates only when measured on real hardware.

## Data-safety rules — highest priority

- Preserve existing localStorage, IndexedDB, saved projects, tasks, events, note pages, strokes, attachments, and backup/export formats.
- Before changing schemas, storage keys, migrations, service workers, or cache handling, inspect all relevant readers/writers and backup flows. Describe a reversible migration and add tests.
- Do not clear users' data or reset app state as a troubleshooting shortcut.
- Never force-push, overwrite unrelated edits, or delete a user's work without explicit authorization.

## Coding workflow

1. **Verify:** Inspect latest GitHub files, branch, recent commits/PRs, and this file. Read `docs/BLUEPRINT_STATUS.md` and distinguish historical requests from current code. Check local changes when local access exists.
2. **Scope:** Identify the precise desired behavior, components, storage paths, platform implications, and regression risks. Select an appropriately small, coherent change set.
3. **Implement:** Prefer maintainable edits over accumulating patch files and CSS overrides. Avoid duplicate listeners, parallel state stores, fragile global mutations, and unnecessary rewrites.
4. **Test:** Run the actual available automated tests, inspect resulting failures, and test key UI breakpoints. For Pencil, iOS share extensions, gestures, and native wrappers, **device verification is required**; browser simulations are not a substitute.
5. **Deliver:** When authorized, commit/push in the requested branch strategy. Record commit SHA, files touched, results of tests actually run, deployment caveats, and exact Mac/Xcode commands only after verifying the local project structure.
6. **Record:** Update `docs/BLUEPRINT_STATUS.md` after substantive implementation, including evidence and unresolved items. Do not label merely written code as device-tested or deployed.

For significant changes, prefer a feature branch and PR or a similarly reviewable commit. When the owner has clearly authorized direct application of changes, execute within the accessible environment, but still test and protect data.

## Release / synchronization reminder

GitHub repository updates, Capacitor web-asset sync, Xcode compilation, and installing on devices are distinct steps. Confirm which version the iPhone/iPad actually runs. Do not tell the owner an installed app has been updated unless deployment was verified.

## Collaboration and truthfulness

- The repository is the source of truth for **implemented code**. This document reflects product intent and operating rules; conversation history and screenshots are supporting context.
- Be explicit whether each item is **requested**, **implemented**, **automated-test verified**, **physical-device verified**, or **deployed**.
- If repository, local machine, developer account, device, or project settings cannot be accessed, say exactly what remains manual.
- Provide short, understandable technical rationale where needed, and concrete next steps.
- Keep `AGENTS.md` relatively stable. Use `docs/BLUEPRINT_STATUS.md` for changing facts, known issues, priorities, and commit records.
