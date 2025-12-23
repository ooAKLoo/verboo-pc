"use strict";
/**
 * Generic Platform Adapter
 *
 * Fallback adapter for unknown platforms.
 * Provides basic video capture functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericAdapter = exports.genericAdapter = void 0;
class GenericAdapter {
    currentUrl = '';
    platform = {
        id: 'generic',
        name: 'Generic',
        favicon: ''
    };
    capabilities = {
        canCaptureContent: false,
        canCaptureVideo: true,
        canExtractSubtitles: false
    };
    /**
     * Generic adapter matches any URL (used as fallback)
     */
    match(url) {
        this.currentUrl = url;
        return true;
    }
    /**
     * Get platform info dynamically based on current URL
     */
    getPlatformInfo() {
        try {
            const url = new URL(this.currentUrl || window.location.href);
            const hostname = url.hostname.replace('www.', '');
            const platformId = hostname.split('.')[0];
            // Try to get favicon from page
            const faviconLink = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
            const favicon = faviconLink?.href || `https://${hostname}/favicon.ico`;
            return {
                id: platformId,
                name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
                favicon
            };
        }
        catch {
            return this.platform;
        }
    }
    /**
     * Try to extract author info using common patterns
     */
    getAuthorInfo() {
        // Try common author/uploader patterns
        const namePatterns = [
            '[itemprop="author"] [itemprop="name"]',
            '.author-name',
            '.video-author',
            '.uploader-name',
            '.channel-name',
            '.creator-name',
            '[class*="author"]',
            '[class*="uploader"]'
        ];
        for (const pattern of namePatterns) {
            const el = document.querySelector(pattern);
            if (el?.textContent?.trim()) {
                return {
                    name: el.textContent.trim()
                };
            }
        }
        return null;
    }
    /**
     * Try to get video title from page
     */
    getVideoTitle() {
        // Try common title patterns
        const titlePatterns = [
            'meta[property="og:title"]',
            'meta[name="title"]',
            'h1',
            '.video-title',
            '[class*="title"]'
        ];
        for (const pattern of titlePatterns) {
            const el = document.querySelector(pattern);
            if (el) {
                if (el instanceof HTMLMetaElement) {
                    return el.content || null;
                }
                const text = el.textContent?.trim();
                if (text)
                    return text;
            }
        }
        return document.title || null;
    }
    /**
     * Find any video element on the page
     */
    findVideoElement() {
        // Try to find the main/largest video
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0)
            return null;
        if (videos.length === 1)
            return videos[0];
        // Find the largest video (likely the main content)
        let largestVideo = null;
        let largestArea = 0;
        for (const video of videos) {
            const rect = video.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area > largestArea && video.readyState >= 2) {
                largestArea = area;
                largestVideo = video;
            }
        }
        return largestVideo;
    }
    /**
     * Content capture not supported for generic adapter
     */
    captureContent() {
        return null;
    }
}
exports.GenericAdapter = GenericAdapter;
// Export singleton instance (not auto-registered, used as fallback)
exports.genericAdapter = new GenericAdapter();
