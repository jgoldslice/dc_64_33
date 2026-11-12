#!/usr/bin/env bash
# Linux/macOS smoke test: checks safe staging, not an iOS compile.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
mkdir -p "$TMP_ROOT/ios/App/App.xcodeproj"
printf 'EXISTING-XCODE-PROJECT-DO-NOT-EDIT\n' > "$TMP_ROOT/ios/App/App.xcodeproj/project.pbxproj"

bash "$SOURCE_DIR/scripts/prepare-ios.sh" "$TMP_ROOT" >/dev/null
cmp "$TMP_ROOT/ios/App/App.xcodeproj/project.pbxproj" "$TMP_ROOT/blueprint-share-prep-backup/project.pbxproj.original"
for name in BlueprintShareInbox.swift BlueprintShareViewController.swift BlueprintSharePlugin.swift BlueprintShareBridgeViewController.swift; do
  cmp "$SOURCE_DIR/$name" "$TMP_ROOT/ios/App/BlueprintShareStaging/$name"
done
cmp "$SOURCE_DIR/Tests/BlueprintShareInboxTests.swift" "$TMP_ROOT/ios/App/BlueprintShareStaging/Tests/BlueprintShareInboxTests.swift"
cmp "$SOURCE_DIR/web/inbox.js" "$TMP_ROOT/blueprint-share-assets-staging/inbox.js"
cmp "$SOURCE_DIR/web/host-entry.js" "$TMP_ROOT/blueprint-share-assets-staging/host-entry.js"

# The same command must work safely a second time.
bash "$SOURCE_DIR/scripts/prepare-ios.sh" "$TMP_ROOT" >/dev/null
# Never overwrite an already-staged file if its contents diverged.
printf 'CUSTOM-LOCAL-EDIT\n' > "$TMP_ROOT/ios/App/BlueprintShareStaging/BlueprintSharePlugin.swift"
if bash "$SOURCE_DIR/scripts/prepare-ios.sh" "$TMP_ROOT" >/dev/null 2>&1; then
  echo "ERROR: staging script overwrote or accepted a mismatched file" >&2
  exit 1
fi
grep -q 'EXISTING-XCODE-PROJECT-DO-NOT-EDIT' "$TMP_ROOT/ios/App/App.xcodeproj/project.pbxproj"
echo 'PASS: safe staging, idempotency, no Xcode project edits, overwrite protection'
