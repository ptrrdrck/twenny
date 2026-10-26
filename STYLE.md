# Twenny style guide

Twenny matches the look of Nado Waves (github.com/ptrrdrck/nado-waves, `app/beachlog.html` and `app/forecast.html`). Everything below was copied from that repo on 2026-10-25, so you don't need to open it. Use these tokens and patterns as written; don't invent new ones unless a Twenny-only element needs it.

## Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap">
```

- **Archivo** for body text, buttons, inputs: `400 17px/1.5 Archivo, system-ui, -apple-system, "Segoe UI", sans-serif`
- **Barlow Condensed** for headings, labels, table headers, the primary button. Always uppercase with letter-spacing, except h1.
- Numbers that line up use `font-variant-numeric: tabular-nums`.
- For offline use, self-host both fonts (woff2) instead of relying on Google Fonts.

## Color tokens

Light is the default. Dark follows the system setting, and `data-theme="light"` / `data-theme="dark"` on `<html>` forces either one.

```css
:root{
  --paper:#EAEEEC; --card:#F6F8F7; --ink:#16232B; --soft:#53656E; --faint:#7C8C93;
  --line:#CBD5D1; --line-strong:#AFBDB8;
  --surf:#0B7A8C; --surf-ink:#FFFFFF; --surf-wash:#DCEAEC;
  --sand:#D9C9A8; --sand-deep:#B9A47C;
  --signal:#C2462D; --signal-wash:#F5DED8;
  --ok:#2F7D4F;
  --shadow:0 1px 2px rgba(22,35,43,.08), 0 4px 14px rgba(22,35,43,.06);
  --r:10px;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#0E1A20; --card:#152630; --ink:#E4ECE9; --soft:#9DB0B7; --faint:#7A8D95;
    --line:#283C46; --line-strong:#3A525E;
    --surf:#3FB6C6; --surf-ink:#06222A; --surf-wash:#12333B;
    --sand:#8C7A55; --sand-deep:#A8935F;
    --signal:#E8705A; --signal-wash:#3A1F1A;
    --ok:#5FBF86;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 4px 14px rgba(0,0,0,.3);
    color-scheme: dark;
  }
}
:root[data-theme="dark"]{ /* same values as the dark block above */ color-scheme: dark; }
```

What each color means:
- `--paper` page background, `--card` raised surfaces, `--ink` text, `--soft` secondary text, `--faint` disabled/idle
- `--surf` (teal) is the action and selection color: primary button, selected chip, focus ring, links
- `--sand` / `--sand-deep` warm accents: side rule on notes, "pending" dots, bars
- `--signal` (red) is for warnings and errors only, never decoration
- `--ok` green for success states

### Twenny-only addition

Twenny adds one token for the fix itself, so the pin and the "listening" state stand out from Nado's teal:

```css
:root{ --pin:#E0A800; --pin-ink:#16232B; }
/* dark: --pin:#FFC61A; --pin-ink:#06222A; */
```

Use `--pin` only for the map pin/target and the talk button while it is listening. Everything else stays on Nado's palette.

## Layout

- Body: `padding: 0 16px 40px; margin: 0;` with `-webkit-text-size-adjust: 100%`
- One column: `.wrap { max-width: 540px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; padding-block: 18px 0 }`
- Sections are flex columns with `gap: 9px`. Use `gap`, not margins, between siblings.
- Header: column with `gap: 10px`, `border-bottom: 1px solid var(--line)`, `padding-bottom: 14px`
- Phone-first. Tap targets at least 44px tall (Nado uses 11px+ vertical padding at 17px text).

## Components

```css
*{box-sizing:border-box;touch-action:manipulation} /* no double-tap zoom, pinch still works */
[hidden]{display:none!important}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2.5px solid var(--surf);outline-offset:2px;border-radius:4px}

h1{font-family:"Barlow Condensed",Archivo,sans-serif;font-weight:700;font-size:34px;line-height:1.02;letter-spacing:.01em;margin:0;text-wrap:balance}

/* section labels, table headers, <summary> */
.lbl{font-family:"Barlow Condensed",Archivo,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.09em;font-size:15px;color:var(--soft)}

/* the one raised panel per screen */
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:16px}

/* main action */
.primary{background:var(--surf);color:var(--surf-ink);border:1px solid var(--surf);border-radius:var(--r);padding:16px;
  font-family:"Barlow Condensed",Archivo,sans-serif;font-weight:700;font-size:18px;text-transform:uppercase;letter-spacing:.07em;box-shadow:var(--shadow)}
.primary[disabled]{opacity:.45;cursor:not-allowed}

/* toggles and choices */
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:11px 14px;font-size:17px;font-weight:500;line-height:1.2;transition:background .12s,border-color .12s,color .12s}
.chip:hover{border-color:var(--line-strong)}
.chip[aria-pressed="true"]{background:var(--surf);border-color:var(--surf);color:var(--surf-ink);font-weight:600}
.chip.ghost{background:transparent;border-style:dashed;color:var(--soft)}

/* text-style button */
.mini{background:none;border:none;color:var(--surf);font-size:15px;font-weight:600;padding:2px 0;text-decoration:underline}

/* inputs sit on paper, not card */
input[type=text],input[type=number],textarea{font:inherit;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:var(--r);padding:12px 13px;width:100%}

/* small print and side notes */
.note{font-size:14.5px;line-height:1.5;color:var(--soft);margin:0}
.blind{font-size:12.5px;color:var(--soft);border-left:3px solid var(--sand-deep);padding:6px 0 6px 10px;margin:0}

/* status line with a dot */
.status{font-size:14px;color:var(--soft);display:flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:0 0 auto}
.dot.on{background:var(--ok)} .dot.pend{background:var(--sand-deep)} .dot.off{background:var(--signal)}

/* tables */
.tbl{width:100%;border-collapse:collapse;font-size:15px;font-variant-numeric:tabular-nums}
.tbl th{text-align:left;font-family:"Barlow Condensed",Archivo,sans-serif;text-transform:uppercase;letter-spacing:.07em;font-size:13.5px;color:var(--soft);font-weight:600;padding:6px 8px 6px 0;border-bottom:1px solid var(--line)}
.tbl td{padding:7px 8px 7px 0;border-bottom:1px solid var(--line)}

/* confirmation messages */
.toast{position:fixed;left:16px;right:16px;bottom:24px;margin:0 auto;max-width:508px;background:var(--ink);color:var(--paper);border-radius:var(--r);padding:11px 14px;font-size:15.5px;box-shadow:var(--shadow);z-index:9}

/* collapsible sections */
details{border-top:1px solid var(--line);padding-top:12px}
summary{cursor:pointer;font-family:"Barlow Condensed",Archivo,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:15px;font-weight:600;color:var(--soft)}

@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
```

## Feel

- Calm, plain, field-tool. Muted sea-glass greys with one teal action color.
- One card per screen at most; most content sits flat on paper, separated by thin lines.
- Labels are short, uppercase Barlow Condensed in `--soft`. Body copy is plain and direct.
- Warnings use `--signal` text or a `--signal` border, not big banners.
- Sticky primary action at the bottom when a form is on screen, padded with `env(safe-area-inset-bottom)`.
