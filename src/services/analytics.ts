/**
 * 数据分析服务
 * 使用 Orbit SDK 进行日活和下载量追踪
 * 集成 Sentry 进行错误监控
 */

import { Orbit } from '@ooakloowj/orbit';

// Sentry 配置
const SENTRY_DSN = ''; // TODO: 填入你的 Sentry DSN

// 用户偏好设置 key
const ANALYTICS_ENABLED_KEY = 'verboo_analytics_enabled';

// 检查是否启用分析
export function isAnalyticsEnabled(): boolean {
    const stored = localStorage.getItem(ANALYTICS_ENABLED_KEY);
    // 默认启用
    return stored === null ? true : stored === 'true';
}

// 设置分析开关
export function setAnalyticsEnabled(enabled: boolean): void {
    localStorage.setItem(ANALYTICS_ENABLED_KEY, String(enabled));
    if (!enabled) {
        console.log('[Analytics] Disabled');
    }
}

// Orbit 分析服务
class AnalyticsService {
    private configured: boolean = false;

    /**
     * 确保 Orbit SDK 已配置
     */
    private ensureConfigured() {
        if (this.configured) return;

        Orbit.configure({
            appId: 'com.dongju.verboo',
        });

        this.configured = true;
        console.log('[Analytics] Orbit SDK configured');
    }

    /**
     * 初始化分析服务（日活追踪等）
     */
    init() {
        // 只有用户允许才启用分析追踪
        if (!isAnalyticsEnabled()) {
            console.log('[Analytics] Analytics tracking disabled by user');
            return;
        }

        this.ensureConfigured();
        console.log('[Analytics] Analytics tracking enabled');

        // ✅ 下载量和日活会自动追踪，无需额外代码
    }

    /**
     * 检查版本更新
     */
    async checkUpdate() {
        this.ensureConfigured();

        try {
            const result = await Orbit.checkUpdate();
            return result;
        } catch (error) {
            console.error('[Analytics] Check update failed:', error);
            return { hasUpdate: false };
        }
    }

    /**
     * 发送用户反馈
     */
    async sendFeedback(content: string, contact?: string) {
        console.log('[Analytics] sendFeedback called:', { content, contact });

        this.ensureConfigured();

        try {
            console.log('[Analytics] Calling Orbit.sendFeedback...');
            const result = await Orbit.sendFeedback({
                content,
                contact,
            });
            console.log('[Analytics] Orbit.sendFeedback result:', result);
            return true;
        } catch (error) {
            console.error('[Analytics] Send feedback failed:', error);
            return false;
        }
    }
}

// 单例
export const analytics = new AnalyticsService();

// Sentry 错误上报（简易版本）
export function captureError(error: Error, context?: Record<string, any>) {
    if (!isAnalyticsEnabled() || !SENTRY_DSN) return;

    console.error('[Sentry] Would capture:', error.message, context);

    // TODO: 实际项目中应该使用 @sentry/electron SDK
    // 这里只是记录到控制台，实际集成时替换
}

// 全局错误处理
export function initErrorHandling() {
    window.onerror = (message, source, lineno, colno, error) => {
        captureError(error || new Error(String(message)), {
            source,
            lineno,
            colno,
        });
    };

    window.onunhandledrejection = (event) => {
        captureError(
            event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason))
        );
    };
}
