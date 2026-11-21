# Blueprint iOS notebook

The App target on the development Mac compiles `ios/App/BlueprintPencilPlugin.swift` and `ios/App/BlueprintPencilViewController.swift` from the project root group. The copies in `current/` were taken from those actual sources. The sibling `ios/App/App/` copies are outside the target. The standalone prototype is historical.

v9.46 adds `BlueprintPencilStore.swift` and `BlueprintPencilNavigation.swift` to the same App target. The plugin installs the finger recognizers on the existing inline canvas. The web notebook owns the viewport transform. The target continues using the original SHA-256 project/page paths in Application Support and the original PencilKit tool picker.

Native complete backups use format v3 with a checksummed ordered drawing manifest covering every live notebook page. Export flushes dirty inline ink and decodes existing files. Restore checks the manifest before staging, decodes PKDrawing bytes, writes and reads back new files under fresh page IDs, and commits the candidate planner through the existing import transaction. Originals remain available. Failed staging may leave unreferenced new files. Existing files are marked when first read. A marked drawing that subsequently disappears blocks loading and export. Drawings lost before this release first observed them cannot be distinguished from unused pages. A browser or older wrapper still creates v2 backups. Restoring v3 with ink requires the updated wrapper. Existing v1/v2 and plain planner imports remain supported.

Run the native storage regression on a Mac with Xcode using `xcrun swiftc native-pencilkit/current/BlueprintPencilStore.swift tests/native/main.swift -o /tmp/blueprint-store-test && /tmp/blueprint-store-test`. It creates a real PencilKit stroke and checks storage integrity in a temporary folder.

The separate Mac wrapper already contains the updated Swift sources and target references. When integrating into a different wrapper, diff its compiled plugin against these sources and preserve any device-specific additions. Verify the share extension remains part of its original target.

On the development Mac, stage from the verified checkout and install over the existing app:

```sh
cd ~/Documents/ChatGPT/dc6433/blueprint-v946
python3 scripts/stage-ios-web.py --ref HEAD ../canvas-ios/www
cd ../canvas-ios
npx cap copy ios
open ios/App/App.xcodeproj
```

Select scheme **App**, select the device, and press **⌘R**. Use the existing signing team and bundle identifier. Verify drawing, selection, erasing, tool picker, Focus, rotation, Split View, page switching and relaunch using a disposable notebook. Test complete restore into a separate test install with its own data before relying on it.

## v9.47 — note page PNG export (iOS rebuild required)

The compiled `BlueprintPencilPlugin.swift` now exposes `exportImage` and
`capabilities.imageExportVersion = 1`. It flushes current strokes before
rendering a transparent PNG in the exact logical page coordinate system. The
web Notes page flattens the page content and this PNG into a new, non-editable
Library image; the original PKDrawing, editable note objects and sidecar
backup format are unchanged. Earlier iOS plugins deliberately reject page
image export rather than silently omitting Pencil strokes. Copy the updated
Swift source into the compiled App target before using this action.

After running the normal web staging and `npx cap copy ios`, update the
compiled `ios/App/BlueprintPencilPlugin.swift` from the current repository
copy, verify any local-only changes, build in Xcode, and test a disposable
handwritten page. Save its image from the Pages `•••` menu and verify the
Library thumbnail includes native ink and typed content. Then reopen the
editable original and a complete backup to check nothing changed. Browser
and simulated tests cannot verify `PKDrawing.image(from:scale:)` on device.
