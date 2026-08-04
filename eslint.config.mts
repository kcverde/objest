import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'coverage',
		'dist',
		'esbuild.config.mjs',
		'main.js',
		'node_modules',
		'version-bump.mjs',
		'versions.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'esbuild.config.mjs',
						'eslint.config.mts',
						'manifest.json',
					],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['src/**/*.ts'],
		rules: {
			'obsidianmd/ui/sentence-case': [
				'warn',
				{
					acronyms: ['AI', 'API', 'ID', 'OCR', 'PDF', 'PDFs'],
					brands: [
						'jsDelivr',
						'Objest',
						'Obsidian',
						'OpenAI',
						'Tesseract',
					],
					enforceCamelCaseLower: true,
					ignoreWords: ['eng', 'OCRs'],
				},
			],
		},
	},
);
