// Builds the graph from the markdown documents in backend/docs/.
//
// The folder decides the type (docs/services/*.md -> "service"), the file name is the slug, and the
// front matter holds the facts:
//
//   ---
//   label: Auth Service
//   desc: One-line summary.
//   ownedBy: platform-team            <- any other key is a relationship to other slugs
//   dependsOn: postgres, redis
//   ?dependsOn: search-service        <- a leading "?" makes it a PROPOSED fact (waits for review)
//   ---
//   Markdown body (stored as searchable text)
//
// Run: npm run ingest   (rebuilds the graph from scratch)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, db, upsertNode, addStatement, clearGraph, stats } from './db.js';
import { embedMissing } from './embed.js';

const DOCS = join(ROOT, 'backend', 'docs');
const TYPES = { services: 'service', teams: 'team', people: 'person', standards: 'standard', tools: 'tool', guides: 'guide' };

/** Split a markdown file into { meta: {key: value}, body }. */
function parse(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() };
}

export function ingest() {
  const docs = [];
  for (const [folder, type] of Object.entries(TYPES)) {
    for (const file of readdirSync(join(DOCS, folder)).filter((f) => f.endsWith('.md'))) {
      const path = `docs/${folder}/${file}`;
      docs.push({ slug: file.replace(/\.md$/, ''), type, path, ...parse(readFileSync(join(DOCS, folder, file), 'utf8')) });
    }
  }

  db.exec('BEGIN');
  try {
    clearGraph();
    // Pass 1: every document becomes a node (so pass 2 can link to any of them).
    for (const d of docs) {
      upsertNode({ slug: d.slug, type: d.type, label: d.meta.label || d.slug, props: { desc: d.meta.desc || '', body: d.body, path: d.path } });
    }
    // Pass 2: every other front-matter key becomes facts.
    for (const d of docs) {
      for (const [key, value] of Object.entries(d.meta)) {
        if (key === 'label' || key === 'desc') continue;
        const proposed = key.startsWith('?');
        for (const object of value.split(',').map((s) => s.trim()).filter(Boolean)) {
          addStatement({
            subject: d.slug,
            predicate: proposed ? key.slice(1) : key,
            object,
            status: proposed ? 'proposed' : 'verified',
            source: { kind: 'doc', ref: d.path },
          });
        }
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return stats();
}

/** Build the graph on first run, so a fresh clone works without a separate ingest step. */
export function ingestIfEmpty() {
  if (stats().nodes === 0) ingest();
}

// `node backend/ingest.js` -> rebuild, embed every node for semantic search, print a summary.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  ingest();
  await embedMissing();
  const s = stats();
  console.log(`Graph rebuilt: ${s.nodes} nodes, ${s.verified} verified facts, ${s.proposed} proposed facts, ${s.embedded} embedded.`);
}
