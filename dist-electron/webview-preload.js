"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Platform detection patterns
const PLATFORM_PATTERNS = [
    { name: '小红书', patterns: ['xiaohongshu.com', 'xhslink.com', 'xhs.cn'] },
    { name: 'Twitter', patterns: ['twitter.com', 'x.com'] },
    { name: 'TikTok', patterns: ['tiktok.com'] },
    { name: 'Reddit', patterns: ['reddit.com'] },
    { name: 'Instagram', patterns: ['instagram.com'] },
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
 * Find the closest post/note container from a clicked element
 */
function findNoteContainer(element) {
    if (!element)
        return null;
    // Walk up the DOM tree to find the note container
    let current = element;
    let depth = 0;
    const maxDepth = 15; // Prevent infinite loops
    while (current && depth < maxDepth) {
        // Check if this is a note card/container
        const classList = current.classList?.toString() || '';
        const className = current.className?.toString() || '';
        // Common XHS note container patterns
        if (classList.includes('note-item') ||
            classList.includes('note-card') ||
            classList.includes('feed-card') ||
            current.tagName === 'SECTION' && classList.includes('note') ||
            current.hasAttribute('data-note-id') ||
            current.querySelector('[class*="note-content"]')) {
            return current;
        }
        current = current.parentElement;
        depth++;
    }
    return null;
}
/**
 * Capture script for XHS (小红书) - capture specific note at clicked position
 */
function captureXHS(targetElement) {
    try {
        const result = {
            title: '',
            content: '',
            images: [],
            author: { name: '', avatar: '', profileUrl: '' },
            tags: [],
            stats: { likes: 0, comments: 0, collects: 0, shares: 0 },
            publishedAt: null
        };
        // If we have a target element, find the note container
        let noteContainer = null;
        if (targetElement) {
            noteContainer = findNoteContainer(targetElement);
            console.log('[Verboo] Found note container:', noteContainer);
        }
        // If no container found, use the whole page (fallback)
        const searchRoot = noteContainer || document;
        // Extract title
        const titleEl = searchRoot.querySelector('#detail-title')
            || searchRoot.querySelector('.title')
            || searchRoot.querySelector('[class*="note-title"]')
            || searchRoot.querySelector('[class*="title"]');
        if (titleEl) {
            result.title = titleEl.textContent?.trim() || '';
        }
        // Extract content
        const contentEl = searchRoot.querySelector('#detail-desc')
            || searchRoot.querySelector('.desc')
            || searchRoot.querySelector('[class*="note-content"]')
            || searchRoot.querySelector('[class*="note-text"]')
            || searchRoot.querySelector('[class*="content"]');
        if (contentEl) {
            result.content = contentEl.textContent?.trim() || '';
        }
        // Extract images from the specific note container
        const imageEls = searchRoot.querySelectorAll('img');
        const validImages = [];
        imageEls.forEach(img => {
            const src = img.src || img.dataset.src || '';
            // Filter out avatar images and only keep content images
            const isAvatar = img.classList.toString().includes('avatar') ||
                img.closest('[class*="avatar"]') !== null ||
                img.closest('[class*="author"]') !== null ||
                img.closest('[class*="user"]') !== null ||
                src.includes('/avatar/') ||
                (img.width < 100 && img.height < 100); // Small images are likely avatars
            // Keep large images from XHS CDN
            if (src &&
                src.includes('http') &&
                (src.includes('xhscdn') || src.includes('xiaohongshu')) &&
                !isAvatar &&
                !validImages.includes(src)) {
                validImages.push(src);
            }
        });
        result.images = validImages;
        // Extract author info
        const authorContainer = searchRoot.querySelector('[class*="author"]') ||
            searchRoot.querySelector('[class*="user-info"]');
        if (authorContainer) {
            const authorNameEl = authorContainer.querySelector('[class*="name"]') ||
                authorContainer.querySelector('[class*="nickname"]');
            if (authorNameEl) {
                result.author.name = authorNameEl.textContent?.trim() || '';
            }
            const authorAvatarEl = authorContainer.querySelector('img');
            if (authorAvatarEl) {
                result.author.avatar = authorAvatarEl.src || '';
            }
            const authorLinkEl = authorContainer.querySelector('a');
            if (authorLinkEl) {
                result.author.profileUrl = authorLinkEl.href || '';
            }
        }
        // Extract tags
        searchRoot.querySelectorAll('[class*="tag"] a, .hashtag, [id*="hash-tag"], a[href*="/search_result"]').forEach(tag => {
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
        // Extract engagement stats (likes, comments, collects, shares)
        const extractNumber = (text) => {
            if (!text)
                return 0;
            // Handle formats like "1.2万", "1234", "1.2k"
            const cleaned = text.replace(/[^\d.万kKwW]/g, '');
            if (cleaned.includes('万') || cleaned.toLowerCase().includes('w')) {
                return Math.round(parseFloat(cleaned) * 10000);
            }
            if (cleaned.toLowerCase().includes('k')) {
                return Math.round(parseFloat(cleaned) * 1000);
            }
            return parseInt(cleaned) || 0;
        };
        // Find engagement stats in the note container
        const statsContainer = searchRoot.querySelector('[class*="interact"]') ||
            searchRoot.querySelector('[class*="engagement"]') ||
            searchRoot.querySelector('[class*="footer"]');
        if (statsContainer) {
            // Extract likes (点赞)
            const likeEls = statsContainer.querySelectorAll('[class*="like"], [class*="zan"]');
            likeEls.forEach(el => {
                const text = el.textContent?.trim() || '';
                const num = extractNumber(text);
                if (num > 0 && num > result.stats.likes) {
                    result.stats.likes = num;
                }
            });
            // Extract comments (评论)
            const commentEls = statsContainer.querySelectorAll('[class*="comment"], [class*="pinglun"]');
            commentEls.forEach(el => {
                const text = el.textContent?.trim() || '';
                const num = extractNumber(text);
                if (num > 0 && num > result.stats.comments) {
                    result.stats.comments = num;
                }
            });
            // Extract collects (收藏)
            const collectEls = statsContainer.querySelectorAll('[class*="collect"], [class*="shoucang"], [class*="star"]');
            collectEls.forEach(el => {
                const text = el.textContent?.trim() || '';
                const num = extractNumber(text);
                if (num > 0 && num > result.stats.collects) {
                    result.stats.collects = num;
                }
            });
            // Extract shares (分享)
            const shareEls = statsContainer.querySelectorAll('[class*="share"], [class*="fenxiang"]');
            shareEls.forEach(el => {
                const text = el.textContent?.trim() || '';
                const num = extractNumber(text);
                if (num > 0 && num > result.stats.shares) {
                    result.stats.shares = num;
                }
            });
        }
        // Extract published time (发布时间)
        const timeEl = searchRoot.querySelector('[class*="time"]') ||
            searchRoot.querySelector('[class*="date"]') ||
            searchRoot.querySelector('[class*="publish"]') ||
            searchRoot.querySelector('time');
        if (timeEl) {
            const timeText = timeEl.textContent?.trim() || '';
            const timeAttr = timeEl.getAttribute('datetime') ||
                timeEl.getAttribute('data-time');
            // Try to parse the time
            if (timeAttr) {
                result.publishedAt = new Date(timeAttr).toISOString();
            }
            else if (timeText) {
                // Parse relative time like "5分钟前", "2小时前", "昨天 20:30"
                const now = new Date();
                if (timeText.includes('分钟前')) {
                    const minutes = parseInt(timeText);
                    result.publishedAt = new Date(now.getTime() - minutes * 60000).toISOString();
                }
                else if (timeText.includes('小时前')) {
                    const hours = parseInt(timeText);
                    result.publishedAt = new Date(now.getTime() - hours * 3600000).toISOString();
                }
                else if (timeText.includes('天前')) {
                    const days = parseInt(timeText);
                    result.publishedAt = new Date(now.getTime() - days * 86400000).toISOString();
                }
                else if (timeText.includes('昨天')) {
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    result.publishedAt = yesterday.toISOString();
                }
                else {
                    // Try direct date parse
                    try {
                        const parsed = new Date(timeText);
                        if (!isNaN(parsed.getTime())) {
                            result.publishedAt = parsed.toISOString();
                        }
                    }
                    catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        }
        console.log('[Verboo] Captured data:', result);
        return result;
    }
    catch (error) {
        console.error('[Verboo] Capture error:', error);
        return { error: error.message };
    }
}
/**
 * Capture content based on current platform
 */
function captureContent(targetElement) {
    const platform = getMatchedPlatform();
    if (!platform) {
        return { error: 'Unsupported platform' };
    }
    let rawData;
    switch (platform) {
        case '小红书':
            rawData = captureXHS(targetElement);
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
        capturedAt: new Date().toISOString(),
        publishedAt: rawData.publishedAt,
        stats: rawData.stats
    };
}
// Expose API to renderer via contextBridge
electron_1.contextBridge.exposeInMainWorld('verboo', {
    sendData: (data) => {
        console.log('Verboo: Sending data to host', data);
        electron_1.ipcRenderer.send('plugin-data', data);
    },
    captureContent: async () => {
        return captureContent();
    }
});
console.log('Verboo: webview-preload.js loaded with contextBridge');
// ============ Context Menu Handler ============
// Store the last clicked element for capture
let lastClickedElement = null;
window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', (e) => {
        const platform = getMatchedPlatform();
        console.log('[Verboo] Context menu triggered, platform:', platform);
        // Store the clicked element
        lastClickedElement = e.target;
        console.log('[Verboo] Clicked element:', lastClickedElement);
        // Prevent default context menu
        e.preventDefault();
        // Send message to main process to show custom menu
        electron_1.ipcRenderer.send('show-context-menu', {
            platform: platform,
            canCapture: platform !== null
        });
    });
    // Listen for capture command from main process
    electron_1.ipcRenderer.on('execute-capture', () => {
        console.log('[Verboo] Capture command received, target element:', lastClickedElement);
        const result = captureContent(lastClickedElement || undefined);
        console.log('[Verboo] Capture result:', result);
        // Send result to main process
        electron_1.ipcRenderer.send('capture-result', result);
        // Clear the clicked element
        lastClickedElement = null;
    });
    console.log('[Verboo] Context menu handler registered');
});
