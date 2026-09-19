import { z } from 'zod';
import { content } from './content';
import { askGuide, filterIndustries, navigate, openArticle, publicState, saveContent, searchContent, update } from './store';
import { toolSchemas, toolManifest } from './tool-schemas';

const runs: Record<string, (args: never) => unknown> = {
  get_site_state: () => publicState(),
  search_content: (a: { query: string; limit: number }) => searchContent(a.query, a.limit),
  get_content: (a: { id: string }) => { const item = content.find(c => c.id === a.id); if (!item) throw new Error('Unknown content ID. Use search_content first.'); return item; },
  navigate_section: (a: { section: Parameters<typeof navigate>[0] }) => { navigate(a.section); return publicState(); },
  filter_industries: (a: { industry: Parameters<typeof filterIndustries>[0] }) => { filterIndustries(a.industry); navigate('industries'); return publicState(); },
  open_content: (a: { id: string }) => { openArticle(a.id); return publicState(); },
  save_content: (a: { id: string; saved: boolean }) => { saveContent(a.id, a.saved); return publicState(); },
  ask_guide: (a: { question: string }) => askGuide(a.question),
} as Record<string, (args: never) => unknown>;

export { toolManifest };
export async function invoke(name: string, input: unknown = {}) {
  const tool = toolSchemas.find(t => t.name === name);
  if (!tool) return { isError: true, content: [{ type: 'text' as const, text: 'Unknown tool. Inspect window.catAgent.tools for available tools.' }] };
  try {
    const parsed = tool.schema.parse(input);
    const result = await (runs[name] as (args: unknown) => unknown)(parsed);
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
