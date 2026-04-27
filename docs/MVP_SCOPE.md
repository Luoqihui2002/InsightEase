# InsightEase MVP 范围定义

> 版本: 1.1（已修正）  
> 日期: 2026-04-08  
> 状态: 已根据 Runtime Path Audit 修正

---

## 1. MVP Goal

**一句话目标**：
让用户上传 CSV/Excel 文件，通过自然语言对话完成数据分析，获得可视化结果。

**核心价值主张**：
- 零代码数据分析
- AI 驱动的智能洞察
- 即时可视化反馈

**非目标**（明确排除）：
- 复杂的数据清洗工作流（DataWorkshop 是前端沙盒，结果不保存）
- 多用户协作
- 实时数据连接
- 自定义算法

---

## 2. Must-have Features

### 2.1 核心链路（Cloud Mode）

| 功能 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 用户认证 | `app/src/pages/Login.tsx`<br>`insightease-backend/app/api/v1/endpoints/auth.py` | ✅ 完成 | JWT 登录/注册 |
| 文件上传 | `app/src/pages/Upload.tsx`<br>`insightease-backend/app/api/v1/endpoints/datasets.py` | ✅ 完成 | CSV/Excel 上传，自动解析 schema |
| 数据集列表 | `app/src/pages/Datasets.tsx` | ✅ 完成 | 查看、删除、下载数据集 |
| 数据预览 | `app/src/pages/AIWorkspace.tsx`<br>`insightease-backend/app/api/v1/endpoints/datasets.py` | ✅ 完成 | 显示前 5 行数据 |
| AI 对话 | `app/src/pages/AIWorkspace.tsx`<br>`insightease-backend/app/api/v1/endpoints/ai.py` | ✅ 完成 | 流式对话，意图识别 |
| 分析执行 | `app/src/services/analysis-execution.service.ts`<br>`insightease-backend/app/api/v1/endpoints/analysis.py` | ✅ 完成 | 后台任务，轮询结果 |
| 结果可视化 | `app/src/components/AnalysisResultRenderer.tsx` | ✅ 完成 | 图表、表格、指标展示 |
| 结果下载 | `app/src/components/AnalysisResultRenderer.tsx` | ✅ 完成 | base64 图片下载 |

### 2.2 支撑功能

| 功能 | 文件路径 | 状态 | 说明 |
|------|----------|------|------|
| 响应式布局 | `app/src/pages/AIWorkspace.tsx` | ✅ 完成 | 上下/左右布局切换 |
| 对话历史 | `app/src/pages/AIWorkspace.tsx` | ✅ 完成 | localStorage 存储 |
| 安全模式徽章 | `app/src/components/SecurityBadge.tsx` | ✅ 完成 | 显示当前模式 |

---

## 3. Not-in-MVP Features

**明确不在 MVP 范围内的功能**：

| 功能 | 当前状态 | 原因 | 计划时间 |
|------|----------|------|----------|
| **DataWorkshop 结果持久化** | 结果仅前端内存 | 处理结果不保存，刷新丢失 | Post-MVP |
| **DataWorkshop DuckDB 集成** | 代码存在但未触发 | engine-selector 仅 UI 展示 | Post-MVP |
| **OSS 存储** | 接口预留 | 当前存服务器硬盘 | 根据用户规模决定 |
| **PDF 报告导出** | 后端接口预留 | 优先级低 | Post-MVP |
| **WebSocket 实时通信** | 未实现 | 轮询足够 | 根据需求决定 |
| **多语言支持** | 未实现 | 中文优先 | Post-MVP |

---

## 4. Hidden but Retained Features

**MVP 期间隐藏但保留代码的功能**：

| 功能 | 当前位置 | 隐藏方式 | 保留原因 |
|------|----------|----------|----------|
| **Local-first 模式切换** | `app/src/pages/Settings.tsx` L109-174 | 保持当前实现 | 技术债务，删除需重构 SecurityBadge |
| **DataWorkshop 页面** | `app/src/pages/DataWorkshop.tsx` | 保留路由但不在主导航强调 | ⚠️ **修正：Cloud 模式下可用，但结果不保存** |
| **DuckDB 相关代码** | `app/src/workers/`, `app/src/services/duckdb-*.ts` | 懒加载不触发 | 删除收益小，保留无运行时开销 |
| **IndexedDB API 缓存** | `app/src/services/db.ts` | 自动使用 | 提升性能，保留有益 |

### 4.1 修正：DataWorkshop 的定位

**原假设**: DataWorkshop 仅 Local-first 可用，Cloud 用户无法使用。

**实际行为**: 
- Cloud 模式下 DataWorkshop **完全可用**
- 可从云端数据集导入数据（通过 API preview）
- 处理在前端完成，结果不保存

**MVP 建议**: 
- 保留 DataWorkshop 但**降低优先级**
- 在 UI 明确提示"处理结果仅在当前页面有效"
- 不作为主推功能

---

## 5. Launch Blockers

**上线前必须修复的问题**：

| 优先级 | 问题 | 文件位置 | 修复方案 | 验证方式 |
|--------|------|----------|----------|----------|
| 🔴 P0 | 数据集加载失败 | `app/src/pages/AIWorkspace.tsx` | 修复 API 响应解析（res.data → res） | 上传文件后下拉列表显示数据集 |
| 🔴 P0 | 分析结果获取失败 | `app/src/services/analysis-execution.service.ts` | 同上 | 执行分析后显示结果 |
| 🟡 P1 | 文件存储服务器硬盘 | `insightease-backend/app/core/storage.py` | 决策：配置 OSS 或接受风险 | 换设备登录后文件可下载 |
| 🟡 P1 | 中文图表显示方框 | `insightease-backend/app/services/visualization_service.py` | 配置中文字体 | 图表显示中文正常 |
| 🟡 P1 | **DataWorkshop 引擎指示器误导** | `app/src/services/engine-selector.ts` | 添加 TODO 或移除 DuckDB 提示 | 大数据量时不显示"高性能引擎" |

---

## 6. Post-launch Improvements

**上线后优化的功能（按优先级排序）**：

### Phase 1（上线后 1-2 周）
1. **性能优化**
   - 大数据集预览分页加载
   - 分析结果缓存
   - 文件: `app/src/pages/AIWorkspace.tsx`

2. **错误处理增强**
   - 分析失败友好提示
   - 网络错误重试
   - 文件: `app/src/services/analysis-execution.service.ts`

3. **DataWorkshop 体验优化**
   - 添加"结果不保存"提示
   - 修复引擎指示器误导
   - 文件: `app/src/pages/DataWorkshop.tsx`

### Phase 2（上线后 1 个月）
4. **DataWorkshop 云端化（可选）**
   - 操作调用后端 API 执行
   - 支持保存处理流程和结果
   - 文件: `app/src/pages/DataWorkshop.tsx`

5. **对话历史云端化**
   - 后端存储对话历史
   - 多设备同步
   - 文件: 新增 `chat_sessions` 表

### Phase 3（上线后 2-3 个月）
6. **PDF 导出**
   - 后端 ReportLab 已预留
   - 文件: `insightease-backend/app/services/report_service.py`

7. **OSS 配置**
   - 文件存储迁移到 OSS
   - 多设备文件同步
   - 文件: `insightease-backend/app/core/storage.py`

---

## 7. Final MVP Main Path

### 用户主流程（Happy Path）

```
1. 注册/登录
   └─→ 文件: app/src/pages/Login.tsx
   
2. 上传数据集
   └─→ 文件: app/src/pages/Upload.tsx
   └─→ API: POST /api/v1/datasets/upload
   
3. 查看数据集列表
   └─→ 文件: app/src/pages/Datasets.tsx
   └─→ API: GET /api/v1/datasets
   
4. 打开 AI 工作台
   └─→ 双击 AI 小圆点 (app/src/components/AICompanion.tsx)
   └─→ 或导航到 AI Workspace
   
5. 选择数据集
   └─→ 文件: app/src/pages/AIWorkspace.tsx (头部下拉)
   
6. 输入分析需求
   └─→ "帮我预测下个月的销售额"
   
7. AI 意图识别
   └─→ 文件: app/src/services/intent-recognition.service.ts
   └─→ API: POST /api/v1/ai/chat (内部调用)
   
8. 执行分析
   └─→ 文件: app/src/services/analysis-execution.service.ts
   └─→ API: POST /api/v1/analysis/
   
9. 查看结果
   └─→ 文件: app/src/components/AnalysisResultRenderer.tsx
   └─→ 显示：图表、表格、指标、下载按钮
   
10. 继续对话
    └─→ 基于上下文的新分析
```

### 边缘流程（可用但不主推）

```
DataWorkshop 流程:
1. 导航到数据工坊
   └─→ 文件: app/src/pages/DataWorkshop.tsx
   
2. 导入数据（云端或本地）
   └─→ 从云端: datasetApi.preview()
   └─→ 从本地: localStorageService.loadDataset()
   
3. 添加操作（筛选/去重/转换等）
   └─→ 纯前端配置
   
4. 执行处理
   └─→ 纯 JS 执行（前端内存）
   
5. 查看结果
   └─→ ⚠️ 结果仅在当前页面，刷新丢失
```

### 关键代码文件清单（MVP 核心）

**前端（必须稳定运行）**：
```
app/src/
├── pages/
│   ├── AIWorkspace.tsx          # AI 工作台主页面
│   ├── Upload.tsx               # 文件上传
│   ├── Datasets.tsx             # 数据集列表
│   └── Login.tsx                # 登录
├── components/
│   ├── AICompanion.tsx          # 悬浮小圆点
│   ├── AnalysisResultRenderer.tsx  # 结果展示
│   ├── AppHeader.tsx            # 顶部导航
│   └── SecurityBadge.tsx        # 安全模式显示
├── services/
│   ├── analysis-execution.service.ts  # 分析执行
│   └── intent-recognition.service.ts  # 意图识别
└── api/
    ├── datasets.ts
    └── analysis.ts
```

**后端（必须稳定运行）**：
```
insightease-backend/app/
├── api/v1/endpoints/
│   ├── datasets.py              # 数据集 CRUD
│   ├── analysis.py              # 分析任务
│   ├── ai.py                    # AI 对话
│   └── auth.py                  # 认证
├── services/
│   ├── analysis_service.py      # 描述统计、相关性
│   ├── visualization_service.py # 图表生成
│   └── ai_service.py            # AI 封装
└── models/models.py             # 数据库模型
```

---

## 8. Engineering Rules Before Launch

### 8.1 代码冻结规则

**禁止修改**（除非修复 Launch Blocker）：
- `app/src/pages/AIWorkspace.tsx` - 主流程稳定
- `app/src/services/analysis-execution.service.ts` - 分析核心
- `insightease-backend/app/api/v1/endpoints/analysis.py` - 后端分析

**允许修改**（需测试验证）：
- UI 样式微调（CSS 调整）
- 文案修改
- 错误提示优化
- TODO 注释添加

### 8.2 测试清单

上线前必须验证：

- [ ] 新用户注册 → 登录成功
- [ ] 上传 CSV 文件 (< 10MB) → 解析成功
- [ ] 上传 Excel 文件 → 解析成功
- [ ] 数据集列表显示 → 包含行数、列数
- [ ] 打开 AI 工作台 → 选择数据集
- [ ] 输入"帮我做描述性统计" → 返回统计结果
- [ ] 输入"帮我预测下个月的销售额" → 返回预测图表
- [ ] 分析结果可下载 → PNG 图片正常
- [ ] 换浏览器登录同一账号 → 数据集可见
- [ ] 下载上传的文件 → 内容完整
- [ ] **DataWorkshop 从云端导入数据 → 可正常处理（边缘功能）**

### 8.3 监控指标

上线后需要监控：

| 指标 | 来源 | 告警阈值 |
|------|------|----------|
| 分析任务成功率 | Backend logs | < 95% |
| 平均分析耗时 | Backend logs | > 30s |
| 文件上传成功率 | Frontend + Backend | < 98% |
| AI 意图识别成功率 | Backend logs | < 90% |
| 页面加载时间 | Frontend | > 5s |
| DataWorkshop 报错率 | Frontend logs | > 5% |

---

## 附录：技术债务记录

### 已知但接受的债务

| 债务 | 影响 | 缓解措施 |
|------|------|----------|
| DataWorkshop 结果不持久化 | 用户处理结果刷新丢失 | UI 明确提示"结果仅在当前页面有效" |
| engine-selector 误导提示 | 用户看到"高性能引擎"但实际纯 JS | 添加 TODO，Post-MVP 修复 |
| 模式切换行为不一致 | Datasets 受控，DataWorkshop 不受控 | 文档说明，Post-MVP 统一 |
| 文件存服务器硬盘 | 单点故障、容量限制 | 监控硬盘容量，准备 OSS 迁移方案 |
| DuckDB 代码冗余 | bundle 体积稍大 | 懒加载不触发，无运行时影响 |

### 必须偿还的债务（Post-MVP）

| 债务 | 偿还时间 | 方案 |
|------|----------|------|
| API 响应结构不一致 | 1 个月内 | 统一返回 ResponseModel |
| 前端类型不完整 | 1 个月内 | 补充 DatasetPreview, AnalysisResult 类型 |
| engine-selector 实际生效 | 1 个月内 | 实现 DuckDB 集成或移除提示 |
| DataWorkshop 结果保存 | 2 个月内 | 支持导出或保存到后端 |
| 测试覆盖率不足 | 持续 | 添加单元测试和 E2E 测试 |

---

## 修正记录

| 版本 | 日期 | 修正内容 |
|------|------|----------|
| 1.0 | 2026-04-08 | 初始版本，错误假设 DataWorkshop 仅 Local-first 可用 |
| 1.1 | 2026-04-08 | 修正：DataWorkshop Cloud 模式可用（结果不保存）；添加 DataWorkshop 为边缘流程；修正 Launch Blockers |
