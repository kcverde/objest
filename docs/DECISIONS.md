# Decision log

This file records product and architecture decisions in the order they are discussed. Do not silently convert assumptions into decisions.

## Status terms

- **Open:** awaiting a decision
- **Accepted:** chosen for the current target release
- **Deferred:** intentionally postponed
- **Superseded:** replaced by a later decision

## Decision sequence

| ID   | Topic                                 | Status     | Decision                                                                |
| ---- | ------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| D001 | Privacy and processing boundary       | Accepted   | Local extraction/OCR with BYOK cloud AI                                 |
| D002 | AI provider strategy                  | Accepted   | Pluggable provider interface; OpenAI adapter first                      |
| D003 | OCR and PDF extraction strategy       | Accepted   | PDF.js text extraction with Tesseract.js OCR fallback                   |
| D004 | Supported Obsidian platforms          | Superseded | Personal macOS-only v1 under D042                                       |
| D005 | Attachment discovery semantics        | Accepted   | Direct local embeds only                                                |
| D006 | Generated output location             | Accepted   | Active-note tags plus managed per-attachment section                    |
| D007 | Metadata schema                       | Superseded | Fixed core only in minimal v1 under D042                                |
| D008 | Review and write behavior             | Accepted   | Automatically write validated results after explicit command invocation |
| D009 | Reprocessing and cache policy         | Accepted   | Always reprocess embedded attachments when invoked                      |
| D010 | Credential storage                    | Accepted   | Obsidian SecretStorage; minimum app version 1.11.4                      |
| D011 | Error, progress, and cancellation UX  | Accepted   | Cancellable per-attachment progress modal                               |
| D012 | Plugin name and identifier            | Accepted   | Objest (`objest`)                                                       |
| D013 | Model selection strategy              | Superseded | Fixed `gpt-5.6-luna` in minimal v1 under D042                           |
| D014 | Default model profile                 | Accepted   | Balanced compact model; pin exact ID during implementation              |
| D015 | OCR language policy                   | Superseded | English only in minimal v1 under D042                                   |
| D016 | PDF embed page scope                  | Accepted   | Analyze the entire resolved PDF                                         |
| D017 | Large-document strategy               | Superseded | Reject above simple v1 limits under D042                                |
| D018 | Attachment concurrency                | Accepted   | Process one attachment at a time                                        |
| D019 | Managed-section placement             | Accepted   | Top of note immediately after properties                                |
| D020 | Generated tag storage                 | Accepted   | Additive merge into standard `tags` property                            |
| D021 | Core metadata properties              | Accepted   | Tags only in frontmatter; all other metadata in managed section         |
| D022 | Supported attachment formats          | Accepted   | PDF only                                                                |
| D023 | Plugin scaffold and build tooling     | Accepted   | Official sample conventions with npm, TypeScript, and esbuild           |
| D024 | Source citation policy                | Accepted   | Do not render page citations in generated output                        |
| D025 | Summary presentation                  | Accepted   | Concise paragraphs followed by readable metadata                        |
| D026 | Distribution target                   | Superseded | Small personal project under D042                                       |
| D027 | Project license                       | Accepted   | MIT License                                                             |
| D028 | Cost and size guardrails              | Superseded | Fixed rejection limits; no cost estimator under D042                    |
| D029 | Network privacy consent               | Accepted   | One-time disclosure before the first OpenAI request                     |
| D030 | Local content retention               | Accepted   | No persistent document-content cache                                    |
| D031 | OCR asset distribution                | Accepted   | Bundle executable assets and English; download additional languages     |
| D032 | Stale managed entries                 | Superseded | Leave old entries unchanged in minimal v1 under D042                    |
| D033 | Write consistency and edit conflicts  | Accepted   | Conflict-checked body update first, then additive frontmatter tags      |
| D034 | OpenAI request privacy controls       | Accepted   | No filename/path; disable provider-side response storage                |
| D035 | Cancellation/write boundary           | Accepted   | Abort processing promptly; finish an already-started write commit       |
| D036 | Hard resource limits                  | Accepted   | Non-bypassable safety ceilings; users may only lower thresholds         |
| D037 | Generated-tag provenance              | Superseded | Additive tags without ownership tracking under D042                     |
| D038 | OpenAI API and transport              | Accepted   | Official OpenAI SDK with Responses API and structured outputs           |
| D039 | Concrete default OpenAI model         | Accepted   | `gpt-5.6-luna`                                                          |
| D040 | Analysis output language              | Superseded | English only in minimal v1 under D042                                   |
| D041 | Prompt customization                  | Accepted   | One fixed, versioned prompt contract; no custom instructions in v1      |
| D042 | Minimal personal v1 scope             | Accepted   | macOS-only, fixed English, fixed model, bounded single-request pipeline |
| D043 | Fixed schema field limits             | Accepted   | Conservative bounded core fields and deterministic tag normalization    |
| D044 | Marker parsing and operation timeouts | Superseded | Legacy marker grammar replaced by D045; fixed timeouts retained         |
| D045 | Document titles and owned output      | Accepted   | AI titles in native owned callouts; no new HTML marker comments         |
| D046 | BRAT beta distribution                | Accepted   | Publish version-matched prerelease assets; no Community submission      |

---

## D001: Privacy and processing boundary

**Status:** Accepted

### Question

Where should extraction, OCR, and AI inference happen, and what document data may leave the user's device?

### Options under consideration

1. **Local extraction/OCR with bring-your-own-key cloud AI** — the plugin extracts content locally and sends only the required normalized content to a provider selected and configured by the user.
2. **Fully local processing** — OCR and model inference stay on-device, maximizing privacy but substantially increasing implementation, packaging, performance, and cross-platform complexity.
3. **Plugin plus managed backend** — the plugin uploads documents or extracted content to a service operated for the product, simplifying user setup while adding infrastructure, billing, security, and policy obligations.

### Recommendation

Start with local extraction/OCR and bring-your-own-key cloud AI. It keeps the plugin architecture and operating burden manageable while giving users explicit control over their provider credentials. Design provider and extraction interfaces so a local model can be added later.

### Decision

For v1, extraction and OCR happen locally. AI analysis uses a cloud provider configured with the user's own API key. Only the normalized content required for analysis is sent to that provider; the plugin does not upload source attachments unless a later, explicit decision changes this boundary.

### Consequences

- The plugin must clearly document which normalized data is transmitted.
- OCR and extraction libraries must run inside the supported Obsidian environment.
- Credentials belong to the user and there is no project-operated processing backend in v1.
- Provider requests must minimize content and avoid sending unrelated note or vault data.
- Local model support remains possible behind the extraction/provider interfaces, but is not required for v1.
- The plugin must not imply that processing is fully local: normalized document content leaves the device for AI analysis.

---

## D002: AI provider strategy

**Status:** Accepted

### Question

Should v1 support one AI service, several native integrations, or a generic compatible endpoint?

### Decision

Define a narrow provider interface and ship one polished OpenAI adapter first. The orchestration, domain schema, validation, and UI must not depend directly on OpenAI SDK types.

### Consequences

- OpenAI is the only officially supported cloud AI provider required for v1.
- Users supply their own OpenAI API key under D001.
- Provider-specific request construction, model discovery/configuration, errors, and structured-output handling stay inside the OpenAI adapter.
- Tests use a fake provider through the shared interface; normal tests never require a live API key.
- Anthropic, Gemini, OpenAI-compatible endpoints, and local models are extension paths rather than v1 commitments.
- The model selection and default model will be decided when credentials and settings are specified.

---

## D003: OCR and PDF extraction strategy

**Status:** Accepted

### Question

How should the plugin perform local text extraction and OCR for scanned PDFs?

### Decision

Use PDF.js to parse PDFs and extract embedded text. Detect pages without sufficient usable text and render those pages for OCR with Tesseract.js/WASM. Do not require a companion process or user-installed system tool in v1.

### Consequences

- The plugin remains self-contained, subject to supported-platform testing.
- PDF rendering and OCR must run off the primary interaction path with progress and cancellation where possible.
- Bundle size, worker loading, WASM packaging, memory use, and Content Security Policy behavior require an early technical spike.
- OCR should be page-selective rather than automatically processing every page.
- Extraction results must preserve page numbers and identify whether text came from the PDF text layer or OCR.
- OCR language packs need a loading, caching, and configuration policy in a later decision or implementation plan.
- If the technical spike demonstrates unacceptable limitations, this decision should be revisited rather than bypassed with undocumented native dependencies.

---

## D004: Supported Obsidian platforms

**Status:** Superseded by D042 for minimal v1

### Question

Which Obsidian platforms must the first release support?

### Decision

Target Obsidian desktop on macOS, Windows, and Linux for v1. Keep core interfaces and domain logic portable where practical, but do not claim iOS or Android support until the extraction/OCR pipeline and UI are tested there.

### Consequences

- Desktop behavior and packaging are release requirements across all three major desktop operating systems.
- Mobile support is a later validation milestone, not a v1 acceptance criterion.
- Portable web APIs are still preferred when they do not compromise the desktop implementation.
- Any Node or Electron dependency must remain isolated behind a capability boundary and cannot leak into portable domain logic.
- Documentation and the plugin manifest must state the actual support level without implying mobile compatibility.

---

## D005: Attachment discovery semantics

**Status:** Accepted

### Question

Which attachments should the command discover from the active note in v1?

### Decision

Process supported local attachment files that are directly embedded in the active Markdown note. Do not process ordinary non-embed links, remote URLs, or attachments found by recursively following linked or embedded notes.

### Consequences

- An explicit embed is the user's scope signal for v1.
- Support Obsidian wikilink embeds and Markdown image/embed syntax where they resolve to a local `TFile`.
- Deduplicate repeated embeds of the same attachment within a run.
- Ignore page fragments and display-size modifiers when resolving the underlying file, while preserving useful PDF page scope for a later decision if practical.
- Embedded Markdown notes are not traversed for their attachments.
- Unsupported embedded file types should be skipped with an understandable explanation rather than passed to the PDF pipeline.
- Ordinary links can be added later as an opt-in scope mode without changing the default.

---

## D006: Generated output location

**Status:** Accepted

### Question

Where should generated summaries, tags, and metadata be stored?

### Decision

Store results in the active note. Merge approved note-level properties and tags into frontmatter, and maintain per-attachment summaries and detailed metadata inside a clearly marked plugin-managed section in the note body.

### Consequences

- Persistence must preserve unrelated frontmatter keys, existing tags, and user-authored body content.
- The managed section needs stable markers and a documented format so it can be found and updated idempotently.
- Each attachment entry must use a stable attachment identity, preferably its resolved vault path rather than display text alone.
- Reprocessing one attachment should replace only that attachment's generated entry.
- When multiple attachments produce tags, merge them additively and deterministically under D020; other metadata remains per attachment under D021.
- Moving or renaming attachments should be handled through Obsidian APIs where possible; stale generated entries need an explicit policy.
- Sidecar notes may be added later but are not part of the v1 write path.

---

## D007: Metadata schema

**Status:** Superseded by D042 for minimal v1

### Question

How structured should generated metadata be in v1?

### Decision

Use a versioned schema with a stable core and optional document-specific extra fields. The initial core should cover document title, document type, document date, entities, language, summary, tags, warnings, and provenance. Extra metadata is a validated collection of display label/key/value entries rather than arbitrary top-level note properties.

### Consequences

- Core fields have documented meanings, types, nullability, and normalization rules.
- The AI may propose useful fields specific to the document, such as invoice number or court, without mutating the schema.
- Extra-field keys and values require length limits and runtime validation; nested arbitrary objects are not accepted in v1.
- Under the later D021 decision, only generated tags are merged into frontmatter; all core and extra metadata remains in the managed per-attachment section.
- Unknown facts must be omitted or represented as unknown according to the schema, never invented.
- Schema versions and prompt versions must be stored in provenance so old output can be migrated or regenerated.
- The exact property names and attachment-entry rendering format will be specified before persistence code is implemented.

---

## D008: Review and write behavior

**Status:** Accepted

### Question

What should happen after processing, before the active note is changed?

### Decision

After the user explicitly invokes the command, automatically write each valid result to the active note without an additional preview/approval step.

### Consequences

- Command invocation is the explicit consent boundary for processing and writing.
- Only schema-valid output may reach persistence; malformed or uncertain results fail safely and produce a user-facing error.
- Writes must be constrained to documented frontmatter merges and plugin-managed attachment entries. User-authored body content and unrelated properties remain untouched.
- Existing user tags are additive by default and must not be removed by generated output.
- Conflicting note-level values need deterministic conservative handling; values must not be silently replaced merely because another attachment suggests a different value.
- The plugin should show completion, skipped-file, warning, and failure summaries after the run.
- A future preview or dry-run command can be added, but it is not required for the first release.
- Persistence tests are release-critical because users do not have an intermediate confirmation screen.

---

## D009: Reprocessing and cache policy

**Status:** Accepted

### Question

When the command encounters an attachment that was processed before, what should it do?

### Decision

Always rerun extraction/OCR and AI analysis for every supported embedded attachment whenever the command is invoked. Replace that attachment's previous managed result after the new result validates successfully.

### Consequences

- Every invocation may incur OCR time, network use, and OpenAI cost even if neither the attachment nor settings changed.
- The command and completion notice must make repeated processing understandable; documentation must warn about cost.
- Do not replace an existing valid result until its newly generated replacement has passed validation and is ready to write.
- The managed output remains idempotent in shape: reprocessing replaces entries rather than appending duplicates.
- Internal extraction reuse within a single run is allowed, but cross-run result caching must not cause processing to be skipped.
- A future skip-unchanged mode can be introduced as an opt-in optimization without changing v1 behavior.

---

## D010: Credential storage

**Status:** Accepted

### Question

How should the plugin obtain and retain the user's OpenAI API key?

### Decision

Use Obsidian's `SecretStorage` and `SecretComponent` APIs. Require Obsidian 1.11.4 or newer, and store only the selected secret identifier in ordinary plugin settings rather than the API key value.

### Consequences

- The plugin manifest must set a compatible minimum Obsidian app version.
- The settings UI should use Obsidian's native secret-selection component and explain that the secret contains the user's OpenAI key.
- Code retrieves the key only when needed and must never log, serialize, display, or include it in error reports.
- Ordinary plugin `data.json`, note properties, generated sections, and test fixtures must not contain the key.
- Users on older Obsidian versions are not supported by v1; no plaintext fallback will be implemented.
- Secret availability and invalid/revoked keys require distinct, actionable errors.

### References

- [Obsidian secret storage guide](https://docs.obsidian.md/plugins/guides/secret-storage)
- [Obsidian API declarations](https://github.com/obsidianmd/obsidian-api)

---

## D011: Error, progress, and cancellation UX

**Status:** Accepted

### Question

How should users see and control a potentially long OCR and AI run?

### Decision

Open a progress modal for each command run. Show every discovered attachment and its current stage, overall progress, warnings and failures, and a cancel action. End in the same modal with a concise run summary.

### Consequences

- The processing pipeline needs explicit stages such as discovery, PDF extraction, OCR, AI analysis, validation, and writing.
- Cancellation must use a shared signal and prevent new work and subsequent writes where practical. Clearly label operations that cannot be interrupted immediately.
- Per-attachment state should distinguish queued, running, written, skipped, failed, and cancelled outcomes.
- One attachment's failure does not abort successful results for unrelated attachments unless the user cancels the run.
- Automatically written results under D008 must be reflected immediately in status so the modal never implies an unwritten preview.
- Error details must be useful but redacted: do not display API keys or unnecessarily echo document content/provider payloads.
- Closing the modal must have defined behavior and must not accidentally orphan an invisible run; the initial implementation should treat closing as an explicit cancellation request.

---

## D012: Plugin name and identifier

**Status:** Accepted

### Question

What working plugin name and manifest ID should the project use?

### Decision

Use **Objest** as the plugin name and `objest` as the manifest ID.

### Consequences

- Package, manifest, release, documentation, and plugin-directory references should consistently use `objest` for the machine identifier.
- User-facing text should use **Objest**.
- Because the name does not describe the feature directly, the manifest description and README opening must clearly explain that Objest analyzes embedded attachments and enriches notes with AI-generated summaries and metadata.
- Renaming after public release would disrupt installation paths and community-plugin identity, so revisit this choice before the first published release if necessary.

---

## D013: Model selection strategy

**Status:** Superseded by D042 for minimal v1

### Question

How should users choose the OpenAI model used for analysis?

### Decision

Ship a tested default OpenAI model and expose an advanced setting where users may enter a different model ID.

### Consequences

- New users can complete setup without understanding OpenAI's model catalog.
- The default model becomes part of the tested release configuration and must be documented with expected cost/quality characteristics.
- A custom model must pass a lightweight capability check or fail with an actionable message when it does not support the required API or structured output behavior.
- Do not fetch or expose an unbounded dynamic model list in v1.
- Provenance records the actual model ID used for each attachment.
- Changing the configured model affects subsequent runs immediately because D009 always reprocesses.
- The default model profile and concrete model ID are selected separately so implementation can verify current OpenAI availability before release.

---

## D014: Default model profile

**Status:** Accepted

### Question

What should Objest optimize for when choosing its default OpenAI model?

### Decision

Optimize for balanced cost, latency, and document-analysis quality. At implementation/release time, pin a current compact OpenAI model that supports the chosen API and reliable structured output. Do not default to either the most expensive flagship model or the absolute lowest-cost model solely on price.

### Consequences

- Representative scanned-document fixtures and malformed-output tests should inform the concrete default model choice.
- The exact model ID must be pinned and documented before the first usable build; avoid a floating alias if it would make behavior unexpectedly change.
- Settings should explain that custom models can change cost, speed, and result quality.
- Provider usage or pricing changes may require a documented default-model update without changing the provider abstraction.
- Token/input limits still require chunking or bounded-input policy; a balanced model does not remove those constraints.

---

## D015: OCR language policy

**Status:** Superseded by D042 for minimal v1

### Question

How should OCR languages work in v1?

### Decision

Use English as the default OCR language and allow users to select additional Tesseract language packs in settings. Load and cache only the configured packs rather than attempting automatic language detection in v1.

### Consequences

- English works with minimal setup.
- Settings need a curated language selector and must communicate download size and first-use latency for additional packs.
- Language pack loading and caching failures need actionable diagnostics and retry behavior.
- Selected language configuration is passed explicitly to OCR and recorded in processing provenance.
- Multiple selected languages may reduce OCR speed and, in some cases, accuracy; document this tradeoff.
- Automatic per-document language detection is deferred.
- Language-pack files and cache locations must not be committed to the repository or mistaken for user documents.

---

## D016: PDF embed page scope

**Status:** Accepted

### Question

If a PDF embed points to a specific page, what should Objest analyze?

### Decision

Analyze the entire resolved PDF. Treat page fragments and similar embed subpaths as Obsidian viewing hints, not analysis boundaries.

### Consequences

- Results describe the attachment as a whole rather than a possibly context-free page.
- Multiple embeds of different pages from the same PDF are deduplicated to one attachment analysis per run.
- Page numbers remain available internally for ordering and diagnostics, but D024 excludes rendered page citations from v1 output.
- The managed entry is keyed to the underlying attachment path without its page fragment.
- Page-only analysis can be added later as a separate command or explicit scope mode.

---

## D017: Large-document strategy

**Status:** Superseded by D042 for minimal v1

### Question

How should Objest handle PDFs whose extracted text exceeds one AI request?

### Decision

Use page-aware hierarchical processing: split normalized content into bounded chunks, obtain schema-valid partial analyses, and synthesize those partial results into one final attachment analysis.

### Consequences

- Chunk boundaries should preserve pages and avoid splitting text arbitrarily where practical.
- Every request must label source page ranges, and partial results must retain provenance for final synthesis.
- The synthesis stage deduplicates entities, tags, and extra metadata and must surface conflicts rather than invent a resolution.
- Large documents make multiple API requests, so progress and documentation must disclose increased time and cost.
- Chunk sizing must be based on token budgets with reserved output/synthesis capacity, not raw character count alone.
- Partial results are transient within the run and are not written as separate note entries.
- Cancellation stops scheduling new chunks; no attachment result is replaced until final synthesis validates.

---

## D018: Attachment concurrency

**Status:** Accepted

### Question

How many embedded attachments should Objest process at the same time in v1?

### Decision

Process attachments sequentially, one at a time. Internal operations such as OCR worker use and chunk requests must also remain bounded and should default to conservative concurrency.

### Consequences

- Memory use, API rate, cost progression, write order, and cancellation are easier to predict.
- The progress modal should clearly show the current attachment and queued attachments.
- A failed attachment is recorded and processing continues with the next queued attachment unless the user cancels.
- Sequential attachment processing does not prohibit one attachment's implementation from using a bounded worker, but unbounded page/chunk fan-out is not allowed.
- Concurrency can be revisited after profiling representative PDFs on all supported desktop platforms.

---

## D019: Managed-section placement

**Status:** Accepted

### Question

Where should Objest place its managed analysis section in the active note?

### Decision

Place the plugin-managed analysis section at the top of the Markdown body, immediately after YAML frontmatter when present and at the beginning of the file otherwise.

### Consequences

- Generated analysis is prominent and appears before user-authored headings and body content.
- Bound the entire section with stable hidden HTML comment markers and render a visible `## Objest` heading with one attachment entry per processed file.
- Updates replace content only between Objest's markers and preserve all content outside them byte-for-byte where practical.
- On first insertion, use predictable blank-line handling so the original first line or heading remains valid Markdown.
- If markers are malformed, duplicated, or only partially present, fail safely instead of guessing a destructive replacement range.
- Users who manually edit inside the managed markers should expect those edits to be replaced during reprocessing; documentation and marker text should make ownership clear.

---

## D020: Generated tag storage

**Status:** Accepted

### Question

How should AI-generated tags be stored in the active note?

### Decision

Merge generated tags into Obsidian's standard YAML `tags` property. Preserve every existing tag and add a small normalized, deduplicated set produced across the successfully analyzed attachments.

### Consequences

- Generated tags work with native Obsidian search, tag views, and Bases.
- Objest never removes existing tags, including tags it may have generated during an earlier run, unless a future ownership-tracking decision explicitly enables cleanup.
- Normalize tag text to valid Obsidian tag syntax and reject empty, excessively long, or low-confidence tags.
- Establish a conservative maximum number of generated tags per attachment and per run during schema implementation.
- Because tags are not prefixed, generated and user-authored tags are intentionally indistinguishable in the final `tags` collection.
- Reprocessing can add newly suggested tags but does not automatically retract obsolete suggestions in v1.

---

## D021: Core metadata properties

**Status:** Accepted

### Question

Which generated metadata should become searchable frontmatter properties when a note may contain multiple attachments?

### Decision

Only generated tags are written to frontmatter in v1. Store document title, type, date, entities, language, extra fields, summary, warnings, and provenance per attachment inside the managed Objest section.

### Consequences

- Objest avoids adding generic or namespaced metadata properties and cannot collide with existing document/date/entity properties.
- Per-attachment metadata remains unambiguous even when a note embeds several documents.
- Bases and property queries can use generated tags but cannot directly query the other generated fields in v1.
- The managed section rendering should be regular, readable Markdown so metadata remains searchable as note text.
- A future opt-in property mapping system can promote selected fields without changing the analysis schema.

---

## D022: Supported attachment formats

**Status:** Accepted

### Question

Which embedded attachment formats should Objest support in v1?

### Decision

Support local PDF attachments only. Handle both PDFs with usable embedded text and image-only/scanned PDFs through the D003 extraction pipeline.

### Consequences

- Discovery may identify other embedded files, but v1 skips them as unsupported and reports that outcome clearly.
- Tests and fixtures can focus deeply on text PDFs, mixed text/image PDFs, scans, malformed PDFs, protected PDFs, and large PDFs.
- Raw embedded images, office documents, audio, video, and remote resources are out of v1 scope.
- Extraction interfaces should remain format-neutral enough to add adapters later without redesigning orchestration.
- Manifest and README descriptions should say PDF rather than implying all attachment types are supported.

---

## D023: Plugin scaffold and build tooling

**Status:** Accepted

### Question

Which baseline should be used to scaffold the plugin?

### Decision

Start from the current official Obsidian sample-plugin conventions using npm, strict TypeScript, and esbuild. Add appropriate formatting, linting, runtime schema validation, and deterministic tests without replacing the simple build pipeline unnecessarily.

### Consequences

- Commit `package-lock.json` and use npm commands in development and CI documentation.
- Keep the Obsidian API external to the production bundle, consistent with the official sample.
- Production output remains a compact `main.js` plus `manifest.json` and optional `styles.css`.
- Add a separate test runner chosen for TypeScript unit tests; it should not complicate the plugin bundle.
- Pin build dependencies and review OCR/PDF worker and WASM asset handling explicitly because they exceed the sample plugin's usual bundling needs.
- Scaffold against the current sample and public API rather than copying stale generated files.

---

## D024: Source citation policy

**Status:** Accepted

### Question

Should generated summaries and key facts include PDF page references?

### Decision

Do not require or render page citations in summaries or metadata for v1.

### Consequences

- Generated output is cleaner and more concise.
- Users verify information by opening the embedded PDF rather than following claim-level page references.
- Extraction and chunking should still retain internal page provenance for ordering, diagnostics, and possible future citation support.
- Prompts must not spend output budget inventing citation syntax.
- Objest must continue to disclose that output is AI-generated and may contain errors; lack of citations must not be presented as verified accuracy.

---

## D025: Summary presentation

**Status:** Accepted

### Question

How should each PDF's generated entry be presented in the Objest section?

### Decision

Render a concise one-to-three-paragraph summary followed by readable lists or definition-style rows for core and document-specific metadata.

### Consequences

- The schema should model summary prose separately from metadata rather than asking the model to return finished Markdown.
- Objest owns Markdown rendering so model output cannot inject arbitrary headings, comments, or managed-section markers.
- Keep attachment entries compact because the managed section appears at the top of the note under D019.
- Escape or safely render metadata values that contain Markdown-significant text.
- Empty/unknown metadata fields are omitted; warnings and provenance may be placed in a subdued details block to avoid overwhelming the summary.

---

## D026: Distribution target

**Status:** Superseded by D042 for minimal v1

### Question

Who should the first release be built and documented for?

### Decision

Build Objest to be ready for eventual submission to Obsidian Community Plugins, even if prerelease builds are initially installed manually.

### Consequences

- Follow Obsidian's current plugin policies, manifest conventions, release artifact requirements, and review expectations.
- Setup, privacy/data flow, API-key requirements, cost behavior, supported platforms, and limitations need user-facing documentation.
- Avoid vault-specific paths, private assumptions, and dependencies on undocumented Obsidian internals.
- Include accessible settings and progress UI, actionable errors, clean unloading, and restrained startup behavior.
- Establish public repository hygiene: license, changelog, contribution guidance, security reporting, and automated checks before submission.
- Community readiness does not require publishing before the extraction/OCR spike and destructive-write tests are satisfactory.

---

## D027: Project license

**Status:** Accepted

### Question

Which license should Objest use?

### Decision

Release Objest under the MIT License.

### Consequences

- Include the standard `LICENSE` file and retain copyright/license notices.
- Dependencies and bundled assets, including PDF/OCR libraries, workers, WASM, and language data, must have licenses compatible with distribution under this project.
- Third-party notices must be included where dependency licenses require them.
- Contributions are accepted under the repository's MIT terms unless a separate contribution policy is later adopted.

---

## D028: Cost and size guardrails

**Status:** Superseded by D042 for minimal v1

### Question

How should Objest protect users from unexpectedly expensive runs on large PDFs?

### Decision

Perform a local preflight estimate and require confirmation when the run exceeds a safe, configurable size/cost threshold. Small runs proceed directly from the command into the progress modal.

### Consequences

- Discovery and basic PDF inspection happen before paid AI requests so Objest can estimate page count, extracted size, OCR scope where practical, and likely request count.
- The threshold confirmation must occur before any OpenAI request and clearly identify which attachments make the run large.
- Estimates are approximate and must be labeled as such; do not promise currency cost unless current pricing data and token counts support it reliably.
- Provide conservative defaults and an advanced threshold setting, with a hard implementation safety ceiling against accidental unbounded work.
- User confirmation for a large run is separate from D008's result preview decision; valid results still write automatically.
- Cancellation from the preflight prompt causes no AI requests or note writes.

---

## D029: Network privacy consent

**Status:** Accepted

### Question

How should Objest obtain consent before sending extracted PDF text to OpenAI?

### Decision

Before the first OpenAI request, show a one-time consent disclosure explaining that PDF extraction/OCR is local but normalized document text is sent to OpenAI using the user's API key. Save the user's acceptance; later explicit command invocations operate under that consent.

### Consequences

- API-key configuration alone is not treated as consent to transmit document text.
- Declining or dismissing the disclosure makes no OpenAI request and performs no note write. Separately disclosed OCR language-data downloads may occur during local extraction under D031.
- Settings must provide a way to review the disclosure and revoke/reset consent.
- The disclosure and README privacy section must state what is sent, what is not sent, who receives it, and link to applicable OpenAI terms/privacy information.
- Material changes to data flow or provider require a consent-version increment and renewed acceptance.
- Never bundle consent with unrelated settings or preselect it invisibly.

---

## D030: Local content retention

**Status:** Accepted

### Question

What document-derived data should Objest retain outside the generated note section?

### Decision

Do not persist normalized text, OCR output, chunks, partial analyses, raw model responses, or request/response history. Keep them in memory only for the current run. Persist only ordinary settings, consent state/version, selected secret reference, required OCR language-pack assets/cache, and final rendered note output.

### Consequences

- Sensitive duplicate document content is minimized and there is no content-cache lifecycle to manage.
- D009 reprocessing performs extraction/OCR and AI again on every run.
- Debug logging must use stage names, counts, timings, redacted error categories, and attachment paths only when necessary; it must not dump content.
- Cancellation and completion should release large buffers and worker resources promptly.
- Crash recovery cannot resume from persisted chunks or partial results; the user reruns the command.
- OCR language data is executable/reference data rather than document-derived content and may be cached separately with documented storage behavior.

---

## D031: OCR asset distribution

**Status:** Accepted

### Question

Which OCR assets should be bundled with Objest, and which may be downloaded at runtime?

### Spike evidence

The macOS spike succeeded with the PDF.js worker, Tesseract worker JavaScript, and a universal LSTM-only Tesseract WASM core embedded in `main.js`. This produced an approximately 5.6 MB production bundle. English trained data was downloaded from Tesseract's versioned jsDelivr package on first use and cached locally. See [SPIKE_RESULTS.md](SPIKE_RESULTS.md).

### Options under consideration

1. **Bundle executable runtime; download language data** — ship PDF/Tesseract worker code and WASM in `main.js`; fetch only selected version-pinned trained-data files on first use and cache them.
2. **Bundle English too** — additionally embed English trained data for first-use offline OCR; download only extra languages. This increases bundle size and requires a custom trained-data loading path.
3. **Download all OCR assets** — keep the plugin bundle small but fetch worker JavaScript, WASM, and language data at runtime. This introduces remote-code, integrity, offline, and Community Plugins review risks.

### Recommendation

Bundle all executable worker/WASM assets and download only version-pinned language data from a disclosed origin. This keeps runtime code reviewable and works with Community Plugins' three-file distribution model while avoiding a much larger base bundle for every language.

### Decision

Bundle the PDF.js worker, Tesseract worker JavaScript, universal LSTM-only Tesseract WASM core, and compressed English trained data inside `main.js`. Download only additional user-selected, version-pinned trained-language data from a disclosed jsDelivr package origin and cache it locally. Never download executable worker JavaScript or WASM at runtime.

### Consequences

- English OCR works without a first-use language-data network request.
- The production bundle grows materially; bundle size and startup/load impact must be measured and disclosed before Community Plugins submission.
- Additional configured languages require a clearly disclosed first-use download and should work from cache afterward.
- The exact data package versions are pinned in `package-lock.json`; upgrades require OCR regression tests and third-party license review.
- Settings must distinguish bundled English from downloadable languages and expose cache/offline behavior.
- Future bundling of more default languages requires a new size/distribution assessment rather than silently expanding the bundle.

### Validation

After implementing this decision, the production bundle measured approximately 9.2 MB. The macOS compatibility command successfully OCRed the image-only fixture after the cached English entry was deleted, confirming that bundled English data was used.

---

## D032: Stale managed entries

**Status:** Superseded by D042 for minimal v1

### Question

What should happen to an existing managed entry when its PDF is no longer embedded or its resolved path changes?

### Decision

Retain the generated entry and visibly mark it as stale when its stored attachment path no longer matches any currently resolved direct PDF embed. Do not automatically delete stale entries in v1.

### Consequences

- Automatic processing cannot erase prior generated analysis merely because an embed is temporarily broken, renamed, or removed.
- Stale detection occurs after discovery and changes only content inside Objest's managed markers.
- A currently embedded attachment whose new analysis fails is not stale; retain its previous valid entry unchanged and show the run failure separately.
- A renamed/moved attachment may produce a new active entry while its old path entry becomes stale unless Obsidian provides an unambiguous migration signal.
- Stale entries remain searchable and may leave historical generated tags; D037 decides tag provenance/cleanup.
- A future explicit cleanup action can remove user-confirmed stale entries.

---

## Newly opened persistence and safety decisions

D033–D037 were identified during independent documentation review and the extraction spike. They will be discussed one at a time before their corresponding implementation begins:

- No unresolved product-level decisions currently block the next implementation phase.

---

## D033: Write consistency and edit conflicts

**Status:** Accepted

### Question

How should Objest order managed-body and frontmatter-tag updates when Obsidian offers no transaction spanning both operations?

### Decision

First perform a conflict-aware managed-section transformation against the latest note contents through `Vault.process` or the current documented equivalent. Only after that succeeds, merge generated tags additively through `FileManager.processFrontMatter`. Never rewrite the entire note merely to simulate a transaction.

### Consequences

- A body failure produces no generated-tag mutation.
- A later tag failure leaves a valid, traceable managed entry without some tags; report a repairable partial failure and retry additive tag merging on the next run.
- Do not roll back a successful body write by restoring an old whole-file snapshot, because that could overwrite concurrent user edits.
- Marker parsing and rendering happen inside the body transform using the latest callback content. Malformed/duplicate markers abort before mutation.
- Frontmatter merging reads the latest frontmatter, preserves unrelated keys and existing tags, and only adds validated tags.
- Per-note write operations are serialized within Objest. If the source note is deleted or becomes unavailable, stop and report the attachment result as unwritten.
- Persistence tests must simulate edits before the body transform, between body and frontmatter operations, and during partial failures.

---

## D034: OpenAI request privacy controls

**Status:** Accepted

### Question

What attachment identity should accompany normalized PDF text in OpenAI requests?

### Decision

Do not send the attachment filename, vault path, absolute filesystem path, note name, or user-defined provider metadata. Send only explicitly required analysis inputs: normalized document text, bounded page-range labels, versioned instructions/schema, and partial structured analyses required for large-document synthesis. Disable provider-side response storage on every request when the selected OpenAI API supports that control.

### Consequences

- Prompts cannot use filenames as classification context; document type/title must come from document contents.
- Page-range labels are generic numeric provenance, not attachment identity.
- OpenAI request logging and tests must assert that paths, filenames, note text, and unrelated vault metadata are absent.
- No arbitrary `metadata` field is sent to OpenAI in v1.
- If the chosen OpenAI endpoint cannot disable response storage as required, D038 must revisit the endpoint before implementation.
- Consent text lists the exact allowed payload categories and does not claim that only raw text is transmitted.
- D038 separately selects the concrete OpenAI API and transport implementation.

---

## D035: Cancellation/write boundary

**Status:** Accepted

### Question

What should happen when the user cancels during processing or persistence?

### Decision

Honor cancellation promptly during discovery, PDF work, OCR, network requests, chunk scheduling, and validation, and do not start another attachment. Once persistence for a validated attachment has begun, treat the body-plus-tag sequence as a short non-cancellable commit: finish it under D033, then stop the run.

### Consequences

- Abort in-flight fetch/provider requests and terminate OCR/PDF workers where their APIs safely permit it.
- Stop scheduling new pages, chunks, retries, and attachments immediately after cancellation.
- Check the cancellation signal before entering persistence. After entry, ignore further cancellation until the D033 write sequence succeeds or fails.
- The progress modal changes to a non-interruptible **Finishing write** state while the commit completes and must not claim the run is already cancelled.
- A provider or parser operation that cannot stop immediately is labeled accordingly and its eventual result is discarded without writing if cancellation occurred before commit.
- Cancellation after one or more attachments were already written preserves those completed results and reports them separately from cancelled work.
- Tests cover cancellation before requests, during OCR/request work, before commit, between body and tag operations, and after completed attachments.

---

## D036: Hard resource limits

**Status:** Accepted

### Question

How should Objest enforce hard resource limits for untrusted or extremely large PDFs?

### Decision

Ship non-bypassable safety ceilings for input bytes, page count, page dimensions, rendered pixels, PDF/OCR duration, normalized text/tokens, chunk count, OpenAI request count, retries, structured output size, and run memory/concurrency. Users may configure lower cost/work thresholds but cannot raise the implementation safety ceilings in v1.

### Consequences

- Reject work as early as the required metadata becomes available and identify the attachment, exceeded limit category, and remediation.
- Preflight confirmation under D028 does not override security/resource ceilings.
- Never allocate a full-size canvas before validating dimensions and the rendered-pixel cap.
- PDF parsing, rendering, OCR worker initialization/jobs, and provider calls need explicit timeouts in addition to cancellation.
- Hierarchical analysis stops before exceeding chunk/request/output caps; it does not silently truncate and present an incomplete result as complete.
- Exact ceiling values require fixture benchmarks on all supported desktop platforms and must be recorded in this decision or a referenced versioned limits specification before release.
- Add adversarial tests for oversized files, page counts, dimensions, decompression behavior, pathological text, model output, and retry storms.

---

## D037: Generated-tag provenance

**Status:** Superseded by D042 for minimal v1

### Question

How should Objest track and eventually clean up AI-generated tags?

### Decision

Record attachment-to-tag provenance inside Objest's managed metadata for every tag that Objest adds to frontmatter. Never remove a standard `tags` value automatically in v1. A future explicit cleanup action may show unclaimed generated tags and remove only those the user confirms.

### Consequences

- Tags remain ordinary native Obsidian tags, but their generated sources are traceable through managed metadata.
- Reprocessing updates the provenance claims associated with active attachment entries; stale entries under D032 retain their historical claims.
- If a generated tag is no longer suggested, leave the frontmatter tag in place even when no entry currently claims it.
- Objest cannot know whether a user later adopted a generated tag manually, which is why cleanup requires explicit confirmation.
- The managed rendering/schema needs a stable machine-readable ownership record that does not expose arbitrary model-generated marker syntax.
- D020's additive behavior remains, but its earlier statement that generated tags are wholly indistinguishable is superseded with respect to provenance metadata.
- Destructive cleanup is deferred from v1 unless separately designed, accepted, and tested.

---

## D038: OpenAI API and transport

**Status:** Accepted

### Question

Which OpenAI integration should Objest use for structured analysis?

### Decision

Use OpenAI's official JavaScript SDK and Responses API inside the OpenAI provider adapter. Request schema-constrained structured output, set `store: false`, pass cancellation signals, and validate the returned value again with Objest's independent runtime schema.

### Consequences

- The OpenAI SDK and its types remain confined to `src/providers/openai/`; orchestration and domain modules depend only on Objest interfaces.
- Configure the SDK explicitly for Obsidian's desktop renderer and user-supplied key; never expose the client outside the adapter.
- Every request must comply with D034's minimal payload and storage rules.
- SDK parsing/structured-output helpers do not replace runtime validation or bounded field limits.
- Use abort signals and map SDK/network/rate-limit/auth/schema errors into redacted typed failures.
- Adding the SDK requires production-bundle size, transitive dependency, license, network-destination, and browser/Electron compatibility inspection.
- Pin the SDK version and cover request construction with offline tests; live contract tests remain opt-in.
- D039 selects the concrete default model after representative evaluation.

---

## D039: Concrete default OpenAI model

**Status:** Accepted

### Question

Which OpenAI model should Objest use by default for PDF summaries and metadata?

### Decision

Use `gpt-5.6-luna` as the fixed minimal-v1 model. D042 defers D013's advanced model-ID override to the backlog.

### Consequences

- `gpt-5.6-luna` supports the Responses API and structured outputs and is designed for cost-sensitive, high-volume workloads.
- At decision time, published text pricing is $0.20 per million input tokens, $0.02 per million cached input tokens, and $1.20 per million output tokens; pricing is informational and must not be hard-coded as a promise.
- The model exposes a 1,050,000-token context window, but D042/D036 fixed input and safety limits still apply; minimal v1 makes one bounded request and rejects larger input.
- OpenAI does not currently publish a dated snapshot ID for Luna. Use the exact public ID `gpt-5.6-luna`, record the actual model returned in provenance, and regression-test output contracts because behavior may change behind the alias.
- Representative fixture evaluation remains required. If Luna cannot reliably satisfy the schema and quality criteria, revisit D039 explicitly rather than silently switching models.
- Model overrides are deferred; documentation still explains that model behavior, availability, and pricing may change.

### Reference

- [OpenAI GPT-5.6 Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

---

## D040: Analysis output language

**Status:** Superseded by D042 for minimal v1

### Question

What language should Objest use for summaries, metadata labels, and generated tags?

### Decision

Default generated summaries, metadata labels/values where translation is appropriate, and tags to English. Provide a setting for the user to select another output language. OCR source-language selection remains independent under D015.

### Consequences

- English is consistent for first-run search and tagging even when source documents are multilingual.
- Preserve proper names, identifiers, quoted titles, legal references, and other values that should not be translated.
- The configured output language is an explicit prompt input and is recorded in provenance.
- Tag normalization applies after generation in the configured output language.
- Changing output language affects subsequent runs immediately under D009 and may add new-language tags without removing prior tags under D020/D037.
- v1 should offer a curated language selector or validated BCP 47-style value rather than arbitrary instructions disguised as a language.

---

## D041: Prompt customization

**Status:** Accepted

### Question

Should users be able to add custom AI instructions in v1?

### Decision

Use one tested, versioned Objest prompt contract in v1. Do not expose arbitrary custom instructions or prompt templates.

### Consequences

- Prompt behavior, schema, privacy payload, and regeneration are predictable and supportable.
- The system prompt explicitly treats PDF/OCR content as untrusted data, not instructions.
- Minimal v1 fixes output to English; later approved typed settings may parameterize the prompt but cannot inject arbitrary instruction text.
- Minimal v1 uses only the fixed core schema in D042; document-specific extra metadata remains backlog work.
- Prompt and schema versions are recorded in provenance and covered by deterministic provider-fixture tests.
- Custom instructions and document templates may be reconsidered after v1 as a separately consented and validated feature.

---

## D042: Minimal personal v1 scope

**Status:** Accepted

### Context

After the initial architecture and macOS extraction spike, the project was deliberately reframed as a small personal tool. The first version should work end to end in the owner's current environment, stay understandable, and accept that some edge cases will fail safely. Broader features belong in a visible backlog rather than expanding v1.

### Decision

Adopt [V1_SPEC.md](V1_SPEC.md) as the authoritative implementation scope for the first usable release and [BACKLOG.md](BACKLOG.md) as the home for excluded work. Target personal use on macOS only.

Minimal v1 keeps:

- Directly embedded local PDFs only
- Local PDF.js extraction and English Tesseract OCR
- OpenAI Responses API through the official SDK and SecretStorage key
- Fixed `gpt-5.6-luna`, English output, fixed prompt, and fixed core schema
- One attachment at a time and one bounded AI request per PDF
- Automatic validated writes to Objest markers plus additive tags
- Simple modal progress/cancellation, independent file failures, and no content cache

Minimal v1 defers:

- Windows, Linux, mobile, and Community Plugins readiness
- Additional OCR/output languages and related downloads/settings
- Model overrides, other providers, and local AI
- Arbitrary extra metadata and user prompt/schema customization
- Hierarchical chunking, cost estimation, and large-document support beyond fixed limits
- Stale-entry marking/migration/cleanup and generated-tag provenance/cleanup
- Preview workflows, sidecar notes, batch/background processing, and broader formats

### Superseded decisions

For minimal v1, D042 supersedes the broader parts of D004, D007, D013, D015, D017, D026, D028, D032, D037, and D040. Those choices remain historical context and potential backlog direction, not current acceptance criteria.

### Consequences

- Prefer deletion or deferral of configuration and abstractions that exist only for backlog features.
- A missing edge case may produce a bounded, actionable failure; it may never justify destructive note writes, secret leakage, unbounded resource use, or sending undisclosed data.
- Documentation, implementation plan, settings, tests, and completion reports must distinguish minimal-v1 requirements from backlog ideas.
- Do not promote backlog work opportunistically while implementing v1.

---

## D043: Fixed schema field limits

**Status:** Accepted

### Context

D006/D010 require bounded runtime validation, and D042 intentionally favors simple fixed behavior over configuration. The v1 spec already fixes summary, tag-count, and entity-count ceilings but did not bound every model-authored string or define deterministic tag normalization.

### Decision

Use these fixed model-authored field bounds in minimal v1:

| Field               |                                               Bound |
| ------------------- | --------------------------------------------------: |
| Summary             |                                  1–2,000 characters |
| Tags                |    0–7 unique normalized values, 64 characters each |
| Document type       |                           `null` or 1–80 characters |
| Document date       | `null` or a real calendar date in `YYYY-MM-DD` form |
| Entities            |     0–15 unique trimmed values, 120 characters each |
| Source language     |                           `null` or 1–64 characters |
| Warnings            |                    0–10 values, 240 characters each |
| Returned model ID   |                                    1–128 characters |
| Processed timestamp |           UTC ISO 8601 timestamp supplied by Objest |

Normalize each generated tag by applying Unicode NFKC normalization, trimming whitespace, removing leading `#` characters, lowercasing, converting whitespace and underscores to `-`, retaining only Unicode letters/numbers plus `-` and `/`, collapsing repeated separators, trimming separators from segment boundaries, and rejecting a result that is empty, numeric-only, or longer than 64 characters. Deduplicate normalized tags while preserving first-seen order.

The provider model controls only summary, tags, document type/date, entities, source language, and warnings. Objest supplies schema version, prompt version, actual response model ID, and processing timestamp, then validates the complete object.

Document type, every entity, source language, every warning, and the returned model ID are line-oriented fields. Reject CR or LF in those fields at both the model-output and final runtime-schema boundaries rather than truncating or rewriting factual metadata. Summaries may contain paragraphs; normalize CRLF and lone CR line endings to LF before rendering.

### Consequences

- Fewer than three tags, including zero, remain valid when the document does not justify them.
- Values outside these bounds fail validation; minimal v1 does not truncate factual model output silently.
- Deterministic normalization may reject unusual but technically valid Obsidian tag forms. Broader configurable normalization belongs in the backlog.
- Duplicate entities are removed by exact comparison after trimming; more advanced entity canonicalization remains backlog work.

---

## D044: Marker parsing and operation timeouts

**Status:** Accepted

### Context

Persistence must fail closed around owned markers, and PDF/OCR/provider operations must not wait indefinitely. D042 favors a small fixed implementation rather than configurable recovery machinery.

### Decision

Recognize only these exact line-oriented markers:

- `<!-- objest:managed:start -->`
- `<!-- objest:managed:end -->`
- `<!-- objest:entry:start id="<base64url-encoded UTF-8 vault path>" -->`
- `<!-- objest:entry:end -->`

A note is writable only when it contains either no Objest managed markers or exactly one correctly ordered managed pair. Inside an existing managed section, every entry start must have one following entry end, entries may not nest, IDs must be non-empty base64url values, and IDs must be unique. Any orphan, duplicate, nested, out-of-order, or lookalike Objest marker fails before a body/tag write. Text outside exact Objest markers remains user-owned.

Use a 15-minute local-processing deadline per PDF covering PDF loading, text extraction, rendering, and OCR, and a separate 2-minute deadline per OpenAI request. User cancellation and deadlines share abort propagation. Persistence begins only after analysis validates; once it begins, do not apply the processing abort signal to the short Vault body/tag commit.

### Consequences

- A malformed old managed section requires manual repair before Objest writes again.
- Minimal v1 does not attempt marker recovery or accept marker variants.
- Local processing may fail at the 15-minute deadline even if slow OCR would eventually succeed; supporting longer/configurable runs belongs in the backlog.
- OpenAI retry behavior remains bounded by D042/D043; retries do not reset the 2-minute request deadline.
- Vault writes are not abandoned behind a synthetic timeout because the underlying write could still complete after the caller loses certainty.

### Supersession

D045 supersedes the HTML-comment ownership grammar in this decision. D045 retains the 15-minute local-processing and 2-minute OpenAI deadlines and uses this exact legacy grammar only for fail-closed migration.

---

## D045: Document titles and comment-free owned output

**Status:** Accepted

### Context

The first live output exposed implementation-oriented HTML marker comments and used a generic visible `## Objest` heading plus an attachment filename heading. The owner requested a title relevant to the ingested document and no HTML comments in generated output.

### Decision

Add a required model-generated `title` field: concise, specific English plain text grounded only in document content, one line, and at most 120 characters. Do not send or use the attachment filename as model context. Advance the analysis schema and prompt versions to 2.

Render each attachment as a native Obsidian callout at the top of the note body:

```markdown
> [!objest] Document-relevant title
> **Source:** [[attachment.pdf]]
>
> Summary and metadata…
```

New output contains no HTML ownership comments and no generic visible `## Objest` heading. Exact top-of-body `[!objest]` callouts are reserved as Objest-owned output. Their exact Source wikilink line is the attachment identity and their blockquote boundary is the entry boundary. Multiple entries remain contiguous.

On the next successful write, convert an exact D044 legacy section and all of its entries to callouts, replacing the current attachment with its new validated analysis and preserving unmatched legacy entries inside migrated callouts. Derive a readable local fallback heading from the path only for an unmatched legacy entry until that attachment is reprocessed. Remove all legacy Objest comments during that migration. Reject malformed or unrecognized legacy output rather than guessing.

### Consequences

- Relevant titles come from PDF/OCR content sent under the existing consent boundary, not from filenames or paths.
- Rendering remains deterministic; title, summary, metadata, and attachment path are untrusted and escaped in code.
- Runtime-validate the complete analysis before rendering. Reparse every newly rendered entry and require one recognized callout whose boundary consumes the complete rendered string.
- A source line is local note output and is never added to the OpenAI request.
- Objest replaces only a callout with the matching exact source line, preserves unmatched callouts, and preserves all non-callout content.
- Duplicate sources, malformed callouts, and Objest callouts outside the contiguous top-of-body region fail before body or tag writes.
- The `[!objest]` callout type is an explicit visible ownership signal. User-authored content must not use that reserved callout type unless it is intended to be managed by Objest.
- D045 supersedes D019/D042/D044 where they require hidden HTML markers, a generic `## Objest` heading, or a fixed core schema without a document title; it extends D043 with the 120-character single-line title bound. Top-of-body placement, idempotence, fail-closed writes, independent attachment handling, and D044's operation deadlines remain accepted.

---

## D046: BRAT beta distribution

**Status:** Accepted

### Context

The owner wants to install and update the working personal macOS build through BRAT rather than relying only on a local development-plugin folder. Current BRAT versions install Obsidian plugins from GitHub release assets, while Objest intentionally keeps generated `main.js` out of Git history.

### Decision

Publish Objest as a GitHub prerelease compatible with BRAT 1.1.0 or newer. Each release tag, release name, and packaged `manifest.json` version must match exactly. Attach the production-built `main.js`, `manifest.json`, and `styles.css` directly to the release. Keep generated `main.js` untracked in the repository.

The initial BRAT release is `0.1.0`. BRAT distribution does not constitute submission to Obsidian's Community Plugins directory and does not expand minimal v1 beyond personal macOS desktop use.

### Consequences

- Users may add `kcverde/objest` through BRAT and track the latest release.
- Every release requires `npm run check`, production-bundle inspection, release-asset inspection, and confirmation that no secrets or document content are included.
- Release notes must restate the macOS-only target, OpenAI BYOK requirement, cloud text data flow, and repeated-run cost behavior.
- Generated bundles remain absent from normal commits; GitHub release assets are the distribution boundary.
- Release automation, public distribution policy work, and Community Plugins submission remain backlog items.
