# Phase 4A-6-4: Chart Color Token Foundation + Low-risk Migration

## 日期
2026-04-28

## 目标
创建可复用的图表颜色 token 基础工具，将低风险页面（Visualization、Dashboard）中的硬编码 ECharts 颜色迁移到 CSS 变量体系。

## 新增文件

### `app/src/hooks/useChartColors.ts`
- 提供 `getChartColors(): ChartColors` 纯函数，可在任意上下文（useEffect、回调、模块级函数）中调用
- 提供 `useChartColors(): ChartColors` React Hook，带 `MutationObserver` 监听 `document.documentElement` 的 `class`/`style` 变化，实现主题切换时颜色自动更新
- 所有 token 均有安全 fallback，SSR/测试环境不崩溃
- CSS 变量映射：

| Token | CSS Variable | Fallback |
|---|---|---|
| primary | `--neon-cyan` | `#00f5ff` |
| secondary | `--neon-purple` | `#b829f7` |
| accent | `--neon-pink` | `#ff0080` |
| success | `--neon-green` | `#00ff9d` |
| warning | `--status-warning` | `#ffaa00` |
| danger | `--status-error` | `#ef4444` |
| blue | `--chart-blue` | `#3b82f6` |
| muted | `--text-muted` | `#64748b` |
| textPrimary | `--text-primary` | `#e2e8f0` |
| textSecondary | `--text-secondary` | `#94a3b8` |
| bgPrimary | `--bg-primary` | `#0a0e27` |
| bgSecondary | `--bg-secondary` | `#151b3d` |
| borderSubtle | `--border-subtle` | `rgba(148,163,184,0.2)` |
| palette / categorical / gradients | 无 CSS 变量对应 | 硬编码 fallback 数组 |

## 修改文件

### `app/src/pages/Visualization.tsx`
- 移除 `CHART_COLORS` 常量对象（原 20 行硬编码）
- 引入 `getChartColors` from `@/hooks/useChartColors`
- 在 `buildChartOption`、`handleDownload` 函数入口调用 `getChartColors()`
- 替换映射：
  - `CHART_COLORS.cyan` → `colors.primary`
  - `CHART_COLORS.purple` → `colors.secondary`
  - `CHART_COLORS.pink` → `colors.accent`
  - `CHART_COLORS.green` → `colors.success`
  - `CHART_COLORS.orange` → `colors.warning`
  - `CHART_COLORS.blue` → `colors.blue`
  - `CHART_COLORS.red` → `colors.danger`
  - `CHART_COLORS.categorical` → `colors.categorical`
  - `CHART_COLORS.gradients` → `colors.gradients`
- 替换内联 hex：
  - `#94a3b8` → `colors.textSecondary`
  - `#e2e8f0` → `colors.textPrimary`
  - `#0a0e27` → `colors.bgPrimary`
  - `rgba(148, 163, 184, 0.1)` / `0.2` 分割线 → `colors.borderSubtle`
- `clusterColors` 数组 → `colors.palette`
- 聚类中心点 border → `colors.primary`

### `app/src/pages/Dashboard.tsx`
- 移除 `COLORS` 常量对象（原 17 行硬编码）
- 引入 `getChartColors` from `@/hooks/useChartColors`
- 在 overview useEffect、`generateChartOption`、`generateVizOption` 入口调用 `getChartColors()`
- 替换映射：
  - `COLORS.cyan` → `colors.primary`
  - `COLORS.purple` → `colors.secondary`
  - `COLORS.pink` → `colors.accent`
  - `COLORS.green` → `colors.success`
  - `COLORS.orange` → `colors.warning`
  - `COLORS.yellow` → `colors.palette[7]`
  - `COLORS.blue` → `colors.blue`
  - `COLORS.indigo` → `colors.secondary`
  - `COLORS.textPrimary` → `colors.textPrimary`
  - `COLORS.textSecondary` → `colors.textSecondary`
  - `COLORS.textMuted` → `colors.muted`
  - `COLORS.borderSubtle` → `colors.borderSubtle`
  - `COLORS.bgPrimary` → `colors.bgPrimary`
  - `COLORS.bgSecondary` → `colors.bgSecondary`

## 故意保留的硬编码颜色及原因

| 颜色值 | 位置 | 原因 |
|---|---|---|
| `#fff` / `#ffffff` | Visualization 饼图 border、散点 emphasis border | 白色是意图性对比色，不应随主题变化 |
| `rgba(0, 245, 255, 0.3)` | 多处 areaStyle 渐变 | 主色透明度衍生值，无对应 CSS 变量 |
| `rgba(184, 41, 247, 0.3)` | Dashboard typeChart 渐变 | 次色透明度衍生值，无对应 CSS 变量 |
| `rgba(148, 163, 184, 0.3)` | Visualization 轴线 | borderSubtle 的高透明度变体（0.3 vs 0.1），保留语义差异 |
| `rgba(0, 245, 255, 0.3)` | Visualization tooltip border | 主色透明度衍生值 |
| `rgba(21, 27, 61, 0.95)` | Visualization tooltip background | bgSecondary 透明度衍生值 |

## 推迟到下一阶段的页面

| 页面 | 原因 |
|---|---|
| `PathAnalysis.tsx` | 复杂图表生命周期（漏斗、桑基、关联图），语义颜色多，需单独验证 |
| `Attribution.tsx` | tooltip 颜色、模型对比色已在 4A-6-3 中清理 glass，图表颜色变更需配合 ECharts 选项审查 |
| `Forecast.tsx` | 预测曲线、大促标记、what-if 区域填充等语义颜色复杂 |

## 故意未变更的内容

- 图表类型、数据结构、聚合逻辑、分组逻辑
- ECharts 生命周期（init/dispose/resize）
- 保存/下载行为
- 聚类分析逻辑
- Dashboard widget 数据与布局
- 按钮层级、glass、页面布局

## 验证结果

### 类型检查
```bash
cd app && npx tsc --noEmit
```
结果：0 errors ✅

### 生产构建
```bash
cd app && npm run build
```
结果：built in 19.49s ✅

### SelectItem 空值检查
```bash
grep -R "SelectItem value=\"\"" app/src --include="*.tsx"
grep -R "SelectItem value=''" app/src --include="*.tsx"
```
结果：无输出 ✅

### 定向颜色检查
```bash
grep -R "#00f5ff\|#b829f7\|#ff0080\|#00ff9d\|#ffaa00" app/src/pages/Visualization.tsx app/src/pages/Dashboard.tsx --include="*.tsx"
```
结果：无输出 ✅

### 定向 COLORS 常量检查
```bash
grep -R "const CHART_COLORS\|const COLORS" app/src/pages/Visualization.tsx app/src/pages/Dashboard.tsx --include="*.tsx"
```
结果：无输出 ✅

### 手动 spot-check
- Visualization：页面打开正常，图表渲染正常，类型切换正常，字段选择正常，下载正常 — **Pending user manual verification**
- Dashboard：页面打开正常，图表/小部件渲染正常，标签切换正常 — **Pending user manual verification**
- 主题切换时图表颜色更新 — **Pending user manual verification**
- Console 无新错误 — **Pending user manual verification**

## 已知问题 / TODO
- `palette` / `categorical` / `gradients` 数组仍使用硬编码 fallback，未来可通过 CSS `@property` 或运行时数组生成实现全动态
- 保留的 `rgba` 透明度衍生值可在后续阶段通过 `hexToRgba` 辅助函数统一处理

## 是否可以进入 Phase 4A-6-5
**是。** 本阶段已完成，可进入 Phase 4A-6-5 Complex Chart Color Migration（PathAnalysis / Attribution / Forecast）。

---

## Git 信息

### Commit 前 git status
```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  modified:   src/pages/Dashboard.tsx
  modified:   src/pages/Visualization.tsx

Untracked files:
  src/hooks/useChartColors.ts
```

### Commit hash
待补充

### Commit message
```
refactor: migrate low-risk chart colors to theme tokens

- Add useChartColors.ts hook with getChartColors() and useChartColors()
- Visualization: replace CHART_COLORS constant with getChartColors()
- Dashboard: replace COLORS constant with getChartColors()
- Replace hardcoded hex (#00f5ff, #94a3b8, #e2e8f0, #0a0e27) with CSS variable reads
- Preserve intentional white (#fff) and rgba-derived gradients

Zero business logic change.
```

### Push 结果
待补充

### Package 文件检查
- `package.json` — 未修改 ✅
- `package-lock.json` — 未修改 ✅
