/**
 * 叠加式渲染模式
 * 字幕直接渲染在画面上，模拟电影字幕效果
 */

import { BaseRenderer } from '../BaseRenderer';
import type { IRenderMode, RenderContext } from '../types';

export class OverlayMode extends BaseRenderer implements IRenderMode {
  readonly name = 'overlay' as const;

  render(context: RenderContext): void {
    const { canvas, ctx, img, subs, config } = context;

    // 使用高分辨率渲染，保证文字清晰
    const { logicalWidth, logicalHeight } = this.setupCanvasWithScale(
      canvas,
      ctx,
      img.width,
      img.height
    );

    ctx.drawImage(img, 0, 0, logicalWidth, logicalHeight);

    if (subs.length > 0) {
      this.drawSubtitlesOnImage(
        ctx,
        subs,
        logicalWidth,
        logicalHeight,
        config.subtitleStyle
      );
    }
  }
}
