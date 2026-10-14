# Handoff: Chronon Brand Identity

## Overview
Brand identity for **Chronon**, an API platform. Includes the logo mark ("Molecule"), wordmark, lockups, app icon/favicon, colour palette, typography and two usage examples (docs header, social card). Use this to set up the project's brand foundation: logo assets, design tokens, fonts, and the base look of the docs/marketing site.

## About the Design Files
`reference/Chronon Brand.dc.html` is a **design reference built in HTML** (open it in a browser; it needs the sibling `support.js`). It is not production code. Recreate the look in the project's own stack (React/Next, Vue, etc.) using its patterns. If no stack exists yet, pick what fits the project. The SVGs in `assets/` and `tokens.css` **are** meant to be used directly.

## Fidelity
**High-fidelity.** Colours, type and logo geometry are final. Reproduce them exactly.

## Logo mark — "Molecule"
Six rotationally repeated arms around a hollow centre, plus a core particle. viewBox `0 0 200 200`, centre (100,100). Angles are in degrees; 0° points right, and the arms start at −90° (straight up), rotating clockwise in 60° steps.

For each arm k = 0…5, with θ = k·60 − 90:
- **Stem**: a capsule from polar (r 20, θ) to (r 46, θ), width 12
- **Long branch**: a capsule from (46, θ) to (82, θ+22), width 11, ending in a node of radius 11
- **Short branch**: a capsule from (46, θ) to (64, θ−18), width 11, ending in a node of radius 9
- **Satellite**: a separate dot at (49, θ+31), radius 6.5 (not merged)

**Core**: a dot at the centre, radius 7, in Photon (or the same ink for one-colour use).

Organic joins: stems, branches and nodes pass through a "goo" filter (`feGaussianBlur stdDeviation=2.6` → alpha matrix `0 0 0 22 -9`), which fuses them with smooth fillets. Satellites and the core are **not** filtered.

⚠️ **Production note:** the shipped SVGs rely on this filter, so they render correctly in browsers. For print, trademark filing, or tools without filter support (some email clients, Figma import), trace them into a single outlined vector path: open one in Illustrator or Inkscape, rasterise it at a high resolution, then Image Trace → Expand. The filter-based SVG is the source of truth for the shape.

Clear space = one long-node diameter (22 units at 200 units). Minimum size: 16px (favicon), shown on a Night tile.

Generator code (the `renderVals()` → `goo`/`sats`/`core` logic) is in the reference file and can be ported directly to a React `<ChrononMark />` component.

## Wordmark
`chronon`, all lowercase, Averia Libre 700, letter-spacing −0.03em, line-height ~0.85–1.
- Horizontal lockup: mark height ≈ 1.2 × the wordmark cap height, gap ≈ 0.3 × the mark size
- Stacked lockup: mark above, gap ≈ 0.16 × the mark size

## Colour
| Token | Hex | Use |
|---|---|---|
| Night | #0F1220 | dark ground; text on light |
| Night-2 | #1A1E2E | raised surfaces on Night |
| Line dark | #2A2F42 | borders on Night |
| Paper | #F7F7FF | light ground |
| Line light | #DCD9CF | borders on Paper |
| Photon | #DE6449 | signal accent: core particle, primary CTA. Use once per view |
| On-Photon | #2A0F08 | text on Photon |
| Ion | #5B45C9 | links, secondary accent, social card ground |
| Ion soft | #B6A2F2 | values/strings in code on Night |
| Slate | #6A6F80 | meta text on Paper |
| Mist | #C9CCD8 / #9AA0B4 | body / meta text on Night |

Ratio: Night + Paper make up ~90% of surfaces. Photon is used sparingly. Mark colours: Night or Paper ink, with a Photon core (on Ion, use a Night mark with a Photon core).

## Typography
Google Fonts: `family=Averia+Libre:ital,wght@0,300;0,400;0,700;1,400&family=Martian+Mono:wght@400;500`
- **Averia Libre**: display and body. Headlines at 700, letter-spacing about −0.035em, line-height 1. Body at 400, 19px/1.5. Italic only for emphasis.
- **Martian Mono**: code, endpoints, timestamps, labels. Labels are 12px uppercase, letter-spacing 0.04em, in Slate (light) or Mist-2 (dark). Code is 13px/1.9.
- Reference sizes: hero wordmark clamp(88px, 12vw, 184px); section titles 48px; card titles 44px.

## Components seen in the reference
- **Primary button**: Photon background, Night text, 14px weight 600, padding 8×14, radius 6, `white-space: nowrap`.
- **Code block (dark)**: Night or Night-2 background, 1px Line-dark border, radius 6–8, padding 14–24. HTTP verbs in Photon, paths in Paper, values in Ion soft, comments in #6F7590.
- **Docs header**: Night bar with a 1px Line-dark bottom border, padding 16×22. Lockup (26px mark + 22px wordmark + a "docs" mono tag) · nav links (15px, Mist) · Photon CTA at the right. Wraps on narrow widths.
- **Social card (1200×630)**: Ion ground. The Night mark is oversized and cropped at the top-right (~78% of the width). Mono URL top-left, 56px headline bottom-left with a max width of 62%.

## Assets
- `assets/chronon-mark-night.svg`: Night ink, Photon core (for light grounds)
- `assets/chronon-mark-paper.svg`: Paper ink, Photon core (for dark grounds)
- `assets/chronon-mark-mono.svg`: one-colour Night
- `assets/chronon-app-icon.svg`: Night rounded square, mark at 72%
- `tokens.css`: CSS custom properties for every colour, font and radius above

Placeholder copy in the reference (domain `chronon.dev`, sample headlines and endpoints) is illustrative only.

## Files
- `reference/Chronon Brand.dc.html` + `reference/support.js`: the full brand sheet
- `assets/*.svg`, `tokens.css`: ready-to-use assets
