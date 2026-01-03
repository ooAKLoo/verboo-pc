/**
 * Bilibili Platform Adapter
 *
 * Handles video capture and author extraction for Bilibili (哔哩哔哩).
 * Includes AI subtitle extraction via the AI assistant panel.
 */

import type { PlatformAdapter, PlatformInfo, AdapterCapabilities, AuthorInfo, ContentCaptureResult } from './types';
import { adapterRegistry } from './registry';

// Subtitle item interface
interface SubtitleItem {
    start: number;
    duration: number;
    text: string;
}

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

    /**
     * Extract subtitles from Bilibili AI assistant
     * Uses the same approach as the bilibili-subtitle userscript:
     * 1. Click AI assistant to open panel
     * 2. Click "字幕列表" button
     * 3. Extract subtitles from DOM
     */
    async extractSubtitles(): Promise<SubtitleItem[]> {
        return new Promise((resolve, reject) => {
            console.log('[BilibiliAdapter] Starting subtitle extraction...');

            // Step 1: Find and click AI assistant button
            const aiAssistantContainer = document.querySelector('.video-ai-assistant') as HTMLElement;
            if (!aiAssistantContainer) {
                reject(new Error('无法找到AI小助手按钮'));
                return;
            }

            aiAssistantContainer.click();
            console.log('[BilibiliAdapter] Clicked AI assistant');

            // Step 2: Wait for panel to load, then click subtitle list button
            setTimeout(() => {
                const subtitleListButton = this.findSubtitleListButton();
                if (!subtitleListButton) {
                    this.closeAIPanel();
                    reject(new Error('无法找到"字幕列表"按钮，请确保AI小助手面板已正确加载'));
                    return;
                }

                console.log('[BilibiliAdapter] Found subtitle list button, clicking...');
                subtitleListButton.click();

                // Step 3: Wait for subtitles to load, then extract
                setTimeout(() => {
                    try {
                        const subtitles = this.extractSubtitlesFromDOM();
                        this.closeAIPanel();

                        if (subtitles.length === 0) {
                            reject(new Error('未能提取到字幕，请确保视频有AI字幕'));
                            return;
                        }

                        console.log('[BilibiliAdapter] Extracted', subtitles.length, 'subtitles');
                        resolve(subtitles);
                    } catch (error) {
                        this.closeAIPanel();
                        reject(error);
                    }
                }, 2000);
            }, 2000);
        });
    }

    /**
     * Find the subtitle list button in AI assistant panel
     */
    private findSubtitleListButton(): HTMLElement | null {
        // Try specific class first
        const buttonByClass = document.querySelector('span._Label_krx6h_18') as HTMLElement;
        if (buttonByClass && buttonByClass.textContent === '字幕列表') {
            return buttonByClass;
        }

        // Try various selectors
        const selectors = [
            'span[class*="Label"]',
            'div[class*="Label"]',
            'button[class*="Label"]',
            'span',
            'button'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element.textContent?.includes('字幕列表')) {
                    return element as HTMLElement;
                }
            }
        }

        // Last resort: search in AI panel containers
        const panelElements = document.querySelectorAll('[class*="panel"], [class*="container"], [class*="ai"], [class*="assistant"]');
        for (const panel of panelElements) {
            const children = panel.querySelectorAll('*');
            for (const child of children) {
                if (child.textContent === '字幕列表') {
                    return child as HTMLElement;
                }
            }
        }

        return null;
    }

    /**
     * Extract subtitles from the DOM after clicking subtitle list
     */
    private extractSubtitlesFromDOM(): SubtitleItem[] {
        const subtitles: SubtitleItem[] = [];

        // Method 1: Try primary selectors (from GitHub project)
        document.querySelectorAll('._Part_1iu0q_16').forEach(part => {
            const timeElem = part.querySelector('._TimeText_1iu0q_35');
            const textElem = part.querySelector('._Text_1iu0q_64');

            if (timeElem && textElem) {
                const timeText = timeElem.textContent?.trim() || '0:00';
                const text = textElem.textContent?.trim() || '';
                if (text) {
                    subtitles.push({
                        start: this.parseTimeToSeconds(timeText),
                        duration: 3, // Default duration
                        text
                    });
                }
            }
        });

        if (subtitles.length > 0) return subtitles;

        // Method 2: Look for time + text pattern
        const timeElements = document.querySelectorAll('[class*="time"], [class*="Time"], [class*="TimeText"]');
        timeElements.forEach(timeElem => {
            const timeText = timeElem.textContent?.trim() || '';
            if (/^\d+:\d+$/.test(timeText)) {
                const textElem = timeElem.nextElementSibling;
                if (textElem && textElem.textContent?.trim()) {
                    subtitles.push({
                        start: this.parseTimeToSeconds(timeText),
                        duration: 3,
                        text: textElem.textContent.trim()
                    });
                }
            }
        });

        if (subtitles.length > 0) return subtitles;

        // Method 3: Look for subtitle containers
        const containerSelectors = [
            '[class*="subtitle"]',
            '[class*="Subtitle"]',
            '[class*="Part"]',
            '[class*="Line"]',
            '[class*="item"]'
        ];

        for (const selector of containerSelectors) {
            document.querySelectorAll(selector).forEach(container => {
                const children = container.children;
                if (children.length >= 2) {
                    const firstChild = children[0];
                    const secondChild = children[1];
                    const timeText = firstChild.textContent?.trim() || '';

                    if (/^\d+:\d+$/.test(timeText) && secondChild.textContent?.trim()) {
                        subtitles.push({
                            start: this.parseTimeToSeconds(timeText),
                            duration: 3,
                            text: secondChild.textContent.trim()
                        });
                    }
                }
            });

            if (subtitles.length > 0) break;
        }

        // Remove duplicates
        const seen = new Set<string>();
        return subtitles.filter(sub => {
            const key = `${sub.start}-${sub.text}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Parse time string (MM:SS) to seconds
     */
    private parseTimeToSeconds(timeStr: string): number {
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0;
    }

    /**
     * Close the AI assistant panel
     */
    private closeAIPanel(): void {
        // 尝试多种关闭按钮选择器（按优先级排序）
        const closeSelectors = [
            // B站AI助手面板的关闭按钮 (类名包含 CloseBtn)
            '[class*="_CloseBtn_"]',
            '[class*="CloseBtn"]',
            // 通用关闭按钮
            '.close-btn',
            '[class*="close-btn"]',
            '[aria-label="关闭"]',
            '[title="关闭"]',
        ];

        for (const selector of closeSelectors) {
            const closeButton = document.querySelector(selector) as HTMLElement;
            if (closeButton) {
                console.log('[BilibiliAdapter] Closing panel with selector:', selector);
                closeButton.click();
                return;
            }
        }

        // 如果找不到关闭按钮，尝试再次点击AI助手按钮来切换关闭
        console.log('[BilibiliAdapter] No close button found, trying to toggle AI assistant');
        const aiAssistant = document.querySelector('.video-ai-assistant') as HTMLElement;
        if (aiAssistant) {
            aiAssistant.click();
        }
    }
}

// Auto-register
adapterRegistry.register(new BilibiliAdapter());

export { BilibiliAdapter };
