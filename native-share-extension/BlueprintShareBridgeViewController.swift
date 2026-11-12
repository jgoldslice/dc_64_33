import UIKit
import WebKit
import Capacitor

// HOST APP TARGET ONLY.
// In Main.storyboard select the existing Bridge View Controller, then set
// Custom Class to BlueprintShareBridgeViewController and Module to the app
// module. Do not replace the existing storyboard or install a second bridge.
class BlueprintShareBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // Debug builds only: allow Safari Web Inspector to see Blueprint's
        // WKWebView on a connected iPhone. Does not enable release inspection.
        #if DEBUG
        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
        #endif

        bridge?.registerPluginInstance(BlueprintSharePlugin())
    }
}
