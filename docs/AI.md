# Site guide: local first, optional live AI

The default guide searches this site's curated content locally. It is not a model and does not send a question off-device. The interface labels this mode explicitly. The 2028 date describes a visual concept; source content is a September 18, 2026 snapshot, not a future forecast.

## Enable live AI locally

1. Copy `.env.example` to `.env` (ignored by Git).
2. Set **both** `OPENAI_API_KEY` and `OPENAI_MODEL` to your own OpenAI project key and an available Responses-compatible text model. No model is silently selected.
3. Restart `npm run dev`. For a built app: `npm run build`, then `node --env-file-if-exists=.env server/start.mjs` (Node 24).
4. Open the guide and explicitly opt in to live AI. Only then does a submitted question and its matching site sources go to OpenAI. Previous conversation messages and saved collections are not sent.

Never use a `VITE_` prefix for secrets. The API key remains in the Node process. Static-only deployment supports local retrieval but cannot provide the optional server-side endpoint.

## API and boundaries

- `GET /api/assistant/status` returns `{ "available": false }` unless both configuration values are present. `true` means configured, not that credentials/model access have been live-verified.
- `POST /api/assistant` accepts `{ "query": "…", "sourceIds": ["mining"] }` and returns `{ "text": "…", "mode": "ai", "sourceIds": ["mining"] }`.
- The server resolves IDs from its own corpus; caller-provided source text is never trusted. Build emits the public corpus into `dist/knowledge.json` for the production server.
- Questions are capped at 1,200 characters, requests at 16 KiB, and sources at six. Empty matches are rejected so the browser can fall back to local search. Limit: 12 requests per minute per local IP and four in-flight provider requests.
- Fixed provider endpoint; 25-second timeout; no CORS; local Host and same-origin checks; loopback-only default servers. Provider error bodies and secrets are not forwarded or logged.
- Server uses Responses API with `store: false`. This is not a promise of zero provider retention; your OpenAI project and service policies apply.
- Provider errors, missing configuration, and unsupported models fall back to local retrieval in the UI. Live generation is constrained by instructions to supplied source summaries, but generated answers can still be wrong. Official linked Caterpillar resources remain authoritative.

This is a local/demo server, **not** an authenticated public AI gateway. Before an Internet deployment, add authenticated access, trusted-origin configuration, distributed rate/budget limits, monitoring, and deployment-specific security review. Do not simply expose the port.

## Source and verification

Implementation follows the [official OpenAI Responses create API](https://developers.openai.com/api/reference/resources/responses/methods/create): `model`, `instructions`, `input`, `max_output_tokens`, `store`, and `output[].content[]` text extraction. No live-provider success is claimed without a configured-key test; local and mocked-provider tests verify only adapter behavior.
