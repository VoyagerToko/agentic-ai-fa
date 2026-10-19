# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Technical reviewers (engineers, interviewers) watching a live presentation of the project. They judge whether the agent genuinely reasons over grounded data: which tools it calls, in what order, which entities it reads, and whether the answer traces back to sourced facts. The presenter drives the app on a laptop, often projected.

## Product Purpose
Nexus turns a folder of company documents into a knowledge graph of entities and sourced, reviewable facts, and serves it to people (web app) and to Claude (an in-app agent and an MCP server). Success in the demo: a reviewer watches a question being answered and can see every reasoning step and every graph node the agent touches, live, and believes the answer is grounded rather than generated.

## Positioning
Every fact carries a status (verified or proposed) and a source document, and the agent's path through the graph is fully visible as it happens. The graph is not decoration: it is the agent's working memory made visible.

## Operating Context
- Demo flow: ask a question in the Agent tab; watch thinking summaries, tool calls and lit nodes; read the cited answer; jump to the Graph tab to inspect an entity; show MCP connection to Claude Code.
- Data: 27 dummy markdown documents for a fictional company, Orbit Labs (services, teams, people, standards, tools, guides).
- Runs locally only (localhost), started with `npm start`.

## Capabilities and Constraints
- Agent: one Claude Sonnet 5.5 tool loop (not multi-agent), read-only tools; streams `think` (thinking summaries and `-> tool {args}` lines), `node` (entity touched), `answer`, `error` over Server-Sent Events.
- Tools: graph_search (hybrid keyword + local embeddings), graph_entity, graph_related, graph_stats, graph_review_list, graph_propose and graph_verify (MCP only), repo_list/tree/read/search (GitHub, read-only token).
- Embeddings: local model running inside Node; no external embedding service.
- Frontend: plain HTML/CSS/JS, no build step; libraries from CDN. Tabs: Graph, Agent, MCP (no History tab).
- Must not mention the original source organization anywhere.

## Brand Commitments
Product name: Nexus. Fictional data company: Orbit Labs.

## Evidence on Hand
Real, working agent runs against the dummy graph and the user's own GitHub repositories. No customers, metrics or testimonials exist; none may be invented.

## Product Principles
1. Show the work: every agent step and every touched entity is visible while it happens.
2. Grounded over fluent: sources and fact status are always one glance away.
3. Minimal, understandable code: few files, no build step.
4. Local and self-contained: no assumed servers beyond the Anthropic and GitHub APIs.
