# Blueprint: iPhone Duo and adaptive display readiness (v9.17)

## Device guidance
Apple announced iPhone Duo on September 9, 2026. It has a 5.4-inch
outer screen and a 7.6-inch inner screen, and supports iOS 27's adaptive
multitasking. Apple announced planned Apple Pencil USB-C support later in 2026.
Do not infer CSS viewport pixel widths directly from physical diagonal inches.

Source: https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/

## Implemented in v9.17
- One stable five-card Today document shared between outer and inner displays:
  Schedule, Habits, Tasks, Top Priorities, Projects.
- Small viewport: natural single-column scrolling, safe bottom navigation.
- Expanded viewport: two-column paired rows and full-width projects.
- Center dashboard only when there is room; natural page growth takes precedence.
- Touch-friendly per-card scrolling with a visible overflow hint when content is hidden.
- Responsive display class updates on viewport resize, orientation transition,
  reactivation, and visual viewport resize. DOM state is not remounted.
- Data uses the existing planner store; no migration or duplicate state.

## Before testing on Duo
1. Determine outer and inner CSS viewport sizes, portrait/landscape, native
   viewport in the Capacitor WKWebView, safe areas and taskbar.
2. Verify continuity when unfolding with a task editor open, a keyboard present,
   a note in progress, or a scrollable card partially scrolled.
3. Test native Apple Pencil drawing once the PencilKit bridge is integrated.
   A web-only pointer drawing surface is not a native PencilKit implementation.
4. Review the expanded project Notes split-view and navigation affordances.
5. Test physical folding transitions and on-device memory/performance;
   browser responsive tests do not establish those properties.

## Breakpoints
- <650 CSS px: compact, one column.
- >=650 CSS px and available height >=600 CSS px: paired two-column cards.
- Other layouts adapt by actual available screen space, not phone model.

All thresholds are provisional until a physical Duo is available.
