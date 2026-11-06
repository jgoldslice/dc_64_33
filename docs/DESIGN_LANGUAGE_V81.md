# Canvas UI design language — v8.1

> The interface should make a deliberate action feel easy, not make every imaginable feature available at once.

This document translates public design-system recommendations into Canvas-specific rules.
It is **not** a license to copy Apple, Google or Microsoft graphical assets. Canvas
keeps its own customizable palette and its plain, notebook-like identity.

## Sources studied
- [Apple Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — visual hierarchy, progressive disclosure, safe areas and adaptable widths.
- [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) — recommended iOS control size, focus and system text/motion preferences.
- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion) — movement should clarify rather than distract, and respect Reduce Motion.
- [Google Material: Touch Targets](https://m1.material.io/usability/accessibility.html) — 48×48dp targets, including invisible padding around smaller icons.
- [Microsoft Fluent 2: Principles](https://fluent2.microsoft.design/design-principles) — focus, natural platform patterns, restrained signature moments.
- [Microsoft Fluent 2: Layout](https://fluent2.microsoft.design/layout) — consistent spacing and meaningful grouping.
- [Microsoft Fluent 2: Motion](https://fluent2.microsoft.design/motion) — short functional animation with accessible alternatives.
- [Atlassian Design: Foundations](https://atlassian.design/foundations) — reusable tokens and shared components instead of arbitrary embellishments.

## Canvas decisions
1. **Hierarchy by use, not decoration.** Today shows the four existing blocks only; Goal titles outrank category names.
2. **Touch-first without clutter.** Make controls easier to hit without enlarging every decorative icon. Clear labels and focus states.
3. **Perceived continuity.** Switching tabs retains their scroll position; opening a project is a reliable return to its own workspace.
4. **Purposeful motion.** Press states should acknowledge input quickly, not bounce through a flourish. Respect Reduce Motion.
5. **One identity across devices.** Palette, handwriting font and naming remain consistent while layouts respond to available width.
6. **Progressive disclosure.** Step action menus, project settings and Notes page options stay contextual.
7. **Data safety over new features.** Complete export/import must preserve every image and editable notebook page.
8. **Apple-style, not fake native.** A web app can borrow content hierarchy and interaction models, but should not pretend to be a native SwiftUI view or copy proprietary UI assets.
9. **No speculative iPhone Duo specifications.** Future wide/unfolded form factors are modeled as viewport variations; actual hinge/pen capabilities remain unknown.

## What shipped in this pass (v8.1)
- Consistent effective touch targets on key controls, with native-looking focus/pressed responses.
- A conservative horizontal-swipe classifier that respects native screen edges, vertical scrolling, dialogs, selectable text and active project workspaces.
- Scroll position restored on returning to each main tab.
- Recently opened project folders prioritized on Today.
- On a wide viewport, a quiet project switcher appears alongside the existing project workspace. Narrow views remain single pane.
- Complete backup includes and remaps the keys of notebook page images; deleting a Library entry no longer removes a blob still referenced elsewhere.
- Dynamic viewport/safe-area aware overlays, reduced-motion handling and modest visual spacing adjustments.

## Deliberately NOT added
- Another home card, bottom tab, AI panel, dashboard score, achievement badges, new Notes editor controls, font families or visible user data counts.
- A third-party UI library that duplicates basic browser functionality.
- Fold, stylus or camera APIs based on rumor rather than device capabilities.
- Automatic cloud sync or hidden analytics.

## Quality gate
- Existing Canvas smoke suite.
- New navigation, responsive rail, recents, touch-target, retained-media and exported/restored-image tests.
- Real iPhone Safari check of the long-press-to-move editing gesture remains essential; Chromium is not WebKit.
- Import/export and medium/large note font should be tested again with a full user backup before major data migration.
- No destructive data model migration occurs in v8.1.
