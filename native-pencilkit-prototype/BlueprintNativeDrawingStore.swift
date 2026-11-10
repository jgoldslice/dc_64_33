import CryptoKit
import Foundation
import PencilKit
import UIKit

/// Experimental, independent native ink store. It never reads or modifies the
/// existing Blueprint localStorage, IndexedDB, SVG strokes or backup files.
struct BlueprintNativePageManifest: Codable {
    let schemaVersion: Int
    let projectId: String
    let pageId: String
    let width: Double
    let height: Double
    let drawingFile: String
    let previewFile: String
    let drawingSHA256: String
    let previewSHA256: String
    let savedAt: String

    var bridgeValue: [String: Any] {
        [
            "schemaVersion": schemaVersion,
            "projectId": projectId,
            "pageId": pageId,
            "pageWidth": width,
            "pageHeight": height,
            "drawingSHA256": drawingSHA256,
            "previewSHA256": previewSHA256,
            "savedAt": savedAt
        ]
    }
}

enum BlueprintNativeDrawingError: LocalizedError {
    case invalidIdentifier
    case invalidPageSize
    case unsupportedSchema
    case incorrectIdentity
    case invalidFileName
    case corruptDrawing
    case corruptPreview
    case existingDrawing
    case badImport

    var errorDescription: String? {
        switch self {
        case .invalidIdentifier: return "A project or page identifier is missing or invalid."
        case .invalidPageSize: return "Invalid native page dimensions."
        case .unsupportedSchema: return "Unsupported native drawing format."
        case .incorrectIdentity: return "Native drawing belongs to a different project or page."
        case .invalidFileName: return "Unexpected drawing resource path."
        case .corruptDrawing: return "The saved PencilKit drawing failed its checksum."
        case .corruptPreview: return "The saved PNG preview failed its checksum."
        case .existingDrawing: return "Native ink exists for this page; explicit overwrite is required."
        case .badImport: return "Invalid or corrupted native drawing import."
        }
    }
}

/// Files are versioned and checksum-validated. Commit order:
/// 1. New immutable PKDrawing bytes; 2. New immutable PNG; 3. Atomic manifest.
/// A crash before step 3 preserves the previously committed drawing. Old blobs
/// are intentionally not deleted in this prototype (future retention policy).
final class BlueprintNativeDrawingStore {
    static let schemaVersion = 1
    static let pageSize = CGSize(width: 1024, height: 1440)

    private let root: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(baseURL: URL? = nil) {
        let support = baseURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        root = support.appendingPathComponent("BlueprintNativeInk", isDirectory: true)
            .appendingPathComponent("v1", isDirectory: true)
    }

    static func checksum(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func validID(_ id: String) -> Bool {
        !id.isEmpty && id.utf8.count <= 200 &&
            id.unicodeScalars.allSatisfy { !CharacterSet.controlCharacters.contains($0) }
    }

    private func folder(projectID: String, pageID: String) throws -> URL {
        guard Self.validID(projectID), Self.validID(pageID) else {
            throw BlueprintNativeDrawingError.invalidIdentifier
        }
        return root
            .appendingPathComponent(Self.checksum(Data(projectID.utf8)), isDirectory: true)
            .appendingPathComponent(Self.checksum(Data(pageID.utf8)), isDirectory: true)
    }

    private func manifestURL(projectID: String, pageID: String) throws -> URL {
        try folder(projectID: projectID, pageID: pageID)
            .appendingPathComponent("manifest.json")
    }

    private func checkedFile(_ filename: String, in folder: URL, suffix: String) throws -> URL {
        guard !filename.isEmpty, filename == URL(fileURLWithPath: filename).lastPathComponent,
              filename.hasSuffix(suffix), !filename.contains("..") else {
            throw BlueprintNativeDrawingError.invalidFileName
        }
        return folder.appendingPathComponent(filename)
    }

    func metadata(projectID: String, pageID: String) throws -> BlueprintNativePageManifest? {
        let url = try manifestURL(projectID: projectID, pageID: pageID)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let manifest = try decoder.decode(BlueprintNativePageManifest.self, from: Data(contentsOf: url))
        guard manifest.schemaVersion == Self.schemaVersion else {
            throw BlueprintNativeDrawingError.unsupportedSchema
        }
        guard manifest.projectId == projectID, manifest.pageId == pageID else {
            throw BlueprintNativeDrawingError.incorrectIdentity
        }
        return manifest
    }

    func load(projectID: String, pageID: String) throws -> PKDrawing? {
        guard let manifest = try metadata(projectID: projectID, pageID: pageID) else { return nil }
        let folder = try folder(projectID: projectID, pageID: pageID)
        let file = try checkedFile(manifest.drawingFile, in: folder, suffix: ".drawing")
        let data = try Data(contentsOf: file)
        guard Self.checksum(data) == manifest.drawingSHA256 else {
            throw BlueprintNativeDrawingError.corruptDrawing
        }
        return try PKDrawing(data: data)
    }

    func exportPage(projectID: String, pageID: String) throws -> [String: Any]? {
        guard let manifest = try metadata(projectID: projectID, pageID: pageID) else { return nil }
        let dir = try folder(projectID: projectID, pageID: pageID)
        let drawing = try Data(contentsOf: checkedFile(manifest.drawingFile, in: dir, suffix: ".drawing"))
        let preview = try Data(contentsOf: checkedFile(manifest.previewFile, in: dir, suffix: ".png"))
        guard Self.checksum(drawing) == manifest.drawingSHA256 else {
            throw BlueprintNativeDrawingError.corruptDrawing
        }
        guard Self.checksum(preview) == manifest.previewSHA256 else {
            throw BlueprintNativeDrawingError.corruptPreview
        }
        var value = manifest.bridgeValue
        value["format"] = "blueprint-pencilkit-page"
        value["drawingBase64"] = drawing.base64EncodedString()
        value["previewBase64"] = preview.base64EncodedString()
        value["previewMIME"] = "image/png"
        return value
    }

    /// A render at >=2x makes read-only previews useful on Retina iPhones.
    /// Native PKDrawing remains the editing source, never this bitmap.
    private func previewPNG(for drawing: PKDrawing, size: CGSize) throws -> Data {
        let scale = max(1, min(2, sqrt(12_000_000 / max(1, size.width * size.height))))
        let rect = CGRect(origin: .zero, size: size)
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        let ink = drawing.image(from: rect, scale: scale)
        return UIGraphicsImageRenderer(size: size, format: format).pngData { context in
            UIColor.white.setFill()
            context.fill(rect)
            ink.draw(in: rect)
        }
    }

    @discardableResult
    func save(_ drawing: PKDrawing, projectID: String, pageID: String,
              size: CGSize = pageSize) throws -> BlueprintNativePageManifest {
        guard size.width > 100, size.height > 100,
              size.width <= 4096, size.height <= 8192 else {
            throw BlueprintNativeDrawingError.invalidPageSize
        }
        let dir = try folder(projectID: projectID, pageID: pageID)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let data = drawing.dataRepresentation()
        let preview = try previewPNG(for: drawing, size: size)
        let version = UUID().uuidString.lowercased()
        let drawingFile = "ink-\(version).drawing"
        let previewFile = "preview-\(version).png"
        try data.write(to: dir.appendingPathComponent(drawingFile), options: .atomic)
        try preview.write(to: dir.appendingPathComponent(previewFile), options: .atomic)
        let manifest = BlueprintNativePageManifest(
            schemaVersion: Self.schemaVersion,
            projectId: projectID, pageId: pageID,
            width: Double(size.width), height: Double(size.height),
            drawingFile: drawingFile, previewFile: previewFile,
            drawingSHA256: Self.checksum(data), previewSHA256: Self.checksum(preview),
            savedAt: ISO8601DateFormatter().string(from: Date())
        )
        try encoder.encode(manifest).write(
            to: dir.appendingPathComponent("manifest.json"), options: .atomic
        )
        return manifest
    }

    @discardableResult
    func importPage(projectID: String, pageID: String, payload: [String: Any],
                    allowOverwrite: Bool = false) throws -> BlueprintNativePageManifest {
        guard payload["format"] as? String == "blueprint-pencilkit-page",
              payload["schemaVersion"] as? Int == Self.schemaVersion,
              payload["projectId"] as? String == projectID,
              payload["pageId"] as? String == pageID,
              let encoded = payload["drawingBase64"] as? String,
              let digest = payload["drawingSHA256"] as? String,
              let data = Data(base64Encoded: encoded),
              Self.checksum(data) == digest,
              let width = payload["pageWidth"] as? Double,
              let height = payload["pageHeight"] as? Double else {
            throw BlueprintNativeDrawingError.badImport
        }
        if !allowOverwrite, try metadata(projectID: projectID, pageID: pageID) != nil {
            throw BlueprintNativeDrawingError.existingDrawing
        }
        let drawing = try PKDrawing(data: data) // Reject malformed native ink.
        return try save(drawing, projectID: projectID, pageID: pageID,
                        size: CGSize(width: width, height: height))
    }
}
