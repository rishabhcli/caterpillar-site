/** Optional OpenAI Responses adapter. Non-agentic: no tools, one request, plain text back. */
import { BASE_INSTRUCTIONS } from './instructions.mjs';

const ENDPOINT = 'https://api.openai.com/v1/responses';

export const id = 'openai';
export const agentic = false;
export const available = env => Boolean(env.OPENAI_API_KEY?.trim() && env.OPENAI_MODEL?.trim());
export const describe = env => `OPENAI / ${env.OPENAI_MODEL?.trim() || 'unset'}`;

export async function respond({ query, sources, env, fetchImpl = globalThis.fetch }) {
  const upstream = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY.trim()}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: env.OPENAI_MODEL.trim(), store: false, max_output_tokens: 1600,
      instructions: BASE_INSTRUCTIONS,
      input: JSON.stringify({ question: query, sources }),
    }),
  });
  if (!upstream.ok) throw new Error('provider_http');
  const data = await upstream.json();
  const output = Array.isArray(data.output) ? data.output : [];
  const text = output.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('\n').trim();
  if (!text || data.status === 'failed' || data.status === 'incomplete') throw new Error('provider_incomplete');
  return { text };
}
