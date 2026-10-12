# SmartCare — design.md

**Purpose:** a build-ready design specification for the SmartCare website (public showcase + caregiver dashboard + patient SOS screen).
**Audience:** the developer (or AI coding agent) building the frontend.
**Companion doc:** `SmartCare_Documentation.md` (features, API, database). This file covers how it looks, moves, reads, and is built.
**Stack assumed:** React + Vite, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts, React Bits (copied as source), native WebSocket.

> Persistent rule for every screen: SmartCare is a prototype. It shows simulated, replayed, or manually entered data and does not diagnose, predict, or guarantee help. This must be visible at all times (see §12 Disclaimer strip).

---

## 0. How to use this file

1. Read §1–§3 once. They set the decisions everything else follows.
2. Paste the tokens in §4 into `src/index.css` before writing any component. Do not hard-code hex values in components.
3. Build in the order in §17 (milestones). Each milestone has acceptance checks.
4. Use §9 (React Bits map) as the **only** list of animation components. If something is not on the list, build it plain.
5. When a spec says "reduced motion", it is mandatory, not optional.

---

## 1. Design brief

| Item | Decision |
|---|---|
| **Subject** | Health-monitoring and emergency-coordination prototype for elderly care |
| **Primary users** | Caregivers (family or care staff) on desktop and phone; the person being monitored (SOS only) |
| **Secondary audience** | Hackathon judges, reviewers, and clients watching a demo |
| **Primary job of the product UI** | Show who needs attention right now, why, and who is already handling it |
| **Primary job of the public site** | Let a reviewer understand the full monitor → alert → respond → escalate loop in under two minutes, by touching it |
| **Tone** | Calm, plain, precise. Never alarmist except for a real SOS state |
| **The one memorable thing** | A live heart-rate trace in the hero that crosses a limit, explains itself in a sentence, and shows a caregiver claiming the alert. Everything else stays quiet |

### 1.1 Design principles

1. **Explain, don't decorate.** Every alert says why it fired in one plain sentence.
2. **Never imply safety.** Missing or old data is its own visible state, never "normal".
3. **Calm by default, loud only for emergencies.** Color saturation and motion are reserved for SOS and unacknowledged alerts.
4. **Legible for tired, stressed, or older eyes.** Large type, high contrast, big targets, no color-only meaning.
5. **Provenance is always visible.** Each reading shows its source: simulated, dataset replay, manual, or device.
6. **Spend boldness in one place.** The hero trace. Everything else is disciplined.

---

## 2. What was taken from the three references (and what was not)

### 2.1 Visme — website color schemes
The article is a catalogue of 50 palettes from Awwwards-recognised sites plus an FAQ. What I used:

| Visme guidance | How SmartCare applies it |
|---|---|
| Three-color rule: one main, one complementary, one accent; 3–5 colors total | Main = Deep Tide (dark teal-navy). Complementary = Mist (cool light gray). Accent = Lagoon (teal). Status colors are a separate, functional set |
| Calming health palettes use soft blues, greens, and neutrals; light creamy grays for calm backgrounds | Cool Mist background and teal accent. I chose a cool gray rather than cream on purpose (see §3) |
| Trust = blue/teal with neutral support | Lagoon teal + Deep Tide as the brand pair |
| Most legible: dark text on light backgrounds with strong contrast | App defaults to light mode, dark text, ≥ 7:1 for body |
| A bright accent guides the eye to the CTA (their "Effective accent colors" example) | One signal coral is reserved for the alert moment and SOS. It is never used decoratively |
| Palettes cited as inspiration: "Cool and Collected" (deep teals), "Clean and Modern" (myrtle green/keppel on near-white), "Close to Nature" (greens + blues for stability), "Mechanical and Floaty" (near-black text on light gray with one bright blue accent) | The hero's dark-teal field and the app's near-black-on-cool-gray structure come from these |

### 2.2 Awwwards — Sites of the Month
The page I could read gives titles, award tags, technology filters, and font names, not screenshots or source. So I only claim these patterns:

- Winners are built around **scroll-driven storytelling and bespoke interaction**. I use one scroll-stacked sequence (§6.2, section 2) because the product really is a sequence.
- The technology filters show **GSAP, Motion, Three.js, and WebGL** as common. I use GSAP/Motion-style motion where React Bits provides it and **avoid WebGL on the dashboard** (distraction + battery cost for an always-open monitoring screen).
- Typography is a recurring theme in the filters and font lists (Aeonik, Canela, Editorial New, and similar). Those are commercial. I picked **free, licensed-for-web fonts** with a similar sense of intent (§4.2).
- Tags like **Microinteractions** and **Data Visualization** inform the dashboard: motion should answer a person's action (claim, confirm, escalate), not play on a loop.

### 2.3 React Bits — animated components
Components install as source you own (CLI: `npx shadcn@latest add @react-bits/<Name>-<JS|TS>-<CSS|TW>`). Full selection is in §9. Selection rule: **use a component only if it maps to a real SmartCare behavior.** Examples: `Hold Button` for SOS, `Call Chip` for notification attempts, `Scrub Field` for threshold limits, `Scroll Stack` for the alert-to-escalation sequence, `Crosshair` for chart scrubbing.

### 2.4 Deliberately rejected
- Cream background + serif + terracotta accent, and near-black + acid-green. Both read as templates.
- Identical rounded cards with the same soft shadow everywhere. Radius and elevation here follow hierarchy (§4.5).
- All-caps eyebrow labels above every heading, "01 / 02 / 03" numbering on non-sequences, one accented word in headlines.
- WebGL backgrounds (Aurora, Plasma, Galaxy, etc.) on the dashboard. Pretty, but wrong for a monitoring screen.

---

## 3. Design plan review (the check before building)

| Plan element | Generic default I avoided | Choice made for SmartCare |
|---|---|---|
| Background | Cream (#F4F1EA) | Cool Mist #F2F6F6 + deep teal-navy for the hero |
| Display type | High-contrast serif | Bricolage Grotesque (variable sans with character) |
| Body type | Inter | Atkinson Hyperlegible Next, designed for low-vision legibility, which matters for this audience |
| Accent | Terracotta or acid green | Teal for brand; coral only for emergencies |
| Hero | Big number + gradient stat row | A live, interactive trend line that triggers a real alert explanation |
| Cards | Identical rounded cards in a grid | Hierarchy: border-only panels, tinted status surfaces, one elevated drawer |
| Motion | Fade-up on every section | One orchestrated hero sequence; everything else responds to user action |
| Labels | Small monospace/all-caps tags | Sentence-case labels; icons + words for status |

---

## 4. Design tokens

### 4.1 Color

**Brand and neutrals (light theme = default)**

| Token | Hex | Use |
|---|---|---|
| `--ink` Deep Tide | `#0E2A33` | Primary text, dark surfaces |
| `--bg` Mist | `#F2F6F6` | Page background |
| `--surface` | `#FFFFFF` | Panels, inputs |
| `--surface-2` | `#E4ECEE` | Subtle fills, table stripes |
| `--border` | `#C9D6D9` | Decorative dividers |
| `--border-strong` | `#7E959B` | Input and control borders (≥ 3:1 on white) |
| `--text` | `#0E2A33` | Body text |
| `--text-muted` | `#4A6169` | Secondary text (≈ 6.5:1 on white) |
| `--brand` Lagoon | `#0F7C86` | Links, primary buttons, focus ring (≈ 4.9:1 on white) |
| `--brand-hover` | `#0B646C` | Hover/pressed |
| `--brand-tint` | `#D5ECEE` | Selected rows, soft highlights |

**Dark theme (hero, optional app dark mode)**

| Token | Hex |
|---|---|
| `--bg` | `#0A1C22` |
| `--surface` | `#11303A` |
| `--surface-2` | `#18404B` |
| `--border` | `#2C5360` |
| `--text` | `#E8F3F4` |
| `--text-muted` | `#9DB8BE` |
| `--brand` (on dark) | `#5FD0D8` |
| `--signal` (on dark) | `#FF6B57` |

**Status colors — always paired with an icon and a word, never color alone**

| State | Foreground | Tint (background) | Solid fill | Icon | Meaning |
|---|---|---|---|---|---|
| Normal | `#14663F` | `#DDF1E5` | `#1B7F4B` | check-circle | Latest valid reading is within configured limits |
| Attention | `#7A4A00` | `#FDEBC8` | `#F2A900` (text `#0E2A33`) | alert-circle | Minor deviation or unusual change, or an unacknowledged alert nearing timeout |
| Alert | `#A31515` | `#FBDCDC` | `#C62828` (text `#FFFFFF`) | alert-triangle | Configured limit breached |
| SOS | — | — | `#C62828` + pulsing ring | siren | Help requested. Largest, loudest element on any screen |
| Unavailable | `#4A5D64` | `#E1E7E9` + diagonal hatch | — | wifi-off / clock | Stale, missing, or disconnected data. **Never** styled like Normal |

**Provenance chips**

| Source | Style |
|---|---|
| Simulated | Indigo `#4B3FA0` text on `#E9E6F7`, label "Simulated" |
| Dataset replay | Same indigo, label "Replay: <dataset name>" |
| Manual | Neutral outline, label "Manual entry" |
| Device | Neutral outline, label "Device" |

**Heatmap scale (color-blind-safe; each cell also carries a glyph)**

| Cell | Fill | Glyph |
|---|---|---|
| Within limits | `#BFE3D0` | none |
| Minor deviation | `#F5C65A` | small dot |
| Breach | `#C62828` | small triangle |
| No data | `#E1E7E9` + hatch | none |

### 4.2 Typography

| Role | Family | Notes |
|---|---|---|
| Display and headings | **Bricolage Grotesque** (variable: weight, width, optical size) | Headings 600; hero uses `wdth` ≈ 90 and tight tracking (-0.02em) |
| Body, UI, forms, numerals in tables | **Atkinson Hyperlegible Next** (fallback: Atkinson Hyperlegible) | Designed for low-vision readers |
| Fallback stack | `system-ui, -apple-system, "Segoe UI", sans-serif` | |

Both are Google Fonts under the SIL Open Font License. **Confirm the license and availability on Google Fonts / Fontsource before shipping.** Self-host via Fontsource (`@fontsource-variable/bricolage-grotesque`, `@fontsource/atkinson-hyperlegible-next`) to avoid layout shift from remote fonts.

**Type scale** (fluid; base 16 px, caregiver UI body is 17–18 px)

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `display` | `clamp(2.75rem, 6vw, 5.5rem)` | 1.02 | 600 | Hero headline only |
| `h1` | `clamp(2rem, 4vw, 3.25rem)` | 1.08 | 600 | Page titles |
| `h2` | `clamp(1.5rem, 2.6vw, 2.125rem)` | 1.15 | 600 | Section titles |
| `h3` | `1.25rem` | 1.3 | 600 | Panel titles |
| `body-lg` | `1.1875rem` | 1.55 | 400 | Landing paragraphs, patient SOS screen |
| `body` | `1.0625rem` | 1.55 | 400 | App default |
| `small` | `0.9375rem` | 1.45 | 400 | Timestamps, helper text. **Never below 15 px** |
| `vital` | `clamp(3.5rem, 7vw, 5rem)` | 1 | 600 | Heart rate and temperature numerals |

Rules: line length ≤ 68 characters; sentence case everywhere; left-aligned text (no justified, centered only for single-line empty states); use `font-variant-numeric: tabular-nums` on all readings and verify digits do not jitter as values change (if they do, render numerals in Atkinson).

### 4.3 Spacing and layout

- Base unit 4 px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- App content max width 1440 px; landing content max width 1200 px; text blocks max 68ch.
- Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.
- Touch targets: minimum 44 × 44 px in the caregiver app; 56 px minimum on the patient SOS screen.

### 4.4 Z-index

`base 0 · sticky header 20 · drawer 40 · modal 50 · toast 60 · disclaimer strip 70` (the strip never hides behind anything except a full-screen SOS takeover, where it stays visible too).

### 4.5 Radius and elevation (by role, not one value everywhere)

| Element | Radius | Elevation |
|---|---|---|
| Inputs, buttons | 8 px | none; 1.5 px `--border-strong` outline |
| Panels | 16 px | none; 1 px `--border` and a background step |
| Status chips | 999 px | none |
| SOS button | circle | 6 px ring + inner shadow |
| Drawer (desktop) | 0 on the attached edge, 24 px on the free corners | tinted shadow `0 24px 48px -12px rgb(14 42 51 / 0.28)` |
| Drawer (mobile bottom sheet) | 24 px top corners | same shadow |
| Charts | 0 (plot area), 12 px (container) | none |

### 4.6 Motion tokens

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--dur-fast` | 120 ms (hover, press) |
| `--dur-base` | 220 ms (panel state change) |
| `--dur-slow` | 420 ms (drawer open, card flip) |
| `--dur-hero` | 700 ms (hero headline resolve) |

Rules:
- Motion must show **what changed** (a new alert appears, a lock was claimed) or respond to the person's action.
- No looping decorative animation anywhere except: the live chart updating, the SOS pulse ring, and the claim-lock countdown.
- `prefers-reduced-motion: reduce` → disable all transforms/blur/parallax; keep opacity changes ≤ 120 ms; replace the SOS pulse with a static thick ring and an icon; show end states immediately.

### 4.7 Ready-to-paste `src/index.css` (Tailwind v4)

```css
@import "tailwindcss";

:root {
  --ink: #0E2A33;
  --bg: #F2F6F6;
  --surface: #FFFFFF;
  --surface-2: #E4ECEE;
  --border: #C9D6D9;
  --border-strong: #7E959B;
  --text: #0E2A33;
  --text-muted: #4A6169;
  --brand: #0F7C86;
  --brand-hover: #0B646C;
  --brand-tint: #D5ECEE;

  --ok-fg: #14663F;    --ok-bg: #DDF1E5;    --ok-solid: #1B7F4B;
  --warn-fg: #7A4A00;  --warn-bg: #FDEBC8;  --warn-solid: #F2A900;
  --alert-fg: #A31515; --alert-bg: #FBDCDC; --alert-solid: #C62828;
  --na-fg: #4A5D64;    --na-bg: #E1E7E9;
  --sim-fg: #4B3FA0;   --sim-bg: #E9E6F7;
  --signal: #C62828;

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 120ms; --dur-base: 220ms; --dur-slow: 420ms; --dur-hero: 700ms;
}

[data-theme="dark"] {
  --bg: #0A1C22; --surface: #11303A; --surface-2: #18404B;
  --border: #2C5360; --text: #E8F3F4; --text-muted: #9DB8BE;
  --brand: #5FD0D8; --brand-hover: #8BE0E6; --brand-tint: #18404B;
  --signal: #FF6B57;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-text: var(--text);
  --color-muted: var(--text-muted);
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-tint: var(--brand-tint);
  --color-ok: var(--ok-fg);   --color-ok-bg: var(--ok-bg);   --color-ok-solid: var(--ok-solid);
  --color-warn: var(--warn-fg); --color-warn-bg: var(--warn-bg); --color-warn-solid: var(--warn-solid);
  --color-alert: var(--alert-fg); --color-alert-bg: var(--alert-bg); --color-alert-solid: var(--alert-solid);
  --color-na: var(--na-fg);   --color-na-bg: var(--na-bg);
  --color-sim: var(--sim-fg); --color-sim-bg: var(--sim-bg);
  --color-signal: var(--signal);
  --font-display: "Bricolage Grotesque Variable", system-ui, sans-serif;
  --font-sans: "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif;
}

html { font-family: var(--font-sans); background: var(--bg); color: var(--text); }
body { font-size: 1.0625rem; line-height: 1.55; font-variant-numeric: tabular-nums; }
h1, h2, h3 { font-family: var(--font-display); letter-spacing: -0.01em; }

:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; border-radius: 4px; }

.hatch { background-image: repeating-linear-gradient(135deg, transparent 0 6px, rgb(74 93 100 / .18) 6px 8px); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

**shadcn/ui mapping:** shadcn expects `--background`, `--foreground`, `--card`, `--primary`, `--ring`, etc. Map them to the tokens above (for example `--background: var(--bg); --foreground: var(--text); --card: var(--surface); --primary: var(--brand); --ring: var(--brand); --destructive: var(--alert-solid)`) so shadcn components inherit the SmartCare look.

---

## 5. Information architecture

```
Public site
  /                      Landing (showcase + live demo entry)
  /how-it-works          Architecture and workflow (optional split of landing §8)
  /safety                Non-diagnostic statement and limits
Demo sign-in
  /signin                Pick a demo caregiver (presence demo) or "Patient view"
Caregiver app (/app)
  /app                   Overview: who needs attention
  /app/patients/:id      Patient detail: vitals, chart, device health, manual entry, notes
  /app/patients/:id/limits    Threshold sandbox
  /app/patients/:id/summary   Daily summary and heatmap
  /app/alerts            All alerts (filter by state)
  /app/alerts/:id        Alert drawer opens over any page (deep-linkable)
  /app/notifications     Notification attempt history
  /app/audit             Audit trail
  /app/simulator         Scenario player and dataset replay
  /app/settings          Alert sound, theme, escalation timeout, contacts
Patient
  /sos/:patientId        Patient-facing "Request help" screen
```

Primary navigation (app): Overview · Alerts · Simulator · Notifications · Audit · Settings. Patients are reached from Overview cards.

---

## 6. Screen specifications

### 6.1 App shell (all `/app` routes)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Prototype · Simulated data · Not a medical device          [Learn more]   │ ← Disclaimer strip, 32px, always visible
├────┬─────────────────────────────────────────────────────┬───────────────┤
│    │  Overview                         ● Live  [Priya ▾] │               │
│ R  │  ─────────────────────────────────────────────────  │  Presence     │
│ A  │                                                     │  (avatars)    │
│ I  │              Main content                           │               │
│ L  │                                                     │  Activity     │
│    │                                                     │  feed         │
└────┴─────────────────────────────────────────────────────┴───────────────┘
```

- Left rail: 72 px collapsed (icons + tooltips), 248 px expanded (≥ 1280 px). Active item uses `--brand-tint` background and a 3 px left bar.
- Right column (presence + activity): visible ≥ 1280 px; below that it becomes a header popover.
- Top bar: page title, connection indicator ("Live", "Reconnecting…", "Offline"), user menu, theme toggle.
- Connection indicator is a **separate concept from device health**: it shows the dashboard's own WebSocket state.
- Mobile (< 768 px): rail becomes a bottom tab bar (Overview, Alerts, Simulator, More). Right column becomes a sheet reachable from the top bar.

### 6.2 Landing page `/`

**Layout principle:** dark teal hero, then light Mist sections. Left-aligned text, wide asymmetrical compositions, no centered hero.

#### Section 1 — Hero (the memorable moment)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SmartCare   How it works  Safety  Tech        [Open the live demo]          │
│                                                                             │
│  Know when someone needs help,                  ┌──────────────────────────┐│
│  and who is already on it.                      │ Heart rate  (BPM)        │ │
│                                                 │ 126 ─────────/\──────    │ │
│  A software-first monitoring prototype that     │ 110 ┄┄┄┄┄┄┄┄┄/┄┄┄┄┄┄ limit │
│  explains every alert, tracks who responds,     │  72 ~~~~~~~~~/           │ │
│  and escalates when no one does.                │                          │ │
│                                                 │ ┌──────────────────────┐ │ │
│  [Open the live demo]  [Replay the scenario]    │ │ Heart rate is 126 BPM,│ │ │
│                                                 │ │ above the limit 110.  │ │ │
│  Simulated data. Not a medical device.          │ │ Priya is reviewing.   │ │ │
│                                                 │ └──────────────────────┘ │ │
│                                                 └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

- Background: `--bg` dark value `#0A1C22` + `Noise` overlay (opacity 0.06, static).
- Headline: `display` type, Bricolage, `--text` dark value `#E8F3F4`, resolves word by word with **React Bits `Blur Text`** once on load (700 ms total).
- The trace panel is a custom component (`HeroTrace`, §10.4): a canvas line chart, seeded so it is identical every run. It is a **heart-rate trend**, not an ECG, because that is what the product measures.
- **Sequence (plays once, ~5 s):**
  1. 0.0 s headline resolves.
  2. 0.3 s trace starts drawing at a calm baseline near 72 BPM.
  3. 2.4 s trace rises and crosses the dashed 110 BPM limit line.
  4. 2.6 s the limit line pulses once in `--signal` (`#FF6B57`).
  5. 2.8 s the explanation card slides up: "Heart rate is 126 BPM, above the limit of 110 BPM."
  6. 3.8 s a second line appears: "Priya is reviewing" with a small avatar and a 60 s lock ring.
  7. After 5 s the trace continues in a calm live state. No loop.
- "Replay the scenario" is a user action that restarts the sequence.
- Reduced motion: show the final frame (trace above the limit, both cards visible), no drawing.

#### Section 2 — "What happens after a reading goes wrong" (true sequence, numbering allowed)

Pinned vertical stack using **React Bits `Scroll Stack`**: four cards that pin and stack as the page scrolls. Each card holds a miniature of the real UI.

| # | Card title | Mini-UI inside the card |
|---|---|---|
| 1 | The alert says why | Alert card with the plain sentence, source chip, timestamp |
| 2 | Caregivers are notified | Three notification chips (`Call Chip`): In-app (delivered), SMS (accepted by provider), Email (failed: retry scheduled) |
| 3 | One person takes it | Claim lock: "Priya is reviewing", 60 s ring counting down, other caregiver sees disabled "Claim" |
| 4 | If no one responds, it escalates | Countdown "Escalating in 1:12", then "Notifying Rahul (backup)" |

- Left column: sticky heading ("A reading crosses a limit. Here is what the system does.") and one line of text per active card.
- Reduced motion or screens < 768 px: render the four cards as a plain vertical list, no pinning.

#### Section 3 — Replay what happened (time-travel demo)

- A full-width chart with 10 minutes of sample data and a draggable scrubber. Heading: "Rewind any alert."
- Interaction: drag the scrubber or press ← / →; the readings panel shows values at that moment; a marker shows the alert time.
- Cursor over the plot uses a **`Crosshair`-style cursor** (live coordinates). Keyboard users get arrow-key scrubbing; touch users drag.
- Caption: "Five minutes before and after each alert, saved with the alert."

#### Section 4 — Test limits before saving (threshold sandbox demo)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Heart rate limits                                                      │
│  Min [ 50 ]  Max [ 110 ]     ← Scrub Field (drag or click to type)     │
│                                                                        │
│  24-hour chart with proposed lines overlaid                            │
│  "With these limits, 3 alerts would have triggered in the past 24 hours."
│  [Reset]                                                               │
└────────────────────────────────────────────────────────────────────────┘
```

- Live count updates as the numbers change (`Count Up` for the number only when it changes by user input).
- Label near the heading: "Demonstration limits. Not medical advice."

#### Section 5 — When data stops, it says so

- A device-health card with a toggle "Simulate disconnect". On toggle, the vital cards flip (`--dur-slow`) from numbers to the hatched "No recent reading" state, and a separate warning appears: "Sensor offline. No signal for 18 s."
- Supporting line: "A missing reading is never shown as a normal one."

#### Section 6 — Help without a threshold (independent SOS)

- Large `Hold Button` demo ("Hold to request help"). On completion, a simulated SOS event appears in a mini dashboard beside it, with an SOS banner and the text "This is simulated. No emergency service was contacted."

#### Section 7 — What SmartCare does not do

- A single wide paragraph set at `body-lg`, revealed on scroll with **`Scroll Reveal`** (unblurs word by word). Content: not a diagnosis, no treatment advice, no guaranteed delivery, thresholds are demonstration settings, an absence of alerts does not mean someone is safe.
- This section is intentionally plain: one column, no icons.

#### Section 8 — How it's built (for reviewers)

- An SVG architecture diagram (inputs → FastAPI → monitoring engine / data-quality monitor / alert engine / notifications → SQLite → React dashboard). Draw it as inline SVG using the tokens; each box has a one-line description.
- Beneath it a two-column tech list from the documentation §2.

#### Section 9 — Footer

- Disclaimer sentence, repository link, documentation link, dataset credits and licenses (required if replay datasets are used).

### 6.3 Overview `/app`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Needs attention (ordered by operational urgency, not clinical risk)       │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ [siren] SOS · Demo Patient B · Help requested 00:42 ago · No one yet  │ │ ← SOS row: solid red, full width
│ │ [triangle] Alert · Demo Patient A · Heart rate 126 BPM > 110 · Priya reviewing │
│ │ [clock] Data · Demo Patient C · No recent reading (2 min) · Replay: <name>     │
│ └───────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│ Patients                                                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│ │ Demo Patient A│ │ Demo Patient B│ │ Demo Patient C│ │ Demo Patient D│     │
│ │ ● Alert       │ │ ● SOS         │ │ ◌ No data     │ │ ✓ Normal      │     │
│ │ 126  BPM  ~~~ │ │ 71  BPM  ~~~  │ │  —   BPM      │ │ 68  BPM  ~~~  │     │
│ │ 36.8 °C       │ │ 36.6 °C       │ │  —   °C       │ │ 36.5 °C       │     │
│ │ 4 s ago · Sim │ │ 2 s ago · Sim │ │ 2 min ago     │ │ 3 s ago · Sim │     │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Ordering rules** (transparent, shown in a "How is this ordered?" popover): 1) active SOS, 2) unacknowledged alerts, 3) repeated threshold breaches, 4) unavailable data, 5) everything else by name. Copy: "Ordered by what needs a response first. This is not a medical risk score."
- Needs-attention rows slide in/out using **`Animated List`** (spring in, gliding selection, arrow-key navigation).
- Patient cards are **border-only panels** with a 4 px left status bar. The card for an SOS patient uses the solid SOS fill instead, so it cannot be missed.
- The empty state: "No active alerts right now. This does not confirm that anyone is safe."

### 6.4 Patient detail `/app/patients/:id`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Overview   Demo Patient A      [Alert]   Last reading 4 s ago  [Simulated]│
├───────────────────────────────┬───────────────────────────────────────────┤
│ Heart rate        Temperature │  Trend (last 30 min)  [30m][2h][24h]       │
│  126 BPM           36.8 °C    │  ─ chart with limit bands, brush ─         │
│  limit 50–110      limit 35.5–37.8                                          │
├───────────────────────────────┤                                            │
│ Device health                 │                                            │
│  Battery 78%  Signal −58 dBm  ├───────────────────────────────────────────┤
│  Last ping 2 s ago            │ Active alerts                              │
├───────────────────────────────┤ Shift notes     Manual entry   Check-ins   │
│ Add a reading (manual entry)  │                                            │
└───────────────────────────────┴───────────────────────────────────────────┘
```

- Vital cards show: label, `vital` numeral, unit, the configured limits in `small` text, state chip, source chip, freshness tag.
- Chart spec in §10.1.
- **Device health widget:** battery (simple bar, text value), Wi-Fi signal (4-bar glyph + dBm), heartbeat indicator ("Last ping: 2 s ago", a small dot that blinks once per ping), and connection state. If silent > 15 s: the card turns hatched with "Sensor offline. No signal for N s." (This is a simulated telemetry widget in the prototype; label it "Simulated device" when the source is simulated.)
- **Manual entry:** two number fields (BPM, °C), unit labels, a "Measured at" time defaulting to now, "Save reading". Result toast: "Reading saved. Stored as manual entry." Invalid values show inline: "412 BPM is outside the accepted range (20–300). Check the value and try again." (Accepted ranges are configuration values.)
- **Optional modules** (build last): reminders (checkbox rows with `Spring Check`), experimental baseline indicator with a visible "Experimental. Not a medical prediction." tag.

### 6.5 Alert drawer `/app/alerts/:id` (opens over any page)

Desktop: right-side drawer, 520 px, with a scrim at 40% ink. Mobile: bottom sheet at 92% height.

```
┌───────────────────────────────────────────────┐
│ [triangle] Alert · Demo Patient A      [ × ]  │
│ Heart rate is 126 BPM, above the limit of     │
│ 110 BPM. Simulated reading at 14:02:11.       │
│                                               │
│ ○ Active ─ ◔ Under review ─ ○ Acknowledged ─ ○ Resolved
│   (Escalated shows as a branch when reached)  │
│                                               │
│ Rewind  [◀ ▶]   ──────●──────────────  ±5 min │
│  chart with marker at alert time, brush       │
│                                               │
│ Respond                                       │
│  [ Claim this alert ]   Priya is reviewing 0:48 ◔
│  Note [______________________________]        │
│  [ Acknowledge ]  [ Mark resolved ]           │
│                                               │
│ Reach someone                                 │
│  [ Message on WhatsApp ]  [ Escalate to Rahul ]│
│  Siren  [On/Off]   Escalating in 1:12         │
│                                               │
│ Notification attempts                         │
│  In-app  ✓ Delivered   SMS  ◔ Accepted by provider │
│  Email ✕ Failed: provider timeout · Retrying  │
│                                               │
│ History (audit)                               │
└───────────────────────────────────────────────┘
```

Behavior details:
- **Claim and lock:** clicking "Claim this alert" shows "<Name> is reviewing" to everyone and starts a 60 s lock ring (SVG circle, stroke-dashoffset). Other caregivers see a disabled "Claim" with the claimant's name. At 0 the lock releases with a toast "Lock released." The claimant can extend or release manually. Reduced motion: replace the ring with text countdown.
- **State timeline:** use **`Status Mark`** glyphs (idle ring → progress arc → check). Escalated is a branch off the line with its own glyph. Each node shows who and when on focus/hover and in a visible text line beneath.
- **Acknowledge:** requires no note, but offers one. After acknowledging, the primary button becomes "Mark resolved". Acknowledged ≠ resolved, and the UI keeps both buttons distinct.
- **WhatsApp action:** opens a `wa.me` link with a prefilled message: patient display name, latest vitals with units, reading time, source label, and "Prototype alert, not a medical diagnosis." It never claims to contact emergency services.
- **Escalate to backup:** `Slide Commit` (slide-to-confirm) to avoid accidental taps. Keyboard alternative: focus the control and press Enter twice.
- **Siren:** off by default until the person turns it on (browsers block autoplay audio). First-run settings prompt: "Turn on alert sounds?" with a "Play a test tone" button. Audio is generated with the Web Audio API, three tone presets, volume slider. A visible countdown shows the time until automatic escalation. Sound is never the only signal.
- **Notification attempts** use **`Call Chip`**: wipe-fill while pending → green for delivered, neutral for "accepted by provider", shaking red for failed. Labels use exact wording from §13 (never "Sent successfully" for an attempt).

### 6.6 Threshold sandbox `/app/patients/:id/limits`

```
┌───────────────────────────┬───────────────────────────────────────────────┐
│ Demonstration limits      │ Last 24 hours                                 │
│ Not medical advice.       │  chart: current limits (solid)                │
│                           │         proposed limits (dashed, brand color) │
│ Heart rate                │  alert markers: current ▲   proposed △        │
│  Min [ 50 ] BPM           │                                               │
│  Max [ 110 ] BPM          │ With these limits, 3 alerts would have        │
│ Temperature               │ triggered in the past 24 hours.               │
│  Min [ 35.5 ] °C          │ (Currently saved limits: 5 alerts.)           │
│  Max [ 37.8 ] °C          │                                               │
│                           │ Version history: v3 (current), v2, v1         │
│ [ Save as new version ]   │                                               │
│ [ Reset ]                 │                                               │
└───────────────────────────┴───────────────────────────────────────────────┘
```

- Inputs: **`Scrub Field`** (drag to scrub with rubber-band limits, click to type). Also include a hidden-label native `<input type="number">` fallback for assistive tech and keyboard users; Arrow keys change by step (1 BPM, 0.1 °C), Shift+Arrow by 10.
- Validation: min < max; each within the accepted range; inline text error under the field, plus the Save button disabled with a reason: "Minimum must be lower than maximum."
- The preview is computed **client-side** from cached 24 h data and must use the same rule function as the backend (shared test fixture ensures agreement; see Documentation §11).
- Saving creates a new version row, shows toast "Limits saved as version 4", and appends to the version list.

### 6.7 Daily summary and heatmap `/app/patients/:id/summary`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Today                                                                     │
│ Heart rate averaged 72 BPM. Temperature stayed within the configured range.│
│ Alerts: 3 raised · 2 acknowledged · 1 open     Data gaps: 2 (total 14 min) │
├───────────────────────────────────────────────────────────────────────────┤
│ Hourly view (last 7 days)                                                  │
│      00 01 02 03 … 23                                                      │
│ Mon  ■  ■  ■  ■ …                                                         │
│ Tue  ■  ▪  ■  ■ …    legend: Within limits · Minor deviation · Breach · No data │
└───────────────────────────────────────────────────────────────────────────┘
```

- Summary numbers use **`Count Up`** once on first view.
- Heatmap is a CSS grid: 24 columns × N rows, cell 28 px (desktop) / 20 px (mobile, horizontally scrollable). Each cell is a button with an accessible name: "Tuesday 14:00 to 15:00. Minor deviation. Average 104 BPM." Arrow keys move between cells; Enter opens a side panel with that hour's readings.
- Legend text states "Categories use the configured limits, not clinical judgment."
- Export: "Download report (CSV)" and "Download report (PDF)" buttons.

### 6.8 Simulator `/app/simulator`

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Scenario player                                  Seed [ 42 ] [Randomize]  │
│ Patient [Demo Patient A ▾]   Source [Synthetic ▾ | Dataset: <name> ▾]      │
│                                                                           │
│ Scenarios                                  Speed  [1×][10×][60×]          │
│ ( ) Normal readings                        [▶ Play] [❚❚ Pause] [⏭ Step]    │
│ ( ) Single threshold breach                [Reset demo data]              │
│ ( ) Repeated abnormal readings                                            │
│ ( ) Gradual drift                          Timeline of injected events    │
│ ( ) Invalid or missing readings            ──●────●─────────●───────      │
│ ( ) Stale data                                                            │
│ ( ) Simulated disconnection                                               │
│ ( ) SOS during normal readings                                            │
│ ( ) Missed acknowledgment → escalation                                    │
│ ( ) Notification failure and retry                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

- Every simulated stream produces readings with the **Simulated** or **Replay: <dataset>** chip.
- "Reset demo data" opens a confirm dialog: "This clears demo readings, alerts, and notes. Real configuration is kept." (Prototype only has demo data.)
- This page is the backbone of the live demo. Prioritize it in the build.

### 6.9 Patient SOS `/sos/:patientId`

```
┌──────────────────────────────────────┐
│ Prototype · Simulated · Not a medical │
│ device                               │
│                                      │
│  Need help?                          │
│  Hold the button for 1 second.       │
│                                      │
│          ┌───────────┐               │
│          │           │               │
│          │   HELP    │  ← 240 px circle, solid red, hold-fill
│          │           │               │
│          └───────────┘               │
│   Or tap here, then confirm          │
│                                      │
│  [ I feel unwell — call me ]         │
└──────────────────────────────────────┘
```

- Built with **`Hold Button`** (liquid fill rises while pressed, snaps back if released). Fill time 1 s by default; a setting allows 0.5–2 s. The alternative path ("Or tap here, then confirm") exists for people who cannot hold; it opens a two-button confirm: "Request help" / "Cancel".
- After activation: full-screen confirmation "Help requested. Your caregivers have been notified in this demo. This is simulated and no emergency service has been contacted." plus a live status line that follows the event state: "Waiting for a response" → "<Name> has seen your request" (acknowledged) → "Resolved".
- Body text ≥ 20 px, button label ≥ 28 px, high-contrast only.
- "I feel unwell — call me" creates a self-reported check-in (not an SOS) with its own label.

### 6.10 Alerts list, notifications, audit

- **Alerts** (`/app/alerts`): table on desktop, stacked rows on mobile. Columns: state chip, patient, explanation, source, created, assignee. Filters: state, patient, type (threshold / trend / SOS / data-quality). Data-quality warnings are listed under their own tab and never mixed into health alerts.
- **Notifications**: columns for recipient, channel, attempt time, outcome (exact status wording), alert link. Failed rows show reason and retry count.
- **Audit**: filterable timeline (patient, event type, date). Read-only. Each row shows actor, action, timestamp, and a "View details" expand with JSON metadata (no sensitive data in logs).

### 6.11 Settings

Alert sound (on/off, tone, volume, test), theme (light/dark/system), acknowledgment timeout (default 2:00 for demo), escalation contacts (primary, secondary), SOS hold duration, reduced-motion override ("Reduce animations").

### 6.12 Presence and activity feed (right column)

- **Presence:** overlapping avatar stack of online caregivers (initials, tinted circles). Hovering an avatar shows "Priya is viewing Demo Patient A". Patient cards show small avatars of who is currently viewing them.
- **Activity feed:** latest 20 events, each one line: "14:02 Alert raised for Demo Patient A", "14:03 Priya claimed the alert". Appears with `Animated List`. Not a replacement for the audit trail.

---

## 7. Component library

Build these components once in `src/components/smartcare/`. Each lists variants and states.

| Component | Variants / states | Visual notes |
|---|---|---|
| `DisclaimerStrip` | default, SOS-active | 32 px, `--surface-2`, icon + text, link "Learn more". In SOS takeover keep it visible |
| `StatusBadge` | normal, attention, alert, sos, unavailable | Icon + word + tint. Size: sm (24 px), md (32 px), lg (44 px). `unavailable` includes the hatch |
| `SourceChip` | simulated, replay, manual, device | Always paired with the reading it describes |
| `FreshnessTag` | fresh, aging, stale, offline | Text "4 s ago", turns to `--warn-fg` text when aging, hatched when stale/offline |
| `VitalCard` | normal, attention, alert, sos, unavailable, loading | Contains label, numeral, unit, limits, `StatusBadge`, `SourceChip`, `FreshnessTag`, sparkline |
| `Sparkline` | line | 96 × 32 px, no axes, last 60 points, stroke 2 px |
| `VitalsChart` | live, history, playback | See §10.1 |
| `AlertCard` | active, under review, acknowledged, resolved, escalated | Explanation sentence first; metadata second |
| `AlertDrawer` | desktop, mobile | See §6.5 |
| `ClaimLock` | idle, claimed by me, claimed by other, expired | 60 s ring, name label |
| `StateTimeline` | linear + escalation branch | `Status Mark` glyphs, text under each node |
| `NotificationAttempt` | pending, accepted, delivered, failed | `Call Chip`. Shows channel, recipient, time, outcome |
| `DataQualityBanner` | stale, offline, invalid reading | Hatched, neutral tones, with a "What does this mean?" link |
| `DeviceHealthCard` | online, weak signal, low battery, offline | Battery (bar + %), signal (4 bars + dBm), ping dot, state |
| `SOSButton` | idle, holding, confirming, active | `Hold Button`; also supports the tap-then-confirm path |
| `ThresholdEditor` | pristine, dirty, invalid, saving | `Scrub Field` + native inputs |
| `HeatmapGrid` | normal, loading, empty | Cell glyphs and accessible names |
| `PresenceStack` | 1–5 avatars + overflow | Initials + tooltip |
| `ScenarioPlayer` | idle, running, paused | Speed buttons, timeline of injected events |
| `ManualEntryForm` | pristine, invalid, saving, saved | Inline errors, keeps typed values on error |
| `EmptyState` | no alerts, no data, no results | One sentence + one action; never implies safety |
| `Toast` | success, info, error | Swipe-to-dismiss (`Swipe Toast`), 5 s, assertive only for errors |

### 7.1 State derivation (single source of truth)

```ts
// src/lib/status.ts
export type MonitoringState = 'normal' | 'attention' | 'alert' | 'sos' | 'unavailable';

export interface PatientSignal {
  hasActiveSos: boolean;
  hasOpenAlert: boolean;          // threshold or trend alert not yet resolved
  hasMinorDeviation: boolean;     // inside "attention" band or trend indicator
  lastReadingAgeSec: number | null; // null = never
  expectedIntervalSec: number;    // per source, from configuration
  deviceExpected: boolean;        // true for simulated-live and device sources
}

export function deriveState(s: PatientSignal): MonitoringState {
  if (s.hasActiveSos) return 'sos';
  if (s.hasOpenAlert) return 'alert';
  const stale = s.lastReadingAgeSec === null || s.lastReadingAgeSec > s.expectedIntervalSec * 3;
  const offline = s.deviceExpected && (s.lastReadingAgeSec ?? Infinity) > 15;
  if (stale || offline) return 'unavailable';
  if (s.hasMinorDeviation) return 'attention';
  return 'normal';
}
```

Rule: if an alert exists **and** data is also stale, show the alert badge and display the `DataQualityBanner` on top of the card. Unavailable data must never render as Normal.

### 7.2 StatusBadge example

```tsx
// src/components/smartcare/StatusBadge.tsx
import { CheckCircle2, AlertCircle, AlertTriangle, Siren, WifiOff } from 'lucide-react';
import type { MonitoringState } from '@/lib/status';

const MAP = {
  normal:      { Icon: CheckCircle2,  label: 'Normal',          cls: 'bg-ok-bg text-ok' },
  attention:   { Icon: AlertCircle,   label: 'Needs attention', cls: 'bg-warn-bg text-warn' },
  alert:       { Icon: AlertTriangle, label: 'Alert',           cls: 'bg-alert-bg text-alert' },
  sos:         { Icon: Siren,         label: 'SOS',             cls: 'bg-alert-solid text-white' },
  unavailable: { Icon: WifiOff,       label: 'No recent reading', cls: 'bg-na-bg text-na hatch' },
} as const;

export function StatusBadge({ state }: { state: MonitoringState }) {
  const { Icon, label, cls } = MAP[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.9375rem] font-semibold ${cls}`}>
      <Icon aria-hidden className="size-4" />
      {label}
    </span>
  );
}
```

---

## 8. Data flow and real-time behavior in the UI

| WebSocket event | UI response |
|---|---|
| `reading.new` | Update `VitalCard` numeral (no animation on the number itself except a 120 ms opacity settle), append to chart, reset `FreshnessTag` |
| `reading.rejected` | Add to quarantine counter in the patient header ("1 reading rejected") and a data-quality entry; do not update the chart |
| `status.changed` | Update `StatusBadge`; if it became `alert` or `sos`, add to Needs-attention list with `Animated List` entry |
| `alert.created` | Toast (assertive for SOS, polite for alerts), add to feed, play siren if enabled and unmuted |
| `alert.updated` (claim, ack, escalate, resolve) | Update `StateTimeline`, `ClaimLock`, and list rows; add activity-feed line |
| `notification.updated` | Update `Call Chip` state in the drawer |
| `device.status` | Update `DeviceHealthCard` |
| `presence.update` | Update `PresenceStack` and per-card avatars |
| socket close | Top bar shows "Reconnecting…"; after 5 s show banner "Live updates paused. Showing last known data." Cards show their freshness tags aging; on reconnect fetch full state via REST |

Screen-reader announcements: use one polite live region for general updates (batched, not every reading) and one assertive live region reserved for **new SOS** and **new alert**. Never announce each reading.

---

## 9. React Bits usage map

Install pattern: `npx shadcn@latest add @react-bits/<ComponentName>-TS-TW`. Component names below follow the library's PascalCase naming; **confirm the exact registry name in each component's Code tab**, then install any dependencies it lists. Keep every installed component in `src/components/react-bits/` and wrap it in a SmartCare component rather than importing it directly across the app.

### 9.1 Use

| React Bits component | Where it is used | Configuration notes | Fallback |
|---|---|---|---|
| **Blur Text** | Hero headline, once on load | 700 ms total, word by word, ease-out | Plain text |
| **Noise** | Hero background overlay | Opacity 0.04–0.08, static (no animation) | Omit |
| **Scroll Stack** | Landing section 2 (alert → escalation sequence) | 4 cards, light vertical offset | Plain list below 768 px or reduced motion |
| **Scroll Reveal** | Landing "What SmartCare does not do" paragraph | Word-level unblur, short range | Full text visible |
| **Count Up** | Daily summary averages, sandbox alert count | Run once per value change, 600 ms | Static number |
| **Animated List** | Needs-attention list, activity feed, alert list on mobile | Spring in, keyboard arrows move selection | Plain list |
| **Hold Button** | Patient SOS button, landing SOS demo | Hold time configurable (default 1 s), keyboard: hold Space/Enter | Tap-then-confirm dialog |
| **Slide Commit** | Escalate to backup, clear demo data | Handle label "Slide to escalate" | Confirm dialog with two buttons |
| **Call Chip** | Notification attempts | States map: pending → fill wipe, delivered → green, failed → shake once | Static chip with text |
| **Status Mark** | Alert state timeline | Idle ring → progress arc → check | Static icons |
| **Scrub Field** | Threshold min/max | Min/max bounds from config, rubber-band at limits | Native number input |
| **Squish Switch** | Settings toggles (sound, theme) | Standard 44 px height | Native switch |
| **Spring Check** | Reminders checklist (optional module) | | Native checkbox |
| **Swipe Toast** | Toasts | 5 s, swipe to dismiss | Plain toast |
| **Warm Tooltip** | Rail icons, chart legend | First waits 400 ms, siblings open instantly | Native title |
| **Pill Nav** | Landing top navigation | Sliding highlight | Static links |
| **Crosshair** (cursor) | Chart scrubbing on landing section 3 only | Only on pointer-fine devices | Standard cursor |

### 9.2 Optional upgrades (only after the core is done and measured)
- **Scanner** or **Dot Grid** behind the landing "How it's built" section, at very low opacity. Check frame rate on a mid-range laptop first.
- **Glare Hover** on the primary landing CTA only.

### 9.3 Do not use
Any heavy WebGL background on the dashboard (Aurora, Plasma, Galaxy, Liquid Ether, Hyperspeed, Lightning, Ballpit, etc.), cursor-follower effects on the app, `Falling Text`, `Glitch Text`, `Fuzzy Text`, and anything that moves while a caregiver is reading an alert. A monitoring screen must stay still unless data changes.

### 9.4 Performance rules for React Bits
- Lazy-load every React Bits component that depends on `three`, `ogl`, or a canvas (`React.lazy` + `Suspense`).
- Do not import React Bits on `/app` routes unless it is in §9.1 for that route.
- Pause canvas animation when the tab is hidden (`document.visibilityState`).
- Respect `prefers-reduced-motion` in the wrapper, not inside the third-party component.

---

## 10. Charts

### 10.1 `VitalsChart` (Recharts)

- Library: Recharts `ComposedChart` with `Line`, `ReferenceArea`, `ReferenceLine`, `Brush`, `Tooltip`.
- **Two stacked small multiples** for heart rate and temperature that share the x-axis and brush, so the scrub line aligns across both.
- Line: 2.5 px, color `--brand`; points hidden except the latest (6 px dot) and alert markers.
- **Limit band:** draw the allowed range with `ReferenceArea` using a very light tint (`--brand-tint`), and the min/max with dashed `ReferenceLine`s labelled in `small` text at the right edge ("Max 110").
- Breach segments: where a value is outside limits, draw that segment in `--alert-solid` (`#C62828`) with a heavier stroke so it is distinguishable without color (stroke + marker triangle).
- Gaps: where data is missing, **break the line** (use `connectNulls={false}`) and fill the gap with the hatch pattern and a label "No data".
- Source change: a thin vertical divider with a label ("Replay started") when the source changes.
- Axes: x = time with local format `HH:mm:ss` for ≤ 30 min and `HH:mm` beyond; y = padded to include the limits.
- Live mode: window of 30 min, ring buffer of at most 2,000 points. Downsample older ranges with LTTB.
- Accessibility: button "View as table" under every chart toggles a table of the same data (timestamp, value, unit, source, state). Chart container has `role="img"` and an `aria-label` summarizing the latest value and status.
- Playback mode: window of ±5 min around the alert time. Controls: play/pause, scrub slider (`<input type="range">`), step buttons. Arrow keys step 1 reading, Shift+Arrow step 10. Speed 1× / 4× / 10×.

### 10.2 Threshold sandbox overlay
Reuse `VitalsChart` with an additional prop `proposedLimits`. Draw proposed limits as dashed `--brand` lines (2 px) and hollow triangles for would-be alerts; current limits stay solid gray with filled triangles.

### 10.3 Heatmap
Custom grid (not a chart library). See §6.7.

### 10.4 Hero trace (`HeroTrace`)
Canvas 2D, 60 fps, device-pixel-ratio aware, seeded.

```ts
// Pseudocode
const baseline = 72, limit = 110, peak = 126;
const rng = mulberry32(42);                    // fixed seed → identical every time
function valueAt(t) {                          // t in seconds since start
  const noise = (rng() - 0.5) * 2.2;
  if (t < 2.0) return baseline + noise;
  if (t < 2.6) return baseline + (peak - baseline) * easeOutCubic((t - 2.0) / 0.6) + noise;
  return peak - (peak - 84) * easeInOut(Math.min((t - 2.6) / 6, 1)) + noise; // settles back
}
// Draw: keep the last 8 s of points; x = time, y mapped to [60, 140].
// At t ≈ 2.4 s trigger events: pulse(limitLine), showCard(), showClaim().
```

- Canvas draws: dashed limit line with label, trace, latest-point dot. Alert card and claim chip are **HTML elements** layered over the canvas (so they are readable by assistive tech).
- Provide `aria-label` on the panel: "Example: heart rate rises above the configured limit of 110 BPM and an alert explains it."
- Pause when off-screen via `IntersectionObserver`.

---

## 11. Sound

- Web Audio API only. Three presets: "Soft chime" (default), "Two-tone", "Siren".
- Default off; first-run prompt asks to enable and plays a test tone. Remember choice in `localStorage` (try/catch around access).
- Alerts: single tone every 10 s until acknowledged or muted. SOS: siren until acknowledged. Mute is always one tap in the drawer and in the top bar.
- Never rely on sound alone. Every sound has a visible banner and a state change.

---

## 12. Disclaimer, safety, and labeling rules (UI-level)

| Rule | Implementation |
|---|---|
| Persistent notice | `DisclaimerStrip` on every page, including `/sos` |
| Provenance on every reading | `SourceChip` next to every number, chart header, and table row |
| Technical vs health separation | Different icon family (wifi/clock vs triangle), different tabs, different list sections |
| No safety implication | No green "all good" hero states. Normal is "Normal" with the limits shown. Empty states include "This does not confirm that anyone is safe." |
| No false delivery claims | Use the four notification statuses in §13 |
| No emergency services claim | SOS confirmation always states the event is simulated unless a verified integration is configured |
| Dataset credit | Replay views show dataset name; footer lists dataset sources and licenses |
| Fictional people | Use "Demo Patient A–D" and fictional caregiver names. No real identities |

---

## 13. Content and microcopy

**Voice:** plain verbs, sentence case, no filler, no apology in errors, no jargon ("limit" not "threshold" in UI; keep "threshold" in developer docs).

| Situation | Copy |
|---|---|
| Alert explanation | "Heart rate is 126 BPM, above the limit of 110 BPM. Simulated reading at 14:02:11." |
| Trend indicator | "Heart rate has stayed above 105 BPM for 6 minutes. Review the trend. This is not a prediction." |
| Stale data | "No recent reading. Last reading was 2 min ago from Simulated source." |
| Device offline | "Sensor offline. No signal for 18 s." |
| Invalid reading | "Reading rejected: 412 BPM is outside the accepted range (20–300). Saved to quarantine." |
| SOS event | "Help requested by Demo Patient B. No one has responded yet." |
| SOS patient confirmation | "Help requested. Your caregivers have been notified in this demo. This is simulated and no emergency service has been contacted." |
| Escalation | "No response in 2:00. Notifying Rahul (backup)." |
| Claim | "Priya is reviewing. Lock ends in 0:48." |
| Notification statuses | "Attempted" · "Accepted by provider" · "Delivered (confirmed)" · "Failed: <reason>" |
| Empty alerts | "No active alerts right now. This does not confirm that anyone is safe." |
| Threshold preview | "With these limits, 3 alerts would have triggered in the past 24 hours." |
| Threshold save | "Limits saved as version 4." |
| Reconnecting | "Reconnecting… Showing last known data." |
| Disclaimer strip | "Prototype. Simulated data. Not a medical device." |
| Safety statement | "SmartCare does not diagnose conditions, recommend treatment, or guarantee that a notification is received. Limits are demonstration settings. No alert does not mean someone is safe." |

**Buttons** (verbs, same name through the whole flow): "Open the live demo", "Replay the scenario", "Claim this alert", "Acknowledge", "Add note", "Mark resolved", "Escalate to backup", "Save limits as new version", "Save reading", "Hold to request help", "Request help", "Cancel".

---

## 14. Accessibility checklist (WCAG 2.2 AA target)

- [ ] Body text ≥ 4.5:1; large text and UI components ≥ 3:1. Token pairs in §4.1 were chosen for this; re-verify with a contrast checker after any change.
- [ ] No state conveyed by color alone (icon + word + pattern).
- [ ] Focus ring: 3 px `--brand`, 2 px offset, visible on every interactive element, including custom canvas controls (provide DOM buttons).
- [ ] Keyboard: every action reachable; drawer traps focus and returns it to the opener on close; Esc closes.
- [ ] Hold-to-confirm controls have a non-hold alternative.
- [ ] Targets ≥ 44 px (caregiver), ≥ 56 px (patient SOS).
- [ ] Live regions: polite for batches, assertive only for new SOS/alerts.
- [ ] Charts have a table view, a text summary, and keyboard scrubbing.
- [ ] Zoom to 200% and 400% reflow without horizontal scroll (except data tables and the heatmap in their own scroll container).
- [ ] `prefers-reduced-motion` honored globally; in-app "Reduce animations" override.
- [ ] Dark mode tested for status colors.
- [ ] Language attributes set, form fields have visible labels, errors tied with `aria-describedby`.
- [ ] No auto-playing audio. No flashing faster than 3 flashes per second (the SOS ring pulses at ~1 Hz).

---

## 15. Responsive behavior

| Breakpoint | Layout change |
|---|---|
| < 640 px | Single column; bottom tab bar; drawer becomes bottom sheet; vital numerals 3.5 rem; chart height 220 px; heatmap scrolls horizontally; hero trace panel sits below the headline |
| 640–1023 px | Two-column patient cards; right column hidden (opens as sheet); rail collapsed |
| 1024–1279 px | Rail collapsed; patient detail uses two columns |
| ≥ 1280 px | Rail expanded; right column (presence + activity) visible; drawer 520 px |

Landing: hero is stacked on mobile (headline, trace, then CTAs). Scroll Stack becomes a plain list.

---

## 16. Suggested folder structure

```
frontend/
├── index.html
├── src/
│   ├── index.css                  # tokens from §4.7
│   ├── main.tsx
│   ├── routes/
│   │   ├── landing/               # Hero, Sequence, Rewind, Sandbox, DataStops, SosDemo, Limits, HowItsBuilt
│   │   ├── app/                   # Overview, PatientDetail, Limits, Summary, Alerts, Notifications, Audit, Simulator, Settings
│   │   └── sos/                   # PatientSos
│   ├── components/
│   │   ├── ui/                    # shadcn/ui
│   │   ├── react-bits/            # copied React Bits sources
│   │   └── smartcare/             # components from §7
│   ├── lib/
│   │   ├── status.ts              # deriveState (§7.1)
│   │   ├── rules.ts               # threshold evaluation shared with sandbox preview
│   │   ├── downsample.ts          # LTTB
│   │   ├── sound.ts               # Web Audio presets
│   │   └── format.ts              # time, units
│   ├── hooks/
│   │   ├── useVitalsSocket.ts     # WebSocket with reconnect and backoff
│   │   ├── useReducedMotion.ts
│   │   └── usePresence.ts
│   ├── state/                     # store (Zustand or React context) for live readings and alerts
│   └── api/                       # typed REST client matching Documentation §9
└── public/
```

Suggested libraries: `react-router`, `zustand`, `lucide-react`, `recharts`, `clsx`, `date-fns`.

---

## 17. Build milestones and acceptance checks

| # | Milestone | Done when |
|---|---|---|
| M0 | Project setup | Vite + TS + Tailwind v4 + shadcn initialized; tokens from §4.7 applied; fonts self-hosted; `DisclaimerStrip` visible on a blank page; Lighthouse accessibility ≥ 95 |
| M1 | Core components | `StatusBadge`, `SourceChip`, `FreshnessTag`, `VitalCard`, `Sparkline`, `DataQualityBanner` rendered in a Storybook-style `/styleguide` page in all states |
| M2 | App shell + Overview with mock data | Shell, rail, top bar, Needs-attention list ordering rules, patient cards, empty state |
| M3 | Live data | `useVitalsSocket` connected to the backend simulator; cards update; stale and offline states appear correctly when the simulator pauses |
| M4 | Patient detail + chart | `VitalsChart` with limit bands, breach styling, data gaps, brush, table view; manual entry form with validation |
| M5 | Alert workflow | Alert drawer, `ClaimLock` with 60 s lock, acknowledge/resolve, `StateTimeline`, notification attempts with `Call Chip`, escalation countdown, siren with settings |
| M6 | Investigation tools | Time-travel playback, threshold sandbox with identical rule logic to backend, version history |
| M7 | Summaries and collaboration | Daily summary, heatmap, presence stack, activity feed, CSV/PDF export |
| M8 | Simulator and patient SOS | Scenario player (all 10 scenarios), dataset replay selector, patient `/sos` screen with hold and confirm paths |
| M9 | Landing page | All nine sections; hero sequence; Scroll Stack; embedded mini-demos use the same components as the app |
| M10 | Polish and audit | Reduced-motion pass, keyboard pass, screen-reader pass, dark mode pass, performance pass |

**Performance budgets (targets to measure, not guarantees):** landing LCP under 2.5 s on a mid-range laptop; initial landing JS under 250 KB gzipped (lazy-load everything below the fold); dashboard keeps 60 fps while receiving one reading per second per patient for 10 patients; WebSocket reading → UI update under 200 ms on localhost.

---

## 18. Definition of done for the whole site

- Every feature in `SmartCare_Documentation.md` §5–§6 is reachable from a screen in this file.
- A reviewer can run the "Missed acknowledgment → escalation" scenario from `/app/simulator` and see: alert, notification attempts, claim lock expiry, escalation, acknowledgment, and resolution, all in the audit trail.
- No screen shows unavailable data as normal.
- Every reading shows its source.
- The disclaimer strip is visible on every route.
- Reduced-motion users get the same information with no moving elements.
