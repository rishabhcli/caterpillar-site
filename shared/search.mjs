/** The deterministic site scorer. Plain ESM so the browser bundle and the Node assistant server share one implementation. */
const stopWords = new Set(['a','an','and','are','can','do','for','how','i','in','is','it','me','of','on','the','to','us','what','with','you','your','tell','about','show','find','caterpillar','cat','would','like','some','please']);

export function searchCorpus(corpus, query, limit = 8, fallback = []) {
  const terms = String(query).toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
  if (!terms.length) return fallback.slice(0, limit);
  return corpus.map((item, index) => {
    const title = item.title.toLowerCase(), text = `${item.category} ${item.summary} ${item.keywords}`.toLowerCase();
    const score = terms.reduce((n,t) => n + (title.includes(t) ? 5 : 0) + (text.includes(t) ? 2 : 0), 0);
    return { item, score, index };
  }).filter(r => r.score > 0).sort((a,b) => b.score-a.score || a.index-b.index).slice(0, limit).map(r => r.item);
}
