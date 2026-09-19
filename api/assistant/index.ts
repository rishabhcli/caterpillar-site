/** Vercel Function for POST /api/assistant. Mounts the same middleware as the dev, preview and Node servers. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { content } from '../../src/content.js';
// Server module is intentionally plain JavaScript.
import { createAssistantMiddleware } from '../../server/assistant.mjs';

const assistant = createAssistantMiddleware({ content, hosted: true });

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = '/api/assistant'; // The platform already routed here; the middleware dispatches on the path it is given.
  return assistant(req, res);
}
