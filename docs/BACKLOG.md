# Backlog

This document holds useful work intentionally excluded from the minimal personal v1 in [V1_SPEC.md](V1_SPEC.md). Items here are not commitments or permission to expand v1 silently. Promote an item only through an explicit decision and corresponding spec update.

## Priority definitions

- **Next:** likely first improvements after the personal v1 works end to end
- **Later:** valuable but not needed soon
- **Research:** requires evidence or a new product decision

## Next

### Large PDF support

- Page-aware hierarchical chunking and final synthesis
- Token-aware chunk sizing
- Partial analysis conflict handling
- Cost/request estimates before processing
- Configurable lower work thresholds
- Resume/retry behavior for long runs

### Persistence hardening

- Mark entries whose PDF is no longer embedded as stale
- Detect and migrate renamed/moved attachment entries
- Explicit stale-entry cleanup command
- Track attachment-to-tag provenance
- Confirmed cleanup for unclaimed generated tags
- Stronger optimistic concurrent-edit detection and recovery
- Regression suite for malformed/duplicate/nested markers

### OCR quality

- Additional downloadable Tesseract language packs
- Language-pack settings, progress, offline status, cache inspection, and cleanup
- Automatic source-language detection
- Rotation/orientation detection
- Better mixed text/image page classification
- OCR confidence display and low-confidence warnings
- Handwriting and complex-layout evaluation

### Analysis quality

- Representative quality/cost evaluation for `gpt-5.6-luna`
- Advanced model-ID override
- Configurable output language
- Document-specific extra metadata fields
- Better entity normalization and duplicate handling
- Prompt/schema migration support
- Optional page references for important claims

### UX

- Preview/dry-run command
- Editable result review before persistence
- More detailed per-attachment progress and timing
- Retry failed attachment action
- Open generated entry or source PDF from completion UI
- Accessible keyboard/focus review of modal interactions

## Later

### Platform and distribution

- Windows desktop support and OCR packaging validation
- Linux desktop support and OCR packaging validation
- iOS and Android feasibility
- Obsidian Community Plugins submission
- Public release automation, changelog, contribution guide, and security policy
- Third-party notices and final Community Plugins bundle-size review
- Replace provisional repository URLs and contributor metadata

### Providers and models

- Anthropic adapter
- Gemini adapter
- OpenAI-compatible custom endpoint
- Fully local model adapter
- Provider/model capability discovery
- Per-provider privacy/consent versions
- Provider fallback and user-selected routing

### Attachment scope and formats

- Ordinary PDF links as an opt-in scope
- Page-scoped PDF analysis
- Recursive traversal through embedded notes with cycle/cost controls
- Raw PNG/JPEG/TIFF/WebP OCR
- Office documents and plain text
- User-selected attachment processing from a context menu
- Whole-note and whole-vault batch modes

### Output and organization

- Sidecar note per attachment
- User-defined property mappings
- Searchable frontmatter aggregates
- Obsidian Bases integration
- Configurable managed-section placement and heading
- Custom rendering templates
- Summary styles and lengths
- Action items, dates, and task extraction

### Processing modes

- Skip unchanged attachments using content/config hashes
- Local extraction cache with explicit privacy controls
- Background processing on note/file changes
- Queue management and configurable concurrency
- Scheduled/batch processing
- Semantic indexing, document search, and chat

## Research and edge cases

### PDF parser security

- Decompression bombs and extreme object streams
- Cyclic/malformed object graphs
- Extreme page dimensions and image counts
- Password-protected and encrypted PDFs
- Embedded files, actions, JavaScript, and unsafe PDF features
- Parser/worker timeout and memory enforcement
- Fuzz testing and corpus licensing

### Obsidian resolution

- Ambiguous duplicate filenames in different folders
- URL-encoded paths and aliases
- Markdown embed variants
- Canvas and property-based attachment references
- Rename events while processing
- Note deletion/move during processing
- Sync/plugin races and adapter-specific behavior

### Model and prompt safety

- Prompt injection inside PDF/OCR text
- Oversized or deeply nested structured output
- Unexpected Unicode and hostile Markdown values
- Managed-marker injection attempts
- False facts and unsupported dates/entities
- Model deprecation and alias drift
- Provider request retention and policy changes

### Reliability and observability

- Redacted diagnostic export
- Run-local opaque attachment IDs in logs
- Performance benchmarks by page type and machine
- Bundle startup/memory profiling
- Network destination verification
- Persisted plugin-data inspection
- Crash recovery without storing document-derived intermediates

## Explicitly not planned unless the product changes

- Hosted Objest backend
- Managed user billing
- Uploading source PDFs to a cloud service
- Hidden telemetry or analytics
- Fetching/executing remote JavaScript or WASM
- Silent writes outside frontmatter tags and Objest-managed markers
