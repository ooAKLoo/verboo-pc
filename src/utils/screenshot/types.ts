/**
 * 截图渲染模块 - 类型定义
 */

import type { SubtitleItem } from '../subtitleParser';

/** 显示模式类型 */
export type DisplayMode = 'overlay' | 'separated' | 'card' | 'stitch';

/** 分隔线样式 */
export type SeparatorStyle = 'none' | 'white' | 'black';

/** RGB 颜色 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/** 字幕样式配置 */
export interface SubtitleStyle {
  position: 'top' | 'bottom' | string;
  background: 'semi-transparent' | 'solid' | 'none' | string;
  fontSize: number;
  layout: 'vertical' | string;
}

/** 卡片模式选项 */
export interface CardModeOptions {
  showTimestamp: boolean;
  timestamp?: number;
}

/** 渲染配置 */
export interface RenderConfig {
  subtitleStyle: SubtitleStyle;
  displayMode: DisplayMode;
  stitchSeparator: SeparatorStyle;
  stitchSeparatorWidth: number;
  stitchCropRatio: number;
  videoTitle?: string;
  cardOptions?: CardModeOptions;
}

/** 渲染上下文 - 传递给各模式的渲染数据 */
export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  subs: SubtitleItem[];
  config: RenderConfig;
}

/** 渲染模式接口 - 所有模式必须实现 */
export interface IRenderMode {
  /** 模式名称 */
  readonly name: DisplayMode;

  /** 执行渲染 */
  render(context: RenderContext): void;
}

/** 渲染模式构造函数类型 */
export type RenderModeConstructor = new () => IRenderMode;

// 重新导出 SubtitleItem 类型
export type { SubtitleItem };
