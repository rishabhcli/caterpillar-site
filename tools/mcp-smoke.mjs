import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const transport = new StdioClientTransport({ command: process.execPath, args: ['tools/mcp-server.mjs'], env: { ...process.env, CAT_HEADLESS: '1', CAT_SITE_URL: 'http://127.0.0.1:5173' }, stderr: 'pipe' });
const client = new Client({ name: 'caterpillar-smoke', version: '1.0.0' });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 8);
  const call = async (name,args={}) => { const response = await client.callTool({ name, arguments: args }); assert.ok(!response.isError, JSON.stringify(response));return JSON.parse(response.content[0].text); };
  let state = await call('filter_industries', { industry: 'mining' });
  assert.deepEqual(state.visibleIndustries,['mining']);
  state = await call('save_content', { id: 'mining', saved: true });
  assert.ok(state.shortlist.includes('mining'));
  const found = await call('search_content', { query: 'autonomous mining', limit: 3 });
  assert.ok(found.length > 0);
  const guide = await call('ask_guide', { question: 'Tell me about autonomous mining' });
  assert.equal(guide.mode,'local');assert.ok(guide.sources.length);
  const bad = await client.callTool({name:'filter_industries',arguments:{industry:'invalid'}});assert.equal(bad.isError,true);
  console.log(JSON.stringify({status:'PASS',transport:'real MCP stdio',browser:'real Chromium/Chrome headless',tools:tools.length,filter:state.industryFilter,saved:state.shortlist,guide:guide.mode,invalidInputRejected:bad.isError},null,2));
} finally { await client.close(); }
