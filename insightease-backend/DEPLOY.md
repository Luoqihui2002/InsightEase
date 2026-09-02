# InsightEase 后端部署指南

## 📋 部署前准备

### 1. 环境要求
- **服务器**: 阿里云ECS / 腾讯云CVM / AWS EC2 等
- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Windows Server 2019+
- **内存**: 建议 2GB+
- **Docker**: 20.10+
- **Docker Compose**: 1.29+

### 2. 已购买的服务
- ✅ 阿里云RDS MySQL数据库
- ✅ 云服务器ECS
- （可选）域名和SSL证书

---

## 🚀 快速部署（推荐）

### 方式一：使用部署脚本（最简单）

#### Linux/Mac:
```bash
# 1. 进入项目目录
cd insightease-backend

# 2. 复制并编辑环境配置
cp .env.example .env
# 编辑 .env 文件，填写你的数据库密码和密钥

# 3. 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

#### Windows:
```powershell
# 1. 进入项目目录
cd insightease-backend

# 2. 复制并编辑环境配置
copy .env.example .env
# 编辑 .env 文件，填写你的数据库密码和密钥

# 3. 运行部署脚本
.\deploy.ps1
```

### 方式二：手动部署

#### 1. 安装Docker
```bash
# Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，修改以下配置：
# - DB_PASSWORD: 你的RDS数据库密码
# - SECRET_KEY: 随机密钥（用于JWT签名）
# - ALLOWED_ORIGINS: 你的前端域名（生产环境建议限制）
```

#### 3. 构建并启动
```bash
# 创建数据目录
mkdir -p data/uploads data/reports ssl

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

---

## ⚙️ 配置详解

### 数据库配置
```env
DB_HOST=db.example.internal
DB_PORT=3306
DB_USER=insightease_app
DB_PASSWORD=replace-with-a-strong-password
DB_NAME=insightease
```

### 安全配置（务必修改）
```env
# 生成随机密钥（Linux/Mac）
# openssl rand -hex 32
SECRET_KEY=replace-with-output-of-openssl-rand
```

### CORS配置
```env
# 开发环境（显式列出本地前端）
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# 生产环境（限制指定域名）
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Hermes 配置（可选）
```env
HERMES_ASSISTANT_ENABLED=false
HERMES_ASSISTANT_MODE=disabled
# live 模式下再通过部署环境注入 HERMES_BASE_URL 和 HERMES_AUTH_TOKEN
```

---

## 🔒 安全加固

### 1. 修改默认密钥
```bash
# 生成强密钥
openssl rand -hex 32

# 将生成的密钥填入 .env 的 SECRET_KEY
```

### 2. 配置防火墙
```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 3. 配置SSL证书（HTTPS）
```bash
# 使用 Let's Encrypt 免费证书
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem

# 修改 nginx.conf 启用HTTPS
```

---

## 🔄 日常维护

### 查看日志
```bash
# 实时查看后端日志
docker-compose logs -f backend

# 查看最近100行
docker-compose logs --tail=100 backend
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 只重启后端
docker-compose restart backend
```

### 更新部署
```bash
# 拉取最新代码后
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 备份数据
```bash
# 备份上传的文件
tar -czvf backup-$(date +%Y%m%d).tar.gz data/

# 备份数据库（使用阿里云RDS自动备份功能）
```

---

## 🐛 常见问题

### 1. 容器启动失败
```bash
# 检查日志
docker-compose logs backend

# 常见原因：
# - 数据库连接失败（检查 .env 配置）
# - 端口被占用（检查8000端口）
```

### 2. 数据库连接失败
```bash
# 测试数据库连接
mysql -h db.example.internal -u insightease_app -p

# 检查RDS白名单设置（添加服务器IP）
```

### 3. 文件上传失败
```bash
# 检查目录权限
ls -la data/uploads

# 检查nginx配置中的 client_max_body_size
```

### 4. 内存不足
```bash
# 查看内存使用
docker stats

# 减少工作进程数（修改Dockerfile中的--workers参数）
```

---

## 📊 性能优化

### 1. 数据库优化
- 在RDS控制台开启慢查询日志
- 为常用查询字段添加索引
- 定期清理旧数据

### 2. 应用优化
```bash
# 增加工作进程数（根据CPU核心数）
# 修改 Dockerfile CMD:
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 3. 使用CDN
- 将静态文件托管到阿里云OSS
- 配置CDN加速

---

## 📞 技术支持

遇到问题？
1. 查看日志：`docker-compose logs -f backend`
2. 检查配置：`.env` 文件
3. 查看文档：`http://localhost:8000/docs`

---

**部署完成！** 🎉

API地址：`http://你的服务器IP:8000`
API文档：`http://你的服务器IP:8000/docs`
