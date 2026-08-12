FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye

# Install required CLI tools for Claude Code
RUN apt-get update && apt-get install -y \
    ripgrep \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# npm グローバル領域の所有権を node ユーザーに変更
RUN chown -R node:node /usr/local/lib/node_modules /usr/local/bin

# node ユーザーに切り替えてから Claude Code をインストール
USER node
RUN npm install -g @anthropic-ai/claude-code