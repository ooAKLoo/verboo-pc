/**
 * 卡片式渲染模式
 * 现代简约风格：纯白背景 + 阴影图片 + 主题色装饰条
 */

import { BaseRenderer } from '../BaseRenderer';
import type { IRenderMode, RenderContext, SubtitleItem, CardModeOptions } from '../types';

export class CardMode extends BaseRenderer implements IRenderMode {
  readonly name = 'card' as const;

  private readonly CARD_PADDING = 40;
  private readonly SOURCE_HEIGHT = 56;
  private readonly BORDER_RADIUS = 16;
  private readonly ACCENT_BAR_WIDTH = 4;

  render(context: RenderContext): void {
    const { canvas, ctx, img, subs, config } = context;
    const { subtitleStyle, videoTitle, cardOptions } = config;

    const subtitleAreaHeight = subs.length > 0
      ? this.calculateCardSubtitleAreaHeight(subs.length, subtitleStyle.fontSize)
      : 0;

    // 计算逻辑尺寸
    const logicalImgWidth = img.width;
    const logicalImgHeight = img.height;
    const logicalCanvasWidth = logicalImgWidth + this.CARD_PADDING * 2;
    const logicalCanvasHeight = logicalImgHeight + subtitleAreaHeight + this.SOURCE_HEIGHT + this.CARD_PADDING * 2;

    // 使用高分辨率渲染，保证文字清晰
    const { logicalWidth, logicalHeight } = this.setupCanvasWithScale(
      canvas,
      ctx,
      logicalCanvasWidth,
      logicalCanvasHeight
    );

    // 1. 绘制纯白背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // 2. 绘制图片（带精致阴影，无边框）
    this.drawImageWithShadow(ctx, img, this.CARD_PADDING, this.CARD_PADDING, logicalImgWidth, logicalImgHeight);

    // 3. 从图片提取主题色
    const accentColor = this.extractAccentColor(ctx, logicalImgWidth, logicalImgHeight, this.CARD_PADDING, this.CARD_PADDING);

    let currentY = this.CARD_PADDING + logicalImgHeight;

    if (subs.length > 0) {
      // 4. 绘制现代风格字幕区
      this.drawModernSubtitles(
        ctx,
        subs,
        logicalWidth,
        currentY,
        subtitleAreaHeight,
        subtitleStyle.fontSize,
        accentColor
      );
      currentY += subtitleAreaHeight;
    }

    // 5. 绘制底部信息行（时间戳左对齐 + 来源右对齐）
    const showTimestamp = cardOptions?.showTimestamp && cardOptions?.timestamp !== undefined;
    this.drawFooterRow(ctx, logicalWidth, logicalHeight - this.SOURCE_HEIGHT, videoTitle, showTimestamp ? cardOptions?.timestamp : undefined);

    // 7. 绘制整体卡片边框（极淡）
    this.drawCardBorder(ctx, logicalWidth, logicalHeight);
  }

  /**
   * 绘制底部信息行（居中显示：视频标题 | 时间戳）
   * 参照 subtitle-display.html 的设计
   */
  private drawFooterRow(
    ctx: CanvasRenderingContext2D,
    width: number,
    startY: number,
    videoTitle?: string,
    timestamp?: number
  ): void {
    const centerY = startY + this.SOURCE_HEIGHT / 2;
    const centerX = width / 2;

    // 统一字体和颜色（12px，淡灰色 #bbb）
    ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
    ctx.fillStyle = '#bbbbbb';
    ctx.textBaseline = 'middle';

    // 计算各部分宽度
    const divider = '  |  ';
    const timeText = timestamp !== undefined ? this.formatTime(timestamp) : '';
    const maxTitleWidth = width - this.CARD_PADDING * 2 - (timeText ? ctx.measureText(divider + timeText).width : 0) - 40;

    // 处理视频标题（可能需要截断）
    let displayTitle = videoTitle || '';
    if (displayTitle && ctx.measureText(displayTitle).width > maxTitleWidth) {
      while (ctx.measureText(displayTitle + '...').width > maxTitleWidth && displayTitle.length > 0) {
        displayTitle = displayTitle.slice(0, -1);
      }
      displayTitle = displayTitle + '...';
    }

    // 构建完整文本并居中绘制
    let fullText = displayTitle;
    if (displayTitle && timeText) {
      fullText = displayTitle + divider + timeText;
    } else if (timeText) {
      fullText = timeText;
    }

    if (fullText) {
      ctx.textAlign = 'center';
      ctx.fillText(fullText, centerX, centerY);
    }
  }

  /**
   * 格式化时间
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 绘制带阴影的图片（无边框）
   */
  private drawImageWithShadow(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    drawWidth: number,
    drawHeight: number
  ): void {
    ctx.save();

    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // 绘制圆角矩形作为阴影载体
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, drawWidth, drawHeight, this.BORDER_RADIUS);
    ctx.fill();

    ctx.restore();

    // 绘制图片（裁剪圆角）
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, drawWidth, drawHeight, this.BORDER_RADIUS);
    ctx.clip();
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    ctx.restore();
  }

  /**
   * 从图片边缘提取主题色
   */
  private extractAccentColor(
    ctx: CanvasRenderingContext2D,
    imgWidth: number,
    imgHeight: number,
    imgX: number,
    imgY: number
  ): string {
    // 采样图片左侧边缘
    const sampleWidth = 20;
    const sampleHeight = Math.min(imgHeight, 100);
    const sampleY = imgY + (imgHeight - sampleHeight) / 2;

    const imageData = ctx.getImageData(imgX, sampleY, sampleWidth, sampleHeight);
    const data = imageData.data;

    // 颜色量化找主色
    const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();
    const quantize = (v: number) => Math.floor(v / 32) * 32;

    for (let i = 0; i < data.length; i += 4) {
      // 跳过太暗或太亮的颜色
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness < 30 || brightness > 225) continue;

      const qr = quantize(data[i]);
      const qg = quantize(data[i + 1]);
      const qb = quantize(data[i + 2]);
      const key = `${qr},${qg},${qb}`;

      const bucket = colorBuckets.get(key);
      if (bucket) {
        bucket.r += data[i];
        bucket.g += data[i + 1];
        bucket.b += data[i + 2];
        bucket.count++;
      } else {
        colorBuckets.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], count: 1 });
      }
    }

    // 找出现次数最多的颜色
    let dominant = { r: 99, g: 102, b: 241, count: 0 }; // 默认靛蓝色
    for (const bucket of colorBuckets.values()) {
      if (bucket.count > dominant.count) {
        dominant = bucket;
      }
    }

    if (dominant.count === 0) {
      return 'rgb(99, 102, 241)'; // 默认色
    }

    const r = Math.round(dominant.r / dominant.count);
    const g = Math.round(dominant.g / dominant.count);
    const b = Math.round(dominant.b / dominant.count);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * 现代风格字幕（左侧装饰条，参照 subtitle-display.html 设计）
   */
  private drawModernSubtitles(
    ctx: CanvasRenderingContext2D,
    subs: SubtitleItem[],
    width: number,
    startY: number,
    areaHeight: number,
    fontSize: number,
    accentColor: string
  ): void {
    const lineHeight = fontSize * 2; // 行高 2 倍，参照 HTML 设计
    const textGap = 20; // 装饰条与文字间距
    const textPaddingRight = 40;

    const totalTextHeight = subs.length * lineHeight;
    // 文本区域垂直居中的起始 Y 位置（第一行文本中心点）
    const textAreaStartY = startY + (areaHeight - totalTextHeight) / 2 + lineHeight / 2;

    // 装饰条与文本精确对齐：从第一行顶部到最后一行底部
    const barY = textAreaStartY - lineHeight / 2 + fontSize * 0.2; // 微调使视觉居中
    const barHeight = totalTextHeight - fontSize * 0.4; // 略短于文本高度，视觉更协调

    // 绘制左侧装饰条（淡灰色，圆角）
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.roundRect(this.CARD_PADDING, barY, this.ACCENT_BAR_WIDTH, barHeight, this.ACCENT_BAR_WIDTH / 2);
    ctx.fill();

    // 绘制字幕文本（font-weight: 400, color: #444）
    ctx.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#444444';

    const textStartX = this.CARD_PADDING + this.ACCENT_BAR_WIDTH + textGap;
    let yPosition = textAreaStartY;
    const maxTextWidth = width - textStartX - textPaddingRight;

    subs.forEach((sub) => {
      const text = sub.text;
      if (ctx.measureText(text).width <= maxTextWidth) {
        ctx.fillText(text, textStartX, yPosition);
      } else {
        // 文本截断
        let truncated = text;
        while (ctx.measureText(truncated + '...').width > maxTextWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '...', textStartX, yPosition);
      }
      yPosition += lineHeight;
    });
  }

  /**
   * 绘制卡片整体边框（极淡）
   */
  private drawCardBorder(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, width - 1, height - 1, 20);
    ctx.stroke();
  }

  /**
   * 计算字幕区域高度
   */
  private calculateCardSubtitleAreaHeight(subsCount: number, fontSize: number): number {
    const lineHeight = fontSize * 2; // 行高 2 倍
    const padding = 80; // 上下间距（增加以确保不超出）
    return subsCount * lineHeight + padding;
  }
}
