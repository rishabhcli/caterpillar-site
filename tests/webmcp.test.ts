import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  const saved = new Map<string,string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key,value) });
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', { getElementById: vi.fn(() => ({ scrollIntoView: vi.fn() })) });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('history', { replaceState: vi.fn() });
  vi.stubGlobal('location', { pathname: '/' });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
afterEach(() => vi.unstubAllGlobals());
const resultData = (result: { content: { text: string }[] }) => JSON.parse(result.content[0].text);

describe('shared WebMCP contract', () => {
  it('exports eight discoverable JSON-schema tools and a usable browser bridge', async () => {
    const { registerWebMCP, toolManifest } = await import('../src/webmcp');
    const cleanup = await registerWebMCP();
    expect(toolManifest).toHaveLength(8);
    expect(new Set(toolManifest.map(t => t.name)).size).toBe(8);
    expect(toolManifest.every(t => t.inputSchema.type === 'object')).toBe(true);
    expect(window.catAgent.tools).toEqual(toolManifest);
    expect(window.catAgent.getState().nativeStatus).toBe('MCP browser bridge ready');
    cleanup();
  });
  it('changes the same filter and navigation state the UI reads', async () => {
    const { invoke } = await import('../src/webmcp');
    const { getState } = await import('../src/store');
    const result = await invoke('filter_industries', { industry: 'mining' });
    expect(resultData(result).visibleIndustries).toEqual(['mining']);
    expect(getState().filter).toBe('mining');
    expect(getState().section).toBe('industries');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#industries');
  });
  it('rejects unknown fields and invalid values before changing shared state', async () => {
    const { invoke } = await import('../src/webmcp');
    const { getState } = await import('../src/store');
    const before = getState();
    expect((await invoke('filter_industries', { industry: 'all', code: 'alert(1)' })).isError).toBe(true);
    expect((await invoke('filter_industries', { industry: 'not-an-industry' })).isError).toBe(true);
    expect((await invoke('navigate_section', { section: 'https://example.com' })).isError).toBe(true);
    expect(getState()).toBe(before);
  });
  it('searches sourced content, opens it and saves it in the human collection', async () => {
    const { invoke } = await import('../src/webmcp');
    const { getState } = await import('../src/store');
    const hits = resultData(await invoke('search_content', { query: 'mining', limit: 3 }));
    expect(hits.length).toBeGreaterThan(0);
    const id = hits[0].id;
    const detail = resultData(await invoke('get_content', { id }));
    expect(detail.id).toBe(id);
    await invoke('open_content', { id });
    expect(getState().modal).toBe('article');
    await invoke('save_content', { id, saved: true });
    expect(getState().shortlist).toContain(id);
    expect(JSON.parse(localStorage.getItem('cat2028-shortlist')!)).toContain(id);
    await invoke('save_content', { id, saved: false });
    expect(getState().shortlist).not.toContain(id);
  });
  it('guide updates the visible conversation and does not silently enable external AI', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { invoke } = await import('../src/webmcp');
    const { getState } = await import('../src/store');
    const result = resultData(await invoke('ask_guide', { question: 'Show me mining innovation' }));
    expect(result.mode).toBe('local');
    expect(getState().modal).toBe('guide');
    expect(getState().messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(getState().aiConsent).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns structured errors for unknown names and content IDs', async () => {
    const { invoke } = await import('../src/webmcp');
    expect((await invoke('run_javascript', { code: 'alert(1)' })).isError).toBe(true);
    expect((await invoke('open_content', { id: 'missing' })).isError).toBe(true);
    expect((await invoke('get_content', { id: 'missing' })).isError).toBe(true);
  });
  it('registers native document.modelContext tools and cleans them up', async () => {
    const registerTool = vi.fn(), unregisterTool = vi.fn();
    Object.assign(document, { modelContext: { registerTool, unregisterTool } });
    const { registerWebMCP } = await import('../src/webmcp');
    const cleanup = await registerWebMCP();
    expect(registerTool).toHaveBeenCalledTimes(8);
    const descriptor = registerTool.mock.calls[0][0];
    expect(typeof descriptor.execute).toBe('function');
    expect(resultData(await descriptor.execute({})).nativeStatus).toBe('Native WebMCP ready');
    cleanup();
    expect(registerTool.mock.calls[0][1].signal.aborted).toBe(true);
    expect(unregisterTool).toHaveBeenCalledTimes(8);
  });
  it('retains the working bridge and unwinds partial native registration on failure', async () => {
    const registerTool = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Unsupported API'));
    const unregisterTool = vi.fn();
    Object.assign(document, { modelContext: { registerTool, unregisterTool } });
    const { registerWebMCP } = await import('../src/webmcp');
    await registerWebMCP();
    expect(unregisterTool).toHaveBeenCalledWith('get_site_state');
    expect(window.catAgent.getState().nativeStatus).toContain('native registration unavailable');
    expect(resultData(await window.catAgent.invoke('get_site_state')).conceptYear).toBe(2028);
  });
});
