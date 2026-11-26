# Full planner sync candidate

This feature is developed separately from manual backups and draft PR #104. It is off until the owner explicitly sets up each device. No personal planner is enrolled by development tools.

## Owner workflow

1. Keep a complete backup of the source iPad. Install the updated native app without uninstalling.
2. Sign into the same Google account on every device.
3. On the source iPad, choose **Customize → Automatic Sync → Start from this device**. This is allowed only when that account has no shared planner yet. A complete pre-sync recovery copy is saved and verified locally before publication.
4. On the receiving device, choose **Join shared planner** and confirm the initial replacement. Its existing planner is retained in a verified local recovery copy first. Initial joining is deliberately explicit: a receiving device's sample data or independently remapped backup page IDs must not be merged into the source by guessing.
5. Once paired, saved changes reconcile automatically while Blueprint is open. Reopening, reconnecting and server change notifications schedule another reconciliation. iOS suspension/closed-app execution is not promised.
6. Conflicting edits pause sync. The owner chooses the device or shared version of the overlapping fields; other edits merge. The choice is rejected if either side changed during review. Local recovery copies and immutable cloud predecessors retain the earlier versions.

**Pause sync** stops enrollment on this device without clearing its planner. **Export pre-sync recovery copy** downloads a normal complete backup. Manual import/restore pauses automatic sync and removes the inherited pairing generation, requiring setup again. Changing accounts cannot carry queued data to a different account. Manual complete backups remain an independent recovery path.

## Data and protocol

- Full planner data includes tasks, events, habits and per-day completions, goals/actions, weekly goals, Areas/categories, ideas, projects, Notes, placed objects, Library files, sketches and PencilKit sidecars. Legacy `notebookText` is preserved until real note pages exist. Derived notebook summaries and device-local active-page choices are excluded from reconciliation.
- A canonical graph separates top-level entities and notebook pages. Existing device-specific media keys become content-addressed references. The optional `blueprintSyncPageId` on paired pages preserves shared identity when native/browser import stages new local IDs. Existing keys, IDs, native store locations and backup v1–v3 readers remain intact.
- Original PKDrawing bytes and their optional preview form one immutable content node. Native handwriting stays editable on iOS and viewable through its preview on the web. Concurrent changes to the same native drawing require a choice; this release does not attempt stroke-level merging of PKDrawing archives.
- Three-way merging compares the confirmed baseline, current local graph and current server graph. Disjoint record/field edits merge; overlapping scalar edits, delete/edit races and incompatible ordering changes pause. Related-entity/orphan validation runs before publication. A deleted parent with a concurrently changed child is blocked for manual review rather than discarded.
- Changed nodes upload to `users/{uid}/sync/objects/{sha256}.json`. Unchanged attachments/ink are reused. Every read verifies SHA-256, size and format. A Storage node cannot be overwritten or deleted by client rules. The manifest links to its immutable predecessor.
- A Firestore transaction updates only `users/{uid}/sync/current` with `{schema:1, revision, hash, updatedAt}`. Revision must advance by exactly one and the transaction must match the head originally read. Publishing this single pointer makes a graph visible atomically; failed uploads leave no partially published planner.
- The local baseline and pending publication intent live under an account/project/planner-generation-specific IndexedDB key. The intent is verified before cloud publication. After a crash or a local edit during publication, recovery compares the exact pre-publication and published graphs instead of blindly replaying an obsolete snapshot. Server heads are checked again before writes. Account/session and opt-in guards remain active through staging and local commit.
- Web Locks serialize workers across windows sharing a planner. Existing guarded local saves still reject stale-window writes. Remote applies wait for local edits to finish and for dialogs/text editors to close, stage media under new keys, retain unchanged local ink/media where possible, and verify the local token immediately before committing. Existing rollback guards are reused. Native drawing changes invalidate in-flight snapshots; full-screen native editing defers sync until Done.

## Bounds and current limits

- Complete reconstructed planners remain within the existing 100 MiB encoded archive limit; at most 10,000 graph records are accepted. An oversized merged planner stops with local data preserved. Individual cloud nodes are also bounded to 100 MiB.
- The verified-object cache is limited to 32 MiB/1,000 entries. Metadata/download/upload waits are bounded. Pending edits remain in the existing local planner when offline; background scheduling resumes on reconnect.
- Immutable manifests and obsolete content are retained. Retention/garbage collection and a history browsing UI are not implemented; cloud storage usage can grow with edits. Existing manual cloud backups are neither deleted nor converted into sync versions.
- Initial pairing can require an entire snapshot transfer. Subsequent cloud transfers reuse unchanged content, though local snapshot validation currently walks the complete backup. Extremely large notebooks may need further performance work.
- Native previews retain the existing per-page/whole-export PNG bounds. Old archives without previews cannot display those drawings on the web until an updated iOS export generates them.
- The native build must advertise `syncDrawingEventsVersion:1`. Older installed apps cannot opt into or resume this feature. Physical iPad/iPhone timing, editor interruption and real-account cross-device sync remain release gates.

## Rules and rollout

The existing default Firestore database was verified as Standard/Native in `us-central1` using database metadata only. The proposed new rules require the authenticated UID to match the path, a strictly validated head with a server timestamp and monotonic revision, and immutable bounded JSON objects. No new public read/list permissions, cross-account access, deletes, or backup-policy changes are added. The rules are a prototype under review and have only been exercised against local emulators at this point; no live rules are deployed by this branch merely existing.

Before release: pass Node, browser (including Safari-engine reconciliation) and Auth/Firestore/Storage emulator checks; compile/sign the actual wrapper; update connected devices in place and verify existing Notes; review/deploy only the two rule files; publish the tested web build; then let the owner perform account authentication, source enrollment and receiving-device enrollment. The agent must not inspect or replace personal planner content to perform these steps. Record exact commits, checks and physical evidence in BLUEPRINT_STATUS.md.
