import PencilKit
import UIKit

/// Opt-in native editor presented above the Capacitor web view.
/// This controller never replaces or mutates the existing web Notes canvas.
/// PKCanvasView owns pinch zoom and native ink rendering; no outer CSS/SwiftUI zoom.
@MainActor
final class BlueprintPencilEditorViewController: UIViewController, PKCanvasViewDelegate {
    typealias Completion = (Result<BlueprintNativePageManifest, Error>) -> Void

    var onComplete: Completion?

    private let store: BlueprintNativeDrawingStore
    private let projectID: String
    private let pageIDs: [String]
    private var currentIndex: Int
    private let canvas = PKCanvasView()
    private let toolbar = UIToolbar()
    private var saveTask: DispatchWorkItem?
    private var backgroundObserver: NSObjectProtocol?
    private var ignoreDrawingChange = false
    private var hasLoadedInitialPage = false
    private var hasSetInitialZoom = false

    init(store: BlueprintNativeDrawingStore, projectID: String,
         pageIDs: [String], initialPageID: String) {
        self.store = store
        self.projectID = projectID
        self.pageIDs = pageIDs
        self.currentIndex = pageIDs.firstIndex(of: initialPageID) ?? 0
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) { return nil }

    deinit {
        saveTask?.cancel()
        if let backgroundObserver { NotificationCenter.default.removeObserver(backgroundObserver) }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        canvas.translatesAutoresizingMaskIntoConstraints = false
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        canvas.delegate = self
        canvas.backgroundColor = .white
        canvas.isOpaque = true
        canvas.contentSize = BlueprintNativeDrawingStore.pageSize
        canvas.minimumZoomScale = 0.5
        canvas.maximumZoomScale = 5
        canvas.bouncesZoom = true
        canvas.contentInsetAdjustmentBehavior = .never
        canvas.drawingPolicy = .pencilOnly
        canvas.tool = PKInkingTool(.pen, color: .black, width: 2.5)
        canvas.isRulerActive = false

        view.addSubview(canvas)
        view.addSubview(toolbar)
        NSLayoutConstraint.activate([
            canvas.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            canvas.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            canvas.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            canvas.bottomAnchor.constraint(equalTo: toolbar.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            toolbar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])

        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Close", style: .plain, target: self, action: #selector(doneTapped)
        )
        makeNavigationItems()
        makeToolbar()
        do {
            try loadPage(at: currentIndex, savingOldPage: false)
            hasLoadedInitialPage = true
        } catch {
            showError("Could not open native drawing", error)
        }

        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { [weak self] _ in
            // Saving here is a second safety boundary; foreground Save/Close
            // still reports errors. No source ink is deleted on failure.
            self?.saveIfPossible()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Fit once. Resizing/rotation must not replace PKDrawing or reset zoom.
        if !hasSetInitialZoom && canvas.bounds.width > 0 && canvas.bounds.height > 0 {
            let fit = min(1, canvas.bounds.width / BlueprintNativeDrawingStore.pageSize.width)
            canvas.setZoomScale(max(canvas.minimumZoomScale, fit), animated: false)
            hasSetInitialZoom = true
        }
    }

    private func makeNavigationItems() {
        title = "Page \(currentIndex + 1) of \(pageIDs.count)"
        let done = UIBarButtonItem(title: "Done", style: .done,
                                   target: self, action: #selector(doneTapped))
        let pages = UIBarButtonItem(title: "Pages", style: .plain, target: nil, action: nil)
        let actions = pageIDs.enumerated().map { index, _ in
            UIAction(title: "Page \(index + 1)",
                     state: index == currentIndex ? .on : .off) { [weak self] _ in
                self?.switchToPage(index)
            }
        }
        pages.menu = UIMenu(title: "Notebook pages", children: actions)
        navigationItem.rightBarButtonItems = [done, pages]
    }

    private func makeToolbar() {
        func button(_ name: String, _ action: Selector) -> UIBarButtonItem {
            UIBarButtonItem(title: name, style: .plain, target: self, action: action)
        }
        let space = UIBarButtonItem(barButtonSystemItem: .flexibleSpace,
                                    target: nil, action: nil)
        toolbar.items = [
            button("Pen", #selector(selectPen)), space,
            button("Pencil", #selector(selectPencil)), space,
            button("Erase", #selector(selectEraser)), space,
            button("Lasso", #selector(selectLasso)), space,
            button("Undo", #selector(undoTapped)), space,
            button("Redo", #selector(redoTapped)), space,
            button("Fit", #selector(fitTapped))
        ]
        toolbar.sizeToFit()
        toolbar.accessibilityLabel = "Native PencilKit tools"
    }

    private func loadPage(at index: Int, savingOldPage: Bool) throws {
        guard pageIDs.indices.contains(index) else { return }
        if savingOldPage && hasLoadedInitialPage { _ = try saveCurrentPage() }
        let pageID = pageIDs[index]
        let loaded = try store.load(projectID: projectID, pageID: pageID)
        ignoreDrawingChange = true
        canvas.drawing = loaded ?? PKDrawing()
        ignoreDrawingChange = false
        currentIndex = index
        makeNavigationItems()
    }

    private func switchToPage(_ index: Int) {
        guard index != currentIndex else { return }
        do { try loadPage(at: index, savingOldPage: true) }
        catch { showError("Could not switch pages; the current drawing remains open", error) }
    }

    private func saveCurrentPage() throws -> BlueprintNativePageManifest {
        saveTask?.cancel()
        saveTask = nil
        return try store.save(canvas.drawing, projectID: projectID,
                              pageID: pageIDs[currentIndex])
    }

    private func saveIfPossible() {
        guard hasLoadedInitialPage else { return }
        do { _ = try saveCurrentPage() }
        catch { NSLog("Blueprint native ink autosave failed: %@", String(describing: error)) }
    }

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard !ignoreDrawingChange else { return }
        // Do not serialize the drawing for every Pencil micro-update.
        saveTask?.cancel()
        let task = DispatchWorkItem { [weak self] in self?.saveIfPossible() }
        saveTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7, execute: task)
    }

    @objc private func doneTapped() {
        do {
            let manifest = try saveCurrentPage()
            let completion = onComplete
            dismiss(animated: true) { completion?(.success(manifest)) }
        } catch {
            // Keep the editor open and the ink editable until the save succeeds.
            showError("Drawing was not saved; try again", error)
        }
    }

    @objc private func selectPen() {
        canvas.tool = PKInkingTool(.pen, color: .black, width: 2.5)
    }

    @objc private func selectPencil() {
        canvas.tool = PKInkingTool(.pencil, color: .black, width: 3)
    }

    @objc private func selectEraser() {
        canvas.tool = PKEraserTool(.vector)
    }

    @objc private func selectLasso() {
        canvas.tool = PKLassoTool()
    }

    @objc private func undoTapped() { canvas.undoManager?.undo() }
    @objc private func redoTapped() { canvas.undoManager?.redo() }

    @objc private func fitTapped() {
        let fit = min(1, canvas.bounds.width / BlueprintNativeDrawingStore.pageSize.width)
        canvas.setZoomScale(max(canvas.minimumZoomScale, fit), animated: false)
    }

    private func showError(_ title: String, _ error: Error) {
        let alert = UIAlertController(title: title, message: error.localizedDescription,
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}
