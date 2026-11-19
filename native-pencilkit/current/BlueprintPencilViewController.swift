import UIKit
import PencilKit

final class BlueprintPencilViewController: UIViewController, PKCanvasViewDelegate {
    private let canvasView = PKCanvasView()
    private let toolPicker = PKToolPicker()
    private let startingDrawing: PKDrawing
    private let pageId: String
    private let saveDrawing: (PKDrawing) throws -> Void
    private let onClose: () -> Void
    private var saveWork: DispatchWorkItem?
    private var observers: [NSObjectProtocol] = []

    init(drawing: PKDrawing, pageId: String,
         save: @escaping (PKDrawing) throws -> Void,
         onClose: @escaping () -> Void) {
        self.startingDrawing = drawing
        self.pageId = pageId
        self.saveDrawing = save
        self.onClose = onClose
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(drawing:pageId:save:onClose:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Native Notes"
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Done", style: .done, target: self, action: #selector(closeCanvas))
        canvasView.translatesAutoresizingMaskIntoConstraints = false
        canvasView.backgroundColor = .white
        canvasView.isOpaque = true
        canvasView.drawingPolicy = .pencilOnly
        canvasView.tool = PKInkingTool(.pen, color: .black, width: 3)
        canvasView.minimumZoomScale = 0.5
        canvasView.maximumZoomScale = 5
        canvasView.contentSize = CGSize(width: 1400, height: 2000)
        canvasView.drawing = startingDrawing
        canvasView.delegate = self
        view.addSubview(canvasView)
        NSLayoutConstraint.activate([
            canvasView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            canvasView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            canvasView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            canvasView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        observers.append(NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.flushSave(showFailure: true)
            })
        observers.append(NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.flushSave(showFailure: true)
            })
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        print("BLUEPRINT PENCIL: drawing canvas appeared")
        toolPicker.addObserver(canvasView)
        toolPicker.setVisible(true, forFirstResponder: canvasView)
        canvasView.becomeFirstResponder()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        toolPicker.setVisible(false, forFirstResponder: canvasView)
        toolPicker.removeObserver(canvasView)
    }

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        saveWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.flushSave(showFailure: true) }
        saveWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    @discardableResult private func flushSave(showFailure: Bool) -> Bool {
        saveWork?.cancel()
        saveWork = nil
        do {
            try saveDrawing(canvasView.drawing)
            return true
        } catch {
            if showFailure && presentedViewController == nil {
                let alert = UIAlertController(title: "Drawing not saved",
                    message: "Your drawing is still open. Storage failed: \(error.localizedDescription)",
                    preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default))
                present(alert, animated: true)
            }
            return false
        }
    }

    @objc private func closeCanvas() {
        guard flushSave(showFailure: true) else { return }
        dismiss(animated: true, completion: onClose)
    }

    deinit {
        saveWork?.cancel()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }
}
