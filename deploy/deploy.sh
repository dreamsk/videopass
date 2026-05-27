#!/bin/bash
# ============================================
# VideoPass 一键部署脚本
# 使用方法:
#   1. 将项目上传到服务器 /opt/videopass
#   2. 执行: chmod +x /opt/videopass/deploy/deploy.sh
#   3. 执行: sudo /opt/videopass/deploy/deploy.sh
# ============================================

set -e

PROJECT_DIR="/opt/videopass"
PORT="${PORT:-3000}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       VideoPass 一键部署脚本             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 检查是否 root
if [ "$EUID" -ne 0 ]; then
    echo "请使用 sudo 执行此脚本"
    exit 1
fi

# 进入项目目录
cd "$PROJECT_DIR" || { echo "项目目录不存在: $PROJECT_DIR"; exit 1; }

# ---- 1. 安装系统依赖 ----
echo "[1/7] 安装系统依赖..."
if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip ffmpeg curl > /dev/null 2>&1
elif command -v yum &> /dev/null; then
    yum install -y -q python3 python3-pip ffmpeg curl > /dev/null 2>&1
elif command -v dnf &> /dev/null; then
    dnf install -y -q python3 python3-pip ffmpeg curl > /dev/null 2>&1
else
    echo "错误: 不支持的系统，请手动安装 python3, pip3, ffmpeg"
    exit 1
fi
echo "  ✓ 系统依赖安装完成"

# ---- 2. 安装 yt-dlp ----
echo "[2/7] 安装 yt-dlp..."
pip3 install --break-system-packages yt-dlp 2>/dev/null || pip3 install yt-dlp 2>/dev/null
YT_DLP_VER=$(yt-dlp --version 2>/dev/null || echo "未知")
echo "  ✓ yt-dlp $YT_DLP_VER"

# ---- 3. 安装 Node.js ----
echo "[3/7] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "  安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1 || yum install -y -q nodejs > /dev/null 2>&1
fi
echo "  ✓ Node.js $(node --version)"

# ---- 4. 安装项目依赖 ----
echo "[4/7] 安装项目依赖..."
npm install --production --silent
echo "  ✓ 依赖安装完成"

# ---- 5. 构建项目 ----
echo "[5/7] 构建项目..."
npm run build
echo "  ✓ 构建完成"

# ---- 6. 创建 systemd 服务 ----
echo "[6/7] 配置系统服务..."
cat > /etc/systemd/system/videopass.service << EOF
[Unit]
Description=VideoPass - 视频提取服务
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=YT_DLP_PATH=$(which yt-dlp)
ExecStart=$(which node) $PROJECT_DIR/node_modules/.bin/next start -p $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable videopass > /dev/null 2>&1
systemctl restart videopass
echo "  ✓ 服务配置完成"

# ---- 7. 验证 ----
echo "[7/7] 验证部署..."
sleep 3
if systemctl is-active --quiet videopass; then
    echo "  ✓ 服务运行正常"
else
    echo "  ✗ 服务启动失败，查看日志: journalctl -u videopass -n 20"
    exit 1
fi

# 获取服务器 IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║           部署完成!                      ║"
echo "╠══════════════════════════════════════════╣"
echo "║  访问地址: http://$SERVER_IP:$PORT"
echo "║                                          ║"
echo "║  常用命令:                               ║"
echo "║    查看状态: systemctl status videopass  ║"
echo "║    查看日志: journalctl -u videopass -f  ║"
echo "║    重启服务: systemctl restart videopass ║"
echo "║    停止服务: systemctl stop videopass    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
