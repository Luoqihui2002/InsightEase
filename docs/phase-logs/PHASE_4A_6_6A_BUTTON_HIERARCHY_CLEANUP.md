# Phase 4A-6-6A: Button Hierarchy Cleanup

## Objective
Clarify button hierarchy across migrated pages by applying consistent shadcn/ui `variant` values and adding missing `aria-label` attributes to icon-only buttons.

## Design System Rules Applied
- **Primary action** → `variant="default"`
- **Secondary action** → `variant="outline"`
- **Tertiary/quiet** → `variant="ghost"`
- **Destructive** → `variant="destructive"`
- **Icon-only** → appropriate variant + `aria-label`

## Changes

### 1. Primary Actions — Custom `<button>` → `<Button variant="default">`

| Page | Action | Before | After |
|------|--------|--------|-------|
| `Forecast.tsx` | "启动预测" | Custom `<button>` with inline `style={{ backgroundColor: 'var(--neon-cyan)'... }}` | `<Button variant="default">` |
| `PathAnalysis.tsx` | "开始分析" | `<Button className="bg-[var(--neon-cyan)]...">` | `<Button variant="default">` |
| `SmartProcess.tsx` | "开始处理" | `<Button>` without explicit variant | `<Button variant="default">` |
| `SmartProcess.tsx` | "下载处理后数据" | `<Button className="bg-[var(--neon-cyan)]...">` | `<Button variant="default">` |
| `GoalPlanner.tsx` | "开始拆解" | Custom `<button>` with inline `style={{ backgroundColor: 'var(--neon-cyan)'... }}` | `<Button variant="default">` |

### 2. Destructive Actions — `variant="ghost"` + neon-pink → `variant="destructive"`

| Page | Action | Before | After |
|------|--------|--------|-------|
| `Datasets.tsx` | Batch delete | `variant="ghost"` + `text-[var(--neon-pink)]` | `variant="destructive"` |
| `History.tsx` | Delete record | `variant="ghost"` + `text-[var(--neon-pink)]` | `variant="destructive"` |
| `Dashboard.tsx` | Delete dashboard | `variant="ghost"` + `text-[var(--neon-pink)]` | `variant="destructive"` |

### 3. Icon-Only Buttons — Custom `<button>` → `<Button>` + `aria-label`

| Page | Action | Before | After |
|------|--------|--------|-------|
| `Dashboard.tsx` | Widget enlarge | Custom `<button>` | `<Button variant="ghost" size="icon" aria-label="放大">` |
| `Dashboard.tsx` | Widget shrink | Custom `<button>` | `<Button variant="ghost" size="icon" aria-label="缩小">` |
| `Dashboard.tsx` | Widget export | Custom `<button>` | `<Button variant="ghost" size="icon" aria-label="导出图片">` |
| `Dashboard.tsx` | Widget remove | Custom `<button>` | `<Button variant="ghost" size="icon" aria-label="移除">` |
| `Dashboard.tsx` | Add viz to dashboard | Custom `<button>` | `<Button variant="ghost" size="icon" aria-label="添加到看板">` |
| `Dashboard.tsx` | Delete viz | Custom `<button>` | `<Button variant="ghost" size="icon" aria-label="删除">` |
| `Dashboard.tsx` | Close modal | Already `<Button>` | Added `aria-label="关闭"` |
| `Dashboard.tsx` | Export PNG/JSON | Already `<Button>` | Added `aria-label` |
| `History.tsx` | View result | Already `<Button>` | Added `aria-label="查看结果"` |
| `History.tsx` | Download report | Already `<Button>` | Added `aria-label="下载报告"` |
| `History.tsx` | Delete record | Already changed to `destructive` | Added `aria-label="删除"` |
| `History.tsx` | Close modal | Already `<Button>` | Added `aria-label="关闭"` |

### 4. Import Fix
- `GoalPlanner.tsx`: Added missing `import { Button } from "@/components/ui/button";`

## Files Modified
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/SmartProcess.tsx`
- `app/src/pages/GoalPlanner.tsx`
- `app/src/pages/Datasets.tsx`
- `app/src/pages/History.tsx`
- `app/src/pages/Dashboard.tsx`

## Validation
- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (19.53s)
- SelectItem empty value check: ✅ no violations in modified files
- Button variant audit: ✅ all primary→default, secondary→outline, destructive→destructive

## Notes
- Widget action buttons (enlarge/shrink/export/remove) in Dashboard.tsx were migrated from custom `<button>` to shadcn `<Button>` with `size="icon"`. The remove button retains `variant="ghost"` with hover text color because it appears in a hover-reveal context where a solid destructive button would be visually jarring.
- Navigation shortcut buttons in Dashboard.tsx (lines 966-1003) and tab switch buttons (lines 1107-1128) remain custom `<button>` elements because they contain visible text and serve as navigation/toggle UI rather than action buttons.
- Chart type selectors in Visualization.tsx and cluster mode toggles in PathAnalysis.tsx remain custom styled as they are selection chips, not action buttons.
