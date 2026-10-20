"""
MCP server: lets Claude Code, Claude Desktop or any MCP client use Nexus's tools.

    python mcp_server.py           # stdio  - the client starts this file itself
    python mcp_server.py --http    # HTTP   - http://localhost:8031/mcp

The tools are the exact same functions the web agent uses (app.py, section 5).
"""

import sys

from mcp.server.mcpserver import MCPServer

import app

mcp = MCPServer("nexus")
for tool in app.READ_TOOLS + app.WRITE_TOOLS:
    mcp.add_tool(tool)  # name, description and arguments come from the function itself

if __name__ == "__main__":
    if app.stats()["nodes"] == 0:
        app.ingest()
    if "--http" in sys.argv:
        mcp.run("streamable-http", host="127.0.0.1", port=8031, stateless_http=True, json_response=True)
    else:
        mcp.run()  # stdio
