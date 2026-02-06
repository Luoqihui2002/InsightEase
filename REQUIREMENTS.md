# InsightEase 项目依赖文档

> 换设备开发时，按此文档安装依赖

---

## 📁 项目结构

```
InsightEase/
├── app/                    # 前端 (React + Vite)
├── insightease-backend/    # 后端 (FastAPI)
└── setup_backend.py       # 后端初始化脚本
```

---

## 🖥️ 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.0 | 前端构建 |
| Python | >= 3.9 | 后端运行 |
| MySQL | >= 8.0 | 数据库 |
| npm | >= 9.0 | 包管理 |

---

## 📦 前端依赖 (app/)

### 核心框架
```bash
cd app
npm install
```

### package.json 主要依赖

#### UI 框架
- `react` ^19.2.0 - React 核心
- `react-dom` ^19.2.0 - React DOM
- `react-router-dom` ^7.13.0 - 路由管理
- `@radix-ui/*` - 头部件库（20+ 个组件）
- `tailwindcss` ^3.4.19 - CSS 框架
- `class-variance-authority` ^0.7.1 - 组件变体
- `clsx` ^2.1.1 - 类名合并
- `tailwind-merge` ^3.4.0 - Tailwind 类名合并

#### Phase 2.1 新增（安全模式）
- `dexie` ^4.0.0 - IndexedDB 封装
- `@duckdb/duckdb-wasm` ^1.28.0 - 本地 SQL 引擎（懒加载）
- `comlink` ^4.4.1 - Web Worker 通信
- `fflate` ^0.8.2 - 数据压缩
- `papaparse` ^5.4.1 - CSV 解析

#### 数据可视化
- `echarts` ^6.0.0 - 图表库
- `recharts` ^2.15.4 - React 图表

#### 动画效果
- `gsap` ^3.14.2 - 动画库

#### 表单处理
- `react-hook-form` ^7.70.0 - 表单管理
- `@hookform/resolvers` ^5.2.2 - 表单验证
- `zod` ^4.3.5 - Schema 验证

#### HTTP 请求
- `axios` ^1.13.4 - HTTP 客户端

#### 其他工具
- `xlsx` ^0.18.5 - Excel 处理
- `date-fns` ^4.1.0 - 日期处理
- `zustand` ^5.0.10 - 状态管理
- `sonner` ^2.0.7 - Toast 通知
- `lucide-react` ^0.562.0 - 图标库

---

## 🐍 后端依赖 (insightease-backend/)

### 安装方式
```bash
cd insightease-backend
pip install -r requirements.txt
```

### requirements.txt 内容

```
# Web 框架
fastapi==0.115.12
uvicorn[standard]==0.34.0

# 数据库
sqlalchemy==2.0.38
aiomysql==0.2.0
alembic==1.14.1

# 数据处理
pandas==2.2.3
numpy==2.2.3
openpyxl==3.1.5

# 文件上传
python-multipart==0.0.20

# 环境变量
python-dotenv==1.0.1

# 工具
pydantic==2.10.6
python-jose[cryptography]==3.4.0
passlib[bcrypt]==1.7.4

# 异步
asyncpg==0.30.0
```

---

## 🚀 快速启动

### 1. 克隆项目
```bash
git clone <你的仓库地址>
cd InsightEase
```

### 2. 前端启动
```bash
cd app
npm install
npm run dev
# 访问 http://localhost:5173
```

### 3. 后端启动
```bash
cd insightease-backend

# 创建虚拟环境（推荐）
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库连接

# 初始化数据库
python setup_backend.py

# 启动服务
uvicorn main:app --reload --port 8000
```

---

## ⚙️ 环境变量配置

### 后端 .env
```env
# 数据库
DATABASE_URL=mysql+aiomysql://username:password@localhost:3306/insightease

# 安全
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=["http://localhost:5173"]

# 文件上传
MAX_UPLOAD_SIZE=104857600  # 100MB
UPLOAD_DIR=./uploads
```

### 前端 .env（可选）
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 📂 重要文件备份清单

上传 Git 前确保这些文件已提交：

```bash
# 根目录
.gitignore
REQUIREMENTS.md          # 本文件
PROGRESS.md              # 开发进度

# 前端 (app/)
app/src/services/        # Phase 2.1 核心服务
  ├── engine-selector.ts
  ├── db.ts
  ├── local-storage.service.ts
  └── index.ts
app/src/utils/
  └── operation-executor.ts
app/src/components/
  └── SecurityBadge.tsx
app/src/types/
  ├── operation.ts
  └── data-table.ts

# 后端 (insightease-backend/)
requirements.txt
main.py
Dockerfile
```

---

## 🔧 常见问题

### 1. npm install 失败
```bash
# 清除缓存
npm cache clean --force

# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com
```

### 2. Python 依赖冲突
```bash
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir
```

### 3. IndexedDB 初始化失败
- 检查浏览器是否禁用第三方 Cookie
- 使用 Chrome/Edge 开发者工具 → Application → IndexedDB 查看

---

## 📞 技术支持

- FastAPI 文档: https://fastapi.tiangolo.com
- Dexie 文档: https://dexie.org
- DuckDB-WASM: https://duckdb.org/docs/api/wasm
