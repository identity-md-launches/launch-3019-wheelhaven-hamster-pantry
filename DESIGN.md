# Wheelhaven design

Status: Active · 2026-11-06

## Overview

Wheelhaven: Hamster Pantry (仓鼠粮仓) is an original, bilingual crop strategy game for the Squeekchain community. A real hamster's accepted wheel passages grow carrots, broccoli and sunflower seeds; players manage dew, water and harvest crops, expand plots, and restore the watermill, seed library and beacon. It is a game using real wheel activity, not a statistics dashboard.

Visual character: a quiet botanical storybook. Warm paper backgrounds, deep forest ink, sage crop beds, golden harvest accents and a coral warning tone. A large editorial serif carries the brand and headings; a system sans carries everything else. All illustration is original inline SVG (`dist/art.mjs`); there are no external fonts, raster UI assets or animation libraries. The only raster file is the share image `dist/og-image.png`, rendered from the same SVG art.

The food patch (`#garden`) is the main interactive surface. The seed tray sits beside it on wide screens and below it on phones. Technical provenance lives in an optional evidence dialog, not the main flow.

## Interaction contract

- One planting experience: growth comes only from new, fresh, hardware-provenance accepted wheel passages reported by `https://api.squeekchain.com/v1/status`. `https://api.squeekchain.com/v1/economy/state` supplies a deterministic in-game season from the processed round. Sensor readings and settled records are presented as different stages.
- No mode switch, simulated steps, wallet connection, token spending, betting or monetary rewards.
- Nine plots, four unlocked at the start; three crops; watering; harvests; plot expansion; three improvements; the beacon is the win condition. An emergency seed prevents a soft lock.
- Counter resets and installation changes reanchor without inventing work. Stale, invalid and disconnected samples cannot grow plants.
- **One shared pantry for every tab** (`dist/store.mjs`). `localStorage["wheelhaven.v2.live"]` is the single source of truth and carries an integer `rev`. Every gameplay action and every feed refresh first adopts the newest valid stored pantry, applies the change to it, and writes it back with a higher revision. Telemetry is therefore always applied against the newest stored anchor, so the same wheel passages never grow crops twice. Idle tabs write nothing on refresh or `pagehide`; `pagehide` only retries a write that previously failed, and only if no newer revision is stored. Reset and import write a revision above anything stored, and other tabs adopt it through the `storage` event, on focus, on `visibilitychange` and before their next action. Invalid, tampered or older stored values are never adopted. Saves from before revisions existed load as revision 0.
- Portable JSON export/import and a confirmed reset. Imports are validated and rebuilt from an allowlist, and reanchor so old passages are not credited.

## Colors

Tokens live in `:root` in `dist/styles.css` (line 2). Hex is the canonical notation.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f8f6ed` | Page background |
| `--paper-dark` | `#eeecdf` | Recessed bands |
| `--cream` | `#fffdf5` | Dialogs and raised surfaces |
| `--ink` | `#264b3a` | Primary text, dark buttons, brand mark |
| `--muted` | `#5f6b57` | Secondary text, labels, captions (darkened from `#75826e` in this revision for contrast) |
| `--line` | `#dcded0` | Hairlines and section rules |
| `--leaf` | `#58815b` | Growth bars, running status |
| `--sage` | `#c5d3b9` | Crop beds and soft fills |
| `--gold` | `#d9aa49` | Harvest and season accents |
| `--coral` | `#b87e62` | Warm accent; `.button.danger` uses `#a2654d` for reset |

Component-level text colors on tinted surfaces: plot captions `#3f5634` on the empty-bed fill `#c9d4b9`; locked-plot caption `#4f6343` on `#e3e9d6`; seed card description and meta `#5a6652`; mode note `#56684f`; garden sign `#6d5f37` on `#eadfbd`; season note `#7a6a3f`. Focus ring: `3px solid #b47c3f`, offset 4px. The design-critic probe measured every rendered text pair at 4.5:1 or better (3:1 for large text) at 320, 390 and 1440 wide. There is no dark theme.

## Typography

- Families: `--serif` = Georgia, "Songti SC", "Noto Serif CJK SC", serif (brand, headings, numbers such as dew and indices). `--sans` = "Avenir Next", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif (body, controls, labels). No web fonts are loaded; the fallbacks render where those families are absent.
- Weights: 400 (body, headings), 500 (seed meta, plant names), 600 (labels).
- Scale: one seven-step scale in px, `12 · 14 · 18 · 22 · 28 · 36 · 52`. 12px is the floor for all text (labels, captions, meta); 14px is body and buttons; 18–28px are section and dialog headings and resource numbers; 36px is the phone hero; 52px is the desktop hero. The probe measured 5–6 distinct sizes per width.
- Body line-height 1.65; captions 1.35–1.5. Letter-spacing stays between 0 and 0.02em for text; the serif display headline runs slightly tight.
- Labels above section headings (`.eyebrow`) are sentence case, 12px, weight 600, `--muted`, not uppercase or tracked. Chinese labels are written in Chinese (`种子盘`, `收获笔记`), English in English.

## Layout

- `main` is centered at `max-width:1152px` with 28px side padding (21px under 760px, 17px under 440px). The header is 1256px wide with its own padding.
- `.game-layout` is a two-column grid: food patch `minmax(0,1fr)` plus a 310px seed tray (280px under 1000px), collapsing to one column under 760px with the tray below the patch.
- `.plot-grid` is always three equal columns, so the nine plots stay a 3×3 field even at 320 wide.
- The intro places headline and copy beside the hamster scene; on phones the scene shrinks beside the headline and the food patch begins inside the first 844px screen.
- `.restoration` buildings form a three-card row on desktop and stack on phones; `.journal` is a 240px label column plus entries, single column on phones.
- Breakpoints: `max-width:1000px`, `760px`, `440px`; `min-width:1500px` widens decoration. No horizontal scroll at 320, 390 or 1440 (probe and `test/browser-sync.mjs`).

## Elevation & Depth

Mostly flat paper with tonal layers. Each surface uses a border or a shadow, not both: cards and the seed tray use 1px borders in sage-grey; empty plots use a solid offset "soil" shadow (`0 5px 0 #aebf9d`) with an inset rim; the garden sign is bordered. Native `<dialog>` overlays use a soft drop shadow over the backdrop. The toast floats bottom-center.

## Shapes

Radii are small and varied by role: 7px buttons, 9–10px cards and seed cards, 12px seed tray, 16–17px garden scene and dialogs, round status dots, icon buttons and the language toggle. Locked plots use a dashed border to read as "not yet dug".

## Components

All in `dist/index.html`, `dist/app.mjs` (render functions) and `dist/styles.css`.

- **Header**: brand mark + serif wordmark + subtitle; nav of text buttons (`怎么玩 / How to play`, `真实数据 / Live evidence`, hidden under 760px where the footer has it) and the round language toggle (`EN` / `中文`).
- **Hamster scene**: `wheelArt(running)` with a status dot (`.status-dot`, `.muted`, `.running`) and a caption that states connecting, offline, resting or RPM.
- **Resources bar**: dew and harvest counts with icons; the `收获成熟作物 / Harvest ready crops` button shows a count badge and is disabled when nothing is ready.
- **Plot** (`.plot`): `empty-plot` (plant action caption), `planted-plot` (crop art stage 0–3, name, growth bar, watered mark), `ready-plot` (check bubble), `locked-plot` (dashed, expansion cost). Each has a full `aria-label`.
- **Seed card** (`.seed-card`): art, name, description, cost/passages/yield meta, `selected` state with tick and `aria-pressed`, `seed-locked` disabled state.
- **Building card**: index, requirement status, building art, description, build button with cost; `is-built` state.
- **Buttons**: `.button` (light), `.button.dark` (primary), `.button.danger` (reset), `.button.wide`, `.text-button`, `.icon-button`; all have `:focus-visible` rings.
- **Dialogs**: native `<dialog>` for plot details, help, evidence, save/import/reset, import confirmation, win and about; closed by the close button, Escape or backdrop click.
- **Toast**: `role="status"`, `aria-live="polite"` outcome messages.

## Responsive behavior

Under 1000px the tray narrows; under 760px the layout is one column, header evidence link hides, building cards stack and the hero shrinks to 36px; under 440px padding and plot gaps tighten. `prefers-reduced-motion: reduce` disables all animation and transitions.

## Do and don't

- Reuse the tokens and the seven-step type scale; do not add sizes below 12px or uppercase, tracked labels.
- Keep every surface to one of border or shadow.
- Keep crops and buildings as original SVG in `dist/art.mjs`; do not copy Squeekchain NFT art.
- Route every pantry change through `store.commit` or `store.replace`; never write the pantry key directly, and never write on `pagehide` from an idle tab.
