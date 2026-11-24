# Firebase pilot development

The first slice provides a testable sync engine for tasks and calendar events. It has no entry point in the shipped app. The Firebase adapter accepts an initialized Auth instance, Firestore instance and the modular Firestore SDK. It binds each store to the signed-in account. Keep these rules in a dedicated Firebase project when bringing up a real pilot so that their default-deny policy cannot replace rules for unrelated data.

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
