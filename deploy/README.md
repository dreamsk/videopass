# VideoPass 部署指南

## 系统要求

- Linux VPS (Ubuntu 20.04+ / CentOS 7+ / Debian 11+)
- Node.js 18+
- Python 3.9+ (用于 yt-dlp)
- ffmpeg (用于视频合并)
- 至少 1GB RAM，2GB 推荐

## 快速部署

### 方式一：自动脚本

```bash
# 上传项目到服务器
scp -r ./videopass root@your-server:/opt/videopass

# 登录服务器
ssh root@your-server

# 运行部署脚本
cd /opt/videopass
chmod +x deploy/setup.sh
sudo ./deploy/setup.sh
```

### 方式二：手动部署

```bash
# 1. 安装系统依赖
apt update
apt install -y python3 python3-pip ffmpeg curl

# 2. 安装 yt-dlp
pip3 install yt-dlp

# 3. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. 上传项目并安装依赖
cd /opt/videopass
npm install --production

# 5. 构建
npm run build

# 6. 启动
NODE_ENV=production PORT=3000 npm start
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务端口 |
| `NODE_ENV` | production | 运行环境 |
| `YT_DLP_PATH` | 自动检测 | yt-dlp 二进制路径 |

## systemd 服务管理

```bash
# 查看状态
systemctl status videopass

# 启动/停止/重启
systemctl start videopass
systemctl stop videopass
systemctl restart videopass

# 查看日志
journalctl -u videopass -f

# 开机自启
systemctl enable videopass
```

## 反向代理 (Nginx)

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
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

## 常见问题

### yt-dlp 找不到
```bash
which yt-dlp
# 如果输出为空，安装:
pip3 install yt-dlp
# 或指定路径:
export YT_DLP_PATH=/usr/local/bin/yt-dlp
```

### ffmpeg 找不到
```bash
which ffmpeg
# 如果输出为空，安装:
apt install ffmpeg
```

### 下载失败
```bash
# 更新 yt-dlp
pip3 install -U yt-dlp
```

### 端口被占用
```bash
# 查看占用端口的进程
lsof -i :3000
# 杀掉进程
kill -9 <PID>
```

## HTTPS 配置 (Let's Encrypt)

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com

# 自动续期
certbot renew --dry-run
```

## 监控

```bash
# 查看资源使用
htop

# 查看磁盘空间 (临时文件会占用空间)
df -h

# 清理旧的临时文件
find /tmp/videopass-* -mtime +1 -exec rm -rf {} \;
```
