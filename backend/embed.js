// Semantic search: every node gets an embedding (a 384-number "meaning" vector) from a small model that
// runs locally inside Node (all-MiniLM-L6-v2, ~25 MB, downloaded once into data/models). No API key and
// no server needed. Keyword search finds exact words; embeddings find related meaning ("money" ->
// Billing Service). hybridSearch() blends both.

import { join } from 'node:path';
import { ROOT, db, search, saveVector, semanticSearch } from './db.js';

const MODEL = 'Xenova/all-MiniLM-L6-v2';

/** Live status, shown in the UI: off -> loading -> ready (or error, then search stays keyword-only). */
export const embeddings = { state: 'off', model: MODEL, error: null };

let extractor;
async function getExtractor() {
  if (!extractor) {
    const { pipeline, env } = await import('@huggingface/transformers'); // loaded on first use only
    env.cacheDir = join(ROOT, 'data', 'models');
    extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  }
  return extractor;
}

/** Turn texts into normalised vectors (so a dot product = cosine similarity). */
export async function embedTexts(texts) {
  const output = await (await getExtractor())(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
}

/** Embed every node that has no vector yet. Safe to call repeatedly; runs in the background at startup. */
export async function embedMissing() {
  const rows = db.prepare('SELECT slug, label, props FROM node WHERE slug NOT IN (SELECT slug FROM node_vec)').all();
  if (!rows.length) return (embeddings.state = 'ready');
  embeddings.state = 'loading';
  try {
    const texts = rows.map((r) => {
      const p = JSON.parse(r.props);
      return [r.label, p.desc, p.body].filter(Boolean).join('\n').slice(0, 2000);
    });
    const vectors = await embedTexts(texts);
    rows.forEach((r, i) => saveVector(r.slug, vectors[i]));
    embeddings.state = 'ready';
    console.error(`[nexus] semantic index ready: ${rows.length} nodes embedded`);
  } catch (e) {
    embeddings.state = 'error';
    embeddings.error = e.message;
    console.error(`[nexus] embeddings unavailable, keyword search only: ${e.message}`);
  }
}

/**
 * Keyword + meaning search, merged with reciprocal rank fusion (an item ranked high by either method
 * rises; ranked high by both rises most). Each hit says how it matched: keyword, meaning, or both.
 */
export async function hybridSearch(query, limit = 10) {
  const hits = new Map();
  const add = (list, via) =>
    list.forEach((h, rank) => {
      const hit = hits.get(h.slug) || { slug: h.slug, label: h.label, type: h.type, via: [], score: 0 };
      hit.via.push(via);
      hit.score += 1 / (60 + rank);
      hits.set(h.slug, hit);
    });

  add(search(query, limit), 'keyword');
  if (embeddings.state === 'ready' && query.trim()) {
    const [vector] = await embedTexts([query]);
    add(semanticSearch(vector, limit).filter((h) => h.similarity > 0.25), 'meaning');
  }
  return [...hits.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => ({ ...h, via: h.via.join('+') }));
}
