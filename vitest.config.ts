import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fixture = (name: string): string =>
	fileURLToPath(new URL(`./tests/fixtures/${name}`, import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz':
				fixture('ocr-binary-stub.ts'),
			'tesseract.js-core/tesseract-core-lstm.wasm.js':
				fixture('ocr-script-stub.ts'),
			'tesseract.js/dist/worker.min.js': fixture('ocr-script-stub.ts'),
		},
	},
	test: {
		coverage: {
			reporter: ['text', 'html'],
		},
		environment: 'node',
		include: ['tests/**/*.test.ts'],
	},
});
