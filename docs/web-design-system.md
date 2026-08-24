# Swiss web design system

## Communication objective

Present an auditable climate result before presenting the interface. The reading order is:
finding, evidence, annual context, method, data, reference. Interaction supports inspection; it
does not compete with the research narrative.

## Grid

| Viewport | Columns | Outer margin | Gutter | Baseline |
| --- | ---: | ---: | ---: | ---: |
| ≥ 1024 px | 12 | `clamp(32px, 5vw, 72px)` | `clamp(16px, 2vw, 28px)` | 8 px |
| 640–1023 px | 6 | 32 px | 20 px | 8 px |
| 320–639 px | 4 | 16 px | 12 px | 8 px |

All primary sections use the same grid tokens. The abstract uses columns 1–9, metric cards span
four columns each, Figure 1 divides 4/8, and reading copy stays within approximately 70
characters. Press `G` outside a text field to toggle the exact production grid overlay.

## Typography and colour

- Family: Arial with Helvetica Neue and system sans-serif fallbacks.
- Weights: regular and bold only.
- Scale: 12 px functional labels, 16 px body, 20–24 px lead, 36–80 px display.
- Paper: `#f4f3ef`; ink: `#111111`; muted: `#62615d`; rule: `#c9c7c0`.
- Accent: `#e1261c`, used for active state, sequence and the principal finding only.
- Scientific series retain blue/red because colour communicates the two comparison periods.

## Composition and interaction

The report is flush-left and asymmetrical. Rules divide semantic units. Geometric blocks label
sections or encode values; none are decorative. Sections reveal once with a short fade and
8 px rise. Content is visible by default, immediately visible with reduced motion, and never
removed from document flow.

## Responsive behaviour

Desktop relationships recompose to six columns on tablets and four columns on phones. On phones,
metadata precedes the title, findings become a single sequence, captions precede charts, and the
timeline is horizontally scrollable inside a labelled figure rather than widening the page.
Navigation retains the report identity and Code action. All controls meet a 44 px touch target.

## Accessibility and provenance

Semantic landmarks and heading order are preserved. Focus is visible, charts have accessible
names, colour is paired with position and labels, and reduced-motion preferences are honoured.
The site uses no photographic assets. The GitHub mark is an inline vector derived from GitHub's
public mark and links directly to the source repository. Code is MIT licensed; observations are
attributed to MeteoSwiss.
