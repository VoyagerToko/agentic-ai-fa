# Nexus — Company Knowledge Graph

Nexus turns a folder of company documents into a **knowledge graph** and serves it two ways:

- **to people**, through a small web app (Graph · Agent · MCP tabs)
- **to Claude**, through an **Agent** (Claude Sonnet 5.5 with tools) and an **MCP server**

Every fact in the graph is *sourced* (it records the document it came from) and has a *status*:
**verified** facts are trusted, while **proposed** facts are suggestions that wait for someone to approve or reject them.

> The bundled documents describe **Orbit Labs**, a made-up company, so the project can be demoed out of the box.

## Quick start

Requires **Node.js 22.13+**. There is no database to install, because SQLite is built into Node.

```bash
npm install
cp .env.example .env      # then add your ANTHROPIC_API_KEY and GITHUB_TOKEN
npm start                 # http://localhost:8030
```

The graph is built from the documents automatically on first start. After editing documents, run `npm run ingest` to rebuild it.

## Project structure

```
backend/
  server.js    web server: frontend files, JSON API, live Agent stream, /mcp endpoint
  db.js        the graph store (SQLite): nodes, facts, search, traversal, review
  ingest.js    reads docs/ and builds the graph
  tools.js     the tool catalogue (graph + GitHub), shared by the Agent and MCP
  agent.js     Claude Sonnet 5.5 tool loop that answers questions
  mcp.js       MCP server (stdio, plus the HTTP handler used by server.js)
  docs/        the source documents: services, teams, people, standards, tools, guides
frontend/
  index.html   page layout with the three tabs
  app.js       Graph, Agent and MCP tab logic
  style.css    styles (light and dark)
```

## How it works

1. **Documents → graph.** Each markdown file in `backend/docs/<folder>/` becomes a node. The folder sets the type, and the file name is the slug.
   The front matter holds the relationships:

   ```markdown
   ---
   label: Billing Service
   desc: Plans, subscriptions, invoices and payments.
   ownedBy: product-team
   dependsOn: auth-service, postgres, kafka
   ?dependsOn: notification-service      # leading "?" = proposed (unconfirmed) fact
   ---
   # Billing Service
   ...body text (searchable)...
   ```

2. **Graph tab.** An interactive map of every node. Click a node to see its facts, open neighbours, and approve or reject proposed facts.
3. **Agent tab.** Ask a question. Claude decides which tools to call (search the graph, open an entity, follow dependencies, read GitHub repos), and you watch the steps and touched nodes live before the answer arrives.
4. **MCP tab.** Connect Claude Code or Claude Desktop to the same tools, over HTTP or stdio, and test the connection from the browser.

## Tools (shared by the Agent and MCP)

| Tool | What it does |
|---|---|
| `graph_search` | keyword search across all entities |
| `graph_entity` | one entity with all its facts and document text |
| `graph_related` | follow facts several hops, e.g. dependency blast radius |
| `graph_stats` | graph size and breakdown |
| `graph_review_list` | proposed facts waiting for review |
| `graph_propose` | add a proposed fact *(MCP only)* |
| `graph_verify` | approve or reject a proposed fact *(MCP only)* |
| `repo_list` / `repo_tree` / `repo_read` / `repo_search` | read GitHub repositories live, using your token |

## Connect Claude via MCP

```bash
# HTTP (while `npm start` is running)
claude mcp add --transport http nexus http://localhost:8030/mcp

# or stdio (Claude starts the server itself)
claude mcp add nexus -- node "/absolute/path/to/backend/mcp.js"
```

The server listens on `127.0.0.1` only, with no login, so it is meant for local use and demos.
