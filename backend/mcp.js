// MCP server: exposes the knowledge graph + GitHub tools (tools.js) to Claude Code, Claude Desktop or
// any MCP client. Two ways to connect, same tools:
//   stdio  `node backend/mcp.js`              - the client starts this file as a process
//   HTTP   http://localhost:8030/mcp          - served by server.js via handleMcpHttp()
// Note: in stdio mode stdout carries the protocol, so this file must never console.log.

import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, runTool } from './tools.js';
import { ingestIfEmpty } from './ingest.js';
import { embedMissing } from './embed.js';

/** The tool list in MCP's shape (MCP calls the schema `inputSchema`). */
export const mcpTools = () => TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema }));

function createMcpServer() {
  const server = new Server({ name: 'nexus', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const text = await runTool(req.params.name, req.params.arguments);
    return { content: [{ type: 'text', text }], isError: text.startsWith('Error:') };
  });
  return server;
}

/** Handle one HTTP request to /mcp. Stateless: a fresh server per request, nothing kept in between. */
export async function handleMcpHttp(req, res) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}

// `node backend/mcp.js` -> run over stdio.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  ingestIfEmpty();
  embedMissing(); // background; logs go to stderr only
  await createMcpServer().connect(new StdioServerTransport());
  console.error('[nexus] MCP server ready on stdio');
}
