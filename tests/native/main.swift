// Compile with the shipping store using the macOS SDK. All files are disposable.
import Foundation
import PencilKit
import AppKit

func requireError(_ action: () throws -> Void) {
    do { try action(); fatalError("Expected a drawing storage error") } catch {}
}

let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
let file = root.appendingPathComponent("page.pkdrawing")
let points = [CGPoint(x: 4, y: 5), CGPoint(x: 18, y: 22)].enumerated().map { index, p in
    PKStrokePoint(location: p, timeOffset: Double(index) * 0.02, size: CGSize(width: 3, height: 3),
                  opacity: 1, force: 0.5, azimuth: 0, altitude: 1)
}
let stroke = PKStroke(ink: PKInk(.pen, color: .black),
                      path: PKStrokePath(controlPoints: points, creationDate: Date()))
let drawing = PKDrawing(strokes: [stroke])
let bytes = drawing.dataRepresentation()
let unused = try BlueprintPencilStore.bytes(at: file)
precondition(unused == nil)
try BlueprintPencilStore.stage(bytes, at: file)
let recovered = try BlueprintPencilStore.bytes(at: file)!
precondition(recovered == bytes)
let restored = try PKDrawing(data: recovered)
precondition(restored.strokes.count == 1 && restored.strokes[0].path.count == points.count)
precondition(restored.strokes[0].path[1].location == points[1].location)
requireError { try BlueprintPencilStore.stage(PKDrawing().dataRepresentation(), at: file) }
let afterConflict = try Data(contentsOf: file)
precondition(afterConflict == bytes)
let corrupt = root.appendingPathComponent("invalid.pkdrawing")
requireError { try BlueprintPencilStore.stage(Data([1, 2, 3]), at: corrupt) }
precondition(!FileManager.default.fileExists(atPath: corrupt.path))
try FileManager.default.removeItem(at: file)
requireError { _ = try BlueprintPencilStore.bytes(at: file) }
print("Verified real PencilKit stroke round trip, byte integrity, overwrite refusal, corruption and missing-file detection.")
