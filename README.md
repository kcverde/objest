# Objest

**Objest** (`objest`) is an Obsidian desktop plugin that analyzes embedded PDFs and enriches the active note with AI-generated summaries, tags, and metadata. Its primary use case is scanned documents.

## Status

Objest's minimal end-to-end v1 is implemented and covered by offline tests. Local PDF/OCR compatibility has passed in Obsidian on macOS, and the owner has successfully exercised the connected OpenAI analysis and note-write flow in the development vault. The minimal v1 is defined in [docs/V1_SPEC.md](docs/V1_SPEC.md); excluded ideas are in [docs/BACKLOG.md](docs/BACKLOG.md).

## V1 workflow

1. Invoke **Objest: Analyze embedded PDFs** from the command palette.
2. Discover unique local PDFs directly embedded in the active note.
3. Extract text locally with PDF.js and OCR scanned pages locally with Tesseract.js.
4. Show a simple cancellable progress modal and reject PDFs above fixed v1 limits.
5. Send only bounded normalized document text—not the source PDF, filename, path, or unrelated vault content—to OpenAI using the user's own API key.
6. Validate the response, merge generated tags into the note's existing `tags`, and automatically update a top-of-note Objest callout titled for each document.

Every invocation reprocesses the embedded PDFs and may incur OpenAI charges. Existing user tags and content outside Objest-owned callouts are preserved. New output uses native callouts rather than HTML marker comments; exact legacy marker sections are migrated on the next successful write.

## Install with BRAT

Objest is available as a macOS desktop beta through [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable BRAT 1.1.0 or newer.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `kcverde/objest`, track the latest release, and enable Objest.

BRAT installs the release's `main.js`, `manifest.json`, and `styles.css`. Objest is not submitted to the Community Plugins directory.

## Setup and first test

1. Install through BRAT, or build with `npm install && npm run build` and reload Objest in the designated macOS development vault.
2. In Obsidian settings, open **Objest** and select an existing SecretStorage entry containing an OpenAI API key. The key value is not saved in Objest's `data.json`.
3. Use a disposable note with a synthetic or non-sensitive directly embedded PDF.
4. Run **Objest: Analyze embedded PDFs**.
5. Review the OpenAI disclosure. Cancelling performs no extraction, request, or write; accepting stores only the consent version.
6. For the first live run, use a small text PDF and verify its document-titled Objest callout and additive frontmatter tags. Then rerun and confirm the existing attachment entry is replaced rather than duplicated.

The fixed model is `gpt-5.6-luna`. Its availability, cost, and output quality depend on the user's OpenAI account and current OpenAI service. Do not use private documents for the first live verification.

## Privacy summary

Document extraction and English OCR happen locally. Minimal v1 bundles the executable OCR runtime and English trained data and does not download OCR assets. AI analysis is not fully local: normalized PDF text is sent to OpenAI after a one-time disclosure and consent. Objest does not persist OCR text, normalized text, chunks, or raw model responses outside the current run. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Project documentation

- [Minimal personal v1 specification](docs/V1_SPEC.md)
- [Backlog](docs/BACKLOG.md)
- [Product brief](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decision log](docs/DECISIONS.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [PDF and OCR spike results](docs/SPIKE_RESULTS.md)
- [Privacy and data flow](docs/PRIVACY.md)
- [Contributor and agent guidance](AGENTS.md)

## Planned platform and tooling

- Personal use on the current macOS Obsidian desktop setup
- Minimum Obsidian version: 1.11.4 (for `SecretStorage`)
- TypeScript, npm, and esbuild following official sample-plugin conventions
- MIT License

## Development

```bash
npm install
npm run dev       # watch build
npm run check     # format, lint, types, tests, and production build
```

Normal tests use fake providers and make no network requests. The separate `npm run test:live:openai` command is opt-in, requires `OPENAI_API_KEY`, uses synthetic text, and must never run as part of `npm run check`.

BRAT releases are created from a passing production build. The release tag, release name, and `manifest.json` version must match, and the release assets must include `main.js`, `manifest.json`, and `styles.css`. Generated `main.js` remains untracked.
