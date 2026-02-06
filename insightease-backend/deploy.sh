#!/bin/bash
# InsightEase 后端部署脚本

set -e

echo "🚀 InsightEase 后端部署脚本"
echo "=============================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 环境检查通过${NC}"

# 检查配置文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在，正在从模板创建...${NC}"
    if [ -f ".env.production" ]; then
        cp .env.production .env
        echo -e "${YELLOW}⚠️  请编辑 .env 文件，修改数据库密码和密钥配置！${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.production 模板文件也不存在${NC}"
        exit 1
    fi
fi

# 创建必要的目录
echo "📁 创建数据目录..."
mkdir -p data/uploads data/reports ssl

# 停止旧容器
echo "🛑 停止旧容器..."
docker-compose down --remove-orphans 2>/dev/null || true

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build --no-cache

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 健康检查
echo "🏥 健康检查..."
MAX_RETRY=10
RETRY=0
while [ $RETRY -lt $MAX_RETRY ]; do
    if curl -f http://localhost:8000/ > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务启动成功！${NC}"
        break
    fi
    RETRY=$((RETRY+1))
    echo "  重试 $RETRY/$MAX_RETRY..."
    sleep 3
done

if [ $RETRY -eq $MAX_RETRY ]; then
    echo -e "${RED}❌ 服务启动失败，请检查日志${NC}"
    echo "查看日志: docker-compose logs -f backend"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 部署成功！${NC}"
echo "=============================="
echo "API地址: http://localhost:8000"
echo "文档地址: http://localhost:8000/docs"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f backend"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo "=============================="
