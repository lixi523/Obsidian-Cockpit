# Handoff — Obsidian-Cockpit 知识库看板插件

> 项目路径：`d:\Documents\VS Code\Obsidian-Cockpit`
> 交接时间：2026-07-30（Asia/Shanghai）
> 当前版本：`1.1.0`
> 构建状态：✅ `npm run build` 通过，零错误，产物 9.4kb

---

## 1. 项目目标

Obsidian 插件 **Knowledge Dashboard**（id: `knowledge-dashboard`），在右侧面板以可视化方式展示当前 vault 的文件夹统计：

- 扫描 vault 根目录下文件夹结构（最多两级），统计各文件夹的 `.md` 笔记数量
- 顶部三张统计卡片：笔记总数 / 一级目录数 / 二级目录数
- **饼图**（纯 SVG 实现，无第三方图表库），展示可配置的文件夹下各二级子目录的笔记数量占比（默认 `notes`）
- 文件夹层级表格，支持展开/收起：二级目录默认收起，点击一级目录行展开/再次点击收起
- **展开状态持久化**：使用 localStorage 记住各级文件夹的展开/收起状态，刷新后自动恢复
- 监听 vault 的 create/delete/rename 事件，自动刷新
- 排除文件夹：读取 Obsidian `app.json` 中的 `exclude-folders`/`exclude-files`；设置中可追加自定义排除项

---

## 2. 当前进度

| 模块 | 状态 |
|------|------|
| 文件夹扫描 + 统计 | ✅ 完成 |
| 统计卡片 | ✅ 完成 |
| 饼图（可配置目标文件夹，默认 notes） | ✅ 完成，已放置在统计卡片下方、表格上方 |
| 表格 + 条形分布图 | ✅ 完成 |
| 二级目录默认收起 + 点击展开 | ✅ 完成，已在 Obsidian 实测通过 |
| 展开状态持久化（localStorage） | ✅ 完成 |
| 读取 Obsidian app.json 排除列表 | ✅ 完成 |
| 饼图色板扩展（10 → 20 色） | ✅ 完成 |
| 饼图目标文件夹可配置设置项 | ✅ 完成 |
| dist-plugin 同步 | ✅ 完成 |
| 预览 HTML（dashboard-preview.html） | ✅ 同步更新 |
| 版本号 bump（1.0.0 → 1.1.0） | ✅ 完成 |

---

## 3. 已完成修改

### `src/main.ts`
- `render()` 方法渲染顺序：Header → 统计卡片 → 饼图 → 表格
- `DashboardView` 构造函数增加 `app: App` 参数，保存为 `obsidianApp`（避开基类 `app` 属性名冲突）
- `refresh()` 改为 `async`，调用异步 `scanFolderStats`
- 新增 `expandedPaths: Set<string>`，`refresh()` 时从 localStorage 恢复，点击切换时写入 localStorage（key: `kd-expanded`）
- `renderFolderRow` 新增 `parentPath` 参数：
  - depth=0 有子目录时：`tr.dataset.folder = folder.path`，加 `▶` 切换指示器
  - depth=1 子行：`tr.dataset.parent = parentPath`，默认加 `kd-hidden` 类
  - 点击 L0 行：`querySelectorAll('tr[data-parent="..."]')` → 切换 `kd-hidden`，更新 `▶/▼`
- `renderPieChart`：查找 `name.toLowerCase() === pieTargetFolder` 的一级文件夹，生成 SVG 饼图 + 图例；色板扩展至 20 色
- 设置 Tab 新增「饼图目标文件夹」设置项，默认值 `notes`，留空禁用饼图

### `src/folder-stats.ts`
- `scanFolderStats` 改为 `async`，新增 `app?: App` 参数
- 读取 `vault.adapter.read(vault.configDir + "/app.json")` 获取 Obsidian 应用配置
- 从配置中读取 `exclude-folders` 和 `exclude-files`，合并到排除列表

### `styles.css`
- 原有样式未改动（`.kd-pie-section` / `.kd-pie-row` / `.kd-pie-svg` / `.kd-pie-legend` / `.kd-legend-item` / `.kd-legend-dot`）
- 原有 `tr[data-parent]` 收起/显示规则、`.kd-toggle` 指示器样式、`.kd-row-l0 { cursor: pointer }` 均未改动
- 窄屏（≤400px）时饼图与图例改为纵向排列

### `dashboard-preview.html`
- 版本号更新至 v1.1.0
- `<script>` 块增加 localStorage 持久化逻辑（自执行函数包裹）
  - 页面加载时读取 `localStorage["kd-expanded"]` 并恢复展开状态
  - 点击 L0 行时同步保存/删除展开状态到 localStorage

### `manifest.json` / `versions.json` / `package.json`
- 版本号从 `1.0.0` 升级至 `1.1.0`

---

## 4. 关键文件

| 文件 | 作用 |
|------|------|
| `src/main.ts` | 插件主入口：DashboardView、Settings Tab、Plugin 主类 |
| `src/folder-stats.ts` | 扫描逻辑：`scanFolderStats` / `computeTotalNotes` / `FolderStats` 接口 |
| `styles.css` | Obsidian 内面板样式 |
| `dashboard-preview.html` | 浏览器独立预览页（模拟 Obsidian 暗色主题） |
| `esbuild.config.mjs` | 构建配置，入口 `src/main.ts` → `main.js` |
| `manifest.json` | 插件清单 |
| `dist-plugin/` | 分发产物目录（main.js / styles.css / manifest.json / versions.json） |

**构建命令：** `npm run build`（= `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`）

---

## 5. 不能动的边界

- ❌ **不引入第三方图表库**（ECharts/Chart.js/D3 等）—— 饼图用纯 SVG `circle` + `stroke-dasharray` 实现，保持零运行时依赖
- ❌ **不改动 `src/folder-stats.ts`** 的扫描逻辑核心（深度限制、排序、children 递归）与 `FolderStats` 接口形状
- ❌ **不改 `esbuild.config.mjs` / `tsconfig.json`** 的构建配置
- ❌ **不改 `manifest.json` 的 id/minAppVersion**（version 可按迭代 bump）
- ❌ 不删除原本就存在的死代码（除非明确要求）
- ✅ 编辑已有代码时遵循现有风格（Tab 缩进、双引号、Obsidian API 用 `createEl/createDiv`）

---

## 6. 已经否掉的方案

| 方案 | 否掉原因 |
|------|----------|
| 引入 ECharts 做饼图 | 违反"零运行时依赖"原则，产物体积爆炸 |
| 饼图用 Canvas 绘制 | SVG 更易适配主题颜色、可缩放、无重绘逻辑 |
| 饼图放在表格下方 | 用户明确要求"放在总数量下面"（统计卡片下方） |
| 子行 `data-parent` 用子文件夹自身路径 | **已踩坑**：父级点击查找 `tr[data-parent="Notes"]` 找不到，导致 Obsidian 内点击无效。正确做法是传父级 `folder.path` |
| `for...of` 遍历 `NodeListOf` | TS 报 `TS2488`，改用 `forEach` |
| 预览 HTML 不加 `<script>` | 静态页面点击事件不生效，必须自己绑 |
| 使用 `app.vault.getConfig()` | 该 API 在 `Vault` 类上不存在，改用 `vault.adapter.read(configDir + "/app.json")` |
| 属性名 `app` 传入 DashboardView | 与基类 `View.app` 冲突导致 TS2415，改用 `obsidianApp` |

---

## 7. 当前风险点

1. **饼图颜色 20 色循环**，超过 20 个子目录会重复颜色。若后续需要无限色板，可改用 HSL 动态生成。
2. **预览 HTML 与插件代码双份维护**，样式与结构需手动同步，容易漏。
3. `renderFolderRow` 递归深度目前实际只到 2 级（folder-stats.ts 限制），但函数签名支持更深，注意不要误用。
4. **展开状态以文件夹路径为 key**，若用户重命名文件夹会导致旧路径残留 localStorage 中，下次扫描时因路径不匹配而失效（非 bug，可接受）。
5. **`refresh()` 改为 async**，所有调用点（`onOpen`、刷新按钮、`refreshDashboard`）需确保 await 或 fire-and-forget 正确处理。

---

## 8. 已经跑过的测试

- ✅ `npm run build`：TypeScript 类型检查 + esbuild 打包，零错误，产物 9.4kb
- ✅ Obsidian 实测：
  - 插件加载、右侧面板打开正常
  - 二级目录默认收起 ✅
  - 点击一级目录行展开/再次点击收起 ✅
  - 饼图渲染正常 ✅
  - 展开状态 localStorage 持久化 ✅
  - Obsidian app.json 排除列表读取 ✅
- ⚠️ 未写自动化单元测试（项目无测试框架，`package.json` 无 test 脚本）

---

## 9. 下一步计划

- [ ] （可选）饼图颜色超过 20 项的 HSL 动态色板
- [ ] （可选）预览 HTML 与插件样式抽成共享片段，减少双份维护
- [ ] （可选）展开状态 key 改为文件夹名称而非路径（避免重命名导致失效）
- [ ] 版本号 bump（当前 1.1.0，功能稳定后可考虑 1.2.0）

---

## 10. 新窗口启动提示词

```
继续 Obsidian-Cockpit 知识库看板插件任务。请先阅读 handoff.md 了解上下文。

项目路径：d:\Documents\VS Code\Obsidian-Cockpit
构建命令：npm run build（在项目根目录执行，通过后零错误）
当前版本：1.1.0

项目是 Obsidian 插件，用 TypeScript + esbuild 构建，不使用任何第三方图表库（饼图用纯 SVG 实现）。

关键约束：
- 不引入第三方图表库
- 不改 src/folder-stats.ts 的扫描逻辑核心（深度限制、排序、children 递归）与 FolderStats 接口形状
- 不改构建配置（esbuild.config.mjs / tsconfig.json）
- 不改 manifest.json 的 id/minAppVersion（version 可 bump）
- 编辑代码遵循现有风格：Tab 缩进、双引号、Obsidian DOM API（createEl/createDiv/createSpan）
- dashboard-view 中 app 属性名用 obsidianApp（避开基类冲突）

当前状态：所有功能已完成并构建通过，dist-plugin/ 已同步。下一步计划见 handoff.md 第 9 节，按需挑选实施。

开始前建议先 npm run build 确认环境正常，然后用 Read 浏览 src/main.ts、src/folder-stats.ts、styles.css。
```
