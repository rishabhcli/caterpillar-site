# Content and image provenance

Reviewed September 18, 2026. **2028 is a design concept, not the publication date or a product announcement.** The site keeps original story dates and distinguishes generated concept photography from source photography.

## Official content

- [Caterpillar homepage](https://www.caterpillar.com/en.html): main information architecture, corporate overview, brand resources, and current featured stories. `src/directory.json` retains 87 distinct official navigation destinations from the homepage, built by `tools/build-directory.mjs` from the saved scrape.
- [Industries](https://www.caterpillar.com/en/company/about-caterpillar/industries.html): construction, mining, energy, transportation, marine, oil and gas.
- [Innovation](https://www.caterpillar.com/en/company/about-caterpillar/innovation.html): technology and connectivity overview.
- Each story and curated content item in `src/content.ts` links directly to its original official source. Summaries are newly written; the detail panels link to complete originals rather than presenting themselves as full reproductions.

This is a curated concept homepage and resource explorer, **not a complete local mirror of every Caterpillar page**. Official careers, financial data, product specifications, dealer services, and original articles remain external.

## Images and branding

- `hero.webp`, `mining.webp`, `energy.webp` and their `-small` versions: original AI-generated 2028 concepts. See `IMAGE-PROMPTS.md` for full prompts. Generated using the built-in image generation tool; optimized and saved within this project.
- `caterpillar-logo.png`: Caterpillar homepage brand asset, `https://s7d2.scene7.com/is/image/Caterpillar/CM20220222-5c3c2-280a8?fmt=png-alpha`.
- `robotics.webp`: official homepage story image, `https://s7d2.scene7.com/is/image/Caterpillar/CM20260901-16d0d-5ec15`.
- `people.webp`: official homepage workforce story image, `https://s7d2.scene7.com/is/image/Caterpillar/CM20260814-e7077-bd157`.

Caterpillar marks and source imagery remain the property of their respective owners. The interface carries an independent/unofficial disclaimer; obtain appropriate rights before public commercial use.

## Technical references

- [WebMCP September 2026 draft](https://webmachinelearning.github.io/webmcp/): current `document.modelContext` API; earlier browser implementations may expose `navigator.modelContext`.
- [WebMCP repository](https://github.com/webmachinelearning/webmcp): shared human/agent application-state approach.
- [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create): optional server-side guide integration; no live provider is implied when credentials are absent.
