# Knowledge Dashboard

Obsidian 插件，在右侧面板以可视化方式展示知识库文件夹的笔记统计。

## 功能特性

- **文件夹扫描**：扫描 vault 根目录文件夹结构（最多两级），统计各文件夹下的 `.md` 笔记数量
- **统计卡片**：顶部展示笔记总数 / 一级目录数 / 二级目录数
- **饼图可视化**：展示可配置的文件夹（默认 notes）下各子目录的笔记数量占比（纯 SVG 实现，零第三方依赖）
- **可折叠表格**：文件夹层级表格，二级目录默认收起，点击一级目录行展开/收起
- **展开状态持久化**：使用 localStorage 记住各级文件夹的展开/收起状态，刷新后自动恢复
- **自动刷新**：监听 vault 的文件创建/删除/重命名事件，自动更新统计
- **排除文件夹**：默认排除 `.obsidian`、`.trash`、`node_modules`、`.git`、`.design`；读取 Obsidian `app.json` 中的 `exclude-folders`/`exclude-files` 配置；设置中还可追加自定义排除项
- **饼图色板**：20 色循环，支持最多 20 个子目录颜色不重复

## 安装

1. 将 `dist-plugin/` 目录整体复制到 Obsidian vault 的插件目录下：
   ```
   <vault>/.obsidian/plugins/knowledge-dashboard/
   ```
2. 在 Obsidian 中打开「设置」→「第三方插件」，启用 Knowledge Dashboard
3. 使用命令面板（Ctrl/Cmd+P）执行「打开知识库看板」，或点击左侧栏仪表板图标

## 使用

插件安装并启用后，通过以下方式打开看板：

- 命令面板：输入「知识库看板」
- 左侧栏图标：点击仪表板图标

看板上会实时显示：
- 统计摘要卡片
- 文件夹分布饼图（可在设置中配置目标文件夹）
- 可展开的文件夹层级表格，展开状态自动记忆

### 饼图配置

在「设置」→「知识库看板」中，「饼图目标文件夹」字段可指定用于生成饼图的文件夹名称（不区分大小写）。留空则不显示饼图。默认值为 `notes`。

### 排除文件夹

在「设置」→「知识库看板」中，「排除文件夹」字段可输入逗号分隔的文件夹名称，追加到默认和 Obsidian 内置排除列表之后。

### 排除优先级

扫描时按以下顺序合并排除列表：
1. **默认排除**：`.obsidian`、`.trash`、`node_modules`、`.git`、`.design`
2. **Obsidian app.json 配置**：读取 `exclude-folders` 和 `exclude-files`（如有）
3. **插件设置中的自定义排除**：逗号分隔的额外文件夹

## 构建

```bash
npm install
npm run build
```

构建流程：TypeScript 类型检查 → esbuild 打包，产物输出到 `main.js`，复制到 `dist-plugin/`。

## 技术细节

- **语言**：TypeScript
- **构建工具**：esbuild（CommonJS 输出，Tree-shaking）
- **依赖**：仅 Obsidian API，无第三方图表库
- **饼图实现**：纯 SVG `circle` + `stroke-dasharray`
- **展开状态**：localStorage 持久化（key: `kd-expanded`）
- **产物大小**：约 9.4KB

## 已知限制

- 饼图颜色色板为 20 色循环，超过 20 个子目录会重复
- 预览页 `dashboard-preview.html` 与插件代码需手动同步

## 许可证

MIT
