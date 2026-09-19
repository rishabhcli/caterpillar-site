#!/usr/bin/env node
/** MCP → Playwright → window.catAgent → the same store used by the human UI. */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chromium } from '@playwright/test';

function localURL(value, name, protocols) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute local URL.`); }
  if (!protocols.includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error(`${name} must use a loopback host (localhost, 127.0.0.1 or [::1]), an allowed protocol, and no credentials.`);
  }
  return url;
}
const siteURL = localURL(process.env.CAT_SITE_URL || 'http://127.0.0.1:5173', 'CAT_SITE_URL', ['http:', 'https:']);
const cdpURL = process.env.CAT_CDP_URL ? localURL(process.env.CAT_CDP_URL, 'CAT_CDP_URL', ['http:', 'https:', 'ws:', 'wss:']) : null;
const headless = process.env.CAT_HEADLESS === '1';
let browser;
let page;
let opening;
let stopping = false;
let queue = Promise.resolve();
const server = new Server({ name: 'caterpillar-2028-browser', version: '1.0.0' }, { capabilities: { tools: {} } });
const errorResult = error => ({ isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] });
const correctOrigin = url => { try { return new URL(url).origin === siteURL.origin; } catch { return false; } };

async function getPage() {
  if (stopping) throw new Error('The browser bridge is shutting down.');
  if (page && !page.isClosed()) {
    if (!correctOrigin(page.url())) throw new Error(`The shared tab left ${siteURL.origin}. Return to the concept website before using tools.`);
    return page;
  }
  if (opening) return opening;
  opening = (async () => {
    if (!browser?.isConnected()) {
      try {
        browser = cdpURL
          ? await chromium.connectOverCDP(cdpURL.href, { timeout: 15000 })
          : await chromium.launch({ headless }).catch(() => chromium.launch({ headless, channel: 'chrome' }));
      } catch (error) {
        throw new Error(`Cannot open the shared browser. ${cdpURL ? 'Check CAT_CDP_URL and the browser debugging port.' : 'Install Google Chrome or run npx playwright install chromium first.'} ${error.message}`);
      }
    }
    const existing = browser.contexts().flatMap(context => context.pages()).filter(candidate => correctOrigin(candidate.url()));
    page = existing.find(candidate => new URL(candidate.url()).pathname === siteURL.pathname) || existing[0];
    if (!page) {
      const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      page = await context.newPage();
      try { await page.goto(siteURL.href, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
      catch { await page.close(); page = undefined; throw new Error(`Cannot load ${siteURL.href}. Start the website with npm run dev, or set CAT_SITE_URL to its local address.`); }
    }
    if (!correctOrigin(page.url())) throw new Error('The website redirected outside the configured local origin. Refusing access.');
    try { await page.waitForFunction(() => Boolean(window.catAgent?.tools?.length && typeof window.catAgent.invoke === 'function'), undefined, { timeout: 15000 }); }
    catch { throw new Error('The page did not expose window.catAgent. Check the website build and browser console.'); }
    process.stderr.write(`[caterpillar-mcp] Connected to shared ${headless ? 'headless' : 'visible'} page: ${page.url()}\n`);
    return page;
  })();
  try { return await opening; } finally { opening = undefined; }
}

async function discover() {
  const target = await getPage();
  return target.evaluate(origin => {
    if (location.origin !== origin) throw new Error('The shared tab changed origin.');
    if (!window.catAgent?.tools) throw new Error('The page is not ready. Retry after it finishes loading.');
    return window.catAgent.tools.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations }));
  }, siteURL.origin);
}
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await discover() }));
server.setRequestHandler(CallToolRequestSchema, request => {
  // Sequential execution preserves the same visible state when clients issue calls concurrently.
  const result = queue.then(async () => {
    try {
      const { name, arguments: args = {} } = request.params;
      if (JSON.stringify(args).length > 24000) throw new Error('Tool arguments are too large.');
      const manifest = await discover();
      if (!manifest.some(tool => tool.name === name)) throw new Error('Unknown tool. Call tools/list to discover supported actions.');
      const target = await getPage();
      return await target.evaluate(async ({ origin, name, args }) => {
        if (location.origin !== origin) throw new Error('The shared tab changed origin.');
        // Names and JSON values only: no agent-supplied JavaScript, selectors or URLs.
        return await window.catAgent.invoke(name, args);
      }, { origin: siteURL.origin, name, args });
    } catch (error) { return errorResult(error); }
  });
  queue = result.then(() => undefined, () => undefined);
  return result;
});

async function shutdown() {
  if (stopping) return;
  stopping = true;
  await server.close().catch(() => {});
  // For a CDP-attached browser, Browser.close disconnects this client, not the external browser.
  await browser?.close().catch(() => {});
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
process.stdin.once('end', () => void shutdown());
await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 1024 * 1024 }));
process.stderr.write('[caterpillar-mcp] Ready. Tools connect lazily to the running website.\n');
