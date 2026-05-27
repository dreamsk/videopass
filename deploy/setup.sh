#!/bin/bash
# VideoPass - Linux VPS 部署脚本
# 使用方法: chmod +x deploy/setup.sh && sudo ./deploy/setup.sh

set -e

echo "=== VideoPass 部署脚本 ==="

# 1. 安装系统依赖
echo "[1/6] 安装系统依赖..."
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y python3 python3-pip ffmpeg curl git
elif command -v yum &> /dev/null; then
    yum install -y python3 python3-pip ffmpeg curl git
elif command -v dnf &> /dev/null; then
    dnf install -y python3 python3-pip ffmpeg curl git
else
    echo "不支持的包管理器，请手动安装: python3, pip3, ffmpeg"
    exit 1
fi

# 2. 安装 yt-dlp
echo "[2/6] 安装 yt-dlp..."
pip3 install --break-system-packages yt-dlp 2>/dev/null || pip3 install yt-dlp
yt-dlp --version

# 3. 安装 Node.js (如果未安装)
if ! command -v node &> /dev/null; then
    echo "[3/6] 安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null
else
    echo "[3/6] Node.js 已安装: $(node --version)"
fi

# 4. 安装 npm 依赖
echo "[4/6] 安装 npm 依赖..."
cd /opt/videopass 2>/dev/null || cd "$(dirname "$0")/.."
npm install --production

# 5. 构建项目
echo "[5/6] 构建项目..."
npm run build

# 6. 创建 systemd 服务
echo "[6/6] 创建 systemd 服务..."
cat > /etc/systemd/system/videopass.service << 'EOF'
[Unit]
Description=VideoPass - Video Extraction Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/videopass
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=YT_DLP_PATH=/usr/local/bin/yt-dlp
ExecStart=/usr/bin/node /opt/videopass/node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable videopass
systemctl start videopass

echo ""
echo "=== 部署完成 ==="
echo "服务状态: systemctl status videopass"
echo "访问地址: http://$(hostname -I | awk '{print $1}'):3000"
echo "查看日志: journalctl -u videopass -f"
