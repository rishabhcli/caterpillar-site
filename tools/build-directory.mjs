import fs from 'node:fs';
const text = JSON.parse(fs.readFileSync('.firecrawl/caterpillar.json', 'utf8')).markdown;
const nav = text.slice(0, text.indexOf('# Caterpillar.com Homepage'));
const records = new Map();
for (const match of nav.matchAll(/\[([^\[\]\n]+)\]\((https:\/\/[^\s)]+)\)/g)) {
  let [,title,url] = match;
  if (url.includes('#') || /scene7|\.(png|jpg)/.test(url) || !/caterpillar\.com/.test(url)) continue;
  if (/^https:\/\/www.caterpillar.com\/[a-z]{2}.html$/.test(url)) continue;
  title = title.replace(/^All /,'');
  const category = url.includes('/brands') ? 'Brands' : url.includes('/careers') || url.includes('careers.caterpillar') ? 'Careers' : url.includes('investor') ? 'Investors' : url.includes('/news') ? 'News' : url.includes('sustainability') ? 'Sustainability' : 'Company';
  if (!records.has(url)) records.set(url, {id: 'resource-' + records.size, title, category, summary: `Explore ${title.toLowerCase()} and related resources on the official Caterpillar website.`, url, keywords: title.toLowerCase()});
}
fs.writeFileSync('src/directory.json', JSON.stringify([...records.values()], null, 2)+'\n');
console.log(`Preserved ${records.size} official navigation resources.`);
