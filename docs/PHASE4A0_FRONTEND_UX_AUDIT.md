# Phase 4A-0: Frontend UX / Layout Audit

**日期**: 2026-04-28
**范围**: 前端布局、交互、组件复用、视觉一致性审阅（不改业务代码）
**审阅页面**: DataWorkshop, AIWorkspace, Datasets, Dashboard, Visualization, SmartAnalysis, History, Settings, Upload

---

## 输出 1：页面级 UX 问题清单

| 页面 | 当前问题 | 影响 | 优先级 | 建议修复方向 |
|---|---|---|---|---|
| **DataWorkshop** | 页面 2321 行过于庞大，内联组件 10+ 个；9 种操作类型平铺无分组；实验性提示 banner 仍提及"浏览器临时处理"（已废弃）；预览表格无列宽控制；操作链 empty state 无引导 | 维护困难，用户认知负荷高，文案误导 | **P0** | 拆分内联组件到独立文件；操作类型按"常用/高级"分组；更新提示文案；预览表格加 `table-fixed` 和列宽控制 |
| **AIWorkspace** | 数据集选择用原生 `<select>`，数据集多时无法搜索；数据预览表格列无 `max-width` 导致溢出；分析结果面板高度固定 45%，不可调；无空消息时的引导 empty state | 数据集多时不便选择，窄屏体验差，结果区空间僵化 | **P1** | 接入 `DatasetSelector` 组件；预览表格加横向滚动和 `truncate`；结果面板支持拖拽调整高度；增加欢迎引导卡片 |
| **Datasets** | 页面标题用英文 "Datasets"，与其他页面中文不一致；表格行高 `py-4` 信息密度低；详情 Dialog 尺寸 90vw×90vh 过大且未合理利用；底部上传区域与 Upload 页面功能重复；预览表格样式与其他页面不统一 | 视觉不一致，空间利用率低，功能冗余 | **P1** | 统一标题为中文；表格行高改为 `py-3`；详情改为侧边 drawer 或 70vw 以内；移除底部上传区或改为快捷入口；统一表格样式 |
| **Dashboard** | Overview/Custom 视图切换 tabs 样式与其他页面 tab 不同；Widget 高度硬编码（mixed 布局 320px/200px）；空看板引导薄弱；ECharts 颜色常量硬编码，与主题系统脱节；无移动端适配 | 自定义看板体验不一致，主题切换时图表颜色不跟随 | **P2** | 统一 tabs 为底部边框样式；widget 高度改用 CSS 变量或比例；空看板加插图引导；图表颜色接入主题系统 |
| **Visualization** | 左侧配置面板字段选择用原生 `<select>`；图表类型选择网格在窄屏下可能换行异常；"保存到看板"与"下载图表"主次关系不清（同为 outline）；图表容器高度固定 `h-96` | 配置体验不够精致，主次操作混淆 | **P2** | 字段选择保持 select 但优化宽度；图表类型选择窄屏改为 2 列；"保存"改为主按钮（实心 cyan），"下载"改为次按钮；图表高度改为响应式 |
| **SmartAnalysis** | 步骤指示器在页面宽度不足时溢出换行；诊断结果的问题列表和建议操作视觉权重相同；分析结果展示逻辑（CSV 导出等）硬编码在页面内，约 100 行；预处理结果仍为模拟数据 | 步骤导航在窄屏下不可用，结果展示难以维护 | **P1** | 步骤指示器支持响应式（小屏变垂直/折叠）；问题列表和建议分 card 展示；提取结果展示为独立组件；预处理接真实 API |
| **Settings** | 页面有 `max-w-6xl` 限制，两侧大量留白；主题切换按钮无即时预览；通知和隐私的 toggle 用自定义 div 而非 shadcn Switch；语言设置仅 2 项却用整页列表 | 与其他页面宽度策略不一致，交互体验粗糙 | **P2** | 移除宽度限制或全站统一；toggle 改用 shadcn Switch；语言设置改为紧凑选择器 |
| **Upload** | 拖拽区域 `spin-slow` 动画可能造成视觉干扰；上传完成后文件列表仍保留需手动删除；质量分数环形图为手写 SVG 非组件化；字段分析卡片无折叠，长列表冗长 | 上传多文件时列表冗长，视觉干扰 | **P2** | 简化拖拽动画或改为脉冲；自动清理已完成项或提供"清除已完成"；质量分数抽象为 `ScoreRing` 组件；字段分析支持折叠 |
| **History** | 页面标题英文 "History"；下载格式菜单用 `group-hover` 触发，移动端不可用；详情弹窗内容纵向过长；结果预览最多显示 5 列但无提示 | 移动端体验差，信息截断无感知 | **P1** | 统一标题为中文；下载菜单改为 click 触发；详情弹窗分 tab（解读/建议/结果/参数）；增加"仅显示前 5 列"提示 |

---

## 输出 2：组件重复和可抽象点

| 重复模式 | 出现页面 | 建议组件名 | 抽象收益 | 风险 |
|---|---|---|---|---|
| 页面标题块（rgba(21,27,61,0.8) 背景 + h1 + subtitle） | DataWorkshop, Upload, Visualization, SmartAnalysis | **PageHeader** | 统一标题层级、减少 4 处重复 inline style | 低：纯展示，无业务逻辑 |
| 统计卡片（icon + label + value + color） | Datasets, Dashboard, History, SmartAnalysis | **StatCard / MetricCard** | 统一 4 种变体，支持 color prop | 低：纯展示 |
| 数据表格（表头、行、边框、truncate、sticky） | Datasets(展开预览), DataWorkshop, AIWorkspace, History, Visualization, 详情 Dialog | **DataTable** | 统一 6 处表格样式，支持 `columns`, `data`, `maxRows`, `stickyHeader` | 中：需统一列渲染逻辑 |
| Empty State（icon + 文字 + 可选 action） | 所有页面 | **EmptyState** | 统一空状态视觉，支持 `icon`, `title`, `description`, `action` | 低：纯展示 |
| Loading State（spinner + 文字/进度条） | 所有页面 | **LoadingState** | 统一加载视觉，支持 `variant: spinner \| progress` | 低：纯展示 |
| Error State（icon + 文字 + 重试按钮） | Datasets, Dashboard, History, Visualization | **ErrorState** | 统一错误视觉和重试交互 | 低：纯展示 |
| Modal/Dialog（原生手写 fixed div） | DataWorkshop, History, Settings, Dashboard | **统一使用 shadcn Dialog** | 统一 4 种 modal 实现，解决 z-index、动画、聚焦管理问题 | 中：需替换现有事件绑定 |
| ECharts 颜色常量 | Dashboard, Visualization | **theme-colors.ts** | 消除重复 COLORS 定义，支持主题切换时图表跟随 | 中：需验证所有图表类型 |
| 下载/导出逻辑（Blob + URL.createObjectURL） | DataWorkshop, History, Dashboard, Visualization, Upload | **download-utils.ts** | 统一 5 处重复逻辑，支持 `downloadJson`, `downloadCsv`, `downloadExcel` | 低：纯工具函数 |
| 数据集选择器 | AIWorkspace(原生select), Visualization/SmartAnalysis(DatasetSelector) | **统一使用 DatasetSelector** | 统一选择体验，支持搜索 | 低：替换组件引用 |
| 页面布局壳（space-y-6 + padding） | 所有页面 | **PageShell** | 统一根容器 spacing、max-width、padding | 低：纯布局包裹 |
| 步骤/向导指示器 | SmartAnalysis | **StepIndicator** | 支持响应式和多种状态（待进行/进行中/已完成） | 低：纯展示 |
| 质量评分环形图 | Upload | **ScoreRing** | 复用于其他需要评分的场景 | 低：纯展示 |

---

## 输出 3：交互一致性问题

### 主按钮 / 次按钮位置
- **DataWorkshop**: "执行操作链"（主）在左侧面板底部，"保存为新数据集"（主）在其下方。两个主操作垂直堆叠，视觉上同等权重。
- **Visualization**: "保存到看板"和"下载图表"同用 `variant="outline"` 且并排，主次关系不清。
- **Datasets**: 批量操作工具栏在 CardHeader 右侧，位置合理但按钮大小（`h-7 px-2`）与页面其他按钮不一致。
- **建议**: 单页面只保留一个主按钮（实心 cyan），其余为次按钮（outline/ghost）。主按钮应位于用户操作流终点（如预览区右上角或底部居中）。

### 执行 / 保存 / 导出按钮逻辑
- **DataWorkshop**: `canSaveTransform` 判断条件复杂（6 个条件组合），用户难以直观理解为何按钮 disabled。虽有 `title` tooltip，但只在 hover 时显示。
- **Visualization**: "保存到看板" disabled 时无 tooltip 说明。
- **建议**: disabled 主按钮必须伴随 inline 文字提示或常驻 helper text，而非仅靠 hover tooltip。

### toast 使用
- 多数页面使用 `sonner` toast，但 **Datasets** 批量删除用 `confirm()`，重命名校验用 `alert()`。
- **建议**: 所有确认操作改用 shadcn `AlertDialog`（防误触且样式统一），轻量提示统一用 `sonner`。

### modal / drawer 使用
- **DataWorkshop**: 保存/加载操作链、数据集选择均用原生手写 `fixed inset-0` div，无焦点管理和 ESC 关闭。
- **Datasets 详情**: 使用 shadcn `Dialog` 但尺寸 `90vw × 90vh` 异常，违反 shadcn 设计规范。
- **History 详情 / Settings 清理确认**: 同样用原生手写 div。
- **建议**: 所有 modal 统一用 shadcn Dialog / AlertDialog / Sheet（移动端 drawer）。

### disabled 状态
- 各页面 disabled 样式不统一：有的用 `opacity-50`，有的用 `opacity-40 disabled:cursor-not-allowed`，有的无视觉反馈仅变灰。
- **建议**: 统一 disabled 规范——`opacity-50 cursor-not-allowed`，颜色降为 `bg-tertiary text-muted`。

### loading 状态
- **Dashboard**: 有 loading / loadingSlow 双状态，体验较好。
- **Datasets / History**: 仅用 `Loader2` spinner。
- **DataWorkshop**: 操作链执行时按钮内 spinner + 文字变化。
- **建议**: 统一使用 `LoadingState` 组件，支持 `spinner` / `skeleton` / `progress` 三种变体。

### 表单校验
- 几乎无系统化的表单校验。仅 SmartAnalysis 的 chainName 有非空检查。
- DataWorkshop 的操作配置（filter 条件、derive 公式等）无校验，用户可提交空值导致后端报错。
- **建议**: 逐步接入轻量校验（如 zod 或 inline 校验），在操作执行前校验配置合法性。

### 错误提示
- **inline 错误**: Datasets, Dashboard, History 在页面中心显示错误 icon + 文字 + 重试按钮。
- **toast 错误**: DataWorkshop, Visualization, Upload 用 `toast.error()`。
- **alert 错误**: Datasets 重命名失败用 `alert()`。
- **建议**: 页面级错误（如加载失败）用 `ErrorState` 组件；操作级错误（如保存失败）用 `toast.error`；严禁使用 `alert()`。

### 结果为空时的 empty state
- 各页面 empty state 风格差异大：有的用图标+文字（DataWorkshop），有的用卡片内居中（Visualization），有的列表内文字（Datasets 表格）。
- **建议**: 统一 `EmptyState` 组件，支持插图 icon、标题、描述、操作按钮四个要素。

---

## 输出 4：视觉层级问题

### 标题层级
- **页面主标题**: 大部分用 `h1.text-heading-1`，但 DataWorkshop/Upload/Visualization/SmartAnalysis 使用 inline style 背景块（`rgba(21, 27, 61, 0.8)`），与其他页面不一致。
- **卡片标题**: 统一用 `CardTitle text-lg`，但额外加 `flex items-center gap-2` 的页面越来越多，形成重复模式。
- **建议**: 建立三级标题规范——`PageTitle`（页面级）、`SectionTitle`（区块级，带 icon）、`CardTitle`（卡片级）。

### 页面宽度
- **Settings**: `max-w-6xl mx-auto`，两侧大量留白。
- **其他页面**: 无宽度限制，随 sidebar 自适应。
- **AIWorkspace**: 全屏 modal（95vw），不受 sidebar 影响。
- **建议**: 统一全站宽度策略——内容页全宽（`flex-1`），设置/表单类页面可限制 `max-w-5xl` 但需全局一致。

### spacing
- 根容器统一用 `<div className="space-y-6">`，但内部嵌套层级不同导致实际间距不一致。
- **Dashboard** Overview 区块间 `gap-4` / `gap-6` 混用；**Datasets** 统计卡片与搜索栏间无明确节奏。
- **建议**: 制定 spacing token——页面级 `space-y-6`（24px），卡片内 `space-y-4`（16px），紧凑区 `space-y-2`（8px）。

### card 密度
- **Datasets** 表格 `py-4 px-4`，行高较大，50 行数据需滚动 2 屏以上。
- **DataWorkshop** 操作配置项 `space-y-2`，密度紧凑。
- **History** 统计卡片 `p-4`，Dashboard 统计卡片 `p-6`。
- **建议**: 表格行统一 `py-3 px-3`；统计卡片统一 `p-4`；信息卡片 `p-4`/`p-6` 按内容量区分。

### 表格可读性
- **边框**: DataWorkshop 表格有 `border-b`，Datasets 展开预览有 `border-b`，AIWorkspace 预览也有 `border-b`，但颜色和透明度不同。
- **表头**: 有的 `bg-[var(--bg-secondary)]`，有的透明+`sticky top-0`。
- **字体**: DataWorkshop 用 `text-xs`，Datasets 用 `text-sm`（表头）+ 默认（内容），History 用 `text-xs`。
- **建议**: 统一表格规范——表头 `bg-secondary text-muted text-xs font-medium`，行 `border-b border-subtle/50`，内容 `text-sm`，紧凑场景 `text-xs`。

### 图表展示区域
- **Dashboard Overview**: `h-64`（256px）。
- **Visualization**: `h-96`（384px）。
- **AIWorkspace 结果面板**: 固定高度 45%。
- **Dashboard Custom**: mixed 布局下硬编码 320px/200px。
- **建议**: 制定图表容器尺寸规范——概览页 `h-64`，分析页 `h-80` 或 `h-96`，结果面板最小 `h-64` 且支持用户拖拽。

### 侧边栏 / 主内容区比例
- **AppLayout**: sidebar `w-64`，main `flex-1 p-6`。
- **DataWorkshop**: `lg:grid-cols-3`（左 1 右 2）。
- **Visualization**: `lg:grid-cols-4`（左 1 右 3）。
- **SmartAnalysis**: `lg:grid-cols-3`（左 1 右 2）。
- 比例尚可，但 sidebar `w-64` 在 `lg`（1024px）屏幕下，主内容区仅剩约 700px，表格易溢出。
- **建议**: 考虑 collapsible sidebar（icon-only 模式），在 `xl` 以下自动收缩为 `w-16`。

### 移动端 / 窄屏兼容性
- **AppSidebar**: 无移动端折叠/隐藏，小屏下 sidebar 占死 256px，主内容区被严重挤压。
- **SmartAnalysis 步骤指示器**: 5 个步骤水平排列，在 `md` 以下必然溢出。
- **DataWorkshop**: `lg:grid-cols-3` 在 `md` 下变单栏，但操作链面板高度可能挤压预览区。
- **表格**: 所有表格均用 `overflow-x-auto` 包裹，但无滚动提示（如阴影或滚动条样式）。
- **建议**:
  - Sidebar 增加移动端 hamburger 菜单（`md` 以下隐藏，点击展开 overlay）。
  - 步骤指示器小屏改为垂直或数字简版。
  - 表格容器增加 `scrollbar-thin` 和右侧滚动阴影提示。

---

## 输出 5：建议的前端重构路线

### Phase 4A-1: Design System 文档

**目标**: 建立前端设计系统的文档规范，作为后续重构的基准。

**涉及文件**:
- 新增 `app/src/styles/design-tokens.ts`（或 CSS 变量扩展）
- 新增 `docs/design-system.md`

**内容**:
1. **Color Tokens**: 整理现有 CSS 变量（`--neon-cyan`, `--bg-primary` 等），明确使用场景。
2. **Typography**: 定义 `PageTitle`, `SectionTitle`, `CardTitle`, `Body`, `Caption` 五级文字规范。
3. **Spacing Tokens**: `space-4` (16px), `space-6` (24px), `space-8` (32px) 的使用场景。
4. **Component Patterns**: Button 主次规范、Disabled 规范、Loading 规范、Error 规范。
5. **Layout**: 页面最大宽度策略、Sidebar 响应式规则、内容区 padding。

**是否影响业务逻辑**: 否。

**验收标准**:
- [ ] 文档包含完整的 Color / Typography / Spacing / Component / Layout 五章
- [ ] 所有现有页面中的颜色使用都能映射到文档中的 token
- [ ] 团队成员无需看代码即可知道新增页面该用什么样式

---

### Phase 4A-2: 公共组件抽取

**目标**: 从现有页面中提取高频重复模式，建立共享组件层。

**涉及文件**:
- 新增 `app/src/components/layout/PageShell.tsx`
- 新增 `app/src/components/layout/PageHeader.tsx`
- 新增 `app/src/components/display/StatCard.tsx`
- 新增 `app/src/components/display/EmptyState.tsx`
- 新增 `app/src/components/display/LoadingState.tsx`
- 新增 `app/src/components/display/ErrorState.tsx`
- 新增 `app/src/components/data/DataTable.tsx`
- 新增 `app/src/components/data/ScoreRing.tsx`
- 新增 `app/src/components/navigation/StepIndicator.tsx`
- 新增 `app/src/utils/download-utils.ts`
- 新增 `app/src/utils/theme-colors.ts`

**是否影响业务逻辑**: 否（仅样式和结构封装，props 透传业务数据）。

**验收标准**:
- [ ] PageShell 包裹所有页面，统一 `space-y-6 p-6`
- [ ] PageHeader 替换 4 个页面的 inline style 标题块
- [ ] StatCard 替换 Datasets/Dashboard/History/SmartAnalysis 的统计卡片实现
- [ ] EmptyState / LoadingState / ErrorState 在各页面至少使用一次
- [ ] DataTable 统一 Datasets/AIWorkspace/History 的表格渲染
- [ ] download-utils 替换所有 `Blob + URL.createObjectURL` 重复逻辑
- [ ] theme-colors 替换 Dashboard 和 Visualization 的硬编码 COLORS

---

### Phase 4A-3: DataWorkshop 页面重构

**目标**: 解决 DataWorkshop 体积过大、内联组件过多、信息层级混乱的问题。

**涉及文件**:
- `app/src/pages/DataWorkshop.tsx`（大幅精简到 ~400 行）
- 新增 `app/src/components/workshop/OperationChain.tsx`
- 新增 `app/src/components/workshop/OperationConfigPanel.tsx`
- 新增 `app/src/components/workshop/OperationConfigForms/`（各操作类型的配置表单）
- 新增 `app/src/components/workshop/PreviewPanel.tsx`
- 新增 `app/src/components/workshop/DataSourcePanel.tsx`

**是否影响业务逻辑**: **否**。所有 state、API 调用逻辑保留在原页面，仅 UI 结构和子组件拆分。

**验收标准**:
- [ ] DataWorkshop.tsx 行数 < 500 行
- [ ] 所有内联组件（JoinConfigPanel 等）迁移到独立文件
- [ ] 操作类型按"常用（filter/transform/dedup）"和"高级（join/pivot/reshape）"分组展示
- [ ] 实验性提示 banner 文案更新，移除"浏览器临时处理"描述
- [ ] 预览表格使用 DataTable 组件，支持 sticky header
- [ ] 保存/加载操作链的 modal 改用 shadcn Dialog

---

### Phase 4A-4: AIWorkspace 页面重构

**目标**: 优化 AIWorkspace 的布局灵活性、数据集选择体验和结果展示。

**涉及文件**:
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/AnalysisResultRenderer.tsx`（已有，可能需扩展）

**是否影响业务逻辑**: 否。

**验收标准**:
- [ ] 数据集选择从原生 `<select>` 改为 `DatasetSelector` 组件
- [ ] 数据预览表格使用 DataTable，加横向滚动和 `truncate`
- [ ] 分析结果面板支持用户拖拽调整高度（或提供折叠/展开 toggle）
- [ ] 增加空对话时的欢迎引导卡片（展示能力示例）
- [ ] 消息气泡增加复制按钮

---

### Phase 4A-5: Datasets 页面重构

**目标**: 统一 Datasets 的视觉风格、优化信息密度、移除冗余功能。

**涉及文件**:
- `app/src/pages/Datasets.tsx`
- `app/src/components/data/DataTable.tsx`（复用）

**是否影响业务逻辑**: 否。

**验收标准**:
- [ ] 页面标题改为中文"数据集"
- [ ] 表格行高从 `py-4` 调整为 `py-3`，提升信息密度
- [ ] 展开行预览使用 DataTable 组件
- [ ] 详情 Dialog 尺寸改为 `max-w-4xl max-h-[80vh]` 或改用 Sheet（侧边 drawer）
- [ ] 底部上传区域改为"去上传页"快捷入口按钮，移除重复上传区
- [ ] 批量删除的 `confirm()` 改为 shadcn AlertDialog
- [ ] 重命名失败的 `alert()` 改为 `toast.error`

---

### Phase 4A-6: Dashboard / Visualization / History / Settings 重构

**目标**: 收尾其他页面的视觉和交互一致性。

**涉及文件**:
- `app/src/pages/Dashboard.tsx`
- `app/src/pages/Visualization.tsx`
- `app/src/pages/History.tsx`
- `app/src/pages/Settings.tsx`
- `app/src/pages/Upload.tsx`
- `app/src/pages/SmartAnalysis.tsx`

**是否影响业务逻辑**: 否。

**各页面验收标准**:

**Dashboard**:
- [ ] Overview/Custom tabs 样式统一为底部边框样式（与 AIWorkspace 一致）
- [ ] ECharts 颜色从硬编码改为 theme-colors.ts
- [ ] 空看板增加 EmptyState 组件（插图 + 引导按钮）

**Visualization**:
- [ ] "保存到看板"改为主按钮（实心 cyan），"下载图表"改为次按钮（outline）
- [ ] 图表类型选择网格窄屏改为 2 列
- [ ] 图表容器高度改为响应式（`min-h-80` 或 `aspect-video`）

**History**:
- [ ] 页面标题改为中文"历史记录"
- [ ] 下载格式菜单从 `group-hover` 改为 click 触发 DropdownMenu
- [ ] 详情弹窗内容分 tab（AI 解读 / 建议 / 结果数据 / 参数）
- [ ] 结果预览增加"仅显示前 10 行 / 前 5 列"提示

**Settings**:
- [ ] 移除 `max-w-6xl` 限制，与其他页面一致
- [ ] 自定义 toggle div 全部替换为 shadcn Switch
- [ ] 语言设置改为紧凑网格（2 列卡片）
- [ ] 清理数据确认弹窗改用 shadcn AlertDialog

**Upload**:
- [ ] 拖拽区域动画简化为脉冲或边框高亮，移除 spin
- [ ] 上传完成后提供"清除已完成"按钮
- [ ] 质量分数环形图替换为 ScoreRing 组件
- [ ] 字段分析列表支持折叠/展开

**SmartAnalysis**:
- [ ] 步骤指示器支持响应式（小屏垂直或数字简版）
- [ ] 诊断结果的问题列表和建议操作分开展示（不同 card）
- [ ] 分析结果展示逻辑提取为独立组件 `AnalysisResultPanel`

---

## 附录：审阅范围说明

本次审阅严格遵循"不改业务代码"原则：
- 未修改任何 `.tsx` 文件
- 未新增功能
- 未接入 Hermes 或新 ECharts 功能
- 未修改后端
- 未改变 DataWorkshop preview/save 主链路

所有结论基于代码静态分析，部分交互问题（如移动端实际表现）建议在后续重构中结合浏览器 DevTools 验证。
