// The knowledge graph store: SQLite (built into Node) holding entities + sourced, reviewable facts.
//
//   node       an entity (service, person, team, standard, tool, guide)
//   statement  a fact "subject -predicate-> object", with a status:
//                verified  = trusted (came from a document or a reviewer approved it)
//                proposed  = a suggestion waiting for review (never treated as truth)
//                deprecated = rejected
//   source     where a fact came from (a document path, a person, the AI)
//   node_fts   full-text index over each node's label + text

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DB_PATH = join(ROOT, 'data', 'graph.db');

// Load the project's .env (API key, GitHub token) for every entry point: server, MCP, ingest.
try {
  process.loadEnvFile(join(ROOT, '.env'));
} catch {
  /* no .env file - rely on real environment variables */
}

mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS node (
    id    INTEGER PRIMARY KEY,
    slug  TEXT UNIQUE NOT NULL,
    type  TEXT NOT NULL,
    label TEXT NOT NULL,
    props TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS statement (
    id         INTEGER PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    predicate  TEXT NOT NULL,
    object_id  INTEGER NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','verified','deprecated')),
    confidence REAL NOT NULL DEFAULT 0,
    added_at   TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS source (
    statement_id INTEGER NOT NULL REFERENCES statement(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,   -- doc | human | ai
    ref  TEXT
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS node_fts USING fts5(slug UNINDEXED, label, body, tokenize = 'porter unicode61');
  CREATE TABLE IF NOT EXISTS node_vec (   -- one embedding per node, for search by meaning (see embed.js)
    slug TEXT PRIMARY KEY REFERENCES node(slug) ON DELETE CASCADE,
    vec  BLOB NOT NULL                     -- Float32 numbers
  );
`);

// Confidence: each source adds 0.25 (max 0.75); a verified fact gets +0.5 on top.
const confidence = (sources, status) => Math.min(1, Math.min(0.75, 0.25 * sources) + (status === 'verified' ? 0.5 : 0));

const nodeId = (slug) => db.prepare('SELECT id FROM node WHERE slug = ?').get(slug)?.id;

/** Insert or update a node, and refresh its full-text index entry. */
export function upsertNode({ slug, type, label, props = {} }) {
  db.prepare(
    `INSERT INTO node (slug, type, label, props) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET type = excluded.type, label = excluded.label, props = excluded.props`,
  ).run(slug, type, label, JSON.stringify(props));
  db.prepare('DELETE FROM node_fts WHERE slug = ?').run(slug);
  db.prepare('INSERT INTO node_fts (slug, label, body) VALUES (?, ?, ?)').run(
    slug,
    label,
    [props.desc, props.body].filter(Boolean).join('\n'),
  );
}

/** Add a fact between two existing nodes. Returns the new statement id. */
export function addStatement({ subject, predicate, object, status = 'proposed', source }) {
  const s = nodeId(subject);
  const o = nodeId(object);
  if (!s) throw new Error(`unknown subject: ${subject}`);
  if (!o) throw new Error(`unknown object: ${object}`);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO statement (subject_id, predicate, object_id, status, confidence) VALUES (?, ?, ?, ?, ?)')
    .run(s, predicate, o, status, confidence(source ? 1 : 0, status));
  if (source) db.prepare('INSERT INTO source (statement_id, kind, ref) VALUES (?, ?, ?)').run(lastInsertRowid, source.kind, source.ref);
  return Number(lastInsertRowid);
}

/** Approve ('verified') or reject ('deprecated') a fact. Returns true if it existed. */
export function setStatus(id, status, reviewer = 'reviewer') {
  const sources = db.prepare('SELECT COUNT(*) c FROM source WHERE statement_id = ?').get(id).c;
  const r = db
    .prepare('UPDATE statement SET status = ?, confidence = ?, reviewed_by = ? WHERE id = ?')
    .run(status, confidence(sources, status), reviewer, id);
  return r.changes > 0;
}

/** One entity with all its facts (outgoing + incoming) and where each fact came from. */
export function getEntity(slug) {
  const node = db.prepare('SELECT * FROM node WHERE slug = ?').get(slug);
  if (!node) return null;
  const facts = (where) =>
    db
      .prepare(
        `SELECT st.id, st.predicate, st.status, st.confidence, s.slug AS subject, s.label AS subject_label,
                o.slug AS object, o.label AS object_label,
                (SELECT group_concat(kind || ':' || ref, ', ') FROM source WHERE statement_id = st.id) AS sources
         FROM statement st JOIN node s ON s.id = st.subject_id JOIN node o ON o.id = st.object_id
         WHERE ${where} AND st.status != 'deprecated' ORDER BY st.predicate`,
      )
      .all(node.id);
  return {
    slug: node.slug,
    type: node.type,
    label: node.label,
    ...JSON.parse(node.props),
    outgoing: facts('st.subject_id = ?'),
    incoming: facts('st.object_id = ?'),
  };
}

/** Everything reachable from a node by following facts outward, up to `depth` hops (e.g. dependency blast radius). */
export function related(slug, depth = 2, predicate = null) {
  return db
    .prepare(
      `WITH RECURSIVE reach(id, depth) AS (
         SELECT id, 0 FROM node WHERE slug = ?
         UNION
         SELECT st.object_id, reach.depth + 1 FROM statement st JOIN reach ON st.subject_id = reach.id
         WHERE reach.depth < ? AND st.status != 'deprecated' AND (? IS NULL OR st.predicate = ?)
       )
       SELECT n.slug, n.label, n.type, MIN(r.depth) AS depth FROM reach r JOIN node n ON n.id = r.id
       WHERE n.slug != ? GROUP BY n.id ORDER BY depth, n.label`,
    )
    .all(slug, depth, predicate, predicate, slug);
}

/** Keyword search (any word, prefix match), best matches first. */
export function search(query, limit = 10) {
  const words = String(query).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) return [];
  return db
    .prepare(
      `SELECT n.slug, n.label, n.type FROM node_fts JOIN node n ON n.slug = node_fts.slug
       WHERE node_fts MATCH ? ORDER BY bm25(node_fts) LIMIT ?`,
    )
    .all(words.map((w) => `"${w}"*`).join(' OR '), limit);
}

/** Store a node's embedding vector. */
export function saveVector(slug, vector) {
  const bytes = Buffer.from(new Float32Array(vector).buffer);
  db.prepare('INSERT INTO node_vec (slug, vec) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET vec = excluded.vec').run(slug, bytes);
}

/** Nodes closest in meaning to a (normalised) query vector. Small graph, so a plain scan is plenty fast. */
export function semanticSearch(vector, limit = 10) {
  const rows = db.prepare('SELECT v.slug, v.vec, n.label, n.type FROM node_vec v JOIN node n ON n.slug = v.slug').all();
  return rows
    .map((r) => {
      const v = new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4);
      let similarity = 0;
      for (let i = 0; i < v.length; i++) similarity += v[i] * vector[i];
      return { slug: r.slug, label: r.label, type: r.type, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/** Facts waiting for a human to approve or reject them. */
export function listProposed(limit = 50) {
  return db
    .prepare(
      `SELECT st.id, s.slug AS subject, st.predicate, o.slug AS object, st.added_at,
              (SELECT group_concat(kind || ':' || ref, ', ') FROM source WHERE statement_id = st.id) AS sources
       FROM statement st JOIN node s ON s.id = st.subject_id JOIN node o ON o.id = st.object_id
       WHERE st.status = 'proposed' ORDER BY st.id DESC LIMIT ?`,
    )
    .all(limit);
}

export function stats() {
  const count = (sql) => db.prepare(sql).get().c;
  return {
    nodes: count('SELECT COUNT(*) c FROM node'),
    facts: count("SELECT COUNT(*) c FROM statement WHERE status != 'deprecated'"),
    verified: count("SELECT COUNT(*) c FROM statement WHERE status = 'verified'"),
    proposed: count("SELECT COUNT(*) c FROM statement WHERE status = 'proposed'"),
    embedded: count('SELECT COUNT(*) c FROM node_vec'),
    byType: db.prepare('SELECT type, COUNT(*) c FROM node GROUP BY type ORDER BY c DESC').all(),
  };
}

/** The whole graph in the shape the Graph tab draws. */
export function graph() {
  const nodes = db.prepare('SELECT slug AS id, label, type, props FROM node').all();
  for (const n of nodes) {
    n.desc = JSON.parse(n.props).desc || '';
    delete n.props;
  }
  const links = db
    .prepare(
      `SELECT st.id, s.slug AS source, o.slug AS target, st.predicate, st.status
       FROM statement st JOIN node s ON s.id = st.subject_id JOIN node o ON o.id = st.object_id
       WHERE st.status != 'deprecated'`,
    )
    .all();
  return { nodes, links, stats: stats() };
}

/** Wipe every node and fact (used before a fresh ingest). */
export function clearGraph() {
  db.exec('DELETE FROM statement; DELETE FROM node; DELETE FROM node_fts;');
}
