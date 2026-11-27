import UIKit
import WebKit
import PencilKit
import ObjectiveC

/// Bridges *finger* navigation on the embedded transparent PencilKit view to
/// Blueprint's existing browser notebook transform. Apple Pencil stays native.
/// This helper does not inspect, convert, load, or save PKDrawing data.
///
/// Add this Swift file to the SAME Xcode app target as BlueprintPencilPlugin.swift.
/// In the plugin's showInline method, after obtaining the persistent PKCanvasView:
///
/// BlueprintPencilNavigation.install(
///     on: canvasView, webView: self.webView,
///     projectId: projectId, pageId: pageId
/// )
///
/// Replace canvasView/projectId/pageId with that plugin's actual local names.
/// Call on each showInline update, not only at initial construction, so stale
/// gestures from a prior project/page cannot navigate the newly opened page.
final class BlueprintPencilNavigation: NSObject, UIGestureRecognizerDelegate {
    private static var associationKey: UInt8 = 0

    private weak var canvas: PKCanvasView?
    private weak var webView: WKWebView?
    private var projectId: String
    private var pageId: String
    private var pinch: UIPinchGestureRecognizer!
    private var pan: UIPanGestureRecognizer!
    private var pinching = false
    private var panning = false
    private var session = false
    private var scale: CGFloat = 1

    static func install(on canvas: PKCanvasView,
                        webView: WKWebView?,
                        projectId: String,
                        pageId: String) {
        guard let webView = webView else { return }
        if let prior = objc_getAssociatedObject(
            canvas, &associationKey
        ) as? BlueprintPencilNavigation {
            prior.webView = webView
            prior.projectId = projectId
            prior.pageId = pageId
            return
        }
        let bridge = BlueprintPencilNavigation(
            canvas: canvas, webView: webView,
            projectId: projectId, pageId: pageId
        )
        objc_setAssociatedObject(
            canvas, &associationKey, bridge,
            .OBJC_ASSOCIATION_RETAIN_NONATOMIC
        )
    }

    private init(canvas: PKCanvasView, webView: WKWebView,
                 projectId: String, pageId: String) {
        self.canvas = canvas
        self.webView = webView
        self.projectId = projectId
        self.pageId = pageId
        super.init()

        // Pencil draws; fingers navigate. Inherited PKCanvasView UIScrollView
        // scrolling must not independently move the ink away from the HTML
        // graph paper. The web notebook owns the zoom and scroll offset.
        canvas.drawingPolicy = .pencilOnly
        canvas.isScrollEnabled = false
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 1

        let directTouch = NSNumber(value: UITouch.TouchType.direct.rawValue)
        let pinch = UIPinchGestureRecognizer(
            target: self, action: #selector(onPinch(_:))
        )
        pinch.allowedTouchTypes = [directTouch]
        pinch.cancelsTouchesInView = false
        pinch.delegate = self
        canvas.addGestureRecognizer(pinch)
        self.pinch = pinch

        let pan = UIPanGestureRecognizer(
            target: self, action: #selector(onPan(_:))
        )
        pan.minimumNumberOfTouches = 1
        pan.maximumNumberOfTouches = 2
        pan.allowedTouchTypes = [directTouch]
        pan.cancelsTouchesInView = false
        pan.delegate = self
        canvas.addGestureRecognizer(pan)
        self.pan = pan
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        // PencilKit also installs its own recognizers on the canvas. Let our
        // direct-touch navigation coexist with them, otherwise an internal
        // recognizer can win and prevent any finger pan/pinch from starting.
        // Our allowedTouchTypes excludes Pencil, so strokes stay native.
        let ours = gestureRecognizer === pinch || gestureRecognizer === pan
        let otherOurs = otherGestureRecognizer === pinch || otherGestureRecognizer === pan
        return ours || otherOurs
    }

    @objc private func onPinch(_ recognizer: UIPinchGestureRecognizer) {
        switch recognizer.state {
        case .began:
            pinching = true
            scale = 1
            // A second finger can join an existing one-finger pan. Restart
            // the web gesture anchor at the current notebook scale.
            send("start", at: recognizer.location(in: webView))
            session = true
        case .changed:
            pinching = true
            scale = max(0.01, recognizer.scale)
            send("change", at: recognizer.location(in: webView))
        case .ended, .cancelled, .failed:
            pinching = false
            // A continuing pan now reports the remaining finger instead of
            // the two-finger midpoint. Start a fresh web anchor at that point.
            if panning, session {
                scale = 1
                send("start", at: pan.location(in: webView))
            }
            endIfNecessary(at: recognizer.location(in: webView))
        default:
            break
        }
    }

    @objc private func onPan(_ recognizer: UIPanGestureRecognizer) {
        switch recognizer.state {
        case .began:
            panning = true
            if !session {
                scale = 1
                send("start", at: recognizer.location(in: webView))
                session = true
            }
        case .changed:
            panning = true
            // Pinch already forwards the moving midpoint. Sending pan updates
            // too can interleave inconsistent positions and duplicate motion.
            if !pinching { send("change", at: recognizer.location(in: webView)) }
        case .ended, .cancelled, .failed:
            panning = false
            endIfNecessary(at: recognizer.location(in: webView))
        default:
            break
        }
    }

    private func endIfNecessary(at point: CGPoint) {
        guard session, !pinching, !panning else { return }
        send("end", at: point)
        session = false
        scale = 1
    }

    private func send(_ phase: String, at point: CGPoint) {
        guard let webView = webView, session || phase == "start" else { return }
        // WKWebView coordinates are in UIKit points, corresponding to CSS
        // viewport pixels with Blueprint's device-width viewport meta tag.
        let payload: [String: Any] = [
            "phase": phase,
            "x": Double(point.x),
            "y": Double(point.y),
            "scale": Double(scale),
            "projectId": projectId,
            "pageId": pageId
        ]
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        // Proper JSON encoding is essential: project/page IDs must never be
        // interpolated into executable JavaScript unescaped.
        let script = """
        window.dispatchEvent(new CustomEvent('blueprint:pencil-navigation',
          {detail: \(json)}));
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}
