import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('BUILT FOR');
  await page.waitForFunction(() => Boolean(window.catAgent));
});

test('industry filters and scene controls update visible content', async ({ page }) => {
  await expect(page.locator('.industry-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Mining', exact: true }).click();
  await expect(page.locator('.industry-card')).toHaveCount(1);
  await expect(page.locator('.industry-card')).toContainText('Go deeper. Think bigger.');
  await page.getByRole('button', { name: 'All industries', exact: true }).click();
  await expect(page.locator('.industry-card')).toHaveCount(3);
  await page.getByRole('button', { name: '02 Limitless possibility' }).click();
  await expect(page.locator('.hero-description')).toContainText('Big challenges');
  await page.getByRole('tab', { name: /Energy evolution/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('More ways to power progress.');
});

test('search opens source-backed details and handles no matches', async ({ page }) => {
  await page.getByRole('button', { name: 'Search website' }).click();
  const search = page.getByRole('textbox', { name: 'Search Caterpillar content' });
  await search.fill('zzyyxxnonexistent');
  await expect(page.getByRole('heading', { name: /No results/ })).toBeVisible();
  await search.fill('autonomous mining');
  await page.locator('.results-list .result-row button').first().click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Inside Caterpillar');
  await expect(page.getByRole('link', { name: /Explore the official resource/ })).toHaveAttribute('href', /^https:\/\//);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('collection persists, exports real JSON, and can be removed', async ({ page }) => {
  await page.getByRole('button', { name: 'Save Go deeper. Think bigger.', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Your collection, 1 saved items' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Your collection, 1 saved items' }).click();
  await expect(page.getByRole('dialog')).toContainText('Go deeper. Think bigger.');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export collection' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('caterpillar-collection.json');
  const stream = await download.createReadStream();
  let downloaded = '';
  for await (const chunk of stream!) downloaded += chunk.toString();
  expect(JSON.parse(downloaded).items[0].id).toBe('mining');
  await page.getByRole('dialog').getByRole('button', { name: 'Remove Go deeper. Think bigger.', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('0 of 12 saved resources');
});

test('guide gives locally sourced answers without pretending to be live AI', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Ask the Caterpillar guide' }).fill('Tell me about autonomous mining');
  await page.getByRole('button', { name: 'Ask the guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Cat Intelligence');
  await expect(page.locator('.guide-mode')).toContainText('LOCAL CONTENT RETRIEVAL');
  await expect(page.locator('.message.assistant')).toBeVisible();
  // Only genuinely relevant matches are cited now; the generic company entry is gated out by relevance.
  await expect(page.locator('.answer-sources button')).toHaveCount(2);
  await expect(page.locator('.guide-actions button').first()).toBeVisible();
  await expect(page.locator('.guide-compose')).toContainText('not a generative AI model');
  await page.locator('.answer-sources button').first().click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Inside Caterpillar');
});

test('browser agent and human controls use the same visible state', async ({ page }) => {
  const result = await page.evaluate(() => window.catAgent.invoke('filter_industries', { industry: 'mining' }));
  expect(result.isError).not.toBe(true);
  await expect(page.locator('.industry-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Mining', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Construction', exact: true }).click();
  const state = await page.evaluate(() => window.catAgent.getState());
  expect(state.industryFilter).toBe('construction');
  await page.evaluate(() => window.catAgent.invoke('save_content', { id: 'mining', saved: true }));
  await expect(page.getByRole('button', { name: 'Your collection, 1 saved items' })).toBeVisible();
  await page.evaluate(() => window.catAgent.invoke('open_content', { id: 'mining' }));
  await expect(page.getByRole('dialog')).toContainText('Go deeper. Think bigger.');
});

test('agent rejects invalid tools and arguments without changing state', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const before = window.catAgent.getState();
    const invalid = await window.catAgent.invoke('filter_industries', { industry: 'not-a-world' });
    const unknown = await window.catAgent.invoke('send_payment', {});
    const missing = await window.catAgent.invoke('save_content', { id: 'does-not-exist', saved: true });
    return { before, after: window.catAgent.getState(), invalid, unknown, missing };
  });
  expect(results.invalid.isError).toBe(true);
  expect(results.unknown.isError).toBe(true);
  expect(results.missing.isError).toBe(true);
  expect(results.after.industryFilter).toBe(results.before.industryFilter);
  expect(results.after.shortlist).toEqual(results.before.shortlist);
});

test('native WebMCP registration contract delegates to the same tools (emulated API)', async ({ page }) => {
  await page.addInitScript(() => {
    const registry: Record<string, { execute: (args: unknown) => Promise<unknown> }> = {};
    Object.defineProperty(document, 'modelContext', { configurable: true, value: {
      registerTool(tool: { name: string; execute: (args: unknown) => Promise<unknown> }) { registry[tool.name] = tool; },
      unregisterTool(name: string) { delete registry[name]; },
    } });
    Object.assign(window, { testNativeTools: registry });
  });
  await page.reload();
  await page.waitForFunction(() => window.catAgent?.getState().nativeStatus === 'Native WebMCP ready');
  const names = await page.evaluate(() => Object.keys((window as unknown as { testNativeTools: Record<string, unknown> }).testNativeTools));
  expect(names).toContain('filter_industries');
  expect(names).toHaveLength(8);
  await page.evaluate(() => (window as unknown as { testNativeTools: Record<string, { execute: (args: unknown) => Promise<unknown> }> }).testNativeTools.filter_industries.execute({ industry: 'energy' }));
  await expect(page.locator('.industry-card')).toHaveCount(1);
  await expect(page.locator('.industry-card')).toContainText('Power the possibilities.');
});

test('desktop renders loaded images, has no page errors or horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('.hero-image.active')).toBeVisible();
  expect(await page.locator('.hero-image.active').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.evaluate(async () => { await Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); })); });
  expect(await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).length)).toBe(0);
  await page.screenshot({ path: 'artifacts/desktop-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Open Cat Intelligence', exact: true }).click();
  await page.screenshot({ path: 'artifacts/desktop-guide.png' });
  expect(errors).toEqual([]);
});

test('mobile is overflow-free and supports navigation, guide and agent access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(async () => { await Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); })); });
  await page.screenshot({ path: 'artifacts/mobile-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Industries', exact: true }).click();
  await expect(page).toHaveURL(/#industries$/);
  await page.getByRole('button', { name: 'Mining', exact: true }).click();
  await expect(page.locator('.industry-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Agent access', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('8 tools');
  await page.screenshot({ path: 'artifacts/mobile-agent.png' });
  expect(await page.getByRole('dialog').evaluate(el => el.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
});
