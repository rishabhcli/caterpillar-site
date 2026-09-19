import { useSyncExternalStore } from 'react';
import { content, industries, localAnswer, searchContent } from './content';
import type { Content } from './content';

export type Section = 'home' | 'industries' | 'innovation' | 'company' | 'sustainability' | 'news' | 'careers' | 'brands';
export type Filter = 'all' | 'construction' | 'mining' | 'energy';
export type Modal = null | 'search' | 'guide' | 'directory' | 'article' | 'shortlist' | 'agent';
export type Message = { id: number; role: 'user' | 'assistant'; text: string; sources?: Content[]; mode?: 'local' | 'ai'; notice?: string };
type State = { filter: Filter; section: Section; modal: Modal; directoryCategory: string; articleId: string | null; shortlist: string[]; messages: Message[]; busy: boolean; agentStatus: string; lastAction: string; storageAvailable: boolean; aiAvailable: boolean; aiConsent: boolean };
const listeners = new Set<() => void>();
let initialSaved: string[] = [], storageAvailable = true;
try { const s: unknown = JSON.parse(localStorage.getItem('cat2028-shortlist') || '[]'); if (Array.isArray(s)) initialSaved = s.filter((x): x is string => typeof x === 'string' && content.some(c => c.id === x)).slice(0,12); } catch { storageAvailable = false; }
let state: State = { filter: 'all', section: 'home', modal: null, directoryCategory: 'All', articleId: null, shortlist: initialSaved, messages: [], busy: false, agentStatus: 'Checking capabilities', lastAction: '', storageAvailable, aiAvailable: false, aiConsent: false };
export const getState = () => state;
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function update(patch: Partial<State>) { state = { ...state, ...patch }; listeners.forEach(l => l()); }
export const useSite = () => useSyncExternalStore(subscribe, getState);
export function navigate(section: Section) {
  update({ section, modal: null, lastAction: `Navigated to ${section}` });
  history.replaceState(null,'', section === 'home' ? location.pathname : `#${section}`);
  document.getElementById(section)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
export function filterIndustries(filter: Filter) { update({ filter, lastAction: `Industry filter: ${filter}` }); }
export function openModal(modal: Modal) { update({ modal }); }
export function openDirectory(category = 'All') { update({ modal: 'directory', directoryCategory: category }); }
export function openArticle(id: string) { if (!content.some(c => c.id === id)) throw new Error('Unknown content ID'); update({ articleId: id, modal: 'article' }); }
export function saveContent(id: string, saved: boolean) {
  if (!content.some(c => c.id === id)) throw new Error('Unknown content ID');
  const shortlist = saved ? [...new Set([...state.shortlist,id])] : state.shortlist.filter(x => x !== id);
  if (shortlist.length > 12) throw new Error('Your collection is full. Remove an item before adding another.');
  try { localStorage.setItem('cat2028-shortlist', JSON.stringify(shortlist)); } catch { update({ storageAvailable: false }); }
  update({ shortlist, lastAction: saved ? 'Added to your collection' : 'Removed from your collection' });
}
export async function askGuide(query: string) {
  if (state.busy) throw new Error('The guide is responding. Please wait.');
  const q = query.trim();
  if (!q || q.length > 1200) throw new Error('Ask a question between 1 and 1,200 characters.');
  update({ modal: 'guide', busy: true, messages: [...state.messages, { id: Date.now(), role: 'user', text: q }] });
  const fallback = localAnswer(q);
  let answer: { text: string; sources: Content[]; mode: 'local' | 'ai'; notice?: string } = fallback;
  try {
    if (state.aiAvailable && state.aiConsent) {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, sourceIds: fallback.sources.map(s => s.id) }), signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('AI service unavailable');
      const data = await response.json();
      if (typeof data.text !== 'string' || data.mode !== 'ai') throw new Error('Invalid AI response');
      answer = { ...fallback, text: data.text, mode: 'ai' };
    }
  } catch { answer = { ...fallback, notice: 'Live AI is unavailable. Here are matching site resources instead.' }; }
  finally { update({ busy: false, messages: [...state.messages, { id: Date.now()+1, role: 'assistant' as const, ...answer }].slice(-30), lastAction: 'Guide response ready' }); }
  return answer;
}
export const publicState = () => ({ section: state.section, industryFilter: state.filter, visibleIndustries: industries.filter(i => state.filter === 'all' || i.id === state.filter).map(i => i.id), openPanel: state.modal, shortlist: state.shortlist, assistantMode: state.aiAvailable && state.aiConsent ? 'ai' : 'local-retrieval', nativeStatus: state.agentStatus, lastAction: state.lastAction, conceptYear: 2028, contentSnapshot: '2026-09-18' });
export { searchContent };
