/**
 * 数据分析服务
 * 集成 PostHog 进行用户行为分析
 * 集成 Sentry 进行错误监控
 */

// PostHog 配置
const POSTHOG_KEY = 'phx_g9SOjDun8D6ndBl1vzlrpUCvYicAodHhz2FpFZo1wBUMK1G';
const POSTHOG_HOST = 'https://us.i.posthog.com';

// Sentry 配置
const SENTRY_DSN = ''; // TODO: 填入你的 Sentry DSN

// 用户偏好设置 key
const ANALYTICS_ENABLED_KEY = 'verboo_analytics_enabled';

// 获取唯一用户 ID
function getOrCreateUserId(): string {
    const key = 'verboo_user_id';
    let userId = localStorage.getItem(key);
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem(key, userId);
    }
    return userId;
}

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
        // 如果禁用，可以在这里重置 PostHog
        console.log('[Analytics] Disabled');
    }
}

// PostHog 简易实现（不依赖 SDK，使用 API）
class AnalyticsService {
    private userId: string;
    private sessionId: string;
    private initialized: boolean = false;

    constructor() {
        this.userId = getOrCreateUserId();
        this.sessionId = 'session_' + Date.now();
    }

    /**
     * 初始化分析服务
     */
    init() {
        if (this.initialized) return;

        // 只有配置了 key 且用户允许才初始化
        if (!POSTHOG_KEY || !isAnalyticsEnabled()) {
            console.log('[Analytics] Not initialized (disabled or no key)');
            return;
        }

        this.initialized = true;
        console.log('[Analytics] Initialized');

        // 记录会话开始
        this.capture('app_started', {
            platform: this.getPlatform(),
            version: this.getAppVersion(),
        });

        // 页面关闭时记录
        window.addEventListener('beforeunload', () => {
            this.capture('app_closed', {
                session_duration: Date.now() - parseInt(this.sessionId.split('_')[1]),
            });
        });
    }

    /**
     * 记录事件
     */
    capture(event: string, properties?: Record<string, any>) {
        if (!isAnalyticsEnabled() || !POSTHOG_KEY) return;

        const payload = {
            api_key: POSTHOG_KEY,
            event,
            properties: {
                distinct_id: this.userId,
                $session_id: this.sessionId,
                ...properties,
            },
            timestamp: new Date().toISOString(),
        };

        // 使用 beacon API 发送（不阻塞）
        if (navigator.sendBeacon) {
            navigator.sendBeacon(
                `${POSTHOG_HOST}/capture/`,
                JSON.stringify(payload)
            );
        } else {
            fetch(`${POSTHOG_HOST}/capture/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(() => { });
        }
    }

    /**
     * 记录页面访问
     */
    pageView(pageName: string) {
        this.capture('$pageview', { $current_url: pageName });
    }

    /**
     * 记录功能使用
     */
    trackFeature(feature: string, details?: Record<string, any>) {
        this.capture('feature_used', { feature, ...details });
    }

    /**
     * 获取平台信息
     */
    private getPlatform(): string {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('mac')) return 'macOS';
        if (platform.includes('win')) return 'Windows';
        if (platform.includes('linux')) return 'Linux';
        return platform;
    }

    /**
     * 获取应用版本
     */
    private getAppVersion(): string {
        try {
            const { ipcRenderer } = window.require('electron');
            // 这是异步的，首次可能返回 unknown
            ipcRenderer.invoke('get-app-version').then((result: any) => {
                if (result.success) {
                    localStorage.setItem('verboo_app_version', result.version);
                }
            });
            return localStorage.getItem('verboo_app_version') || 'unknown';
        } catch {
            return 'unknown';
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
