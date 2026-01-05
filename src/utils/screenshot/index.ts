/**
 * 截图渲染模块
 *
 * 支持多种显示模式：
 * - overlay: 叠加式，字幕直接渲染在画面上
 * - separated: 分离式，字幕显示在图片下方独立区域
 * - card: 卡片式，带引号装饰和来源信息
 * - stitch: 拼接式，首图完整，后续只显示字幕区域
 *
 * 架构设计：
 * - 高内聚：每个模式独立文件，包含完整的渲染逻辑
 * - 低耦合：模式之间互不依赖，共享逻辑通过基类复用
 * - 开闭原则：新增模式只需创建文件并注册，无需修改现有代码
 *
 * @example
 * ```typescript
 * import { ScreenshotRenderer } from '@/utils/screenshot';
 *
 * const renderer = new ScreenshotRenderer(config);
 * renderer.render(canvas, ctx, img, subtitles);
 * ```
 */

// 主渲染器
export { ScreenshotRenderer, createScreenshotRenderer, renderScreenshot } from './ScreenshotRenderer';

// 类型定义
export type {
  DisplayMode,
  SeparatorStyle,
  RGBColor,
  SubtitleStyle,
  RenderConfig,
  RenderContext,
  IRenderMode,
  RenderModeConstructor,
  SubtitleItem
} from './types';

// 模式注册 API（用于扩展）
export { registerMode, getMode, getRegisteredModes, hasMode } from './modes';

// 颜色工具（用于扩展或自定义模式）
export { sampleBottomColor, getContrastTextColor, rgbToString } from './colorUtils';

// 基类（用于扩展自定义模式）
export { BaseRenderer } from './BaseRenderer';
export type { ScaleContext } from './BaseRenderer';

// 内置模式（用于直接使用或继承扩展）
export { OverlayMode, SeparatedMode, CardMode, StitchMode } from './modes';
