import Foundation
import CryptoKit

// Source-only draft for the actual Capacitor iOS host and Share Extension.
// Both targets MUST use the SAME BlueprintAppGroupID Info.plist string and
// App Group entitlement. This file is deliberately absent from the web build.
enum BlueprintShareFailure: LocalizedError {
    case configuration, invalidInput, tooLarge, missing, corrupted, noProjects

    var errorDescription: String? {
        switch self {
        case .configuration: return "Configure the same BlueprintAppGroupID and App Group entitlement in both targets."
        case .invalidInput: return "Invalid or unsupported shared item."
        case .tooLarge: return "The share exceeds Blueprint's 20 MB per-file or 8-item limit."
        case .missing: return "The selected shared item is no longer available."
        case .corrupted: return "The shared file failed integrity validation."
        case .noProjects: return "Open the installed Blueprint app once to make your projects available."
        }
    }
}

struct BlueprintShareProject: Codable {
    let id: String
    let title: String
}

struct BlueprintShareProjectIndex: Codable {
    let version: Int
    let projects: [BlueprintShareProject]
    let lastProjectID: String?
}

struct BlueprintSharePendingItem: Codable {
    let id: String
    let kind: String                 // "link" | "file"
    let title: String
    let name: String?
    let mime: String?
    let url: String?
    let size: Int?
    let sha256: String?
}

struct BlueprintShareEnvelope: Codable {
    let version: Int
    let id: String
    let projectId: String
    let createdAt: String
    let items: [BlueprintSharePendingItem]
}

// The extension calls NSItemProvider while it is active, copies any temporary
// file *inside its completion handler*, then passes that stable file URL here.
struct BlueprintShareInput {
    let title: String
    let url: URL?
    let localFile: URL?
    let filename: String?
    let mime: String?

    init(link: URL, title: String) {
        self.title = title
        self.url = link
        self.localFile = nil
        self.filename = nil
        self.mime = nil
    }

    init(file: URL, name: String, mime: String) {
        self.title = name
        self.url = nil
        self.localFile = file
        self.filename = name
        self.mime = mime
    }
}

final class BlueprintShareInbox {
    static let maxFiles = 8
    static let maxBytes = 20 * 1024 * 1024
    private let fm = FileManager.default
    private let root: URL

    init(bundle: Bundle = .main) throws {
        guard let group = bundle.object(forInfoDictionaryKey: "BlueprintAppGroupID") as? String,
              group.hasPrefix("group."), !group.contains("<"),
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            throw BlueprintShareFailure.configuration
        }
        root = container.appendingPathComponent("BlueprintShareInbox", isDirectory: true)
        try fm.createDirectory(at: pendingDir, withIntermediateDirectories: true)
    }

    // XCTest-only injectable storage root. The shipping initializer above
    // continues to require a valid signed App Group entitlement.
    init(testDirectory: URL) throws {
        root = testDirectory.appendingPathComponent("BlueprintShareInbox", isDirectory: true)
        try fm.createDirectory(at: pendingDir, withIntermediateDirectories: true)
    }

    private var pendingDir: URL { root.appendingPathComponent("pending", isDirectory: true) }
    private var stagingDir: URL { root.appendingPathComponent("staging", isDirectory: true) }
    private var projectIndexURL: URL { root.appendingPathComponent("projects.json") }
    private var encoder: JSONEncoder { JSONEncoder() }
    private var decoder: JSONDecoder { JSONDecoder() }

    private func validID(_ s: String) -> Bool {
        guard !s.isEmpty, s.utf8.count <= 200 else { return false }
        return !s.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
    }

    private func validUUID(_ s: String) -> Bool {
        guard let parsed = UUID(uuidString: s) else { return false }
        return parsed.uuidString.lowercased() == s.lowercased()
    }

    private func hexSHA256(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    private func legalMIME(_ mime: String) -> Bool {
        ["image/png", "image/jpeg", "image/heic", "image/heif",
         "image/gif", "image/webp", "application/pdf"].contains(mime.lowercased())
    }

    func projectIndex() -> BlueprintShareProjectIndex {
        guard let data = try? Data(contentsOf: projectIndexURL),
              let result = try? decoder.decode(BlueprintShareProjectIndex.self, from: data),
              result.version == 1 else {
            return BlueprintShareProjectIndex(version: 1, projects: [], lastProjectID: nil)
        }
        return result
    }

    func publishProjects(_ projects: [BlueprintShareProject]) throws {
        guard projects.count <= 500,
              projects.allSatisfy({ validID($0.id) && !$0.title.isEmpty && $0.title.count <= 120 }),
              Set(projects.map(\.id)).count == projects.count else {
            throw BlueprintShareFailure.invalidInput
        }
        let old = projectIndex()
        let selected = projects.contains(where: { $0.id == old.lastProjectID }) ? old.lastProjectID : nil
        let index = BlueprintShareProjectIndex(version: 1, projects: projects, lastProjectID: selected)
        try encoder.encode(index).write(to: projectIndexURL, options: .atomic)
    }

    func setLastProjectID(_ id: String) throws {
        let old = projectIndex()
        guard old.projects.contains(where: { $0.id == id }) else { throw BlueprintShareFailure.invalidInput }
        try encoder.encode(BlueprintShareProjectIndex(version: 1,
            projects: old.projects, lastProjectID: id)).write(to: projectIndexURL, options: .atomic)
    }

    @discardableResult
    func enqueue(projectID: String, input: [BlueprintShareInput]) throws -> String {
        guard validID(projectID), !input.isEmpty, input.count <= Self.maxFiles,
              projectIndex().projects.contains(where: { $0.id == projectID }) else {
            throw BlueprintShareFailure.invalidInput
        }
        let id = UUID().uuidString.lowercased()
        try fm.createDirectory(at: stagingDir, withIntermediateDirectories: true)
        let draft = stagingDir.appendingPathComponent(id, isDirectory: true)
        try fm.createDirectory(at: draft, withIntermediateDirectories: false)
        var committed = false
        defer { if !committed { try? fm.removeItem(at: draft) } }
        var items: [BlueprintSharePendingItem] = []
        for (index, value) in input.enumerated() {
            let itemID = "i" + String(index)
            if let url = value.url {
                guard ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
                    throw BlueprintShareFailure.invalidInput
                }
                items.append(BlueprintSharePendingItem(id: itemID, kind: "link",
                    title: String(value.title.prefix(180)), name: nil, mime: nil,
                    url: url.absoluteString, size: nil, sha256: nil))
            } else if let source = value.localFile, let mime = value.mime,
                      legalMIME(mime) {
                let attrs = try fm.attributesOfItem(atPath: source.path)
                guard let size = attrs[.size] as? NSNumber,
                      size.int64Value > 0 && size.int64Value <= Self.maxBytes else {
                    throw BlueprintShareFailure.tooLarge
                }
                let bytes = try Data(contentsOf: source)
                guard !bytes.isEmpty && bytes.count <= Self.maxBytes else {
                    throw BlueprintShareFailure.tooLarge
                }
                let filename = String((value.filename ?? "Shared file").prefix(180))
                // Use a generated name, not a potentially dangerous provider path.
                let output = draft.appendingPathComponent(itemID, isDirectory: false)
                try bytes.write(to: output, options: .atomic)
                items.append(BlueprintSharePendingItem(id: itemID, kind: "file",
                    title: filename, name: filename, mime: mime.lowercased(),
                    url: nil, size: bytes.count, sha256: hexSHA256(bytes)))
            } else {
                throw BlueprintShareFailure.invalidInput
            }
        }
        let envelope = BlueprintShareEnvelope(version: 1, id: id,
            projectId: projectID, createdAt: ISO8601DateFormatter().string(from: Date()),
            items: items)
        try encoder.encode(envelope).write(to: draft.appendingPathComponent("manifest.json"), options: .atomic)
        // Staged files + manifest become visible as one directory rename.
        try fm.moveItem(at: draft, to: pendingDir.appendingPathComponent(id, isDirectory: true))
        committed = true
        try? setLastProjectID(projectID)
        return id
    }

    private func envelope(_ id: String) throws -> BlueprintShareEnvelope {
        guard validUUID(id) else { throw BlueprintShareFailure.invalidInput }
        let base = pendingDir.appendingPathComponent(id, isDirectory: true)
        guard let data = try? Data(contentsOf: base.appendingPathComponent("manifest.json")),
              let envelope = try? decoder.decode(BlueprintShareEnvelope.self, from: data),
              envelope.id == id, envelope.version == 1, envelope.items.count <= Self.maxFiles
        else { throw BlueprintShareFailure.missing }
        return envelope
    }

    // Do not let one damaged manifest block all unrelated queued shares.
    // Report it to the host as an error, but NEVER delete the damaged folder.
    func pendingReport() throws -> (entries: [BlueprintShareEnvelope], errors: [String]) {
        let dirs = try fm.contentsOfDirectory(at: pendingDir,
            includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
        var entries: [BlueprintShareEnvelope] = []
        var errors: [String] = []
        for dir in dirs where validUUID(dir.lastPathComponent) {
            do { entries.append(try envelope(dir.lastPathComponent)) }
            catch { errors.append(dir.lastPathComponent) }
        }
        return (entries.sorted { $0.createdAt < $1.createdAt }, errors)
    }

    func pending() throws -> [BlueprintShareEnvelope] {
        try pendingReport().entries
    }

    func readFile(id: String, itemID: String) throws -> (Data, BlueprintSharePendingItem) {
        let entry = try envelope(id)
        guard let item = entry.items.first(where: { $0.id == itemID && $0.kind == "file" }),
              itemID.range(of: #"^i[0-7]$"#, options: .regularExpression) != nil else {
            throw BlueprintShareFailure.invalidInput
        }
        let url = pendingDir.appendingPathComponent(id, isDirectory: true)
            .appendingPathComponent(itemID, isDirectory: false)
        guard let bytes = try? Data(contentsOf: url), bytes.count == item.size,
              bytes.count <= Self.maxBytes, hexSHA256(bytes) == item.sha256 else {
            throw BlueprintShareFailure.corrupted
        }
        return (bytes, item)
    }

    // Limit each bridge reply to 256 KiB to avoid oversized WKWebView
    // JSON/Base64 messages. The JavaScript importer hashes the reassembled
    // bytes against the immutable manifest before saving or acknowledging.
    func readChunk(id: String, itemID: String, offset: Int, length: Int)
        throws -> (Data, BlueprintSharePendingItem) {
        let entry = try envelope(id)
        guard let item = entry.items.first(where: { $0.id == itemID && $0.kind == "file" }),
              itemID.range(of: #"^i[0-7]$"#, options: .regularExpression) != nil,
              let expected = item.size, expected > 0, expected <= Self.maxBytes,
              length > 0, length <= 256 * 1024, length <= expected,
              offset >= 0, offset <= expected - length else {
            throw BlueprintShareFailure.invalidInput
        }
        let url = pendingDir.appendingPathComponent(id, isDirectory: true)
            .appendingPathComponent(itemID, isDirectory: false)
        let attributes = try fm.attributesOfItem(atPath: url.path)
        guard let size = attributes[.size] as? NSNumber,
              size.intValue == expected else {
            throw BlueprintShareFailure.corrupted
        }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        try handle.seek(toOffset: UInt64(offset))
        guard let bytes = try handle.read(upToCount: length),
              bytes.count == length else {
            throw BlueprintShareFailure.corrupted
        }
        return (bytes, item)
    }

    func acknowledge(id: String) throws {
        _ = try envelope(id)
        try fm.removeItem(at: pendingDir.appendingPathComponent(id, isDirectory: true))
    }
}
