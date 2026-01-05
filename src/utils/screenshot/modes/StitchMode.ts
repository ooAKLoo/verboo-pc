/**
 * 拼接式渲染模式
 * 首图完整显示，后续只显示字幕区域，适合连续对话/剧情截图
 */

import { BaseRenderer } from '../BaseRenderer';
import type { IRenderMode, RenderContext, SubtitleItem, SubtitleStyle } from '../types';

export class StitchMode extends BaseRenderer implements IRenderMode {
  readonly name = 'stitch' as const;

  render(context: RenderContext): void {
    const { canvas, ctx, img, subs, config } = context;
    const { subtitleStyle, stitchSeparator, stitchSeparatorWidth, stitchCropRatio } = config;

    // 无字幕时只显示原图
    if (subs.length === 0) {
      const { logicalWidth, logicalHeight } = this.setupCanvasWithScale(
        canvas,
        ctx,
        img.width,
        img.height
      );
      ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight);
      return;
    }

    const separatorHeight = stitchSeparator !== 'none' ? stitchSeparatorWidth : 0;
    const subtitleAreaHeight = Math.round(img.height * stitchCropRatio);

    // 计算逻辑尺寸
    const firstBlockHeight = img.height;
    const subsequentBlockHeight = subtitleAreaHeight;
    const totalHeight = firstBlockHeight +
      (subs.length > 1 ? (subs.length - 1) * subsequentBlockHeight : 0) +
      (subs.length - 1) * separatorHeight;

    // 使用高分辨率渲染，保证文字清晰
    const { logicalWidth, scale } = this.setupCanvasWithScale(
      canvas,
      ctx,
      img.width,
      totalHeight
    );

    // 计算缩放后的逻辑尺寸
    const scaledImgHeight = img.height;
    const scaledSubtitleAreaHeight = subtitleAreaHeight;

    let yOffset = 0;

    subs.forEach((sub, index) => {
      if (index === 0) {
        // 首图：完整显示
        ctx.drawImage(img, 0, yOffset, logicalWidth, scaledImgHeight);
        this.drawSubtitlesOnImage(ctx, [sub], logicalWidth, scaledImgHeight, subtitleStyle, yOffset);
        yOffset += scaledImgHeight;
      } else if (scaledSubtitleAreaHeight > 0) {
        // 后续图：只显示字幕区域（裁剪比例 > 0 时才绘制）
        this.drawCroppedBlock(
          ctx,
          img,
          sub,
          scaledSubtitleAreaHeight,
          yOffset,
          subtitleStyle,
          logicalWidth
        );
        yOffset += scaledSubtitleAreaHeight;
      }

      // 绘制分隔线（最后一个不绘制，且裁剪比例为 0 时也不绘制）
      if (index < subs.length - 1 && stitchSeparator !== 'none' && (index === 0 || scaledSubtitleAreaHeight > 0)) {
        ctx.fillStyle = stitchSeparator === 'white' ? '#ffffff' : '#000000';
        ctx.fillRect(0, yOffset, logicalWidth, separatorHeight);
        yOffset += separatorHeight;
      }
    });
  }

  /**
   * 绘制裁剪后的图片块（只显示字幕区域）
   */
  private drawCroppedBlock(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    sub: SubtitleItem,
    areaHeight: number,
    yOffset: number,
    subtitleStyle: SubtitleStyle,
    logicalWidth: number
  ): void {
    const isTop = subtitleStyle.position === 'top';
    // 计算原图中需要裁剪的区域（按原图尺寸比例）
    const cropRatio = areaHeight / img.height;
    const srcCropHeight = img.height * cropRatio;
    const srcCropY = isTop ? 0 : img.height - srcCropHeight;

    // 裁剪并绘制图片的字幕区域
    ctx.drawImage(
      img,
      0, srcCropY, img.width, srcCropHeight,
      0, yOffset, logicalWidth, areaHeight
    );

    // 在裁剪区域上绘制字幕
    this.drawSubtitleOnCroppedArea(ctx, sub, logicalWidth, areaHeight, yOffset, subtitleStyle, isTop);
  }

  /**
   * 在裁剪区域上绘制单条字幕
   */
  private drawSubtitleOnCroppedArea(
    ctx: CanvasRenderingContext2D,
    sub: SubtitleItem,
    width: number,
    areaHeight: number,
    yOffset: number,
    subtitleStyle: SubtitleStyle,
    isTop: boolean
  ): void {
    const fontSize = subtitleStyle.fontSize;
    const padding = 20;

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const yPosition = isTop
      ? yOffset + padding + fontSize / 2
      : yOffset + areaHeight - padding - fontSize / 2;

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
  }
}
