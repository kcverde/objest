# Minimal personal v1 specification

## Status

This document defines the smallest useful first version of Objest. It intentionally supersedes broader v1 ambitions recorded before D042. Features not required here belong in [BACKLOG.md](BACKLOG.md), not in the first implementation.

## Goal

From a Markdown note in Kevin's macOS Obsidian vault, run one command that analyzes directly embedded local PDFs—especially scans—and automatically adds a short English summary, a few tags, and basic metadata without overwriting user-authored note content.

## Target

- Personal use
- macOS only
- Current local Obsidian installation
- Manual development installation; no Community Plugins submission requirement
- PDF only
- English OCR and English generated output only

Objest may be portable internally, but v1 is accepted when it works reliably in the designated macOS development vault.

## User flow

1. Configure an OpenAI API key through Obsidian SecretStorage.
2. Open a Markdown note containing one or more direct local PDF embeds.
3. Run **Objest: Analyze embedded PDFs** from the command palette.
4. If first use, accept a short disclosure that normalized PDF text will be sent to OpenAI.
5. Watch a simple modal showing the current PDF and stage; optionally cancel.
6. Objest processes PDFs one at a time.
7. Each valid result is automatically written to the note. Failures are reported and do not erase prior valid output.

There is no preview screen, background processing, batch mode, or automatic trigger.

## Attachment scope

Objest processes:

- Unique local `.pdf` files directly embedded in the active Markdown note
- Obsidian wikilink embeds such as `![[scan.pdf]]`
- Markdown embeds that Obsidian resolves to a local PDF
- The entire PDF, even when the embed contains `#page=N`

Objest ignores:

- Ordinary non-embed links
- Remote URLs
- Embedded notes and recursive references
- Images and all non-PDF attachments

If an old Objest entry no longer matches a current embed, minimal v1 leaves it unchanged. Stale detection, rename migration, and cleanup are backlog items.

## Local PDF and OCR processing

- Read PDFs through Obsidian's Vault API.
- Use bundled PDF.js for parsing and embedded-text extraction.
- Treat a page as scanned when its normalized text layer contains fewer than 32 non-whitespace characters.
- Render only scanned pages, using the tested PDF.js print intent.
- Use the bundled Tesseract worker, WASM core, and compressed English trained data.
- Do not download OCR JavaScript, WASM, or language data in minimal v1.
- Preserve page order internally, but do not render citations.

## Fixed safety limits

Minimal v1 rejects an attachment rather than implementing complex large-document handling when any limit is exceeded:

| Limit                            |                      v1 ceiling |
| -------------------------------- | ------------------------------: |
| PDFs per command                 |                               5 |
| PDF size                         |                          25 MiB |
| Pages per PDF                    |                              50 |
| Rendered pixels per page         |                      16 million |
| Normalized text per PDF          |              150,000 characters |
| OCR languages                    |                    English only |
| OpenAI analysis requests per PDF |                               1 |
| Provider retries                 | 1 retry for a transient failure |
| Summary length                   |                2,000 characters |
| Generated tags                   |                               7 |
| Entities                         |                              15 |
| Extra metadata fields            |                               0 |

Local PDF loading, extraction, rendering, and OCR share a 15-minute deadline per PDF. Each OpenAI request has a separate 2-minute deadline, including its one allowed retry. Vault persistence is not abandoned behind a synthetic timeout because an underlying write could still complete after the caller loses certainty.

PDFs rejected by these limits are listed as failures. Hierarchical chunking, overrideable ceilings, and cost estimation are backlog items.

## OpenAI analysis

- Provider: OpenAI only
- SDK/API: official OpenAI JavaScript SDK with Responses API
- Default model: `gpt-5.6-luna`
- Model override: none in minimal v1
- Structured output: required
- Provider storage: `store: false`
- Request identity: no attachment filename, vault path, note name, or arbitrary metadata
- Output language: English only
- Prompt: one fixed, versioned Objest prompt; no custom instructions

Allowed request data:

- Normalized PDF text
- Numeric page-range/order labels needed to preserve source order
- Versioned instructions and JSON schema

Minimal v1 makes one analysis request per PDF. If the normalized input does not fit the v1 cap or model request, the PDF fails instead of being truncated or chunked.

## Analysis schema

The runtime-validated result contains only:

```ts
interface V1AttachmentAnalysis {
	schemaVersion: 1;
	promptVersion: 1;
	summary: string;
	tags: string[];
	documentType: string | null;
	documentDate: string | null;
	entities: string[];
	sourceLanguage: string | null;
	warnings: string[];
	model: string;
	processedAt: string;
}
```

Rules:

- Summary: one to three concise English paragraphs, 1–2,000 characters.
- Tags: zero to seven normalized Obsidian tags, at most 64 characters each. Three to seven are preferred when supported by the document; fewer are allowed when appropriate. Use the deterministic normalization rules in D043.
- Document type: `null` or 1–80 characters.
- Document date: a real calendar date in ISO `YYYY-MM-DD` form only when the document supports a specific date; otherwise `null`.
- Entities: at most 15 unique trimmed people, organizations, places, or identifiers useful for understanding the document, at most 120 characters each.
- Source language: `null` or 1–64 characters.
- Warnings: at most 10 values of at most 240 characters each.
- Model ID: 1–128 characters and taken from the provider response, not model-authored JSON.
- Processed timestamp: a UTC ISO 8601 value supplied by Objest.
- Unknown values are `null` or omitted from rendered output; never invent them.
- No document-specific arbitrary extra fields in minimal v1.
- PDF/OCR text is untrusted data and cannot alter instructions or output structure.

## Note output

Objest owns one section immediately after YAML frontmatter, or at the file start when frontmatter is absent:

```markdown
<!-- objest:managed:start -->

## Objest

<!-- objest:entry:start id="<base64url-vault-path>" -->

### [[scan.pdf]]

Summary text.

- **Document type:** …
- **Document date:** …
- **Entities:** …
- **Language:** …
- **Processed:** …
- **Model:** `gpt-5.6-luna`

<!-- objest:entry:end -->
<!-- objest:managed:end -->
```

Persistence rules:

- Render Markdown in code; never persist model-authored Markdown directly.
- Replace only the matching attachment entry inside valid Objest markers.
- Preserve all content outside Objest markers.
- Parse only the exact line-oriented marker grammar in D044. Fail without writing when managed/entry markers are orphaned, duplicated, nested, out of order, have duplicate/invalid IDs, or otherwise malformed.
- Write the managed body entry first through a conflict-aware Vault transformation.
- Then add generated tags to existing frontmatter `tags` through `processFrontMatter`.
- Never remove existing tags.
- If tag merging fails after the body write, report the partial failure; retry can repair it.
- Reprocessing always calls OCR/AI again and replaces the matching entry only after the new result validates.

Minimal v1 does not mark stale entries, migrate renamed attachments, track tag ownership, or clean old tags.

## Progress and cancellation

The modal shows:

- Current attachment and position, such as `2 of 3`
- Current stage: reading, extracting, rendering, OCR, analyzing, validating, writing
- Cancel button until persistence commit begins
- Final written/failed/cancelled counts with short actionable errors

Cancellation stops OCR/network work and future attachments where practical. Once body/tag persistence begins for a validated attachment, Objest finishes that short commit and then stops.

## Privacy and retention

- Source PDFs never leave the device.
- Only the allowed normalized analysis input is sent to OpenAI after one-time versioned consent.
- API key stays in Obsidian SecretStorage.
- Do not persist or log extracted text, OCR output, chunks, raw requests, or raw responses.
- Keep intermediates in memory only for the current attachment and release them after completion/cancellation.
- No telemetry.
- No OCR asset network request in minimal v1 because English data is bundled.

## Expected failures

Minimal v1 should fail safely and explain the problem, but may not recover elegantly from:

- Encrypted/password-protected PDFs
- Malformed or unusual PDFs
- Poor scans, handwriting, complex layouts, and unusual rotations
- Concurrent note edits during the short write sequence
- Ambiguous/broken embed paths
- OpenAI outages, rate limits, invalid keys, model changes, and malformed responses

These cases must not cause writes outside Objest markers or removal of user tags/content.

## Acceptance checklist

Minimal v1 is complete when, on the designated macOS test vault:

- The plugin loads/reloads without Objest errors.
- The command discovers direct PDF embeds and ignores ordinary links/non-PDFs.
- Text PDFs avoid OCR and image-only PDFs use local OCR.
- A fake provider test validates the full pipeline deterministically.
- An opt-in live OpenAI test produces a schema-valid result with `store: false` and no filename/path payload.
- Valid output appears at the top of the note and generated tags are added without removing existing tags.
- Reprocessing replaces the entry instead of duplicating it.
- A failure for one PDF leaves other successful entries intact.
- Cancellation prevents subsequent attachments from starting.
- `npm run check` passes.
- Obsidian CLI smoke checks show no Objest runtime or console errors.
