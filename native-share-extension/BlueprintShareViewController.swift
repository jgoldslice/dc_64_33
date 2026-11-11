import UIKit
import UniformTypeIdentifiers

/// Separate iOS Share Extension target: not included in the regular web app.
/// Receives links, photos and PDFs; explicitly chooses a project, then stages
/// a verified App Group envelope. Blueprint's web host imports it on next open.
@objc(BlueprintShareViewController)
final class BlueprintShareViewController: UIViewController {
    private var inbox: BlueprintShareInbox?
    private var chosenProject: BlueprintShareProject?
    private var selectedProjects: [BlueprintShareProject] = []
    private var busy = false

    private let heading: UILabel = {
        let label = UILabel()
        label.text = "Save to Blueprint"
        label.font = .preferredFont(forTextStyle: .title2)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = .label
        return label
    }()
    private let explanation: UILabel = {
        let label = UILabel()
        label.text = "Choose a project. The resource is safely queued and will appear in its Library the next time Blueprint opens."
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = .secondaryLabel
        label.numberOfLines = 0
        return label
    }()
    private let picker: UIButton = {
        let button = UIButton(type: .system)
        button.contentHorizontalAlignment = .leading
        button.titleLabel?.font = .preferredFont(forTextStyle: .body)
        button.showsMenuAsPrimaryAction = true
        button.layer.cornerRadius = 11
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.separator.cgColor
        button.contentEdgeInsets = UIEdgeInsets(top: 13, left: 14, bottom: 13, right: 14)
        button.accessibilityLabel = "Destination project"
        return button
    }()
    private let statusLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .footnote)
        label.textColor = .secondaryLabel
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.accessibilityTraits = [.staticText, .updatesFrequently]
        return label
    }()
    private let saveButton: UIButton = {
        let b = UIButton(type: .system)
        b.setTitle("Save to Blueprint", for: .normal)
        b.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        b.layer.cornerRadius = 12
        b.backgroundColor = .systemYellow
        b.setTitleColor(.black, for: .normal)
        b.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        return b
    }()
    private let cancelButton: UIButton = {
        let b = UIButton(type: .system)
        b.setTitle("Cancel", for: .normal)
        b.titleLabel?.font = .preferredFont(forTextStyle: .body)
        b.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        return b
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        do {
            inbox = try BlueprintShareInbox()
            let index = inbox?.projectIndex()
            selectedProjects = index?.projects ?? []
            chosenProject = selectedProjects.first(where: { $0.id == index?.lastProjectID })
                ?? selectedProjects.first
        } catch {
            statusLabel.text = error.localizedDescription
        }
        configureView()
        refreshProjectMenu()
        saveButton.isEnabled = chosenProject != nil
        if chosenProject == nil && statusLabel.text == nil {
            statusLabel.text = BlueprintShareFailure.noProjects.localizedDescription
        }
        saveButton.addTarget(self, action: #selector(saveSharedItems), for: .touchUpInside)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
    }

    private func configureView() {
        let stack = UIStackView(arrangedSubviews: [heading, explanation, picker, statusLabel])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        let actions = UIStackView(arrangedSubviews: [cancelButton, saveButton])
        actions.axis = .horizontal
        actions.spacing = 10
        actions.distribution = .fillProportionally
        actions.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(actions)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 22),
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            picker.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            actions.leadingAnchor.constraint(equalTo: stack.leadingAnchor),
            actions.trailingAnchor.constraint(equalTo: stack.trailingAnchor),
            actions.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -18),
            actions.topAnchor.constraint(greaterThanOrEqualTo: stack.bottomAnchor, constant: 20)
        ])
    }

    private func refreshProjectMenu() {
        picker.setTitle(chosenProject?.title ?? "No projects available", for: .normal)
        picker.menu = UIMenu(title: "Save to project", children: selectedProjects.map { project in
            UIAction(title: project.title,
                     state: chosenProject?.id == project.id ? .on : .off) { [weak self] _ in
                self?.chosenProject = project
                self?.refreshProjectMenu()
            }
        })
    }

    @objc private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: "BlueprintShare",
            code: NSUserCancelledError, userInfo: [NSLocalizedDescriptionKey: "Cancelled"]))
    }

    @objc private func saveSharedItems() {
        guard !busy, let project = chosenProject, let store = inbox else { return }
        busy = true
        saveButton.isEnabled = false
        picker.isEnabled = false
        statusLabel.text = "Preparing your shared items…"

        Task { @MainActor in
            var copiedFiles: [URL] = []
            defer {
                for url in copiedFiles { try? FileManager.default.removeItem(at: url) }
                self.busy = false
                self.saveButton.isEnabled = self.chosenProject != nil
                self.picker.isEnabled = true
            }
            do {
                let attachments = (extensionContext?.inputItems ?? [])
                    .compactMap { $0 as? NSExtensionItem }
                    .flatMap { $0.attachments ?? [] }
                guard !attachments.isEmpty, attachments.count <= BlueprintShareInbox.maxFiles else {
                    throw BlueprintShareFailure.invalidInput
                }
                var inputs: [BlueprintShareInput] = []
                for provider in attachments {
                    let input = try await loadInput(provider)
                    if let file = input.localFile { copiedFiles.append(file) }
                    inputs.append(input)
                }
                _ = try store.enqueue(projectID: project.id, input: inputs)
                statusLabel.text = "Queued safely. Open Blueprint to complete the Library import."
                extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            } catch {
                statusLabel.text = error.localizedDescription
                // Keep the extension open; do not claim to have saved anything.
            }
        }
    }

    private func loadInput(_ provider: NSItemProvider) async throws -> BlueprintShareInput {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            let url: URL = try await withCheckedThrowingContinuation { continuation in
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { object, error in
                    if let error { continuation.resume(throwing: error); return }
                    if let value = object as? URL { continuation.resume(returning: value) }
                    else if let value = object as? String, let url = URL(string: value) {
                        continuation.resume(returning: url)
                    } else { continuation.resume(throwing: BlueprintShareFailure.invalidInput) }
                }
            }
            guard ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
                throw BlueprintShareFailure.invalidInput
            }
            return BlueprintShareInput(link: url, title: provider.suggestedName ?? url.host ?? "Link")
        }

        // Select the provider's actual representation, rather than asking for
        // generic image data and incorrectly naming a HEIC photograph a JPEG.
        if let type = provider.registeredTypeIdentifiers.compactMap({ UTType($0) }).first(where: {
            $0.conforms(to: .image) || $0.conforms(to: .pdf)
        }) {
            guard let mime = type.preferredMIMEType,
                  ["image/png", "image/jpeg", "image/heic", "image/heif",
                   "image/gif", "image/webp", "application/pdf"].contains(mime.lowercased()) else {
                throw BlueprintShareFailure.invalidInput
            }
            // Apple's loadFileRepresentation URL is deleted after the callback.
            // Copy it within the callback, before returning to the async task.
            let local: URL = try await withCheckedThrowingContinuation { continuation in
                provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { source, error in
                    if let error { continuation.resume(throwing: error); return }
                    guard let source else {
                        continuation.resume(throwing: BlueprintShareFailure.missing); return
                    }
                    let dest = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString)
                        .appendingPathExtension(type.preferredFilenameExtension ?? "bin")
                    do {
                        try FileManager.default.copyItem(at: source, to: dest)
                        continuation.resume(returning: dest)
                    } catch { continuation.resume(throwing: error) }
                }
            }
            let fallback = "Shared." + (type.preferredFilenameExtension ?? "file")
            return BlueprintShareInput(file: local, name: provider.suggestedName ?? fallback, mime: mime)
        }

        // Some apps provide a plain-text URL instead of the standard URL type.
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            let text: String = try await withCheckedThrowingContinuation { continuation in
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, error in
                    if let error { continuation.resume(throwing: error); return }
                    guard let text = item as? String else {
                        continuation.resume(throwing: BlueprintShareFailure.invalidInput); return
                    }
                    continuation.resume(returning: text)
                }
            }
            guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
                  ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
                throw BlueprintShareFailure.invalidInput
            }
            return BlueprintShareInput(link: url, title: provider.suggestedName ?? url.host ?? "Link")
        }

        throw BlueprintShareFailure.invalidInput
    }
}
