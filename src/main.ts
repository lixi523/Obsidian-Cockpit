import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	ItemView,
	Vault,
	WorkspaceLeaf,
} from "obsidian";
import { scanFolderStats, computeTotalNotes, FolderStats } from "./folder-stats";

// --- Settings ---

interface KnowledgeDashboardSettings {
	vaultPath: string;
	excludeFolders: string;
	pieTargetFolder: string;
}

const DEFAULT_SETTINGS: KnowledgeDashboardSettings = {
	vaultPath: "",
	excludeFolders: "",
	pieTargetFolder: "notes",
};

// --- View ---

const VIEW_TYPE_DASHBOARD = "knowledge-dashboard-view";

class DashboardView extends ItemView {
	private stats: FolderStats[] = [];
	private settings: KnowledgeDashboardSettings;
	private vault: Vault;
	private obsidianApp: App;
	private maxNotes: number = 0;
	private expandedPaths: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf, settings: KnowledgeDashboardSettings, vault: Vault, app: App) {
		super(leaf);
		this.settings = settings;
		this.vault = vault;
		this.obsidianApp = app;
	}

 getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

 getDisplayText(): string {
		return "知识库看板";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		// 恢复持久化的展开状态
		this.expandedPaths.clear();
		try {
			const saved = localStorage.getItem("kd-expanded");
			if (saved) {
				const paths = JSON.parse(saved) as string[];
				this.expandedPaths = new Set(paths);
			}
		} catch {}
		const excludes = this.settings.excludeFolders
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		this.stats = await scanFolderStats(this.vault, excludes, this.obsidianApp);
		this.maxNotes = this.findMaxNotes(this.stats);
		this.render();
	}

	private findMaxNotes(stats: FolderStats[]): number {
		let max = 0;
		for (const s of stats) {
			if (s.noteCount > max) max = s.noteCount;
			for (const c of s.children) {
				if (c.noteCount > max) max = c.noteCount;
			}
		}
		return max;
	}

	private render(): void {
		const content = this.containerEl.children[1] as HTMLElement;
		content.empty();
		content.addClass("kd-content");

		// Header
		const header = content.createDiv("kd-header");
		header.createEl("h2", { text: "知识库看板" });
		const actions = header.createDiv("kd-header-actions");
		const refreshBtn = actions.createEl("button", { attr: { "aria-label": "刷新" } });
		refreshBtn.innerHTML = "&#x21bb;";
		refreshBtn.onclick = () => this.refresh();

		// Stats summary bar
		const total = computeTotalNotes(this.stats);
		const l1Count = this.stats.length;
		const l2Count = this.stats.reduce((sum, s) => sum + s.children.length, 0);

		const statsBar = content.createDiv("kd-stats-bar");
		this.renderStatCard(statsBar, "笔记总数", total, true);
		this.renderStatCard(statsBar, "一级目录", l1Count, false);
		this.renderStatCard(statsBar, "二级目录", l2Count, false);

		this.renderPieChart(content);

		// Table
		if (this.stats.length === 0) {
			const empty = content.createDiv("kd-empty");
			empty.createDiv("kd-empty-icon").textContent = "📂";
			empty.createEl("p", { text: "未找到任何文件夹。" });
			return;
		}

		const wrapper = content.createDiv("kd-table-wrapper");
		const table = wrapper.createEl("table", { cls: "kd-table" });
		const thead = table.createEl("thead");
		const headRow = thead.createEl("tr");
		headRow.createEl("th", { text: "文件夹" });
		headRow.createEl("th", { text: "笔记数" });
		headRow.createEl("th", { text: "子目录" });
		headRow.createEl("th", { text: "分布" });

		const tbody = table.createEl("tbody");
		for (const folder of this.stats) {
			this.renderFolderRow(tbody, folder, 0);
		}
	}

	private renderStatCard(
		parent: HTMLElement,
		label: string,
		value: number,
		accent: boolean
	): void {
		const card = parent.createDiv("kd-stat-card");
		card.createSpan({ cls: "kd-stat-label", text: label });
		const valEl = card.createSpan({ cls: "kd-stat-value" });
		if (accent) valEl.addClass("accent");
		valEl.textContent = String(value);
	}

	private renderFolderRow(
		tbody: HTMLTableSectionElement,
		folder: FolderStats,
		depth: number,
		parentPath?: string
	): void {
		const tr = tbody.createEl("tr");
		tr.addClass("kd-row-l" + depth);

		const hasChildren = depth === 0 && folder.children.length > 0;
		if (hasChildren) {
			tr.dataset.folder = folder.path;
		}
		if (depth === 1) {
			tr.dataset.parent = parentPath ?? "";
			tr.addClass("kd-hidden");
		}

		// Folder name cell
		const tdName = tr.createEl("td");
		const nameWrap = tdName.createDiv("kd-folder-name");
		if (depth > 0) {
			nameWrap.createSpan({ cls: "kd-indent" });
		}
		if (hasChildren) {
			const toggleEl = nameWrap.createSpan({ cls: "kd-toggle", text: "▶" });
			// 恢复持久化的展开状态
			if (this.expandedPaths.has(folder.path)) {
				tr.classList.add("kd-expanded");
				toggleEl.textContent = "▼";
			}
		}
		const icon = depth === 0 ? "📁" : "📂";
		nameWrap.createSpan({ cls: "kd-folder-icon", text: icon });
		nameWrap.createSpan({ cls: "kd-folder-label", text: folder.name });

		// Notes count
		const tdCount = tr.createEl("td");
		tdCount.createSpan({ cls: "kd-count", text: String(folder.noteCount) });

		// Sub-folder count
		const tdSub = tr.createEl("td");
		tdSub.createSpan({ cls: "kd-sub-count", text: String(folder.children.length) });

		// Bar distribution
		const tdBar = tr.createEl("td");
		tdBar.addClass("kd-bar-cell");
		const track = tdBar.createDiv("kd-bar-track");
		const pct = this.maxNotes > 0 ? (folder.noteCount / this.maxNotes) * 100 : 0;
		track.createDiv({ cls: "kd-bar-fill" }).style.width = `${Math.max(pct, 2)}%`;

		// Children
		for (const child of folder.children) {
			this.renderFolderRow(tbody, child, depth + 1, folder.path);
		}

		// Toggle expand/collapse on click
		if (hasChildren) {
			tr.addEventListener("click", () => {
				const children = tbody.querySelectorAll(
					`tr[data-parent="${folder.path}"]`
				);
				const expanded = tr.classList.toggle("kd-expanded");
				children.forEach((child) => {
					child.classList.toggle("kd-hidden", !expanded);
				});
				const toggleEl = tr.querySelector(".kd-toggle");
				if (toggleEl) {
					toggleEl.textContent = expanded ? "▼" : "▶";
				}
				// 持久化展开状态
				if (expanded) {
					this.expandedPaths.add(folder.path);
				} else {
					this.expandedPaths.delete(folder.path);
				}
				try {
					localStorage.setItem("kd-expanded", JSON.stringify([...this.expandedPaths]));
				} catch {}
			});
		}
	}

	private renderPieChart(content: HTMLElement): void {
		const targetName = (this.settings.pieTargetFolder || "notes").trim().toLowerCase();
		const folder = this.stats.find(s => s.name.toLowerCase() === targetName);
		if (!folder || folder.children.length === 0) return;

		const section = content.createDiv("kd-pie-section");
		section.createEl("h3", { text: `${folder.name} 文件夹分布` });

		const items = folder.children.filter(c => c.noteCount > 0);
		const total = items.reduce((sum, c) => sum + c.noteCount, 0);
		if (total === 0) return;

		const sorted = [...items].sort((a, b) => b.noteCount - a.noteCount);

		const colors = [
			"#4A90D9", "#50C878", "#F5A623", "#E75A5A",
			"#9B59B6", "#1ABC9C", "#E67E22", "#3498DB",
			"#E91E63", "#00BCD4", "#8BC34A", "#FF9800",
			"#CDDC39", "#009688", "#673AB7", "#FF5722",
			"#795548", "#607D8B", "#E040FB", "#536DFE",
		];

		const size = 180;
		const cx = size / 2;
		const cy = size / 2;
		const r = 72;
		const circumference = 2 * Math.PI * r;

		let svgHtml = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;

		let offset = 0;
		for (let i = 0; i < sorted.length; i++) {
			const pct = sorted[i].noteCount / total;
			const dashLength = circumference * pct;
			svgHtml += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="28" stroke-dasharray="${dashLength} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
			offset += dashLength;
		}

		svgHtml += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="currentColor">${total}</text>`;
		svgHtml += `</svg>`;

		const chartRow = section.createDiv("kd-pie-row");
		const svgWrapper = chartRow.createDiv("kd-pie-svg");
		svgWrapper.innerHTML = svgHtml;

		const legend = chartRow.createDiv("kd-pie-legend");
		for (let i = 0; i < sorted.length; i++) {
			const child = sorted[i];
			const item = legend.createDiv("kd-legend-item");
			const dot = item.createSpan("kd-legend-dot");
			dot.style.backgroundColor = colors[i % colors.length];
			const pct = Math.round((child.noteCount / total) * 100);
			item.createSpan({ text: `${child.name} — ${child.noteCount}（${pct}%）` });
		}
	}
}

// --- Settings Tab ---

class DashboardSettingTab extends PluginSettingTab {
	plugin: KnowledgeDashboardPlugin;

	constructor(app: App, plugin: KnowledgeDashboardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "知识库看板设置" });

		new Setting(containerEl)
			.setName("排除文件夹")
			.setDesc("逗号分隔的文件夹名称，这些文件夹将不会被统计（在默认排除项和 Obsidian 内置排除列表基础上追加）")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.excludeFolders)
					.setPlaceholder("folder1, folder2")
					.onChange(async (value) => {
						this.plugin.settings.excludeFolders = value;
						await this.plugin.saveSettings();
						this.plugin.refreshDashboard();
					})
			);

		new Setting(containerEl)
			.setName("饼图目标文件夹")
			.setDesc("用于生成饼图的文件夹名称（不区分大小写），留空表示禁用饼图")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.pieTargetFolder)
					.setPlaceholder("notes")
					.onChange(async (value) => {
						this.plugin.settings.pieTargetFolder = value;
						await this.plugin.saveSettings();
						this.plugin.refreshDashboard();
					})
			);

		new Setting(containerEl).setName("关于").setDesc(
			"扫描知识库的文件夹结构（最多两级），统计各文件夹下的笔记数量。" +
			"默认排除：.obsidian、.trash、node_modules、.git、.design"
		);
	}
}

// --- Plugin ---

export default class KnowledgeDashboardPlugin extends Plugin {
	settings: KnowledgeDashboardSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => {
			return new DashboardView(leaf, this.settings, this.app.vault, this.app);
		});

		this.addCommand({
			id: "open-knowledge-dashboard",
			name: "打开知识库看板",
			callback: () => this.activateView(),
		});

		this.addRibbonIcon("layout-dashboard", "知识库看板", () => {
			this.activateView();
		});

		this.registerEvent(this.app.vault.on("create", () => this.refreshDashboard()));
		this.registerEvent(this.app.vault.on("delete", () => this.refreshDashboard()));
		this.registerEvent(this.app.vault.on("rename", () => this.refreshDashboard()));

		this.addSettingTab(new DashboardSettingTab(this.app, this));
	}

	onunload(): void {}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
			} else {
				leaf = workspace.getLeaf("tab");
			}
		}
		await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		await workspace.revealLeaf(leaf);
		this.refreshDashboard();
	}

	refreshDashboard(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		for (const leaf of leaves) {
			if (leaf.view instanceof DashboardView) {
				leaf.view.refresh();
			}
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
