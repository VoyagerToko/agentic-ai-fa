---
name: Nexus
description: A company knowledge network where the agent's reasoning is drawn as a route across a midnight transit map.
colors:
  scarlet: "#e21d2d"
  scarlet-deep: "#c4101e"
  error-ink: "#ff8a93"
  cobalt: "#2f6bff"
  amber: "#ffc20e"
  green: "#22b14c"
  violet: "#a274ef"
  teal: "#19b5b0"
  enamel: "#0b1230"
  enamel-deep: "#070c22"
  enamel-raise: "#0f1a3e"
  enamel-hover: "#16224d"
  porcelain: "#f4f1ea"
  white: "#ffffff"
  ink-2: "#bcc4de"
  ink-3: "#8e98bb"
  hairline: "rgba(244, 241, 234, 0.24)"
  hairline-strong: "rgba(244, 241, 234, 0.5)"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(44px, 4.6vw, 72px)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "normal"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  question:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.01em"
  figure:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  station:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.1em"
  control:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.16em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  lead:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  badge: "2px"
  chip: "3px"
  control: "4px"
  station: "50%"
spacing:
  chip-gap: "6px"
  inline: "10px"
  stack: "14px"
  gutter: "22px"
  column: "28px"
  page: "40px"
  mobile-gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.scarlet}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.scarlet-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.porcelain}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  button-small:
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-square:
    backgroundColor: "{colors.enamel-deep}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.control}"
    size: "40px"
  button-square-hover:
    backgroundColor: "{colors.enamel-hover}"
  field:
    backgroundColor: "{colors.enamel-deep}"
    textColor: "{colors.porcelain}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "46px"
  nav-item:
    textColor: "{colors.ink-2}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px"
  nav-item-hover:
    backgroundColor: "{colors.enamel-hover}"
    textColor: "{colors.porcelain}"
  nav-item-active:
    backgroundColor: "{colors.enamel-raise}"
    textColor: "{colors.porcelain}"
  tag:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 11px"
    height: "28px"
  stop-chip:
    textColor: "{colors.porcelain}"
    rounded: "{rounded.chip}"
    padding: "0 9px"
    height: "26px"
  line-filter:
    textColor: "{colors.porcelain}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 11px"
    height: "32px"
  badge:
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "0 8px"
    height: "22px"
  badge-dark:
    textColor: "{colors.enamel}"
  card:
    backgroundColor: "{colors.enamel-raise}"
    rounded: "{rounded.control}"
    padding: "18px"
  side-panel:
    backgroundColor: "{colors.enamel-deep}"
    padding: "{spacing.gutter}"
    width: "380px"
  rail:
    backgroundColor: "{colors.enamel-deep}"
    padding: "22px 16px"
    width: "232px"
  station-dot:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.station}"
    size: "34px"
---

# Design System: Nexus

## Overview

**Creative North Star: "The Midnight Transit Mural"**

Nexus is drawn as a city transit system at night. The ground is deep midnight enamel, text is warm porcelain, and each entity type runs on its own line ink, the way a metro map gives every line one colour. The agent's reasoning is a journey: every thinking summary and tool call arrives as a numbered station on a vertical route line, and every entity it reads lights up on the map in order. The whole network stays readable like a transit map rather than a glowing hairball. Once a route exists, only the route burns bright and everything else fades back.

The density is operational. A fixed left rail holds the brand, view switcher and a live status board. Content runs in tall columns divided by hairlines: the journey column and the map in Agent, the map and a station card in Graph, a reading page in MCP. Type speaks in two registers. Condensed, tracked transit capitals (Barlow Condensed) handle every heading, label, control and figure. Plain Barlow handles prose and data values, with tabular figures throughout. Depth comes from layered enamel tones and porcelain hairlines, never from blurred shadows.

The world rejects the usual "AI dashboard" look: no neon glow graph, no chat drawer, no glassy floating cards. It reads like printed enamel signage that happens to move.

**Key Characteristics:**
- Midnight enamel ground in four tonal strata; porcelain ink in three strengths.
- One line ink per entity type, reused everywhere that type appears (dash marker, station ring, link tint, badge).
- Condensed uppercase transit capitals with wide tracking for every label and control.
- Hairline-ruled panels and gently squared corners (2 to 4px); circles are reserved for stations, lamps and dots.
- The signature: the agent's route drawn on the map as a cased porcelain line, station by station, numbered, with the rest of the network dimmed.

## Colors

The palette is a dark enamel ground with porcelain ink and a set of six saturated transit line inks. The line inks are categorical first. A few of them also carry signals.

### Primary
- **Signal Scarlet** (`scarlet`): the departure colour. It fills the one primary action per view (Ask, Test connection) and marks live state: the 3px underline under the active nav item, the blinking dot on the Live tag, the input caret and the error dot. It is also the People line ink.
- **Pressed Scarlet** (`scarlet-deep`): the primary button's hover fill.
- **Error Rose** (`error-ink`): error message text on enamel. Scarlet itself is too dark to hold body-size text on the ground, so this tint carries it.

### Secondary
- **Cobalt Line** (`cobalt`): the Services line ink. It is also the interaction colour for focus inside fields (border plus a 1px ring) and for text selection.

### Tertiary
- **Amber Line** (`amber`): the Teams line ink. It also carries attention states: the busy status lamp, the running duration on the active station, "Planned · unverified" fact flags, the review alert icon and the amber ping ring on the map.
- **Standards Green** (`green`): the Standards line ink. It also marks success: the ready lamp (with a 3px green halo) and the dot on Done and Connected tags.
- **Tool Violet** (`violet`): the Tools line ink, and the GitHub access badge on the MCP page.
- **Guide Teal** (`teal`): the Guides line ink.

### Neutral
- **Midnight Enamel** (`enamel`): the page ground, the map ground, station-dot fills and the halo stroke behind map labels.
- **Deep Enamel** (`enamel-deep`): the recessed stratum for the rail, side panel, input wells, dropdowns, code blocks and figure cells. It is also the base of the translucent map overlays (86% opacity) used by the legend and zoom buttons.
- **Raised Enamel** (`enamel-raise`): the lifted stratum for cards, the answer ("arrival") panel and the active nav item.
- **Hover Enamel** (`enamel-hover`): the hover fill for nav items, list rows, search results and square buttons.
- **Porcelain** (`porcelain`): primary ink. It is used for headings, body text, map labels, station rings, the route line, number stamps and the focus outline.
- **White** (`white`): text on scarlet and cobalt fills, and `strong` emphasis in rendered markdown.
- **Mist Ink** (`ink-2`): secondary text, tinted from the ground. Used for descriptions, thoughts, inactive nav and table body.
- **Dusk Ink** (`ink-3`): tertiary text. Used for small labels, placeholders, counts, metadata and the default line ink for unknown types.
- **Hairline** (`hairline`) and **Strong Hairline** (`hairline-strong`): porcelain at 24% and 50%. Every divider, panel edge and control border is drawn with one of these two.

### Named Rules
**The One Line, One Ink Rule.** Each entity type owns exactly one ink (services cobalt, teams amber, people scarlet, standards green, tools violet, guides teal). Wherever that type appears (the 18 by 4px line dash, a station ring, a link tint, a type badge, a filter button), it uses that ink and no other.

**The Scarlet Departure Rule.** A scarlet fill is reserved for the single primary action in a view. Everywhere else, scarlet appears only as a thin signal: a 3px underline, a 7px dot or a caret.

**The Ink Stays Porcelain Rule.** Prose and headings are set only in porcelain, mist or dusk ink. Line inks never set running text. The one exception is amber, for short status words and timings.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif), weights 500, 600 and 700
**Body Font:** Barlow (with system-ui, sans-serif), weights 400 to 600
**Label/Mono Font:** ui-monospace (with Cascadia Mono, Consolas) for paths, previews and code

**Character:** The condensed face is transit signage: tall, tracked and capitalised, so a label reads at projector distance. Barlow is its plain-text sibling, from the same family, so the two never fight.

### Hierarchy
- **Display** (700, `clamp(44px, 4.6vw, 72px)`, 0.95, uppercase): the welcome headline in the empty Agent view only.
- **Headline** (700, 52px, 0.95, uppercase; 40px on small screens): page titles in reading views (MCP).
- **Title** (700, 34px, 1, 0.02em, uppercase): the selected station's name or "Network" at the top of the side panel.
- **Question** (600, 26px, 1.15, sentence case): the user's question at the head of each turn.
- **Figure** (600, 22 to 26px, 1, tabular): live run stats and network figures; labelled underneath with a Label.
- **Station** (600, 16px, 1.25, 0.1em, uppercase): station headings on the route. The argument runs after it in body type, ellipsised.
- **Control** (600, 15px, 1, 0.14em, uppercase): nav items and buttons; 13px on small buttons.
- **Label** (600, 11.5 to 13px, 1, 0.12 to 0.18em, uppercase): definition terms, table headers, tags, badges, filter buttons and line-ruled section headings.
- **Body** (400, 15px, 1.5, tabular figures): all prose, chips, inputs and table cells. Leads run at 16.5 to 17px, capped at 46 to 62ch.
- **Mono** (400, 12 to 12.5px, 1.5 to 1.55): file paths, tool-output previews, config snippets.

### Named Rules
**The Transit Capitals Rule.** Every heading, label, control and figure is set in Barlow Condensed. Labels and controls are uppercase and tracked between 0.1em and 0.18em. Prose, questions and data values stay in Barlow, sentence case.

**The Tabular Figures Rule.** Tabular numerals are on from the body down, so timings, counts and stats never jitter while they tick.

## Layout

The app shell is a full-height flex row with no page scroll on desktop. A fixed 232px rail sits on the left (22px vertical, 16px horizontal padding, 28px gaps between brand, band, nav and status). Each view fills the rest of the width.

- **Agent:** a journey column (46% wide, max 640px, min 380px) beside a flexible map column. The journey column scrolls its log (28px padding) above an ask bar pinned to the bottom. The map column starts with a 66px stats bar.
- **Graph:** a flexible map column beside a 380px side panel. The search box is 420px wide (max 40%), followed by the line filters.
- **MCP:** a single reading page, max 980px wide with 40px padding. Cards sit in a two-column grid with a 16px gap.

The rhythm runs on a 22px gutter (rail, bars, side panel and map overlays all inset by 22px), 28px for column interiors, 14px and 10px for in-row gaps, and 6px between chips. Vertical breathing between turns is 36px plus a hairline.

The map ground carries a faint porcelain dot grid: 1px dots at 7% opacity every 28px. Overlays sit on top of it: the legend top-left at 22px/82px and the zoom stack bottom-right at 22px.

**Responsive (at 960px and below):** the rail becomes a top bar (brand plus nav, with nav icons, brand subtitle and status board hidden). Views stack vertically and the page scrolls. The Agent map moves above the journey at 46vh, and the Graph map takes 58vh. The ask bar becomes sticky to the bottom, the legend is hidden, the side panel drops under the map, and gutters tighten to 16px.

## Elevation & Depth

The system is flat and tonal. Depth comes from four enamel strata, from Deep (rail, wells, side panel) through Ground and Raise (cards, answer, active nav) to Hover. Porcelain hairlines draw every edge. There are no blurred drop shadows anywhere. The only box-shadows are zero-blur spread rings, and each one signals a state.

### Shadow Vocabulary
- **Focus ring** (`box-shadow: 0 0 0 1px #2f6bff`, together with a cobalt border): a text field that has keyboard focus.
- **Ready halo** (`box-shadow: 0 0 0 3px rgba(34, 177, 76, 0.22)`): the status lamp when the semantic index is ready.
- **Station pulse** (animated from `0 0 0 0 rgba(244, 241, 234, 0.55)` to `0 0 0 12px rgba(244, 241, 234, 0)` over 1.4s): the active station dot on the route.

### Named Rules
**The Enamel Strata Rule.** To lift something, move it one enamel stratum and give it a hairline. Never add a blur shadow or a glow.

## Shapes

The form language is gently squared enamel plates. Controls, inputs, panels, cards, lists and code blocks use a 4px corner. Chips, tags, filter buttons and list-row action buttons use 3px. Badges and the search "via" tag use 2px. Circles are reserved for things that are stations or signals: route dots (34px, with a 3px ring), status lamps (9px), tag dots (7px), map stations and number stamps.

Borders are always 1px porcelain hairlines. The heavy strokes belong to the network: the route spine (3px), dot rings (3px), the active-nav underline (3px) and the line dash (4px tall).

The contract named "square-cornered controls". The build landed on 4px, and this document records the build.

**The Gently Squared Rule.** Rectangles never go above 4px radius and are never pills. A circle always means a station or a signal.

## Components

### Buttons
Tactile signage plates: condensed uppercase, tracked, and pressed down 1px when clicked.
- **Shape:** gently squared (4px), 46px tall, 20px side padding, 1px strong-hairline border, Control type.
- **Primary:** scarlet fill and border with white ink. Hover moves to Pressed Scarlet.
- **Ghost (default):** transparent with a strong-hairline border and porcelain ink. Hover turns the border full porcelain.
- **Small:** 32px tall, 12px padding, 13px type. Used inside panels (Copy, Route on map, Approve and Reject).
- **Square:** a 40px icon button on 86% Deep Enamel, used for map zoom and fit. Hover gives a porcelain border and Hover Enamel fill.
- **States:** a 0.2s colour and border transition. `:active` presses down 1px with the system ease over 0.15s. Disabled drops to 45% opacity with a not-allowed cursor.

### Chips
- **Stop chip** (entity reference): 26px tall, 3px corner, hairline border, 3% porcelain wash, body type at 13px. It leads with a 12 by 3px line dash in the entity's ink, and may carry the station number as a small condensed numeral in dusk ink. Hover sets the border to the entity's own line ink.
- **Tag** (run state): 28px tall, 3px corner, Label type, with a 7px dot before the text. Live state has a scarlet border and a blinking scarlet dot (1.2s). Done has porcelain text and a green dot. Error has a scarlet dot.
- **Line filter** (Graph): 32px, 3px corner, line dash plus name plus count in dusk ink. When toggled off (`aria-pressed=false`) it fades to 38% opacity.
- **Type badge:** a solid fill in the type's line ink, 22px tall, 2px corner, Label type at weight 700. It has two ink variants: white, or enamel (the `dark` variant, used on amber).

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Raised Enamel for cards and the answer panel. Deep Enamel for the side panel, figures and code wells.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** a 1px strong hairline outside, and 1px hairlines between header, body and footer.
- **Internal Padding:** 18px for cards; 12px by 18px for the answer header and footer.
- **Figures grid:** two columns separated by a 1px hairline gap. Each cell has a Label term over a Figure numeral.

### Inputs / Fields
- **Style:** 46px tall, Deep Enamel well, 1px strong-hairline border, 4px corner. A leading 18px stroke icon in dusk ink, body-type input, dusk placeholder and a scarlet caret.
- **Focus:** the border turns cobalt and gains a 1px cobalt ring.
- **Results dropdown:** a Deep Enamel panel 52px below the field. Rows get a hover fill, and each one carries a small Label tag naming how it matched.

### Navigation
- **Rail nav:** a vertical stack with 2px gaps under a hairline. Each item is an 18px stroke icon plus a Control-type label in mist ink. Hover uses Hover Enamel with porcelain ink. The active item gets Raised Enamel, porcelain ink and a 3px scarlet underline inset 10px from each side.
- **Brand lockup:** a 34px network mark (three line inks meeting at a porcelain-ringed interchange), the "NEXUS" wordmark (700, 22px, 0.08em) and a subtitle (11.5px, 0.22em, dusk ink). Below sits an 11px band of four 2px line stripes (scarlet, cobalt, amber, green).
- **Status board:** a definition list pinned to the rail foot. Its 9px lamp shows dusk (unknown), amber (busy) or green with a halo (ready).
- **Mobile:** collapses to a top bar; see Layout.

### Line-ruled Section Heading
A real heading (h2 to h4) set in Label type (13px, 0.18em, mist ink), followed by a hairline that runs to the end of the row. It titles lists such as Popular journeys, Sources, Connections and Review queue. It is the section heading, not a label stacked above another heading.

### Route Station (signature, journey column)
A two-column grid (34px marker, 14px gap) along a vertical spine. The spine is 3px wide, starting 16px from the left, in strong hairline, and turns porcelain once the station is done. The marker is a 34px circle with an enamel fill and a 3px ring. It shows either the step number in condensed 700 or a 15px tool glyph.
- **Pending:** strong-hairline ring with mist ink.
- **Active:** porcelain ring with the station pulse, and the duration in amber.
- **Done:** porcelain ring and spine.
- **Thinking:** a smaller 22px ring with a 6px core dot.

Each station's body holds a Station heading, the argument in body type, thoughts in mist ink, stop chips, and an optional mono preview (left hairline, clipped to about 3 lines). A derived summary line ("Called Search · Open ×2") is set in Label type under thinking stations. Each station arrives with an 8px rise and fade over 0.5s.

### Transit Map (signature, canvas)
Drawn on the dot-grid enamel ground and shared by the Agent and Graph maps.
- **Station:** a 5px porcelain dot with a 2.2px ring in its line ink.
- **Interchange:** any node with 7 or more connections. A 9px enamel dot with a 3.2px porcelain ring and a 3.4px line-ink core.
- **Links:** tinted with the source node's line ink at 1.2 to 1.3px. Opacity is 42% at rest in Agent and 50% in Graph. Proposed facts are dashed (4/3) and stronger (70%).
- **Labels:** 13px screen-size Barlow Condensed 600, uppercase, 0.06em, porcelain. Each sits on a 3.4px enamel halo stroke and is placed right of the dot, else to the left. Route stations may also try below or above. A label that would collide with another label, a dot or a stamp is skipped, so the map never piles up text.
- **Number stamp:** a 10px porcelain disc at the station's top-left, with an enamel condensed-700 numeral showing the order the agent first reached it.
- **Route line:** cased transit stroke. A 10px enamel casing sits under a 5px porcelain core, with round caps and joins, running anchor to anchor. Each leg grows over 650ms with a cubic ease-out.
- **Spurs:** each call's other entities hang off its anchor as dotted porcelain (2/4 dash). The current leg is 2.2px at 85%, earlier legs 1.6px at 30%.
- **Focus marks:** the entity being read pulses a porcelain ring that grows 16px over 1.4s. A chip hover or click rings its entity in amber (3px) for 1.8s. The selected node in Graph gets a 2px porcelain ring 6px out.

**The Route Burns Rule.** Once a route exists, every station off it drops to 14% opacity and every link off it to 5%. The route is the only bright thing on the map. Graph selection follows the same rule: the selected station's neighbourhood stays lit and everything else dims.

**The Legible Map Rule.** Labels are placed in priority order (current station, then stamp order, then interchanges, then the rest) and dropped rather than overlapped.

### Timetable (MCP tools table)
A full-width table with Label-type headers in dusk ink over a strong hairline, and rows separated by hairlines. The first column is a condensed 15px porcelain name. The access column holds a type badge (Read, Write, GitHub).

## Do's and Don'ts

### Do:
- **Do** take every entity colour from its line ink (cobalt, amber, scarlet, green, violet, teal) and use that same ink everywhere the type appears.
- **Do** set every label, heading and control in Barlow Condensed uppercase with 0.1 to 0.18em tracking, and every sentence in Barlow.
- **Do** build depth from the four enamel strata plus 1px porcelain hairlines (24% or 50%).
- **Do** keep rectangles at 2px (badges), 3px (chips) or 4px (controls and panels), and reserve circles for stations and signals.
- **Do** inset bars, panels and map overlays by the 22px gutter, and drop to 16px at 960px and below.
- **Do** use the system ease `cubic-bezier(0.16, 1, 0.3, 1)` for arrivals and presses, 0.2s for colour changes, and disable all animation under `prefers-reduced-motion`.
- **Do** dim everything off the route (stations 14%, links 5%) once the agent starts travelling.

### Don't:
- **Don't** use blurred drop shadows or glows. The only box-shadows are zero-blur spread rings for focus, the ready lamp and the station pulse.
- **Don't** draw the network as a neon hairball. Off-route links stay faint and labels never overlap.
- **Don't** fill more than one action per view with scarlet, or use a line ink for running text (amber status words excepted).
- **Don't** set white ink on a badge fill that cannot hold 4.5:1 at 11.5px. Use the enamel-ink variant instead.
- **Don't** introduce pill shapes, radii above 4px or a third typeface.
- **Don't** stack a small caps label above a display headline. Section labels are themselves headings, ruled out with a trailing hairline.
