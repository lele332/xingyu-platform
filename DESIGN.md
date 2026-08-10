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

Twelve theme options, switchable in Settings (`设置 → 界面主题`), persisted in localStorage `zero_theme`, applied via `<html data-theme>` (default **dark / 纯黑**):

- **dark (default)**: pure-black ground `#000`, white ink `#fff`, dark gray steps.
- **light**: near-white ground `#fafafa`, black ink `#111`, light gray steps.
- **ocean**: deep navy-blue ground, blue accent `#7fb2e8`.
- **forest**: deep green ground, green accent `#8fce9e`.
- **sepia**: warm cream ground, brown accent `#8a6d3b`.
- **purple**: deep violet ground `#150f22`, violet accent `#b48ce8`.
- **wine**: deep wine-red ground `#1a0f13`, rose accent `#e89ab0`.
- **dusk**: deep warm-orange ground `#1a1208`, amber accent `#e8a05a`.
- **mist**: light gray ground `#f1f1f1`, charcoal accent `#404040`.
- **mint**: pale green ground `#eef6f0`, green accent `#3f9e63`.
- **honey**: warm pale-yellow ground `#fcf7ea`, gold accent `#d99a2b`.
- **guishan**: misty karst palette — pale sage ground `#eef0ec`, ink-blue-gray accent `#4a6a75` (Guilin mist).
- **danxia**: red-rock palette — deep terracotta ground `#1c0f0a`, cinnabar accent `#d9563a` (Danxia landforms).
- **qingzang**: highland-blue palette — deep indigo ground `#0d1526`, plateau blue accent `#4a7bd0` (Qinghai-Tibet).
- **caoyuan**: grassland palette — deep green ground `#0d1a12`, prairie green accent `#5aa86a`.
- **damo**: desert palette — warm sand ground `#f4ead8`, gold accent `#c08a3e`.
- **custom**: user-defined colors, picked in the settings panel (`背景色 / 卡片色 / 侧栏色 / 文字色 / 强调色 / 边框色`), persisted in localStorage `zero_custom_colors`, applied as inline CSS variables on `<html>` (highest precedence). Derived gray steps are auto-computed from the six base colors via a lightness `shade()` helper.

Each preset defines its full token set (paper/ink/drawer/rule/accent + course swatches) so every theme stays coherent. All chrome, charts, and inline colors reference CSS variables (`var(--ink)`, `var(--course-N)`), so switching themes recolors the entire surface instantly with no re-render. Charts.js consumes `var()` tokens for grid, axis, and point colors.

## Photography Background

Optional China-landscape photography backdrop (`设置 → 界面背景`, localStorage `zero_bg`, `<html data-bg>`):
- `none` (default) · `guilin-mist` (misty karst peaks) · `guilin-aerial` (aerial of Guilin river) · `jiuzhaigou` (turquoise alpine lakes) · `zhangjiajie` (sandstone pillars).

Four photos are bundled locally in `assets/` (Pexels license, free to use). The photo layer sits under all chrome at low opacity (`0.22–0.3`), tinted by the active theme's ground color.

**Glass cards**: surfaces (`card`, `hero`, `quote`, `sidebar`, `topbar`, `modal`, list rows) use `color-mix(in srgb, var(--paper-card) 70–90%, transparent)` + `backdrop-filter: blur()` so the photography shows through softly while text stays readable. `prefers-reduced-transparency` restores solid grounds.

## Fonts & Language

- **Font** (`<html data-font>`, localStorage `zero_font`): `default` (system sans), `kai` (Kaiti / 楷书), `song` (Songti / 宋体), `fangsong` (仿宋), `hei` (Heiti / 黑体). Switches `--font` / `--font-mono`.
- **Language** (`<html data-lang>`, localStorage `zero_lang`): `zh` (简体), `zh-Hant` (繁體), `en`. UI chrome text goes through a lightweight i18n dictionary (`I18N` + `t(key)`, three dictionaries); static markup is tagged `data-i18n` and re-applied on switch; user data (notes, course names, news titles) is never translated.

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

### GSAP animation layer

Animations are orchestrated by **GSAP 3.12** (bundled locally at `assets/js/gsap.min.js` + `ScrollTrigger.min.js`) through a thin wrapper `js/anim.js` (`window.Anim`). If GSAP fails to load, every call falls back to the original CSS animation.

- **View enter**: fade + 24px rise + scale(0.985), `power3.out` 550ms.
- **Dashboard intro** (`dashboardIntro`, timeline): hero card rises & un-blurs → stat numbers roll in (`countUp`) → daily quote fades in → grid cards stagger up (80ms apart). The dashboard has its own choreographed opening instead of the generic view enter.
- **Count-up**: hero stats roll via `gsap.to` on a state object with `snap`, `power2.out` 900ms.
- **Modals / lock screen**: mask fades while the sheet scales up with `back.out`; close reverses, removes `.show` on complete.
- **Nav press**: elastic `back.out(2.6)` 450ms on click — the item scales while its icon pops with a slight rotation.
- **Quote swap**: text + category fade/rise 420ms.
- **Sidebar intro** (`sidebarIntro`): on load the brand fades in, then group labels and the 8 nav items slide in from the left (14px) in a staggered cascade (45ms apart).
- **Sidebar hover** (`initNav`): a light band sweeps across the item (`xPercent -130→130`, `power2.inOut` 750ms) and the icon pops on hover; desktop pointers only.
- **Card tilt + glow** (`initTilt`, desktop hover only): cards rotate toward the cursor via `gsap.quickTo` (`rotationX/Y`, ±5°, `transformPerspective: 900`). A `.card-glow` element (240px radial light) **tracks the cursor** — its center is eased to the pointer position via `quickTo` x/y, so the light follows wherever the mouse moves. Tweens are stored in a `WeakMap` and listeners bind once per card; only enabled when `(hover: hover) and (pointer: fine)`.
- **Button ripple** (`initRipple`): every `.btn` click spawns a `currentColor` ripple span that scales+fades (event delegation, works on dynamically created buttons).
- **Scroll reveal (ScrollTrigger)**: long lists (news items, note cards, literature rows, focus history) fade + rise as they enter the viewport (`start: top 94%`, `once: true`); triggers are killed on view switch.
- All tweens use transforms + `autoAlpha`, `clearProps` on complete; `overwrite: "auto"` for interruption; `prefers-reduced-motion` collapses to instant.

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
