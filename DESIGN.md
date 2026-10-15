---
name: AniNext
description: A broadsheet desk for anime discovery — one justified answer, printed in ink on uncoated stock.
colors:
  stock: "#f6f8f5"
  stock-raised: "#ffffff"
  stock-sunken: "#edf2ed"
  stock-hover: "#eaf1ec"
  stock-disabled: "#e7ebe9"
  slate: "#182e3b"
  ink: "#17212b"
  ink-muted: "#4a565d"
  ink-subtle: "#4e5b63"
  press-red: "#a03a19"
  press-red-bright: "#b8451f"
  press-blue: "#294757"
  failure: "#9c3626"
  rule-hairline: "#e1e6e3"
  rule: "#cbd5d2"
  rule-strong: "#728280"
  media-fill: "#d7e1dc"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', 'Iowan Old Style', serif"
    fontSize: "clamp(2.75rem, 6vw, 5rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "normal"
  headline:
    fontFamily: "Georgia, 'Times New Roman', 'Iowan Old Style', serif"
    fontSize: "clamp(1.375rem, 2.2vw, 1.75rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  result:
    fontFamily: "Georgia, 'Times New Roman', 'Iowan Old Style', serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-0.015em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  caption:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0"
  chip: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.stock-raised}"
    typography: "{typography.lead}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
  button-primary-hover:
    backgroundColor: "{colors.press-blue}"
    textColor: "{colors.stock-raised}"
  button-secondary:
    backgroundColor: "{colors.stock-raised}"
    textColor: "{colors.slate}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  field:
    backgroundColor: "{colors.stock-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px"
  field-focus:
    backgroundColor: "{colors.stock-raised}"
  chip-static:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.chip}"
    padding: "1px 12px"
  chip-toggle:
    backgroundColor: "{colors.stock-raised}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    padding: "4px 16px"
  chip-toggle-active:
    backgroundColor: "{colors.press-red}"
    textColor: "{colors.stock-raised}"
  message-card:
    backgroundColor: "{colors.stock-sunken}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
  card-title:
    typography: "{typography.title}"
    textColor: "{colors.slate}"
---

# Design System: AniNext

## Overview

**Creative North Star: "The Broadsheet Desk"**

AniNext is laid out like a broadsheet page that has been read, annotated, and set back on the
desk. Every screen is one column of uncoated stock, ruled top to bottom, with the work done in
ink rather than in chrome. The three picks, the filters, and the answer all live on that single
sheet — nothing floats above the page except things that are genuinely in the air (an open
suggestion list, a cover plate lifted off the page).

The system is plain and quietly warm. Warmth comes from the paper tone and from a single
press-red accent that behaves like letterpress ink: it appears in a handful of places per screen
and never becomes a call to action. There is no gloss, no gradient, no rounded container, no
drop shadow standing in for importance. Detail density is editorial — hairline rules and small
caps labels carry the structure, and whitespace does the rest.

Confirmed visual rejections: card grids with soft drop shadows; pill-shaped everything;
gradient or glassmorphic panels; neon or saturated-accent "dashboard" styling; anything that
looks like a streaming service's content shelf.

**Key Characteristics:**

- One ruled column, max 1080px, with a 68ch measure for anything read as prose.
- Sharp corners everywhere except the pill genre chips; the pill is the one soft form.
- A 3px slate rule opens each major region; 1px hairlines divide everything below it.
- Serif for anything that speaks (titles, the answer, the filter disclosure); system sans for
  everything that reports (labels, metadata, reasons, status).
- Motion is a rule drawing itself, once, on arrival.

## Colors

A two-ink palette on one paper: a warm near-white stock, a slate ink, and press red used as
the single accent voice.

### Primary

- **Press Red** (`#a03a19`): the accent. Used for the eyebrow label, the focused field's
  bottom rule, active filter chips, the filter disclosure's chevron and open rule, the selection
  colour, and the spinners' leading edge. Never a filled call-to-action background.
- **Press Red Bright** (`#b8451f`): the message card's left edge — the one place the accent is
  used as a structural bar rather than a text colour.

### Secondary

- **Press Blue** (`#294757`): a cool slate-blue used only as a _state_ colour — submit hover,
  re-roll hover, the episode slider fill and its checkbox accent. It cools the surface down
  exactly when something is interactive.

### Neutral

- **Uncoated Stock** (`#f6f8f5`): the page. A faintly green-grey paper white, never pure
  `#fff`, so the raised surfaces read as brighter paper rather than as panels.
- **Raised Stock** (`#ffffff`): the only true white — inputs, chips, the suggestion list. It
  signals "this lifts off the page."
- **Sunken Stock** (`#edf2ed`): message cards and the checked state of the unlimited toggle.
  Reads as stock seen through a second sheet.
- **Hover Stock** (`#eaf1ec`): row and chip hover fills.
- **Disabled Stock** (`#e7ebe9`): disabled submit and disabled toggles.
- **Slate** (`#182e3b`): the darkest ink. Section and card titles, the result title, the primary
  button fill, the 3px rules, the slider thumb's stroke.
- **Ink** (`#17212b`): body text and field text.
- **Muted Ink** (`#4a565d`): leads, summaries, metadata, secondary action text.
- **Subtle Ink** (`#4e5b63`): captions, credits, help text, native Japanese titles, scale
  labels. The quietest text on the page.
- **Hairline Rule** (`#e1e6e3`): the 1px dividers inside a region.
- **Rule** (`#cbd5d2`): the 1px rules that separate regions.
- **Strong Rule** (`#728280`): the 2px field underline, chip borders, the loader's track, the
  credit's top rule.
- **Media Fill** (`#d7e1dc`): the flat placeholder behind cover art before the image loads.
- **Failure** (`#9c3626`): field errors and the error card's left edge only.

### Named Rules

**The Rarity Rule.** Press Red covers no more than roughly 10% of a screen, and never fills a
primary button. Its scarcity is what makes an eyebrow read as a label rather than decoration.

**The Ink Rule.** Only Slate and its derivatives carry a 3px or 2px stroke. Hairlines are
never darker than Rule. Weight of a line is the only hierarchy tool; colour is never asked to
do a structural job.

## Typography

**Display Font:** Georgia (with "Times New Roman" and "Iowan Old Style" fallbacks)
**Body Font:** system UI sans — `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto`
**Label Font:** the body sans at small size, tracked and uppercased

**Character:** A workhorse serif and a neutral sans, split by function rather than by style.
Anything that _is_ the content — the headline, the answer's title, the filter disclosure — is
set in Georgia at weight 500. Anything that _reports on_ the content — labels, metadata,
reasons, status, credits — is set in the sans, and gets tracked and uppercased when it is a
label. No webfonts are loaded; the pairing must survive on every machine.

### Hierarchy

- **Display** (500, `clamp(2.75rem, 6vw, 5rem)`, 1.05): the page's single question, once, at
  the top of the masthead. Never repeated.
- **Result** (500, `clamp(2rem, 4vw, 3.25rem)`, 1.06, -0.015em): the recommended title. The
  largest element after the display, and the only thing allowed to compete with it. Set with
  `text-wrap: balance`.
- **Headline** (500, `clamp(1.375rem, 2.2vw, 1.75rem)`, 1.15): the filter disclosure toggle — a
  serif element that opens a section.
- **Title** (700, `1.375rem`, 1.3): section headings ("Your three") and outcome-card headings.
- **Body** (400, `1rem`, 1.5): field text, checkbox labels, reason list items (1.7 line-height
  for reading comfort).
- **Lead** (400, `1.125rem`, 1.6): the masthead paragraph and the submit button, capped at a
  68ch measure.
- **Label** (700, `0.8125rem`, 0.08em, uppercase): eyebrows, field labels, filter row labels,
  and the "Why this one" subheading.
- **Caption** (400, `0.875rem`, 1.5): metadata, notes, credits, status and error text. The
  system's default for anything secondary.

### Named Rules

**The Two-Voice Rule.** A serif element either states the product's answer or opens a section.
A sans element either labels or reports. Nothing crosses over; a serif caption or a sans
headline is a bug, not a choice.

**The Uppercase Is Reserved Rule.** Uppercase, tracked, small, bold text is reserved for labels
and eyebrows. Reasons, metadata, and native titles are always sentence case — they are read,
not scanned.

## Layout

A single column, `min(100% - 32px, 1080px)`, centred, with 64px of block padding. Below 700px
the gutters tighten to 24px and top padding drops to 48px.

The masthead caps at 690px so the headline never runs full measure. Inside the form: the three
search fields sit in a three-column grid (`1fr` on narrow, collapsing to one column), and each
filter row is a two-column rail — a 9rem (6.5rem narrow) uppercase label on the left, controls
on the right. The result region is a cover-plus-text grid: a 160px (104px narrow) 2:3 cover at
the left, everything else stacked in the remaining column.

Prose — leads, reason lists, the stale note, the credit — is capped at a 68ch measure. The
rhythm is the 4/8/12/16/24/32/48/64 spacing scale, used strictly; no ad-hoc pixel values.

## Elevation & Depth

The system is layered, but softly: surfaces separate by paper tone and by rule weight rather
than by hard-edged shadow. Two shadows exist, both low-contrast and tinted with Slate rather
than black, and both are reserved for elements that are genuinely _above_ the page. Everything
that belongs to the sheet is flat.

### Shadow Vocabulary

- **Plate** (`8px 8px 24px rgb(24 46 59 / 14%)`): the result cover art, offset down and right
  like a print plate laid on the sheet. The only decorative shadow in the system.
- **Menu** (`0 12px 28px rgb(24 46 59 / 16%)`): the search suggestion list, and nothing else.
- **Thumb** (`0 2px 6px rgb(24 46 59 / 18%)`): the episode slider's knob, so it reads as a
  graspable object on a flat rail.

### Named Rules

**The Flat-By-Default Rule.** A shadow means "this floats." If a new element is not a popover, a
cover plate, or a slider knob, it gets no shadow — give it a 1px rule instead.

## Shapes

Sharp by default: `border-radius: 0` on the page, fields, buttons, chips-as-filters, and cards.
The single exception is the genre chip's 999px pill, which is a deliberate echo of a printed
catalogue tag and is the only fully rounded form in the system. Elliptical geometry is limited
to the 26px slider thumb and the 18px spinner. Corners are never clipped, never bevelled.

## Components

Printed and deliberate. Controls feel like they were set on the sheet rather than rendered on
it: flat fills, hard edges, colour used only on state.

### Buttons

- **Shape:** square (0px radius).
- **Primary:** Slate fill (`#182e3b`) on raised-white text, 1px Slate border, 16px/24px
  padding, set in Georgia at 1.125rem for the submit action. Hover shifts to Press Blue.
- **Re-roll / Undo:** the same solid treatment in the sans at 700, for actions that follow a
  result.
- **Quiet:** transparent fill, Muted Ink text, 1px Rule border, 12px/16px padding, weight 500.
  Hover fills with Sunken Stock and darkens to Slate.
- **Disabled:** Disabled Stock fill, `ink-on-disabled` text, Rule border, `not-allowed`.
- **Focus / Hover:** every focusable surface draws a 3px Press Red outline at 2px offset with a
  2px raised-stock inner ring, so it is visible on any background. State changes run at 160ms on
  the shared `cubic-bezier(0.16, 1, 0.3, 1)` easing.

### Chips

- **Static (genre):** transparent fill, 1px Strong Rule border, 999px radius, Muted Ink text at
  caption size. Informational only — never interactive, never selected.
- **Toggle (format filter):** square corners, raised-white fill, 1px Strong Rule border. Hover
  darkens the border and fills Hover Stock. Selected state is the only place Press Red becomes
  a solid fill, with raised-white text.

### Fields

- **Style:** 1px Rule border with a 2px Strong Rule underline, raised-white fill, 12px padding,
  Press Red caret, native search cancel button suppressed.
- **Focus:** the shared wrapper draws the focus ring — border darkens, the 2px underline becomes
  Press Red, and a 1px Press Red halo wraps the box. The input itself never draws a second ring.
- **Read-only / selected:** the value renders at weight 700, so a completed field reads as set
  rather than as a placeholder.
- **Clear button:** hairline-divided on the right edge of the control, transparent, 24px square
  minimum target.

### Slider (episode ceiling)

A 8px Strong Rule rail with a 26px raised-white thumb stroked in Slate and cast with the Thumb
shadow; the filled portion of the rail is Press Blue. Hover and active scale the thumb to 1.06
and stroke it Press Red; focus strokes it Press Red. Scale labels below are eyebrow-size,
Subtle Ink, with tabular figures so the numbers do not jitter while dragging.

### Toggle (unlimited episodes)

A 20px checkbox inside a bordered label chip. Checked fills Sunken Stock and darkens to Slate;
disabled greys out both fill and text. The checkbox's own accent colour is Press Blue, matching
the rail fill.

### Disclosure (filters)

A serif trigger at Headline size with a Press Red chevron that rotates 180° on open. Opening
grows the region's top hairline to 3px in Press Red, drawing left to right in 320ms. The panel
unfolds with a clip-path wipe from the top plus a 6px rise and fade, 340ms.

### Message cards (loading, no match, unavailable, failure)

Sunken Stock fill, square corners, 16px/24px padding, and a 4px left edge bar whose colour is
the only severity signal: Strong Rule (loading), Press Red Bright (no match), Press Blue
(unavailable), Failure (error). Titles are Title-size Slate; bodies are Muted Ink at 1rem. The
loading card pairs an 18px spinner — Strong Rule track, Press Red leading edge — with the body
text on one line.

### Result card

Opens with a 3px Slate rule that draws in from the left over 550ms. Head is an eyebrow plus a
right-aligned queue position (`1 of 24`) above a hairline. Cover art sits on the Plate shadow.
Under the title, the metadata reports on the answer in Caption: the meta line, the studio credit,
and the AniList score — all Muted Ink, with no treatment of its own beyond the caption size.
Stale state greys the cover, title and chips to `grayscale(1)`, desaturates the eyebrow, and
swaps the 3px rule to Strong Rule — the whole card steps back rather than disappearing.

### Links

In-content title links inherit colour and are underlined with Strong Rule at 0.2em offset,
going to `currentColor` on hover. The AniList attribution link is a caption-size uppercase
label at 0.04em tracking, in Muted Ink, going to Slate on hover. Both open in a new tab.

## Do's and Don'ts

### Do:

- **Do** separate regions with a 3px Slate rule and everything inside them with 1px hairlines.
- **Do** cap prose at the 68ch measure and keep the page column at 1080px.
- **Do** set anything that states the answer in Georgia 500, and anything that reports on it in
  the system sans.
- **Do** reach for Press Red for a label, a focus ring, a rule, or an active chip — never for a
  filled primary button.
- **Do** animate only rule draws, unfolds, and chevron rotations, and disable each of them under
  `prefers-reduced-motion: reduce`.
- **Do** express state through weight, rule darkness, and greyscale before reaching for colour.

### Don't:

- **Don't** add rounded corners, gradients, glass, or soft glows. The sheet is flat and square.
- **Don't** invent a second accent. Press Red and Press Blue are the whole colour budget;
  Failure is the only permitted fourth, and only for errors.
- **Don't** load a webfont. Georgia and the system sans are the identity, and the app must look
  identical on a machine with no fonts installed.
- **Don't** use uppercase for anything that gets read as prose.
- **Don't** animate the layout, fade the result in, or use spring/bounce easing. One rule draw
  on arrival is the whole motion budget.
- **Don't** give a card, panel, or section a shadow. Shadow means "above the page."
