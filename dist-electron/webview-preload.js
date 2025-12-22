"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Platform detection patterns
const PLATFORM_PATTERNS = [
    { name: '小红书', patterns: ['xiaohongshu.com', 'xhslink.com', 'xhs.cn'] },
    { name: 'Twitter', patterns: ['twitter.com', 'x.com'] },
    { name: 'TikTok', patterns: ['tiktok.com'] },
    { name: 'Reddit', patterns: ['reddit.com'] },
];
/**
 * Check if current URL matches a supported platform
 */
function getMatchedPlatform() {
    const url = window.location.href;
    for (const platform of PLATFORM_PATTERNS) {
        if (platform.patterns.some(p => url.includes(p))) {
            return platform.name;
        }
    }
    return null;
}
/**
 * Capture script for XHS (小红书)
 */
function captureXHS() {
    try {
        const result = {
            title: '',
            content: '',
            images: [],
            author: { name: '', avatar: '', profileUrl: '' },
            tags: []
        };
        // Extract title
        const titleEl = document.querySelector('#detail-title')
            || document.querySelector('.title')
            || document.querySelector('[class*="title"]');
        if (titleEl) {
            result.title = titleEl.textContent?.trim() || '';
        }
        // Extract content
        const contentEl = document.querySelector('#detail-desc')
            || document.querySelector('.desc')
            || document.querySelector('[class*="content"]')
            || document.querySelector('.note-text');
        if (contentEl) {
            result.content = contentEl.textContent?.trim() || '';
        }
        // Extract images
        const imageEls = document.querySelectorAll('.swiper-slide img, .carousel img, [class*="image"] img');
        if (imageEls.length > 0) {
            imageEls.forEach(img => {
                const src = img.src || img.dataset.src;
                if (src && !result.images.includes(src)) {
                    result.images.push(src);
                }
            });
        }
        // Fallback images
        if (result.images.length === 0) {
            document.querySelectorAll('img[src*="xhscdn"], img[src*="xiaohongshu"]').forEach(img => {
                const src = img.src;
                if (src && src.includes('http') && !result.images.includes(src)) {
                    result.images.push(src);
                }
            });
        }
        // Extract author
        const authorNameEl = document.querySelector('.author-wrapper .name')
            || document.querySelector('[class*="nickname"]')
            || document.querySelector('.user-name');
        if (authorNameEl) {
            result.author.name = authorNameEl.textContent?.trim() || '';
        }
        const authorAvatarEl = document.querySelector('.author-wrapper img')
            || document.querySelector('[class*="avatar"] img');
        if (authorAvatarEl) {
            result.author.avatar = authorAvatarEl.src || '';
        }
        const authorLinkEl = document.querySelector('.author-wrapper a')
            || document.querySelector('[class*="user"] a');
        if (authorLinkEl) {
            result.author.profileUrl = authorLinkEl.href || '';
        }
        // Extract tags
        document.querySelectorAll('[class*="tag"] a, .hashtag, [id*="hash-tag"]').forEach(tag => {
            const tagText = tag.textContent?.trim().replace(/^#/, '');
            if (tagText && !result.tags.includes(tagText)) {
                result.tags.push(tagText);
            }
        });
        // Extract hashtags from content
        const hashtagRegex = /#([^#\s]+)/g;
        let match;
        while ((match = hashtagRegex.exec(result.content)) !== null) {
            const tag = match[1].trim();
            if (tag && !result.tags.includes(tag)) {
                result.tags.push(tag);
            }
        }
        return result;
    }
    catch (error) {
        return { error: error.message };
    }
}
/**
 * Capture content based on current platform
 */
function captureContent() {
    const platform = getMatchedPlatform();
    if (!platform) {
        return { error: 'Unsupported platform' };
    }
    let rawData;
    switch (platform) {
        case '小红书':
            rawData = captureXHS();
            break;
        // Future platforms can be added here
        default:
            return { error: 'Capture not implemented for this platform' };
    }
    if (rawData.error) {
        return rawData;
    }
    return {
        platform,
        title: rawData.title,
        content: rawData.content,
        images: rawData.images,
        author: rawData.author,
        tags: rawData.tags,
        originalUrl: window.location.href,
        capturedAt: new Date().toISOString()
    };
}
// Expose a safe API to the guest page - must run before page scripts
(function () {
    console.log('Verboo: webview-preload.js loaded');
    window.verboo = {
        sendData: (data) => {
            console.log('Verboo: Sending data to host', data);
            electron_1.ipcRenderer.sendToHost('plugin-data', data);
        },
        captureContent: async () => {
            return captureContent();
        }
    };
    // Also make it available as early as possible
    Object.defineProperty(window, 'verboo', {
        value: window.verboo,
        writable: false,
        configurable: false
    });
    // ============ Context Menu Handler ============
    document.addEventListener('contextmenu', (e) => {
        const platform = getMatchedPlatform();
        console.log('[Verboo] Context menu triggered, platform:', platform);
        // Send message to host to show custom menu
        electron_1.ipcRenderer.sendToHost('show-context-menu', {
            x: e.clientX,
            y: e.clientY,
            canCapture: platform !== null,
            platform: platform
        });
    });
    // Listen for capture command from main process
    electron_1.ipcRenderer.on('execute-capture', () => {
        console.log('[Verboo] Capture command received');
        const result = captureContent();
        electron_1.ipcRenderer.sendToHost('capture-result', result);
    });
    // Monitor video playback time
    let videoTimeInterval = null;
    function startVideoTimeMonitoring() {
        if (videoTimeInterval)
            return; // Already monitoring
        videoTimeInterval = setInterval(() => {
            // Try to find video element
            let videoElement = null;
            let currentTime = 0;
            // YouTube
            const youtubeVideo = document.querySelector('video.html5-main-video');
            if (youtubeVideo && !youtubeVideo.paused) {
                videoElement = youtubeVideo;
                currentTime = youtubeVideo.currentTime;
            }
            // Bilibili
            if (!videoElement) {
                const bilibiliVideo = document.querySelector('video');
                if (bilibiliVideo && !bilibiliVideo.paused) {
                    videoElement = bilibiliVideo;
                    currentTime = bilibiliVideo.currentTime;
                }
            }
            // Send time update if video is playing
            if (videoElement && currentTime > 0) {
                electron_1.ipcRenderer.sendToHost('video-time-update', {
                    currentTime,
                    duration: videoElement.duration,
                    paused: videoElement.paused
                });
            }
        }, 500); // Check every 500ms
    }
    // Start monitoring after page loads
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(startVideoTimeMonitoring, 1000); // Wait 1s for video to load
    });
    // Also try immediately if DOM is already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(startVideoTimeMonitoring, 1000);
    }
})();
