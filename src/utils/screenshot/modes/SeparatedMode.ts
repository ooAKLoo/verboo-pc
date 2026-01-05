/**
 * 分离式渲染模式
 * 画面和字幕区域分开，字幕显示在图片下方独立区域
 * 使用镜像延伸 + 渐变遮罩实现自然过渡
 */

import { BaseRenderer } from '../BaseRenderer';
import { sampleBottomColor, getContrastTextColor, rgbToString } from '../colorUtils';
import type { IRenderMode, RenderContext } from '../types';

export class SeparatedMode extends BaseRenderer implements IRenderMode {
  readonly name = 'separated' as const;

  render(context: RenderContext): void {
    const { canvas, ctx, img, subs, config } = context;
    const { subtitleStyle } = config;

    const subtitleAreaHeight = subs.length > 0
      ? this.calculateSubtitleAreaHeight(subs.length, subtitleStyle.fontSize)
      : 0;

    // 使用高分辨率渲染，保证文字清晰
    const { logicalWidth, logicalHeight } = this.setupCanvasWithScale(
      canvas,
      ctx,
      img.width,
      img.height + subtitleAreaHeight
    );

    const imgHeight = logicalHeight - subtitleAreaHeight;

    // 绘制图片
    ctx.drawImage(img, 0, 0, logicalWidth, imgHeight);

    if (subs.length > 0) {
      // 从图片底部采样主色调（需要在缩放后的 canvas 上采样）
      const bgColor = sampleBottomColor(ctx, logicalWidth, imgHeight);
      const textColor = getContrastTextColor(bgColor);

      // 镜像延伸区域高度
      const reflectionHeight = Math.min(subtitleAreaHeight, 80);

      // 1. 镜像底部区域向下延伸
      ctx.save();
      ctx.translate(0, imgHeight + reflectionHeight);
      ctx.scale(1, -1);
      ctx.drawImage(
        img,
        0, img.height - reflectionHeight * (img.height / imgHeight), img.width, reflectionHeight * (img.height / imgHeight),
        0, 0, logicalWidth, reflectionHeight
      );
      ctx.restore();

      // 2. 叠加渐变遮罩，让镜像逐渐淡出到纯色
      const gradient = ctx.createLinearGradient(0, imgHeight, 0, imgHeight + reflectionHeight);
      gradient.addColorStop(0, rgbToString(bgColor, 0));
      gradient.addColorStop(0.6, rgbToString(bgColor, 0.7));
      gradient.addColorStop(1, rgbToString(bgColor));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, imgHeight, logicalWidth, reflectionHeight);

      // 3. 剩余区域纯色填充
      if (subtitleAreaHeight > reflectionHeight) {
        ctx.fillStyle = rgbToString(bgColor);
        ctx.fillRect(0, imgHeight + reflectionHeight, logicalWidth, subtitleAreaHeight - reflectionHeight);
      }

      // 绘制字幕文本
      this.drawSubtitlesInArea(
        ctx,
        subs,
        logicalWidth,
        imgHeight,
        subtitleAreaHeight,
        subtitleStyle.fontSize,
        textColor
      );
    }
  }
}
