# Objest

**Objest** (`objest`) is an Obsidian desktop plugin that analyzes embedded PDFs and enriches the active note with AI-generated summaries, tags, and metadata. Its primary use case is scanned documents.

## Status

Objest is a small personal project in early implementation. The TypeScript/npm/esbuild scaffold is working, and the PDF.js/Tesseract.js extraction spike has passed on macOS with Obsidian 1.13.4. The minimal v1 is defined in [docs/V1_SPEC.md](docs/V1_SPEC.md); excluded ideas are in [docs/BACKLOG.md](docs/BACKLOG.md).

## Planned v1 workflow

1. Invoke **Objest: Analyze embedded PDFs** from the command palette.
2. Discover unique local PDFs directly embedded in the active note.
3. Extract text locally with PDF.js and OCR scanned pages locally with Tesseract.js.
4. Show a simple cancellable progress modal and reject PDFs above fixed v1 limits.
5. Send only bounded normalized document text—not the source PDF, filename, path, or unrelated vault content—to OpenAI using the user's own API key.
6. Validate the response, merge generated tags into the note's existing `tags`, and automatically update a marked `## Objest` section at the top of the note body.

Every invocation reprocesses the embedded PDFs. Existing user tags and content outside Objest's managed markers are preserved.

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

The current development-only command is **Objest: Run PDF and OCR compatibility check**. It does not call OpenAI or write generated analysis.
