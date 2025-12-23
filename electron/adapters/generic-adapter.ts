/**
 * Generic Platform Adapter
 *
 * Fallback adapter for unknown platforms.
 * Provides basic video capture functionality.
 */

import type { PlatformAdapter, PlatformInfo, AdapterCapabilities, AuthorInfo, ContentCaptureResult } from './types';

class GenericAdapter implements PlatformAdapter {
    private currentUrl: string = '';

    readonly platform: PlatformInfo = {
        id: 'generic',
        name: 'Generic',
        favicon: ''
    };

    readonly capabilities: AdapterCapabilities = {
        canCaptureContent: false,
        canCaptureVideo: true,
        canExtractSubtitles: false
    };

    /**
     * Generic adapter matches any URL (used as fallback)
     */
    match(url: string): boolean {
        this.currentUrl = url;
        return true;
    }

    /**
     * Get platform info dynamically based on current URL
     */
    getPlatformInfo(): PlatformInfo {
        try {
            const url = new URL(this.currentUrl || window.location.href);
            const hostname = url.hostname.replace('www.', '');
            const platformId = hostname.split('.')[0];

            // Try to get favicon from page
            const faviconLink = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]') as HTMLLinkElement;
            const favicon = faviconLink?.href || `https://${hostname}/favicon.ico`;

            return {
                id: platformId,
                name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
                favicon
            };
        } catch {
            return this.platform;
        }
    }

    /**
     * Try to extract author info using common patterns
     */
    getAuthorInfo(): AuthorInfo | null {
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
            const el = document.querySelector(pattern) as HTMLElement;
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
    getVideoTitle(): string | null {
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
                const text = (el as HTMLElement).textContent?.trim();
                if (text) return text;
            }
        }

        return document.title || null;
    }

    /**
     * Find any video element on the page
     */
    findVideoElement(): HTMLVideoElement | null {
        // Try to find the main/largest video
        const videos = Array.from(document.querySelectorAll('video'));

        if (videos.length === 0) return null;
        if (videos.length === 1) return videos[0] as HTMLVideoElement;

        // Find the largest video (likely the main content)
        let largestVideo: HTMLVideoElement | null = null;
        let largestArea = 0;

        for (const video of videos) {
            const rect = video.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area > largestArea && (video as HTMLVideoElement).readyState >= 2) {
                largestArea = area;
                largestVideo = video as HTMLVideoElement;
            }
        }

        return largestVideo;
    }

    /**
     * Content capture not supported for generic adapter
     */
    captureContent(): ContentCaptureResult | null {
        return null;
    }
}

// Export singleton instance (not auto-registered, used as fallback)
export const genericAdapter = new GenericAdapter();

export { GenericAdapter };
