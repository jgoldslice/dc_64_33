# DRAFT — Canvas reliability, touch, and adaptive layout

**Review-only. Not connected to the live app. Do not merge without approval and real iPhone Safari testing.**

## P0: durable saves
- Audit every localStorage and IndexedDB write. Only show "Saved" after the write succeeds.
- On quota/security/serialization errors, preserve the in-memory edit and show a persistent but quiet "Changes not saved" state with Retry and Export options.
- Avoid writing duplicate large media blobs to localStorage. Preserve the existing `jgold-planner-v1` key and media IDs.
- Use `safe-storage.js` as a prototype, not a drop-in replacement for IndexedDB transactions.

## P1: complete backup verification
- Resolve the README contradiction: v6 says media is excluded; v7.4 introduces complete media backups. Mark the older warning as historical.
- Before import mutates live data, validate schema/version, media IDs, reference closure, base64 payloads and size limits; reject invalid imports without modifying the current workspace.
- Test a complete workspace containing project notebook text/images/ink, Library files, Tasks, Goals, Habits, links and sketch drafts.
- Round-trip through a fresh browser context; compare logical data and media bytes. Test interrupted/quota-limited restores and legacy exports.
- Maintain an independent backup until verified on Safari.

## P1: iPhone touch and text selection
- Test on physical Safari: short tap edit, text selection/copy, long-press move, image overlap, drag resize, pen drawing, scrolling and edge-back gestures.
- Prefer the existing six-dot handle for moving if native selection conflicts with long-press. Never disable text selection globally.
- Use pointer capture only for explicit drag operations; cancel gestures on pointercancel, lostpointercapture and scroll.
- Ensure 44pt effective tap areas, safe-area insets, keyboard avoidance, VoiceOver names and visible focus.

## P2: adaptive future foldable layout
- Keep single-pane phone layout. At sufficiently wide *available* viewport, show project list beside the selected project; retain last active tab and scroll positions.
- No hardware-specific Duo assumptions. Check resize/orientation transitions without remounting editors or losing draft text.

## Release gates
1. Standalone unit tests green; full Playwright Chromium + WebKit tests green.
2. No storage-key migrations or media deletion without explicit restore tests.
3. Manual iPhone Safari and VoiceOver smoke tests.
4. Export an independent complete backup before merging.
5. Explicit owner approval for merge and deployment.

## Existing proposals (do not duplicate)
- PR #8: 63-item design roadmap and gesture/layout prototypes.
- PR #9: responsive navigation and backup image references.
- PR #10: project continuity and offline behavior.
- PR #11: documentation-only storage/backup audit.

This branch adds only an isolated storage helper, its tests, and the integration checklist. Production scripts, styles, and service worker remain unchanged.
