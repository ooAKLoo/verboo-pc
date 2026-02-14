---
name: extract-product-ui
description: 分析当前项目的 UI 源码，提取页面组件为 React + Tailwind 文件，供 OVideo 视频制作使用
metadata:
  tags: product-ui, ui-extraction, video-demo, react
---

# 提取产品 UI 为 React 页面组件

当用户说「提取页面原型」「提取产品 UI」「generate ovideo pages」或类似指令时，按以下流程分析当前项目的源码，将 UI 直接输出为 React 页面组件文件树。

**核心理念**：不经过 JSON 中间层，直接产出 React 组件——与手工制作 BilibiliPage/VerbooLayout 相同的模式。

---

## 输出结构

```
.ovideo/
├── pages/
│   ├── {Product}Page.tsx       # 页面组件 (AbsoluteFill + absolute positioning)
│   ├── {Product}Layout.ts      # 布局常量 (1920×1080 坐标、品牌色、圆角)
│   ├── {Product}Icons.tsx      # 品牌 SVG 图标组件
│   └── index.ts                # Barrel exports
├── mock/
│   ├── types.ts                # TypeScript interfaces
│   └── data.ts                 # Mock 数据 (1 主场景 + 4-8 列表)
└── interactions.md             # 交互流程文档 (供后续制作 Scene 参考)
```

`{Product}` 为产品名的 PascalCase，如 `Verboo`、`Bilibili`、`Notion`。

---

## 提取流程

### Step 1：项目侦察

快速了解项目结构：

```bash
# 确定前端框架和目录结构
ls src/ app/ pages/ components/ 2>/dev/null
```

重点识别：
- **框架**：React / Vue / Svelte / Angular / 其他
- **样式方案**：Tailwind / CSS Modules / Styled Components / 原生 CSS
- **路由结构**：页面列表
- **组件目录**：可复用组件位置
- **图标库**：lucide-react / heroicons / 自定义 SVG

### Step 2：识别核心页面

阅读路由配置或页面目录，列出 3-5 个最能展示产品价值的核心页面。

**优先级**：
1. 主界面/仪表盘 — 展示产品全貌
2. 核心功能页 — 最有价值的交互
3. 编辑/创建页 — 用户深度操作的界面
4. 设置/个人页 — 可选

**输出**：确定要提取的页面列表，每个页面记录：
- 页面名
- 路由路径
- 主要组件文件位置
- 一句话描述

### Step 3：提取布局 → 生成 `{Product}Layout.ts`

从页面组件中提取布局常量，输出为 TypeScript 常量文件。

**提取来源**：

| 样式方案 | 查找位置 |
|----------|----------|
| Tailwind | 组件中的 className（如 `w-64` = 256px） |
| CSS Modules | `.module.css` 中的固定尺寸 |
| Styled Components | 模板字符串中的像素值 |
| 内联样式 | `style={{ width: 256 }}` |
| 主题配置 | `tailwind.config.js`、`theme.ts` 等 |

**画布映射**：将响应式布局"冻结"到 1920×1080 画布：

```
源代码: <div className="w-64 mr-3">  // 256px width, 12px margin-right
Tailwind 换算: w-64 = 256px

在 1920×1080 画布上:
  sidebar: { x: 12, y: 52, width: 256, height: 1016 }
  main:    { x: 280, y: 52, width: 1296, height: 1016 }
```

**输出文件格式**（参考 `VerbooLayout.ts`）：

```typescript
// .ovideo/pages/{Product}Layout.ts

// ─── Canvas ───────────────────────────────────────
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

// ─── Spacing ──────────────────────────────────────
const TITLE_BAR_HEIGHT = 52;
const OUTER_PADDING = 12;
const SIDEBAR_WIDTH = 256;
const GAP = 12;

// ─── Computed ─────────────────────────────────────
const CONTENT_TOP = TITLE_BAR_HEIGHT;
const CONTENT_HEIGHT = CANVAS_HEIGHT - TITLE_BAR_HEIGHT;
const MAIN_LEFT = OUTER_PADDING + SIDEBAR_WIDTH + GAP;
const MAIN_WIDTH = CANVAS_WIDTH - OUTER_PADDING * 2 - SIDEBAR_WIDTH - GAP;

// ─── Master Layout ────────────────────────────────
export const {PRODUCT}_LAYOUT = {
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  titleBar: { height: TITLE_BAR_HEIGHT },
  padding: OUTER_PADDING,
  gap: GAP,
  cornerRadius: 16,

  sidebar: {
    x: OUTER_PADDING,
    y: CONTENT_TOP,
    width: SIDEBAR_WIDTH,
    height: CONTENT_HEIGHT - OUTER_PADDING,
  },
  main: {
    x: MAIN_LEFT,
    y: CONTENT_TOP,
    width: MAIN_WIDTH,
    height: CONTENT_HEIGHT - OUTER_PADDING,
  },
  // ... 更多区域
};

// ─── Colors ───────────────────────────────────────
export const {PRODUCT}_COLORS = {
  background: "#f5f5f5",
  card: "#ffffff",
  text: "#18181b",
  textSecondary: "#71717a",
  textMuted: "#a1a1aa",
  accent: "#18181b",
  border: "#e4e4e7",
  danger: "#ef4444",
  warning: "#f59e0b",
  // ... 提取自源码的真实颜色值
};
```

**必须包含的内容**：
- `CANVAS_WIDTH` / `CANVAS_HEIGHT`（固定 1920×1080）
- 每个页面区域的 `{ x, y, width, height }` 坐标
- `{PRODUCT}_COLORS` 对象，至少包含：background, card, text, textSecondary, accent, border（6+ 个颜色）
- 计算过程的中间常量（方便后续调整）
- 圆角、间距等 token

### Step 4：提取品牌图标/Logo → 生成 `{Product}Icons.tsx`

从源项目中提取品牌专属的 SVG 图标和 Logo。

**提取策略**：
1. 在源项目中搜索 Logo/品牌图标组件或 SVG 文件
2. 提取 SVG path data
3. 转换为 React 函数组件

**输出文件格式**（参考 `BilibiliIcons.tsx`）：

```tsx
// .ovideo/pages/{Product}Icons.tsx
import React from "react";

export const {Product}Logo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 32"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M..." fill="#brand-color" />
  </svg>
);

// 产品特有的 SVG 图标（非 lucide-react 中有的）
export const CustomIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" className={className}>
    <path d="M..." fill="currentColor" />
  </svg>
);
```

**规则**：
- 每个图标是独立的 React 函数组件
- Props 接口统一为 `{ className?: string }`
- 使用 `currentColor` 作为 fill（除非是品牌色 Logo）
- 支持通过 `className` 控制尺寸（如 `className="w-8 h-8"`）
- 通用图标（箭头、搜索、关闭等）使用 `lucide-react`，不在此文件中重复定义

**如果源项目没有自定义图标**：可以只导出 Logo，甚至可以省略此文件（在 `index.ts` 中不导出即可）。

### Step 5：提取 Mock 数据 → 生成 `mock/types.ts` + `mock/data.ts`

从源项目中提取数据模型和样本数据。

**数据来源优先级**：
1. **Mock/Seed 数据** — 项目中的 `mock/`, `fixtures/`, `seed/` 目录
2. **Storybook 数据** — `.stories.tsx` 中的 args/props
3. **API 响应类型** — TypeScript interface / type 定义
4. **手动创建** — 基于 schema 构造合理的样本数据

**输出 `mock/types.ts`**：

```typescript
// .ovideo/mock/types.ts

export interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;       // "12:34" 格式
  author: string;
  views: string;          // "1.2万" 格式
  uploadedAt: string;
}

export interface UserProfile {
  name: string;
  avatar: string;
  level: number;
}

// ... 更多 interface
```

**输出 `mock/data.ts`**：

```typescript
// .ovideo/mock/data.ts
import type { VideoItem, UserProfile } from "./types";

export const MOCK_USER: UserProfile = {
  name: "示例用户",
  avatar: "/placeholder-avatar.png",
  level: 5,
};

export const MOCK_VIDEOS: VideoItem[] = [
  {
    id: "v1",
    title: "如何用 AI 提升编程效率",
    thumbnail: "/placeholder-1.jpg",
    duration: "12:34",
    author: "Tech Channel",
    views: "1.2万",
    uploadedAt: "2024-01-15",
  },
  // ... 4-8 条数据
];
```

**规则**：
- 数据内容应该尽量真实/贴近产品主题（不要用 Lorem ipsum）
- 图片路径用占位符（`/placeholder-*.jpg`），不引用外部 URL
- 列表数据至少 4 条，最多 8 条
- 日期、数字格式与源项目一致

### Step 6：构建页面组件 → 生成 `{Product}Page.tsx`

这是**核心输出**。直接用 React + Tailwind 1:1 复刻页面，精度目标是**静态原型级别**——截图后与真实产品难以区分。

**⚠️ 视觉完整度原则**：

Page 组件不是线框图，不是"大区域定位对了就行"。页面上**每一个肉眼可见的 UI 元素都必须渲染**：

```
✅ 正确粒度（每个元素都在）          ❌ 错误粒度（只有容器壳）
┌─ Sidebar ──────────────┐          ┌─ Sidebar ──────────────┐
│ 👤 作者头像 + ✓认证徽章  │          │                        │
│ "科技频道" ⟨粉丝 12.3万⟩│          │  {/* Sidebar content */}│
│ [关注] [私信]           │          │                        │
│ ─────────────────────  │          └────────────────────────┘
│ 推荐视频 1 🖼️ 3:42     │
│ 推荐视频 2 🖼️ 7:15     │
│ 推荐视频 3 🖼️ 12:08    │
│ [查看更多]              │
└────────────────────────┘
```

**必须渲染的元素类型**：
- 文字：标题、副标题、描述文字、标签、计数（"1.2万 播放"）
- 图标：导航图标、功能图标、状态指示器
- 头像/缩略图：用纯色圆形/矩形占位 + 尺寸正确
- 徽章/Badge：通知数、认证标记、VIP 标识
- 按钮：按钮文字 + 背景色 + 圆角
- 列表项：如果源码有 4 项，输出也要有 4 项（从 mock data 渲染）
- 分割线、间距、圆角 — 这些构成视觉节奏，不可省略

**构建方法**：

**源项目是 React + Tailwind**：
- 直接复制 JSX 结构
- 直接复制 className
- 移除交互逻辑（onClick、useState 等），保留纯静态渲染
- 将 API 数据替换为 Mock 数据导入

**源项目是 React + CSS Modules**：
- 复制 JSX 结构
- 将 `.module.css` 中的样式转为 Tailwind className 或 inline style
- 优先使用 Tailwind，复杂样式（如渐变、box-shadow）用 inline style

**源项目是 Vue**：
- `<template>` → JSX（v-if → 三元、v-for → .map、:class → className）
- `<style scoped>` → Tailwind className 或 inline style
- `<script>` 中的 computed/data → 直接内联或用 Mock 数据替代

**源项目是 Svelte**：
- `{#each}` → `.map()`，`{#if}` → 三元
- `<style>` → Tailwind className
- `$:` reactive → 直接内联值

**源项目是 Angular**：
- `*ngFor` → `.map()`，`*ngIf` → 三元
- `[ngClass]` → className
- Component styles → Tailwind

**输出文件格式**（参考 `BilibiliPage.tsx`）：

```tsx
// .ovideo/pages/{Product}Page.tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { Search, Bell, Settings, ChevronDown, Play, Star } from "lucide-react";
import { {Product}Logo } from "./{Product}Icons";
import { {PRODUCT}_LAYOUT, {PRODUCT}_COLORS } from "./{Product}Layout";
import { MOCK_ITEMS, MOCK_USER } from "../mock/data";

export interface {Product}PageProps {
  // 可选 props，用于后续 Scene 组件控制 UI 状态
  highlightRegion?: string;
  showToast?: boolean;
}

export const {Product}Page: React.FC<{Product}PageProps> = ({
  highlightRegion,
  showToast = false,
}) => {
  const layout = {PRODUCT}_LAYOUT;
  const colors = {PRODUCT}_COLORS;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>

      {/* ── Title Bar ──────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: layout.canvas.width,
          height: layout.titleBar.height,
          backgroundColor: colors.card,
        }}
        className="flex items-center justify-between px-5"
      >
        {/* 左：Logo + 导航 */}
        <div className="flex items-center gap-6">
          <{Product}Logo className="h-6" />
          <nav className="flex items-center gap-4">
            <span className="text-sm font-medium" style={{ color: colors.text }}>首页</span>
            <span className="text-sm" style={{ color: colors.textSecondary }}>功能</span>
            <span className="text-sm" style={{ color: colors.textSecondary }}>模板</span>
          </nav>
        </div>
        {/* 右：搜索 + 头像 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: colors.background }}>
            <Search className="w-3.5 h-3.5" style={{ color: colors.textMuted }} />
            <span className="text-xs" style={{ color: colors.textMuted }}>搜索...</span>
          </div>
          <Bell className="w-4 h-4" style={{ color: colors.textSecondary }} />
          <div className="w-7 h-7 rounded-full" style={{ backgroundColor: colors.accent }} />
        </div>
      </div>

      {/* ── Sidebar ────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: layout.sidebar.y,
          left: layout.sidebar.x,
          width: layout.sidebar.width,
          height: layout.sidebar.height,
          borderRadius: layout.cornerRadius,
          backgroundColor: colors.card,
        }}
        className="p-3 flex flex-col gap-1"
      >
        {/* 每个导航项都要渲染 — 图标 + 文字 + 选中态 */}
        {["项目", "素材", "模板", "设置"].map((item, i) => (
          <div
            key={item}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
            style={{
              backgroundColor: i === 0 ? colors.background : "transparent",
              color: i === 0 ? colors.text : colors.textSecondary,
            }}
          >
            <Star className="w-4 h-4" />
            <span className="text-xs font-medium">{item}</span>
            {i === 0 && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: colors.accent, color: "#fff" }}>
                3
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Main Content ───────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: layout.main.y,
          left: layout.main.x,
          width: layout.main.width,
          height: layout.main.height,
          borderRadius: layout.cornerRadius,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
        className="p-4"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: colors.text }}>我的项目</h2>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: colors.accent }}>
              新建项目
            </div>
          </div>
        </div>

        {/* 列表/卡片 — 从 mock data 渲染，每条都要有完整内容 */}
        <div className="flex flex-col gap-2">
          {MOCK_ITEMS.slice(0, 4).map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg"
              style={{ backgroundColor: colors.background }}>
              {/* 缩略图 */}
              <div className="w-16 h-10 rounded-md flex-shrink-0"
                style={{ backgroundColor: colors.border }} />
              {/* 文字信息 */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: colors.text }}>
                  {item.title}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: colors.textMuted }}>
                  {item.date} · {item.size}
                </div>
              </div>
              {/* 状态/操作 */}
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.background, color: colors.textSecondary }}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </AbsoluteFill>
  );
};
```

注意示例中的关键差异（对比空壳写法）：
- **Sidebar**：不是 `{/* Sidebar content */}` 注释，而是渲染了每一个导航项（图标 + 文字 + badge）
- **Title Bar**：不是只有 Logo + 2 图标，而是有导航链接、搜索框、头像占位
- **Main Content**：不是空 div，而是有标题栏、按钮、4 条列表项（从 mock 渲染，每条有缩略图 + 标题 + 日期 + 状态标签）
- **颜色全部引用 `colors.*`**，字号/圆角用 Tailwind

**关键规则**：

1. **容器**：必须用 `<AbsoluteFill>` 包裹（来自 `remotion`）
2. **定位**：所有区域用 `position: "absolute"` + `top/left/width/height`（从 Layout 引用）
3. **样式混合**：定位用 inline style，装饰用 Tailwind className
4. **图标**：通用图标用 `lucide-react`，品牌图标从 `{Product}Icons` 导入
5. **数据**：从 `../mock/data` 导入，不硬编码在组件中
6. **颜色**：从 `{PRODUCT}_COLORS` 引用，不硬编码色值
7. **无交互**：不要 `onClick`、`useState`、`useEffect`（纯渲染组件）
8. **无动画**：不要 `useCurrentFrame`、`spring`、`interpolate`（动画在后续 Scene 组件中添加）

### Step 7：记录交互流程 → 生成 `interactions.md`

提取产品的核心交互流程，用 Markdown 文档记录，供后续制作 Scene 时参考。

**提取来源**：
- 事件处理函数（onClick、onSubmit 等）
- 状态管理逻辑（useState、Redux action、Vuex mutation）
- 路由跳转
- API 调用

**输出格式**：

```markdown
# {Product} 交互流程

## 1. 一键截图
- **触发方式**：快捷键 ⌘S 或点击截图按钮
- **视觉反馈**：
  1. 屏幕白闪 200ms
  2. Toast 弹出："已保存到截图库"（顶部居中，2s 后消失）
  3. 侧边栏截图数量 badge +1
- **涉及区域**：main（闪白）、toast（弹出）、sidebar（badge 更新）

## 2. Tab 切换
- **触发方式**：点击 Tab 标签
- **视觉反馈**：
  1. 当前 Tab 高亮切换（滑动指示器 200ms）
  2. 内容区域淡入切换（300ms）
- **涉及区域**：infoPanel.tabs

## 3. 打开编辑弹窗
- **触发方式**：双击截图卡片
- **视觉反馈**：
  1. 背景 backdrop 模糊（300ms）
  2. 弹窗从 scale(0.95) 弹入（spring）
- **涉及区域**：dialog（全屏覆盖）

...
```

**规则**：
- 每个交互记录触发方式、视觉反馈步骤、涉及的 UI 区域
- 选择 3-5 个最有展示价值的交互
- 视觉反馈的描述要具体（duration、动画类型、位置）
- 这些信息将用于后续 Scene 组件的动画编排

### Step 8：生成 `index.ts` barrel exports

```typescript
// .ovideo/pages/index.ts

// Page component
export { {Product}Page } from "./{Product}Page";
export type { {Product}PageProps } from "./{Product}Page";

// Layout & Colors
export { {PRODUCT}_LAYOUT, {PRODUCT}_COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "./{Product}Layout";

// Icons (如果有)
export { {Product}Logo } from "./{Product}Icons";
```

---

## 框架转换指南

### React + Tailwind（最简单）

直接复制 JSX + className，移除交互逻辑：

```tsx
// 源码
<button onClick={handleClick} className="bg-blue-500 text-white rounded-lg px-4 py-2">
  {isLoading ? <Spinner /> : "保存"}
</button>

// 输出（去掉 onClick，静态化）
<div className="bg-blue-500 text-white rounded-lg px-4 py-2">保存</div>
```

### React + CSS Modules

将 `styles.xxx` 转为 Tailwind 或 inline style：

```tsx
// 源码
<div className={styles.sidebar}>

// .module.css
.sidebar { width: 256px; background: white; border-radius: 12px; padding: 16px; }

// 输出
<div className="bg-white rounded-xl p-4" style={{ width: 256 }}>
```

### Vue SFC

```vue
<!-- 源码 -->
<template>
  <div :class="{ active: isActive }" v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>
</template>
```

```tsx
// 输出
{items.map(item => (
  <div key={item.id} className="...">
    {item.name}
  </div>
))}
```

### Svelte

```svelte
<!-- 源码 -->
{#each items as item}
  <div class:active={item.isActive}>{item.name}</div>
{/each}
```

```tsx
// 输出
{items.map(item => (
  <div key={item.id} className={item.isActive ? "..." : "..."}>{item.name}</div>
))}
```

### Angular

```html
<!-- 源码 -->
<div *ngFor="let item of items" [ngClass]="{'active': item.isActive}">
  {{ item.name }}
</div>
```

```tsx
// 输出
{items.map(item => (
  <div key={item.id} className={item.isActive ? "..." : "..."}>{item.name}</div>
))}
```

**输出始终是 React + Tailwind + lucide-react，无论源项目用什么框架。**

---

## 多页面处理

如果产品有多个核心页面（如主界面 + 编辑器 + 设置页），有两种策略：

### 策略 A：单文件多状态（推荐，适合页面结构相似）

```tsx
export interface {Product}PageProps {
  view?: "main" | "editor" | "settings";
}

export const {Product}Page: React.FC<{Product}PageProps> = ({ view = "main" }) => {
  return (
    <AbsoluteFill>
      {/* 共享的 Title Bar */}
      <TitleBar />

      {/* 根据 view 切换内容区域 */}
      {view === "main" && <MainView />}
      {view === "editor" && <EditorView />}
      {view === "settings" && <SettingsView />}
    </AbsoluteFill>
  );
};
```

### 策略 B：多文件（适合页面差异大）

```
.ovideo/pages/
├── {Product}MainPage.tsx
├── {Product}EditorPage.tsx
├── {Product}Layout.ts        # 共享布局
├── {Product}Icons.tsx         # 共享图标
└── index.ts
```

---

## 提取质量检查

生成完所有文件后，逐项验证：

### Layout 检查
- [ ] `CANVAS_WIDTH` = 1920, `CANVAS_HEIGHT` = 1080
- [ ] 每个区域都有 `{ x, y, width, height }` 坐标
- [ ] 坐标之间没有重叠或间隙异常
- [ ] `{PRODUCT}_COLORS` 包含至少 6 个颜色（background, card, text, textSecondary, accent, border）
- [ ] 颜色值来自源码（不是猜测的）

### Icons 检查
- [ ] Logo SVG 路径完整，可正确渲染
- [ ] 每个图标组件接受 `{ className?: string }` prop
- [ ] 使用 `currentColor` 的图标可以通过 Tailwind 控制颜色

### Page 检查 — 结构
- [ ] 根容器是 `<AbsoluteFill>`
- [ ] 所有区域使用 `position: "absolute"` + 像素坐标
- [ ] 坐标值引用自 Layout 常量（不是硬编码数字）
- [ ] 颜色引用自 `{PRODUCT}_COLORS`（不是硬编码色值）
- [ ] 图标使用 `lucide-react`（通用图标）或 `{Product}Icons`（品牌图标）
- [ ] 无 `onClick`、`useState`、`useEffect`（纯渲染）
- [ ] 无 `useCurrentFrame`、`spring`、`interpolate`（无动画）
- [ ] 数据来自 `mock/data.ts` 导入

### Page 检查 — 视觉完整度（⚠️ 最关键）
- [ ] **无空壳区域**：没有任何 `{/* content */}` 注释占位——每个区域内部元素都已渲染
- [ ] **文字内容完整**：标题、副标题、标签、计数等文字都有真实内容（来自 mock）
- [ ] **列表/卡片完整**：如果源码有 N 项列表，Page 中也渲染了 N 项（从 mock data .map）
- [ ] **小元素齐全**：Badge/徽章、头像占位、状态指示器、分割线都已渲染
- [ ] **图标到位**：导航/功能图标使用了具体的 lucide-react 图标（不是空占位）
- [ ] **截图测试**：想象将 Page 截图，能否让不了解项目的人认出"这是 XX 产品"？如果不能，说明细节不够

### Mock 数据检查
- [ ] `types.ts` 中的 interface 与页面渲染所需字段对应
- [ ] `data.ts` 至少 1 个主数据 + 4 条列表数据
- [ ] 数据内容贴近产品主题（不是 Lorem ipsum）
- [ ] 图片路径使用占位符

### Interactions 检查
- [ ] 至少记录 3 个核心交互
- [ ] 每个交互有触发方式、视觉反馈步骤、涉及区域
- [ ] 视觉反馈描述具体（有 duration、动画类型、位置）

---

## 常见问题

### Q: 项目用了自定义组件库，样式很复杂怎么办？

提取最终渲染结果的样式，而不是组件库的抽象层。比如一个 `<Button variant="primary">` 最终渲染为 `bg-blue-600 text-white rounded-lg px-4 py-2`，则在 Page 组件中直接用 Tailwind 类名。

### Q: 项目是响应式的，没有固定像素值怎么办？

选择一个典型视口（如 1440px 宽），用浏览器 DevTools 测量实际渲染的像素值，然后按比例映射到 1920×1080 画布。在 Layout.ts 的注释中记录映射来源。

### Q: 有些交互很复杂（拖拽、多步骤表单），怎么简化？

只提取最能展示产品价值的 "highlight moments"。一个 7 秒的 Scene 只能展示 1-2 个交互，选择最有冲击力的，记录在 `interactions.md` 中。

### Q: 项目没有 lucide-react，用的是其他图标库怎么办？

通用图标（搜索、关闭、箭头等）直接换用 `lucide-react` 中最接近的图标。品牌专属图标提取 SVG path 放入 `{Product}Icons.tsx`。

### Q: 页面太多，全部提取太耗时怎么办？

只提取 3-5 个最有展示价值的页面。优先选择主界面和核心功能页。可以用策略 A（单文件多 view prop）来减少文件数量。

### Q: 输出的组件需要能在 Remotion 中运行吗？

是的。Page 组件使用 `<AbsoluteFill>`（来自 `remotion`），这是唯一的 Remotion 依赖。组件本身是纯静态渲染，不使用 `useCurrentFrame` 等动画 hook。动画在后续制作 Scene 组件时再添加。

### Q: 如何处理图片/视频等媒体资源？

- 小图标/Logo：提取 SVG 放入 `{Product}Icons.tsx`
- 大图片：在 Mock 数据中用占位符路径（如 `/placeholder-1.jpg`），后续由开发者替换为 `staticFile()` 引用的真实资源
- 视频：记录在 `interactions.md` 中，不在 Page 组件中引用

---

## 完整示例参考

最佳参考是 OVideo 项目中已有的 BilibiliPage 和 VerbooLayout 实现：

- **Layout 常量**：`src/compositions/streamui/bilibili/BilibiliLayout.ts`、`src/compositions/streamui/verboo/VerbooLayout.ts`
- **页面组件**：`src/compositions/streamui/bilibili/BilibiliPage.tsx`
- **图标组件**：`src/compositions/streamui/bilibili/BilibiliIcons.tsx`
- **Mock 数据**：`src/data/mock/streamui/bilibili.ts`、`src/data/mock/verboo/index.ts`
- **Barrel exports**：`src/compositions/streamui/bilibili/index.ts`
