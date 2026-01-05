/**
 * 截图渲染器
 * 统一入口，负责调度各渲染模式
 */

import type { RenderConfig, RenderContext, SubtitleItem, DisplayMode } from './types';
import { getMode, hasMode } from './modes';

/**
 * 截图渲染器类
 */
export class ScreenshotRenderer {
  private config: RenderConfig;

  constructor(config: RenderConfig) {
    this.config = config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RenderConfig {
    return { ...this.config };
  }

  /**
   * 渲染截图
   */
  render(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    subs: SubtitleItem[]
  ): void {
    const mode = getMode(this.config.displayMode);

    if (!mode) {
      console.warn(`Unknown display mode: ${this.config.displayMode}, falling back to overlay`);
      const fallbackMode = getMode('overlay');
      if (fallbackMode) {
        fallbackMode.render(this.createContext(canvas, ctx, img, subs));
      }
      return;
    }

    mode.render(this.createContext(canvas, ctx, img, subs));
  }

  /**
   * 创建渲染上下文
   */
  private createContext(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    subs: SubtitleItem[]
  ): RenderContext {
    return {
      canvas,
      ctx,
      img,
      subs,
      config: this.config
    };
  }

  /**
   * 静态方法：检查模式是否可用
   */
  static isModeAvailable(mode: DisplayMode): boolean {
    return hasMode(mode);
  }
}

/**
 * 创建渲染器的工厂函数
 */
export function createScreenshotRenderer(config: RenderConfig): ScreenshotRenderer {
  return new ScreenshotRenderer(config);
}

/**
 * 便捷的渲染函数（无需创建实例）
 */
export function renderScreenshot(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  subs: SubtitleItem[],
  config: RenderConfig
): void {
  const renderer = new ScreenshotRenderer(config);
  renderer.render(canvas, ctx, img, subs);
}
