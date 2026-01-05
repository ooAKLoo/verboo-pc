/**
 * 截图渲染模块 - 颜色工具函数
 */

import type { RGBColor } from './types';

/**
 * 从图片底部采样主色调（颜色量化 + 众数提取）
 */
export function sampleBottomColor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): RGBColor {
  // 1. 扩大采样区域，但避开最边缘（可能有水印/logo）
  const sampleHeight = 30;
  const marginX = Math.floor(width * 0.1);
  const sampleY = Math.max(0, height - sampleHeight - 5);

  const sampleWidth = width - marginX * 2;
  if (sampleWidth <= 0 || sampleHeight <= 0) {
    return { r: 128, g: 128, b: 128 };
  }

  const imageData = ctx.getImageData(marginX, sampleY, sampleWidth, sampleHeight);
  const data = imageData.data;

  // 2. 颜色量化：将颜色归入桶（每个通道量化到 8 级，即 32 为步长）
  const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  const quantize = (v: number) => Math.floor(v / 32) * 32;

  for (let i = 0; i < data.length; i += 4) {
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

  // 3. 找出出现次数最多的颜色桶（主色调）
  let dominant = { r: 128, g: 128, b: 128, count: 0 };
  for (const bucket of colorBuckets.values()) {
    if (bucket.count > dominant.count) {
      dominant = bucket;
    }
  }

  return {
    r: Math.round(dominant.r / dominant.count),
    g: Math.round(dominant.g / dominant.count),
    b: Math.round(dominant.b / dominant.count)
  };
}

/**
 * 根据背景色计算对比度高的文字颜色
 */
export function getContrastTextColor(bgColor: RGBColor): string {
  // 计算亮度 (YIQ 公式)
  const brightness = (bgColor.r * 299 + bgColor.g * 587 + bgColor.b * 114) / 1000;
  return brightness > 128 ? '#18181b' : '#ffffff';
}

/**
 * 将 RGB 颜色转换为 CSS 字符串
 */
export function rgbToString(color: RGBColor, alpha?: number): string {
  if (alpha !== undefined) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}
