import { App, TFolder, TFile, Vault } from "obsidian";

export interface FolderStats {
	name: string;
	path: string;
	noteCount: number;
	children: FolderStats[];
}

const DEFAULT_EXCLUDES = [
	".obsidian",
	".trash",
	"node_modules",
	".git",
	".design",
];

function isExcluded(name: string, excludePatterns: string[]): boolean {
	return excludePatterns.some(
		(p) => name === p || name.startsWith(p + "/")
	);
}

export async function scanFolderStats(
	vault: Vault,
	excludePatterns: string[],
	app?: App
): Promise<FolderStats[]> {
	const allExcludes = [...DEFAULT_EXCLUDES, ...excludePatterns];

	// 读取 Obsidian 应用配置中的排除项
	if (app) {
		try {
			const configPath = vault.configDir + "/app.json";
			const configContent = await vault.adapter.read(configPath);
			const config = JSON.parse(configContent) as Record<string, unknown>;
			const excludeFolders = config["exclude-folders"];
			const excludeFiles = config["exclude-files"];
			if (Array.isArray(excludeFolders)) {
				excludeFolders.forEach((p: unknown) => {
					if (typeof p === "string" && p && !allExcludes.includes(p)) {
						allExcludes.push(p);
					}
				});
			}
			if (Array.isArray(excludeFiles)) {
				excludeFiles.forEach((p: unknown) => {
					if (typeof p === "string" && p && !allExcludes.includes(p)) {
						allExcludes.push(p);
					}
				});
			}
		} catch {
			// app.json 读取失败时忽略，不影响正常扫描
		}
	}
	const root = vault.getRoot();
	const rootFolders: TFolder[] = [];
	const rootFiles: TFile[] = [];

	for (const child of root.children) {
		if (isExcluded(child.name, allExcludes)) continue;
		if (child instanceof TFolder) {
			rootFolders.push(child);
		} else if (child instanceof TFile && child.extension === "md") {
			rootFiles.push(child);
		}
	}

	rootFolders.sort((a, b) => a.name.localeCompare(b.name));

	const result: FolderStats[] = [];

	if (rootFiles.length > 0) {
		result.push({
			name: "(root)",
			path: "/",
			noteCount: rootFiles.length,
			children: [],
		});
	}

	for (const folder of rootFolders) {
		result.push(scanSingleFolder(folder, allExcludes, 1));
	}

	return result;
}

function scanSingleFolder(
	folder: TFolder,
	excludes: string[],
	depth: number
): FolderStats {
	const children: FolderStats[] = [];
	let noteCount = 0;
	const subFolders: TFolder[] = [];

	for (const child of folder.children) {
		if (isExcluded(child.name, excludes)) continue;
		if (child instanceof TFile && child.extension === "md") {
			noteCount++;
		} else if (child instanceof TFolder) {
			subFolders.push(child);
		}
	}

	if (depth < 2) {
		subFolders.sort((a, b) => a.name.localeCompare(b.name));
		for (const sub of subFolders) {
			children.push(scanSingleFolder(sub, excludes, depth + 1));
		}
	}

	// At depth limit: include deeper notes in this folder's count
	if (depth >= 2 && subFolders.length > 0) {
		noteCount += countNotesRecursive(subFolders, excludes);
	}

	return { name: folder.name, path: folder.path, noteCount, children };
}

function countNotesRecursive(
	folders: TFolder[],
	excludes: string[]
): number {
	let count = 0;
	for (const folder of folders) {
		if (isExcluded(folder.name, excludes)) continue;
		for (const child of folder.children) {
			if (isExcluded(child.name, excludes)) continue;
			if (child instanceof TFile && child.extension === "md") {
				count++;
			} else if (child instanceof TFolder) {
				count += countNotesRecursive([child], excludes);
			}
		}
	}
	return count;
}

export function computeTotalNotes(stats: FolderStats[]): number {
	let total = 0;
	for (const s of stats) {
		total += s.noteCount;
		for (const c of s.children) {
			total += c.noteCount;
		}
	}
	return total;
}
