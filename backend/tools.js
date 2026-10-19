// ONE tool catalogue, shared by the Agent (agent.js) and the MCP server (mcp.js), so both expose the
// exact same abilities. Each tool = { name, description, input_schema, write?, run(input, onNode) }.
//   write: true  -> changes the graph; offered over MCP but not to the read-only Agent.
//   onNode(slug) -> optional callback; graph tools call it for every entity they touch, which is how
//                   the Agent tab lights up nodes while the agent works.

import { getEntity, related, stats, addStatement, listProposed, setStatus } from './db.js';
import { hybridSearch } from './embed.js';

// ── GitHub (REST API, authenticated with the personal access token from .env) ─────────────────────
const GH_TOKEN = () => process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function github(path, accept = 'application/vnd.github+json') {
  if (!GH_TOKEN()) throw new Error('GitHub is not configured - set GITHUB_TOKEN in .env');
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN()}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return accept.endsWith('raw') ? res.text() : res.json();
}

const repoArg = { type: 'string', description: 'owner/name, e.g. octocat/hello-world' };
const refArg = { type: 'string', description: 'branch, tag or commit (default branch when omitted)' };
const slugArg = { type: 'string', description: 'entity slug, e.g. "auth-service"' };

// Turn an entity into compact readable text for the model.
function describe(e) {
  const line = (f, out) => `- ${out ? e.label : f.subject_label} --${f.predicate}--> ${out ? f.object_label : e.label}` +
    ` [${f.status}${f.sources ? ', ' + f.sources : ''}] (id ${f.id})`;
  return [
    `# ${e.label} (${e.type}, slug: ${e.slug})`,
    e.desc,
    '## Facts',
    ...e.outgoing.map((f) => line(f, true)),
    ...e.incoming.map((f) => line(f, false)),
    '## Document text',
    e.body || '(none)',
  ].join('\n');
}

export const TOOLS = [
  // ── Knowledge graph ──────────────────────────────────────────────────────────────────────────────
  {
    name: 'graph_search',
    description: 'Search the company knowledge graph (services, teams, people, standards, tools, guides) by keywords AND meaning (local embeddings), so related wording also matches. Use it first to find which entities exist.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    run: async ({ query }, onNode) => {
      const hits = await hybridSearch(query, 10);
      hits.forEach((h) => onNode?.(h.slug));
      return hits.length ? hits.map((h) => `${h.slug} - ${h.label} [${h.type}] (matched by ${h.via})`).join('\n') : 'no matches';
    },
  },
  {
    name: 'graph_entity',
    description: 'Open one entity by slug: its description, every fact about it (owners, dependencies, members, standards) with status and source, and its full document text. Always check this before saying a fact is missing.',
    input_schema: { type: 'object', properties: { slug: slugArg }, required: ['slug'] },
    run: ({ slug }, onNode) => {
      const e = getEntity(slug);
      if (!e) return `no entity with slug "${slug}"`;
      onNode?.(slug);
      return describe(e);
    },
  },
  {
    name: 'graph_related',
    description: 'Follow facts outward from an entity, several hops deep - e.g. everything a service depends on, directly or indirectly. Optionally follow only one relationship such as "dependsOn".',
    input_schema: {
      type: 'object',
      properties: { slug: slugArg, depth: { type: 'integer', description: '1-4, default 2' }, predicate: { type: 'string' } },
      required: ['slug'],
    },
    run: ({ slug, depth = 2, predicate }, onNode) => {
      const r = related(slug, Math.min(4, Math.max(1, depth)), predicate || null);
      r.forEach((x) => onNode?.(x.slug));
      return r.length ? r.map((x) => `${x.label} [${x.type}, slug ${x.slug}] at depth ${x.depth}`).join('\n') : 'nothing related';
    },
  },
  {
    name: 'graph_stats',
    description: 'Size of the knowledge graph: node count, verified vs proposed facts, nodes per type.',
    input_schema: { type: 'object', properties: {} },
    run: () => JSON.stringify(stats(), null, 2),
  },
  {
    name: 'graph_review_list',
    description: 'List PROPOSED facts that are waiting for a human to approve or reject them.',
    input_schema: { type: 'object', properties: {} },
    run: () => {
      const rows = listProposed();
      return rows.length ? rows.map((r) => `#${r.id}: ${r.subject} --${r.predicate}--> ${r.object} (${r.sources || 'no source'})`).join('\n') : 'nothing to review';
    },
  },
  {
    name: 'graph_propose',
    write: true,
    description: 'Propose a new fact between two existing entities. It is stored as PROPOSED and is not trusted until someone verifies it.',
    input_schema: {
      type: 'object',
      properties: { subject: slugArg, predicate: { type: 'string', description: 'e.g. dependsOn, ownedBy, memberOf' }, object: slugArg, note: { type: 'string' } },
      required: ['subject', 'predicate', 'object'],
    },
    run: ({ subject, predicate, object, note }) => {
      const id = addStatement({ subject, predicate, object, status: 'proposed', source: { kind: 'human', ref: note || 'mcp' } });
      return `Proposed fact #${id}: ${subject} --${predicate}--> ${object} (awaiting review)`;
    },
  },
  {
    name: 'graph_verify',
    write: true,
    description: 'Approve (status "verified") or reject (status "deprecated") a proposed fact by its id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' }, status: { type: 'string', enum: ['verified', 'deprecated'] }, reviewer: { type: 'string' } },
      required: ['id', 'status'],
    },
    run: ({ id, status, reviewer }) => (setStatus(id, status, reviewer || 'mcp') ? `#${id} is now ${status}` : `no fact #${id}`),
  },

  // ── Live GitHub repositories ────────────────────────────────────────────────────────────────────
  {
    name: 'repo_list',
    description: 'List the GitHub repositories the configured token can access (name, language, description).',
    input_schema: { type: 'object', properties: {} },
    run: async () => {
      const repos = await github('user/repos?per_page=100&sort=updated');
      return repos.map((r) => `${r.full_name}${r.language ? ` [${r.language}]` : ''}${r.description ? ' - ' + r.description : ''}`).join('\n') || 'no repositories';
    },
  },
  {
    name: 'repo_tree',
    description: 'List the files in a GitHub repository, to decide which ones are worth reading.',
    input_schema: { type: 'object', properties: { repo: repoArg, ref: refArg }, required: ['repo'] },
    run: async ({ repo, ref }) => {
      const branch = ref || (await github(`repos/${repo}`)).default_branch;
      const tree = await github(`repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      const files = tree.tree.filter((t) => t.type === 'blob').map((t) => t.path);
      return `${repo}@${branch} - ${files.length} files:\n` + files.slice(0, 300).join('\n') + (files.length > 300 ? '\n...' : '');
    },
  },
  {
    name: 'repo_read',
    description: 'Read one file from a GitHub repository (live, read-only). Long files are cut at 16,000 characters.',
    input_schema: { type: 'object', properties: { repo: repoArg, path: { type: 'string' }, ref: refArg }, required: ['repo', 'path'] },
    run: async ({ repo, path, ref }) => {
      const text = await github(`repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`, 'application/vnd.github.raw');
      return text.length > 16000 ? text.slice(0, 16000) + `\n... [cut - file has ${text.length} characters]` : text;
    },
  },
  {
    name: 'repo_search',
    description: 'Search the code of a GitHub repository for a word or symbol; returns matching file paths.',
    input_schema: { type: 'object', properties: { repo: repoArg, query: { type: 'string' } }, required: ['repo', 'query'] },
    run: async ({ repo, query }) => {
      const r = await github(`search/code?per_page=20&q=${encodeURIComponent(`${query} repo:${repo}`)}`);
      return r.items.length ? r.items.map((i) => i.path).join('\n') : 'no matches';
    },
  },
];

/** Run a tool by name. Always resolves to text; errors come back as text too (the model can recover). */
export async function runTool(name, input = {}, onNode) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return `unknown tool: ${name}`;
  try {
    return String(await tool.run(input, onNode));
  } catch (e) {
    return `Error: ${e.message}`;
  }
}
