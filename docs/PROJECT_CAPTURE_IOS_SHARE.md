# Blueprint — Save to Project from iPhone

## Available now
Brainstorm → project → Library **+ Add** opens a reviewed capture form.
Choose a project and save a link, image or PDF. Files remain in the
existing device-local IndexedDB store; include them in a complete backup.

## Optional Apple Shortcuts Share Sheet bridge — links
Create a Shortcut called **Save to Blueprint**. In its Details enable
**Show in Share Sheet** and accept URLs. URL-encode the Shortcut input,
construct this URL and use **Open URLs**:

    https://jgoldslice.github.io/dc_64_33/#bp-share?url=<ENCODED_URL>

Blueprint then asks which project should receive the link and requires
confirmation before saving. The hash fragment stays out of the HTTP
request to GitHub Pages. iOS may open a separate browser/app window;
v9.19 blocks stale windows from silently overwriting newer data.

To save a photo right now, open the selected project's Library and use
**Photo / file**. Do not try to embed photo bytes in the URL fragment.

## Native Apple Share Extension: not yet built
The public GitHub repo contains the web frontend and PencilKit prototype
but not the complete Capacitor Xcode wrapper. A native Share Extension
still requires an Xcode target, URL/image activation rules, an App Group
entitlement for both host and extension, safe shared-file staging,
project-picker review in the host app, transfer cleanup, and real-device
signing/testing. Sharing from Photos directly to Blueprint is therefore
not supported by this release.

## Recovery and backups
When another browser window saves newer planner data, the older window
will refuse to save. Export an unsaved recovery JSON before reloading.
That recovery copy is a planner manifest only, not a complete image backup.
Use Customize → Export complete backup for binary files and notes.
Do not uninstall Blueprint to update it; locally stored content may be lost.