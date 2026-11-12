import UIKit
import Capacitor

// HOST APP TARGET ONLY.
// In Main.storyboard select the existing Bridge View Controller, then set
// Custom Class to BlueprintShareBridgeViewController and Module to the app
// module. Do not replace the existing storyboard or install a second bridge.
class BlueprintShareBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(BlueprintSharePlugin())
    }
}
