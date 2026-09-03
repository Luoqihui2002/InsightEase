# InsightEase 项目上手指南

InsightEase 当前主线是后端托管的数据分析平台与 metadata-first Assistant。正式链路为：

```text
Dataset 上传与目录
  -> Dataset Profile / 人工确认 Relationship Set
  -> Hermes metadata-first 计划（失败时确定性降级）
  -> 确定性 Join Preview / 显式创建派生 Dataset
  -> 用户在专用分析页手动启动 Analysis API
  -> ResultView / SafeResultSummary
  -> 后端 Hermes Result Explainer（失败时安全降级）
```

## 目录

- `app/`：React + TypeScript 前端
- `insightease-backend/`：FastAPI + SQLAlchemy + pandas 后端
- `manual-test-data/`：手工回归数据与清单
- `docs/CURRENT_ARCHITECTURE.md`：当前架构边界
- `docs/ROADMAP.md`：后续阶段边界
- `docs/archive/` 与 `docs/phase-logs/`：历史材料，不代表当前运行时

## 本地启动

前端：

```bash
cd app
npm install
npm run dev
```

后端：

```bash
cd insightease-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

启动前请在 `.env` 中配置数据库账号。生产环境不得使用 root/空密码，应使用稳定随机的 `SECRET_KEY` 和显式的 `ALLOWED_ORIGINS`。Hermes 凭据只能由后端部署环境或 secret manager 注入。

## 架构边界

- 浏览器不直接调用模型提供方，也不保存模型密钥。
- `/api/v1/assistant/*` 提供 metadata-first profile 与关系推断。
- `/api/v1/assistant/hermes/*` 是唯一模型运行时边界。
- 分析执行必须由用户在对应页面确认后启动。
- 当前不支持自动 SQL、LLM/自动 Join、自动分析或源数据集修改；已确认的 2–3 表 JoinPlan 可由后端确定性预览，并在用户显式确认后创建新 Dataset。
- 旧 `/api/v1/ai/*`、`aiApi`/legacy intent-execution service 与 `/app/smart-analysis` 已退役。

## 验证

```bash
cd app && npm run lint && npm run build
cd ../insightease-backend && pytest
```
