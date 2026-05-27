FROM node:20-slim

# 使用阿里云 apt 镜像源
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list 2>/dev/null || true

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 使用国内 pip 镜像源安装 yt-dlp
RUN pip3 install --break-system-packages --no-cache-dir \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn \
    yt-dlp

# 设置工作目录
WORKDIR /app

# 使用国内 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 复制 package.json（利用 Docker 缓存层）
COPY package.json package-lock.json* ./

# 安装所有依赖（包括构建所需的 devDependencies）
RUN npm install

# 复制项目文件
COPY . .

# 构建
RUN npm run build

# 创建临时目录
RUN mkdir -p /tmp/videopass-streams /tmp/videopass-dy

# 暴露端口
EXPOSE 3000

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# 启动
CMD ["npm", "start"]
