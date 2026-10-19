// The web server (localhost only): serves the frontend, a small JSON API over the graph, the live
// Agent stream and the MCP endpoint.
//
//   GET  /                   frontend (index.html, app.js, style.css)
//   GET  /api/graph          every node + fact, for the Graph tab
//   GET  /api/entity/:slug   one entity with its facts
//   GET  /api/search?q=      hybrid search (keyword + meaning)
//   POST /api/review         { id, status } approve/reject a proposed fact
//   GET  /api/ask?q=&sid=    the Agent, streamed as Server-Sent Events
//   GET  /api/mcp-info       what the MCP tab shows (tools + how to connect)
//   *    /mcp                the MCP endpoint (Streamable HTTP)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, graph, getEntity, setStatus } from './db.js';
import { ingestIfEmpty } from './ingest.js';
import { embeddings, embedMissing, hybridSearch } from './embed.js';
import { runAgent, MODEL } from './agent.js';
import { handleMcpHttp, mcpTools } from './mcp.js';

const PORT = Number(process.env.PORT) || 8030;
const FRONTEND = join(ROOT, 'frontend');
const STATIC = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css' };

const chats = new Map(); // sid -> [{ role, content }] text history, so follow-up questions have context

ingestIfEmpty();
embedMissing(); // builds the semantic index in the background; search is keyword-only until it is ready

const json = (res, data, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
const readBody = async (req) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || '{}');
};

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === '/mcp') return handleMcpHttp(req, res);

  if (STATIC[p]) {
    const file = STATIC[p];
    res.writeHead(200, { 'Content-Type': `${MIME[file.split('.').pop()]}; charset=utf-8` });
    return res.end(await readFile(join(FRONTEND, file)));
  }

  if (p === '/api/graph') return json(res, { ...graph(), embeddings, model: MODEL });
  if (p === '/api/search') return json(res, await hybridSearch(url.searchParams.get('q') || ''));
  if (p.startsWith('/api/entity/')) {
    const e = getEntity(decodeURIComponent(p.slice('/api/entity/'.length)));
    return e ? json(res, e) : json(res, { error: 'not found' }, 404);
  }
  if (p === '/api/review' && req.method === 'POST') {
    const { id, status } = await readBody(req);
    if (!['verified', 'deprecated'].includes(status)) return json(res, { error: 'status must be verified or deprecated' }, 400);
    return json(res, { ok: setStatus(Number(id), status, 'web') });
  }
  if (p === '/api/mcp-info') {
    return json(res, { url: `http://localhost:${PORT}/mcp`, script: join(ROOT, 'backend', 'mcp.js'), tools: mcpTools() });
  }

  if (p === '/api/ask') {
    const question = (url.searchParams.get('q') || '').trim();
    const sid = url.searchParams.get('sid') || 'default';
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      if (!question) throw new Error('empty question');
      const history = chats.get(sid) || [];
      const { answer, entities } = await runAgent(question, history, send);
      chats.set(sid, [...history, { role: 'user', content: question }, { role: 'assistant', content: answer }]);
      send('answer', { answer, entities });
    } catch (e) {
      send('error', { error: e.message });
    }
    return res.end();
  }

  json(res, { error: `no such route: ${p}` }, 404);
}

createServer((req, res) =>
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(res, { error: e.message }, 500);
    else res.end();
  }),
).listen(PORT, '127.0.0.1', () => console.log(`Nexus running at http://localhost:${PORT}`));
