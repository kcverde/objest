# Product brief

## Product

**Objest** is a small personal Obsidian plugin that turns directly embedded PDFs—especially scans—into searchable note context with minimal manual work.

The authoritative first-version scope is [V1_SPEC.md](V1_SPEC.md). Ideas excluded from it belong in [BACKLOG.md](BACKLOG.md).

## Problem

Imported and scanned documents require manual reading, summarization, tagging, and metadata entry. This makes a document-heavy personal vault difficult to search and organize.

## Minimal v1 user story

Given an active Markdown note containing one or more directly embedded local PDFs, the user invokes **Objest: Analyze embedded PDFs**. On the current macOS Obsidian setup, Objest extracts or OCRs each bounded PDF, analyzes it with OpenAI, and automatically adds a document-relevant English title, a short English summary, basic metadata, and additive tags without changing user-authored note content outside Objest-owned callouts.

## Minimal output

For each successfully processed PDF:

- One concise, document-relevant English title derived from document content
- One-to-three-paragraph English summary
- Three-to-seven useful Obsidian tags when supported by the document
- Document type
- Document date when explicit
- Up to 15 useful entities
- Source language when identifiable
- Minimal provenance: processing time and model

Objest writes each per-PDF result to a native `[!objest]` callout immediately after frontmatter, using the generated document title as the callout title, and merges tags into the standard `tags` property without removing existing values.

## Design principles

1. **Useful before broad:** complete one personal macOS workflow before pursuing portability or distribution.
2. **Small scope:** reject unsupported/oversized work rather than build complex recovery or chunking in v1.
3. **User-content safety:** write only additive tags and exact top-of-body Objest callouts.
4. **Validated AI:** model output is untrusted and must pass a fixed runtime schema.
5. **Privacy clarity:** local OCR and OpenAI analysis are explicitly distinguished and consented to.
6. **Independent failure:** one failed PDF does not erase another PDF's successful output.
7. **Visible work:** processing starts only from the command and remains cancellable until persistence begins.
8. **Backlog discipline:** useful extras go to `BACKLOG.md`, not into v1 opportunistically.

## Included in minimal v1

- Personal use on macOS
- Command-palette invocation
- Direct local PDF embeds only
- Whole-PDF text extraction with bundled PDF.js
- Selective English OCR with bundled Tesseract runtime and data
- OpenAI Responses API using SecretStorage key and fixed `gpt-5.6-luna`
- One bounded AI request per PDF; reject above fixed limits
- Fixed English title/summary/tag/core-metadata schema
- One attachment at a time
- Simple progress/cancellation modal
- Automatic managed-section and additive-tag writes
- Always reprocess; no document-derived cache

## Excluded from minimal v1

- Windows, Linux, mobile, and Community Plugins release work
- Additional OCR or output languages
- Advanced model settings and other providers
- Hierarchical large-document processing or cost estimation
- Preview/edit-before-write
- Extra AI-defined metadata fields or custom prompts
- Stale-entry/tag cleanup and rename migration
- Ordinary links, recursive discovery, other formats, batch/background modes
- Page citations, sidecar notes, property mapping, semantic search, and chat

See [BACKLOG.md](BACKLOG.md) for the retained ideas.

## Success criteria

Minimal v1 succeeds when it works end to end in the designated macOS test vault:

- Finds direct PDF embeds and ignores unsupported references.
- Extracts text PDFs and locally OCRs image-only PDFs.
- Produces a schema-valid OpenAI result without sending filename/path or unrelated note data.
- Preserves all content outside Objest-owned callouts and never removes existing tags.
- Reprocessing replaces rather than duplicates an attachment entry.
- Reports bounded failures without corrupting the note or blocking unrelated PDFs.
- Passes automated checks and an Obsidian CLI smoke test.
