/**
 * 截图渲染模块 - 基础渲染器
 * 提供所有模式共享的渲染工具方法
 */

import type { RenderContext, SubtitleItem, SubtitleStyle } from './types';

/** 最小渲染宽度，保证文字清晰度 */
const MIN_RENDER_WIDTH = 1920;

/** Canvas 缩放上下文 */
export interface ScaleContext {
  scale: number;
  logicalWidth: number;
  logicalHeight: number;
}

/**
 * 基础渲染器抽象类
 * 提供共享的字幕绘制方法，子类只需实现具体的布局逻辑
 */
export abstract class BaseRenderer {
  /**
   * 计算高分辨率渲染所需的缩放比例
   * 确保 canvas 至少有 MIN_RENDER_WIDTH 宽度，让文字清晰
   */
  protected calculateScale(imgWidth: number): number {
    return Math.max(1, MIN_RENDER_WIDTH / imgWidth);
  }

  /**
   * 设置 canvas 尺寸并应用缩放
   * @param canvas - Canvas 元素
   * @param ctx - 渲染上下文
   * @param logicalWidth - 逻辑宽度（原图宽度）
   * @param logicalHeight - 逻辑高度（原图高度 + 额外区域）
   * @returns ScaleContext 缩放上下文信息
   */
  protected setupCanvasWithScale(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    logicalWidth: number,
    logicalHeight: number
  ): ScaleContext {
    const scale = this.calculateScale(logicalWidth);

    // 设置 canvas 实际像素尺寸
    canvas.width = Math.round(logicalWidth * scale);
    canvas.height = Math.round(logicalHeight * scale);

    // 应用缩放，后续绘制使用逻辑尺寸
    ctx.scale(scale, scale);

    return {
      scale,
      logicalWidth,
      logicalHeight
    };
  }
  /**
   * 在图片上绘制叠加字幕
   */
  protected drawSubtitlesOnImage(
    ctx: CanvasRenderingContext2D,
    subs: SubtitleItem[],
    width: number,
    height: number,
    subtitleStyle: SubtitleStyle,
    yOffset: number = 0
  ): void {
    const fontSize = subtitleStyle.fontSize;
    const padding = 20;
    const lineHeight = fontSize * 1.4;

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const totalHeight = subs.length * lineHeight;
    let yPosition: number;
    if (subtitleStyle.position === 'top') {
      yPosition = yOffset + padding + fontSize / 2;
    } else {
      yPosition = yOffset + height - padding - totalHeight + lineHeight / 2;
    }

    subs.forEach((sub) => {
      const text = sub.text;
      const textWidth = ctx.measureText(text).width;

      if (subtitleStyle.background !== 'none') {
        const bgAlpha = subtitleStyle.background === 'semi-transparent' ? 0.75 : 1;
        ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;

        const bgPadding = { x: 16, y: 8 };
        const bgX = width / 2 - textWidth / 2 - bgPadding.x;
        const bgY = yPosition - fontSize / 2 - bgPadding.y;
        const bgWidth = textWidth + bgPadding.x * 2;
        const bgHeight = fontSize + bgPadding.y * 2;

        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 6);
        ctx.fill();
      }

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = 'white';
      ctx.fillText(text, width / 2, yPosition);
      ctx.shadowBlur = 0;

      if (subtitleStyle.layout === 'vertical') {
        yPosition += lineHeight;
      }
    });
  }

  /**
   * 在分离区域绘制字幕（纯文本，无背景）
   */
  protected drawSubtitlesInArea(
    ctx: CanvasRenderingContext2D,
    subs: SubtitleItem[],
    width: number,
    startY: number,
    areaHeight: number,
    fontSize: number,
    textColor: string = '#18181b'
  ): void {
    const lineHeight = fontSize * 1.6;

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;

    const totalTextHeight = subs.length * lineHeight;
    let yPosition = startY + (areaHeight - totalTextHeight) / 2 + fontSize / 2;

    subs.forEach((sub) => {
      ctx.fillText(sub.text, width / 2, yPosition);
      yPosition += lineHeight;
    });
  }

  /**
   * 计算字幕区域所需高度
   */
  protected calculateSubtitleAreaHeight(
    subsCount: number,
    fontSize: number,
    lineHeightRatio: number = 1.6,
    padding: number = 32
  ): number {
    const lineHeight = fontSize * lineHeightRatio;
    return subsCount * lineHeight + padding;
  }
}
