# InsightEase 变更日志

## Phase 1-2：修复错误模式概念

- 修正"本地模式"与"云端模式"的概念混淆
- Upload/Datasets 统一回归后端 Dataset API
- 移除前端全局 storageMode 切换按钮
- SecurityBadge 改为纯静态架构状态展示
- `localStorageService` 标记为 legacy，主链路不再调用

## Phase 2.5：验证和封口

- 验证 Upload → Datasets → AIWorkspace 主链路完整
- 确认 DataWorkshop 在 Cloud 模式下可用但结果不保存
- 修正 MVP_SCOPE.md 中对 DataWorkshop 定位的描述
- 标记 launch blockers

## Phase 3A：Legacy 隔离

- 识别并标记所有 browser-local 代码
- 将 `browser-processing/` 模块移至 `src/legacy/` 目录
- 主链路代码不再 import legacy 模块

## Phase 3B：DataWorkshop 后端化设计

- 产出 `DATAWORKSHOP_BACKENDIZATION_PLAN.md`
- 定义 V1 支持的 7 种操作：filter、select、rename、sort、dedup、derive、sample
- 设计 preview + transform 双 API 契约
- 规划数据集版本策略（`parent_dataset_id` + `transform_chain`）

## Phase 3C：后端 Transform API

- 新增 `transform.py` endpoint
- 新增 `transform_service.py` 业务层
- 新增 `transform_executor.py` 执行层（纯 pandas）
- 新增 `schemas/transform.py` Pydantic 模型
- `Dataset` 模型新增 `parent_dataset_id` 和 `transform_chain` 字段
- 数据库 migration 执行（手动 ALTER TABLE）

## Phase 3D：DataWorkshop 前端接入

- 新增 `workshopApi.preview()` 和 `workshopApi.transform()`
- 新增 `workshop-adapter.ts` 前端操作 → 后端 Operation 映射
- `executeOperations()` 改为调用后端 preview API
- `handleSaveAsDataset()` 改为调用后端 transform API
- 移除本地数据集导入入口
- 移除引擎指示器 UI

## Phase 3E：Legacy 删除

- 删除 `DataWorkshop.tsx` 中 9 个内联 browser-side 执行函数
- 删除 `legacy/browser-processing/` 整个目录
- 删除 `DuckDBLoader.tsx`
- 移除 `@duckdb/duckdb-wasm`、`comlink`、`dexie`、`fflate` 依赖
- 清理 `vite.config.ts` 中的 DuckDB 配置

## Phase 3F：Build Gate Cleanup

- 修复 Axios 拦截器导致的类型混乱（`as any` / `as unknown as` 应急处理）
- 移除所有未使用的导入和变量
- 修复 `process.env` → `import.meta.env`
- `tsconfig.app.json` 排除测试文件
- `npx tsc --noEmit` 0 errors
- `npm run build` 生产构建成功

## Phase 3G：文档收口

- 产出 `REFACTOR_SUMMARY.md` 架构重构总结
- 完成 docs consolidation（README / CURRENT_ARCHITECTURE / CURRENT_PROGRESS / CHANGELOG / ROADMAP / API_CONTRACTS）
- 归档历史审计报告和 phase 报告
- 更新 `ARCHITECTURE_DECISIONS.md` 至 v2.0
- 浏览器端到端回归测试待人工验证

## Phase 4A-3-1 Hotfix

- **问题**: Settings 页面 shadcn `SelectItem` 传入空字符串 `value=""`，触发 Radix UI 运行时断言错误，页面崩溃。
- **修复**: `autoDeleteOptions` 中 `value: ''` 改为 `value: 'never'`，`onValueChange` 映射回 `null`，业务逻辑保持不变。
- **影响范围**: 仅 `app/src/pages/Settings.tsx`，其余页面使用原生 `<option value="">` 不受影响。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功。

## Phase 4A-3-2: Upload 页面迁移

- `Upload.tsx` 使用 `PageShell` / `PageHeader` / `SectionCard` 重构页面骨架。
- 提取 `ScoreRing.tsx` 共享组件，替代内联 SVG 评分环。
- 简化拖拽区域视觉动画（移除持续旋转渐变）。
- 新增"清除已完成"批量操作按钮。
- 业务逻辑（上传 API、状态管理、文件解析）零改动。

## Phase 4A-3-3: History 页面迁移

- `History.tsx` 使用共享组件体系重构页面骨架（PageShell, PageHeader, ContentGrid, StatCard, SectionCard, LoadingState, ErrorState）。
- `StatCard` 新增 `valueClassName` 属性，支持自定义数值颜色。
- 空状态替换为 shadcn `<Empty>` 组件。
- 下载菜单替换为 `<DropdownMenu>`，提升移动端可用性。
- 详情弹窗替换为 `<Dialog>` + `<DialogContent>`，移除手写模态框。
- 标题国际化：`History` -> `历史记录`。
- 业务逻辑（API 调用、导出函数、状态管理）零改动。

## Phase 4A-3-4: Datasets 页面迁移

- `Datasets.tsx` 使用共享组件体系重构页面骨架（PageShell, PageHeader, ContentGrid, StatCard, SectionCard, LoadingState, ErrorState, Empty, DataTablePreview）。
- 预览表格替换为 `DataTablePreview`（展开行 + 详情弹窗）。
- 空状态替换为 shadcn `<Empty>` 组件。
- 原生 `confirm()` / `alert()` 替换为 `<AlertDialog>` + `toast`。
- 详情弹窗缩小为 `max-w-4xl max-h-[80vh]`。
- 底部上传区域简化为"去上传数据"快捷按钮。
- 表格密度优化为 `py-3 px-3`。
- 标题国际化：`Datasets` -> `数据集`。
- 业务逻辑（API 调用、删除、重命名、下载、预览）零改动。
