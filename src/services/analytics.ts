/**
 * 数据分析服务
 * 集成 PostHog 进行用户行为分析
 * 集成 Sentry 进行错误监控
 */

// PostHog 配置
const POSTHOG_KEY = 'phc_O5X1ifMMwpN4HFSL8JYRUcHJzLwloDmosy5kaA4c4Y6';
const POSTHOG_HOST = 'https://us.i.posthog.com';

// Sentry 配置
const SENTRY_DSN = ''; // TODO: 填入你的 Sentry DSN

// 用户偏好设置 key
const ANALYTICS_ENABLED_KEY = 'verboo_analytics_enabled';
const USER_ID_KEY = 'verboo_user_id';
const FIRST_LAUNCH_KEY = 'verboo_first_launch_tracked';
const INSTALL_DATE_KEY = 'verboo_install_date';

// 获取唯一用户 ID（使用更稳定的生成策略）
function getOrCreateUserId(): { userId: string; isNew: boolean } {
    let userId = localStorage.getItem(USER_ID_KEY);
    const isNew = !userId;

    if (!userId) {
        // 使用时间戳 + 随机数组合，确保唯一性
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        userId = `u_${timestamp}_${random}`;
        localStorage.setItem(USER_ID_KEY, userId);
        // 记录安装日期
        localStorage.setItem(INSTALL_DATE_KEY, new Date().toISOString().split('T')[0]);
    }

    return { userId, isNew };
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
    private isNewUser: boolean = false;

    constructor() {
        const { userId, isNew } = getOrCreateUserId();
        this.userId = userId;
        this.isNewUser = isNew;
        this.sessionId = `s_${Date.now().toString(36)}`;
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

        const commonProps = {
            platform: this.getPlatform(),
            version: this.getAppVersion(),
            locale: navigator.language,
        };

        // 首次启动事件（用于追踪下载量）
        if (this.isNewUser && !localStorage.getItem(FIRST_LAUNCH_KEY)) {
            this.capture('first_launch', {
                ...commonProps,
                install_date: localStorage.getItem(INSTALL_DATE_KEY),
            });
            localStorage.setItem(FIRST_LAUNCH_KEY, 'true');
        }

        // 每次启动事件（用于 DAU 计算）
        this.capture('app_started', commonProps);
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
