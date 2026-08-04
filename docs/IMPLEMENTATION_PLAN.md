# Minimal v1 implementation plan

## Rule

Implement only [V1_SPEC.md](V1_SPEC.md). Put useful additions in [BACKLOG.md](BACKLOG.md). `docs/DECISIONS.md` remains authoritative when a conflict appears.

## Current progress

- Repository/npm/esbuild scaffold: **complete**
- macOS PDF.js/Tesseract extraction spike: **complete**
- AI analysis: **not started**
- Managed note persistence: **not started**
- End-to-end personal v1: **not started**

See [SPIKE_RESULTS.md](SPIKE_RESULTS.md).

## Phase 1: Simplify scaffold to v1

- Remove/hide settings for OCR languages, model override, and cost thresholds.
- Keep only selected OpenAI secret and versioned consent state.
- Rename the development spike command only after the end-to-end command exists.
- Extract fixed v1 constants for model, English, and limits.
- Add `docs/V1_SPEC.md` links to code-facing comments only where useful.

**Exit:** The settings and public command surface promise no backlog capability.

## Phase 2: Fixed domain and OpenAI analysis

- Add the exact `V1AttachmentAnalysis` Zod schema and TypeScript inference.
- Enforce field counts/lengths from V1 spec.
- Add deterministic tag normalization and ISO-date validation.
- Add a small provider interface and fake provider.
- Add the official OpenAI SDK only inside `src/providers/openai/`.
- Use Responses API, fixed `gpt-5.6-luna`, structured output, `store: false`, and abort signal.
- Build one versioned prompt that treats PDF content as untrusted data.
- Ensure request-construction tests reject filenames, paths, note content, arbitrary metadata, and oversized input.
- Add opt-in live contract test outside the normal suite.

**Exit:** Bounded normalized text produces a validated analysis through the fake provider; offline tests verify the exact OpenAI request contract.

## Phase 3: Minimal discovery/extraction orchestration

- Keep direct-embed discovery through Obsidian APIs.
- Enforce 5-PDF, 25 MiB, 50-page, 16-million-pixel, and 150,000-character ceilings.
- Add explicit PDF render, OCR, and provider timeouts.
- Process one PDF at a time.
- Keep intermediates for only the current attachment.
- Map encrypted/malformed/oversized/empty PDFs to actionable failures.
- Continue to the next PDF after an independent failure.

**Exit:** Synthetic text, scan, empty, malformed, and over-limit fixtures produce deterministic bounded outcomes.

## Phase 4: Deterministic rendering and safe writes

- Implement exact managed/entry markers from V1 spec.
- Encode attachment path identity as base64url for marker IDs.
- Render summary and fixed metadata in code with Markdown escaping.
- Insert the managed section immediately after frontmatter.
- Replace only a matching entry; leave unmatched old entries unchanged.
- Fail closed on malformed, duplicate, or nested markers.
- Update managed body first through a conflict-aware Vault transform.
- Add tags second through `processFrontMatter`, preserving all existing tags/properties.
- Do not remove tags or track generated ownership in v1.
- Add idempotence, hostile Markdown, marker injection, and partial-write tests.

**Exit:** Repeated runs replace entries without changing user content outside owned markers or removing existing tags.

## Phase 5: Minimal command, consent, and modal

- Add **Objest: Analyze embedded PDFs**.
- Add one-time versioned OpenAI disclosure before the first provider request.
- Show current attachment, current stage, Cancel, and final counts.
- Abort before persistence and finish an already-started body/tag commit.
- Ensure closing the modal requests cancellation.
- Retain the old valid entry when replacement analysis fails.

**Exit:** The complete user flow works in the designated macOS test vault.

## Phase 6: Personal v1 verification

- Run `npm run check`.
- Inspect production bundle size and contents.
- Verify only expected network destinations and no OCR runtime downloads.
- Inspect persisted `data.json` for secret/document leakage.
- Run Obsidian reload, error, console, modal, cancellation, and write smoke checks.
- Test a text PDF, scanned PDF, multiple embeds, no embeds, invalid key, malformed PDF, limit rejection, rerun, and partial failure.
- Confirm source notes/fixtures contain no private data before adding them to the repository.

**Exit:** Every acceptance item in V1 spec passes locally, and remaining failures/ideas are documented in Backlog.

## Deliberately deferred

Do not implement hierarchical chunking, extra languages, model selection, additional providers, output-language settings, arbitrary metadata, stale cleanup, tag provenance, preview mode, sidecars, batch/background processing, other formats, cross-platform support, or Community Plugins work during minimal v1.
