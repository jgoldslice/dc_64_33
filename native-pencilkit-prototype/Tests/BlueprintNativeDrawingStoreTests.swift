import PencilKit
import UIKit
import XCTest

/// Add this file to an iOS XCTest target when integrating the native prototype.
/// These tests cannot execute in the repository's Linux/Chromium CI.
final class BlueprintNativeDrawingStoreTests: XCTestCase {
    private var temp: URL!
    private var store: BlueprintNativeDrawingStore!

    override func setUpWithError() throws {
        try super.setUpWithError()
        temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("BlueprintNativeInkTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        store = BlueprintNativeDrawingStore(baseURL: temp)
    }

    override func tearDownWithError() throws {
        try FileManager.default.removeItem(at: temp)
        try super.tearDownWithError()
    }

    func testPageRoundTripAndStableIdentity() throws {
        let original = PKDrawing()
        let manifest = try store.save(original, projectID: "project-1", pageID: "page-A")
        XCTAssertEqual(manifest.schemaVersion, 1)
        XCTAssertEqual(manifest.projectId, "project-1")
        XCTAssertEqual(manifest.pageId, "page-A")
        XCTAssertEqual(try store.load(projectID: "project-1", pageID: "page-A")?
            .dataRepresentation(), original.dataRepresentation())
        XCTAssertNil(try store.load(projectID: "project-1", pageID: "page-B"))
        XCTAssertNil(try store.load(projectID: "project-2", pageID: "page-A"))
    }

    func testSeparateNotebookPagesAndRetinaPreview() throws {
        try store.save(PKDrawing(), projectID: "p", pageID: "1")
        try store.save(PKDrawing(), projectID: "p", pageID: "2")
        let one = try XCTUnwrap(store.exportPage(projectID: "p", pageID: "1"))
        let two = try XCTUnwrap(store.exportPage(projectID: "p", pageID: "2"))
        XCTAssertNotEqual(one["pageId"] as? String, two["pageId"] as? String)
        let bytes = try XCTUnwrap(Data(base64Encoded: try XCTUnwrap(one["previewBase64"] as? String)))
        let bitmap = try XCTUnwrap(UIImage(data: bytes)?.cgImage)
        XCTAssertGreaterThanOrEqual(bitmap.width, 2048)
        XCTAssertGreaterThanOrEqual(bitmap.height, 2880)
    }

    func testImportRejectsOverwriteUnlessExplicitlyAuthorized() throws {
        try store.save(PKDrawing(), projectID: "p", pageID: "A")
        let payload = try XCTUnwrap(store.exportPage(projectID: "p", pageID: "A"))
        XCTAssertThrowsError(try store.importPage(projectID: "p", pageID: "A", payload: payload))
        let updated = try store.importPage(
            projectID: "p", pageID: "A", payload: payload, allowOverwrite: true
        )
        XCTAssertEqual(updated.pageId, "A")
    }

    func testMalformedImportCannotReplaceExistingDrawing() throws {
        try store.save(PKDrawing(), projectID: "p", pageID: "A")
        let before = try XCTUnwrap(store.metadata(projectID: "p", pageID: "A"))
        var payload = try XCTUnwrap(store.exportPage(projectID: "p", pageID: "A"))
        payload["drawingBase64"] = "YWJj"
        XCTAssertThrowsError(try store.importPage(
            projectID: "p", pageID: "A", payload: payload, allowOverwrite: true
        ))
        let after = try XCTUnwrap(store.metadata(projectID: "p", pageID: "A"))
        XCTAssertEqual(after.drawingFile, before.drawingFile)
        XCTAssertEqual(after.drawingSHA256, before.drawingSHA256)
    }

    func testCorruptedSavedDrawingIsDetected() throws {
        try store.save(PKDrawing(), projectID: "p", pageID: "A")
        let enumerator = try XCTUnwrap(FileManager.default.enumerator(
            at: temp, includingPropertiesForKeys: nil
        ))
        let file = try XCTUnwrap((enumerator.allObjects as? [URL])?.first {
            $0.pathExtension == "drawing"
        })
        try Data([1, 2, 3]).write(to: file, options: .atomic)
        XCTAssertThrowsError(try store.load(projectID: "p", pageID: "A"))
    }
}
