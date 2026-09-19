/** Optional Cursor Agent adapter. Agentic: the model is given the site's own tools and can drive the visible page. */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AGENT_INSTRUCTIONS, BASE_INSTRUCTIONS } from './instructions.mjs';

const RUN_TIMEOUT_MS = 60_000;

export const id = 'cursor';
export const agentic = true;
export const available = env => Boolean(env.CURSOR_API_KEY?.trim() && env.CURSOR_MODEL?.trim());
export const describe = env => `CURSOR / ${(env.CURSOR_MODEL?.trim() || 'unset').toUpperCase()}`;

/** Model params are optional; a malformed value must not silently change which model runs. */
function modelSelection(env) {
  const selection = { id: env.CURSOR_MODEL.trim() };
  const raw = env.CURSOR_MODEL_PARAMS?.trim();
  if (!raw) return selection;
  let params;
  try { params = JSON.parse(raw); } catch { throw new Error('CURSOR_MODEL_PARAMS is not valid JSON.'); }
  if (!Array.isArray(params) || params.some(p => !p || typeof p.id !== 'string' || typeof p.value !== 'string')) throw new Error('CURSOR_MODEL_PARAMS must be an array of { id, value } strings.');
  return params.length ? { ...selection, params } : selection;
}

/** An empty working directory: the agent has no filesystem tools, and this keeps ambient project rules out of the run. */
let scratch;
async function scratchDir() { scratch ??= await mkdtemp(path.join(tmpdir(), 'cat-site-guide-')); return scratch; }

const defaultAgentFactory = async options => { const { Agent } = await import('@cursor/sdk'); return Agent.create(options); };

function customTools(tools, callTool) {
  return Object.fromEntries(tools.map(tool => [tool.name, {
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    execute: async args => {
      try { return { content: [{ type: 'text', text: await callTool(tool.name, args) }] }; }
      catch (error) { return { content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed.' }], isError: true }; }
    },
  }]));
}

export async function respond({ query, sources, env, tools = [], callTool, onDelta, conversation = {}, agentFactory = defaultAgentFactory }) {
  const model = modelSelection(env);
  const INSTRUCTIONS = tools.length ? AGENT_INSTRUCTIONS : BASE_INSTRUCTIONS;
  const message = `${JSON.stringify({ question: query, startingSources: sources })}\n\nAnswer the question above for the visitor.`;
  // systemPrompt is a server-gated capability. If this account lacks it, fall back to carrying the same rules in the message.
  const create = async withSystemPrompt => agentFactory({
    apiKey: env.CURSOR_API_KEY.trim(), model, name: 'Caterpillar concept site guide',
    tools: ['mcp'], disallowedTools: ['task'],
    ...(withSystemPrompt ? { systemPrompt: INSTRUCTIONS } : {}),
    local: { cwd: await scratchDir(), settingSources: [], customTools: customTools(tools, callTool) },
  });
  const send = async agent => {
    let streamed = '';
    const run = await agent.send(agent.__catPrompted ? message : `${INSTRUCTIONS}\n\n${message}`, {
      onDelta: ({ update }) => { if (update?.type === 'text-delta' && typeof update.text === 'string') { streamed += update.text; onDelta?.(update.text); } },
    });
    const timer = setTimeout(() => { void run.cancel().catch(() => {}); }, RUN_TIMEOUT_MS);
    try {
      const result = await run.wait();
      if (result.status !== 'finished') throw new Error('provider_incomplete');
      const text = (streamed.trim() || result.result || '').trim();
      if (!text) throw new Error('provider_incomplete');
      return { text };
    } finally { clearTimeout(timer); }
  };

  let agent = conversation.agent;
  if (!agent) { agent = await create(true); agent.__catPrompted = true; }
  try {
    const answer = await send(agent);
    conversation.agent = agent;
    return answer;
  } catch (error) {
    // A gated systemPrompt can surface either as a thrown message or as a plain run status of 'error',
    // so any first-attempt failure on a prompted agent retries once with the rules carried in the message.
    if (!agent.__catPrompted) { conversation.agent = undefined; try { agent.close?.(); } catch { /* already closed */ } throw error; }
    try { agent.close?.(); } catch { /* already closed */ }
    const retried = await create(false);
    retried.__catPrompted = false;
    const answer = await send(retried);
    conversation.agent = retried;
    return answer;
  }
}
