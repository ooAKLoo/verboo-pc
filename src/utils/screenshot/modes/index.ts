/**
 * 渲染模式注册中心
 * 遵循开闭原则：新增模式只需在此注册，无需修改其他代码
 */

import type { IRenderMode, DisplayMode } from '../types';
import { OverlayMode } from './OverlayMode';
import { SeparatedMode } from './SeparatedMode';
import { CardMode } from './CardMode';
import { StitchMode } from './StitchMode';

/** 模式注册表 */
const modeRegistry = new Map<DisplayMode, IRenderMode>();

/**
 * 注册渲染模式
 */
export function registerMode(mode: IRenderMode): void {
  modeRegistry.set(mode.name, mode);
}

/**
 * 获取渲染模式
 */
export function getMode(name: DisplayMode): IRenderMode | undefined {
  return modeRegistry.get(name);
}

/**
 * 获取所有已注册的模式名称
 */
export function getRegisteredModes(): DisplayMode[] {
  return Array.from(modeRegistry.keys());
}

/**
 * 检查模式是否已注册
 */
export function hasMode(name: DisplayMode): boolean {
  return modeRegistry.has(name);
}

// 自动注册内置模式
registerMode(new OverlayMode());
registerMode(new SeparatedMode());
registerMode(new CardMode());
registerMode(new StitchMode());

// 导出各模式类，便于外部扩展或测试
export { OverlayMode, SeparatedMode, CardMode, StitchMode };
