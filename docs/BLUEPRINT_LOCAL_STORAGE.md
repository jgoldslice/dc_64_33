# Blueprint — local-only storage roadmap (no CloudKit membership required)

## Decision
Blueprint is an Apple-oriented, primarily single-device planner. Prioritize **local data durability**, full offline availability, and verified **off-device backups**. Cross-device cloud sync is deferred. Developing Core Data or SQLite-based on-device storage does **not** require paid Apple Developer Program membership.

## Current state verified in the GitHub web app
- **Planner manifest:** `localStorage['jgold-planner-v1']` (tasks, habits, goals, events, projects, note page structures, ink strokes, Library references).
- **Binary media:** `IndexedDB['canvas-project-attachments-v1']['blobs']` (images, PDFs, sketches, notebook assets, optional draft media).
- **Native Share Extension:** App Group queue and project index live in the *separate, locally managed* Capacitor/Xcode wrapper, not in this repository. Native queue acknowledgement only after committed import.
- **Complete backup:** Existing v2 archive has SHA-256 of planner and each attachment; exported via Customize → Your Data → Export backup. This is a user-initiated copy, not an automatic disaster-recovery system.
- No CloudKit, no automatic synchronization, and no automatic off-device backup. **No native database has been installed or migrated yet.**

## Phase 1 — safe incremental web-storage hardening (v9.26 branch)
- Block all planner writes after a corrupt/unreadable saved JSON load; never replace it with empty defaults.
- Show a visible warning and allow exporting the **exact raw localStorage value** as a recovery text file (not labeled as a complete backup).
- Refuse misleading complete backup exports if the saved original did not load.
- Add **Check local storage** to Your Data: inspect the last saved planner JSON, cross-reference all required Library/Notebook attachment keys against the read-only IndexedDB store, count missing files, report estimated usage.
- Never remove data, migrate schemas, or modify stored records as part of diagnostics. The check verifies **presence**, not stored-file checksums; full export verifies hashes.
- Include new diagnostics JS in SW cache so it works offline.
- Browser regression tests exercise valid/invalid planner load, media presence and missing media, and nonmutation.

## Phase 2 — native storage foundation (NOT YET IMPLEMENTED)
- App-private Core Data or SQLite (Application Support), with transactional per-record updates. Leave media as files in Application Support with stable IDs, SHA-256 hashes, and a database manifest; avoid storing multi-megabyte blobs in one JSON string.
- Set suitable iOS file-protection classes for personal notes while accounting for background writes and device lock state. Avoid the Caches folder for irreplaceable content.
- Introduce a thin Capacitor native storage plugin with explicit read/write errors; build full native regression tests and verify binary integrity on both device types.
- Copy the existing planner and all referenced media into the native store **without deleting the originals**. Validate counts, ID links, attachments, and hashes. Maintain a reversible rollback path.
- Switch to native source of truth only after dual-write and crash/restart tests show zero loss; retire legacy keys only after separately verified backups and a cautious deprecation period.

## Phase 3 — robust backups (NOT YET IMPLEMENTED)
- Retain a portable, versioned *complete archive* containing JSON + binary files and integrity manifest. Prefer encryption for sensitive personal notes.
- Provide a **Backup status** and a periodic reminder (not a false claim of automatic backup). Consider native iOS document export / user-selected folder for more reliable backup handoff to Files or iCloud Drive.
- Ensure several **independent off-device copies**; local-only snapshots will not survive lost or destroyed hardware. Restores must inspect and verify all records/media **before** altering live data.
- Test simulated failures: full storage, interrupted upload into App Group, interrupted local transaction, malformed JSON, power interruption, missing media, old backup formats, and accidental project deletion.
- Publishing via BYU's possible institutional developer program must not change App IDs or signing until confirmed; this project is personal, not assumed institution-owned.

## Release checklist
1. Export a complete archive from **each** existing device, and save it outside the app.
2. Verify the archive by importing into a separate/disposable app data store; preserve the original installation.
3. Run browser CI and actual on-device iPhone/iPad regression before switching any storage path.
4. Do **not** uninstall Blueprint, delete localStorage or IndexedDB databases, or clear App Group queued items as a troubleshooting shortcut.
5. Shipping a GitHub change does not install it in the existing local Xcode wrapper.
