# Nexus web app (Agent, Graph, MCP)

Scope: the whole frontend (frontend/index.html, app.js, style.css). Mode: Operate.
Audience: technical reviewers watching a projected live demo; the presenter drives.
Job: ask a question and watch the agent reason; inspect entities; connect Claude via MCP.
Constraints: plain HTML/CSS/JS, no build step; backend API unchanged except additive events and hybrid search.

## Direction contract

THESIS: The agent's reasoning is a journey across a rail network. The category default (dark dashboard, neon hairball graph, chat drawer) is refused: the network stays legible like a transit map, and only the route being travelled burns bright.

OWN-WORLD: Midnight enamel ground (#0B1230 family), porcelain white ink, one line ink per entity type (cobalt services, amber teams, scarlet people, green standards, violet tools, teal guides). Condensed tracked transit capitals (Barlow Condensed) over Barlow body, tabular figures. Stations are porcelain-ringed dots; interchanges are big white rings. Thin porcelain hairline panels, square-cornered controls, scarlet primary action.

STORY: The reviewer asks a question, sees each thinking summary and tool call arrive as a station on a vertical route line, sees every entity the agent reads light up on the map in order with its station number, then reads a sourced answer and trusts it.

FIRST VIEWPORT: Left rail (brand, Agent/Graph/MCP nav, live system status: model, graph size, semantic index). Agent screen: journey column (about 40%) with question, the vertical route of numbered stations with durations and entity chips, the answer, and the ask input pinned at the bottom with scarlet Ask. Map column (about 60%) with run stats strip (stations, tool calls, entities, seconds) and the live network; zoom controls bottom-right.

FORM: Midnight Transit Mural, catalog challenger chosen by the user over the assigned Engineering Computation Pad; seed key 2fa322df. Signature move: the agent's route drawn on the map, station by station, numbered, the rest of the network dimmed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
