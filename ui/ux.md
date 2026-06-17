# Urban Bears — UI/UX Specifications

## Text Color

- **All text must be fully white.** Body text, labels, meta info, placeholders, footer copy, and all other UI text must use `#ffffff` or `var(--white)` at full opacity.
- **No grey text — including via opacity.** Do not dim text by setting `opacity` below `1` on text elements. This includes card metadata, section labels, archive stats, footer, hero subtitles, and any other readable copy.
- Opacity-based dimming is only allowed on **non-text decorative elements** (e.g., icon SVGs, borders, backgrounds).
- Hover/active interaction states may use opacity transitions on whole elements (e.g., a card fading slightly on hover), but the *default resting state* of all text must be full white.
- This rule applies everywhere: `css/base.css`, `css/index.css`, inline styles, and per-page `<style>` blocks.

## Button Hover Effects

- **Fill from the side** (slide-in fill): Buttons use a `::before` pseudo-element that slides in from the left (`translateX(-100%)` → `translateX(0)`) on hover, filling the button with a solid color. The text color transitions simultaneously to contrast against the fill. This matches the `.btn-donate` pattern exactly.
- **Scale, not lift**: On hover, buttons and interactive controls scale up slightly (`transform: scale(1.05)`) rather than translating upward (`translateY`). No lift/float effects on buttons.
- **Toggle/tab active state**: The active tab is fully filled (solid `var(--lavender-bg)` background, `var(--navy)` text) — inverted from the default transparent/white style. Inactive tabs show a subtle fill on hover.
