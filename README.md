# Nexus: an agentic knowledge-graph assistant

Ask questions about a company (its services, teams, people, standards, tools and guides) and watch an AI agent
plan, search, follow relationships and read GitHub code step by step to answer them, with sources.

## Run it

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # then put your ANTHROPIC_API_KEY and GITHUB_TOKEN in .env
python app.py                     # open http://localhost:8030
```

The first start builds the graph from `knowledge_base/` and downloads a small embedding model (~70 MB).
After editing documents, delete `data/graph.db` and start again to rebuild.

## Folder structure

```
agentic ai/
├── app.py               server: graph, ingest, search, tools, agent loop, web routes (7 sections)
├── mcp_server.py        MCP server: the same tools for Claude Code / Claude Desktop
├── static/
│   └── index.html       web page: Agent, Graph and MCP tabs
├── knowledge_base/      company documents the graph is built from (fictional company "Orbit Labs")
│   ├── services/  teams/  people/  standards/  tools/  guides/
├── report/              project report (Word, PDF, Markdown) and architecture diagram
├── data/                generated: SQLite database + embedding model cache (not committed)
├── requirements.txt     Python packages
└── .env.example         template for your API keys (.env is not committed)
```

## How it works

1. **Ingest:** each markdown file in `knowledge_base/` becomes an entity; its front matter becomes facts,
   e.g. `dependsOn: postgres, redis`. A `?` in front (`?dependsOn:`) marks a fact as *proposed* (unverified).
2. **Search:** keyword search (SQLite full-text) plus search by meaning (local embeddings), merged.
3. **Agent:** Claude Sonnet 5.5 gets the question and a list of tools, and calls them in a loop until it can
   answer. Every step is streamed to the page, and the entities it used light up on the graph.
4. **MCP:** `mcp_server.py` serves the same tools so Claude Code or Claude Desktop can use them directly.

Connect Claude Code: `claude mcp add nexus -- .venv\Scripts\python.exe mcp_server.py` (run in this folder).
