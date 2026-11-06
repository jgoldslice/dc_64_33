# DRAFT ONLY — November 6 storage recovery and documentation audit

No runtime changes. Do not merge or deploy without explicit approval.

## New findings beyond PRs #8–#10
1. **Conflicting backup instructions.** README's early V6 "Storage warning" says JSON exports exclude IndexedDB media, while later v7.4 section says complete exports include media. A reader can follow the wrong guidance. Replace the obsolete warning with version-scoped historical wording, and make the current complete-backup instructions prominent. Do not imply backups are automatic.
2. **Storage failure observability.** LocalStorage and IndexedDB are distinct persistence systems. Audit all write paths for quota, private-browsing, interrupted-write, and browser-storage-clearing failures. Ensure failed writes are visibly reported, not silently treated as saved. A persistent unobtrusive "Not saved — export/copy your work" state is preferable to transient toasts. This is a proposed audit, not a verified runtime bug.
3. **Backup integrity verification.** Existing tests cover a tiny image round-trip; add a multi-project fixture containing note images, Library attachments, sketches, goals, linked tasks/habits, and custom colors. After import into a clean browser context, compare canonical state and attachment checksums; test corrupted/partial imports without overwriting existing data.
4. **WebKit-specific gesture tests.** Existing touch tests explicitly use Chromium. Add Playwright WebKit runs where feasible and physical Safari checks for contenteditable selection, long-press move, image overlay hit-testing, VoiceOver, and software keyboard/visual viewport resizing. A WebKit test is not a substitute for a real iPhone.

## Prioritization
P0: reconcile README backup warning; ensure users understand manual backup requirement.
P1: audit failed saves and atomic import behavior; build full-state backup fixture.
P2: WebKit automated coverage plus physical iPhone gesture and VoiceOver matrix.

## Acceptance criteria
- No UI additions by default; no change to product name or four main tabs.
- A failed save must not appear successful.
- A corrupt backup must leave the existing dataset recoverable.
- Existing data/attachment IDs and links remain intact after migration/restore.
- Narrow iPhone and width-responsive two-pane layout retain equivalent accessible actions.
- Reduced-motion settings suppress decorative transitions.

Existing plans already address swipe thresholds, tap targets, note transparency, per-project tabs, safe areas, adaptive width, cache scoping, and image-reference deletion. Do not duplicate those implementations.

All implementation work requires review; this document is proposal-only.
