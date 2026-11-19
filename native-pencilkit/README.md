# PencilKit page navigation (v9.41)

The bundled `BlueprintPencilNavigation.swift` is a native integration helper, **not a replacement** for the owner's existing `BlueprintPencilPlugin.swift`. It does not read or modify drawing data.

## Behavior

- Apple Pencil still draws and erases through PencilKit and its native tool picker.
- One finger pans the Notes page within its existing scroll limits.
- Two fingers pinch to zoom and pan, using the Notes web viewport's existing bounded zoom; toolbar minus, plus, and 100% use that same zoom.
- Works in regular Notes and Focus once integrated in the existing Swift plugin.

## Why the native helper is needed

The `PKCanvasView` is layered above the web notebook. The web page does not receive the native touches. The Swift helper adds finger-only gesture recognizers, sending JSON-encoded `blueprint:pencil-navigation` events to the `WKWebView`. The web sheet remains the **single source of truth** for zoom and scroll; its existing `showInline` geometry updates position the ink overlay. Independently zooming the native PKCanvasView would misalign handwriting and graph paper.

## Xcode integration — after safeguarding the current native Swift plugin

1. Back up/commit the local iOS wrapper (in particular `ios/App/BlueprintPencilPlugin.swift`), and preserve existing installed data. The original Swift plugin exists only on the owner's Mac and is **not** part of the GitHub web repository, so exact local variables cannot be verified remotely.
2. Safely stage the updated web assets with the existing `scripts/stage-ios-web.py` workflow, after checking local Git status and edits. Run `npx cap copy ios` in the existing Capacitor wrapper, and open its `ios/App/App.xcodeproj`.
3. Add `native-pencilkit/BlueprintPencilNavigation.swift` to the **App target** in Xcode.
4. In the existing plugin's **showInline** code, after its persistent `PKCanvasView` and project/page IDs are available, add the call below, replacing only the local variable names with verified equivalents:

```swift
BlueprintPencilNavigation.install(
    on: canvasView,
    webView: self.webView,
    projectId: projectId,
    pageId: pageId
)
```

Call on each `showInline` update. The helper deduplicates recognizers for the same canvas. Do not create another native drawing canvas or change drawing storage.

5. Check that the plugin does not also maintain an independent native zoomScale/scroll offset while embedded; the web page owns these.
6. Compile and install through Xcode, then physically test a disposable Notes page: finger pan, pinch zoom, Pencil-only strokes, tool picker, Focus, page switches, orientation, zoom button controls, and drawing persistence after relaunch.

## Verified versus not verified

JavaScript gesture math and browser behavior can be covered by the repository tests. The Swift helper cannot be compiled or integrated without the owner's actual local native file and Xcode. A GitHub merge does **not** deploy this native feature. Existing PencilKit drawings remain separately stored and are **not** incorporated into complete Blueprint backups or sync; that limitation is unchanged.
