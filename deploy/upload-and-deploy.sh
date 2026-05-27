#!/bin/bash
# ============================================
# VideoPass 本地上传并远程部署
# 使用方法:
#   chmod +x deploy/upload-and-deploy.sh
#   ./deploy/upload-and-deploy.sh <服务器IP> [用户名]
# ============================================

set -e

SERVER="${1:?用法: $0 <服务器IP> [用户名]}"
USER="${2:-root}"
REMOTE_DIR="/opt/videopass"
LOCAL_DIR="$(dirname "$0")/.."

echo ""
echo "=== VideoPass 上传部署 ==="
echo "服务器: $USER@$SERVER"
echo "目录:   $REMOTE_DIR"
echo ""

# 1. 上传项目文件
echo "[1/3] 上传项目文件..."
ssh "$USER@$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    "$LOCAL_DIR/" "$USER@$SERVER:$REMOTE_DIR/"
echo "  ✓ 上传完成"

# 2. 远程执行部署脚本
echo "[2/3] 远程执行部署..."
ssh "$USER@$SERVER" "chmod +x $REMOTE_DIR/deploy/deploy.sh && sudo $REMOTE_DIR/deploy/deploy.sh"

# 3. 完成
echo ""
echo "[3/3] 部署完成!"
echo "访问地址: http://$SERVER:3000"
echo ""
