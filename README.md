# Caterpillar / 2028

An independent, unofficial redesign concept for Caterpillar: industrial typography, cinematic AI-imagined machinery, a responsive editorial interface, a source-backed guide, and real agent-operable interactions.

## Run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Node.js 24 is recommended (the production start command uses its environment-file support).

```sh
npm test                 # Catalog, search and truthful local-answer tests
npm run build            # TypeScript + production bundle
# E2E uses installed Google Chrome (channel: chrome).
npm run test:e2e         # Real browser interactions and responsive screenshots
npm run check            # All three verification gates
npm run preview          # Serve the production build at http://127.0.0.1:4173
```

## Explore

- Three cinematic hero scenes and construction, mining, and energy industry filters.
- Accessible search (`⌘/Ctrl K`), source-linked resource details, company directory, innovation tabs, sustainability, current-story snapshot, careers and brands.
- A collection shared between people and agents, persisted in local browser storage, with JSON export. No account or remote collection database.
- Cat Intelligence: a conversational interface that defaults to **deterministic local content retrieval**, not generative AI. Answers show their source resources. Optional live AI requires server configuration and explicit UI opt-in; without these, the complete local guide remains available.
- Native WebMCP registration when available, plus `window.catAgent` and an included stdio MCP server for compatible agents. Agent mutations act on the same visible React state as human controls.

## Optional live AI and production serving

Copy `.env.example` to `.env`, set `OPENAI_API_KEY` and an explicit `OPENAI_MODEL`, then restart `npm run dev`. The guide requires the visitor to enable its live-AI checkbox before sending a question and matched public resources to OpenAI. Conversation history and the saved collection are not transmitted. Without configuration, or on a provider failure, it falls back to source-backed local retrieval. Configured availability does not validate credentials until a request is made.

```sh
npm run build
npm start                 # Production site + optional AI at http://127.0.0.1:4173
```

Deploying to Vercel: `vercel.json` is committed, the static build is served from `dist/`, and `api/assistant/` exposes the same guide endpoint as a function. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the Vercel project to enable live AI; without them the deployed site serves local retrieval only.

See [docs/AI.md](docs/AI.md) for configuration and deployment limits. These local servers are not public-production security hardening or a managed AI service. Live provider output needs configured credentials and separate verification.

## Agent access

Start the website, then inspect the **Agent access** panel in the footer. The browser-console bridge works immediately:

```js
await window.catAgent.invoke('filter_industries', { industry: 'mining' });
await window.catAgent.invoke('save_content', { id: 'mining', saved: true });
await window.catAgent.invoke('get_site_state', {});
```

See [docs/WEBMCP.md](docs/WEBMCP.md) for the runnable Codex/stdio setup, browser attachment, tool schemas, compatibility limitations and security boundaries. Native registration is feature-detected, never assumed. The automated native registration test uses an **emulated API contract**, not proof of a currently shipping browser implementation or an external Codex connection.

## Content and provenance

The resource catalog retains the original site's major information areas and links to official sources. It contains curated summaries, **not a complete mirror of every Caterpillar page**. Content snapshot: **September 18, 2026**. News uses original publication dates; live stocks, job availability, product specifications and dealer prices are not fabricated or presented as current feeds.

- [Caterpillar](https://www.caterpillar.com/en.html)
- [Industries](https://www.caterpillar.com/en/company/about-caterpillar/industries.html)
- [Innovation](https://www.caterpillar.com/en/company/about-caterpillar/innovation.html)
- [Sustainability](https://www.caterpillar.com/en/company/sustainability.html)
- [Careers](https://careers.caterpillar.com/en/jobs/)
- [Investors](https://investors.caterpillar.com/overview/default.aspx)

Hero, mining and energy imagery is AI-generated 2028 concept art, visibly disclosed in the interface. It does not depict announced products or verified future capabilities. Caterpillar and Cat names and trademarks belong to Caterpillar Inc.; this project is not affiliated with or endorsed by Caterpillar.

## Verification evidence

The Playwright suite exercises filters/scenes, search and source details, collection persistence/export, local guide answers, browser-agent mutations, rejected tool arguments, emulated native registration, and desktop/mobile layouts. Screenshots are written to `artifacts/`; failure traces and reports are generated by Playwright. Passing these checks validates the local implementation, not official Caterpillar integrations, external links' future availability, native browser compatibility, or live model behavior without configured credentials.
