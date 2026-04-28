# InsightEase 当前进度

**更新日期**: 2026-04-28

---

## 当前阶段状态

**Phase 3 代码重构、legacy 清理、类型检查与生产构建已完成。**

- `npx tsc --noEmit` — 0 errors ✅
- `npm run build` — 生产构建成功 ✅（built in 19.47s）
- 后端 Transform API 集成测试 — 6/6 通过 ✅

---

## 已完成的 Phase

| Phase | 名称 | 状态 |
|---|---|---|
| 1-2 | 修复错误模式概念，Upload/Datasets 回归后端主线 | ✅ 完成 |
| 2.5 | 验证和封口 | ✅ 完成 |
| 3A | Legacy 隔离 | ✅ 完成 |
| 3B | DataWorkshop 后端化设计 | ✅ 完成 |
| 3C | 后端 Transform API | ✅ 完成 |
| 3D | DataWorkshop 前端接入 preview/save | ✅ 完成 |
| 3E | Legacy 删除 | ✅ 完成 |
| 3F | Build gate cleanup | ✅ 完成 |
| 3G | 文档收口 | 🟡 部分完成 |

---

## 当前稳定主链路

```
Upload CSV/Excel
  -> 后端解析 -> MySQL + 磁盘存储
  -> Datasets 列表
  -> DataWorkshop（filter/rename/dedup/derive/sample 后端执行）
     -> preview（不保存）
     -> transform（保存为新数据集）
  -> AIWorkspace / SmartAnalysis（意图识别 + 分析执行 + 可视化）
```

---

## Phase 3G 浏览器 E2E 待人工验证

以下 checklist 需在可连接后端的环境中逐项人工验证：

- [ ] 注册 / 登录
- [ ] 上传 CSV
- [ ] Datasets 列表可见
- [ ] Datasets 预览正常
- [ ] DataWorkshop 执行 filter + rename preview
- [ ] DataWorkshop 保存为新数据集
- [ ] 新数据集出现在 Datasets
- [ ] 新数据集可进入 AIWorkspace / SmartAnalysis
- [ ] 页面无 console error

---

## 当前已知阻塞项

### Blocking before public demo

| 阻塞项 | 说明 | 计划解决 |
|---|---|---|
| 完整浏览器 E2E 回归测试 | Phase 3G 尚未完成人工验证 | Phase 3G 补测 |
| analysis.py 后台任务未走 `storage.read()` | OSS 环境下读取文件失败 | Phase 4A |
| 数据库 migration / Alembic 记录 | 当前靠手动 SQL | Phase 4A |

---

## Phase 4A-3-1 Hotfix

- **问题**: Settings 页面 shadcn `SelectItem` 传入空字符串 `value=""`，触发 Radix UI 运行时断言错误，页面崩溃。
- **修复**: `autoDeleteOptions` 中 `value: ''` 改为 `value: 'never'`，`onValueChange` 映射回 `null`。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功，dev 服务器正常启动。

## Phase 4A-3-2: Upload 页面骨架替换

- **目标**: 将 Upload 页面迁移到共享组件体系（PageShell, PageHeader, SectionCard, ScoreRing）。
- **修改**:
  - `Upload.tsx` 使用 `PageShell` + `PageHeader` + `SectionCard` 替换原有手写布局。
  - 提取内联 SVG 评分环为 `ScoreRing.tsx`（`app/src/components/data-display/ScoreRing.tsx`）。
  - 简化拖拽区域动画：移除持续旋转的渐变背景，改用边框高亮反馈。
  - 新增"清除已完成"按钮（仅清除 completed/error 状态的上传项）。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 12.28s，无空 `SelectItem value=""`。

## Phase 4A-3-3: History 页面骨架替换

- **目标**: 将 History 页面迁移到共享组件体系（PageShell, PageHeader, ContentGrid, StatCard, SectionCard, LoadingState, ErrorState）。
- **修改**:
  - `History.tsx` 使用共享布局/反馈/数据展示组件替换原有手写布局。
  - 标题从英文 `"History"` 改为中文 `"历史记录"`。
  - 统计卡片使用 `ContentGrid(cols=4)` + `StatCard`，新增 `valueClassName` 支持彩色数值。
  - 空状态使用 shadcn `<Empty>` 组件替代手写 div。
  - 下载菜单使用 `<DropdownMenu>` 替代 `group-hover` CSS 方案，提升移动端可用性。
  - 详情弹窗使用 `<Dialog>` + `<DialogContent>` 替代 `fixed inset-0` 手写模态框。
- **类型修复**:
  - 移除未使用的 `AlertCircle` 导入。
  - 将 `Dialog` 条件渲染改为 `{selectedAnalysis && (<Dialog open={true}>...)}`，消除 `possibly null` 错误。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 13.06s，无空 `SelectItem value=""`。

## Phase 4A-3-4: Datasets 页面骨架与交互一致性重构

- **目标**: 将 Datasets 页面迁移到共享组件体系，提升交互一致性。
- **修改**:
  - `Datasets.tsx` 使用 `PageShell` + `PageHeader` + `ContentGrid` + `StatCard` + `SectionCard` + `LoadingState` + `ErrorState` + `Empty` + `DataTablePreview` + `AlertDialog` 重构。
  - 标题从英文 `"Datasets"` 改为中文 `"数据集"`。
  - 统计卡片使用 `ContentGrid(cols=4)` + `StatCard` 替代手写 Card。
  - 空状态使用 shadcn `<Empty>` 组件替代表格内手写 td。
  - 预览表格使用 `DataTablePreview` 替代手写 `<table>`（展开行 + 详情弹窗）。
  - 详情弹窗缩小为 `max-w-4xl max-h-[80vh]`（原 `90vw/90vh`）。
  - 底部上传区域简化为"去上传数据"快捷按钮。
  - 表格密度优化：`py-4 px-4` → `py-3 px-3`。
- **交互改进**:
  - 原生 `confirm()` 替换为 `<AlertDialog>`（单条删除 + 批量删除）。
  - 原生 `alert()` 替换为 `toast.error()` / `toast.success()`（重命名验证、下载失败、删除反馈）。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 14.96s，无空 `SelectItem value=""`。

## 下一步建议

### 立即执行

1. **补做 Phase 3G 浏览器端到端回归测试** — 在可连接 RDS 的环境中跑通全部 checklist

### 随后进入 Phase 4A: Engineering Stabilization

1. **Bundle splitting** — `manualChunks` 拆分 vendor / echarts / radix
2. **API 类型统一** — 修复拦截器解包导致的类型混乱
3. **Alembic 引入** — 数据库版本化管理
4. **storage.read() 统一** — 修复 OSS 兼容性问题

---

## Build 验证结果

```bash
cd app && npx tsc --noEmit    # 0 errors ✅
cd app && npm run build        # built in 14.96s ✅
```

> 警告: JS chunk 3,365 KB，待 Phase 4A 拆分优化。
