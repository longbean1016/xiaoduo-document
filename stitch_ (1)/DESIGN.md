---
name: Writing Studio
colors:
  surface: '#f7faf4'
  surface-dim: '#d8dbd5'
  surface-bright: '#f7faf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f5ee'
  surface-container: '#ecefe8'
  surface-container-high: '#e6e9e3'
  surface-container-highest: '#e0e3dd'
  on-surface: '#191d19'
  on-surface-variant: '#3f4946'
  inverse-surface: '#2d312d'
  inverse-on-surface: '#eff2eb'
  outline: '#6f7976'
  outline-variant: '#bfc9c4'
  surface-tint: '#21695b'
  primary: '#004d41'
  on-primary: '#ffffff'
  primary-container: '#1d6658'
  on-primary-container: '#9ce1cf'
  inverse-primary: '#8fd4c2'
  secondary: '#34675c'
  on-secondary: '#ffffff'
  secondary-container: '#b5ebdd'
  on-secondary-container: '#396c61'
  tertiary: '#3b4642'
  on-tertiary: '#ffffff'
  tertiary-container: '#535d59'
  on-tertiary-container: '#cbd6d1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#aaf0de'
  primary-fixed-dim: '#8fd4c2'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#005144'
  secondary-fixed: '#b8eddf'
  secondary-fixed-dim: '#9cd1c4'
  on-secondary-fixed: '#00201b'
  on-secondary-fixed-variant: '#1a4f45'
  tertiary-fixed: '#dae5e0'
  tertiary-fixed-dim: '#bec9c4'
  on-tertiary-fixed: '#141d1b'
  on-tertiary-fixed-variant: '#3f4946'
  background: '#f7faf4'
  on-background: '#191d19'
  surface-variant: '#e0e3dd'
typography:
  headline-xl:
    fontFamily: Noto Serif
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 52px
    letterSpacing: -0.01em
  headline-xl-mobile:
    fontFamily: Noto Serif
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 38px
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Noto Serif
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Noto Serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.12em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.14em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system embodies the essence of an introspective, serene editorial writing sanctuary. Inspired by physical stationery, hand-bound manuscript pads, archival folders, and layered desks, it strikes a balance between tactile physical stationery and contemporary digital clarity.

### Target Audience & Mindset
- Authors, essayists, long-form bloggers, thinkers, and thoughtful knowledge workers.
- The UI evokes quiet concentration, tactile warmth, safety from cognitive overload, and reverence for words.

### Design Movement
- **Editorial Design + Tactile Paper Collage:** Combines classical typographic restraint, layered warm paper sheets, washi-tape-style delicate tags, and fine hairline borders that mimic subtle paper creases and stationery bookbinding.
- **Atmosphere:** Deep forest greens grounding pale, unbleached manuscript tones, accompanied by expansive breathing room and organic visual order.

## Colors

The color palette is derived directly from traditional botanicals, fountain pen inks, and aged acid-free craft paper.

### Palette Architecture
- **Primary (`#1D6658`)**: Forest Green. Anchor for primary actions, active navigation states, brand icons, and prominent interactive markers.
- **Secondary (`#174D43`)**: Deep Pine Green. Used for pressed states, split-screen hero panels, login cover backdrops, and heavy branding blocks.
- **Tertiary / Soft Tint (`#E5F0EB`)**: Mint Fog / Pale Paper Tint. Applied to soft selection states, active menu item chips, badge backgrounds, and subtle highlight callouts.
- **Paper Canvas (`#F5F7F4`)**: Desk Backdrop. A cool-tinted neutral stone tone that provides gentle relief behind the warm manuscript layers.
- **Primary Paper (`#FFFCF5`)**: Cream Manuscript. The primary card, editor writing surface, and modal body background. Emulates high-grade rice paper / warm vellum.
- **Secondary Paper (`#F4EFE5`)**: Warm Parchment. Secondary index cards, sidebar containers, sticky note accents, and nested drawers.
- **Typography - Ink Primary (`#292D29`)**: Sumi Ink. High-contrast, warm dark grey for headings, primary reading text, and strong borders. Avoids harsh pure black `#000000`.
- **Typography - Ink Secondary (`#89877F`)**: Mineral Grey. Used for meta-information, dates, secondary labels, disabled hints, and placeholder text.

## Typography

The typographical system establishes an editorial rhythm:
- **Headlines (`Noto Serif` / Songti style)**: Classical, literary, and introspective. Editorial article titles and statement headers use relaxed tracking and generous leading to allow phrases to resonate like book titles.
- **Body & UI Controls (`Noto Sans` / Heiti style)**: Clean, neutral, high-legibility sans-serif for comfortable long-form editing, structured metadata tables, inputs, and functional UI labels.
- **Metadata Badges & Category Labels (`Inter`)**: All-caps with generous letter-spacing (`0.08em` to `0.14em`) to establish archival cataloging notes reminiscent of book spines and index tags.

## Layout & Spacing

The layout is built around deliberate whitespace and paper sheet containment.

### Structure & Layout Philosophy
- **Split Desk Viewport:** Desktop views support asymmetric splits (e.g., Deep Pine `#174D43` on the hero/statement flank, balanced against warm cream `#FFFCF5` work surfaces on the main interactives).
- **Navigation Dock:** Left sidebar fixed at 240px with generous vertical rhythm, allowing ample negative margin around navigation sections.
- **Fluid Grid Canvas:** Work areas dynamically scale across a 12-column grid with a maximum content reading width of `1120px` to maintain optimal line-lengths (60–75 CJK characters).
- **Breakpoints**:
  - `Mobile (< 768px)`: Navigation docks collapse into an off-canvas drawer; margins tighten to `1rem`; tables reflow to single stacked cards.
  - `Tablet (768px - 1024px)`: Sidebar collapses to icon mode; margin set to `1.5rem`.
  - `Desktop (> 1024px)`: Full persistent sidebar, explicit column metrics, full grid gutters at `1.5rem`.

## Elevation & Depth

Visual hierarchy uses tactile paper overlapping and subtle ambient diffusion rather than standard high-contrast elevation drops.

### Elevation Principles
- **Flat Paper Bedding (Level 0):** Main app surface sits flat on `#F5F7F4` with hair-thin borders (`1px solid #EBE7DD`).
- **Floating Manuscripts (Level 1):** Main document sheets (`#FFFCF5`) use an ultra-diffused, warm shadow:
  - `box-shadow: 0 2px 8px -2px rgba(41, 45, 41, 0.04), 0 1px 3px 0 rgba(41, 45, 41, 0.02);`
  - Subtle `1px solid rgba(41, 45, 41, 0.06)` outline for edge distinction.
- **Collage Note Cards / Overlays (Level 2):** Flyout drawers, action popovers, and sticky notes:
  - `box-shadow: 0 12px 24px -6px rgba(29, 102, 88, 0.08), 0 4px 10px -2px rgba(41, 45, 41, 0.04);`
- **Washi Tape & Clip Details:** Accents, pinned ribbons, or active status indicators maintain flat positioning without inner inset bevels, preserving a refined stationery look.

## Shapes

The shape system emphasizes architectural neatness and bookbinding craftsmanship, using a Soft (`roundedness: 1`) baseline.

- **Base Radius (0.25rem / 4px):** Form inputs, table action buttons, document row items, and table cells. Retains crisp, sheared paper corners.
- **Medium Radius (0.5rem / 8px):** Manuscript writing cards, modal frames, and preview sheets.
- **Accent Radius (0.75rem / 12px):** Floating toolbars and secondary panels.
- **Pill Tags (Full / 9999px):** Exclusively reserved for status chips (e.g., "已撤回", "草稿", "已发布") and rounded pill toggle pills to contrast against linear document layouts.

## Components

### Buttons
- **Primary (`Solid Forest`):** Background `#1D6658`, text `#FFFCF5`, border `none`, border-radius `4px`. Hover state: `#174D43`. Focus: ring with 2px offset in `#E5F0EB`.
- **Secondary (`Paper Outline`):** Background `#FFFCF5`, border `1px solid #D8D4C8`, text `#292D29`. Hover: background `#F4EFE5`, border-color `#1D6658`.
- **Ghost / Tertiary:** Background transparent, text `#89877F`. Hover: background `#E5F0EB`, text `#1D6658`.
- **Icon Buttons:** Uniform 32x32px or 36x36px squares with soft `4px` rounding, minimal iconography, stroke width `1.5px`.

### Inputs & Text Areas
- **Surface:** Background `#FFFCF5`, border `1px solid #DCD7CB`, text `#292D29`, font-family `Noto Sans`.
- **Focus State:** Border color `#1D6658`, subtle shadow `0 0 0 3px #E5F0EB`.
- **Labels:** Uppercase `Inter` tracking `0.1em`, color `#89877F`, size `11px`, placed 6px above inputs.

### Chips & Badges
- **Status Tags (Washi Tape style):**
  - *Draft / 草稿:* Background `#F4EFE5`, text `#89877F`, border `1px dashed #D3CDC0`.
  - *Published / 已发布:* Background `#E5F0EB`, text `#1D6658`, border `1px solid #C4DFD4`.
  - *Archived / 已撤回:* Background `#F5F7F4`, text `#89877F`, border `1px solid #E1DCD3`.
- **Segmented Control Switchers:** Enclosed container in `#F4EFE5` with `4px` rounding; active tab sits elevated on `#FFFCF5` with a subtle hairline shadow.

### Document Lists & Tables
- **Rows:** Border-bottom `1px solid #EFEAE0`. Row padding `16px 20px`.
- **Interactivity:** Subtle hover tint to `#FAF8F1`.
- **List Icons:** Document sheet glyphs rendered in delicate 1.25px stroke weights in `#89877F`.
- **Title Block:** `Noto Serif` titles at `15px` medium weight with secondary excerpts below in `#89877F` `13px`.

### Studio Workspace Cards
- **Overview Metric Cards:** Cream surface `#FFFCF5`, border `1px solid #ECE7DC`. Large stat counter rendered in `Noto Serif` (`32px`), paired with small uppercase `Inter` metadata headers.
- **Paper Split Hero:** Asymmetrical vertical brand hero panel in `#174D43` paired with clear paper white `#FFFCF5` workspace blocks.