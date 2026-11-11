import Foundation
import XCTest

// Add this file to an iOS XCTest target AND include BlueprintShareInbox.swift
// in that test target for an independent isolated queue test. Not run by
// GitHub's Chromium workflow and not a substitute for Share Extension device QA.
final class BlueprintShareInboxTests: XCTestCase {
    private var temp: URL!

    override func setUpWithError() throws {
        temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        if let temp { try? FileManager.default.removeItem(at: temp) }
        temp = nil
    }

    private func store() throws -> BlueprintShareInbox {
        let store = try BlueprintShareInbox(testDirectory: temp)
        try store.publishProjects([
            BlueprintShareProject(id: "research", title: "Research"),
            BlueprintShareProject(id: "house", title: "House")
        ])
        return store
    }

    func testLinkAndImageAreQueuedVerifiedAndAcknowledgedOnlyExplicitly() throws {
        let store = try store()
        let file = temp.appendingPathComponent("photo.png")
        let original = Data("Test image data".utf8)
        try original.write(to: file)
        let id = try store.enqueue(projectID: "research", input: [
            BlueprintShareInput(link: URL(string: "https://example.org/paper")!, title: "Paper"),
            BlueprintShareInput(file: file, name: "Figure.png", mime: "image/png")
        ])
        let pending = try store.pending()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].projectId, "research")
        XCTAssertEqual(pending[0].items.map(\.kind), ["link", "file"])
        XCTAssertEqual(pending[0].items[0].url, "https://example.org/paper")

        let (readback, metadata) = try store.readFile(id: id, itemID: "i1")
        XCTAssertEqual(readback, original)
        XCTAssertEqual(metadata.size, original.count)

        // No background aging/cleanup or implicit delete after a native save.
        XCTAssertEqual(try store.pending().count, 1)
        try store.acknowledge(id: id)
        XCTAssertEqual(try store.pending().count, 0)
    }

    func testCorruptionCannotBeAcknowledgedByAFileRead() throws {
        let store = try store()
        let source = temp.appendingPathComponent("file.png")
        try Data("original image".utf8).write(to: source)
        let id = try store.enqueue(projectID: "research", input: [
            BlueprintShareInput(file: source, name: "File.png", mime: "image/png")
        ])
        let file = temp.appendingPathComponent("BlueprintShareInbox/pending")
            .appendingPathComponent(id).appendingPathComponent("i0")
        try Data("tampered data".utf8).write(to: file)
        XCTAssertThrowsError(try store.readFile(id: id, itemID: "i0"))
        XCTAssertEqual(try store.pending().count, 1)
    }

    func testWrongProjectAndNonHTTPURLsCannotBeQueued() throws {
        let store = try store()
        XCTAssertThrowsError(try store.enqueue(projectID: "deleted", input: [
            BlueprintShareInput(link: URL(string: "https://example.org")!, title: "Wrong")
        ]))
        XCTAssertThrowsError(try store.enqueue(projectID: "research", input: [
            BlueprintShareInput(link: URL(string: "javascript:alert(1)")!, title: "Unsafe")
        ]))
        XCTAssertEqual(try store.pending().count, 0)
    }

    func testCorruptManifestDoesNotBlockOtherPendingShares() throws {
        let store = try store()
        let bad = try store.enqueue(projectID: "research", input: [
            BlueprintShareInput(link: URL(string: "https://example.org/bad")!, title: "First")
        ])
        let good = try store.enqueue(projectID: "house", input: [
            BlueprintShareInput(link: URL(string: "https://example.org/good")!, title: "Second")
        ])
        let manifest = temp.appendingPathComponent("BlueprintShareInbox/pending")
            .appendingPathComponent(bad).appendingPathComponent("manifest.json")
        try Data("corrupted manifest".utf8).write(to: manifest)
        let report = try store.pendingReport()
        XCTAssertEqual(report.errors, [bad])
        XCTAssertEqual(report.entries.map(\.id), [good])
        try store.acknowledge(id: good)
        XCTAssertTrue(FileManager.default.fileExists(atPath: manifest.path))
    }

    func testLastSelectedProjectRemainsTheDefault() throws {
        let store = try store()
        let id = try store.enqueue(projectID: "house", input: [
            BlueprintShareInput(link: URL(string: "https://example.org")!, title: "Home")
        ])
        XCTAssertNotNil(UUID(uuidString: id))
        XCTAssertEqual(store.projectIndex().lastProjectID, "house")
    }
}
