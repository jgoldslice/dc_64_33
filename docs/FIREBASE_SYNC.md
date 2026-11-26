# Firebase pilot development

The first slice provides a testable sync engine for tasks and calendar events. It has no entry point in the shipped app. The Firebase adapter accepts an initialized Auth instance, Firestore instance and the modular Firestore SDK. It binds each store to the signed-in account. Keep these rules in a dedicated Firebase project when bringing up a real pilot so that their default-deny policy cannot replace rules for unrelated data.

## Test the first slice

```sh
node --test tests/planner-sync.test.cjs
npm install --no-save --package-lock=false --no-audit --no-fund firebase@12.10.0 firebase-tools@15
npx --no-install firebase emulators:exec --project demo-blueprint-sync --only auth,firestore,storage 'node --test tests/firebase-planner.emulator.mjs'
```

The emulator test uses Node 22 and Java 21. It creates disposable email/password accounts and fixture records in the local `demo-blueprint-sync` project. The tag also keeps Firebase's CLI from routing emulator calls to a live project.

## Reconcile and apply

- Call `createFirebasePlannerStore` once for the current account. It fetches server snapshots from `users/{uid}/tasks` and `users/{uid}/events`. Each record uses a stable ID, a monotonic revision and a server timestamp. A null record is a deletion marker.
- Plan with the current **saved** planner, the last confirmed reconciliation baseline for that account, and a fresh server snapshot. With an empty baseline, this gives a first-sync preview that keeps distinct records and flags differing versions that share an ID. The preview is read-only. Review sample items and older imports before first upload.
- After opt-in, persist the apply intent and keep the baseline paired with the planner state it represents. Apply writes using their expected revisions. A stale revision requires reading again and recomputing the preview. Apply a reconciled download only if its corresponding cloud write, when present, was confirmed and the local planner did not change during the operation. Advance baselines only for records successfully reconciled on that device. On recovery from an interruption, re-read both sides and reconcile any pending intent before advancing the baseline.
- Use the existing guarded planner save for local applies. Patch supported fields into surviving records so local-only fields and the identity type used by existing callers are preserved. Validate Area, Goal and Project references and their corresponding links during app integration. This slice transfers reference IDs and Area names with tasks. Full related entities remain local at this stage.
- Keep the account binding during reconnect and sign-out. Journal or retain queued work by account. Preserve the local complete backup route and test upgrades, empty planners, simultaneous edits, offline relaunch, account changes and pending writes on real iPhone and iPad builds before enabling Sync in a production build.

## Configure Google sign-in and manual cloud backup

Use the [staged pilot checklist](FIREBASE_PILOT_CHECKLIST.md) for the console setup, Spark versus Blaze split, and physical-device acceptance tests.

1. In a dedicated Firebase project, register a Web app and the Apple app `com.jgoldslice.canvas`. Enable Google in Authentication → Sign-in method and add your web host to Authorized domains. Create a Firestore database and deploy this branch's rules explicitly to that project. The emulator uses a separate demo project.
2. Put the Web app's Firebase config object in `firebase-client.json` for the pilot build. The checked-in `null` disables the connection. Keep the iOS and web registration in the same Firebase project. The Apple app uses the same web configuration for its Firebase Auth session and Firestore.
3. Add `native-firebase/BlueprintGoogleSignInPlugin.swift` and `GoogleService-Info.plist` to the existing Xcode App target. Add the `GoogleSignIn` product from `https://github.com/google/GoogleSignIn-iOS` using Swift Package Manager. In the App target's Info settings, set `GIDServerClientID` to the Google provider's Web OAuth client ID and add the iOS plist's `REVERSED_CLIENT_ID` as a URL scheme.
4. In `BlueprintShareBridgeViewController.capacitorDidLoad()`, register `BlueprintGoogleSignInPlugin()` beside the existing plugins. In the active `SceneDelegate`, import `GoogleSignIn` and forward Google callback URLs from `scene(_:openURLContexts:)` to `GIDSignIn.sharedInstance.handle(url)`. Continue forwarding callback contexts to the existing Capacitor proxy.
5. Stage the web bundle using `scripts/stage-ios-web.py`, copy the pilot's `firebase-client.json` to the wrapper's `www`, run `npx cap copy ios` in the wrapper, and build the App scheme with the existing signing team and bundle identifier. The staging script copies app assets. Keep the pilot configuration in the wrapper's www directory for subsequent builds.
6. In **Customize → Cloud Backup**, sign in, save a disposable backup on the source device and restore on the second. Restore uses the same integrity checks and replacement confirmation as a local complete backup. Save a local complete backup of the receiving device before replacing its planner.

Manual cloud backups keep the existing complete archive byte-for-byte, including supported attachments and PencilKit drawings. Archives up to 750 KiB use the existing v1 Firestore document. Larger archives up to 100 MiB use an immutable Storage object plus a v2 Firestore manifest. Each save creates a separate immutable Firestore document. The pilot UI restores the newest version only. Automatic sync remains a separate integration with the task/event reconciliation module.


## Staged Storage pilot and account safety (2026-11-25)

- The checked-in `firebase-client.json` remains `null`. The initial code-only stage provisioned/deployed no services; the owner subsequently approved the live pilot described in the automatic-snapshot section below. In an approved dedicated pilot project, a configured `storageBucket` enables the large-archive path. Billing and the scoped live setup were subsequently approved by the owner; that approval is for the confirmed Blueprint project. Preserve separate approval boundaries for any unrelated project or public website publication. Configure bucket CORS for the actual web origin before using authenticated browser downloads; follow [Firebase download guidance](https://firebase.google.com/docs/storage/web/download-files#download_data_directly_from_the_sdk). Do not use public download links as a substitute for account-scoped access.
- Storage path: `users/{uid}/backups/{Firestore-generated-id}/archive.json`. Rules allow owner-only reads and create-only JSON uploads up to 100 MiB; overwrites, deletes and unrelated paths are denied. A v2 manifest records the exact path, encoded archive size and SHA-256. No planner schema or local archive format changes. This stage deliberately stores the complete archive together, rather than splitting/deduplicating attachments and drawings into another format.
- Upload the object first and publish the manifest only after success and an account recheck. A failed or ambiguous publication can leave an orphan object. No automated deletion or retry cleanup is enabled; review orphans manually in an approved pilot. An interrupted upload cannot become the newest listed backup without a published manifest. A missing/corrupt newest object fails visibly; restore does not silently select an older backup.
- Restore validates manifest path, size and digest before entering the existing importer. Its existing state, attachment and drawing checks still run before confirmation. An account guard is checked before reading, after validation, after confirmation and immediately before the synchronous local save. Sign-out or replacement of the authenticated user invalidates the pending operation, including sign-in again to the same UID. Staged attachments are rolled back on failure; the existing native staging path can retain unreferenced drawing files, but never publishes them into the planner on guard failure.
- Startup loads only Auth/configuration, restores persisted sessions without opening a popup, and makes no planner/backup writes. Persistence tries IndexedDB, then local storage, then a visibly disclosed session-only memory fallback, following [Firebase persistence guidance](https://firebase.google.com/docs/auth/web/auth-state-persistence). Actual WebView persistence, OAuth and signed iOS builds remain unverified.
- Legacy task `date` means deadline (`dueDate`); it no longer supplies a missing `scheduledDate`. Explicit schedules remain separate, including an intentionally empty deadline. Existing ambiguous pilot cloud records are not rewritten automatically. The reconciliation module remains disconnected from live planner writes.

### Compatibility and rollback

Old v1 cloud backups and local complete backup versions 1–3 remain readable. Storage v2 is an additive cloud envelope only: downloaded bytes are the same local complete archive. Older pilot builds cannot read v2 manifests and should fail closed; use local complete export for compatibility before rolling back a configured pilot. Removing `storageBucket` keeps small backups available and produces an explicit error for large backups/restores. Leave historical objects/manifests intact. The service worker uses a new asset cache name so the importer guard and cloud controller update together; it does not remove planner data or IndexedDB.

### Verification still required before any live rollout

Run demo-project emulator tests plus the browser/Node regressions. Verify live bucket CORS, denied cross-account access, sign-out during confirmation/staging, offline/relaunch, both old and Storage archives, and disposable complete drawing recovery on physical iPhone/iPad. The automated native bridge fixture checks bytes and fresh page IDs; it does not prove PencilKit rendering or device persistence. Version history is retained, but the UI still offers newest-only restore. There is no automatic synchronization, background backup, retention cleanup, or production rollout in this stage.


## Opt-in automatic snapshots (2026-11-25)

This stage adds **automatic backups**, not automatic reconciliation or cross-device planner replacement. The Cloud Backup checkbox starts off. Its confirmation explains the account, device scope and cost/volume policy. The local-first planner remains the primary working copy; every cloud snapshot is immutable and restore still asks before replacing local data.

### Scheduling and recovery

- A successful existing local save signals the backup controller. It waits 30 seconds after edits settle and allows at least five minutes between automatic versions. A five-minute fingerprint probe also catches saved sketch/native-ink changes that do not change the planner manifest. Hidden/offline windows do not start work. There is no promise of running after the app closes or iOS suspends it; persisted work resumes after reopening with the same signed-in account and consent.
- Fingerprints use the state checksum, drawing checksum and attachment integrity manifest, excluding the export timestamp. Unchanged data produces no new upload. Local complete archive formats 1–3 and their integrity checks remain unchanged.
- Account-bound consent is stored separately in `blueprint-cloud-backup-auto-v1:{projectId}`. A unique consent identity invalidates work after pause/re-enable, including changes in another tab. Sign-out/account replacement disables consent. Local/cloud import or Restore latest pauses automatic snapshots until the user enables them again.
- A separate IndexedDB database `blueprint-cloud-backup-queue-v1` (version 1, `queues` store) retains at most one exact complete-archive Blob and version ID per project/account, plus the last confirmed fingerprint/time and upload reservations. The queue is persisted before any cloud write and the stored Blob digest is rechecked on retry. Queue/storage failure does not publish an unjournaled backup or alter the planner. Browser window locks serialize automatic work across tabs; unsupported platforms retain manual backup.
- Automatic Firestore publication uses a server transaction with a fixed version ID. An identical retry recognizes the existing version without rewriting it; differing contents fail closed. Transactions do not use Firestore's offline write queue. A large archive whose object uploaded before a failure reuses that object only after downloading and verifying its size/SHA-256. No automatic deletion is introduced.
- Pausing prevents further publication checks and new attempts. An already-submitted network commit can still complete; it remains an immutable snapshot. The engine never applies it to the local planner. An explicit new enable discards any superseded local pending Blob and builds fresh work, while leaving cloud history intact.

### Volume policy and costs

Automatic snapshots are limited **per device** to 12 reserved versions and 200 MiB of encoded archive data per UTC calendar day; each archive is still limited to 100 MiB. Retries reuse a reservation. Manual backups are additional and are not restricted by these automatic quotas. Different devices have their own counters. These are application controls, not a server-enforced spending cap or abuse protection.

All cloud versions remain stored. Repeated full archives include their attachment bytes each time; unchanged media is not separately deduplicated across changed snapshots. Storage use grows with retained history. Failed/ambiguous uploads can retain orphan objects. Retention/cleanup remains a separate reviewed feature; nothing deletes old backups automatically.

Verified pricing on 2026-11-25: eligible regional Storage usage includes 5 GB-months stored, 100 GB monthly outbound transfer (destination restrictions apply), 5,000 Class A and 50,000 Class B operations. Iowa Standard storage is approximately USD $0.02 per GiB-month beyond the free allowance. For example, 20 GiB retained would be about $0.30/month for storage alone if the 5 GiB allowance is available; operations/transfers, other account usage, region and eligibility can change the bill. This is an estimate, not a guaranteed total.

Sources: https://firebase.google.com/pricing and https://cloud.google.com/storage/pricing

The owner selected a **USD $5 monthly Blueprint-only actual-spend alert**. It notifies the billing account's default recipients at 100% of the budget. It does not cap charges or shut services down.

### Live setup and remaining device work

The owner linked a card and authorized Storage. The one open billing account was linked to project `blueprint-bf366`; billing is verified enabled. The default Standard bucket `blueprint-bf366.firebasestorage.app` was created in `US-CENTRAL1`. Its deployed Storage rules were fetched back and exactly match this branch. CORS allows authenticated download requests from `http://localhost:8766` and `https://jgoldslice.github.io`; no public read permission or download token was added.

A synthetic 1,206,180-byte complete archive containing a 902,647-byte real PNG was uploaded/downloaded through that live bucket, its SHA-256 matched, signed-out access was denied, and the photo restored after browser reload with the same checksum and 512×512 dimensions. This used administrator transport in a unique verification namespace; it did not publish a version into the user's backup collection. The synthetic object was removed using its exact generation. This does **not** prove signed-in client upload/download or physical PencilKit recovery.

The existing native archive helper now exposes its already-existing capability check to the automatic controller. Native automatic backup refuses to run without drawing-archive support. No Swift code, existing Xcode wrapper, signing identity or installed app has been changed by this stage. Native Google sign-in integration and a reviewed build/installation over the existing app still require completing the staged native checklist and keeping complete device exports outside the app. Test real Pencil drawings, app suspension, queue recovery, and cross-device native restore before claiming device readiness.

### Reversible local changes

No existing planner or attachment database is migrated. Disabling automatic backups stops scheduling and removes consent to resume. Rolling back to an older app leaves the additional queue/settings unused; do not clear original planner/attachment storage. The new queue contains only pending cloud copies and bookkeeping, never authoritative planner records. No new consent setting is carried in complete backup exports, so importing an archive on another device does not enable automatic uploads there.
