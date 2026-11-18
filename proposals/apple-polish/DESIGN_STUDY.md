# Design-language study: Apple, Fluent, Material, Atlassian and IBM Carbon

**Status:** Research for later iterations. This lives ONLY in the draft proposal branch. Nothing here ships automatically.

## 1. Apple — recognizable layouts, even as the window changes
Source: https://developer.apple.com/design/human-interface-guidelines/layout

Apple recommends adapting to **available size classes / window width**, rather than designing solely for a named device. Preserve function when screens grow or shrink. Make safe areas and text growth first-class concerns.

**Canvas implication:** Keep four navigation destinations. A future unfolded or wide layout should **reveal the existing project list beside Notes**, not invent another tab. Restore the selected page, scroll and workspace after resizing; avoid assumptions about an unannounced device or stylus.

Apple also recommends comfortable tap areas (https://developer.apple.com/design/tips/) and restrained, optional motion (https://developer.apple.com/design/human-interface-guidelines/motion).

## 2. Microsoft Fluent 2 — built for focus, natural on each platform
Sources: https://fluent2.microsoft.design/design-principles and https://fluent2.microsoft.design/layout

Fluent emphasizes reduced visual noise, predictable platform conventions and grouping via spacing rather than extra strokes and separators.

**Canvas implication:** prefer one main hierarchy per screen: Today → four cards, Goals → goal title first, Projects → folder name first. Reduce nested card outlines before adding more effects. A page should seldom need a tutorial.

## 3. Atlassian — consistent spacing and semantic design tokens
Sources: https://atlassian.design/foundations/spacing and https://atlassian.design/foundations/tokens/design-tokens/

Atlassian uses an 8px-based spacing scale and semantic tokens as the stable base for themes and reusable components.

**Canvas implication:** standardize small/medium/large gaps using tokens and preserve theme customization. Avoid hard-coded new accent colors; reuse `--primary`, `--secondary-ui`, `--surface`, `--line`, `--ink`. Subtract unnecessary visible separators and favor stable whitespace.

## 4. IBM Carbon — productive motion versus expressive motion
Sources:
- https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview
- https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/overview
- https://www.carbondesignsystem.com/carbon-next

IBM distinguishes **productive** feedback for routine tasks from **expressive** moments where animation carries meaning. It advises unobtrusive movement and emphasizes progressive disclosure of complexity only when needed.

**Canvas implication:** checkboxes, tab changes and menu reveals use tiny, quick feedback; reserve a more expressive sequence for the user-selected **app opening** (lightning → lightbulb → painting/blueprint). Never autoplay distracting motion throughout the workday. Always honor reduced motion. Apply an 8px-based rhythm without installing the Carbon UI framework.

## 5. Google Material — tactile ergonomics
Source: https://m3.material.io/foundations/accessible-design/overview and https://m3.material.io/components/buttons/guidelines

Material prioritizes predictable touch interactions, accessibly sized hit regions and coherent component behavior.

**Canvas implication:** 44–48 CSS px effective tap targets, clear pressed/disabled state, no taps that ambiguously both drag and edit, no global swipe gesture while touching editable notes. Precise icon size can stay visually small if the interactive area is generous.

## Proposed refinements for review, NOT approved features
1. Remove a layer of redundant borders on nested project cards where contrast remains sufficient.
2. Use only one tactile microtransition timing for routine button feedback, tested against reduced motion.
3. Test **font scaling at 200%** and a narrow 320px viewport before more desktop flourishes.
4. Test switching narrow → wide → narrow with a partially edited notebook page, image position and onscreen keyboard.
5. Introduce an explicit, reversible editing/moving mode **only if actual iPhone long-press selection still collides**. Don't add a button preemptively.
6. Keep the opening animation a distinct optional signature moment rather than playing it every tab switch.

**North star:** *A product feels like Apple because it is coherent and dependable, not because it imitates translucency, motion or SF Symbols without purpose.*
