"""
MCP server: lets Claude Code, Claude Desktop or any MCP client use Nexus's tools.

    python mcp_server.py           # stdio  - the client starts this file itself
    python mcp_server.py --http    # HTTP   - http://localhost:8031/mcp

The tools are the exact same functions the web agent uses (app.py, section 5).
"""

import sys

from mcp.server.mcpserver import MCPServer   # the official MCP Python library

import app   # importing app.py opens the same database and gives us its tool functions

# Create the MCP server and register every tool. MCP (Model Context Protocol) is a standard way for
# AI apps to discover and call outside tools. add_tool() reads each function's name, docstring and
# type hints, so the client sees the same name, description and arguments as our own agent does.
# Unlike the web agent, MCP clients also get the two write tools (propose_fact, verify_fact).
mcp = MCPServer("nexus")
for tool in app.READ_TOOLS + app.WRITE_TOOLS:
    mcp.add_tool(tool)  # name, description and arguments come from the function itself

# Start-up: build the graph if the database is empty, then serve the tools in one of two ways:
#   --http  -> a small web server at http://localhost:8031/mcp (stateless, plain JSON replies)
#   default -> stdio: the MCP client starts this file and talks to it through stdin/stdout,
#              so nothing else may be printed to stdout here.
if __name__ == "__main__":
    if app.stats()["nodes"] == 0:
        app.ingest()
    if "--http" in sys.argv:
        mcp.run("streamable-http", host="127.0.0.1", port=8031, stateless_http=True, json_response=True)
    else:
        mcp.run()  # stdio
