/**
 * Bilibili Platform Adapter
 *
 * Handles video capture and author extraction for Bilibili (哔哩哔哩).
 * Includes AI subtitle extraction via the AI assistant panel.
 */

import type { PlatformAdapter, PlatformInfo, AdapterCapabilities, AuthorInfo, ContentCaptureResult } from './types';
import { adapterRegistry } from './registry';
import { ipcRenderer } from 'electron';

// Subtitle item interface
interface SubtitleItem {
    start: number;
    duration: number;
    text: string;
}

interface BilibiliSubtitleInfo {
    subtitle_url?: string;
    lan?: string;
    lan_doc?: string;
}

interface BilibiliApiResponse<T> {
    code: number;
    message?: string;
    msg?: string;
    data: T;
}

interface BilibiliViewPage {
    page?: number;
    cid?: number;
}

interface BilibiliViewData {
    aid?: number;
    cid?: number;
    pages?: BilibiliViewPage[];
}

interface BilibiliPlayerData {
    subtitle?: {
        subtitles?: BilibiliSubtitleInfo[];
    };
}

interface BilibiliSubtitleBodyItem {
    from?: number;
    to?: number;
    start?: number;
    end?: number;
    content?: string;
}

type DebugLogger = (step: string, detail?: string) => void;

interface MainProcessFetchResponse {
    success: boolean;
    data?: unknown;
    error?: string;
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
     * Extract subtitles from Bilibili.
     * Strategy:
     * 1) API-first (x/web-interface/view + x/player/wbi/v2 + subtitle_url JSON)
     * 2) Fallback to AI panel DOM extraction when API path fails
     */
    async extractSubtitles(): Promise<SubtitleItem[]> {
        console.log('[BilibiliAdapter] Starting subtitle extraction...');

        const errors: string[] = [];
        const debugSteps: string[] = [];
        const debug: DebugLogger = (step, detail) => {
            const message = detail ? `${step}: ${detail}` : step;
            debugSteps.push(message);
            console.log('[BilibiliAdapter][Debug]', message);
        };

        debug('开始提取', window.location.href);

        try {
            const apiSubtitles = await this.extractSubtitlesViaApi(debug);
            if (apiSubtitles.length > 0) {
                console.log('[BilibiliAdapter] API extraction success:', apiSubtitles.length);
                debug('API提取成功', `字幕条数=${apiSubtitles.length}`);
                return apiSubtitles;
            }
            errors.push('API未返回字幕数据');
            debug('API提取结果为空');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[BilibiliAdapter] API extraction failed:', message);
            errors.push(`API失败: ${message}`);
            debug('API提取失败', message);
        }

        try {
            const domSubtitles = await this.extractSubtitlesViaAIPanel(debug);
            if (domSubtitles.length > 0) {
                debug('AI面板提取成功', `字幕条数=${domSubtitles.length}`);
                return domSubtitles;
            }
            errors.push('AI面板未提取到字幕');
            debug('AI面板提取结果为空');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[BilibiliAdapter] AI panel extraction failed:', message);
            errors.push(`AI面板失败: ${message}`);
            debug('AI面板提取失败', message);
        }

        const debugSummary = this.buildDebugSummary(debugSteps);
        throw new Error(`${errors.join('；') || '未能提取到字幕'}${debugSummary ? ` [调试: ${debugSummary}]` : ''}`);
    }

    /**
     * API-first extraction, similar to bilibili-subtitle extension.
     */
    private async extractSubtitlesViaApi(debug?: DebugLogger): Promise<SubtitleItem[]> {
        debug?.('API流程开始');
        const identifiers = await this.resolveVideoIdentifiers(debug);
        debug?.('视频标识', `aid=${identifiers.aid ?? 'null'}, cid=${identifiers.cid ?? 'null'}`);
        if (!identifiers.aid || !identifiers.cid) {
            throw new Error('无法解析视频 aid/cid');
        }

        const wbiUrl = `https://api.bilibili.com/x/player/wbi/v2?aid=${identifiers.aid}&cid=${identifiers.cid}`;
        const meta = await this.fetchJson<BilibiliApiResponse<BilibiliPlayerData>>(wbiUrl, debug, 'wbi/v2');
        const subtitleInfos = Array.isArray(meta?.data?.subtitle?.subtitles)
            ? (meta.data.subtitle.subtitles as BilibiliSubtitleInfo[]).filter(info => !!info?.subtitle_url)
            : [];
        debug?.('可用字幕轨道数', String(subtitleInfos.length));

        if (subtitleInfos.length === 0) {
            throw new Error('该视频没有可用字幕');
        }

        const targetSubtitle = this.pickPreferredSubtitle(subtitleInfos);
        const subtitleUrl = this.normalizeSubtitleUrl(targetSubtitle.subtitle_url || '');
        debug?.('选中字幕轨道', `${targetSubtitle.lan_doc || targetSubtitle.lan || 'unknown'} -> ${subtitleUrl || 'empty'}`);
        if (!subtitleUrl) {
            throw new Error('字幕地址无效');
        }

        const subtitleJson = await this.fetchJson<unknown>(subtitleUrl, debug, 'subtitle_url');
        const subtitles = this.parseSubtitlePayload(subtitleJson, debug);
        debug?.('API字幕解析条数', String(subtitles.length));
        if (subtitles.length === 0) {
            throw new Error('字幕内容为空');
        }
        return subtitles;
    }

    /**
     * Resolve aid/cid from current page URL via Bilibili APIs.
     */
    private async resolveVideoIdentifiers(debug?: DebugLogger): Promise<{ aid?: number; cid?: number }> {
        const currentUrl = new URL(window.location.href);
        const currentPage = this.getCurrentPage(currentUrl);
        debug?.('解析页面参数', `url=${currentUrl.href}, p=${currentPage}`);

        const pathBvid = this.getBvidFromUrl(currentUrl);
        if (pathBvid) {
            debug?.('识别到BVID', pathBvid);
            const viewUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(pathBvid)}`;
            const view = await this.fetchJson<BilibiliApiResponse<BilibiliViewData>>(viewUrl, debug, 'web-interface/view');
            const aid = Number(view?.data?.aid);
            const pages = Array.isArray(view?.data?.pages) ? view.data.pages : [];
            const matchedPage = pages.find(page => Number(page?.page) === currentPage) || pages[0];
            const cid = Number(matchedPage?.cid || view?.data?.cid || currentUrl.searchParams.get('oid'));
            debug?.('BVID解析结果', `pages=${pages.length}, aid=${aid || 'null'}, cid=${cid || 'null'}`);
            return {
                aid: Number.isFinite(aid) ? aid : undefined,
                cid: Number.isFinite(cid) ? cid : undefined,
            };
        }

        const aid = this.getAidFromUrl(currentUrl);
        debug?.('尝试AVID解析', `aid=${aid ?? 'null'}`);
        if (!aid) {
            debug?.('无法从URL解析到aid/bvid');
            return {};
        }

        const pagelistUrl = `https://api.bilibili.com/x/player/pagelist?aid=${aid}`;
        const pagelist = await this.fetchJson<BilibiliApiResponse<BilibiliViewPage[]>>(pagelistUrl, debug, 'player/pagelist');
        const pages = Array.isArray(pagelist?.data) ? pagelist.data : [];
        const matchedPage = pages.find(page => Number(page?.page) === currentPage) || pages[0];
        const cid = Number(matchedPage?.cid || currentUrl.searchParams.get('oid'));
        debug?.('AVID解析结果', `pages=${pages.length}, aid=${aid}, cid=${cid || 'null'}`);
        return {
            aid,
            cid: Number.isFinite(cid) ? cid : undefined,
        };
    }

    private getCurrentPage(url: URL): number {
        const page = Number(url.searchParams.get('p') || '1');
        return Number.isFinite(page) && page > 0 ? page : 1;
    }

    private getBvidFromUrl(url: URL): string | null {
        const searchBvid = url.searchParams.get('bvid');
        if (searchBvid && /^BV/i.test(searchBvid)) {
            return searchBvid;
        }

        const parts = url.pathname.replace(/\/+$/, '').split('/');
        const last = parts[parts.length - 1] || '';
        if (/^BV/i.test(last)) {
            return last;
        }

        return null;
    }

    private getAidFromUrl(url: URL): number | null {
        const parts = url.pathname.replace(/\/+$/, '').split('/');
        const last = parts[parts.length - 1] || '';
        if (/^av\d+$/i.test(last)) {
            const aid = Number(last.slice(2));
            return Number.isFinite(aid) ? aid : null;
        }
        if (/^\d+$/.test(last)) {
            const aid = Number(last);
            return Number.isFinite(aid) ? aid : null;
        }
        return null;
    }

    private pickPreferredSubtitle(infos: BilibiliSubtitleInfo[]): BilibiliSubtitleInfo {
        const languagePreference = [
            navigator.language?.toLowerCase() || '',
            'zh-cn',
            'zh-hans',
            'zh-hant',
            'zh',
            'en'
        ];

        const normalized = infos.map(info => ({
            info,
            lang: `${info.lan || ''} ${info.lan_doc || ''}`.toLowerCase()
        }));

        for (const preferred of languagePreference) {
            if (!preferred) continue;
            const matched = normalized.find(item => item.lang.includes(preferred));
            if (matched) return matched.info;
        }

        return infos[0];
    }

    private normalizeSubtitleUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('http://')) return url.replace('http://', 'https://');
        if (/^https?:\/\//.test(url)) return url;
        try {
            return new URL(url, window.location.origin).toString();
        } catch {
            return '';
        }
    }

    private parseSubtitlePayload(data: unknown, debug?: DebugLogger): SubtitleItem[] {
        const bodyInfo = this.getSubtitleBody(data);
        if (!bodyInfo) {
            debug?.('字幕body缺失', '未找到 body/data.body/data.subtitle.body');
            return [];
        }
        debug?.('字幕body来源', bodyInfo.source);

        return bodyInfo.body.map((item: BilibiliSubtitleBodyItem) => {
            const start = Number(item?.from ?? item?.start ?? 0);
            const end = Number(item?.to ?? item?.end ?? start);
            const text = String(item?.content ?? '').trim();
            return {
                start: Number.isFinite(start) ? start : 0,
                duration: Number.isFinite(end - start) ? Math.max(end - start, 0) : 0,
                text
            };
        }).filter((item: SubtitleItem) => item.text.length > 0);
    }

    private async fetchJson<T = unknown>(url: string, debug?: DebugLogger, label: string = 'request'): Promise<T> {
        if (this.shouldUseMainProcessProxy(url)) {
            debug?.(`请求改走主进程(${label})`, url);
            const response = await ipcRenderer.invoke('fetch-bilibili-subtitle', {
                url,
                referer: window.location.href
            }) as MainProcessFetchResponse;
            if (!response?.success) {
                throw new Error(response?.error || '主进程代拉失败');
            }
            return response.data as T;
        }

        debug?.(`请求开始(${label})`, url);
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                Accept: 'application/json, text/plain, */*'
            }
        });
        debug?.(`请求状态(${label})`, String(response.status));

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }

        const data: unknown = await response.json();
        if (this.isBilibiliApiResponse(data) && data.code !== 0) {
            debug?.(`接口返回错误(${label})`, `code=${data.code}, message=${data.message || data.msg || ''}`);
            throw new Error(data.message || data.msg || `接口错误: ${data.code}`);
        }
        return data as T;
    }

    private shouldUseMainProcessProxy(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.hostname.includes('aisubtitle.hdslb.com');
        } catch {
            return false;
        }
    }

    private getSubtitleBody(data: unknown): { body: BilibiliSubtitleBodyItem[]; source: string } | null {
        if (!this.isRecord(data)) return null;

        const directBody = data.body;
        if (Array.isArray(directBody)) {
            return { body: directBody as BilibiliSubtitleBodyItem[], source: 'body' };
        }

        const nestedData = data.data;
        if (!this.isRecord(nestedData)) return null;

        const nestedBody = nestedData.body;
        if (Array.isArray(nestedBody)) {
            return { body: nestedBody as BilibiliSubtitleBodyItem[], source: 'data.body' };
        }

        const nestedSubtitle = nestedData.subtitle;
        if (!this.isRecord(nestedSubtitle)) return null;
        if (!Array.isArray(nestedSubtitle.body)) return null;

        return { body: nestedSubtitle.body as BilibiliSubtitleBodyItem[], source: 'data.subtitle.body' };
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private isBilibiliApiResponse(value: unknown): value is { code: number; message?: string; msg?: string } {
        if (!this.isRecord(value)) return false;
        return typeof value.code === 'number';
    }

    private buildDebugSummary(steps: string[]): string {
        if (steps.length === 0) return '';
        return steps.slice(-12).join(' -> ');
    }

    /**
     * Fallback: Extract subtitles from Bilibili AI assistant panel DOM.
     */
    private async extractSubtitlesViaAIPanel(debug?: DebugLogger): Promise<SubtitleItem[]> {
        debug?.('进入AI面板回退流程');
        return new Promise((resolve, reject) => {
            // Step 1: Find and click AI assistant button
            const aiAssistantContainer = document.querySelector('.video-ai-assistant') as HTMLElement;
            if (!aiAssistantContainer) {
                debug?.('AI按钮未找到');
                reject(new Error('无法找到AI小助手按钮'));
                return;
            }

            aiAssistantContainer.click();
            console.log('[BilibiliAdapter] Clicked AI assistant');
            debug?.('已点击AI小助手');

            // Step 2: Wait for panel to load, then click subtitle list button
            setTimeout(() => {
                const subtitleListButton = this.findSubtitleListButton();
                if (!subtitleListButton) {
                    this.closeAIPanel();
                    debug?.('字幕列表按钮未找到');
                    reject(new Error('无法找到"字幕列表"按钮，请确保AI小助手面板已正确加载'));
                    return;
                }

                console.log('[BilibiliAdapter] Found subtitle list button, clicking...');
                subtitleListButton.click();
                debug?.('已点击字幕列表按钮');

                // Step 3: Wait for subtitles to load, then extract
                setTimeout(() => {
                    try {
                        const subtitles = this.extractSubtitlesFromDOM();
                        this.closeAIPanel();
                        debug?.('DOM提取条数', String(subtitles.length));

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
