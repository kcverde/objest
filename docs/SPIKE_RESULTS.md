# PDF and OCR spike results

## Status

**macOS compatibility check passed on 2026-08-03.** Windows and Linux remain unverified.

## Environment

- Obsidian desktop 1.13.4
- macOS
- Node.js 24 development toolchain
- `pdfjs-dist` 6.2.108
- `tesseract.js` / `tesseract.js-core` 7.0.0

## Implemented spike

The development command **Objest: Run PDF and OCR compatibility check**:

1. Finds unique directly embedded local PDF files in the active note through Obsidian's metadata cache.
2. Reads each PDF through the Vault API.
3. Extracts page text with PDF.js.
4. Renders pages without a usable text layer to a bounded canvas.
5. OCRs rendered pages with a local Tesseract worker.
6. Displays page/method/character counts without calling OpenAI or modifying the note.

## Results

- Direct PDF embed discovery worked for the test note.
- A one-page text PDF produced 116 extracted characters without OCR.
- A one-page image-only PDF was rendered and OCRed locally, producing 56 characters.
- The initial executable-only production bundle built at approximately 5.6 MB. After D031 selected bundled English trained data, the verified production bundle is approximately 9.2 MB.
- Plugin load/reload, command registration, modal progress, and settings were exercised in the `mindr-test` development vault.
- Obsidian reported no Objest runtime or console errors during the successful run.

## Technical findings

### PDF.js

- The PDF.js module and worker can be bundled into `main.js`; the worker is created from an in-memory Blob URL.
- Text extraction succeeded through the PDF.js worker.
- In the tested Obsidian runtime, image-page rendering did not complete with the default display intent. Rendering with `intent: "print"` completed and produced an OCR-ready canvas. This needs regression coverage with more PDFs.

### Tesseract

- The browser worker script and universal LSTM-only core can be bundled into `main.js` and loaded through Blob URLs.
- Tesseract detects a core file by its `.js` suffix, so the generated core Blob URL requires a filename fragment.
- Tesseract's high-level `createWorker` initialization hung in the test runtime despite the underlying worker protocol functioning. The spike uses a small typed worker-protocol adapter with explicit job tracking, progress, cancellation, and cleanup.
- D031 now bundles compressed English trained data in `main.js`. Additional selected languages use version-pinned jsDelivr packages and Tesseract's local cache. Worker JavaScript and WASM executable code are never downloaded at runtime.
- After deleting cached English data, the compatibility command completed successfully without requiring an English download, confirming the bundled-data path.

## Risks and follow-up

- Document and test additional-language cache location/cleanup, integrity/update policy, and offline behavior under accepted D031.
- Validate worker, Blob URL, WASM, language download/cache, and print-intent rendering on Windows and Linux.
- Add initialization, render, OCR, page, pixel, memory, and request timeouts before processing untrusted PDFs.
- Add fixtures for mixed pages, rotations, extreme dimensions, malformed/protected PDFs, non-Latin OCR, and multipage scans.
- Investigate whether the approximately 9.2 MB bundle containing the universal core and English trained data is acceptable for Community Plugins review.
- Replace the spike modal/command with the production staged progress flow after extraction boundaries stabilize.
- Ensure custom worker protocol remains compatible when upgrading Tesseract; pin versions and add contract tests.

## Validation commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
obsidian vault=mindr-test plugin:reload id=objest
obsidian vault=mindr-test dev:errors
obsidian vault=mindr-test dev:console level=error
```
