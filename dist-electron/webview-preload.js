"use strict";
/**
 * Webview Preload Script
 *
 * This script runs in the webview context and provides:
 * - Anti-detection measures to avoid bot detection
 * - Platform adapter system for content/video capture
 * - IPC communication with the main process
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const adapters_1 = require("./adapters");
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
                    item: (idx) => idx === 0 ? plugin : null,
                    namedItem: (name) => name === p.name ? plugin : null,
                    [Symbol.iterator]: function* () { yield plugin; }
                };
                return plugin;
            });
            pluginArray.item = (i) => pluginArray[i] || null;
            pluginArray.namedItem = (name) => pluginArray.find(p => p.name === name) || null;
            pluginArray.refresh = () => { };
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
    if (!window.chrome) {
        window.chrome = {};
    }
    if (!window.chrome.runtime) {
        window.chrome.runtime = {};
    }
    // Override permissions API
    if (navigator.permissions) {
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = (parameters) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: 'prompt', onchange: null });
            }
            return originalQuery(parameters);
        };
    }
    // Hide Electron process object
    try {
        if (window.process) {
            delete window.process;
        }
    }
    catch (e) {
        // Ignore
    }
    // Override user agent
    const chromeVersion = '131.0.0.0';
    const platform = navigator.platform;
    let userAgent;
    if (platform.includes('Mac')) {
        userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
    else if (platform.includes('Win')) {
        userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
    else {
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
            getHighEntropyValues: (hints) => Promise.resolve({
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
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445)
            return 'Google Inc. (Apple)';
        if (parameter === 37446)
            return 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
        return getParameterProto.call(this, parameter);
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameterProto2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (parameter) {
            if (parameter === 37445)
                return 'Google Inc. (Apple)';
            if (parameter === 37446)
                return 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
            return getParameterProto2.call(this, parameter);
        };
    }
    console.log('[Verboo] Anti-detection measures applied');
})();
// ============ Adapter Helper Functions ============
/**
 * Get the adapter for current page (or generic fallback)
 */
function getCurrentAdapter() {
    const url = window.location.href;
    const adapter = adapters_1.adapterRegistry.getAdapterForUrl(url);
    if (adapter) {
        return adapter;
    }
    // Use generic adapter as fallback
    adapters_1.genericAdapter.match(url);
    return adapters_1.genericAdapter;
}
/**
 * Check if current page supports content capture
 */
function canCaptureContent() {
    const adapter = getCurrentAdapter();
    return adapter.capabilities.canCaptureContent;
}
/**
 * Capture content from current page using adapter
 */
function captureContent() {
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
function captureVideoFrame() {
    return new Promise((resolve, reject) => {
        try {
            const adapter = getCurrentAdapter();
            const platformInfo = 'getPlatformInfo' in adapter
                ? adapter.getPlatformInfo()
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
            });
        }
        catch (error) {
            reject({ error: error.message });
        }
    });
}
// ============ Expose API to Guest Page ============
(function () {
    console.log('[Verboo] webview-preload.js loaded');
    window.verboo = {
        sendData: (data) => {
            console.log('[Verboo] Sending data to host', data);
            electron_1.ipcRenderer.sendToHost('plugin-data', data);
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
        electron_1.ipcRenderer.sendToHost('show-context-menu', {
            x: e.clientX,
            y: e.clientY,
            canCapture,
            platform: adapter.platform.name
        });
    });
    // ============ IPC Command Handlers ============
    // Content capture command
    electron_1.ipcRenderer.on('execute-capture', () => {
        console.log('[Verboo] Capture command received');
        const result = captureContent();
        electron_1.ipcRenderer.sendToHost('capture-result', result);
    });
    // Video frame capture command
    electron_1.ipcRenderer.on('execute-video-capture', async () => {
        console.log('[Verboo] Video capture command received');
        try {
            const result = await captureVideoFrame();
            electron_1.ipcRenderer.sendToHost('video-capture-result', result);
        }
        catch (error) {
            electron_1.ipcRenderer.sendToHost('video-capture-result', { error: error.error || error.message });
        }
    });
    // ============ Bilibili AI Subtitle Interception ============
    // Intercept fetch requests to capture AI subtitle data from aisubtitle.hdslb.com
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            if (url && url.includes('aisubtitle.hdslb.com')) {
                console.log('[Verboo] Detected Bilibili AI subtitle request:', url);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();
                // Parse AI subtitle data to standard format
                const subtitles = parseBilibiliAISubtitle(data);
                if (subtitles && subtitles.length > 0) {
                    console.log('[Verboo] Captured AI subtitles:', subtitles.length, 'items');
                    electron_1.ipcRenderer.sendToHost('bilibili-ai-subtitle', {
                        type: 'bilibili-ai-subtitle',
                        data: subtitles,
                        count: subtitles.length
                    });
                }
            }
        }
        catch (e) {
            console.error('[Verboo] Failed to parse AI subtitle:', e);
        }
        return response;
    };
    // Also intercept XMLHttpRequest for completeness
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._verbooUrl = typeof url === 'string' ? url : url.toString();
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        const xhr = this;
        const url = xhr._verbooUrl;
        if (url && url.includes('aisubtitle.hdslb.com')) {
            xhr.addEventListener('load', function () {
                try {
                    console.log('[Verboo] Detected Bilibili AI subtitle XHR:', url);
                    const data = JSON.parse(xhr.responseText);
                    const subtitles = parseBilibiliAISubtitle(data);
                    if (subtitles && subtitles.length > 0) {
                        console.log('[Verboo] Captured AI subtitles (XHR):', subtitles.length, 'items');
                        electron_1.ipcRenderer.sendToHost('bilibili-ai-subtitle', {
                            type: 'bilibili-ai-subtitle',
                            data: subtitles,
                            count: subtitles.length
                        });
                    }
                }
                catch (e) {
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
    function parseBilibiliAISubtitle(data) {
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
            return body.map((item) => ({
                start: item.from || 0,
                duration: (item.to || 0) - (item.from || 0),
                text: item.content || ''
            })).filter((item) => item.text.trim() !== '');
        }
        catch (e) {
            console.error('[Verboo] Failed to parse AI subtitle body:', e);
            return [];
        }
    }
    // ============ Video Time Monitoring ============
    let videoTimeInterval = null;
    function startVideoTimeMonitoring() {
        if (videoTimeInterval)
            return;
        videoTimeInterval = setInterval(() => {
            const adapter = getCurrentAdapter();
            const videoElement = adapter.findVideoElement();
            if (videoElement && !videoElement.paused && videoElement.currentTime > 0) {
                electron_1.ipcRenderer.sendToHost('video-time-update', {
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
