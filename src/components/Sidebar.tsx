import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Loader2, Camera, Star, AlertTriangle, Package, Subtitles, BookOpen, Download } from 'lucide-react';
import { useApp } from '../contexts';
import { useTranslation } from '../contexts/I18nContext';

// Mark types for video captures
export type MarkType = 'none' | 'important' | 'difficult';

// Recent sites stored in localStorage
interface RecentSite {
    url: string;
    title: string;
    favicon?: string;
    lastPosition?: number;
    duration?: number;
}

const RECENT_SITES_KEY = 'verboo_recent_sites';
const MAX_RECENT_SITES = 3;

// Get domain from URL for display
function getDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

// Get favicon URL from site URL
function getFaviconUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}/favicon.ico`;
    } catch {
        return '';
    }
}

// Get normalized video URL for comparison
function getNormalizedVideoUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
            const videoId = urlObj.searchParams.get('v');
            if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
        }
        if (urlObj.hostname.includes('bilibili.com') && urlObj.pathname.includes('/video/')) {
            const match = urlObj.pathname.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/);
            if (match) return `https://www.bilibili.com/video/${match[1]}`;
        }
        return url;
    } catch {
        return url;
    }
}

function isSameVideo(url1: string, url2: string): boolean {
    return getNormalizedVideoUrl(url1) === getNormalizedVideoUrl(url2);
}

function loadRecentSites(): RecentSite[] {
    try {
        const stored = localStorage.getItem(RECENT_SITES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveRecentSite(url: string, title: string, position?: number, duration?: number): RecentSite[] {
    if (!url || url.startsWith('about:') || url.includes('google.com')) {
        return loadRecentSites();
    }
    const sites = loadRecentSites();
    const existing = sites.find(s => isSameVideo(s.url, url));
    const filtered = sites.filter(s => !isSameVideo(s.url, url));
    const newSite: RecentSite = {
        url,
        title: title || getDomain(url),
        lastPosition: position ?? existing?.lastPosition,
        duration: duration ?? existing?.duration
    };
    const updated = [newSite, ...filtered].slice(0, MAX_RECENT_SITES);
    localStorage.setItem(RECENT_SITES_KEY, JSON.stringify(updated));
    return updated;
}

function updateSitePosition(url: string, position: number, duration?: number): void {
    if (!url || url.includes('google.com')) return;
    const sites = loadRecentSites();
    const index = sites.findIndex(s => isSameVideo(s.url, url));
    if (index >= 0) {
        sites[index].lastPosition = position;
        if (duration) sites[index].duration = duration;
        localStorage.setItem(RECENT_SITES_KEY, JSON.stringify(sites));
    }
}

function formatPosition(seconds: number): string {
    if (!seconds || seconds < 0) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// 简化后的 Props：只保留功能回调
interface SidebarProps {
    onOpenSubtitleDialog: () => void;
    onCaptureScreenshot: (markType?: MarkType) => void;
}

export function Sidebar({
    onOpenSubtitleDialog,
    onCaptureScreenshot,
}: SidebarProps) {
    const { t } = useTranslation();

    // 从统一的 AppContext 获取状态和方法
    const {
        // 导航状态
        inputUrl,
        isLoading,
        canGoBack,
        canGoForward,
        currentUrl,
        pageTitle,
        currentVideoTime,
        videoDuration,
        // 视图状态
        viewMode,
        isWelcomeVisible,
        // 方法
        setInputUrl,
        navigateToUrl,
        goBack,
        goForward,
        reload,
        switchView,
    } = useApp();

    const [recentSites, setRecentSites] = useState<RecentSite[]>([]);

    // Load recent sites on mount
    useEffect(() => {
        setRecentSites(loadRecentSites());
    }, []);

    // Save current site when URL changes
    useEffect(() => {
        if (!currentUrl || currentUrl.includes('google.com')) return;
        const timer = setTimeout(() => {
            const updated = saveRecentSite(currentUrl, pageTitle || '', currentVideoTime, videoDuration);
            setRecentSites(updated);
        }, 1000);
        return () => clearTimeout(timer);
    }, [currentUrl, pageTitle]);

    // Update video position periodically
    useEffect(() => {
        if (!currentUrl || !currentVideoTime || currentVideoTime < 1) return;
        const isVideoPage = currentUrl.includes('youtube.com/watch') || currentUrl.includes('bilibili.com/video');
        if (!isVideoPage) return;
        updateSitePosition(currentUrl, currentVideoTime, videoDuration);
        setRecentSites(loadRecentSites());
    }, [Math.floor((currentVideoTime || 0) / 5)]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (!isMod) return;
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    onCaptureScreenshot('none');
                    break;
                case 'i':
                    e.preventDefault();
                    onCaptureScreenshot('important');
                    break;
                case 'd':
                    e.preventDefault();
                    onCaptureScreenshot('difficult');
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCaptureScreenshot]);

    const isLearningActive = viewMode === 'learning';
    const isAssetActive = viewMode === 'asset';
    const isSubtitleActive = viewMode === 'subtitle';

    return (
        <div className="h-full flex flex-col pt-4 pb-2 font-sans bg-white">
            {/* Plugin List */}
            <div className="flex-1 px-2">
                {/* Header */}
                <div className="flex items-center mb-5 px-2">
                    <img src="/verboo.svg" alt="Verboo" className="h-[10px]" />
                </div>

                {/* Always visible - Learning & Library section */}
                <div className="flex flex-col gap-1">
                    {/* 英语学习入口 - 暂时隐藏
                    <div
                        onClick={() => switchView('learning')}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 ${
                            isLearningActive ? 'bg-[#f4f4f5]' : 'hover:bg-[#f4f4f5]'
                        }`}
                    >
                        <BookOpen size={14} className={isLearningActive ? 'text-[#18181b]' : 'text-gray-400'} />
                        <span className={`text-[13px] font-medium ${isLearningActive ? 'text-[#18181b]' : 'text-gray-500'}`}>{t('sidebar.learning')}</span>
                    </div>
                    */}

                    <div
                        onClick={() => switchView('asset')}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 ${
                            isAssetActive ? 'bg-[#f4f4f5]' : 'hover:bg-[#f4f4f5]'
                        }`}
                    >
                        <Package size={14} className={isAssetActive ? 'text-[#18181b]' : 'text-gray-400'} />
                        <span className={`text-[13px] font-medium ${isAssetActive ? 'text-[#18181b]' : 'text-gray-500'}`}>{t('sidebar.assets')}</span>
                    </div>

                    <div
                        onClick={() => switchView('subtitle')}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 ${
                            isSubtitleActive ? 'bg-[#f4f4f5]' : 'hover:bg-[#f4f4f5]'
                        }`}
                    >
                        <Subtitles size={14} className={isSubtitleActive ? 'text-[#18181b]' : 'text-gray-400'} />
                        <span className={`text-[13px] font-medium ${isSubtitleActive ? 'text-[#18181b]' : 'text-gray-500'}`}>{t('sidebar.subtitles')}</span>
                    </div>
                </div>

                {/* Video-related controls - 只在 browser 模式下显示，素材库/字幕库面板打开时隐藏 */}
                {!isWelcomeVisible && currentUrl && !currentUrl.startsWith('about:') && viewMode === 'browser' && (
                    <>
                        <div className="h-px bg-[#e4e4e7] mx-3 my-2" />

                        <div
                            onClick={onOpenSubtitleDialog}
                            className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                        >
                            <Download size={14} className="text-gray-500" />
                            <span className="text-[13px] font-medium text-[#18181b]">{t('sidebar.getSubtitles')}</span>
                        </div>

                        <div
                            onClick={() => onCaptureScreenshot('none')}
                            className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                        >
                            <div className="flex items-center gap-2">
                                <Camera size={14} className="text-gray-500" />
                                <span className="text-[13px] font-medium text-[#18181b]">{t('sidebar.screenshot')}</span>
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] font-mono">⌘S</span>
                        </div>

                        <div
                            onClick={() => onCaptureScreenshot('important')}
                            className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors duration-150"
                        >
                            <div className="flex items-center gap-2">
                                <Star size={14} className="text-amber-500" />
                                <span className="text-[13px] font-medium text-[#18181b]">{t('sidebar.important')}</span>
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] font-mono">⌘I</span>
                        </div>

                        <div
                            onClick={() => onCaptureScreenshot('difficult')}
                            className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 cursor-pointer transition-colors duration-150"
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-red-500" />
                                <span className="text-[13px] font-medium text-[#18181b]">{t('sidebar.difficult')}</span>
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] font-mono">⌘D</span>
                        </div>
                    </>
                )}
            </div>

            {/* Recent Sites */}
            {recentSites.some(site => site.lastPosition && site.lastPosition > 0) && (
                <div className="px-2 pb-2 overflow-hidden">
                    <div className="flex flex-col gap-1.5 w-full">
                        {recentSites.filter(site => site.lastPosition && site.lastPosition > 0).map((site, index) => (
                            <button
                                key={index}
                                onClick={() => navigateToUrl(site.url, site.lastPosition)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                                title={`${site.url}${site.lastPosition ? ` - ${t('sidebar.lastWatchedAt')} ${formatPosition(site.lastPosition)}` : ''}`}
                            >
                                <img
                                    src={getFaviconUrl(site.url) || '/icon.svg'}
                                    alt=""
                                    className="w-4 h-4 flex-shrink-0"
                                    onError={(e) => { e.currentTarget.src = '/icon.svg'; }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-gray-600 truncate">
                                        {site.title || getDomain(site.url)}
                                    </div>
                                    {site.lastPosition && site.lastPosition > 0 && (
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                            {t('sidebar.lastWatchedAt')} {formatPosition(site.lastPosition)}
                                            {site.duration ? ` / ${formatPosition(site.duration)}` : ''}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Toolbar */}
            <div className={`px-2 overflow-hidden transition-all duration-500 ease-out ${isWelcomeVisible ? 'opacity-0 max-h-0 py-0' : 'opacity-100 max-h-20 py-0'}`}>
                <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-full px-4 py-2 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={goBack}
                            disabled={!canGoBack}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoBack ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <button
                            onClick={goForward}
                            disabled={!canGoForward}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoForward ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                        >
                            <ArrowRight size={16} />
                        </button>
                        <button onClick={reload} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                        </button>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); navigateToUrl(inputUrl); }} className="flex-1 flex items-center border-l border-gray-200 pl-3 ml-1">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none font-medium"
                            placeholder={t('sidebar.enterUrl')}
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}
