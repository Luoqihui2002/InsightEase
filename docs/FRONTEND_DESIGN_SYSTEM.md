# InsightEase Frontend Design System & Refactor Specification

**版本**: 2026-04-28  
**范围**: Phase 4A (Engineering Stabilization) — UI/UX 一致性治理  
**约束**: 本阶段只写文档，不改代码。所有规范必须基于现有 shadcn/ui 基座与已验证的 CSS token 体系。

---

## 1. Design Principles

### 1.1 核心原则

| 原则 | 说明 |
|---|---|
| **shadcn First** | 所有交互组件优先使用已安装的 shadcn 基元（Button, Card, Table, Dialog, AlertDialog, Sheet, Switch, Sonner, Empty, Spinner）。手写 `div` 模拟按钮/表格/弹窗属于违规。 |
| **Token Driven** | 主题色、背景色、文字色、边框色必须使用 `index.css` 中的 CSS 变量；error / success / warning 等状态色可暂时使用 Tailwind semantic colors（如 `text-red-400`、`bg-emerald-500/5`），后续如需统一再抽 status tokens。间距、圆角必须引用 Tailwind 标准 token，禁止硬编码 magic number。 |
| **Glassmorphism is Reserved** | Dialog、Sheet、floating panels、AI assistant panel 以及需要突出层级的 important cards 使用 `.glass-kimi` 风格（`bg-[rgba(21,27,61,0.85)] backdrop-blur-[24px] saturate-[180%]`）。普通 SectionCard、DataTable、列表页卡片默认使用 `bg-[var(--bg-secondary)]`，禁止全站卡片强制毛玻璃。 |
| **Neon Accent Discipline** | 强调色仅使用 `--neon-cyan`（主操作/高亮）与 `--neon-purple`（次要高亮/AI 相关），禁止引入新的霓虹色。 |
| **Backend-Only Data** | 前端可在 React state 中持有 API 返回的数据用于展示，但禁止将正式业务数据、数据集内容、分析结果、transform 结果持久化到 IndexedDB / localStorage。localStorage 仅允许保存 UI preferences（主题、折叠面板、当前 tab 等）。 |

### 1.2 主题体系

系统已存在三套主题，通过 `useTheme.ts`（Zustand）切换：

| 主题 | class | 关键变量差异 |
|---|---|---|
| Cyberpunk | `.cyberpunk` | `--neon-cyan: #00f5ff`, `--bg-primary: #0a0e27` |
| Matrix | `.matrix` | 绿色系霓虹，深色背景 |
| Sunset | `.sunset` | 橙红色系霓虹，暖色背景 |

所有自定义组件必须响应 `document.documentElement` 的 class 变化，即使用 CSS variable 而非固定颜色。

### 1.3 文件组织约定

```
app/src/
  components/
    ui/              # shadcn 基元（禁止修改其 API 签名）
    layout/          # 页面级布局壳（PageShell, PageHeader, SidePanel 等）
    data-display/    # 数据展示组件（DataTablePreview, StatCard, ChartCard）
    feedback/        # 状态反馈组件（EmptyState, LoadingState, ErrorState）
  hooks/
    useTheme.ts      # 已有，继续复用
  lib/
    utils.ts         # cn() 等工具
```

---

## 2. Layout System

### 2.1 PageShell

**用途**: 统一所有页面的外骨架，消除页面间 `px-6 py-4` / `p-8` 不一致。

```tsx
// 规范接口
interface PageShellProps {
  children: React.ReactNode;
  className?: string;      // 仅用于极特殊的背景覆盖
  maxWidth?: "default" | "full" | "narrow";  // default=6xl, full=无限制, narrow=4xl
}

// 默认样式
<div className={cn(
  "flex min-h-0 flex-1 flex-col gap-6 p-6",
  maxWidth === "default" && "mx-auto max-w-7xl",
  maxWidth === "narrow" && "mx-auto max-w-4xl",
  className
)}>
```

**现有问题**: Settings 用 `max-w-6xl`，Upload 用 `max-w-7xl`，Dashboard 无限制。统一为 `max-w-7xl`（`"default"`）。

### 2.2 PageHeader

**用途**: 页面标题区，统一标题、副标题、右上角操作区。

```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;    // 右上角按钮组
  className?: string;
}

// 默认结构
<div className="flex flex-col gap-1">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
    <div className="flex items-center gap-2">{actions}</div>
  </div>
  {subtitle && <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>}
</div>
```

**现有问题**: Datasets/History 标题是英文，Upload 有副标题但 others 没有，AIWorkspace 标题区混着数据集选择器。统一后，标题区只负责标题和全局操作（如"新建"、"刷新"）。

### 2.3 PageToolbar

**用途**: 工具栏区域，如 DataWorkshop 的操作链、Dashboard 的图表类型选择。

```tsx
interface PageToolbarProps {
  children: React.ReactNode;
  sticky?: boolean;
}

// 默认样式
<div className={cn(
  "flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
  sticky && "sticky top-0 z-10"
)}>
```

### 2.4 ContentGrid

**用途**: 卡片/面板的两列、三列布局。

```tsx
interface ContentGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";   // sm=4, md=6, lg=8
}

// 默认样式
<div className={cn(
  "grid",
  cols === 1 && "grid-cols-1",
  cols === 2 && "grid-cols-1 md:grid-cols-2",
  cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  cols === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  gap === "sm" && "gap-4",
  gap === "md" && "gap-6",
  gap === "lg" && "gap-8",
)}>
```

**现有问题**: Dashboard 卡片手写 `grid-cols-3`，Settings 手写 `grid-cols-2`，AIWorkspace 左右面板手写 `flex w-[55%]`。统一为 ContentGrid + SidePanel。

### 2.5 SidePanel

**用途**: 左右分栏布局的侧边面板（如 AIWorkspace 左侧面板）。

```tsx
interface SidePanelProps {
  children: React.ReactNode;
  width?: "narrow" | "default" | "wide";  // narrow=320px, default=384px, wide=480px
  className?: string;
}

// 默认样式
<div className={cn(
  "flex flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
  width === "narrow" && "w-80 min-w-[320px]",
  width === "default" && "w-96 min-w-[384px]",
  width === "wide" && "w-[480px] min-w-[480px]",
  className
)}>
```

**现有问题**: AIWorkspace 左侧写死 `w-[55%]`，Visualization 的图表配置区无统一宽度。改用 SidePanel 后，右侧 ResultPanel 自动 `flex-1`。

### 2.6 ResultPanel

**用途**: 展示分析结果、图表、表格的主内容区。

```tsx
interface ResultPanelProps {
  children: React.ReactNode;
  className?: string;
}

// 默认样式
<div className={cn(
  "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
  className
)}>
```

**现有问题**: AIWorkspace 右侧写死 `w-[45%]`，Dashboard 图表区无统一容器。ResultPanel 与 SidePanel 组合使用，形成 `flex gap-6` 的左右布局。

### 2.7 SectionCard

**用途**: 页面内子模块的卡片容器（如 Settings 的各设置区块）。

```tsx
interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

// 默认样式（基于 shadcn Card）
<Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)]", className)}>
  {(title || description) && (
    <CardHeader>
      {title && <CardTitle className="text-lg">{title}</CardTitle>}
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
  )}
  <CardContent>{children}</CardContent>
</Card>
```

**现有问题**: Settings 各区块手写 `rounded-xl border...`，Dashboard 卡片手写类似样式。全部替换为 SectionCard。

---

## 3. State Components (Feedback)

### 3.1 EmptyState

**基座**: `components/ui/empty.tsx`（已存在）。

**规范**:
- 直接使用 `<Empty>` 组合，禁止手写 `flex justify-center text-gray-500` 的空状态。
- 图标使用 `lucide-react`，颜色 `text-[var(--text-muted)]`。
- 标题 `text-base font-medium text-[var(--text-primary)]`。
- 描述 `text-sm text-[var(--text-secondary)]`。
- 如有操作按钮，使用 shadcn Button `variant="outline"`。

**现有问题**: DataWorkshop 有内联 Empty，Datasets 可能缺失空状态，SmartAnalysis 结果为空时手写 div。统一为 Empty。

### 3.2 LoadingState

**用途**: 页面级或卡片级加载状态。

```tsx
interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";   // sm=16px, md=24px, lg=32px
  className?: string;
}

// 默认结构（基于 shadcn Spinner）
<div className={cn("flex flex-col items-center justify-center gap-3", className)}>
  <Spinner size={size} />
  {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
</div>
```

**现有问题**: DataWorkshop 手写 `animate-spin` + 文字，AIWorkspace 手写加载动画。统一为 LoadingState。

### 3.3 ErrorState

**用途**: API 失败或业务错误的展示。

```tsx
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

// 默认结构
<div className={cn(
  "flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center",
  className
)}>
  <AlertTriangle className="h-8 w-8 text-red-400" />
  {title && <h3 className="text-base font-medium text-red-300">{title}</h3>}
  <p className="text-sm text-[var(--text-secondary)]">{message}</p>
  {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>重试</Button>}
</div>
```

**现有问题**: 各页面错误状态不统一，有的用 toast，有的内联红字，有的仅 console.error。规范：页面级错误用 ErrorState，全局错误用 Sonner toast。

### 3.4 SuccessState

**用途**: 操作成功的短暂提示或结果页。

```tsx
interface SuccessStateProps {
  title?: string;
  message?: string;
  actions?: React.ReactNode;
  className?: string;
}

// 默认结构（仅用于结果页，短暂提示用 Sonner）
<div className={cn(
  "flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center",
  className
)}>
  <CheckCircle className="h-8 w-8 text-emerald-400" />
  {title && <h3 className="text-base font-medium text-emerald-300">{title}</h3>}
  {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
  {actions && <div className="flex gap-2">{actions}</div>}
</div>
```

---

## 4. Data Display Components

### 4.1 DataTablePreview

**用途**: 数据集预览表格（DataWorkshop preview, Datasets 预览, AIWorkspace 数据预览）。

**基座**: `components/ui/table.tsx`（已存在）。

```tsx
interface DataTablePreviewProps {
  data: Record<string, unknown>[];
  columns: string[];
  maxRows?: number;         // 默认 100
  maxHeight?: string;       // 默认 "400px"
  className?: string;
}

// 默认结构
<div className={cn("overflow-auto rounded-lg border border-[var(--border-subtle)]", className)} style={{ maxHeight }}>
  <Table>
    <TableHeader>
      <TableRow className="bg-[var(--bg-tertiary)]">
        {columns.map(col => (
          <TableHead key={col} className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
            {col}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.slice(0, maxRows).map((row, i) => (
        <TableRow key={i} className="hover:bg-[var(--bg-tertiary)]/50">
          {columns.map(col => (
            <TableCell key={col} className="text-sm text-[var(--text-primary)] whitespace-nowrap">
              {String(row[col] ?? "")}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

**现有问题**: DataWorkshop 手写 `<table>`，Datasets 预览手写 `<table>`，AIWorkspace 手写 `<table>`。全部替换为 DataTablePreview。

### 4.2 StatCard / MetricCard

**用途**: 展示关键指标（Dashboard KPI, SmartAnalysis 统计摘要）。

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; positive: boolean };  // 可选趋势
  icon?: React.ReactNode;
  className?: string;
}

// 默认结构
<Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)]", className)}>
  <CardContent className="flex items-center justify-between p-6">
    <div className="flex flex-col gap-1">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      {trend && (
        <div className={cn("flex items-center gap-1 text-xs", trend.positive ? "text-emerald-400" : "text-red-400")}>
          {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
  </CardContent>
</Card>
```

**现有问题**: Dashboard KPI 手写 div，SmartAnalysis 摘要手写 div。统一为 StatCard。

### 4.3 ChartCard

**用途**: 统一图表容器（ECharts 实例的外壳）。

```tsx
interface ChartCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;   // 下载、刷新等
  children: React.ReactNode;   // ECharts React 组件
  className?: string;
  height?: string;             // 默认 "h-96"
}

// 默认结构
<Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)] overflow-hidden", className)}>
  {(title || actions) && (
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div>
        {title && <CardTitle className="text-base">{title}</CardTitle>}
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </CardHeader>
  )}
  <CardContent className={cn("p-0", height)}>
    {children}
  </CardContent>
</Card>
```

**现有问题**: Dashboard 图表硬编码颜色、无统一外壳、高度 `h-96` 写死在各处。ChartCard 统一外壳，图表内部仍通过 ECharts option 配置（但颜色应读 CSS variable，通过 `getComputedStyle` 动态获取）。

### 4.4 ScoreRing

**用途**: Upload 页的质量评分环。

**现状**: 已有一个手写 SVG 的 ScoreRing，带 `animate-spin` 的渐变动效。

**规范**:
- 保留当前 SVG 实现，但将颜色提取为 CSS variable：`--score-ring-start`, `--score-ring-end`。
- 移除 `animate-spin`（它让渐变环旋转，但看起来像加载中，造成歧义）。
- 分数文字使用 `text-[var(--text-primary)]`。
- 尺寸通过 prop `size?: "sm" | "md" | "lg"` 控制（sm=80, md=120, lg=160）。

```tsx
interface ScoreRingProps {
  score: number;       // 0-100
  size?: "sm" | "md" | "lg";
  className?: string;
}
```

---

## 5. Interaction Rules

### 5.1 按钮层级

| 场景 | 组件 | 变体 | 示例 |
|---|---|---|---|
| 页面主要操作 | Button | `variant="default"`（neon cyan 背景） | "执行分析", "保存" |
| 次要/取消 | Button | `variant="outline"` | "取消", "重置" |
| 危险操作 | Button | `variant="destructive"` | "删除", "清空" |
| 文字链接 | Button | `variant="link"` | "查看详情", "了解更多" |
| 图标按钮 | Button | `variant="ghost"`, `size="icon"` | 表格行内操作、关闭按钮 |

**禁止**: 手写 `<div onClick={...} className="cursor-pointer bg-cyan-500...">` 作为按钮。

### 5.2 禁用状态可见性

规则: **禁用按钮必须可见**，不可因 `disabled` 而完全隐藏。如果某个操作在当前状态下不可用，显示为 disabled 状态并附带 `title` 提示原因。

```tsx
// Good
<Button disabled={!canExecute} title={!canExecute ? "请先选择数据集" : ""}>
  执行
</Button>

// Bad
{canExecute && <Button>执行</Button>}
```

### 5.3 弹窗统一

| 场景 | 组件 | 说明 |
|---|---|---|
| 信息确认（可取消） | Dialog | 基于已定制的 `dialog.tsx`（glassmorphism） |
| 危险操作确认 | AlertDialog | 基于已定制的 `alert-dialog.tsx` |
| 侧滑抽屉 | Sheet | 用于筛选面板、详情面板 |
| 全局通知 | Sonner | `toast.success()`, `toast.error()` |

**禁止**: 手写 `fixed inset-0 bg-black/50 flex items-center justify-center` 作为弹窗。

**现有问题**: Datasets 删除确认手写 div，DataWorkshop 某些提示手写 div，SmartAnalysis 结果导出手写 div。全部替换。

### 5.4 表单输入

| 场景 | 组件 | 说明 |
|---|---|---|
| 文本输入 | Input | shadcn Input，背景 `bg-[var(--bg-tertiary)]` |
| 下拉选择 | Select | shadcn Select（已安装），禁止原生 `<select>` |
| 开关 | Switch | shadcn Switch，替代 Settings 中的手写 toggle |
| 文本域 | Textarea | shadcn Textarea |
| 标签组 | ToggleGroup | shadcn ToggleGroup（Dashboard 图表类型、AIWorkspace 分析类型） |

**现有问题**: AIWorkspace 数据集选择用原生 `<select>`，Settings 用自定义 toggle 而非 Switch。全部替换。

### 5.5 加载与反馈

| 场景 | 方式 | 说明 |
|---|---|---|
| 页面初始化 | LoadingState | 居中全屏/全卡片 |
| 按钮内加载 | Button + Spinner | `disabled` + 左侧 `<Spinner size="sm" />` |
| 后台任务 | Sonner toast | "分析任务已创建，正在执行..." |
| 操作成功 | Sonner toast | `toast.success("保存成功")` |
| 操作失败 | Sonner toast + ErrorState | 全局 toast + 页面级 ErrorState |

### 5.6 数据操作确认

所有破坏性操作（删除数据集、清空操作链、覆盖保存）必须二次确认：

```tsx
// 使用 AlertDialog
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">删除</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除</AlertDialogTitle>
      <AlertDialogDescription>此操作不可撤销，数据集及其所有分析历史将被永久删除。</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>确认删除</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**现有问题**: Datasets 用浏览器原生 `confirm()`，必须替换为 AlertDialog。

---

## 6. Typography / Spacing / Density

### 6.1 字体层级

| 层级 | 类名 | 用途 |
|---|---|---|
| Display | `text-3xl font-bold tracking-tight` | 首页大标题（仅营销页，内部不用） |
| H1 | `text-2xl font-bold tracking-tight` | PageHeader title |
| H2 | `text-xl font-semibold` | SectionCard title, Dialog title |
| H3 | `text-lg font-medium` | 子模块标题 |
| Body | `text-sm text-[var(--text-primary)]` | 正文、表格内容 |
| Caption | `text-xs text-[var(--text-muted)]` | 辅助说明、时间戳、文件大小 |
| Label | `text-sm font-medium text-[var(--text-secondary)]` | 表单标签 |

**现有问题**: Dashboard 图表标题大小不一，DataWorkshop 操作链标签字号不统一。按上表治理。

### 6.2 间距体系

| Token | 值 | 用途 |
|---|---|---|
| `space-1` | 4px | 图标与文字间隙、紧凑内联 |
| `space-2` | 8px | 按钮内 gap、表格 cell padding |
| `space-3` | 12px | 表单元素 gap |
| `space-4` | 16px | Card padding 默认、卡片间 gap |
| `space-6` | 24px | PageShell padding、SectionCard 间 gap |
| `space-8` | 32px | 大模块间分隔 |

**现有问题**: 页面 padding 在 `p-4` / `p-6` / `p-8` 之间乱跳。统一页面级 `p-6`，卡片级 `p-4` 或 `p-6`。

### 6.3 密度模式

当前系统只有一种密度（紧凑），未来如需引入：

- **Comfortable**: Card padding `p-6`, Table row height `h-14`
- **Compact**: Card padding `p-4`, Table row height `h-10`

当前统一按 **Compact** 执行（现有页面大多如此）。

### 6.4 圆角与边框

| 元素 | 圆角 | 边框 |
|---|---|---|
| 页面级卡片 | `rounded-xl` (12px) | `border border-[var(--border-subtle)]` |
| 表格 | `rounded-lg` (8px) | 外框 `border`，行内无竖线 |
| 按钮 | `rounded-md` (6px) | 根据 variant |
| 弹窗 | `rounded-xl` | `border` + glassmorphism |
| 输入框 | `rounded-md` | `border` focus 时 `ring-2 ring-[var(--neon-cyan)]/50` |

---

## 7. Phase 4A Implementation Plan

Phase 4A 共分 6 个子阶段执行。每个子阶段独立可 review，不跨阶段混做。

### 7.1 4A-2: Low-risk Shared Components（纯新增，无页面改动）

**目标**: 建立组件层基座，所有后续阶段依赖这些组件。

**产出文件**:
```
app/src/components/layout/
  PageShell.tsx
  PageHeader.tsx
  PageToolbar.tsx
  ContentGrid.tsx
  SidePanel.tsx
  ResultPanel.tsx
  SectionCard.tsx

app/src/components/feedback/
  LoadingState.tsx
  ErrorState.tsx
  SuccessState.tsx

app/src/components/data-display/
  DataTablePreview.tsx
  StatCard.tsx
  ChartCard.tsx
```

**约束**:
- 纯新增组件，不修改任何 page 文件。
- 不新增业务逻辑；组件只负责渲染，数据通过 props 注入。
- 不强制全局 barrel export（`index.ts`），页面按需 import 具体文件即可。
- 每个组件必须导出 TypeScript interface（命名：`{ComponentName}Props`）。
- 不引入新的 npm 依赖（仅用已安装的 shadcn + lucide）。
- 完成后必须运行 `npx tsc --noEmit`（0 errors）与 `npm run build`（成功）。

### 7.2 4A-3: Page Layout Refactor（替换页面骨架）

**目标**: 所有页面统一使用 PageShell + PageHeader + ContentGrid。

**涉及页面**:
- `Upload.tsx` — 替换 `max-w-7xl` 为 PageShell，提取 PageHeader
- `Datasets.tsx` — 替换英文标题，引入 PageHeader + ContentGrid（数据集卡片网格）
- `DataWorkshop.tsx` — 引入 PageShell + PageHeader + PageToolbar
- `AIWorkspace.tsx` — 引入 PageShell + SidePanel + ResultPanel
- `Dashboard.tsx` — 引入 PageShell + ContentGrid + ChartCard
- `Visualization.tsx` — 引入 PageShell + SidePanel + ResultPanel
- `Settings.tsx` — 引入 PageShell + SectionCard + ContentGrid(cols=2)
- `History.tsx` — 引入 PageShell + PageHeader
- `SmartAnalysis.tsx` — 引入 PageShell + ContentGrid + StatCard

**约束**:
- 仅做布局骨架替换，不改动业务逻辑。
- 每个页面单独 commit，方便 review。

### 7.3 4A-4: Table & Modal Unification（表格与弹窗统一）

**目标**: 消灭手写 `<table>` 和手写 `fixed inset-0` 弹窗。

**涉及**:
- DataWorkshop preview 表格 → DataTablePreview
- Datasets 预览 modal → Dialog + DataTablePreview
- AIWorkspace 数据预览 → DataTablePreview
- Dashboard/Visualization 图表区 → ChartCard
- Upload ScoreRing → 提取为独立组件（保留现有 SVG 逻辑，仅抽文件）
- Datasets 删除确认 → AlertDialog
- SmartAnalysis 结果导出 → Dialog
- DataWorkshop 提示弹窗 → Dialog / Sonner

**约束**:
- 表格统一后必须保持横向滚动（`overflow-x-auto`）。
- Dialog 必须使用已有的 glassmorphism 样式。

### 7.4 4A-5: Component Polish & Consistency（交互一致性治理）

**目标**: 按钮、输入、开关、选择器全部使用 shadcn 基元。

**涉及**:
- AIWorkspace 数据集 `<select>` → shadcn Select
- Settings 自定义 toggle → shadcn Switch
- DataWorkshop 操作链按钮 → Button (default/outline/destructive)
- Dashboard tab 切换 → shadcn ToggleGroup 或 Tab
- 所有 `confirm()` / `alert()` → AlertDialog / Sonner
- 所有 `disabled` 按钮可见性检查
- 各页面空状态 → EmptyState / ErrorState / LoadingState

**约束**:
- 不改动组件 API，仅替换内部实现。
- 保持现有 onClick handler 不变。

### 7.5 4A-6: Typography & Token Cleanup（字体与 Token 治理）

**目标**: 消除硬编码颜色与字号，统一使用 CSS variable。

**涉及**:
- 全局搜索 `#00f5ff`, `#0a0e27`, `#151b3d` 等硬编码色值 → 替换为 `var(--neon-cyan)`, `var(--bg-primary)` 等
- 全局搜索 `text-gray-400`, `text-gray-500`, `text-gray-600` → 替换为 `var(--text-secondary)` / `var(--text-muted)`
- 全局搜索 `bg-gray-800`, `bg-gray-900` → 替换为 `var(--bg-secondary)` / `var(--bg-primary)`
- 统一各页面 padding 为 `p-6`（PageShell 已做，本阶段清理残余）
- 统一 card padding 为 `p-4` 或 `p-6`
- Dashboard ECharts 硬编码颜色 → 通过 `getComputedStyle(document.documentElement).getPropertyValue('--neon-cyan')` 动态获取

**约束**:
- 纯样式替换，不改动 DOM 结构。
- 必须验证 `npm run build` 通过。

---

## 8. Guardrails

### 8.1 绝对禁止

| 禁止项 | 原因 | 替代方案 |
|---|---|---|
| 手写 `<div onClick>` 模拟按钮 | 无 focus 状态、无 keyboard 支持、无 disabled 样式 | shadcn Button |
| 手写 `<table>` | 无统一滚动、hover、空状态 | shadcn Table / DataTablePreview |
| 手写 `fixed inset-0` 弹窗 | 无动画、无 ESC 关闭、无焦点管理 | shadcn Dialog / AlertDialog |
| 原生 `<select>` | 样式不可控 | shadcn Select |
| 原生 `confirm()` / `alert()` | 阻塞主线程、无法定制样式 | AlertDialog / Sonner |
| 引入新 npm UI 库 | 与现有 shadcn 冲突、增加包体积 | 基于 shadcn 组合 |
| 新增 CSS 变量（非全局） | token 碎片化 | 复用 `index.css` 已有变量 |
| 修改 shadcn 基元 API | 破坏自动生成与升级 | 通过 wrapper 组件扩展 |
| 在组件里写业务逻辑 | 耦合 | 组件只负责渲染，逻辑留在 page/hook |

### 8.2 Build Gate

每个子阶段完成后必须执行：

```bash
cd app
npx tsc --noEmit        # 必须 0 errors
npm run build           # 必须成功，chunk 大小可接受（3.3MB -> target <2MB via 4A bundle split）
```

### 8.3 Review Checklist

每阶段 PR 必须包含：
- [ ] 新增/修改文件列表
- [ ] `tsc --noEmit` 截图/日志
- [ ] `npm run build` 截图/日志
- [ ] UI 变更截图（如有）
- [ ] 被替换的旧的 inline 样式已删除（无死代码）

---

## 9. Phase 4A-2 具体执行建议

Phase 4A-2 是**纯新增组件阶段**，零风险、零页面侵入，是后续所有阶段的依赖基座。建议按以下顺序执行：

### 9.1 执行顺序

1. **Layout 层（最高优先级）**
   - 先实现 `PageShell.tsx` — 所有页面都将依赖它
   - 再实现 `PageHeader.tsx` — 几乎每个页面都需要
   - 接着 `SectionCard.tsx` — Dashboard、Settings 马上能用
   - 最后 `ContentGrid.tsx`, `SidePanel.tsx`, `ResultPanel.tsx`, `PageToolbar.tsx`

2. **Feedback 层**
   - `LoadingState.tsx` — 最简单，基于已有 Spinner
   - `ErrorState.tsx` — 带 retry 能力
   - `SuccessState.tsx` — 结果页使用（实际使用中可能多用 Sonner）

3. **Data Display 层**
   - `DataTablePreview.tsx` — 最复杂但收益最大，基于已有 shadcn Table
   - `StatCard.tsx` — 基于 shadcn Card
   - `ChartCard.tsx` — 基于 shadcn Card，预留 ECharts 插槽

### 9.2 每个组件的编码规范

- **必须**从 `lib/utils.ts` import `cn` 用于条件类名合并。
- **必须**导出 props interface（命名：`{ComponentName}Props`）。
- **禁止**在组件内使用 `useState` 管理业务数据（UI 状态如 `isOpen` 除外）。
- **必须**使用现有 CSS variable，如需新颜色先质疑是否真的需要。

### 9.3 验证方式

4A-2 阶段没有页面引用这些组件，验证方式：

```bash
cd app
npx tsc --noEmit        # 确保所有新增组件类型正确
npm run build           # 确保 tree-shaking 不会把它们打包进去（未引用）
```

为了实际看到效果，可以临时在一个测试页面 import 这些组件做视觉确认，确认后移除 import（不提交测试代码）。

### 9.4 下一步衔接

4A-2 完成后，4A-3 将从 `Upload.tsx` 或 `Settings.tsx` 开始（这两个页面结构最简单，适合验证 PageShell + PageHeader + SectionCard 的组合）。建议顺序：

1. Settings.tsx（结构清晰，组件替换最明确）
2. Upload.tsx（ScoreRing 抽组件）
3. Datasets.tsx（表格 + Dialog）
4. History.tsx（简单列表）
5. Dashboard.tsx（ChartCard + ContentGrid）
6. AIWorkspace.tsx（SidePanel + ResultPanel，最复杂，放最后）
7. DataWorkshop.tsx（PageToolbar + DataTablePreview，逻辑最重，放最后）
8. Visualization.tsx（类似 AIWorkspace 布局）
9. SmartAnalysis.tsx（StatCard + ContentGrid）

每个页面一个 commit，随时可回退。
