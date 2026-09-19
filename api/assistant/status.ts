/** Vercel Function for GET /api/assistant/status. Reports configuration only; it never validates credentials. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { content } from '../../src/content.js';
// Server module is intentionally plain JavaScript.
import { createAssistantMiddleware } from '../../server/assistant.mjs';

const assistant = createAssistantMiddleware({ content, hosted: true });

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = '/api/assistant/status';
  return assistant(req, res);
}
