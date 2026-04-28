# InsightEase 存储架构说明

> 版本: 1.1（已修正）  
> 日期: 2026-04-08  
> 状态: 已根据 Runtime Path Audit 修正

---

## 1. 架构概述

### 1.1 两种存储模式定义

| 模式 | 定义 | 用户场景 | 实际影响范围 |
|------|------|----------|-------------|
| **Local-first Mode** | 数据存储在浏览器 IndexedDB，上传不经过后端 | 敏感数据、离线使用 | **仅影响 Datasets 页面和 Upload 页面** |
| **Cloud Mode** | 数据上传到服务器（本地硬盘或 OSS），分析由后端执行 | 协作分享、云端备份 | **Datasets 走后端，AIWorkspace 始终走后端** |

⚠️ **重要修正**: 模式切换按钮**不是全局状态**，DataWorkshop **不读取该状态**。

### 1.2 模式切换的真实影响

```
模式切换按钮
    ↓
修改 localStorage key: insightease_security_mode
    ↓
影响范围:
    ✅ Datasets 页面 - 数据源切换（本地/云端互斥）
    ✅ Upload 页面 - 上传目标切换
    ✅ SecurityBadge - UI 显示
    ❌ DataWorkshop - 无影响（始终混合模式）
    ❌ AIWorkspace - 无影响（始终调用后端）
```

### 1.3 当前 MVP 主推模式

**主推 Cloud Mode**，但需知：
- DataWorkshop 在 Cloud 模式下仍使用 IndexedDB（加载本地数据集列表）
- 所有数据处理（DataWorkshop）都在浏览器内存中完成，不调用后端

---

## 2. 数据存储位置详表

| 数据类型 | 当前保存位置 | Local-first Mode 职责 | Cloud Mode 职责 | 是否上传云端 | 相关文件 | 问题 |
|----------|-------------|----------------------|----------------|-------------|----------|------|
| **原始数据文件** | Local: IndexedDB (`db.ts` datasets 表)<br>Cloud: 服务器本地硬盘 `./data/uploads/` | 压缩存储在 IndexedDB，支持 CSV/JSON | 存储在服务器硬盘或 OSS | Cloud 模式必传 | `app/src/services/db.ts`<br>`insightease-backend/app/core/storage.py` | ⚠️ Cloud 模式文件未使用 OSS，存服务器硬盘 |
| **Dataset metadata** | Local: IndexedDB<br>Cloud: MySQL `datasets` 表 | 存储在 IndexedDB metadata | 存储在 MySQL | Cloud 模式存 MySQL | `app/src/services/db.ts`<br>`insightease-backend/app/models/models.py` | ✅ 清晰 |
| **Project metadata** | ❌ 未实现 | N/A | N/A | N/A | - | ❌ 项目概念不存在 |
| **Experiment configuration** | ❌ 未实现 | N/A | N/A | N/A | - | ❌ 实验概念不存在 |
| **Analysis result** | Cloud: MySQL `analyses` 表的 `result_data` JSON 字段 | 不存储（实时计算） | 存储分析结果和图表 base64 | Cloud 模式存 MySQL | `insightease-backend/app/models/models.py` | ⚠️ base64 图表体积大 |
| **DataWorkshop 处理数据** | **前端内存** (React state) | 从 IndexedDB 加载到内存处理 | **从后端 API 加载到内存处理** | **不保存结果** | `app/src/pages/DataWorkshop.tsx` | ⚠️ **处理结果不持久化，刷新丢失** |
| **DataWorkshop 操作链** | Local: IndexedDB `operationChains` 表 | 存储操作链历史 | ❌ 不存储 | 不上传 | `app/src/services/db.ts` | ⚠️ Cloud 模式无操作历史 |
| **Error log** | 前端: console.error<br>后端: 文件/stdout | console 输出 | 服务端日志 | 不上传 | - | ⚠️ 无统一错误收集 |
| **User account** | Cloud: MySQL `users` 表 | ❌ 不支持 | 存储用户认证信息 | 必传 | `insightease-backend/app/models/models.py` | ✅ 清晰 |
| **App settings** | Local: localStorage | 存储安全模式开关 | 存储安全模式开关（仅 UI） | 不上传 | `app/src/services/local-storage.service.ts` | ⚠️ 设置不同步 |
| **API 缓存** | Local: IndexedDB `apiCache` 表 | 缓存云端 API 响应 | 缓存 API 响应 | 不上传 | `app/src/services/db.ts` | ✅ 合理 |
| **对话历史** | Local: localStorage | 存储 AI 对话历史 | 存储 AI 对话历史 | 不上传 | `app/src/pages/AIWorkspace.tsx` | ⚠️ 仅本地存储 |

### 2.1 修正：DataWorkshop 的存储架构

**原错误假设**: DataWorkshop 仅支持 Local-first，使用 IndexedDB 存储数据。

**实际行为**:
```
DataWorkshop 数据源（与模式无关）:
├─ 本地数据集: IndexedDB → 加载到内存
├─ 云端数据集: 后端 API preview → 加载到内存
└─ 上传文件: FileReader → 内存 → 可选保存到 IndexedDB

DataWorkshop 处理:
└─ 纯前端 JS 执行（内存中）→ 结果仅在前端展示

DataWorkshop 持久化:
└─ ❌ 处理结果不保存到任何地方
```

**结论**: DataWorkshop 是一个"前端数据沙盒"，数据来源可以是本地或云端，但处理始终在前端完成，结果不持久化。

---

## 3. 存储后端职责

| 存储后端 | 当前职责 | Local-first Mode | Cloud Mode | 是否混乱 |
|----------|----------|------------------|------------|----------|
| **IndexedDB** | 本地数据集存储、操作链、API 缓存 | ✅ 主存储 | ⚠️ **DataWorkshop 仍读取本地数据集列表** | **是** - Cloud 模式下 DataWorkshop 仍暴露本地数据源 |
| **DuckDB** | 本地大数据处理引擎（设计） | ⚠️ **代码存在但未触发** | ❌ 不使用 | ✅ 职责清晰但 DataWorkshop 中未使用 |
| **localStorage** | 安全模式开关、对话历史 | ✅ 配置存储 | ✅ 配置存储 | ⚠️ 设置不同步到云端 |
| **MySQL** | 用户、数据集 metadata、分析结果 | ❌ 不使用 | ✅ 主存储 | ✅ 清晰 |
| **OSS** | 文件存储（预留接口） | ❌ 不使用 | ❌ 未配置（存服务器硬盘） | ❌ 未启用 |

### 3.1 修正：IndexedDB 在 Cloud 模式下的使用

**原错误假设**: Cloud 模式不使用 IndexedDB。

**实际行为**:
- DataWorkshop 在 Cloud 模式下仍调用 `loadLocalDatasets()` 读取 IndexedDB
- 上传文件时仍同时保存到 IndexedDB（`localStorageService.importDataset`）
- API 缓存在所有模式下都使用 IndexedDB

**结论**: IndexedDB 在 Cloud 模式下**不是主存储**，但**仍被使用**（DataWorkshop 数据源 + API 缓存）。

---

## 4. 关键问题分析

### 4.1 职责混乱点

| 问题 | 描述 | 影响 | 建议 |
|------|------|------|------|
| **模式切换不是全局状态** | 按钮仅影响 Datasets/Upload，不影响 DataWorkshop/AIWorkspace | 用户困惑：切到云端模式，DataWorkshop 仍显示本地数据 | 明确告知用户模式切换的作用范围 |
| **DataWorkshop 是混合模式** | 始终同时加载云端和本地数据源 | 用户困惑模式含义 | 将 DataWorkshop 视为独立工具，不受模式控制 |
| **DataWorkshop 结果不保存** | 处理结果仅在前端内存，刷新丢失 | 用户数据丢失 | 添加"保存结果"功能或明确提示 |
| **DuckDB 未触发** | DataWorkshop 使用纯 JS，不用 DuckDB | 大数据量时可能卡顿 | 实现 DuckDB 集成或移除相关提示 |
| **对话历史仅 localStorage** | AI 对话历史不随账号同步 | 换设备丢失历史 | 添加后端对话历史存储 |
| **设置不同步** | 安全模式等设置仅存在浏览器 | 多设备体验不一致 | 添加 user_settings 表 |

### 4.2 修正：数据流向图

```
┌─────────────────────────────────────────────────────────────┐
│                     Local-first Mode                        │
├─────────────────────────────────────────────────────────────┤
│  上传文件 → IndexedDB (压缩存储)                           │
│                              ↓                              │
│              Datasets 页面 ←  IndexedDB                     │
│                              ↓                              │
│              DataWorkshop ←  内存处理（不保存）             │
│                              ↓                              │
│                    DuckDB (理论上，实际未触发)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       Cloud Mode                            │
├─────────────────────────────────────────────────────────────┤
│  上传文件 ──→ 服务器硬盘/OSS ──→ MySQL metadata             │
│                      ↓                                      │
│              Datasets 页面 ←  后端 API                      │
│                      ↓                                      │
│              DataWorkshop ←  后端 API 加载到内存            │
│                      ↓                                      │
│              纯 JS 处理（不调用后端，不保存结果）           │
│                      ↓                                      │
│              AIWorkspace ←  后端分析 API                    │
│                      ↓                                      │
│              MySQL (analysis result)                        │
└─────────────────────────────────────────────────────────────┘
```

**关键修正**: DataWorkshop 在 Cloud 模式下**不调用后端分析 API**，所有处理纯前端完成。

---

## 5. 上线前建议

### 5.1 立即处理（Launch Blocker）

1. **明确 DataWorkshop 定位**
   - 当前行为: 前端数据沙盒，支持混合数据源，结果不保存
   - 建议: 在 UI 添加提示"处理结果仅在当前页面有效，刷新后丢失"

2. **修复引擎指示器**
   - 当前行为: 显示"高性能引擎"但始终使用纯 JS
   - 建议: 移除 DuckDB 相关提示，或添加 TODO 说明未实现

3. **配置 OSS 或明确存储策略**
   - 当前文件存服务器硬盘，换设备会 404
   - 决策：配置 OSS 或接受单服务器存储风险

### 5.2 上线后优化

1. **统一模式切换行为**
   - 选项 A: DataWorkshop 响应模式切换（只显示对应数据源）
   - 选项 B: 明确告知用户 DataWorkshop 不受模式影响

2. **DataWorkshop 结果持久化**
   - 允许保存处理结果到后端或本地
   - 支持导出处理后的数据

3. **对话历史云端化**
   - 添加 `chat_sessions` 表
   - 支持多设备同步

---

## 6. 附录：存储大小估算

| 数据类型 | 单条大小 | 存储位置 | 备注 |
|----------|----------|----------|------|
| 原始数据 (CSV) | 原文件大小 | 服务器硬盘/OSS | 1MB CSV ≈ 1MB 存储 |
| 分析结果 (JSON) | 10KB - 1MB | MySQL JSON 字段 | 含 base64 图表时较大 |
| Dataset metadata | ~500B | MySQL | schema 信息 |
| DataWorkshop 处理数据 | 前端内存 | 不持久化 | 刷新丢失 |
| 对话历史 | ~1KB/轮 | localStorage | 仅本地 |
| API 缓存 | 可变 | IndexedDB | TTL 5分钟 |

---

## 修正记录

| 版本 | 日期 | 修正内容 |
|------|------|----------|
| 1.0 | 2026-04-08 | 初始版本，错误假设 DataWorkshop 仅 Local-first |
| 1.1 | 2026-04-08 | 修正：DataWorkshop 是混合模式；模式切换不是全局状态；IndexedDB 在 Cloud 模式仍被使用 |
