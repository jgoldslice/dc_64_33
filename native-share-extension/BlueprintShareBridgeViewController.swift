import UIKit
import WebKit
import Capacitor

// HOST APP TARGET ONLY.
// In Main.storyboard set the existing bridge scene's Custom Class to
// BlueprintShareBridgeViewController, with the app's module.
// Diagnostic logs are compiled only into DEBUG builds.
class BlueprintShareBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        #if DEBUG
        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
        print("BLUEPRINT SHARE: capacitorDidLoad; bridge available = \(bridge != nil)")
        #endif

        guard let nativeBridge = bridge else {
            #if DEBUG
            print("BLUEPRINT SHARE ERROR: Capacitor bridge is nil")
            #endif
            return
        }

        nativeBridge.registerPluginInstance(BlueprintSharePlugin())

        #if DEBUG
        print("BLUEPRINT SHARE: registered plugin lookup = \(nativeBridge.plugin(withName: "BlueprintShare") != nil)")
        #endif
    }
}
