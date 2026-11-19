import Foundation
import CryptoKit
import PencilKit

// The native PencilKit drawings are sidecars. Existing SVG Notes are never rewritten.
enum BlueprintPencilStore {
    static func url(projectId: String, pageId: String) throws -> URL {
        let base = try FileManager.default.url(for: .applicationSupportDirectory,
                                               in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        func key(_ value: String) -> String {
            SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
        }
        let folder = base.appendingPathComponent("BlueprintPencil/v1/" + key(projectId), isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent(key(pageId) + ".pkdrawing", isDirectory: false)
    }

    private static func presenceKey(_ url: URL) -> String {
        "BlueprintPencil.saved." + url.deletingLastPathComponent().lastPathComponent + "." + url.lastPathComponent
    }

    static func remember(_ url: URL) {
        UserDefaults.standard.set(true, forKey: presenceKey(url))
    }

    static func bytes(at file: URL) throws -> Data? {
        do {
            let data = try Data(contentsOf: file)
            if !UserDefaults.standard.bool(forKey: presenceKey(file)) { remember(file) }
            return data
        } catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
            if UserDefaults.standard.bool(forKey: presenceKey(file)) {
                throw NSError(domain: "BlueprintPencil", code: 1, userInfo: [
                    NSLocalizedDescriptionKey: "A previously saved drawing is missing. Recover it from a complete backup."
                ])
            }
            return nil
        }
    }

    static func load(projectId: String, pageId: String) throws -> PKDrawing {
        let file = try url(projectId: projectId, pageId: pageId)
        guard let data = try bytes(at: file) else { return PKDrawing() }
        return try PKDrawing(data: data)
    }

    static func stage(_ bytes: Data, at file: URL) throws {
        _ = try PKDrawing(data: bytes)
        try bytes.write(to: file, options: .withoutOverwriting)
        guard try Data(contentsOf: file) == bytes else {
            throw NSError(domain: "BlueprintPencil", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Drawing file failed read-back verification."
            ])
        }
        remember(file)
    }

    static func save(_ drawing: PKDrawing, projectId: String, pageId: String) throws {
        let file = try url(projectId: projectId, pageId: pageId)
        try drawing.dataRepresentation().write(to: file, options: .atomic)
        remember(file)
    }
}
