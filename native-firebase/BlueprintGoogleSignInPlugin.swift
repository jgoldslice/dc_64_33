import Capacitor
import GoogleSignIn
import UIKit

@objc(BlueprintGoogleSignInPlugin)
public final class BlueprintGoogleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BlueprintGoogleSignInPlugin"
    public let jsName = "BlueprintGoogleSignIn"
    public let pluginMethods = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise)
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController,
                  let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
                  let settings = NSDictionary(contentsOf: url),
                  let clientID = settings["CLIENT_ID"] as? String,
                  let serverClientID = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String
            else {
                call.reject("Google sign-in needs the registered iOS and web OAuth client settings.")
                return
            }

            GIDSignIn.sharedInstance.configuration = GIDConfiguration(
                clientID: clientID, serverClientID: serverClientID
            )
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
                guard error == nil, let user = result?.user, let idToken = user.idToken?.tokenString else {
                    call.reject("Google sign-in did not complete.")
                    return
                }
                call.resolve(["idToken": idToken, "accessToken": user.accessToken.tokenString])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
            call.resolve()
        }
    }
}
