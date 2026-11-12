# Blueprint native Share Sheet — staged implementation (NOT SHIPPED)

**Branch:** `feature/native-share-extension-staging`  
**Status:** Source code and browser-side importer tests only. The public repository does **not** contain the user's actual Capacitor/Xcode wrapper. These Swift files are not yet added to an Xcode target, signed, compiled, tested on a device, or registered with iOS. **Do not merge, deploy, or delete the existing native app in order to test this.**

## Intended friction-minimizing experience

1. From iOS Photos, Safari, Files, or an app exposing the system Share Sheet, choose **Blueprint**.
2. The extension shows the previously used project selected by default, with a project menu to change it. Tap **Save to Blueprint**.
3. The extension copies the content to an **App Group inbox**, atomically commits a versioned manifest with SHA-256 hashes, and closes the Share Sheet. This is a **queued** save, not an IndexedDB import yet.
4. Next time the installed Blueprint app opens, the app-local Capacitor bridge reads the inbox and imports files into the exact project Library selected. It verifies binary readback and a planner manifest save **before acknowledging/removing** the queued payload.
5. If app storage is full, an item is corrupted, the project was deleted, or the web app state is stale, the pending payload remains for a retry. A small notice offers Retry. No arbitrary project fallback.

Supported in this prototype: HTTPS/HTTP links, PNG/JPEG/HEIC/HEIF/GIF/WebP images, and PDFs; maximum **8** provider attachments and **20 MiB** per file. Apps with custom share menus (e.g. TikTok's first share sheet) may not surface third-party iOS extensions; their system Share Sheet or Copy Link is the fallback.

## Files

- `BlueprintShareInbox.swift` — shared Swift model and atomic App Group inbox, project index, checksummed payloads, validated acknowledgments. Include in **both** host application and share extension targets.
- `BlueprintShareViewController.swift` — iOS Share Extension UI, project dropdown, provider handling. Include in **extension target only**.
- `BlueprintShareBridgeViewController.swift` — optional app bridge subclass that registers the plugin; set as Main.storyboard custom class if the existing app has no custom bridge (app target only).\n- `BlueprintSharePlugin.swift` — Capacitor app-local plugin (`BlueprintShare`): publishProjects, listPending, readFile, acknowledge. Include in **app target only**.
- `web/inbox.js` — opt-in, checksum-checked importer using Blueprint's existing project Library, IndexedDB `v6Blob`, and guarded `save(true)`.
- `web/host-entry.js` — opt-in native wrapper wiring: publishes lightweight project index on startup and app resume, imports pending shares, shows retry notice. **Not loaded in public GitHub Pages**.
- `tests/blueprint-share-inbox.spec.cjs` — automated JS tests for link + image import, project selection, corruption, stale saves and retries.
- `Tests/BlueprintShareInboxTests.swift` — native XCTest source for queue roundtrip, corruption, invalid project IDs and last-used destination. Not yet run against a signed Xcode test target.

## Safe preparation from a Mac terminal (does not activate the extension)

The GitHub repository contains the staged native source, but **not** the actual Xcode wrapper. On the owner's Mac, these commands copy the prepared Swift and JS sources into isolated staging folders alongside the existing wrapper. They will **not** rewrite the project configuration, register capabilities, change the current app, or install anything.

```bash
cd "$HOME/Documents/dc_64_33" || exit 1
git fetch origin feature/native-share-extension-staging
mkdir -p "$HOME/Documents/ChatGPT/dc6433/canvas-ios/share-staging"
git archive FETCH_HEAD native-share-extension | tar -x -C "$HOME/Documents/ChatGPT/dc6433/canvas-ios/share-staging"
bash "$HOME/Documents/ChatGPT/dc6433/canvas-ios/share-staging/native-share-extension/scripts/prepare-ios.sh"
```

If the Capacitor project is in a different folder, supply that path as the script's first argument. The script refuses to overwrite an existing staged source file with different content, and backs up `project.pbxproj` before any manual Xcode editing. **It does not replace a complete user-data backup.**

After staging, open the working project:

```bash
open "$HOME/Documents/ChatGPT/dc6433/canvas-ios/ios/App/App.xcodeproj"
```

**Important:** This is a safe staging operation, **not** a one-click iOS Share Extension installer. The following native integration steps still require Xcode on the actual Mac.

## Mac/Xcode integration (once the real project is accessible)

1. On the Mac, verify the **actual** Capacitor project location/version, active git branch, bundle identifier, signing team, deployment target and current Xcode project. Use the existing working app; do not generate a replacement Capacitor project over it.
2. **Export a complete Blueprint backup** and preserve a safe copy before any native build tests. Use a disposable test project for initial capture. The Safari/PWA database is **not** automatically the same database as the Capacitor WKWebView database.
3. In Xcode, select the **main App target → Signing & Capabilities → + Capability → App Groups** and create a unique identifier under your Apple developer team, for example `group.<actual-bundle-identifier>.shares`. **Use the actual ID returned by Xcode, not the example text.**
4. **File → New → Target → Share Extension** (iOS). Name it something such as `BlueprintShareExtension`; embed it in the main app and configure its bundle ID/signing/deployment target to match your setup. Add the **same App Groups entitlement** to this new extension target.
5. Add `BlueprintShareInbox.swift` to **both** targets (and separately to the iOS test target for the isolated XCTest bundle); `BlueprintShareViewController.swift` only to the new extension; `BlueprintSharePlugin.swift` only to the main app. If the extension template creates its own share controller, remove the template controller's build-target membership to avoid two competing entry points.
6. In **both** target Info.plist files, add string key **`BlueprintAppGroupID`** with the exact App Group identifier from step 3. Neither target should have an example placeholder.
7. Configure the Share Extension's `Info.plist` `NSExtension` dictionary. It should contain:
   - `NSExtensionPointIdentifier`: `com.apple.share-services`
   - `NSExtensionPrincipalClass`: `$(PRODUCT_MODULE_NAME).BlueprintShareViewController`
   - `NSExtensionAttributes → NSExtensionActivationRule` dictionary with `NSExtensionActivationSupportsImageWithMaxCount = 8`, `NSExtensionActivationSupportsFileWithMaxCount = 8`, `NSExtensionActivationSupportsWebURLWithMaxCount = 1`, and `NSExtensionActivationSupportsText = true`.
   - Restrict activation to supported types; the extension validates MIME and URL again. Check the generated Xcode template's existing extension dictionary instead of creating duplicate keys.
   - Set the extension target's **`CFBundleDisplayName` to `Blueprint`** so Photos shows a recognizable destination instead of the internal target name.
   - If the Xcode extension template supplies **`NSExtensionMainStoryboard`**, remove that key when using `NSExtensionPrincipalClass`; do not configure both entry points. Confirm the extension can launch its Swift view controller.
8. Register `BlueprintSharePlugin()` in the **actual** Capacitor bridge controller. The staged `BlueprintShareBridgeViewController.swift` implements the supported Capacitor subclass approach. If the existing app uses the standard bridge, add the new class to the **app target** and set its custom class in `App/Base.lproj/Main.storyboard` to `BlueprintShareBridgeViewController` with the **actual app module**. If the app already has a custom bridge subclass, merge the `capacitorDidLoad()` registration into the existing class instead of installing a second bridge. Verify installed Capacitor version; never assume that copying a Swift class makes it active.
9. In the actual native Capacitor web-asset bundle, include `web/inbox.js` **followed by** `web/host-entry.js` after Blueprint's existing app scripts. The latter is deliberately gated behind `Capacitor.isNativePlatform()` and `isPluginAvailable('BlueprintShare')`. Ensure the bundled JS files are copied as assets according to that wrapper's existing build process. The public web page should not reference the prototype while Xcode setup is unfinished.
10. Build and run the main app on a physical iPhone; open Blueprint once so the host publishes your list of current projects to the App Group. Then open Photos, choose an image → system Share Sheet → Blueprint, select the project, and Save. Reopen the installed Blueprint app to confirm import. Repeat for Safari URL, PDF, multiple photos, offline use, and app termination between queue and import.
11. Verify both failure recovery and backup compatibility before enabling broadly: no wrong-project saves, duplicate files, checksum or size bypasses, premature queued-file deletion, empty project list, accidental stale-window overwrite, or changes to older complete-backup formats.

### Release gates / known limitations

- **No real Xcode compile or XCTest/device run yet.** Swift files are staging prototypes and may require adjustments for the particular installed Capacitor / iOS SDK version.
- **No background import into a closed WKWebView.** A successful native share adds an item to the App Group **queue**; it appears in the Library after the installed app next runs its web importer.
- **No Safari↔installed-app or cross-device sync.** Project names for the extension come from the installed app's last published lightweight snapshot; if a project was created only in Safari, it will not appear until synchronized by another mechanism.
- **No automatic modification of the locally installed Xcode app or Apple signing profiles** from a GitHub push.
- Binary transfer uses Base64 through the bridge for this prototype, with a 20 MiB cap and a readback checksum. Consider a streaming/native file URL solution only after assessing device memory.
- If the target app is reinstalled, confirm how iOS retains App Group data before relying on queued items. **Do not uninstall to force an update.**
- Run the existing Blueprint browser smoke suite plus real-device tests before merging or shipping. The test suite only verifies the JavaScript importer, not the native Share Extension target.

Official reference material:
- Apple App Groups: https://developer.apple.com/documentation/xcode/configuring-app-groups
- Apple app extension Info.plist activation keys: https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AppExtensionKeys.html
- Apple NSItemProvider temporary file lifecycle: https://developer.apple.com/documentation/foundation/nsitemprovider/loadfilerepresentation(forTypeIdentifier:completionHandler:)
