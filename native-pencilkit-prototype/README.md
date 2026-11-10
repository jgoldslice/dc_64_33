# Blueprint v9.0 — PencilKit prototype (DRAFT)

Status: SOURCE PROTOTYPE ONLY. The native code is not yet registered or compiled inside the actual Xcode application, and no experimental code is loaded by the published Blueprint web page. The public repository does not contain the local Xcode/Capacitor wrapper.

## Files

- BlueprintNativeDrawingStore.swift — independent, versioned PKDrawing storage; verified SHA-256 digests and immutable page revisions; high-resolution previews; explicit export and non-destructive import.
- BlueprintPencilEditorViewController.swift — UIKit editor with PKCanvasView, native zoom, pen, pencil, eraser, lasso, undo/redo, multiple existing page IDs, autosave, and save-on-close.
- BlueprintPencilPlugin.swift — optional Capacitor plugin: capabilities, openEditor, exportPage, importPage.
- web/bridge.js — standalone, checksum-checked sidecar transport for native pages.
- web/register-plugin.ts — example JavaScript registration.
- Tests/BlueprintNativeDrawingStoreTests.swift — XCTest source, not yet attached to a native test target.

No existing project, localStorage, IndexedDB, SVG ink, or complete-backup contents are modified by the native source files. Existing SVG notes remain editable.

## Set up in the existing Xcode app

1. Export a complete backup of your current Blueprint test data, then use a separate test project or app install.
2. Open the real existing Capacitor Xcode project on your Mac. Find its installed Capacitor major version.
3. Add the three Swift source files above to the iOS app target. Add the XCTest file to a separate iOS test target. Ensure Capacitor, PencilKit, UIKit and CryptoKit are importable.
4. Register the app-local plugin using a CAPBridgeViewController subclass, as supported in your installed version. For recent Capacitor versions, a representative method inside the subclass is:

       override func capacitorDidLoad() {
           bridge?.registerPluginInstance(BlueprintPencilPlugin())
       }

   Make that subclass the app's actual bridge controller in Xcode. Merely adding a Swift class file does not register a plugin.
5. On the JavaScript side of the *native wrapper*, use Capacitor's registerPlugin API (example provided under web/register-plugin.ts). The public static web app is not bundled with npm, so do not add an unresolved bare module import to its live index.html.
6. Call capabilities first. Then openEditor with the EXISTING web project ID, current page ID, and an array of distinct existing note page IDs. Only invoke from an explicit experimental entry point; do not replace the current web editor.
7. On physical iPad, test Pencil, eraser, undo, zoom, page switching, rotation, close/reopen, force quit/reopen, storage errors, and native backup round-trip before any production merge.

Official references: https://developer.apple.com/documentation/pencilkit/pkcanvasview and https://capacitorjs.com/docs/plugins/ios

## Architecture

    Blueprint projects/goals/tasks (web)        Existing SVG notes (web)
                 |                                      |
      registerPlugin('BlueprintPencil')          unchanged local storage
                 |
         Capacitor native bridge
                 |
      UIKit PKCanvasView editor
                 |
       Native PKDrawing per page
                 |
       immutable versioned drawing + PNG
                 |
        atomic, SHA-256-checked manifest
                 |
          native export/import sidecar
                 |
      FUTURE backup integration and device sync

The native canvas is the single zoom owner. It does not wrap PKCanvasView inside a CSS-scaled page. The native drawing page has a fixed 1024 x 1440 point coordinate space. Existing Blueprint textboxes and pictures are not yet composited into the native view. Their alignment with native ink requires a deliberate shared coordinate specification and integration tests; do not claim that is solved.

Native page selection uses existing web page IDs only. Page creation/deletion still belongs to the web project model. No automatic migration, deletion, or overwrite of legacy SVG notes is performed.

## Safe storage

The manifest is written only after newly named drawing and PNG files have been committed. A crash before manifest commit leaves the previously committed version untouched; orphaned files are intentionally not deleted in this prototype. Reading checks the SHA-256 checksum and the project/page identity. Export includes editable PencilKit binary data and a read-only PNG preview. Import refuses overwrite unless specifically permitted by a user-confirmed restore flow.

## Backup status — important limitation

The JS adapter can export/import standalone versioned native-ink sidecar bundles, with stable IDs and checksums validated BEFORE an import begins. These are NOT yet included in the current v74.js complete-backup download. Multi-page native sidecar imports are atomic one page at a time, not all-or-nothing across the entire set. The existing backup exporter and restorer require an additional integration phase before PencilKit can become the default editor.

Also, native ink stays on the device running the editor; iPhone preview transfer and iCloud/cloud sync are NOT implemented in this PR. Test the sidecar transfer manually to a separate app installation.

## Open-source references and license review

No third-party code was copied or transplanted.

- OwlLuna — MIT; per-visible-page PencilKit canvases, page isolation, zoom ownership, and measured large-notebook performance: https://github.com/owaisazmal/OwlLuna
- Signotes — MIT; UIKit container, native zoom and rendering-quality plan: https://github.com/SignoCreator/signotes
- Tertiary NotePad — public source; a standard reuse license could NOT be verified from the repository metadata, so treat strictly as reading/design reference: https://github.com/alfredang/notepadapp
- Excalidraw — MIT; web scene/object interaction patterns: https://github.com/excalidraw/excalidraw

Check upstream attribution/licensing before copying any external code in the future.

## Benchmark before deciding to replace web Notes

Use an actual iPad and Apple Pencil, same sample of handwriting, equations, circles and diagonal strokes:

- 100%, 150%, 200% and 500% zoom, including immediately after pinch: screenshots at device pixel resolution, compare clarity.
- Long writing: measure input feel, missing segments, lag and palm rejection. Browser automation cannot reproduce true Pencil sampling.
- Pen, pencil, eraser, lasso, undo and redo: correctness after repeated changes.
- Draw, rotate, resize in Split View, close and reopen: no shifts or lost strokes.
- Export, tamper a checksum, import into separate native test storage: corruption rejected, no accidental overwrite.
- Native preview at 2x on iPhone: fit-to-width without cropping (requires transfer integration).
- 10–100 pages and hundreds of strokes per page: startup latency, frame hitches, memory use, and file growth.
- A mixed page containing images, textboxes and ink: FAIL until native/web coordinate mapping is implemented and proven.

Web tests: npx playwright test tests/blueprint-ink-v90.spec.cjs tests/blueprint-native-transport-v90.spec.cjs

Native XCTest: requires the Swift files in an actual iOS/Xcode target; use Xcode Test (Command-U). No Xcode build or physical-device testing has been performed by the GitHub Chromium-only workflow.

## Release gates

- Successful Swift compile and native test run on the user's Capacitor/Xcode configuration.
- Device-tested handwriting quality and zoom, save/reopen, and background interruptions.
- Verified mapping of native ink, textboxes, images and viewports.
- Integrated, recovery-tested complete backup for BOTH old SVG data and new PKDrawing resources.
- Working and documented cross-device preview availability, or an explicit local-only mode.
- Separate PR #36 (iPad/iPhone layout) reconciled without unexpectedly merging that draft.

Until these gates pass, keep this experimental feature disabled in production and leave existing Notes as the default editor.
