"use strict";
/**
 * XHS (小红书) Platform Adapter
 *
 * Handles content capture for Xiaohongshu posts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.XHSAdapter = void 0;
const registry_1 = require("./registry");
class XHSAdapter {
    platform = {
        id: 'xhs',
        name: '小红书',
        favicon: 'https://www.xiaohongshu.com/favicon.ico'
    };
    capabilities = {
        canCaptureContent: true,
        canCaptureVideo: false, // XHS video capture not implemented yet
        canExtractSubtitles: false
    };
    /**
     * Match XHS URLs
     */
    match(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.includes('xiaohongshu.com') ||
                hostname.includes('xhslink.com') ||
                hostname.includes('xhs.cn');
        }
        catch {
            return false;
        }
    }
    /**
     * Get author info from XHS post page
     */
    getAuthorInfo() {
        // Author name
        const nameSelectors = [
            '.author-wrapper .name',
            '[class*="nickname"]',
            '.user-name',
            '.author-name',
            '.note-author .name'
        ];
        let nameEl = null;
        for (const selector of nameSelectors) {
            nameEl = document.querySelector(selector);
            if (nameEl?.textContent?.trim())
                break;
        }
        if (!nameEl)
            return null;
        // Author avatar
        const avatarSelectors = [
            '.author-wrapper img',
            '[class*="avatar"] img',
            '.author-avatar img',
            '.note-author img'
        ];
        let avatarEl = null;
        for (const selector of avatarSelectors) {
            avatarEl = document.querySelector(selector);
            if (avatarEl?.src)
                break;
        }
        // Author profile link
        const linkSelectors = [
            '.author-wrapper a',
            '[class*="user"] a',
            '.note-author a'
        ];
        let linkEl = null;
        for (const selector of linkSelectors) {
            linkEl = document.querySelector(selector);
            if (linkEl?.href)
                break;
        }
        return {
            name: nameEl.textContent?.trim() || '',
            avatar: avatarEl?.src || undefined,
            profileUrl: linkEl?.href || undefined
        };
    }
    /**
     * XHS is not a video platform
     */
    getVideoTitle() {
        return null;
    }
    /**
     * XHS doesn't have video elements to capture
     */
    findVideoElement() {
        return null;
    }
    /**
     * Capture content from XHS post
     */
    captureContent() {
        try {
            // Extract title
            const titleSelectors = [
                '#detail-title',
                '.title',
                '[class*="title"]',
                '.note-title'
            ];
            let title = '';
            for (const selector of titleSelectors) {
                const el = document.querySelector(selector);
                if (el?.textContent?.trim()) {
                    title = el.textContent.trim();
                    break;
                }
            }
            // Extract content
            const contentSelectors = [
                '#detail-desc',
                '.desc',
                '[class*="content"]',
                '.note-text',
                '.note-content'
            ];
            let content = '';
            for (const selector of contentSelectors) {
                const el = document.querySelector(selector);
                if (el?.textContent?.trim()) {
                    content = el.textContent.trim();
                    break;
                }
            }
            // Extract images
            const images = [];
            const imageSelectors = [
                '.swiper-slide img',
                '.carousel img',
                '[class*="image"] img',
                '.note-image img'
            ];
            for (const selector of imageSelectors) {
                document.querySelectorAll(selector).forEach(img => {
                    const src = img.src || img.dataset.src;
                    if (src && !images.includes(src)) {
                        images.push(src);
                    }
                });
                if (images.length > 0)
                    break;
            }
            // Fallback images - look for XHS CDN images
            if (images.length === 0) {
                document.querySelectorAll('img[src*="xhscdn"], img[src*="xiaohongshu"]').forEach(img => {
                    const src = img.src;
                    if (src && src.includes('http') && !images.includes(src)) {
                        images.push(src);
                    }
                });
            }
            // Extract tags
            const tags = [];
            // From tag elements
            document.querySelectorAll('[class*="tag"] a, .hashtag, [id*="hash-tag"]').forEach(tag => {
                const tagText = tag.textContent?.trim().replace(/^#/, '');
                if (tagText && !tags.includes(tagText)) {
                    tags.push(tagText);
                }
            });
            // From content hashtags
            const hashtagRegex = /#([^#\s]+)/g;
            let match;
            while ((match = hashtagRegex.exec(content)) !== null) {
                const tag = match[1].trim();
                if (tag && !tags.includes(tag)) {
                    tags.push(tag);
                }
            }
            // Get author info
            const author = this.getAuthorInfo() || { name: '' };
            return {
                title,
                content,
                images,
                author,
                tags,
                url: window.location.href,
                capturedAt: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('[XHSAdapter] Capture failed:', error);
            return null;
        }
    }
}
exports.XHSAdapter = XHSAdapter;
// Auto-register
registry_1.adapterRegistry.register(new XHSAdapter());
