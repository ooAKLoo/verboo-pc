"use strict";
/**
 * YouTube Platform Adapter
 *
 * Handles video capture and author extraction for YouTube.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeAdapter = void 0;
const registry_1 = require("./registry");
class YouTubeAdapter {
    platform = {
        id: 'youtube',
        name: 'YouTube',
        favicon: 'https://www.youtube.com/favicon.ico'
    };
    capabilities = {
        canCaptureContent: false, // YouTube is video-focused
        canCaptureVideo: true,
        canExtractSubtitles: true
    };
    /**
     * Match YouTube URLs
     */
    match(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.includes('youtube.com') || hostname.includes('youtu.be');
        }
        catch {
            return false;
        }
    }
    /**
     * Get channel info from YouTube video page
     */
    getAuthorInfo() {
        // Channel name - try multiple selectors for different YouTube layouts
        const channelSelectors = [
            '#channel-name a',
            'ytd-channel-name a',
            '.ytd-video-owner-renderer #channel-name a',
            '#owner-name a',
            'ytd-video-owner-renderer .yt-simple-endpoint',
            '#upload-info #channel-name a'
        ];
        let channelEl = null;
        for (const selector of channelSelectors) {
            channelEl = document.querySelector(selector);
            if (channelEl?.textContent?.trim())
                break;
        }
        if (!channelEl)
            return null;
        // Channel avatar
        const avatarSelectors = [
            '#owner #avatar img',
            'ytd-video-owner-renderer #avatar img',
            '#channel-thumbnail img',
            '.ytd-video-owner-renderer img#img'
        ];
        let avatarEl = null;
        for (const selector of avatarSelectors) {
            avatarEl = document.querySelector(selector);
            if (avatarEl?.src)
                break;
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
    getVideoTitle() {
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
                const text = el.textContent?.trim();
                if (text)
                    return text;
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
    findVideoElement() {
        // Primary YouTube video element
        const mainVideo = document.querySelector('video.html5-main-video');
        if (mainVideo)
            return mainVideo;
        // Fallback to first video
        const video = document.querySelector('video');
        return video || null;
    }
    /**
     * Content capture not supported for YouTube
     */
    captureContent() {
        return null;
    }
}
exports.YouTubeAdapter = YouTubeAdapter;
// Auto-register
registry_1.adapterRegistry.register(new YouTubeAdapter());
