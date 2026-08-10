# Design

<!-- impeccable:design-schema 1 · seed d32a5c18 · world: 单色文档工作台 (monochrome document desk) -->

## Direction Seed

`d32a5c18` · mode `operate` · chosen: **单色文档工作台（黑白灰极简）** · 用户指定
THESIS: 学习从零开始——把个人学习工作台收敛为一张白纸上的黑字灰阶，去除一切装饰，让「今天该做什么」一眼可见。

## Visual World

A quiet monochrome document desk. The user opens the app to a blank white surface where ink-black text and a disciplined gray scale carry all hierarchy. No color anywhere in the chrome: no brand hue, no urgency red, no status green — state is expressed by weight, depth of gray, and structure. The aesthetic is **white paper, black ink, gray scale** — committed across navigation, content, controls, and states. No gradients, no decorative shadows, no glass, no emoji in the chrome, no stamps, no call numbers.

## Brand

- **Name**: 零 · Zero
- **Mark**: ○ (a simple ring / the zero glyph, set in the sidebar logo tile; mirrored as the app console-log mark)
- **Voice**: 简洁、克制、结构化；中文优先

## Palette (semantic tokens)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#fafafa` | App ground (near-white) |
| `--paper-2` | `#f4f4f4` | Sink / dropdown ground |
| `--paper-3` | `#ededed` | Pressed surface |
| `--paper-card` | `#ffffff` | Card ground (pure white) |
| `--paper-hover` | `#f7f7f7` | Card hover |
| `--paper-sunk` | `#ececec` | Sunk / track ground |
| `--ink` | `#111111` | Body text, headings, primary accent |
| `--ink-2` | `#555555` | Secondary text |
| `--ink-3` | `#8a8a8a` | Tertiary / labels |
| `--ink-faint` | `#b0b0b0` | Placeholder / disabled |
| `--drawer` | `#f4f4f4` | Sidebar ground |
| `--drawer-2` | `#ececec` | Sidebar sink |
| `--drawer-3` | `#dedede` | Sidebar hairline |
| `--drawer-deep` | `#9a9a9a` | Group labels |
| `--rule` | `#d9d9d9` | Hairline rule (cards, dividers) |
| `--rule-2` | `#e9e9e9` | Soft rule |
| `--rule-thin` | `rgba(17,17,17,0.10)` | Dashed dividers |
| `--stamp-blue` / `--stamp-red` | `#111111` | Legacy aliases, all black (kept for compatibility) |
| `--typewriter` | `#666666` | Tag / label mid-tone |
| `--success` | `#333333` | Done state (gray) |
| `--warning` / `--danger` | `#111111` | Warning / danger (black) |

Palette policy: **zero chroma**. Gray scale only. Priority / status differentiation uses weight (700) and gray depth, never color. One accent — black.

## Themes

Three theme modes, switchable in Settings (`设置 → 界面主题`), persisted in localStorage `zero_theme`, applied via `<html data-theme>` (default **dark / 纯黑**):

- **dark (default)**: pure-black ground `#000`, white ink `#fff`, dark gray steps; course swatches are light grays (`--course-1..8: #ffffff…#808080`).
- **light**: near-white ground `#fafafa`, black ink `#111`, light gray steps; course swatches are dark grays (`--course-1..8: #111111…#9a9a9a`).
- **custom**: user-defined colors, picked in the settings panel (`背景色 / 卡片色 / 侧栏色 / 文字色 / 强调色 / 边框色`), persisted in localStorage `zero_custom_colors`, applied as inline CSS variables on `<html>` (highest precedence). Derived gray steps (`--paper-2/3`, `--ink-2/3`, `--fill*`, etc.) are auto-computed from the six base colors via a lightness `shade()` helper so the custom scheme stays coherent.

All chrome, charts, and inline colors reference CSS variables (`var(--ink)`, `var(--course-N)`), so switching themes recolors the entire surface instantly with no re-render. Charts.js consumes `var()` tokens for grid, axis, and point colors.

## Typography

| Token | Stack | Role |
|---|---|---|
| `--font` | `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif` | Everything |
| `--font-mono` | `"SF Mono", Consolas, monospace` | Labels, timestamps, numbers, system text |

- **Single UI family** (sans); serif removed from the system entirely.
- **Fixed scale**, step ratio ~1.20.
- **Tracking**: body 0, headings 0.01em, mono labels +0.5–1.5px uppercase.
- **Numerals**: tabular-nums on time, dates, GPA, focus minutes, day counts.

## Material & Components

- **Card**: white ground, 1px hairline `--rule`, 4px radius, near-invisible shadow. No corner call numbers, no side stripes.
- **Sidebar**: flat light-gray ground, hairline right rail, three text groups; active item lifts to a white card with a 2px black left rail and a trailing dot.
- **Top bar**: white ground with hairline bottom rule; search field; clock in mono; QR button is a 1.4px stroke line icon.
- **Buttons**: 6px radius, ghost has 1px border, primary is solid black with white text; press scales to 0.97. No gradients.
- **Charts**: SVG with black strokes, 1px hairline grid, mono tick labels.
- **Toast**: white card with 3px left rule in black (err / ok are gray variants).
- **Drop zone**: 1.5px dashed border in `--ink-faint`, paper ground.
- **States**: high priority = black + weight 700; mid = gray 555; low = gray 8a; done = struck-through gray. Urgent rows invert to black border + gray fill.

## Motion

- **Easing**: exponential ease-out `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`. No bounce.
- **Durations**: 160ms / 240ms / 360ms.
- **Reveal**: `viewIn` opacity + 8px translateY over 320ms; modal sheet-in 340ms.
- **Press**: scale 0.97–0.99, 80ms snap.
- **No orchestrated page-load sequence. No decorative loops.**
- **Reveal**: `viewIn` opacity + 16px translateY + scale(0.985) + 3px blur over 480ms; modal sheet-in 340ms.
- **Press**: scale 0.97–0.99, 80ms snap.
- **Nav active dot**: the trailing `·` indicator pops in (scale 0.2 → 1.35 → 1, 420ms ease-out).
- **Count-up**: hero stat numbers roll from 0 (easeOutCubic, 650ms).
- **Theme transition**: major surfaces blend background / border / color over 400ms when switching themes.
- **prefers-reduced-motion**: every animation collapses to 1ms.

## Iconography

Emoji remain only where the user types them (avatar picker, note content). The chrome is emoji-free: navigation is pure text; the only purpose-built icons are the QR line icon and the brand mark `○`. Functional glyphs kept: `☰` menu, `✕` close, `→` link, `✓` confirm, `✎` edit. The default user avatar is **no emoji** — it falls back to the nickname's first character; an emoji avatar only appears if the user picks one from the avatar picker.

## Composition

- **Top bar**: brand (left) · search (center-left) · clock (right).
- **Sidebar**: 248px, three text groups (工作台 / 学习资料 / 自我成长), active item lifts to a white card with a trailing dot indicator (no left rail).
- **Main area**: 28–32px gutters; cards in 3-column dash-grid (2-col ≤1200px, 1-col ≤900px); generous white space.
- **Hero**: greeting + four gray stat tiles (numbers count up on render), no decorations.

## Responsive

- **≥1200px**: 3-col dash-grid; sidebar visible; search 320px.
- **900–1199px**: 2-col dash-grid; search 240px.
- **560–899px**: sidebar off-canvas overlay; menu button; single-col grids.
- **<560px**: clock and page-sub hide; hero stats full width.

## Browser surfaces

- `::selection`: black 8% tint.
- `caret-color`: black.
- `::-webkit-scrollbar`: 9px thumb in `--rule`, transparent track.
- `:focus-visible`: 2px solid black ring, 2px offset.

## Accessibility

- Body text contrast ≥ 4.5:1 (ink on white ≥ 16:1).
- Touch targets ≥ 36px on icon buttons, ≥ 32px on mini-buttons.
- Keyboard navigation, logical tab order, `:focus-visible` only.
- Reduced-motion and reduced-transparency respected.

## Verification

- Detector run after the build (`node .impeccable/scripts/detect.mjs --json index.html css/style.css`).
- Screenshots in `.impeccable/review/` (desktop.png, mobile.png); pixel check confirms <0.4% chroma on both.
- Direction contract seeded in `index.html` body comment (search for `impeccable:direction-contract`).

## What was preserved vs replaced

- **Preserved**: every JS file; all data schemas in localStorage; all functional behaviors; HTML structure (every id and class referenced by JS still present).
- **Replaced**: visual identity (palette → black/white/gray, type → single sans, removed serif/emoji/stamps/call numbers/gradients); brand name & mark (索引·⌖ → 零·○); chart palette; course/tag colors; AI assistant system-prompt brand name; nav and card-head emoji removed.
- **Incompatible old data**: existing localStorage entries with course/task colors from the previous palette keep their original hex until the user re-saves them. New entries use the gray palette. No migration script needed.
