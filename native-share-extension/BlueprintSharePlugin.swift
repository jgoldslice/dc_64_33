import Foundation
import Capacitor

/// App-local Capacitor bridge for the native Share Extension inbox.
/// Add to the iOS APP target only, register explicitly in CAPBridgeViewController.
/// Do not expose this plugin in the public GitHub Pages build.
@objc(BlueprintSharePlugin)
public final class BlueprintSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BlueprintSharePlugin"
    public let jsName = "BlueprintShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publishProjects", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listPending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readFileChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise)
    ]

    private func inbox() throws -> BlueprintShareInbox {
        try BlueprintShareInbox()
    }

    @objc public func publishProjects(_ call: CAPPluginCall) {
        guard let raw = call.getArray("projects") as? [[String: Any]],
              raw.count <= 500 else {
            call.reject("Provide a valid project index (up to 500 projects).")
            return
        }
        let summaries = raw.compactMap { value -> BlueprintShareProject? in
            guard let id = value["id"] as? String,
                  let title = value["title"] as? String else { return nil }
            return BlueprintShareProject(id: id, title: title)
        }
        guard summaries.count == raw.count else {
            call.reject("Project index contains an invalid project.")
            return
        }
        do {
            try inbox().publishProjects(summaries)
            call.resolve(["count": summaries.count])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func listPending(_ call: CAPPluginCall) {
        do {
            let report = try inbox().pendingReport()
            let data = try JSONEncoder().encode(report.entries)
            guard let json = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                call.reject("Could not serialize pending shares.")
                return
            }
            call.resolve(["entries": json, "errors": report.errors])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func readFile(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let itemID = call.getString("itemId") else {
            call.reject("A share ID and item ID are required.")
            return
        }
        do {
            let (data, item) = try inbox().readFile(id: id, itemID: itemID)
            // Do not return paths into the App Group or expose the whole queue.
            call.resolve([
                "base64": data.base64EncodedString(),
                "sha256": item.sha256 ?? "",
                "size": data.count,
                "mime": item.mime ?? "application/octet-stream"
            ])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func readFileChunk(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let itemID = call.getString("itemId"),
              let offset = call.getInt("offset"),
              let length = call.getInt("length") else {
            call.reject("A share ID, item ID, offset and length are required.")
            return
        }
        do {
            let (data, item) = try inbox().readChunk(
                id: id, itemID: itemID, offset: offset, length: length)
            call.resolve([
                "base64": data.base64EncodedString(),
                "offset": offset,
                "length": data.count,
                "size": item.size ?? 0,
                "sha256": item.sha256 ?? ""
            ])
        } catch { call.reject(error.localizedDescription) }
    }

    @objc public func acknowledge(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("A share ID is required.")
            return
        }
        do {
            // The web side calls this only after IndexedDB and planner-manifest
            // read-back succeed. No automatic deletion or timeout is used.
            try inbox().acknowledge(id: id)
            call.resolve(["acknowledged": true])
        } catch { call.reject(error.localizedDescription) }
    }
}
