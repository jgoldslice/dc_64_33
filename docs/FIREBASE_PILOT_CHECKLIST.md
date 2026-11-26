# Blueprint Firebase pilot checklist

Prepared 2026-11-25 for draft PR #104. This is a setup and test plan, not evidence that a live project or installed app has been configured.

## Starting evidence

- The owner's screenshot shows a Firebase project named **Blueprint**, the **Spark** plan, and an **Add app** button. It does not establish the project ID, registered app list, enabled authentication providers, database region, existing rules, or bucket state.
- Draft #104 head `c690525393c28b2116a0d04982c84f8446f8c84d` has successful browser and emulator CI. The tested implementation passed 410 browser, 47 Node and 6 Auth/Firestore/Storage emulator tests. These are not live OAuth or native-device tests.
- The owner has approved continuing setup and pilot preparation in this chat. Account access and the exact target project still need to be established. Do not repeat an approval request for the same authorized setup; obtain missing target/account information through the Firebase connection.
- At initial preparation, the official Firebase integration was not connected. It has since been installed and the owner completed CLI sign-in; see Current result for verified live actions. Viewing a screenshot alone does not grant project access.

## Stage 1: Establish the target and register the app

1. Install the official Firebase integration in Codex and connect the account used for Blueprint. Inspect the project list and identify the exact project ID matching the owner's console. Read existing apps, providers, databases, rules and billing state before changing them. Preserve services used by any unrelated app.
2. Register a **Web** app in that project, or reuse the existing matching registration. Suggested nickname: **Blueprint Web Pilot**. The web registration is also used by the current Capacitor app's JavaScript client, so it is needed even when testing on iPhone/iPad.
3. From the screenshot, the manual route is **Add app → Web (</>) → nickname → Register app**. Leave Firebase Hosting unselected for this stage; the existing website uses GitHub Pages. Keep the generated `firebaseConfig` object for the pilot build. Do not create another project simply because the app has not been registered.
4. Record the real project ID, app ID and auth domain. Use the generated values exactly. A web configuration object is client configuration, not an administrator credential. No service-account private key, password, access token or billing details are needed in chat or GitHub.
5. Keep the checked-in `firebase-client.json` disabled until this build is deliberately configured. Use a separate pilot copy/origin; do not accidentally expose the configured pilot by merging or publishing the public website.

Official setup: https://firebase.google.com/docs/web/setup

## Stage 2: Spark sign-in and small manual backups

1. In **Security → Authentication → Sign-in method**, enable Google. Complete the project support-email selection using the account owner. Inspect existing provider settings before changing them.
2. In Authentication settings, add the exact pilot hostname to Authorized domains. For the existing GitHub Pages website, the hostname is `jgoldslice.github.io` (no scheme or repository path). Authorize a different host only if the pilot actually runs there. A domain authorization does not publish the pilot.
3. Use Cloud Firestore **Standard edition**, the `(default)` database and locked/production rules. Inspect whether it already exists. If creating it, choose the actual region with the owner before the irreversible location selection; no location can be inferred from the screenshot. Reuse an appropriate existing database rather than replacing it.
4. Compare the live rules with this branch's `firestore.rules`. Apply only to the confirmed dedicated pilot project after checking for unrelated collections. The shipped rules intentionally deny unrecognized paths. Record project ID, deployed rules and date. Never select broad test-mode access as a shortcut.
5. Configure the isolated pilot's `firebase-client.json` with the generated web object. For this **small-backup-only** stage, omit `storageBucket` even if the console includes a generated bucket name. That name alone does not prove a usable bucket exists. The current code selects Storage when the field is present.
6. Verify sign-in and sign-out with disposable data. Reload/close and reopen the pilot to check session persistence. If storage is unavailable, the UI must disclose session-only sign-in.
7. Save a complete archive smaller than 750 KiB with **Back up now**. Confirm a new immutable document appears under `users/{actual-uid}/backups`. Restore it into a separate disposable pilot browser/device and verify all fixture records.
8. Create a second disposable Google account only if available to the tester. It must not list or restore the first account's backup. No planner upload should occur just by signing in or reopening the app.

Google sign-in: https://firebase.google.com/docs/auth/web/google-signin

## Stage 3: Storage and large archives

Cloud Storage for Firebase requires the pay-as-you-go **Blaze** plan. Spark alone cannot provision/use the required bucket. Blaze links a Cloud Billing account; a no-cost usage allowance is not a guarantee of zero charges. The account owner must complete any required billing enrollment/terms. Do not claim a budget alert is a spending cap.

1. Inspect billing/project state through the authenticated connection. Complete account-owner billing steps in the console when required. Record the actual project ID before upgrading or provisioning. Configure a budget alert using an amount chosen by the owner; no spending threshold has been provided in this chat.
2. Inspect existing buckets. Create a dedicated pilot bucket only if needed, selecting a location with the owner rather than inventing one. Record its exact name.
3. Compare and deploy this branch's `storage.rules` to the confirmed bucket/project. Preserve unrelated bucket rules. Verify private reads and create-only writes with the live pilot account; emulator success does not replace this check.
4. Configure CORS for authenticated SDK downloads from the exact pilot origin. For the existing website, the origin is `https://jgoldslice.github.io`. Add other origins only when actually used. Follow the official download guidance; do not make objects public or use tokenized download links as a workaround.
5. Add the actual `storageBucket` to the isolated pilot configuration. Save a fixture archive larger than 750 KiB and smaller than 100 MiB, containing a photo, editable note objects, and native handwriting when the native build is ready.
6. Confirm that an immutable object exists at `users/{uid}/backups/{version-id}/archive.json`, with a v2 Firestore manifest recording the same path, size and SHA-256. Restore and compare the actual contents.
7. Interrupt a disposable upload/download by going offline. A failed upload must not publish an incomplete newest version; a failed download must not replace the local planner. An uploaded object may remain orphaned after a publication failure. There is no automatic orphan deletion.

Billing requirement: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

Authenticated download/CORS: https://firebase.google.com/docs/storage/web/download-files#download_data_directly_from_the_sdk

## Stage 4: Native build preparation

1. Export a complete local backup from each device and keep the files outside the app before any installation work. Do not uninstall the existing app or clear its storage.
2. Inspect the actual Capacitor/Xcode wrapper, bundle identifier, signing team, uncommitted edits and registered plugins read-only before touching it. `com.jgoldslice.canvas` is the repository's intended registration; verify it against the actual target before registering an Apple app.
3. Register/reuse the matching Apple app in the same Firebase project. Obtain its `GoogleService-Info.plist`. The native sign-in bridge needs the iOS OAuth client and the web OAuth server client. Do not confuse the two client IDs.
4. Follow `FIREBASE_SYNC.md` for the GoogleSignIn package, plugin registration, URL scheme and active scene callback integration. Preserve the existing sharing and PencilKit integrations.
5. Stage the reviewed revision using the existing guarded staging script only after inspecting the wrapper. Copy the deliberate pilot configuration separately; the staging script does not currently include `firebase-client.json` in its asset list. Build and install over the existing app with its verified signing identity. No native installation has been performed by this checklist.

## Stage 5: Device acceptance tests

Use disposable records and a receiving device/profile that contains no irreplaceable data. A restore replaces the receiving planner; it is not a merge.

| Test | Action | Expected result |
| --- | --- | --- |
| No implicit upload | Sign in, relaunch and edit a fixture without pressing Back up now | Local edits save locally; no backup version is created automatically |
| Session recovery | Close/reopen the pilot, then explicitly sign out and reopen | Supported persistence restores the session; explicit sign-out stays signed out |
| Small archive | Save and restore a small complete backup | Tasks, deadlines, explicit schedules, notes and references match |
| Legacy archive | Import an old local complete archive on the disposable receiver | Existing formats remain readable; deadlines do not silently become appointments |
| Native drawing archive | Save a large v3 archive, restore on updated iPad, switch pages, relaunch, continue drawing | Original ink remains visible/editable on the correct pages; no unrelated local ink appears |
| Attachments | Open each restored photo/file, then export again | Bytes and links remain intact; required attachments are not missing |
| Confirmation cancellation | Cancel restore confirmation | Local saved data remains unchanged |
| Account switch | Change/sign out of the Firebase account while a restore is awaiting confirmation or staging | Restore cannot commit to the local planner under the changed session |
| Interrupted download | Go offline during restore download | Visible failure; receiving planner remains unchanged |
| Corrupt/missing object | Use an intentionally broken backup only in the disposable pilot | Integrity/missing-file error; no local replacement and no silent older-version fallback |
| Privacy | Sign into another disposable account | First account's cloud backups are inaccessible |
| Large archive without Storage | Omit storageBucket and try a large manual backup | Clear limit/configuration error; local Export backup remains available |

The account-switch-during-staging case may need a controlled test delay; do not manipulate a real personal backup to reproduce it. Native staging failures can leave unreferenced temporary drawing files, but must not publish their page IDs into the saved planner.

Record device, OS, build revision, project ID, account identifier (no tokens), archive version/size, outcome and any failure message for each test. Stop on an unexplained integrity or recovery failure and preserve exports and staged data for diagnosis.

## Completion criteria

- Live Google sign-in, private cloud access, persistence, small and large restore, interruption/account-switch protection, and native drawing recovery have device evidence.
- Existing local planner keys and complete backup formats remain intact.
- Automatic sync, background backup, retention cleanup and newest-version selection behavior have not been changed during this pilot.
- Only then plan a read-only task/event sync preview. Applying preview changes requires a durable per-account baseline and recoverable apply journal before automatic writes can be considered.

## Current result

Verified live setup after the owner completed sign-in and selected Iowa:

- Project `blueprint-bf366` identified; Web and iOS pilot apps registered. Native bundle ID was checked against the actual existing Xcode target before registration.
- Default Standard Firestore database created in `us-central1`; private rules deployed and fetched back byte-for-byte. A signed-out read probe was denied as expected; no planner document writes were performed.
- Google sign-in backend configured. Native configuration downloaded into isolated staging with OAuth identifiers present. Actual in-app Google sign-in, signed-in manual backup and device recovery remain pending.
- A separate configured web pilot is available on the Mac at `http://localhost:8766/` while its local server runs. Its real Firebase initialization passed a phone-viewport browser check. Use **Customize → Cloud Backup → Continue with Google** with disposable test data. This is a separate browser origin from the installed app and public website.
- Repository configuration stays disabled; no website publication, native-wrapper modification or installation was performed. The existing wrapper has local edits and must be preserved when integration resumes.
- Storage/billing/CORS and large-archive live tests remain pending. The user must complete any required billing enrollment through the console. Back up each device outside the app before any native installation.

For exact identifiers, verification scope and remaining limits, see the 2026-11-25 live-setup entry in `BLUEPRINT_STATUS.md`.
