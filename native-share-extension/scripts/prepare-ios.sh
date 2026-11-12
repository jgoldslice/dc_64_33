#!/usr/bin/env bash
# Blueprint — safe, idempotent staging of native Share Extension sources.
# This does NOT edit an Xcode project, change signing, build, or install an app.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAP_ROOT="${1:-$HOME/Documents/ChatGPT/dc6433/canvas-ios}"
PROJECT="$CAP_ROOT/ios/App/App.xcodeproj"
NATIVE_DIR="$CAP_ROOT/ios/App/BlueprintShareStaging"
ASSETS_DIR="$CAP_ROOT/blueprint-share-assets-staging"
BACKUP_DIR="$CAP_ROOT/blueprint-share-prep-backup"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
require_file() { [[ -f "$1" ]] || die "Missing required file: $1"; }
copy_without_overwrite() {
  local src="$1" dest="$2"
  require_file "$src"
  if [[ -e "$dest" ]]; then
    cmp -s "$src" "$dest" || die "Staged file differs; refusing to overwrite: $dest"
    printf '  Verified existing: %s\n' "$dest"
  else
    cp -p "$src" "$dest"
    printf '  Staged: %s\n' "$dest"
  fi
}
require_file "$PROJECT/project.pbxproj"
for file in BlueprintShareInbox.swift BlueprintShareViewController.swift BlueprintSharePlugin.swift BlueprintShareBridgeViewController.swift; do
  require_file "$SOURCE_DIR/$file"
done
require_file "$SOURCE_DIR/web/inbox.js"
require_file "$SOURCE_DIR/web/host-entry.js"
require_file "$SOURCE_DIR/Tests/BlueprintShareInboxTests.swift"

printf 'Blueprint native Share Extension preparation\n'
printf '  Xcode project: %s\n' "$PROJECT"
printf '  Source package: %s\n' "$SOURCE_DIR"
printf '  No Xcode target or signing files will be changed.\n'

mkdir -p "$BACKUP_DIR" "$NATIVE_DIR" "$ASSETS_DIR" "$NATIVE_DIR/Tests"
# Back up the project definition once. Never overwrite an existing backup.
if [[ ! -f "$BACKUP_DIR/project.pbxproj.original" ]]; then
  cp -p "$PROJECT/project.pbxproj" "$BACKUP_DIR/project.pbxproj.original"
  printf '  Backed up project.pbxproj before native setup.\n'
fi
for file in BlueprintShareInbox.swift BlueprintShareViewController.swift BlueprintSharePlugin.swift; do
  copy_without_overwrite "$SOURCE_DIR/$file" "$NATIVE_DIR/$file"
done
copy_without_overwrite "$SOURCE_DIR/Tests/BlueprintShareInboxTests.swift" "$NATIVE_DIR/Tests/BlueprintShareInboxTests.swift"
copy_without_overwrite "$SOURCE_DIR/web/inbox.js" "$ASSETS_DIR/inbox.js"
copy_without_overwrite "$SOURCE_DIR/web/host-entry.js" "$ASSETS_DIR/host-entry.js"

printf '\nStaging complete. Native sharing is NOT activated yet.\n'
printf 'Next: open the Xcode project, create the Share Extension target, set App Groups\n'
printf 'for BOTH targets, add the Swift files with correct target membership, register\n'
printf 'the Capacitor plugin via the staged bridge subclass, set the bridge's custom\nclass in Main.storyboard, and load the two native JS files after app scripts.\n'
printf 'Read: %s/README.md\n' "$SOURCE_DIR"
printf 'Inspect targets with: xcodebuild -list -project "%s"\n' "$PROJECT"
printf 'DO NOT uninstall Blueprint to troubleshoot; export a complete backup first.\n'
