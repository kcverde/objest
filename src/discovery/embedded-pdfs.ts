import { App, TFile } from 'obsidian';

export interface EmbeddedPdf {
	file: TFile;
	linkText: string;
}

export function discoverEmbeddedPdfs(
	app: App,
	sourceFile: TFile,
): EmbeddedPdf[] {
	const embeds = app.metadataCache.getFileCache(sourceFile)?.embeds ?? [];
	const discovered = new Map<string, EmbeddedPdf>();

	for (const embed of embeds) {
		const file = app.metadataCache.getFirstLinkpathDest(
			embed.link,
			sourceFile.path,
		);

		if (
			!(file instanceof TFile) ||
			file.extension.toLowerCase() !== 'pdf'
		) {
			continue;
		}

		discovered.set(file.path, {
			file,
			linkText: embed.original,
		});
	}

	return [...discovered.values()];
}
