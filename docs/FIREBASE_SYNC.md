# Firebase pilot development

The first slice provides a testable sync engine for tasks and calendar events. The draft now exposes a limited, explicitly reviewed sync pilot in Customize. The released main branch is unchanged. The Firebase adapter accepts an initialized Auth instance, Firestore instance and the modular Firestore SDK. It binds each store to the signed-in account. Keep these rules in a dedicated Firebase project when bringing up a real pilot so that their default-deny policy cannot replace rules for unrelated data.

## Test the first slice

```sh
node --test tests/planner-sync.test.cjs
npm install --no-save --package-lock=false --no-audit --no-fund firebase@12.10.0 firebase-tools@15
npx --no-install firebase emulators:exec --project demo-blueprint-sync --only auth,firestore 'node --test tests/firebase-planner.emulator.mjs'
```

The emulator test uses Node 22 and Java 21. It creates disposable email/password accounts and fixture records in the local `demo-blueprint-sync` project. The tag also keeps Firebase's CLI from routing emulator calls to a live project.

## Reconcile and apply

- Call `createFirebasePlannerStore` once for the current account. It fetches server snapshots from `users/{uid}/tasks` and `users/{uid}/events`. Each record uses a stable ID, a monotonic revision and a server timestamp. A null record is a deletion marker.
- Plan with the current **saved** planner, the last confirmed reconciliation baseline for that account, and a fresh server snapshot. With an empty baseline, this gives a first-sync preview that keeps distinct records and flags differing versions that share an ID. The preview is read-only. Review sample items and older imports before first upload.
- After opt-in, persist the apply intent and keep the baseline paired with the planner state it represents. Apply writes using their expected revisions. A stale revision requires reading again and recomputing the preview. Apply a reconciled download only if its corresponding cloud write, when present, was confirmed and the local planner did not change during the operation. Advance baselines only for records successfully reconciled on that device. On recovery from an interruption, re-read both sides and reconcile any pending intent before advancing the baseline.
- Use the existing guarded planner save for local applies. Patch supported fields into surviving records so local-only fields and the identity type used by existing callers are preserved. Validate Area, Goal and Project references and their corresponding links during app integration. This slice transfers reference IDs and Area names with tasks. Full related entities remain local at this stage.
- Keep the account binding during reconnect and sign-out. Journal or retain queued work by account. Preserve the local complete backup route and test upgrades, empty planners, simultaneous edits, offline relaunch, account changes and pending writes on real iPhone and iPad builds before enabling Sync in a production build.

## Configure Google sign-in and manual cloud backup

1. In a dedicated Firebase project, register a Web app and the Apple app `com.jgoldslice.canvas`. Enable Google in Authentication → Sign-in method and add your web host to Authorized domains. Create a Firestore database and deploy this branch's rules explicitly to that project. The emulator uses a separate demo project.
2. Put the Web app's Firebase config object in `firebase-client.json` for the pilot build. The checked-in `null` disables the connection. Keep the iOS and web registration in the same Firebase project. The Apple app uses the same web configuration for its Firebase Auth session and Firestore.
3. Add `native-firebase/BlueprintGoogleSignInPlugin.swift` and `GoogleService-Info.plist` to the existing Xcode App target. Add the `GoogleSignIn` product from `https://github.com/google/GoogleSignIn-iOS` using Swift Package Manager. In the App target's Info settings, set `GIDServerClientID` to the Google provider's Web OAuth client ID and add the iOS plist's `REVERSED_CLIENT_ID` as a URL scheme.
4. In `BlueprintShareBridgeViewController.capacitorDidLoad()`, register `BlueprintGoogleSignInPlugin()` beside the existing plugins. In the active `SceneDelegate`, import `GoogleSignIn` and forward Google callback URLs from `scene(_:openURLContexts:)` to `GIDSignIn.sharedInstance.handle(url)`. Continue forwarding callback contexts to the existing Capacitor proxy.
5. Stage the web bundle using `scripts/stage-ios-web.py`, copy the pilot's `firebase-client.json` to the wrapper's `www`, run `npx cap copy ios` in the wrapper, and build the App scheme with the existing signing team and bundle identifier. The staging script copies app assets. Keep the pilot configuration in the wrapper's www directory for subsequent builds.
6. In **Customize → Cloud Backup**, sign in, save a disposable backup on the source device and restore on the second. Restore uses the same integrity checks and replacement confirmation as a local complete backup. Save a local complete backup of the receiving device before replacing its planner.

Manual cloud backups use the existing complete archive, including supported attachments and PencilKit drawings, up to 750 KiB per encoded archive. Larger archives still use the local export. Each save creates a separate immutable Firestore document. The pilot UI restores the newest version only. Automatic sync remains disabled. The manual planner sync pilot described below is separate from full backup and restore.

## Manual planner sync pilot (draft)

In Customize → Cloud Backup, sign in and choose **Preview planner sync**. The preview prepares a device-local pairing ID with a guarded local save, reads the server, and shows proposed uploads, downloads, conflicts, and excluded records. It does not upload or download planner changes until **Apply reviewed sync** is confirmed. Check the displayed records carefully, especially sample tasks on a fresh installation. Only standalone tasks and calendar events are included; Area, Project, Goal and Idea-linked tasks (including back-references), notes, habits and all deletion propagation remain outside this pilot. Conflicts block Apply; resolve the underlying records on a device and preview again. No automatic background process runs.

The journal key includes Firebase project, account UID and local planner generation. The generation is stripped from complete backup exports and imports, preventing a restored planner from inheriting another device's checkpoint. Existing planner schema keys and backup archive versions remain valid. The coordinator persists a pending intent before cloud transactions, confirms expected revisions, re-reads server heads and verifies the local manifest before applying downloads. Only mutually matching heads advance the checkpoint. An interrupted run may have committed some cloud writes; it never blindly retries a prior intent. Preview again to reconcile the actual current data. Keep local backups; sync is not a replacement for backup.

Tests: `node --test tests/planner-sync.test.cjs tests/planner-pilot.test.cjs` and the existing Playwright cloud backup spec. Native iOS staging now supports the nested sync modules; the client configuration remains an explicit pilot setup and is not service-worker cached. Test two devices with disposable planner data, account switches, network interruption, concurrent edits, backup restore and fresh pairing before using real data. No live project setup, rules deployment, signed iOS build or automatic sync has been verified.
