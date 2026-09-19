import { z } from 'zod';

/** Tool descriptors with no store or DOM dependency, so Node (vite.config.ts, the assistant server) can read the same manifest the browser registers. */
export const toolSchemas = [
  { name: 'get_site_state', description: 'Read the visible Caterpillar concept page state, active filters, saved collection, and available guide mode. This is an independent design concept, not an official Caterpillar service.', schema: z.object({}).strict(), readOnly: true },
  { name: 'search_content', description: 'Search source-backed Caterpillar content and official resource links. Returns stable IDs usable by get_content, open_content and save_content.', schema: z.object({ query: z.string().trim().min(1).max(300), limit: z.number().int().min(1).max(20).default(8) }).strict(), readOnly: true },
  { name: 'get_content', description: 'Get the summary, category, original publication date where known, and official source URL for a content ID. Does not navigate.', schema: z.object({ id: z.string().min(1).max(100) }).strict(), readOnly: true },
  { name: 'navigate_section', description: 'Scroll the shared visible website to a section. Does not open external websites.', schema: z.object({ section: z.enum(['home','industries','innovation','company','sustainability','news','careers','brands']) }).strict(), readOnly: false },
  { name: 'filter_industries', description: 'Filter the actual visible industry cards. Human controls and this tool update the same state.', schema: z.object({ industry: z.enum(['all','construction','mining','energy']) }).strict(), readOnly: false },
  { name: 'open_content', description: 'Open a source-backed content detail panel for the human to read. Does not follow external links or submit forms.', schema: z.object({ id: z.string().min(1).max(100) }).strict(), readOnly: false },
  { name: 'save_content', description: 'Add or remove content in the human-visible collection. Saved locally in this browser, with a maximum of 12 items. No external transmission.', schema: z.object({ id: z.string().min(1).max(100), saved: z.boolean() }).strict(), readOnly: false },
  { name: 'ask_guide', description: 'Ask the shared guide and show the response. Default is deterministic local content retrieval, not an LLM. Live AI is only used if configured and enabled by the human in the UI; then the question and matched public site content are sent to the configured provider. Cannot change AI consent.', schema: z.object({ question: z.string().trim().min(1).max(1200) }).strict(), readOnly: false },
] as const;

export type ToolName = (typeof toolSchemas)[number]['name'];
export const toolManifest = toolSchemas.map(t => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema, { target: 'draft-7' }), annotations: { readOnlyHint: t.readOnly, destructiveHint: false, openWorldHint: t.name === 'ask_guide', consequentialHint: false } }));
