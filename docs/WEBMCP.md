# Agents and WebMCP

The website exposes eight schema-validated tools over **the same live store as the human interface**. No mock backend, parallel agent state, or arbitrary JavaScript tool is used.

## Connect Codex in one command

Start the website in this repository:

```sh
npm install
npx playwright install chromium
npm run dev
```

Then, from this repository in a second terminal:

```sh
codex mcp add caterpillar-2028 -- node "$PWD/tools/mcp-server.mjs"
```

Restart your Codex session and inspect `/mcp`. Ask: **“Use Caterpillar tools to show mining, find autonomous equipment, and save one relevant resource.”** The first tool discovery opens a visible Chromium window. Keep that window open: it is the shared human/agent session. A separately opened browser tab is not automatically the same session.

Equivalent configuration in `~/.codex/config.toml` (replace the absolute path):

```toml
[mcp_servers.caterpillar-2028]
command = "node"
args = ["/absolute/path/to/caterpillar-site/tools/mcp-server.mjs"]
startup_timeout_sec = 60
tool_timeout_sec = 60
```

CLI/config syntax is documented in [OpenAI's MCP documentation](https://developers.openai.com/codex/mcp). This repository does not modify your global Codex configuration automatically.

## Attach an existing browser session

If Chrome/Chromium is already running with a **local debugging port** and an isolated profile, configure:

```toml
[mcp_servers.caterpillar-2028.env]
CAT_SITE_URL = "http://127.0.0.1:5173"
CAT_CDP_URL = "http://127.0.0.1:9222"
```

The bridge reuses a tab on that exact origin (preferring the configured path), or opens one if absent. Human filters, saved items, opened articles, and guide responses are immediately available to the agent and vice versa. Do not expose browser debugging ports publicly. For unattended tests only, `CAT_HEADLESS=1` launches a headless browser instead of the visible default. A bridge-launched browser uses a fresh context for each server process; use a persistent Chrome profile through CDP if you want saved items across bridge restarts.

Only loopback `localhost`, `127.0.0.1`, and `[::1]` URLs are accepted. Cross-origin navigation disables tool access until the shared tab returns. The server never accepts agent-supplied JavaScript or arbitrary navigation URLs. Standard output is reserved for MCP; diagnostics go to standard error.

## Available tools

| Tool | Input | Effect |
| --- | --- | --- |
| `get_site_state` | `{}` | Read current section, filter, open panel, saved IDs and guide mode |
| `search_content` | `{ "query": "mining", "limit": 8 }` | Search sourced content; returns stable IDs |
| `get_content` | `{ "id": "…" }` | Read summary and original official source URL |
| `navigate_section` | `{ "section": "innovation" }` | Scroll the shared page |
| `filter_industries` | `{ "industry": "mining" }` | Filter visible cards and open industries |
| `open_content` | `{ "id": "…" }` | Open the visible content detail panel |
| `save_content` | `{ "id": "…", "saved": true }` | Update the human's local collection |
| `ask_guide` | `{ "question": "How does autonomy help mining?" }` | Display the question and response in the shared guide |

Sections: `home`, `industries`, `innovation`, `company`, `sustainability`, `news`, `careers`, `brands`. Industry filters: `all`, `construction`, `mining`, `energy`. Inputs reject unknown fields. Mutating bridge calls run sequentially.

The guide defaults to **local content retrieval, not an LLM**. Live AI requires a configured backend and the human's UI toggle. Agent tools cannot grant AI consent. Only when enabled does `ask_guide` send the question and matching public content to the configured AI service. No tool purchases equipment, submits an application, contacts a dealer, or changes external systems.

## Native WebMCP and fallback

`src/webmcp.ts` feature-detects the current draft's `document.modelContext.registerTool`, with `navigator.modelContext` support for earlier implementations. The same descriptors and validated handlers are registered natively when available. Registration failure unwinds partial registrations without breaking the bridge. Native browser support is experimental and is not required by the stdio adapter.

The always-available integration surface is:

```js
window.catAgent.tools
await window.catAgent.invoke('filter_industries', { industry: 'mining' })
window.catAgent.getState()
```

This JavaScript bridge by itself is **not native WebMCP**. The Node adapter makes it available to ordinary MCP clients using the real MCP stdio transport. [WebMCP proposal](https://github.com/webmachinelearning/webmcp).

## Verification

```sh
npx vitest run tests/webmcp.test.ts
npm run test:e2e
```

Unit tests cover schema discovery, strict validation, shared mutations, local persistence, source retrieval, consent boundaries, native registration/cleanup and graceful fallback. Browser/MCP end-to-end evidence must be checked separately; unit tests are not proof of a connected agent session.
