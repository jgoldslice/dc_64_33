# Blueprint v9.33 — backup memory and native integration readiness

## Current boundaries (verified from the web repository)

- Planner records: `jgold-planner-v1` in localStorage, with project-note SVG strokes stored in planner state.
- Image, sketch, note-image, and draft attachments: IndexedDB `blobs` via `v6Blob`.
- Complete backup format: `canvas-complete-backup`, version 2, with SHA-256 for the planner state and every attachment. Version 1 remains importable. These formats **must not change silently**.
- The public GitHub repository is not the complete installed Capacitor/Xcode project. The owner’s actual macOS Xcode wrapper and physical devices were not available for this work.
- Native PencilKit PR #40 and native Share Extension PR #41 are staged drafts, not production integrations. Neither should be merged without native/device verification.

## Backup export memory improvement (v9.33 Phase 3)

The web exporter now builds a version-2 JSON archive from successive Blob parts: a metadata/state header, followed by each verified attachment's JSON, followed by a closing delimiter. It does not accumulate a second array of base64 strings and then stringify an additional entire archive at the end.

Invariants:
1. Clone state once before the export begins.
2. Resolve every required IndexedDB reference; fail without a download if any referenced attachment is missing.
3. Compute SHA-256 for each blob and state; preserve keys, media types, sizes and data bytes.
4. Only create a download link after all required hashes and attachments have been processed successfully.
5. Do not touch localStorage, write IndexedDB records, migrate user IDs, or mutate the current planner during export.
6. Preserve legacy backup import, verify-before-commit, and rollback protections.

This reduces avoidable peak JavaScript string duplication but does **not** make the export fully streaming to disk: FileReader base64 conversion and browser Blob assembly still allocate memory; the importer still parses the full JSON file in memory. Test large backups on real iPad before treating low-memory behavior as verified.

## Native PencilKit integration contract (not implemented)

For a future native canvas, define a per-page, stable-ID `PKDrawing` sidecar. Keep current editable SVG notes and text/image objects readable while native ink is introduced. Coordinate conversions must match zoom, pan, portrait/landscape, Split View, and page scaling.

Required steps before native use:
- Confirm the installed Capacitor plugin registration and iOS deployment targets in the owner's **actual Mac project**.
- Store native drawing bytes with stable page IDs, revision metadata, versioned format information, and checksums. Do not only store raster previews.
- Extend complete backup export/import to include editable native drawing data. Verify all attachment hashes and page IDs before importing. Refuse silent overwrite and support interrupted restores; no single transaction spans localStorage, IndexedDB and the iOS file system.
- Do not combine web and native Pencil input simultaneously, which could duplicate lines or turn finger pans into drawing.
- Gate any migration behind successful web/native complete-backup roundtrips, restore on clean devices, and explicit opt-in if current content must change.
- Device-test Pencil pressure, tilt, palm rejection, erasing, Undo, lasso, zoom, predicted ink and app suspend/resume.

## Native Share Extension contract (staged only)

Keep the App Group import queue atomic and idempotent. Imported links/photos/PDFs must be staged to stable per-item records and verified in IndexedDB and planner storage **before** acknowledging the native queue entry. An interrupted import should be retryable without duplicate records or lost media. The web Shortcut capture path is not equivalent to a production iOS Share Extension.

## Local notifications and future sync

Notifications would require permission, scheduling/canceling stable event/task IDs, and rescheduling after edits/time-zone changes. None of these APIs is assumed to be connected. Any future cross-device sync requires a documented conflict policy and attachment reconciliation so that one device cannot silently overwrite another.

No CloudKit, Apple Developer paid-service assumptions, or native deployment steps have been introduced by this documentation.

## Device QA still required

Test the current web release on an iPhone and iPad in both orientations, iPad Split View, larger text, keyboard appearance, and with long project titles and large Libraries. Complete at least one export/import with several multi-megabyte images, a graph-paper note with pressure samples, and verify every restored file. Native iOS features require separate Xcode compilation, signing, installation and physical-device verification.
