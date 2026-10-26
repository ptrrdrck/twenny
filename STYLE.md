# Twenny style guide

Twenny is styled like the Nado Waves forecast page: the page that
github.com/ptrrdrck/nado-waves-forecast publishes (`index.html` there, built from
`app/forecast.html` in the private nado-waves repo). Everything below was taken from
that page on 2026-10-26. The tokens are in `css/theme.css`; the components, copied as
written, are the first block of `css/app.css`. Use them; don't invent new ones unless a
Twenny-only element needs it, and then mark it Twenny-only.

(An earlier version of this file described an older Nado Waves theme, with a teal action
colour, chips and one card per screen. That theme is retired; don't bring it back.)

## Fonts

Archivo for body text and Barlow Condensed for labels, tabs and the talk button, both
self-hosted in `fonts/` so the app works offline.

- Body: `400 17px/1.5 Archivo, system-ui, -apple-system, "Segoe UI", sans-serif`
- Barlow Condensed is always uppercase with letter-spacing, except `h1`
- Numbers that line up use `font-variant-numeric: tabular-nums`

## Colour tokens

Light is the default. Dark follows the system, and `data-theme="light"` / `"dark"` on
`<html>` forces either.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#EAEEEC` | `#0E1A20` | page backdrop |
| `--card` | `#F6F8F7` | `#152630` | cards, the tab track |
| `--ink` | `#16232B` | `#E4ECE9` | text, values |
| `--soft` | `#53656E` | `#9DB0B7` | supporting lines, labels |
| `--faint` | `#7C8C93` | `#7A8D95` | tags, the least important text |
| `--line` / `--line-strong` | `#CBD5D1` / `#AFBDB8` | `#283C46` / `#3A525E` | rules, borders |
| `--surf` / `--surf-ink` | `#1565C0` / `#FFF` | `#6FB3F7` / `#08203A` | the one action colour (blue): selected tab, links, focus ring |
| `--surf-wash` | `#DCE7F7` | `#12283D` | blue wash (the map's empty sea) |
| `--signal` / `--signal-wash` | `#C62828` / `#F9DEDE` | `#FF6B6B` / `#3A1C1C` | warnings only |
| `--dot-ok` / `--dot-over` | `#5FBF86` / `#FF6B6B` | same | status dots, both themes |
| `--sand`, `--sand-deep`, `--ok` | | | kept from the forecast page; Twenny doesn't use them yet |

`--shadow` and `--r: 10px` as in `theme.css`.

Twenny-only tokens:
- `--pin` / `--pin-ink` (`#E0A800` / `#16232B`, dark `#FFC61A` / `#06222A`): the fix itself.
  Only the map pin and the talk button while listening.
- `--tile-filter`: dims the bright OSM tiles in dark mode.
- `--dock-h`: height of the sticky talk bar.

## Layout

- Body `padding: 0 16px 48px`; `.wrap` is one column, `max-width: 560px`, `gap: 18px`.
- `header`: column, `gap: 9px`, a `--line` rule under it; `.head-top` puts the title and
  one action on a line.
- Phone-first. Twenny's tap targets are at least 44 px (36 px for small secondary buttons).
- The talk button is sticky at the bottom, padded with `env(safe-area-inset-bottom)`.

## Components (forecast page)

- **`.cond` card**: the unit of the page, several stacked. A small `.lbl` (12.5 px) on top,
  the value `.val` (19 px, 600), supporting lines `.turn` (13.5 px, `--soft`, key words in
  `<b>` ink), then provenance `.srcs`.
- **`.lbl`**: Barlow Condensed 600, uppercase, `.09em`, 14 px, `--soft`.
- **`.tabs`**: segmented control; the selected segment is solid `--surf` with `--surf-ink`,
  Barlow uppercase. Twenny's talk button is this look, as one big segment.
- **Pills** (`.pills`, `.pill`, `.pill-tail`): 12 px provenance chips on `--paper`; each
  `.pill-tail` grows out of the one before. Status dot `.status` (7 px, `--dot-ok`),
  `.status.due` blinks, `.status.over` is red.
- **Fold** (`.chart-head` + `.calc-toggle`): a line that opens a section, the whole line
  tappable, a chevron that points up when closed and down when open.
- **`.trains` / `.train`**: rows of figures, tabular, with an 11 px uppercase `.tag`.
- **`.rows` / `.row`**: a list with `.who` and an `.amt` on the right.
- **`.stale`**: loud warning, `--signal-wash` with a `--signal` border, above what it
  qualifies, a `<b>` lead in `--signal`.
- **`.warn`**: quiet note in greys with a `--line-strong` border and a warning triangle.
- **`.links`**: footer row, 13 px, rule above; settings live here (`select`, checkbox).
- `select`: 14 px, 8 px radius, `--line-strong` border on `--card`.

## How Twenny uses them

- Header: `h1` "Twenny", "Use my location" as a link, the GPS state as pills
  (on `--card` there, since the header sits on the backdrop).
- Heard: a `.cond` with the transcript box (21 px for sun), the parse line with a status
  dot, and the "Assume N & W" checkbox.
- Map: a bordered, rounded, shadowed box.
- Fix: a `.cond`; the landmark line is its value (22 px for sun), the line from you a
  `.turn`, the three formats `.train` rows (17 px), the format heard as pills, then
  Apple Maps / Google Maps / Copy buttons (`.btn`, after the forecast's gate buttons).
  A far-off fix shows `.stale`.
- Recent fixes: a fold on the backdrop, like the forecast's Briefing, with `.row`s inside.
- Footer `.links`: theme, version, map credit.
- Talk button: the selected-tab look, sticky, `--pin` while listening.

## Feel

Calm, plain, field tool. Greys and ink with one blue for action; red only for warnings.
Labels short and uppercase; body copy plain and direct. Respect
`prefers-reduced-motion`.
