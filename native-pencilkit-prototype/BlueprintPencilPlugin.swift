import Capacitor
import Foundation
import UIKit

/// Opt-in Capacitor bridge for the independent PencilKit prototype.
/// Do not register this plugin in production until the Xcode build and
/// backup round-trip have been validated on actual devices.
@objc(BlueprintPencilPlugin)
public class BlueprintPencilPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BlueprintPencilPlugin"
    public let jsName = "BlueprintPencil"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openEditor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importPage", returnType: CAPPluginReturnPromise)
    ]

    private let drawingStore = BlueprintNativeDrawingStore()

    @objc public func capabilities(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "schemaVersion": BlueprintNativeDrawingStore.schemaVersion,
            "format": "blueprint-pencilkit-page",
            "pageWidth": Double(BlueprintNativeDrawingStore.pageSize.width),
            "pageHeight": Double(BlueprintNativeDrawingStore.pageSize.height)
        ])
    }

    @objc public func openEditor(_ call: CAPPluginCall) {
        guard let projectID = call.getString("projectId"),
              let pageID = call.getString("pageId"),
              let pageIDs = call.getArray("pageIds") as? [String],
              !pageIDs.isEmpty, pageIDs.count <= 200,
              Set(pageIDs).count == pageIDs.count,
              pageIDs.contains(pageID),
              BlueprintNativeDrawingStore.validID(projectID),
              pageIDs.allSatisfy({ BlueprintNativeDrawingStore.validID($0) }) else {
            call.reject("Provide a project ID, existing page ID, and distinct pageIds.")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self, let host = self.bridge?.viewController else {
                call.reject("Capacitor's native iOS view controller is unavailable.")
                return
            }
            let editor = BlueprintPencilEditorViewController(
                store: self.drawingStore,
                projectID: projectID, pageIDs: pageIDs, initialPageID: pageID
            )
            editor.onComplete = { result in
                switch result {
                case .success(let manifest):
                    // Include metadata only. Exportable ink/PNG are fetched
                    // explicitly with exportPage to avoid huge plugin replies.
                    call.resolve(manifest.bridgeValue)
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
            let navigation = UINavigationController(rootViewController: editor)
            navigation.modalPresentationStyle = .fullScreen
            host.present(navigation, animated: true)
        }
    }

    @objc public func exportPage(_ call: CAPPluginCall) {
        guard let projectID = call.getString("projectId"),
              let pageID = call.getString("pageId") else {
            call.reject("Project and page IDs are required.")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("Native plugin was unloaded."); return }
            do {
                guard let page = try self.drawingStore.exportPage(
                    projectID: projectID, pageID: pageID
                ) else {
                    call.reject("No native drawing has been saved for this page.")
                    return
                }
                call.resolve(page)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc public func importPage(_ call: CAPPluginCall) {
        guard let projectID = call.getString("projectId"),
              let pageID = call.getString("pageId"),
              let payload = call.getObject("payload") else {
            call.reject("Project ID, page ID, and a native drawing payload are required.")
            return
        }
        let allowOverwrite = call.getBool("allowOverwrite") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("Native plugin was unloaded."); return }
            do {
                // Existing native ink is never replaced without an explicit
                // allowOverwrite request from a user-confirmed restore flow.
                let saved = try self.drawingStore.importPage(
                    projectID: projectID, pageID: pageID,
                    payload: payload, allowOverwrite: allowOverwrite
                )
                call.resolve(saved.bridgeValue)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
