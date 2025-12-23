/**
 * Webview Preload Script
 *
 * This script runs in the webview context and provides:
 * - Anti-detection measures to avoid bot detection
 * - Platform adapter system for content/video capture
 * - IPC communication with the main process
 */

import { ipcRenderer } from 'electron';
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
    const chromeVersion = '120.0.0.0';
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
    console.log('[Verboo] webview-preload.js loaded');

    window.verboo = {
        sendData: (data: any) => {
            console.log('[Verboo] Sending data to host', data);
            ipcRenderer.sendToHost('plugin-data', data);
        },
        captureContent: async () => {
            return captureContent();
        },
        captureVideoFrame: async () => {
            return captureVideoFrame();
        }
    };

    // Freeze the API
    Object.defineProperty(window, 'verboo', {
        value: window.verboo,
        writable: false,
        configurable: false
    });

    // ============ Context Menu Handler ============
    document.addEventListener('contextmenu', (e) => {
        const canCapture = canCaptureContent();
        const adapter = getCurrentAdapter();
        console.log('[Verboo] Context menu triggered, platform:', adapter.platform.name);

        ipcRenderer.sendToHost('show-context-menu', {
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
        ipcRenderer.sendToHost('capture-result', result);
    });

    // Video frame capture command
    ipcRenderer.on('execute-video-capture', async () => {
        console.log('[Verboo] Video capture command received');
        try {
            const result = await captureVideoFrame();
            ipcRenderer.sendToHost('video-capture-result', result);
        } catch (error: any) {
            ipcRenderer.sendToHost('video-capture-result', { error: error.error || error.message });
        }
    });

    // ============ Video Time Monitoring ============
    let videoTimeInterval: NodeJS.Timeout | null = null;

    function startVideoTimeMonitoring() {
        if (videoTimeInterval) return;

        videoTimeInterval = setInterval(() => {
            const adapter = getCurrentAdapter();
            const videoElement = adapter.findVideoElement();

            if (videoElement && !videoElement.paused && videoElement.currentTime > 0) {
                ipcRenderer.sendToHost('video-time-update', {
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
