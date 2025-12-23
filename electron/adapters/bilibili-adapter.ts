/**
 * Bilibili Platform Adapter
 *
 * Handles video capture and author extraction for Bilibili (哔哩哔哩).
 */

import type { PlatformAdapter, PlatformInfo, AdapterCapabilities, AuthorInfo, ContentCaptureResult } from './types';
import { adapterRegistry } from './registry';

class BilibiliAdapter implements PlatformAdapter {
    readonly platform: PlatformInfo = {
        id: 'bilibili',
        name: '哔哩哔哩',
        favicon: 'https://www.bilibili.com/favicon.ico'
    };

    readonly capabilities: AdapterCapabilities = {
        canCaptureContent: false,  // Bilibili is video-focused
        canCaptureVideo: true,
        canExtractSubtitles: true
    };

    /**
     * Match Bilibili URLs
     */
    match(url: string): boolean {
        try {
            const hostname = new URL(url).hostname;
            return hostname.includes('bilibili.com') || hostname.includes('b23.tv');
        } catch {
            return false;
        }
    }

    /**
     * Get UP主 (uploader) info from Bilibili video page
     */
    getAuthorInfo(): AuthorInfo | null {
        // UP主名称 - try multiple selectors
        const nameSelectors = [
            '.up-name',
            '.username',
            '.up-info-container .up-name',
            'a.up-name',
            '.up-info .name',
            '.video-info-detail .up-info .up-name'
        ];

        let upNameEl: HTMLElement | null = null;
        for (const selector of nameSelectors) {
            upNameEl = document.querySelector(selector) as HTMLElement;
            if (upNameEl?.textContent?.trim()) break;
        }

        if (!upNameEl) return null;

        // UP主头像
        const avatarSelectors = [
            '.up-avatar img',
            '.up-info-container .up-avatar img',
            '.up-face img',
            '.up-info .up-avatar img',
            '.video-info-detail .up-info img'
        ];

        let upAvatarEl: HTMLImageElement | null = null;
        for (const selector of avatarSelectors) {
            upAvatarEl = document.querySelector(selector) as HTMLImageElement;
            if (upAvatarEl?.src) break;
        }

        // UP主主页链接
        const linkSelectors = [
            'a.up-name',
            '.up-info-container a[href*="/space.bilibili.com"]',
            '.up-info a[href*="space.bilibili.com"]',
            '.up-avatar-wrap a'
        ];

        let upLinkEl: HTMLAnchorElement | null = null;
        for (const selector of linkSelectors) {
            upLinkEl = document.querySelector(selector) as HTMLAnchorElement;
            if (upLinkEl?.href) break;
        }

        return {
            name: upNameEl.textContent?.trim() || '',
            avatar: upAvatarEl?.src || undefined,
            profileUrl: upLinkEl?.href || undefined
        };
    }

    /**
     * Get video title from Bilibili page
     */
    getVideoTitle(): string | null {
        const titleSelectors = [
            'h1.video-title',
            '.video-info h1',
            '.video-title',
            'h1[title]',
            '.tit',
            'meta[property="og:title"]'
        ];

        for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                if (el instanceof HTMLMetaElement) {
                    return el.content || null;
                }
                // Check for title attribute first (common in Bilibili)
                const titleAttr = el.getAttribute('title');
                if (titleAttr) return titleAttr;

                const text = (el as HTMLElement).textContent?.trim();
                if (text) return text;
            }
        }

        // Fallback to document title (remove "_哔哩哔哩_bilibili" suffix)
        const docTitle = document.title;
        const suffixes = ['_哔哩哔哩_bilibili', '_bilibili', ' - 哔哩哔哩'];
        for (const suffix of suffixes) {
            if (docTitle.endsWith(suffix)) {
                return docTitle.slice(0, -suffix.length);
            }
        }

        return docTitle || null;
    }

    /**
     * Find Bilibili video element
     */
    findVideoElement(): HTMLVideoElement | null {
        // Bilibili video player selectors
        const videoSelectors = [
            '.bilibili-player-video video',
            '.bpx-player-video-wrap video',
            '#bilibili-player video',
            'video'
        ];

        for (const selector of videoSelectors) {
            const video = document.querySelector(selector) as HTMLVideoElement;
            if (video && video.readyState >= 2) {
                return video;
            }
        }

        // Fallback to first video with content
        const allVideos = document.querySelectorAll('video');
        for (const video of allVideos) {
            if ((video as HTMLVideoElement).readyState >= 2) {
                return video as HTMLVideoElement;
            }
        }

        return null;
    }

    /**
     * Content capture not supported for Bilibili
     */
    captureContent(): ContentCaptureResult | null {
        return null;
    }
}

// Auto-register
adapterRegistry.register(new BilibiliAdapter());

export { BilibiliAdapter };
