import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAssistantMiddleware } from './assistant.mjs';

const root = await realpath(fileURLToPath(new URL('../dist/', import.meta.url))).catch(() => {
  console.error('Build the website first: npm run build'); process.exit(1);
});
const content = JSON.parse(await readFile(path.join(root, 'knowledge.json'), 'utf8'));
const assistant = createAssistantMiddleware({ content });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

async function staticFile(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Method not allowed'); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.split('/').some(part => part.startsWith('.')) || pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid path');
    if (pathname.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }
    let filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root + path.sep)) throw new Error('Invalid path');
    if (!await stat(filename).then(s => s.isFile()).catch(() => false)) {
      if (path.extname(pathname)) { res.writeHead(404); return res.end('Not found'); }
      filename = path.join(root, 'index.html');
    }
    filename = await realpath(filename);
    if (!filename.startsWith(root + path.sep)) throw new Error('Invalid path');
    const data = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const server = createServer((req, res) => { assistant(req, res, () => staticFile(req, res)).catch(() => { if (!res.headersSent) res.writeHead(500); res.end('Request failed'); }); });
server.requestTimeout = 35_000;
server.headersTimeout = 10_000;
server.listen(port, '127.0.0.1', () => console.log(`Caterpillar concept: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(`Server could not start (${error.code || 'unknown error'}).`); process.exitCode = 1; });
