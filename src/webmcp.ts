import { z } from 'zod';
import { content } from './content';
import { askGuide, filterIndustries, navigate, openArticle, publicState, saveContent, searchContent, update } from './store';

const tools = [
  { name: 'get_site_state', description: 'Read the visible Caterpillar concept page state, active filters, saved collection, and available guide mode. This is an independent design concept, not an official Caterpillar service.', schema: z.object({}).strict(), readOnly: true, run: () => publicState() },
  { name: 'search_content', description: 'Search source-backed Caterpillar content and official resource links. Returns stable IDs usable by get_content, open_content and save_content.', schema: z.object({ query: z.string().trim().min(1).max(300), limit: z.number().int().min(1).max(20).default(8) }).strict(), readOnly: true, run: (a: { query: string; limit: number }) => searchContent(a.query, a.limit) },
  { name: 'get_content', description: 'Get the summary, category, original publication date where known, and official source URL for a content ID. Does not navigate.', schema: z.object({ id: z.string().min(1).max(100) }).strict(), readOnly: true, run: (a: { id: string }) => { const item = content.find(c => c.id === a.id); if (!item) throw new Error('Unknown content ID. Use search_content first.'); return item; } },
  { name: 'navigate_section', description: 'Scroll the shared visible website to a section. Does not open external websites.', schema: z.object({ section: z.enum(['home','industries','innovation','company','sustainability','news','careers','brands']) }).strict(), readOnly: false, run: (a: { section: Parameters<typeof navigate>[0] }) => { navigate(a.section); return publicState(); } },
  { name: 'filter_industries', description: 'Filter the actual visible industry cards. Human controls and this tool update the same state.', schema: z.object({ industry: z.enum(['all','construction','mining','energy']) }).strict(), readOnly: false, run: (a: { industry: Parameters<typeof filterIndustries>[0] }) => { filterIndustries(a.industry); navigate('industries'); return publicState(); } },
  { name: 'open_content', description: 'Open a source-backed content detail panel for the human to read. Does not follow external links or submit forms.', schema: z.object({ id: z.string().min(1).max(100) }).strict(), readOnly: false, run: (a: { id: string }) => { openArticle(a.id); return publicState(); } },
  { name: 'save_content', description: 'Add or remove content in the human-visible collection. Saved locally in this browser, with a maximum of 12 items. No external transmission.', schema: z.object({ id: z.string().min(1).max(100), saved: z.boolean() }).strict(), readOnly: false, run: (a: { id: string; saved: boolean }) => { saveContent(a.id, a.saved); return publicState(); } },
  { name: 'ask_guide', description: 'Ask the shared guide and show the response. Default is deterministic local content retrieval, not an LLM. Live AI is only used if configured and enabled by the human in the UI; then the question and matched public site content are sent to OpenAI. Cannot change AI consent.', schema: z.object({ question: z.string().trim().min(1).max(1200) }).strict(), readOnly: false, run: (a: { question: string }) => askGuide(a.question) },
] as const;

export const toolManifest = tools.map(t => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema, { target: 'draft-7' }), annotations: { readOnlyHint: t.readOnly, destructiveHint: false, openWorldHint: t.name === 'ask_guide', consequentialHint: false } }));
export async function invoke(name: string, input: unknown = {}) {
  const tool = tools.find(t => t.name === name);
  if (!tool) return { isError: true, content: [{ type: 'text' as const, text: 'Unknown tool. Inspect window.catAgent.tools for available tools.' }] };
  try {
    const parsed = tool.schema.parse(input);
    const result = await (tool.run as (args: unknown) => unknown)(parsed);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text' as const, text: error instanceof z.ZodError ? `Invalid input: ${error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}` : error instanceof Error ? error.message : 'Tool execution failed' }] };
  }
}
type NativeContext = { registerTool: (tool: Record<string, unknown>, options?: { signal: AbortSignal }) => void | Promise<void>; unregisterTool?: (name: string) => void };
declare global { interface Window { catAgent: { version: string; tools: typeof toolManifest; invoke: typeof invoke; getState: typeof publicState } } }
export async function registerWebMCP() {
  window.catAgent = { version: '1.0.0', tools: toolManifest, invoke, getState: publicState };
  // September 2026 draft uses document.modelContext. Support earlier Chromium builds too.
  const context = (document as Document & { modelContext?: NativeContext }).modelContext ?? (navigator as Navigator & { modelContext?: NativeContext }).modelContext;
  if (!context?.registerTool) { update({ agentStatus: 'MCP browser bridge ready' }); return () => {}; }
  const controller = new AbortController();
  const registered: string[] = [];
  try {
    for (const manifest of toolManifest) {
      await context.registerTool({ ...manifest, execute: (args: unknown) => invoke(manifest.name, args) }, { signal: controller.signal });
      registered.push(manifest.name);
    }
    update({ agentStatus: 'Native WebMCP ready' });
  } catch {
    controller.abort();
    registered.forEach(name => { try { context.unregisterTool?.(name); } catch { /* already unregistered */ } });
    update({ agentStatus: 'MCP bridge ready · native registration unavailable' });
  }
  return () => { controller.abort(); registered.forEach(name => { try { context.unregisterTool?.(name); } catch { /* already removed */ } }); };
}
