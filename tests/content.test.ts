import { describe, expect, it } from 'vitest';
import { content, featured, industries, localAnswer, searchContent, stories } from '../src/content';

describe('source-backed content catalog', () => {
  it('contains unique stable identifiers and HTTPS source links', () => {
    expect(content.length).toBeGreaterThan(40);
    expect(new Set(content.map(item => item.id)).size).toBe(content.length);
    for (const item of content) {
      expect(item.title.trim()).not.toBe('');
      expect(item.summary.trim()).not.toBe('');
      expect(new URL(item.url).protocol).toBe('https:');
    }
  });
  it('preserves the three industry worlds and company resource categories', () => {
    expect(industries.map(item => item.id)).toEqual(['construction', 'mining', 'energy']);
    expect(featured.map(item => item.category)).toEqual(expect.arrayContaining(['Company', 'Innovation', 'Sustainability', 'Careers', 'Investors', 'Brands']));
    expect(stories.every(item => item.date && item.url.includes('/news/'))).toBe(true);
  });
  it('ranks relevant search matches and respects the requested limit', () => {
    const results = searchContent('autonomous mining', 3);
    expect(results).toHaveLength(3);
    expect(results.some(item => item.id === 'mining' || item.id === 'autonomous-hauling')).toBe(true);
    expect(searchContent('careers engineering').some(item => item.id === 'careers')).toBe(true);
    expect(searchContent('zzyyxxnonexistent')).toEqual([]);
  });
  it('offers useful starting resources for empty and stopword-only searches', () => {
    expect(searchContent('', 4)).toEqual(featured.slice(0, 4));
    expect(searchContent('tell me about the caterpillar', 4)).toEqual(featured.slice(0, 4));
  });
  it('labels local retrieval honestly and returns inspectable catalog sources', () => {
    const answer = localAnswer('mining');
    expect(answer.mode).toBe('local');
    expect(answer.sources.length).toBeGreaterThan(0);
    for (const source of answer.sources) {
      expect(content).toContain(source);
      expect(answer.text).toContain(source.summary);
    }
  });
  it('does not invent answers or sources for unmatched questions', () => {
    const answer = localAnswer('zzyyxxnonexistent');
    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain('couldn’t find a reliable match');
    expect(answer.mode).toBe('local');
  });
});
