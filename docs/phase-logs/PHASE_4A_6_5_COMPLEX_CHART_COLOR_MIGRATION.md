# Phase 4A-6-5: Complex Chart Color Migration

## 日期
2026-04-28

## 目标
将复杂图表页面（Attribution、PathAnalysis）的 ECharts / graph 硬编码颜色迁移到共享 chart color token 工具。

## 修改文件

### `app/src/hooks/useChartColors.ts`
- 新增 `withAlpha(color: string, alpha: number): string` 辅助函数
- 支持 hex → rgba 转换（3 位和 6 位 hex）
- 若输入已是 rgb/rgba 或无法解析，安全回退返回原值
- 零新增依赖

### `app/src/pages/Attribution.tsx`
- 引入 `getChartColors`、`withAlpha`
- 在 `renderComparisonChart` 函数入口调用 `getChartColors()`
- 替换映射：
  - `#e2e8f0` → `colors.textPrimary`
  - `#94a3b8` → `colors.textSecondary`
  - `rgba(148, 163, 184, 0.3)` / `0.1` → `colors.borderSubtle`
  - `rgba(21, 27, 61, 0.95)` → `withAlpha(colors.bgSecondary, 0.95)`
  - `rgba(0, 245, 255, 0.3)` → `withAlpha(colors.primary, 0.3)`
- **保留**: `ATTRIBUTION_MODELS` 中的模型语义颜色（`#00f5ff` 等）— 这些是业务标识色，用于区分不同归因模型，不应随主题变化

### `app/src/pages/PathAnalysis.tsx`
- 引入 `getChartColors`、`withAlpha`
- **漏斗图 (funnel)**：
  - `borderColor: '#0a0e27'` → `colors.bgPrimary`
  - 渐变 palette `['#00f5ff', '#00d4e6', ...]` → 基于 `colors.primary` 的透明度渐变序列（`withAlpha(colors.primary, 0.8)` → `0.2`）
- **桑基图 (sankey)**：
  - `color: '#00f5ff'` → `colors.primary`
  - `borderColor: '#0a0e27'` → `colors.bgPrimary`
  - `color: '#e2e8f0'` → `colors.textPrimary`
- **网络图 (graph)**：
  - `color: '#00f5ff'` → `colors.primary`
  - `shadowColor: 'rgba(0, 245, 255, 0.5)'` → `withAlpha(colors.primary, 0.5)`
  - `color: '#e2e8f0'` → `colors.textPrimary`
  - `textStyle: '#94a3b8'` → `colors.textSecondary`
  - `backgroundColor: '#0a0e27'` → `colors.bgPrimary`
- **关联规则图 (AssociationRuleGraph)**：
  - 边颜色（lift 语义）：`#00ff9d` → `colors.success`，`#ff0080` → `colors.danger`，`#ffaa00` → `colors.warning`
  - 节点颜色（权重语义）：`#00f5ff` → `colors.primary`，`#b829f7` → `colors.secondary`，`#3b82f6` → `colors.blue`
  - 文字颜色：`#e2e8f0` → `colors.textPrimary`，`#94a3b8` → `colors.textSecondary`
  - tooltip：`rgba(...)` → `withAlpha(...)`
  - JSX legend：`bg-[#00f5ff]` → `bg-[var(--neon-cyan)]` 等（使用已有 CSS 变量）

## 未修改文件

### `app/src/pages/Forecast.tsx`
- 无 ECharts 使用，无硬编码图表颜色
- 已使用 CSS 变量（`var(--neon-cyan)`、`var(--bg-tertiary)` 等）
- 零变更

## 故意保留的硬编码颜色及原因

| 颜色值 | 位置 | 原因 |
|---|---|---|
| `#fff` | PathAnalysis 漏斗图 label | 意图性白色，确保在彩色漏斗段内可读 |
| `#00f5ff` / `#b829f7` / `#00ff9d` / `#ffaa00` / `#ff0080` / `#3b82f6` | Attribution `ATTRIBUTION_MODELS` | 业务语义颜色，用于区分 6 种归因模型，不应随主题变化 |

## 故意未变更的内容

- 图表类型、数据结构、聚合逻辑
- ECharts 生命周期（init/dispose/resize/setOption）
- 归因模型比较逻辑、结果计算、排序
- 路径分析类型切换（funnel/path/clustering/key_path/sequence_mining）
- AssociationRuleGraph 的节点/边数据结构、力导向布局参数
- 下载/导出行为
- 页面布局、按钮层级、glass

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
结果：built in 24.62s ✅

### SelectItem 空值检查
```bash
grep -R "SelectItem value=\"\"" app/src --include="*.tsx"
grep -R "SelectItem value=''" app/src --include="*.tsx"
```
结果：无输出 ✅

### 定向 neon hex 检查（排除业务语义色）
```bash
grep -R "#00f5ff\|#b829f7\|#ff0080\|#00ff9d\|#ffaa00" app/src/pages/Attribution.tsx app/src/pages/PathAnalysis.tsx --include="*.tsx"
```
结果：仅 Attribution `ATTRIBUTION_MODELS` 保留 6 处（业务语义色，intentional）✅

### 定向 rgba 检查
```bash
grep -R "rgba(0, 245, 255\|rgba(184, 41, 247\|rgba(255, 0, 128\|rgba(0, 255, 157" app/src/pages/Attribution.tsx app/src/pages/PathAnalysis.tsx --include="*.tsx"
```
结果：无输出 ✅

### 手动 spot-check
- Attribution：页面打开正常，对比图表渲染正常，tooltip 正常，模型结果正常 — **Pending user manual verification**
- PathAnalysis：漏斗/桑基/网络图/关联图渲染正常 — **Pending user manual verification**
- Console 无新错误 — **Pending user manual verification**

## 已知问题 / TODO
- 无

## 是否可以进入 Phase 4A-6-6
**是。** 本阶段已完成，可进入 Phase 4A-6-6 Button Hierarchy + Bundle Size Triage。

---

## Git 信息

### Commit 前 git status
```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  modified:   src/hooks/useChartColors.ts
  modified:   src/pages/Attribution.tsx
  modified:   src/pages/PathAnalysis.tsx
```

### Commit hash
`d66f55e`

### Commit message
```
refactor: migrate complex chart colors to theme tokens

- useChartColors.ts: add withAlpha() helper for hex→rgba conversion
- Attribution: replace chart option colors (tooltip, axis, legend) with tokens
- PathAnalysis: replace funnel/sankey/graph/AssociationRuleGraph colors with tokens
- Forecast: no ECharts found, no changes needed
- Preserve ATTRIBUTION_MODELS semantic business colors

Zero business logic change.
```

### Push 结果
```
To https://github.com/Luoqihui2002/InsightEase.git
   ec1e2a8..d66f55e  master -> master
```
（前两次 push 因网络中断失败，第三次重试成功）

### Package 文件检查
- `package.json` — 未修改 ✅
- `package-lock.json` — 未修改 ✅
