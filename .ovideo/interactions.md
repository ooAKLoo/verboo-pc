# Verboo 交互流程

## 1. URL 导航 (Welcome → Browser)
- **触发方式**：在 Welcome 页面输入 URL 并回车，或点击 YouTube/Bilibili 快捷入口
- **视觉反馈**：
  1. Welcome 页面整体 `opacity: 0` + `scale(0.98)` 退出动画（700ms ease-out）
  2. Sidebar 展开显示视频控制区域（Download/Screenshot/Important/Difficult）
  3. 底部 URL 导航工具栏淡入（500ms ease-out）
  4. 右侧 InfoPanel 从右侧滑入（300ms）
  5. BrowserView 加载目标 URL
- **涉及区域**：welcome（退出）→ sidebar（展开）+ browser（出现）+ infoPanel（滑入）+ navToolbar（淡入）

## 2. 一键截图 (Quick Capture)
- **触发方式**：快捷键 `⌘S` 或点击 Sidebar 中的 Screenshot 按钮
- **视觉反馈**：
  1. 捕获当前视频帧（通过 Electron WCV）
  2. Toast 从顶部中间弹出："已保存到截图库"（pill 形状，深色背景 + Camera 图标，2s 后消失）
  3. InfoPanel 右侧 Asset Tab 的 Badge 数字 +1
  4. 截图自动保存到本地数据库
- **涉及区域**：browser（捕获帧）→ toast（顶部弹出）→ infoPanel.assetBadge（数字更新）

## 3. 标记重点 / 难点
- **触发方式**：`⌘I`（重点，amber 色）或 `⌘D`（难点，red 色）
- **视觉反馈**：
  1. 捕获当前视频帧 + 自动关联当前字幕
  2. Toast 弹出："已标记为重点" / "已标记为难点"
  3. 字幕面板中对应字幕条目左侧出现彩色边线 + 浅色背景
    - 重点：`border-l-2 border-amber-400` + `bg-amber-50/70` + ⭐ 图标
    - 难点：`border-l-2 border-red-400` + `bg-red-50/70` + ⚠ 图标
  4. Asset Badge 数字 +1
- **涉及区域**：browser → toast → infoPanel.subtitleList（高亮标记）→ infoPanel.assetBadge

## 4. 字幕自动跟随
- **触发方式**：视频播放时自动触发（video time update 事件）
- **视觉反馈**：
  1. 字幕列表自动滚动到当前时间对应的字幕（smooth scroll to center）
  2. 当前字幕高亮：`bg-[#fafafa]` + 时间戳颜色变为 `#18181b`
  3. 点击任意字幕条目 → 视频跳转到对应时间点
- **涉及区域**：infoPanel.subtitleList（滚动 + 高亮）

## 5. 切换到素材库 / 字幕库
- **触发方式**：点击 Sidebar 中的 Assets / Subtitles 导航项
- **视觉反馈**：
  1. 暂停视频播放
  2. 隐藏 WebContentsView（Electron 层面）
  3. Browser + InfoPanel + Resizer 消失
  4. 对应面板（Asset Library / Subtitle Library）以全宽模式淡入（fade-in）
  5. Sidebar 导航项高亮切换：`bg-[#f4f4f5]` + 图标/文字变为 `#18181b`
  6. 点击面板右上角 X 关闭 → 返回 Browser 模式
- **涉及区域**：sidebar（高亮切换）→ browser（隐藏）→ mainFull（全宽面板淡入）

## 6. AI 字幕检测
- **触发方式**：在 Bilibili 页面自动检测到 AI 生成字幕时触发
- **视觉反馈**：
  1. 底部中央弹出横幅：白色圆角卡片 + 蓝色脉冲圆点 + "检测到 AI 字幕 (N 条)"
  2. 两个按钮："使用此字幕"（蓝色实心）+ "忽略"（灰色文字）
  3. 点击"使用此字幕" → 字幕面板更新 + Toast "AI字幕已替换"
  4. 点击"忽略" → 横幅消失
- **涉及区域**：aiSubtitleBanner（底部弹出）→ infoPanel.subtitleList（更新）→ toast
