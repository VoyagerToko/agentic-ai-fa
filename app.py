"""
Nexus - a company knowledge graph you can explore, ask questions about, and plug into Claude.

    python app.py      ->  open http://localhost:8030

The file is split into 7 sections, read them top to bottom:
    1. Setup        settings, the .env file, the database tables
    2. Graph        reading and changing entities and facts
    3. Ingest       markdown files in knowledge_base/  ->  graph
    4. Search       by keyword (SQLite full-text) and by meaning (embeddings)
    5. Tools        the functions Claude is allowed to call (graph + GitHub)
    6. Agent        the Claude loop that answers a question, step by step
    7. Web server   the routes the web page (static/index.html) talks to
"""

import inspect      # reads a function's name, docstring and parameters (used to describe tools to Claude)
import json         # converts Python data to JSON text and back
import re           # regular expressions, for splitting markdown files and picking out words
import sqlite3      # the database (built into Python, no server needed)
import threading    # runs the embedding job in the background so the server starts instantly
from pathlib import Path

import httpx                           # HTTP client, used to call the GitHub API
import numpy as np                     # fast maths on embedding vectors
from anthropic import Anthropic        # official client for the Claude API
from dotenv import load_dotenv         # reads the .env file
from flask import Flask, Response, jsonify, request, send_file  # the web server

# ─── 1. Setup ──────────────────────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent           # the project folder (where this file lives)
load_dotenv(ROOT / ".env")             # puts ANTHROPIC_API_KEY and GITHUB_TOKEN into os.environ
DOCS = ROOT / "knowledge_base"         # the company documents the graph is built from
DATA = ROOT / "data"                   # generated files: the database and the embedding model
DATA.mkdir(exist_ok=True)              # create data/ the first time
MODEL = "claude-sonnet-5-5"            # the Claude model the agent uses

# One SQLite file holds everything. A "node" is an entity (a service, person, team...).
# A "fact" links two nodes: subject --predicate--> object, e.g. billing-service --dependsOn--> postgres.
# Every fact has a status: verified (trusted), proposed (waiting for review) or rejected.
# check_same_thread=False lets Flask's request threads share this one connection.
db = sqlite3.connect(DATA / "graph.db", check_same_thread=False)
db.row_factory = sqlite3.Row           # rows behave like dicts: row["label"] instead of row[2]
db.executescript("""
    PRAGMA journal_mode = WAL;         -- lets the web server and the MCP server use the file at the same time
    CREATE TABLE IF NOT EXISTS node (
        slug TEXT PRIMARY KEY, type TEXT, label TEXT, description TEXT, body TEXT, path TEXT,
        vector BLOB                                   -- embedding, for search by meaning
    );
    CREATE TABLE IF NOT EXISTS fact (
        id INTEGER PRIMARY KEY, subject TEXT, predicate TEXT, object TEXT,
        status TEXT CHECK (status IN ('verified', 'proposed', 'rejected')),
        source TEXT                                   -- where the fact came from
    );
    -- full-text index: lets us search all document text by keyword, ranked by relevance (BM25)
    CREATE VIRTUAL TABLE IF NOT EXISTS keyword_index USING fts5(slug UNINDEXED, text, tokenize = 'porter');
""")


# Run a SQL query with safe "?" parameters and return the rows as plain Python dicts.
# Every database read in this file goes through this helper.
def rows(sql, *params):
    """Run a query and return the rows as a list of dicts."""
    return [dict(row) for row in db.execute(sql, params)]


# ─── 2. Graph ──────────────────────────────────────────────────────────────────────────────────────
# Load one entity (node) by its slug, then attach every non-rejected fact it takes part in -
# both facts where it is the subject ("billing-service dependsOn postgres") and where it is the
# object ("web-app dependsOn billing-service"). The two JOINs fetch readable labels for both ends.
# Used by: the open_entity tool, the Graph tab's side panel (/api/entity).
def get_entity(slug):
    """One entity plus every fact it takes part in."""
    found = rows("SELECT slug, type, label, description, body, path FROM node WHERE slug = ?", slug)
    if not found:
        return None
    entity = found[0]
    entity["facts"] = rows("""
        SELECT f.id, f.subject, f.predicate, f.object, f.status, f.source,
               s.label AS subject_label, o.label AS object_label
        FROM fact f JOIN node s ON s.slug = f.subject JOIN node o ON o.slug = f.object
        WHERE (f.subject = ? OR f.object = ?) AND f.status != 'rejected'""", slug, slug)
    return entity


# Walk the graph outward from a starting node, hop by hop, up to `depth` hops.
# The recursive SQL query works like a breadth-first search:
#   - start with the node itself at depth 0
#   - repeatedly add every node its facts point to, at depth + 1, until the depth limit
#   - MIN(depth) keeps each node once, at the shortest distance it was found
# Example: related("web-app") -> auth-service (depth 1) -> postgres (depth 2) ...
# Used by: the follow_links tool (dependency "blast radius" questions).
def related(slug, depth=2):
    """Everything reachable by following facts outward, up to `depth` hops (e.g. what a service depends on)."""
    return rows("""
        WITH RECURSIVE reach(slug, depth) AS (
            SELECT ?, 0
            UNION
            SELECT f.object, reach.depth + 1 FROM fact f JOIN reach ON f.subject = reach.slug
            WHERE reach.depth < ? AND f.status != 'rejected'
        )
        SELECT n.slug, n.label, n.type, MIN(reach.depth) AS depth
        FROM reach JOIN node n ON n.slug = reach.slug
        WHERE n.slug != ? GROUP BY n.slug ORDER BY depth""", slug, depth, slug)


# Save one new fact (subject --predicate--> object). New facts are "proposed" by default,
# so nothing becomes trusted until a person approves it. `source` records where it came from.
# Used by: ingest() for facts from documents, and the propose_fact tool (MCP).
def add_fact(subject, predicate, object, status="proposed", source="human"):
    db.execute("INSERT INTO fact (subject, predicate, object, status, source) VALUES (?, ?, ?, ?, ?)",
               (subject, predicate, object, status, source))
    db.commit()


# Change a fact's status to "verified" (approved) or "rejected". Returns True if a fact with
# that id existed. Used by: the Approve/Reject buttons (/api/review) and the verify_fact tool.
def set_status(fact_id, status):
    changed = db.execute("UPDATE fact SET status = ? WHERE id = ?", (status, fact_id)).rowcount
    db.commit()
    return changed > 0


# Count what is in the graph: entities, verified facts, proposed facts, and how many entities
# already have an embedding. Shown in the page header and returned by the graph_stats tool.
def stats():
    count = lambda sql: db.execute(sql).fetchone()[0]   # small helper: run a COUNT(*) query, return the number
    return {
        "nodes": count("SELECT COUNT(*) FROM node"),
        "verified": count("SELECT COUNT(*) FROM fact WHERE status = 'verified'"),
        "proposed": count("SELECT COUNT(*) FROM fact WHERE status = 'proposed'"),
        "embedded": count("SELECT COUNT(*) FROM node WHERE vector IS NOT NULL"),
    }


# ─── 3. Ingest ─────────────────────────────────────────────────────────────────────────────────────
# Each markdown file becomes one node. The folder gives the type, the file name is the slug, and the
# front matter (between the --- lines) gives the facts:
#     ownedBy: platform-team            -> a verified fact
#     ?dependsOn: search-service        -> a leading "?" makes it a proposed fact
# TYPES maps each folder name to the entity type stored in the database.
TYPES = {"services": "service", "teams": "team", "people": "person", "standards": "standard", "tools": "tool", "guides": "guide"}


# Split a markdown file into its two parts:
#   - the front matter between the first two "---" lines, turned into a dict {"ownedBy": "platform-team", ...}
#   - the body text below it (the readable document)
# Files without front matter just return an empty dict and the whole text.
def parse(text):
    """Split a markdown file into (front matter dict, body text)."""
    match = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not match:
        return {}, text
    meta = dict(line.split(":", 1) for line in match.group(1).splitlines() if ":" in line)  # split on the FIRST ":" only
    return {key.strip(): value.strip() for key, value in meta.items()}, match.group(2).strip()


# Rebuild the whole graph from the knowledge_base/ folder, in two passes:
#   pass 1: every file becomes a node (and is added to the keyword index)
#   pass 2: every front-matter key (except label/desc) becomes facts, one per comma-separated value
# Two passes are needed so a fact can point at any document, even one read later.
# Runs automatically on first start (when the database is empty).
def ingest():
    """Rebuild the whole graph from knowledge_base/."""
    db.executescript("DELETE FROM fact; DELETE FROM node; DELETE FROM keyword_index;")  # start clean
    docs = []
    for file in sorted(DOCS.glob("*/*.md")):            # e.g. knowledge_base/services/auth-service.md
        meta, body = parse(file.read_text(encoding="utf-8"))
        path = f"knowledge_base/{file.parent.name}/{file.name}"
        docs.append((file.stem, meta, path))              # remember it for pass 2
        label, description = meta.get("label", file.stem), meta.get("desc", "")
        db.execute("INSERT INTO node (slug, type, label, description, body, path) VALUES (?, ?, ?, ?, ?, ?)",
                   (file.stem, TYPES[file.parent.name], label, description, body, path))
        db.execute("INSERT INTO keyword_index (slug, text) VALUES (?, ?)", (file.stem, f"{label}\n{description}\n{body}"))
    for slug, meta, path in docs:  # second pass: now every node exists, so facts can point at any of them
        for key, value in meta.items():
            if key in ("label", "desc"):                  # these describe the node itself, they are not facts
                continue
            status = "proposed" if key.startswith("?") else "verified"
            for target in filter(None, map(str.strip, value.split(","))):   # "postgres, redis" -> two facts
                add_fact(slug, key.lstrip("?"), target, status, source=path)
    db.commit()


# ─── 4. Search ─────────────────────────────────────────────────────────────────────────────────────
# Keyword search finds exact words. Embeddings turn text into a list of numbers that captures its
# meaning, so "money" can find the Billing Service. The model is small, runs locally, needs no key.
embedder = None   # the embedding model; loaded the first time it is needed, then reused


# Turn a list of texts into embedding vectors (384 numbers each, normalised to length 1).
# Because they are normalised, the "dot product" of two vectors is their similarity (1 = same meaning).
# The model is downloaded once into data/models/ and loaded lazily on first use.
def embed(texts):
    global embedder
    if embedder is None:
        from fastembed import TextEmbedding  # imported here because loading it takes a few seconds
        embedder = TextEmbedding("BAAI/bge-small-en-v1.5", cache_dir=str(DATA / "models"))
    return [np.asarray(vector, dtype=np.float32) for vector in embedder.embed(texts)]


# Give every node that has no embedding yet one, and store it in the database as raw bytes.
# Runs in a background thread at startup; until it finishes, search falls back to keywords only.
def embed_missing():
    """Give every node without an embedding one. Runs in the background at startup."""
    todo = rows("SELECT slug, label, description, body FROM node WHERE vector IS NULL")
    if todo:
        vectors = embed([f"{n['label']}\n{n['description']}\n{n['body']}"[:2000] for n in todo])  # one batch, text capped
        for node, vector in zip(todo, vectors):
            db.execute("UPDATE node SET vector = ? WHERE slug = ?", (vector.tobytes(), node["slug"]))
        db.commit()
        print(f"Semantic index ready: {len(todo)} nodes embedded")


# Hybrid search = keyword search + meaning search, merged into one ranked list.
#   1. Keyword: SQLite full-text search for any of the words (prefix match, e.g. "deploy*").
#   2. Meaning: compare the query's embedding with every node's embedding; keep those with similarity > 0.6.
#   3. Merge with "reciprocal rank fusion": each list adds 1 / (60 + rank) to an item's score, so
#      something ranked high in BOTH lists rises to the top.
# Every result says how it matched: "keyword", "meaning" or "keyword+meaning".
def search(query, limit=8):
    """Hybrid search: keyword hits and meaning hits, merged. Each result says how it matched."""
    found = {}  # slug -> {"score": ..., "matched": [...]}

    # Add one ranked list of slugs to `found`: earlier positions earn a bigger score.
    def add(slugs, how):
        for rank, slug in enumerate(slugs):  # higher rank in either list = higher score
            hit = found.setdefault(slug, {"score": 0, "matched": []})
            hit["score"] += 1 / (60 + rank)
            hit["matched"].append(how)

    words = re.findall(r"\w+", query.lower())   # keep only letters/digits, so punctuation can't break the query
    if words:
        match = " OR ".join(f'"{w}"*' for w in words)   # e.g. '"postgres"* OR "down"*'
        add([r["slug"] for r in rows("SELECT slug FROM keyword_index WHERE keyword_index MATCH ? ORDER BY rank LIMIT ?", match, limit)], "keyword")
    with_vectors = rows("SELECT slug, vector FROM node WHERE vector IS NOT NULL")
    if words and with_vectors:                  # meaning search only once embeddings exist
        query_vector = embed([query])[0]
        # similarity of the query to every node, highest first ("@" is the dot product)
        scored = sorted(((float(np.frombuffer(r["vector"], np.float32) @ query_vector), r["slug"]) for r in with_vectors), reverse=True)
        add([slug for similarity, slug in scored[:limit] if similarity > 0.6], "meaning")

    best = sorted(found, key=lambda slug: -found[slug]["score"])[:limit]   # highest combined score first
    labels = {r["slug"]: r for r in rows("SELECT slug, label, type FROM node")}
    return [{**labels[slug], "matched": "+".join(found[slug]["matched"])} for slug in best]


# ─── 5. Tools ──────────────────────────────────────────────────────────────────────────────────────
# Plain functions with type hints and a docstring. The agent (section 6) and the MCP server
# (mcp_server.py) both use these same functions. Each returns text for Claude to read.
# The DOCSTRING of each tool is what Claude reads to decide when to use it, so it is written for Claude.
# `touched` collects the entities a tool looked at, so the web page can highlight them.
touched = []


# Tool: hybrid-search the graph and list the matching entities (slug, name, type, how it matched).
# Claude usually calls this first to find out which entities exist.
def search_graph(query: str) -> str:
    """Search the company knowledge graph (services, teams, people, standards, tools, guides) by keywords and meaning. Use it first to find which entities exist."""
    hits = search(query)
    touched.extend(h["slug"] for h in hits)
    return "\n".join(f"{h['slug']} - {h['label']} [{h['type']}] (matched by {h['matched']})" for h in hits) or "no matches"


# Tool: give Claude everything about one entity - description, every fact (with its status,
# source document and id) and the full document text - formatted as readable Markdown.
def open_entity(slug: str) -> str:
    """Open one entity by slug: its description, all its facts (with status and source) and its full document. Check this before saying something is missing."""
    entity = get_entity(slug)
    if not entity:
        return f"no entity called {slug}"
    touched.append(slug)
    facts = [f"- {f['subject_label']} --{f['predicate']}--> {f['object_label']} [{f['status']}, from {f['source']}] (fact id {f['id']})" for f in entity["facts"]]
    return f"# {entity['label']} ({entity['type']})\n{entity['description']}\n\n## Facts\n" + "\n".join(facts) + f"\n\n## Document\n{entity['body']}"


# Tool: list everything reachable from an entity by following facts outward (multi-hop).
# The depth Claude asks for is clamped to between 1 and 4 hops to keep results small.
def follow_links(slug: str, depth: int = 2) -> str:
    """Follow facts outward from an entity, several hops deep (e.g. everything a service depends on, directly or indirectly)."""
    found = related(slug, min(max(depth, 1), 4))
    touched.extend(r["slug"] for r in found)
    return "\n".join(f"{r['label']} [{r['type']}, slug {r['slug']}] at depth {r['depth']}" for r in found) or "nothing linked"


# Tool: return the graph's size (entities, verified/proposed facts, embedded entities) as JSON text.
def graph_stats() -> str:
    """How big the knowledge graph is: nodes, verified and proposed facts."""
    return json.dumps(stats())


# Tool: list every proposed (unverified) fact with its id, so a reviewer can approve or reject it.
def review_queue() -> str:
    """List proposed facts that are waiting for someone to approve or reject them."""
    pending = rows("SELECT id, subject, predicate, object, source FROM fact WHERE status = 'proposed'")
    return "\n".join(f"fact {f['id']}: {f['subject']} --{f['predicate']}--> {f['object']} (from {f['source']})" for f in pending) or "nothing to review"


# Write tool (MCP only): suggest a new fact. It is saved as "proposed" with source "mcp",
# so it never counts as trusted until a person approves it.
def propose_fact(subject: str, predicate: str, object: str) -> str:
    """Suggest a new fact between two existing entities. It is stored as proposed until someone verifies it."""
    add_fact(subject, predicate, object, "proposed", "mcp")
    return f"Proposed: {subject} --{predicate}--> {object} (waiting for review)"


# Write tool (MCP only): approve (verified) or reject a proposed fact by its id.
def verify_fact(fact_id: int, approve: bool) -> str:
    """Approve (approve=true) or reject (approve=false) a proposed fact by its id."""
    return "done" if set_status(fact_id, "verified" if approve else "rejected") else f"no fact {fact_id}"


# Helper (not a tool): send an authenticated GET request to the GitHub REST API using the
# GITHUB_TOKEN from .env. raw=True asks GitHub for a file's raw text instead of JSON.
# Errors (bad repo, no access) raise an exception, which run_tool turns into an "Error: ..." message.
def github(path, raw=False):
    """Call the GitHub API with the token from .env (read-only use)."""
    headers = {"Authorization": f"Bearer {__import__('os').environ['GITHUB_TOKEN']}",
               "Accept": "application/vnd.github.raw" if raw else "application/vnd.github+json"}
    response = httpx.get(f"https://api.github.com/{path}", headers=headers, timeout=30)
    response.raise_for_status()
    return response.text if raw else response.json()


# Tool: list the GitHub repositories the token can see (name, main language, description).
def list_repos() -> str:
    """List the GitHub repositories the configured token can access."""
    return "\n".join(f"{r['full_name']} [{r['language']}] - {r['description'] or ''}" for r in github("user/repos?per_page=100&sort=updated"))


# Tool: list all files in a repository. First asks GitHub for the default branch (e.g. "main"),
# then fetches that branch's full file tree and keeps only files ("blob"), capped at 300.
def repo_files(repo: str) -> str:
    """List the files in a GitHub repository (owner/name), to decide which ones to read."""
    branch = github(f"repos/{repo}")["default_branch"]
    files = [item["path"] for item in github(f"repos/{repo}/git/trees/{branch}?recursive=1")["tree"] if item["type"] == "blob"]
    return "\n".join(files[:300])


# Tool: read one file's text from a repository, cut at 16,000 characters so it fits Claude's context.
def read_file(repo: str, path: str) -> str:
    """Read one file from a GitHub repository (owner/name). Long files are cut at 16,000 characters."""
    return github(f"repos/{repo}/contents/{path}", raw=True)[:16000]


# Tool: GitHub code search inside one repository; returns the paths of matching files.
def search_code(repo: str, query: str) -> str:
    """Search the code of a GitHub repository (owner/name) for a word; returns matching file paths."""
    return "\n".join(item["path"] for item in github(f"search/code?q={query}+repo:{repo}")["items"]) or "no matches"


# The two tool lists. The agent only ever gets READ_TOOLS (it can look but never change data);
# the MCP server gets both lists.
READ_TOOLS = [search_graph, open_entity, follow_links, graph_stats, review_queue, list_repos, repo_files, read_file, search_code]
WRITE_TOOLS = [propose_fact, verify_fact]  # only offered over MCP; the agent is read-only


# Describe a Python function in the JSON format the Claude API expects for a tool:
#   name         -> the function's name
#   description  -> its docstring (this is how Claude learns what the tool is for)
#   input_schema -> one property per parameter, typed from the type hints (str -> "string", ...);
#                   parameters without a default value are "required"
# Example: follow_links(slug: str, depth: int = 2) -> slug is required, depth is optional.
def tool_definition(fn):
    """Describe a Python function the way the Claude API expects: name, description, input schema."""
    types = {str: "string", int: "integer", bool: "boolean"}
    params = inspect.signature(fn).parameters
    return {
        "name": fn.__name__,
        "description": inspect.getdoc(fn),
        "input_schema": {
            "type": "object",
            "properties": {name: {"type": types[p.annotation]} for name, p in params.items()},
            "required": [name for name, p in params.items() if p.default is p.empty],
        },
    }


# Find a tool by the name Claude asked for and call it with Claude's arguments.
# Any error (unknown tool, bad input, GitHub failure) is returned as text instead of crashing,
# so Claude can read what went wrong and try a different tool or input.
def run_tool(name, arguments):
    """Call a tool by name. Errors come back as text, so Claude can read them and try something else."""
    tool = {fn.__name__: fn for fn in READ_TOOLS + WRITE_TOOLS}.get(name)
    try:
        return tool(**arguments) if tool else f"unknown tool {name}"
    except Exception as error:
        return f"Error: {error}"


# ─── 6. Agent ──────────────────────────────────────────────────────────────────────────────────────
# A loop: send the question + tools to Claude; if Claude asks for tools, run them and send the results
# back; repeat until Claude answers. It is a generator: it `yield`s each step so the page sees it live.
# SYSTEM is the system prompt: Claude's role, what the relationships mean, which tool to use when,
# and the rules for answering (cite entities, flag unverified facts, never invent facts).
SYSTEM = """You are Nexus, an assistant for a company knowledge graph. It holds the company's services, teams, people, standards, tools and guides, linked by facts (ownedBy, dependsOn, memberOf, ledBy, mustSatisfy, maintainedBy, relatesTo). Facts are "verified" (trusted) or "proposed" (unconfirmed - say so when you use one).

Use search_graph to find entities, open_entity to read one in full, and follow_links to trace dependencies or ownership. Only use the GitHub tools when the answer needs live source code. Never say a fact is missing before opening the entity.

Answer in Markdown and name the entities you used. Never invent facts."""


# Answer one question with Claude, step by step. Each round:
#   1. Send the conversation + the read-only tools to Claude.
#   2. Pass on any reasoning summaries ("think" events) so the page can show them.
#   3. If Claude asked for no tools, its text is the final answer -> yield "answer" and stop.
#   4. Otherwise run each requested tool, report it ("tool" event) and every entity it touched
#      ("node" events, which light up on the graph), and send all results back to Claude.
# It stops after 25 rounds at most, as a safety limit.
# `history` holds earlier questions and answers of this chat (last 6 kept), so follow-ups work.
def run_agent(question, history):
    client = Anthropic()  # reads ANTHROPIC_API_KEY
    messages = history[-6:] + [{"role": "user", "content": question}]
    used = []  # every entity the agent touched, in order
    for _ in range(25):  # safety limit on the number of rounds
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,                    # upper limit on the reply length (you pay only for what is used)
            system=SYSTEM,
            tools=[tool_definition(fn) for fn in READ_TOOLS],
            messages=messages,
            thinking={"type": "adaptive", "display": "summarized"},  # readable summaries of Claude's reasoning
            output_config={"effort": "medium"},  # how hard Claude thinks: balanced speed and depth
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",  # if a safety filter declines, Anthropic retries on a fallback model
        )
        if response.stop_reason == "refusal":    # Claude's safety filter declined the request
            yield "answer", {"answer": "Sorry, I can't help with that.", "entities": used}
            return
        messages.append({"role": "assistant", "content": response.content})  # keep it exactly as returned

        for block in response.content:           # show Claude's reasoning summary, if any
            if block.type == "thinking" and block.thinking.strip():
                yield "think", {"text": block.thinking.strip()}

        calls = [block for block in response.content if block.type == "tool_use"]
        if not calls:  # no more tools wanted: this is the final answer
            answer = "".join(block.text for block in response.content if block.type == "text")
            yield "answer", {"answer": answer, "entities": used}
            return

        results = []
        for call in calls:
            yield "tool", {"name": call.name, "input": call.input}   # the page adds a step line
            touched.clear()                       # collect only what THIS tool touches
            output = run_tool(call.name, call.input)
            for slug in dict.fromkeys(touched):  # unique, in order
                used.append(slug) if slug not in used else None
                yield "node", {"slug": slug}     # the page lights this entity up on the graph
            # the tool's answer goes back to Claude, matched to its request by id (capped at 20,000 characters)
            results.append({"type": "tool_result", "tool_use_id": call.id, "content": output[:20000]})
        messages.append({"role": "user", "content": results})  # all results go back in one message
    yield "answer", {"answer": "I stopped after too many steps - try a narrower question.", "entities": used}


# ─── 7. Web server ─────────────────────────────────────────────────────────────────────────────────
# Flask routes. The page (static/index.html) calls these with fetch() and EventSource.
app = Flask(__name__)
chats = {}  # chat id -> earlier turns, so follow-up questions have context


# GET /  -> send the web page.
@app.get("/")
def page():
    return send_file(ROOT / "static" / "index.html")


# GET /api/graph  -> every entity and every non-rejected fact (to draw the graph), plus the counts.
# Columns are renamed (slug AS id, subject AS source ...) to the names the graph library expects.
@app.get("/api/graph")
def api_graph():
    nodes = rows("SELECT slug AS id, label, type, description FROM node")
    links = rows("SELECT id, subject AS source, object AS target, predicate, status FROM fact WHERE status != 'rejected'")
    return jsonify(nodes=nodes, links=links, stats=stats())


# GET /api/search?q=...  -> hybrid search results for the Graph tab's search box.
@app.get("/api/search")
def api_search():
    return jsonify(search(request.args.get("q", "")))


# GET /api/entity/<slug>  -> one entity with its facts, for the Graph tab's details panel.
@app.get("/api/entity/<slug>")
def api_entity(slug):
    return jsonify(get_entity(slug) or {})


# POST /api/review  with {"id": 46, "status": "verified"}  -> approve or reject a proposed fact.
@app.post("/api/review")
def api_review():
    body = request.get_json()
    return jsonify(ok=set_status(body["id"], body["status"]))


# GET /api/tools  -> every tool's name and description, and whether it changes data (for the MCP tab).
@app.get("/api/tools")
def api_tools():
    return jsonify([{"name": fn.__name__, "description": inspect.getdoc(fn), "writes": fn in WRITE_TOOLS} for fn in READ_TOOLS + WRITE_TOOLS])


# GET /api/ask?q=...&chat=...  -> run the agent and stream every step to the page as it happens,
# using Server-Sent Events: each event is sent as "event: <name>\ndata: <json>\n\n" and the
# browser's EventSource receives it immediately. When the answer arrives, the question and answer
# are saved in this chat's history. Errors are sent as a "failed" event instead of crashing.
@app.get("/api/ask")
def api_ask():
    """Answer a question, streaming each step to the page as a Server-Sent Event."""
    question, chat_id = request.args["q"], request.args.get("chat", "default")

    # Generator Flask streams to the browser piece by piece (one SSE frame per agent event).
    def stream():
        history = chats.setdefault(chat_id, [])
        try:
            for event, data in run_agent(question, history):
                yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
                if event == "answer":
                    history += [{"role": "user", "content": question}, {"role": "assistant", "content": data["answer"]}]
        except Exception as error:
            yield f"event: failed\ndata: {json.dumps({'error': str(error)})}\n\n"

    return Response(stream(), mimetype="text/event-stream")


# Start-up when run as `python app.py`:
#   1. build the graph from knowledge_base/ if the database is empty
#   2. start computing embeddings in the background (search by meaning turns on when done)
#   3. start the web server on http://localhost:8030 (localhost only; threaded so many requests can run)
if __name__ == "__main__":
    if stats()["nodes"] == 0:
        ingest()
    threading.Thread(target=embed_missing, daemon=True).start()  # search by meaning turns on when ready
    print("Nexus running at http://localhost:8030")
    app.run(host="127.0.0.1", port=8030, threaded=True)
