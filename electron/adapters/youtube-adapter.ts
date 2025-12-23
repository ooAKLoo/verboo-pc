/**
 * YouTube Platform Adapter
 *
 * Handles video capture and author extraction for YouTube.
 */

import type { PlatformAdapter, PlatformInfo, AdapterCapabilities, AuthorInfo, ContentCaptureResult } from './types';
import { adapterRegistry } from './registry';

class YouTubeAdapter implements PlatformAdapter {
    readonly platform: PlatformInfo = {
        id: 'youtube',
        name: 'YouTube',
        favicon: 'https://www.youtube.com/favicon.ico'
    };

    readonly capabilities: AdapterCapabilities = {
        canCaptureContent: false,  // YouTube is video-focused
        canCaptureVideo: true,
        canExtractSubtitles: true
    };

    /**
     * Match YouTube URLs
     */
    match(url: string): boolean {
        try {
            const hostname = new URL(url).hostname;
            return hostname.includes('youtube.com') || hostname.includes('youtu.be');
        } catch {
            return false;
        }
    }

    /**
     * Get channel info from YouTube video page
     */
    getAuthorInfo(): AuthorInfo | null {
        // Channel name - try multiple selectors for different YouTube layouts
        const channelSelectors = [
            '#channel-name a',
            'ytd-channel-name a',
            '.ytd-video-owner-renderer #channel-name a',
            '#owner-name a',
            'ytd-video-owner-renderer .yt-simple-endpoint',
            '#upload-info #channel-name a'
        ];

        let channelEl: HTMLAnchorElement | null = null;
        for (const selector of channelSelectors) {
            channelEl = document.querySelector(selector) as HTMLAnchorElement;
            if (channelEl?.textContent?.trim()) break;
        }

        if (!channelEl) return null;

        // Channel avatar
        const avatarSelectors = [
            '#owner #avatar img',
            'ytd-video-owner-renderer #avatar img',
            '#channel-thumbnail img',
            '.ytd-video-owner-renderer img#img'
        ];

        let avatarEl: HTMLImageElement | null = null;
        for (const selector of avatarSelectors) {
            avatarEl = document.querySelector(selector) as HTMLImageElement;
            if (avatarEl?.src) break;
        }

        return {
            name: channelEl.textContent?.trim() || '',
            avatar: avatarEl?.src || undefined,
            profileUrl: channelEl.href || undefined
        };
    }

    /**
     * Get video title from YouTube page
     */
    getVideoTitle(): string | null {
        const titleSelectors = [
            'h1.ytd-video-primary-info-renderer',
            'h1.title',
            'yt-formatted-string.ytd-video-primary-info-renderer',
            '#title h1',
            'meta[name="title"]'
        ];

        for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                if (el instanceof HTMLMetaElement) {
                    return el.content || null;
                }
                const text = (el as HTMLElement).textContent?.trim();
                if (text) return text;
            }
        }

        // Fallback to document title (remove " - YouTube" suffix)
        const docTitle = document.title;
        if (docTitle.endsWith(' - YouTube')) {
            return docTitle.slice(0, -10);
        }

        return docTitle || null;
    }

    /**
     * Find YouTube video element
     */
    findVideoElement(): HTMLVideoElement | null {
        // Primary YouTube video element
        const mainVideo = document.querySelector('video.html5-main-video') as HTMLVideoElement;
        if (mainVideo) return mainVideo;

        // Fallback to first video
        const video = document.querySelector('video') as HTMLVideoElement;
        return video || null;
    }

    /**
     * Content capture not supported for YouTube
     */
    captureContent(): ContentCaptureResult | null {
        return null;
    }
}

// Auto-register
adapterRegistry.register(new YouTubeAdapter());

export { YouTubeAdapter };
