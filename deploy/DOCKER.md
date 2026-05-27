# VideoPass Docker 部署指南

## 前提条件

- 服务器已安装 Docker 和 Docker Compose
- 至少 2GB 可用磁盘空间

## 快速启动

### 方式一：docker-compose（推荐）

```bash
# 1. 上传项目到服务器
scp -r ./videopass root@你的服务器IP:/opt/videopass

# 2. 登录服务器
ssh root@你的服务器IP

# 3. 进入项目目录并启动
cd /opt/videopass
docker compose up -d --build
```

### 方式二：docker 命令

```bash
# 构建镜像
docker build -t videopass .

# 运行容器
docker run -d \
  --name videopass \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  --restart unless-stopped \
  videopass
```

## 访问

部署完成后访问 `http://你的服务器IP:3000`

## 常用命令

```bash
# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动（代码更新后）
docker compose up -d --build

# 进入容器调试
docker compose exec videopass bash

# 查看容器资源占用
docker stats videopass
```

## 更新部署

```bash
# 1. 上传新代码
scp -r ./videopass/* root@你的服务器IP:/opt/videopass/

# 2. 重新构建并启动
cd /opt/videopass
docker compose up -d --build
```

## 环境变量

在 `docker-compose.yml` 中修改：

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - YT_DLP_PATH=/usr/local/bin/yt-dlp
```

或者使用 `.env` 文件：

```bash
# 创建 .env 文件
cat > .env << EOF
PORT=3000
NODE_ENV=production
EOF
```

## 数据持久化

临时视频文件存储在容器内的 `/tmp` 目录。如需持久化：

```yaml
volumes:
  - /tmp/videopass:/tmp
```

## Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

## HTTPS（Let's Encrypt）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com

# 自动续期测试
certbot renew --dry-run
```

## 故障排查

```bash
# 查看容器日志
docker compose logs -f

# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' videopass

# 进入容器检查
docker compose exec videopass bash

# 检查 yt-dlp 是否可用
docker compose exec videopass yt-dlp --version

# 检查 ffmpeg 是否可用
docker compose exec videopass ffmpeg -version
```

## 资源限制

在 `docker-compose.yml` 中调整：

```yaml
deploy:
  resources:
    limits:
      memory: 2G    # 内存限制
      cpus: '2.0'   # CPU 限制
```

## 清理

```bash
# 停止并删除容器
docker compose down

# 删除镜像
docker rmi videopass

# 清理未使用的镜像和容器
docker system prune -a
```
