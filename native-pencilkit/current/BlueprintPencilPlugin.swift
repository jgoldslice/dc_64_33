import Foundation
import UIKit
import Capacitor
import PencilKit
import WebKit

@objc(BlueprintPencilPlugin)
public class BlueprintPencilPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BlueprintPencilPlugin"
    public let jsName = "BlueprintPencil"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportDrawing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stageDrawing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openEditor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showInline", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideInline", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    private var inlineSession: BlueprintPencilInlineSession?

    @objc public func capabilities(_ call: CAPPluginCall) {
        call.resolve(["available": true, "schemaVersion": 1, "embeddedAvailable": true, "drawingArchiveVersion": 1, "imageExportVersion": 1])
    }

    @objc public func exportDrawing(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                guard let project = call.getString("projectId"), let page = call.getString("pageId"),
                      !project.isEmpty, !page.isEmpty else { call.reject("Missing drawing identity"); return }
                if let session = self.inlineSession, session.projectId == project, session.pageId == page {
                    try session.saveNow()
                }
                let url = try BlueprintPencilStore.url(projectId: project, pageId: page)
                guard let bytes = try BlueprintPencilStore.bytes(at: url) else {
                    call.resolve(["missing": true]); return
                }
                _ = try PKDrawing(data: bytes)
                call.resolve(["base64": bytes.base64EncodedString()])
            } catch { call.reject("Drawing export failed: " + error.localizedDescription) }
        }
    }

    // Render the actual PencilKit strokes as a transparent PNG in logical
    // notebook coordinates. Flush pending strokes first; do not replace or
    // migrate the underlying editable PKDrawing bytes.
    @objc public func exportImage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                guard let project = call.getString("projectId"),
                      let page = call.getString("pageId"),
                      !project.isEmpty, !page.isEmpty,
                      project.count <= 256, page.count <= 256,
                      let width = call.options["width"] as? NSNumber,
                      let height = call.options["height"] as? NSNumber else {
                    call.reject("Missing page image dimensions or identity")
                    return
                }
                let w = width.doubleValue, h = height.doubleValue
                guard w.isFinite, h.isFinite, w > 0, h > 0,
                      w <= 20000, h <= 20000 else {
                    call.reject("Invalid page image dimensions")
                    return
                }
                let drawing: PKDrawing
                if let session = self.inlineSession,
                   session.projectId == project, session.pageId == page {
                    try session.saveNow()
                }
                drawing = try BlueprintPencilStore.load(projectId: project, pageId: page)
                if drawing.strokes.isEmpty {
                    call.resolve(["missing": true])
                    return
                }
                let scale = min(2.0, sqrt(12_000_000 / (w * h)))
                let image = drawing.image(
                    from: CGRect(x: 0, y: 0, width: w, height: h),
                    scale: CGFloat(scale))
                guard let png = image.pngData(), !png.isEmpty else {
                    call.reject("PencilKit image encoding failed")
                    return
                }
                call.resolve(["base64": png.base64EncodedString(), "mime": "image/png"])
            } catch {
                call.reject("PencilKit image export failed: " + error.localizedDescription)
            }
        }
    }

    // Allocate a fresh page identity. An interrupted restore can leave an
    // unreferenced copy, but cannot replace an existing notebook drawing.
    @objc public func stageDrawing(_ call: CAPPluginCall) {
        do {
            guard let project = call.getString("projectId"), !project.isEmpty,
                  let encoded = call.getString("base64"), let bytes = Data(base64Encoded: encoded)
            else { call.reject("Invalid drawing archive"); return }
            let page = UUID().uuidString
            let url = try BlueprintPencilStore.url(projectId: project, pageId: page)
            try BlueprintPencilStore.stage(bytes, at: url)
            call.resolve(["pageId": page])
        } catch { call.reject("Drawing restore failed: " + error.localizedDescription) }
    }

    // This adds a transparent native drawing surface to the existing Notes
    // viewport, using the same Application Support sidecar as openEditor.
    // Existing SVG, text, images and backups are left byte-for-byte intact.
    @objc public func showInline(_ call: CAPPluginCall) {
        guard let projectId = call.getString("projectId"), !projectId.isEmpty,
              let pageId = call.getString("pageId"), !pageId.isEmpty,
              projectId.count <= 256, pageId.count <= 256,
              let surface = BlueprintInlineRect(call.getObject("surface")),
              let clip = BlueprintInlineRect(call.getObject("clip")),
              let logicalWidth = (call.options["logicalWidth"] as? NSNumber)?.doubleValue,
              let logicalHeight = (call.options["logicalHeight"] as? NSNumber)?.doubleValue,
              logicalWidth > 0, logicalHeight > 0,
              logicalWidth <= 20000, logicalHeight <= 20000 else {
            call.reject("Invalid PencilKit page or viewport geometry")
            return
        }
        let editing = call.getBool("editing") ?? false
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? CAPBridgeViewController,
                  let webView = controller.webView else {
                call.reject("Blueprint web canvas not available")
                return
            }
            do {
                if let existing = self.inlineSession,
                   (existing.projectId != projectId || existing.pageId != pageId) {
                    try existing.close()
                    self.inlineSession = nil
                }
                if self.inlineSession == nil {
                    let drawing = try BlueprintPencilStore.load(projectId: projectId, pageId: pageId)
                    let session = BlueprintPencilInlineSession(
                        host: controller,
                        projectId: projectId, pageId: pageId,
                        drawing: drawing,
                        save: { updated in
                            try BlueprintPencilStore.save(updated, projectId: projectId, pageId: pageId)
                        }
                    )
                    self.inlineSession = session
                }
                self.inlineSession?.update(surface: surface, clip: clip,
                    logicalSize: CGSize(width: logicalWidth, height: logicalHeight),
                    from: webView)
                // Switching to text/image editing must durably flush the last
                // native Pencil stroke before disabling the canvas/tool picker.
                // On failure leave the inline session alive for recovery.
                if !editing {
                    try self.inlineSession?.saveNow()
                }
                self.inlineSession?.setEditing(editing)
                call.resolve(["visible": true, "embedded": true, "pageId": pageId])
            } catch {
                call.reject("Cannot show embedded native drawing: \(error.localizedDescription)")
            }
        }
    }

    @objc public func hideInline(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                try self.inlineSession?.close()
                self.inlineSession = nil
                call.resolve(["hidden": true])
            } catch {
                call.reject("Could not save native drawing when hiding: \(error.localizedDescription)")
            }
        }
    }

    @objc public func openEditor(_ call: CAPPluginCall) {
        guard let projectId = call.getString("projectId"), !projectId.isEmpty,
              let pageId = call.getString("pageId"), !pageId.isEmpty,
              projectId.count <= 256, pageId.count <= 256 else {
            call.reject("An existing project and note page are required")
            return
        }
        DispatchQueue.main.async {
            print("BLUEPRINT PENCIL: openEditor request received")
            guard self.inlineSession == nil else {
                call.reject("Turn off in-page PencilKit before opening the full-screen editor")
                return
            }
            do {
                let drawing = try BlueprintPencilStore.load(projectId: projectId, pageId: pageId)
                guard let presenter = self.bridge?.viewController,
                      presenter.presentedViewController == nil else {
                    call.reject("Another native screen is already open")
                    return
                }
                let editor = BlueprintPencilViewController(drawing: drawing, pageId: pageId,
                    save: { updated in
                        try BlueprintPencilStore.save(updated, projectId: projectId, pageId: pageId)
                    }, onClose: {
                        // Autosave and explicit Done save happen in the editor.
                        // The openEditor promise must NOT wait for the user to close it.
                        print("BLUEPRINT PENCIL: editor closed")
                    })
                let navigation = UINavigationController(rootViewController: editor)
                navigation.modalPresentationStyle = .fullScreen
                print("BLUEPRINT PENCIL: presenting native editor")
                presenter.present(navigation, animated: true) {
                    guard presenter.presentedViewController === navigation else {
                        call.reject("Native PencilKit presentation did not complete")
                        return
                    }
                    print("BLUEPRINT PENCIL: native editor visible")
                    call.resolve(["pageId": pageId, "opened": true])
                }
            } catch {
                call.reject("Cannot open native drawing: \(error.localizedDescription)")
            }
        }
    }

    // Retain the original standalone prototype method for diagnostic compatibility.
    @objc public func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("Another native screen is already open")
                return
            }
            let editor = BlueprintPencilViewController(drawing: PKDrawing(), pageId: "test",
                save: { _ in }, onClose: { call.resolve(["opened": true]) })
            let navigation = UINavigationController(rootViewController: editor)
            navigation.modalPresentationStyle = .fullScreen
            presenter.present(navigation, animated: true)
        }
    }
}


// UIKit clips the native drawing to the same visible region as the web Notes
// viewport. All stored PKDrawing points remain in unscaled page coordinates.
private struct BlueprintInlineRect {
    let rect: CGRect
    init?(_ value: [String: Any]?) {
        guard let value,
              let x = value["x"] as? NSNumber, let y = value["y"] as? NSNumber,
              let w = value["width"] as? NSNumber, let h = value["height"] as? NSNumber else {
            return nil
        }
        let numbers = [x.doubleValue, y.doubleValue, w.doubleValue, h.doubleValue]
        guard numbers.allSatisfy({ $0.isFinite && abs($0) <= 50000 }),
              w.doubleValue > 0, h.doubleValue > 0 else { return nil }
        rect = CGRect(x: x.doubleValue, y: y.doubleValue,
                      width: w.doubleValue, height: h.doubleValue)
    }
}

private final class BlueprintPencilInlineSession: NSObject, PKCanvasViewDelegate {
    let projectId: String
    let pageId: String
    private let overlay = UIView()
    private let canvas = PKCanvasView()
    private let picker = PKToolPicker()
    private let saveDrawing: (PKDrawing) throws -> Void
    private weak var hostController: UIViewController?
    private var lastSaved: PKDrawing
    private var pendingSave: DispatchWorkItem?
    private var observation: [NSObjectProtocol] = []
    private var observingPicker = false
    private var editing = false

    init(host: UIViewController, projectId: String, pageId: String,
         drawing: PKDrawing, save: @escaping (PKDrawing) throws -> Void) {
        self.projectId = projectId
        self.pageId = pageId
        self.saveDrawing = save
        self.lastSaved = drawing
        super.init()
        overlay.isOpaque = false
        overlay.backgroundColor = .clear
        overlay.clipsToBounds = true
        overlay.isUserInteractionEnabled = false
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.drawingPolicy = .pencilOnly
        canvas.isScrollEnabled = false
        canvas.bounces = false
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1
        canvas.tool = PKInkingTool(.pen, color: .black, width: 3)
        canvas.drawing = drawing
        canvas.delegate = self
        overlay.addSubview(canvas)
        hostController = host
        host.view.addSubview(overlay)
        observation.append(NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil, queue: .main) { [weak self] _ in
                do { try self?.saveNow() }
                catch { print("BLUEPRINT PENCIL: inline background save failed: \(error)") }
            })
        observation.append(NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil, queue: .main) { [weak self] _ in
                do { try self?.saveNow() }
                catch { print("BLUEPRINT PENCIL: inline inactive save failed: \(error)") }
            })
        print("BLUEPRINT PENCIL: inline session loaded for page \(pageId)")
    }

    func update(surface: BlueprintInlineRect, clip: BlueprintInlineRect,
                logicalSize: CGSize, from webView: WKWebView) {
        BlueprintPencilNavigation.install(on: canvas, webView: webView, projectId: projectId, pageId: pageId)
        // CSS viewport coordinates are converted from WKWebView to the host.
        let webBounds = CGRect(origin: .zero, size: webView.bounds.size)
        let visible = clip.rect.intersection(surface.rect).intersection(webBounds)
        guard !visible.isNull, !visible.isEmpty, let host = overlay.superview else {
            overlay.isHidden = true
            return
        }
        overlay.isHidden = false
        overlay.frame = webView.convert(visible, to: host)
        let scaleX = surface.rect.width / logicalSize.width
        let scaleY = surface.rect.height / logicalSize.height
        canvas.transform = .identity
        canvas.bounds = CGRect(origin: .zero, size: logicalSize)
        canvas.transform = CGAffineTransform(scaleX: scaleX, y: scaleY)
        canvas.center = CGPoint(
            x: surface.rect.minX - visible.minX + surface.rect.width / 2,
            y: surface.rect.minY - visible.minY + surface.rect.height / 2)
    }

    func setEditing(_ allowed: Bool) {
        guard editing != allowed else { return }
        editing = allowed
        overlay.isUserInteractionEnabled = allowed
        canvas.isUserInteractionEnabled = allowed
        if allowed {
            if !observingPicker {
                picker.addObserver(canvas)
                observingPicker = true
            }
            // Tool picker requires a view in the window before first response.
            DispatchQueue.main.async { [weak self] in
                guard let self, self.editing else { return }
                self.picker.setVisible(true, forFirstResponder: self.canvas)
                self.canvas.becomeFirstResponder()
            }
        } else {
            picker.setVisible(false, forFirstResponder: canvas)
            canvas.resignFirstResponder()
        }
    }

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        pendingSave?.cancel()
        let work = DispatchWorkItem { [weak self] in
            do { try self?.saveNow() }
            catch { self?.reportSaveFailure(error) }
        }
        pendingSave = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    private func reportSaveFailure(_ error: Error) {
        NSLog("Blueprint PencilKit save failed: %@", error.localizedDescription)
        guard let host = hostController, host.presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Handwriting hasn't saved",
            message: "Keep this page open and retry saving your strokes.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in
            do { try self?.saveNow() } catch { self?.reportSaveFailure(error) }
        })
        host.present(alert, animated: true)
    }

    func saveNow() throws {
        pendingSave?.cancel()
        pendingSave = nil
        // Snapshot the canvas itself on exit/export, even if a delegate
        // notification for the last stroke has not been delivered yet.
        let snapshot = canvas.drawing
        guard snapshot != lastSaved else { return }
        try saveDrawing(snapshot)
        lastSaved = snapshot
    }

    func close() throws {
        // On any storage failure, keep the session/drawing in memory for retry.
        try saveNow()
        setEditing(false)
        if observingPicker { picker.removeObserver(canvas); observingPicker = false }
        observation.forEach { NotificationCenter.default.removeObserver($0) }
        observation.removeAll()
        overlay.removeFromSuperview()
    }

    deinit {
        pendingSave?.cancel()
        observation.forEach { NotificationCenter.default.removeObserver($0) }
    }
}
