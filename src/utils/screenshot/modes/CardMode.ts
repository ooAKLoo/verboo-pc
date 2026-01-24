/**
 * 卡片式渲染模式
 * 现代简约风格：纯白背景 + 阴影图片 + 主题色装饰条
 */

import { BaseRenderer } from '../BaseRenderer';
import type { IRenderMode, RenderContext, SubtitleItem } from '../types';

export class CardMode extends BaseRenderer implements IRenderMode {
  readonly name = 'card' as const;

  private readonly CARD_PADDING = 40;
  private readonly SOURCE_HEIGHT = 56;
  private readonly BORDER_RADIUS = 16;
  private readonly ACCENT_BAR_WIDTH = 4;
  private readonly ELEGANT_PADDING = 52;
  private readonly ELEGANT_SOURCE_HEIGHT = 52;
  private readonly ELEGANT_RADIUS = 20;

  render(context: RenderContext): void {
    const cardStyle = context.config.cardOptions?.style || 'classic';
    if (cardStyle === 'elegant') {
      this.renderElegant(context);
      return;
    }
    this.renderClassic(context);
  }

  private renderClassic(context: RenderContext): void {
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

  private renderElegant(context: RenderContext): void {
    const { canvas, ctx, img, subs, config } = context;
    const { subtitleStyle, videoTitle, cardOptions } = config;

    const logicalImgWidth = img.width;
    const logicalImgHeight = img.height;
    const displayFontSize = Math.round(subtitleStyle.fontSize * 1.12);
    const textLayout = subs.length > 0
      ? this.layoutElegantSubtitles(ctx, subs, logicalImgWidth + this.ELEGANT_PADDING * 2, displayFontSize)
      : { totalTextHeight: 0, areaHeight: 0, paragraphs: [] as string[][] };

    const logicalCanvasWidth = logicalImgWidth + this.ELEGANT_PADDING * 2;
    const logicalCanvasHeight = logicalImgHeight + textLayout.areaHeight + this.ELEGANT_SOURCE_HEIGHT + this.ELEGANT_PADDING * 2;

    const { logicalWidth, logicalHeight } = this.setupCanvasWithScale(
      canvas,
      ctx,
      logicalCanvasWidth,
      logicalCanvasHeight
    );

    const accentColor = this.sampleAccentColorFromImage(img);

    // 背景：温润渐变白，营造高级感
    const bg = ctx.createLinearGradient(0, 0, logicalWidth, logicalHeight);
    bg.addColorStop(0, '#f3f0ea');
    bg.addColorStop(1, '#ffffff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // 图片周围柔和晕染（先于图片绘制）
    const halo = ctx.createRadialGradient(
      logicalWidth / 2,
      this.ELEGANT_PADDING + logicalImgHeight / 2,
      0,
      logicalWidth / 2,
      this.ELEGANT_PADDING + logicalImgHeight / 2,
      Math.max(logicalImgWidth, logicalImgHeight) * 0.8
    );
    halo.addColorStop(0, this.toRgba(accentColor, 0.12));
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // 图像磨砂边框 + 轻柔阴影
    const frameInset = 8;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(
      this.ELEGANT_PADDING - frameInset,
      this.ELEGANT_PADDING - frameInset,
      logicalImgWidth + frameInset * 2,
      logicalImgHeight + frameInset * 2,
      this.ELEGANT_RADIUS + 6
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(this.ELEGANT_PADDING, this.ELEGANT_PADDING, logicalImgWidth, logicalImgHeight, this.ELEGANT_RADIUS);
    ctx.clip();
    ctx.drawImage(img, this.ELEGANT_PADDING, this.ELEGANT_PADDING, logicalImgWidth, logicalImgHeight);
    ctx.restore();

    let currentY = this.ELEGANT_PADDING + logicalImgHeight;
    if (subs.length > 0) {
      this.drawElegantSubtitles(
        ctx,
        textLayout,
        logicalWidth,
        currentY,
        displayFontSize,
        accentColor
      );
      currentY += textLayout.areaHeight;
    }

    const showTimestamp = cardOptions?.showTimestamp && cardOptions?.timestamp !== undefined;
    this.drawElegantFooterRow(
      ctx,
      logicalWidth,
      logicalHeight - this.ELEGANT_SOURCE_HEIGHT,
      videoTitle,
      showTimestamp ? cardOptions?.timestamp : undefined
    );

    this.drawCardBorderElegant(ctx, logicalWidth, logicalHeight);
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
    drawHeight: number,
    radius: number = this.BORDER_RADIUS
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
    ctx.roundRect(x, y, drawWidth, drawHeight, radius);
    ctx.fill();

    ctx.restore();

    // 绘制图片（裁剪圆角）
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, drawWidth, drawHeight, radius);
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
   * 从图片中采样主题色（不污染主画布）
   */
  private sampleAccentColorFromImage(img: HTMLImageElement): string {
    const sampleWidth = 20;
    const sampleHeight = Math.min(img.height, 100);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sampleWidth;
    tempCanvas.height = sampleHeight;
    const tctx = tempCanvas.getContext('2d');
    if (!tctx) {
      return 'rgb(99, 102, 241)';
    }

    const sampleY = (img.height - sampleHeight) / 2;
    tctx.drawImage(
      img,
      0,
      sampleY,
      sampleWidth,
      sampleHeight,
      0,
      0,
      sampleWidth,
      sampleHeight
    );

    return this.extractAccentColor(tctx, sampleWidth, sampleHeight, 0, 0);
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
   * 绘制卡片整体边框（优雅版）
   */
  private drawCardBorderElegant(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, width - 1, height - 1, 24);
    ctx.stroke();
  }

  /**
   * 优雅版字幕排版计算
   */
  private layoutElegantSubtitles(
    ctx: CanvasRenderingContext2D,
    subs: SubtitleItem[],
    width: number,
    fontSize: number
  ): { totalTextHeight: number; areaHeight: number; paragraphs: string[][] } {
    const textPaddingX = 64;
    const maxTextWidth = width - textPaddingX * 2;
    const lineHeight = Math.round(fontSize * 1.9);
    const paragraphGap = Math.round(fontSize * 0.9);

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;

    const paragraphs = subs.map((sub) => this.wrapText(ctx, sub.text, maxTextWidth));
    const lineCount = paragraphs.reduce((acc, lines) => acc + lines.length, 0);
    const totalTextHeight = lineCount * lineHeight + Math.max(0, paragraphs.length - 1) * paragraphGap;
    const areaHeight = totalTextHeight + 110;

    return { totalTextHeight, areaHeight, paragraphs };
  }

  /**
   * 优雅版字幕绘制
   */
  private drawElegantSubtitles(
    ctx: CanvasRenderingContext2D,
    layout: { totalTextHeight: number; areaHeight: number; paragraphs: string[][] },
    width: number,
    startY: number,
    fontSize: number,
    accentColor: string
  ): void {
    const textPaddingX = 64;
    const lineHeight = Math.round(fontSize * 1.9);
    const paragraphGap = Math.round(fontSize * 0.9);
    const textAreaStartY = startY + (layout.areaHeight - layout.totalTextHeight) / 2;

    // 顶部细线强调
    const accentWidth = Math.min(140, width * 0.28);
    ctx.save();
    ctx.strokeStyle = this.toRgba(accentColor, 0.35);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((width - accentWidth) / 2, startY + 24);
    ctx.lineTo((width + accentWidth) / 2, startY + 24);
    ctx.stroke();
    ctx.restore();

    if (layout.paragraphs.length > 0) {
      const panelInsetX = 44;
      const panelInsetY = 18;
      const panelX = panelInsetX;
      const panelY = startY + panelInsetY;
      const panelW = width - panelInsetX * 2;
      const panelH = layout.areaHeight - panelInsetY * 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.10)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 18);
      ctx.fill();
      ctx.restore();

      const border = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
      border.addColorStop(0, this.toRgba(accentColor, 0.45));
      border.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 18);
      ctx.stroke();
      ctx.restore();

      // 背景引号（低透明度）
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = accentColor;
      ctx.font = `600 ${Math.round(fontSize * 3)}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText('“', textPaddingX - 10, textAreaStartY + lineHeight * 0.6);
      ctx.textAlign = 'right';
      ctx.fillText('”', width - textPaddingX + 10, textAreaStartY + layout.totalTextHeight + lineHeight * 0.4);
      ctx.restore();

      // 正文
      ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1f2937';

      let yPosition = textAreaStartY + lineHeight / 2;
      layout.paragraphs.forEach((lines, pIndex) => {
        lines.forEach((line) => {
          ctx.fillText(line, width / 2, yPosition);
          yPosition += lineHeight;
        });
        if (pIndex < layout.paragraphs.length - 1) {
          yPosition += paragraphGap;
        }
      });
    }
  }

  /**
   * 优雅版底部信息行（左对齐标题 + 右对齐时间戳）
   */
  private drawElegantFooterRow(
    ctx: CanvasRenderingContext2D,
    width: number,
    startY: number,
    videoTitle?: string,
    timestamp?: number
  ): void {
    const centerY = startY + this.ELEGANT_SOURCE_HEIGHT / 2;
    const padding = this.ELEGANT_PADDING;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, startY + 0.5);
    ctx.lineTo(width - padding, startY + 0.5);
    ctx.stroke();

    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textBaseline = 'middle';

    const timeText = timestamp !== undefined ? this.formatTime(timestamp) : '';
    const maxTitleWidth = width - padding * 2 - (timeText ? ctx.measureText(timeText).width + 16 : 0);

    let displayTitle = videoTitle || '';
    if (displayTitle && ctx.measureText(displayTitle).width > maxTitleWidth) {
      while (ctx.measureText(displayTitle + '...').width > maxTitleWidth && displayTitle.length > 0) {
        displayTitle = displayTitle.slice(0, -1);
      }
      displayTitle = displayTitle + '...';
    }

    if (displayTitle) {
      ctx.textAlign = 'left';
      ctx.fillText(displayTitle, padding, centerY);
    }
    if (timeText) {
      ctx.textAlign = 'right';
      ctx.fillText(timeText, width - padding, centerY);
    }
    ctx.restore();
  }

  /**
   * 文本自动换行（支持中文无空格场景）
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [''];

    const hasSpaces = /\s/.test(trimmed);
    const tokens = hasSpaces ? trimmed.split(/\s+/) : Array.from(trimmed);
    const joiner = hasSpaces ? ' ' : '';
    const lines: string[] = [];
    let line = '';

    const pushLine = () => {
      if (line) lines.push(line);
      line = '';
    };

    for (const token of tokens) {
      const testLine = line ? `${line}${joiner}${token}` : token;
      if (ctx.measureText(testLine).width <= maxWidth) {
        line = testLine;
        continue;
      }

      if (!line) {
        let partial = '';
        for (const char of Array.from(token)) {
          const testPartial = partial + char;
          if (ctx.measureText(testPartial).width <= maxWidth) {
            partial = testPartial;
          } else {
            if (partial) lines.push(partial);
            partial = char;
          }
        }
        line = partial;
      } else {
        pushLine();
        line = token;
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  /**
   * RGB 转 RGBA
   */
  private toRgba(color: string, alpha: number): string {
    if (color.startsWith('rgba(')) return color;
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    return color;
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
