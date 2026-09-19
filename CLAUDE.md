# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An independent, unofficial Caterpillar redesign concept (React 19 + Vite 7 + TypeScript). Its distinguishing feature is that **humans and AI agents drive the same page state**: eight schema-validated tools operate on the identical store the React UI renders from.

## Commands

```sh
npm run dev              # Vite dev server, http://127.0.0.1:5173 (strictPort)
npm test                 # Vitest unit tests in tests/, excluding e2e.spec.ts
npm run build            # tsc -b && vite build
npm run test:e2e         # Playwright against a dev server it starts itself
npm run check            # test + build + test:e2e (the full gate)
npm run preview          # Serve the built bundle at http://127.0.0.1:4173
npm start                # Production Node server (needs npm run build first)
npm run mcp              # stdio MCP server bridging to a running dev site
```

Single tests:

```sh
npx vitest run tests/webmcp.test.ts
npx vitest run tests -t 'rejects cross-origin'      # by test name
npx playwright test -g 'industry filters'           # single e2e test
node tools/mcp-smoke.mjs                            # real MCP stdio + headless browser round-trip
```

E2E uses `channel: 'chrome'` (installed Google Chrome), not a bundled Chromium. `tools/mcp-server.mjs` launches Playwright Chromium and falls back to Chrome — `npx playwright install chromium` may be needed.

There is no linter and no Vitest config file; Vitest runs on defaults. `tsconfig.json` only includes `src`, so `tsc -b` does **not** typecheck `tests/`, `server/`, or `tools/`.

## Architecture

### One store, two consumers

`src/store.ts` is a hand-rolled external store (`useSyncExternalStore`, module-level `state`, `listeners` set). Every mutation goes through `update()`. React reads it via `useSite()`; agents read it via `publicState()`.

`src/webmcp.ts` defines the eight tools as a single `tools` array — each entry carries a Zod schema, a `readOnly` flag, and a `run` that calls the **same exported store functions the UI's onClick handlers call** (`filterIndustries`, `saveContent`, `askGuide`, …). Do not add a parallel code path for agents; add a store function and call it from both places. `toolManifest` derives JSON Schema from the Zod schemas via `z.toJSONSchema`.

Three delivery surfaces sit on top of that array:

1. `window.catAgent` — always installed by `registerWebMCP()` in `src/main.tsx`.
2. Native WebMCP — feature-detected on `document.modelContext`, falling back to `navigator.modelContext`. Registration failure unwinds partial registrations and downgrades `agentStatus`; it is never assumed to exist.
3. `tools/mcp-server.mjs` — a real MCP stdio server that drives a shared browser tab with Playwright and calls `window.catAgent.invoke`. It only ever passes tool *names and JSON values* into `page.evaluate`, enforces loopback-only origins (`CAT_SITE_URL`, optional `CAT_CDP_URL`), refuses to act if the tab navigates off-origin, and serializes calls through a promise `queue`. stdout is reserved for MCP framing; diagnostics go to stderr.

### Content pipeline

`src/directory.json` (87 official navigation links) is **generated** by `tools/build-directory.mjs` from a saved Firecrawl scrape in the gitignored `.firecrawl/` directory — edit the generator, not the JSON. `src/content.ts` merges hand-curated `industries`/`stories`/`featured` with that directory (deduped by URL) into `content`, and provides the deterministic `searchContent` scorer (title hit = 5, body hit = 2, stopword filtered) plus `localAnswer`.

The Vite plugin in `vite.config.ts` emits this corpus to `dist/knowledge.json` at build time; `server/start.mjs` reads that file at boot so the production server has the same source-of-truth IDs.

### Optional AI adapter

`server/assistant.mjs` exports `createAssistantMiddleware({ content, env, fetchImpl })`, mounted in **four** hosts: the Vite dev server, the Vite preview server (both via `vite.config.ts`), the production `server/start.mjs`, and the Vercel functions in `api/assistant/`. It handles `GET /api/assistant/status` and `POST /api/assistant` only.

Invariants worth preserving when touching it:

- Availability requires **both** `OPENAI_API_KEY` and `OPENAI_MODEL`; no model is silently defaulted.
- The client sends `sourceIds`, never source text. The server resolves IDs against its own corpus and discards anything else the caller supplies (a test asserts injected `sourceText` never reaches the provider).
- Secrets stay in the Node process — never introduce a `VITE_`-prefixed key. `vite.config.ts` is the only place unprefixed env is read.
- Loopback host + same-origin checks by default. `hosted: true` (used only by the Vercel functions) swaps that for https same-origin against the request's own Host, requires a browser `Origin`/`Sec-Fetch-Site: same-origin` signal, keys rate limits on `x-forwarded-for`, and accepts an optional `ASSISTANT_ALLOWED_HOSTS` pin. Everything else is shared: no CORS, 16 KiB body cap, 1,200-char questions, ≤6 sources, 12 req/min/IP, ≤4 in flight, 25s upstream timeout, `store: false`, sanitized 502s that never forward provider bodies.
- Any failure path must degrade to local retrieval in the UI, not to an error state. `askGuide` in the store implements that fallback and attaches a `notice`.

### UI

`src/App.tsx` holds the whole interface (~25 components) and `src/styles.css` the whole stylesheet, both written in an extremely dense style — full components on one line, minimal whitespace. Match it rather than reformatting. Design tokens live in the `:root` block of `styles.css` (`--yellow`, `--bg`, `--panel`, `--line`, `--muted`, `--display`, `--mono`). Modals are a single `Overlays`/`ModalShell` pair keyed off `state.modal`; sections are anchored by `id` matching the `Section` union in `store.ts`.

## Project constraints

This project treats accuracy claims as a feature, and the tests and docs enforce it. When editing content, copy, or docs:

- Content is a **September 18, 2026 snapshot**; 2028 is the visual concept year only. Story items keep their original publication dates.
- Never fabricate stock prices, job availability, product specs, or dealer pricing, and never present anything as a live feed. `localAnswer` must say it found nothing rather than invent — there is a test for this.
- AI-generated imagery must stay visibly disclosed in the UI (`.concept-image-label`, `.sustainability-disclosure`) and documented in `docs/IMAGE-PROMPTS.md`.
- New content items need a real official source URL; `docs/SOURCES.md` tracks provenance and `tests/content.test.ts` asserts unique IDs and HTTPS URLs.
- Keep capability claims hedged the way `README.md` and `docs/` already do: unit tests prove the local implementation, not native browser WebMCP support, an attached Codex session, or live model behavior. The native-registration e2e test uses an **emulated** API contract.

`artifacts/` holds committed screenshots and smoke-test output written by the e2e suite; `docs/AI.md` and `docs/WEBMCP.md` are the detailed references for the two subsystems above.
