#!/bin/bash
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Verboo 发布脚本${NC}\n"

# 检查 gh CLI 是否安装
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ 请先安装 GitHub CLI: brew install gh${NC}"
    exit 1
fi

# 检查 gh 是否已登录
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ 请先登录 GitHub CLI: gh auth login${NC}"
    exit 1
fi

# 检查是否有未提交的更改
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠️  检测到未提交的更改：${NC}"
    git status --short
    read -p "是否继续发布？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 从 package.json 读取版本号
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

echo -e "${GREEN}📦 版本: $TAG${NC}\n"

# 检查 tag 是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}❌ Tag $TAG 已存在！请先更新 package.json 中的版本号${NC}"
    exit 1
fi

# 获取仓库信息
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "${GREEN}📁 仓库: $REPO${NC}\n"

# Step 1: 构建 macOS
echo -e "${YELLOW}🔨 [1/5] 构建 macOS 版本（签名 + 公证）...${NC}"
npm run dist:mac

# Step 2: 创建并推送 tag
echo -e "\n${YELLOW}🏷️  [2/5] 创建 tag $TAG 并推送...${NC}"
git tag "$TAG"
git push origin "$TAG"

# Step 3: 等待 CI 创建 Release
echo -e "\n${YELLOW}⏳ [3/5] 等待 CI 完成并创建 Release...${NC}"
echo "这可能需要几分钟，你可以在这里查看进度："
echo "https://github.com/$REPO/actions"

# 等待 Release 创建（最多等待 10 分钟）
MAX_WAIT=600
WAITED=0
INTERVAL=15

while [ $WAITED -lt $MAX_WAIT ]; do
    if gh release view "$TAG" --repo "$REPO" &> /dev/null; then
        echo -e "\n${GREEN}✅ Release $TAG 已创建${NC}"
        break
    fi
    echo -n "."
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "\n${YELLOW}⚠️  等待超时，但 tag 已推送。CI 可能还在运行。${NC}"
    echo "请稍后手动上传 macOS 文件到 Release："
    echo "https://github.com/$REPO/releases/tag/$TAG"
    exit 0
fi

# Step 4: 上传 macOS 文件
echo -e "\n${YELLOW}📤 [4/5] 上传 macOS 文件到 Release...${NC}"

# 查找并上传文件
for file in release/*.dmg release/*.zip release/latest-mac.yml; do
    if [ -f "$file" ]; then
        echo "上传: $file"
        gh release upload "$TAG" "$file" --repo "$REPO" --clobber
    fi
done

# Step 5: 发布 Release（从 draft 变为正式发布）
echo -e "\n${YELLOW}🎉 [5/5] 发布 Release...${NC}"
gh release edit "$TAG" --repo "$REPO" --draft=false

echo -e "\n${GREEN}✅ 发布完成！${NC}"
echo "https://github.com/$REPO/releases/tag/$TAG"
