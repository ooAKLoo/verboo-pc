/**
 * Webview Preload Script (for WebContentsView with contextIsolation)
 *
 * This script runs in the webview context and provides:
 * - Anti-detection measures to avoid bot detection
 * - Platform adapter system for content/video capture
 * - IPC communication with the main process via contextBridge
 */

import { ipcRenderer, contextBridge } from 'electron';
import { adapterRegistry, genericAdapter } from './adapters';
import type { PlatformAdapter, VideoCaptureResult } from './adapters';

declare global {
    interface Window {
        verboo: {
            sendData: (data: any) => void;
            captureContent: () => Promise<any>;
            captureVideoFrame: () => Promise<any>;
        };
        trustedTypes?: {
            createPolicy: (name: string, rules: any) => any;
        };
    }
}

// ============ Anti-Detection Measures ============
// Must run before any page scripts to prevent Electron detection

(function hideElectronFingerprints() {
    // Remove webdriver property (used to detect automation)
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
    });

    // Override plugins to appear as a normal Chrome browser
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const plugins = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
            ];
            const pluginArray = plugins.map((p) => {
                const plugin = {
                    ...p,
                    length: 1,
                    item: (idx: number) => idx === 0 ? plugin : null,
                    namedItem: (name: string) => name === p.name ? plugin : null,
                    [Symbol.iterator]: function* () { yield plugin; }
                };
                return plugin;
            });
            (pluginArray as any).item = (i: number) => pluginArray[i] || null;
            (pluginArray as any).namedItem = (name: string) => pluginArray.find(p => p.name === name) || null;
            (pluginArray as any).refresh = () => { };
            return pluginArray;
        },
        configurable: true
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
        configurable: true
    });

    // Prevent chrome.runtime detection
    if (!(window as any).chrome) {
        (window as any).chrome = {};
    }
    if (!(window as any).chrome.runtime) {
        (window as any).chrome.runtime = {};
    }

    // Override permissions API
    if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (parameters: any) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: 'prompt', onchange: null } as PermissionStatus);
            }
            return originalQuery(parameters);
        };
    }

    // Hide Electron process object
    try {
        if ((window as any).process) {
            delete (window as any).process;
        }
    } catch (e) {
        // Ignore
    }

    // Override user agent
    const chromeVersion = '131.0.0.0';
    const platform = navigator.platform;
    let userAgent: string;

    if (platform.includes('Mac')) {
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    } else if (platform.includes('Win')) {
        userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    } else {
        userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }

    Object.defineProperty(navigator, 'userAgent', {
        get: () => userAgent,
        configurable: true
    });

    Object.defineProperty(navigator, 'appVersion', {
        get: () => userAgent.replace('Mozilla/', ''),
        configurable: true
    });

    // Override userAgentData for modern Chrome detection
    const platformName = platform.includes('Mac') ? 'macOS' : platform.includes('Win') ? 'Windows' : 'Linux';
    Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
            brands: [
                { brand: 'Google Chrome', version: '131' },
                { brand: 'Chromium', version: '131' },
                { brand: 'Not_A Brand', version: '24' }
            ],
            mobile: false,
            platform: platformName,
            getHighEntropyValues: (hints: string[]) => Promise.resolve({
                brands: [
                    { brand: 'Google Chrome', version: '131' },
                    { brand: 'Chromium', version: '131' },
                    { brand: 'Not_A Brand', version: '24' }
                ],
                mobile: false,
                platform: platformName,
                platformVersion: platform.includes('Mac') ? '14.0.0' : platform.includes('Win') ? '15.0.0' : '6.5.0',
                architecture: 'x86',
                bitness: '64',
                model: '',
                uaFullVersion: '131.0.0.0',
                fullVersionList: [
                    { brand: 'Google Chrome', version: '131.0.0.0' },
                    { brand: 'Chromium', version: '131.0.0.0' },
                    { brand: 'Not_A Brand', version: '24.0.0.0' }
                ]
            })
        }),
        configurable: true
    });

    // WebGL fingerprinting protection
    const getParameterProto = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
        if (parameter === 37445) return 'Google Inc. (Apple)';
        if (parameter === 37446) return 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
        return getParameterProto.call(this, parameter);
    };

    if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameterProto2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
            if (parameter === 37445) return 'Google Inc. (Apple)';
            if (parameter === 37446) return 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
            return getParameterProto2.call(this, parameter);
        };
    }

    console.log('[Verboo] Anti-detection measures applied');
})();

// ============ Adapter Helper Functions ============

/**
 * Get the adapter for current page (or generic fallback)
 */
function getCurrentAdapter(): PlatformAdapter {
    const url = window.location.href;
    const adapter = adapterRegistry.getAdapterForUrl(url);
    if (adapter) {
        return adapter;
    }
    // Use generic adapter as fallback
    genericAdapter.match(url);
    return genericAdapter;
}

/**
 * Check if current page supports content capture
 */
function canCaptureContent(): boolean {
    const adapter = getCurrentAdapter();
    return adapter.capabilities.canCaptureContent;
}

/**
 * Capture content from current page using adapter
 */
function captureContent(): any {
    const adapter = getCurrentAdapter();

    if (!adapter.capabilities.canCaptureContent) {
        return { error: 'Content capture not supported for this platform' };
    }

    const result = adapter.captureContent();
    if (!result) {
        return { error: 'Failed to capture content' };
    }

    return {
        platform: adapter.platform.name,
        ...result
    };
}

/**
 * Capture video frame from current page using adapter
 */
function captureVideoFrame(): Promise<VideoCaptureResult | { error: string }> {
    return new Promise((resolve, reject) => {
        try {
            const adapter = getCurrentAdapter();
            const platformInfo = 'getPlatformInfo' in adapter
                ? (adapter as any).getPlatformInfo()
                : adapter.platform;

            // Find video element
            const videoElement = adapter.findVideoElement();
            if (!videoElement) {
                return reject({ error: '未找到视频元素' });
            }

            // Check video readiness
            if (videoElement.readyState < 2) {
                return reject({ error: '视频尚未加载，请等待视频加载后再试' });
            }

            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                return reject({ error: '视频尚未就绪，请稍后再试' });
            }

            // Create canvas and capture frame
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject({ error: 'Canvas context creation failed' });
            }

            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/png');

            // Get video title
            const videoTitle = adapter.getVideoTitle() || document.title;

            // Get author info
            const author = adapter.getAuthorInfo() || { name: '' };

            resolve({
                imageData,
                timestamp: videoElement.currentTime,
                duration: videoElement.duration,
                videoUrl: window.location.href,
                videoTitle,
                width: canvas.width,
                height: canvas.height,
                author,
                // Include platform info
                platform: platformInfo.id,
                favicon: platformInfo.favicon
            } as VideoCaptureResult & { platform: string; favicon: string });
        } catch (error) {
            reject({ error: (error as Error).message });
        }
    });
}

// ============ Expose API to Guest Page ============

(function () {
    console.log('[Verboo] webview-preload.js loaded (WebContentsView mode)');

    const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);
    const openInSameView = (url: string) => {
        if (isHttpUrl(url)) {
            window.location.assign(url);
        } else if (url && url !== 'about:blank') {
            ipcRenderer.send('open-external', url);
        }
    };

    // Force window.open to reuse current WebContentsView
    window.open = function (url?: string | URL | null) {
        const href = url ? url.toString() : '';
        if (href) {
            openInSameView(href);
        }
        return window;
    } as typeof window.open;

    // Intercept target=_blank clicks to stay in the same view
    const handleBlankTargetClick = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        const target = event.target as Element | null;
        const link = target?.closest?.('a') as HTMLAnchorElement | null;
        if (!link) return;
        if (link.target !== '_blank') return;
        if (!link.href || link.href === 'about:blank') return;
        event.preventDefault();
        event.stopPropagation();
        openInSameView(link.href);
    };

    document.addEventListener('click', handleBlankTargetClick, true);
    document.addEventListener('auxclick', handleBlankTargetClick, true);

    // For WebContentsView with contextIsolation, use ipcRenderer.send instead of sendToHost
    const verbooApi = {
        sendData: (data: any) => {
            console.log('[Verboo] Sending data to host', data);
            ipcRenderer.send('plugin-data', data);
        },
        captureContent: async () => {
            return captureContent();
        },
        captureVideoFrame: async () => {
            return captureVideoFrame();
        }
    };

    // Expose API via contextBridge for contextIsolation
    try {
        contextBridge.exposeInMainWorld('verboo', verbooApi);
    } catch (e) {
        // Fallback for non-isolated context
        window.verboo = verbooApi;
        Object.defineProperty(window, 'verboo', {
            value: verbooApi,
            writable: false,
            configurable: false
        });
    }

    // ============ Context Menu Handler ============
    document.addEventListener('contextmenu', (e) => {
        const canCapture = canCaptureContent();
        const adapter = getCurrentAdapter();
        console.log('[Verboo] Context menu triggered, platform:', adapter.platform.name);

        ipcRenderer.send('show-context-menu', {
            x: e.clientX,
            y: e.clientY,
            canCapture,
            platform: adapter.platform.name
        });
    });

    // ============ IPC Command Handlers ============

    // Content capture command
    ipcRenderer.on('execute-capture', () => {
        console.log('[Verboo] Capture command received');
        const result = captureContent();
        ipcRenderer.send('capture-result', result);
    });

    // Video frame capture command
    ipcRenderer.on('execute-video-capture', async () => {
        console.log('[Verboo] Video capture command received');
        try {
            const result = await captureVideoFrame();
            ipcRenderer.send('video-capture-result', result);
        } catch (error: any) {
            ipcRenderer.send('video-capture-result', { error: error.error || error.message });
        }
    });

    // Bilibili subtitle extraction command
    ipcRenderer.on('extract-bilibili-subtitles', async () => {
        console.log('[Verboo] Bilibili subtitle extraction command received');
        try {
            const adapter = getCurrentAdapter();
            if (adapter.platform.id !== 'bilibili') {
                ipcRenderer.send('bilibili-subtitle-result', {
                    error: '请在Bilibili视频页面使用此功能'
                });
                return;
            }

            // Check if adapter has extractSubtitles method
            if ('extractSubtitles' in adapter && typeof (adapter as any).extractSubtitles === 'function') {
                const subtitles = await (adapter as any).extractSubtitles();
                console.log('[Verboo] Extracted', subtitles.length, 'subtitles from Bilibili');
                ipcRenderer.send('bilibili-subtitle-result', {
                    success: true,
                    data: subtitles,
                    count: subtitles.length
                });
            } else {
                ipcRenderer.send('bilibili-subtitle-result', {
                    error: 'Bilibili适配器不支持字幕提取'
                });
            }
        } catch (error: any) {
            console.error('[Verboo] Bilibili subtitle extraction failed:', error);
            ipcRenderer.send('bilibili-subtitle-result', {
                error: error.message || '提取字幕失败'
            });
        }
    });

    // ============ Bilibili AI Subtitle Interception ============
    // Intercept fetch requests to capture AI subtitle data from aisubtitle.hdslb.com

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
            if (url && url.includes('aisubtitle.hdslb.com')) {
                console.log('[Verboo] Detected Bilibili AI subtitle request:', url);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();

                // Parse AI subtitle data to standard format
                const subtitles = parseBilibiliAISubtitle(data);
                if (subtitles && subtitles.length > 0) {
                    console.log('[Verboo] Captured AI subtitles:', subtitles.length, 'items');
                    ipcRenderer.send('bilibili-ai-subtitle', {
                        type: 'bilibili-ai-subtitle',
                        data: subtitles,
                        count: subtitles.length
                    });
                }
            }
        } catch (e) {
            console.error('[Verboo] Failed to parse AI subtitle:', e);
        }

        return response;
    };

    // Also intercept XMLHttpRequest for completeness
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
        (this as any)._verbooUrl = typeof url === 'string' ? url : url.toString();
        return originalXHROpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const xhr = this;
        const url = (xhr as any)._verbooUrl;

        if (url && url.includes('aisubtitle.hdslb.com')) {
            xhr.addEventListener('load', function () {
                try {
                    console.log('[Verboo] Detected Bilibili AI subtitle XHR:', url);
                    const data = JSON.parse(xhr.responseText);
                    const subtitles = parseBilibiliAISubtitle(data);
                    if (subtitles && subtitles.length > 0) {
                        console.log('[Verboo] Captured AI subtitles (XHR):', subtitles.length, 'items');
                        ipcRenderer.send('bilibili-ai-subtitle', {
                            type: 'bilibili-ai-subtitle',
                            data: subtitles,
                            count: subtitles.length
                        });
                    }
                } catch (e) {
                    console.error('[Verboo] Failed to parse AI subtitle (XHR):', e);
                }
            });
        }

        return originalXHRSend.apply(this, args);
    };

    /**
     * Parse Bilibili AI subtitle response to standard SubtitleItem format
     * B站 AI 字幕格式: { body: [{ from: number, to: number, content: string }] }
     */
    function parseBilibiliAISubtitle(data: any): Array<{ start: number; duration: number; text: string }> {
        try {
            // Handle different response structures
            let body = data?.body;
            if (!body && data?.data?.body) {
                body = data.data.body;
            }
            if (!body && data?.data?.subtitle?.body) {
                body = data.data.subtitle.body;
            }

            if (!Array.isArray(body)) {
                console.log('[Verboo] AI subtitle body not found or not an array:', data);
                return [];
            }

            return body.map((item: any) => ({
                start: item.from || 0,
                duration: (item.to || 0) - (item.from || 0),
                text: item.content || ''
            })).filter((item: any) => item.text.trim() !== '');
        } catch (e) {
            console.error('[Verboo] Failed to parse AI subtitle body:', e);
            return [];
        }
    }

    // ============ Video Time Monitoring ============
    let videoTimeInterval: ReturnType<typeof setInterval> | null = null;

    function startVideoTimeMonitoring() {
        if (videoTimeInterval) return;

        videoTimeInterval = setInterval(() => {
            const adapter = getCurrentAdapter();
            const videoElement = adapter.findVideoElement();

            if (videoElement && !videoElement.paused && videoElement.currentTime > 0) {
                ipcRenderer.send('video-time-update', {
                    currentTime: videoElement.currentTime,
                    duration: videoElement.duration,
                    paused: videoElement.paused
                });
            }
        }, 500);
    }

    // Start monitoring after page loads
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(startVideoTimeMonitoring, 1000);
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(startVideoTimeMonitoring, 1000);
    }
})();
