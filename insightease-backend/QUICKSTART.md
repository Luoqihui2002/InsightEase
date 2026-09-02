# InsightEase 快速启动指南

## 🎯 目标
5分钟内部署完成后端服务！

## ⚡ 超快速部署

### 第1步：上传代码到服务器
```bash
# 本地压缩代码
zip -r insightease-backend.zip insightease-backend/ -x "*/venv/*" "*/__pycache__/*" "*/.git/*"

# 上传到服务器（替换为你的服务器IP）
scp insightease-backend.zip root@你的服务器IP:/opt/

# SSH登录服务器
ssh root@你的服务器IP
```

### 第2步：服务器上执行
```bash
cd /opt
unzip insightease-backend.zip
cd insightease-backend

# 安装Docker（如未安装）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 配置环境变量
cp .env.example .env
# 用编辑器修改 .env，填入数据库密码

# 一键部署
chmod +x deploy.sh
./deploy.sh
```

### 第3步：验证部署
```bash
# 测试API
curl http://localhost:8000/

# 应该返回：
# {"name":"InsightEase API","version":"2.0.0",...}
```

**完成！** 🎉

---

## 🔌 前端配置

前端 `.env` 文件中设置：
```env
VITE_API_BASE_URL=http://你的服务器IP:8000/api/v1
```

---

## ✅ 部署检查清单

- [ ] 代码上传到服务器
- [ ] Docker 已安装
- [ ] `.env` 文件已配置
- [ ] 数据库白名单已添加服务器IP
- [ ] 部署脚本执行成功
- [ ] API可以正常访问
- [ ] 前端可以连接后端

---

## 🆘 故障排查

### 部署失败？
```bash
# 1. 检查Docker
docker --version
docker-compose --version

# 2. 检查端口占用
netstat -tlnp | grep 8000

# 3. 查看详细日志
docker-compose logs -f backend
```

### 数据库连不上？
- 检查RDS白名单是否包含服务器公网IP
- 检查 `.env` 中的密码是否正确
- 测试连接：`mysql -h db.example.internal -u insightease_app -p`

### 前端连不上后端？
- 检查服务器防火墙是否开放8000端口
- 检查CORS配置（ALLOWED_ORIGINS）
- 确认前端API地址配置正确

---

**有问题？查看详细文档：** [DEPLOY.md](./DEPLOY.md)
