import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Loader2, Camera, Star, AlertTriangle, Package, Subtitles } from 'lucide-react';

// Mark types for video captures
export type MarkType = 'none' | 'important' | 'difficult';

// Recent sites stored in localStorage
interface RecentSite {
    url: string;
    title: string;
    favicon?: string;
    lastPosition?: number; // Last watched position in seconds
    duration?: number; // Total video duration
}

const RECENT_SITES_KEY = 'verboo_recent_sites';
const MAX_RECENT_SITES = 2;

// Get domain from URL for display
function getDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

// Get favicon URL from site URL - directly from the website
function getFaviconUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        // 直接从网站获取 favicon
        return `${urlObj.origin}/favicon.ico`;
    } catch {
        return '';
    }
}

// Load recent sites from localStorage
function loadRecentSites(): RecentSite[] {
    try {
        const stored = localStorage.getItem(RECENT_SITES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save recent sites to localStorage (LRU)
function saveRecentSite(url: string, title: string, position?: number, duration?: number): RecentSite[] {
    // Skip empty, about: URLs, and Google (default homepage)
    if (!url || url.startsWith('about:') || url.includes('google.com')) {
        return loadRecentSites();
    }

    const sites = loadRecentSites();

    // Find existing entry to preserve/update position
    const existing = sites.find(s => s.url === url);
    const filtered = sites.filter(s => s.url !== url);

    // Add to front (most recent) with position data
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

// Update position for existing site without changing order
function updateSitePosition(url: string, position: number, duration?: number): void {
    if (!url || url.includes('google.com')) return;

    const sites = loadRecentSites();
    const index = sites.findIndex(s => s.url === url);

    if (index >= 0) {
        sites[index].lastPosition = position;
        if (duration) sites[index].duration = duration;
        localStorage.setItem(RECENT_SITES_KEY, JSON.stringify(sites));
    }
}

// Format seconds to MM:SS or HH:MM:SS
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

interface SidebarProps {
    onRunPlugin: (script: string) => void;
    onOpenSubtitleDialog: () => void;
    onCaptureScreenshot: (markType?: MarkType) => void;
    onOpenEnglishLearning: () => void;
    onOpenAssetPanel: () => void;
    onOpenSubtitleLibrary: () => void;
    // Navigation toolbar props
    inputUrl: string;
    onInputUrlChange: (url: string) => void;
    onNavigate: (e: React.FormEvent) => void;
    onNavigateToUrl: (url: string, seekTo?: number) => void;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    onGoBack: () => void;
    onGoForward: () => void;
    onReload: () => void;
    // For tracking recent sites
    currentUrl?: string;
    pageTitle?: string;
    currentVideoTime?: number;
    videoDuration?: number;
    // WelcomePage state
    showWelcome?: boolean;
}

export function Sidebar({
    onRunPlugin,
    onOpenSubtitleDialog,
    onCaptureScreenshot,
    onOpenEnglishLearning,
    onOpenAssetPanel,
    onOpenSubtitleLibrary,
    inputUrl,
    onInputUrlChange,
    onNavigate,
    onNavigateToUrl,
    isLoading,
    canGoBack,
    canGoForward,
    onGoBack,
    onGoForward,
    onReload,
    currentUrl,
    pageTitle,
    currentVideoTime,
    videoDuration,
    showWelcome = false
}: SidebarProps) {
    const [recentSites, setRecentSites] = useState<RecentSite[]>([]);

    // Load recent sites on mount
    useEffect(() => {
        setRecentSites(loadRecentSites());
    }, []);

    // Save current site when URL changes (with debounce to avoid saving during redirects)
    useEffect(() => {
        if (!currentUrl || currentUrl.includes('google.com')) return;

        const timer = setTimeout(() => {
            const updated = saveRecentSite(currentUrl, pageTitle || '', currentVideoTime, videoDuration);
            setRecentSites(updated);
        }, 1000);

        return () => clearTimeout(timer);
    }, [currentUrl, pageTitle]);

    // Update video position periodically (every 5 seconds for video pages)
    useEffect(() => {
        if (!currentUrl || !currentVideoTime || currentVideoTime < 1) return;

        // Only save position for video pages
        const isVideoPage = currentUrl.includes('youtube.com/watch') ||
                            currentUrl.includes('bilibili.com/video');
        if (!isVideoPage) return;

        updateSitePosition(currentUrl, currentVideoTime, videoDuration);
        // Update local state to reflect the change
        setRecentSites(loadRecentSites());
    }, [Math.floor((currentVideoTime || 0) / 5)]); // Update every 5 seconds

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Cmd/Ctrl key combinations
            const isMod = e.metaKey || e.ctrlKey;
            if (!isMod) return;

            switch (e.key.toLowerCase()) {
                case 's': // Cmd+S: Screenshot
                    e.preventDefault();
                    onCaptureScreenshot('none');
                    break;
                case 'i': // Cmd+I: Important mark
                    e.preventDefault();
                    onCaptureScreenshot('important');
                    break;
                case 'd': // Cmd+D: Difficult mark
                    e.preventDefault();
                    onCaptureScreenshot('difficult');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCaptureScreenshot]);

    return (
        <div className="h-full flex flex-col pt-4 pb-2 font-sans bg-white">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5 px-4">
                <div className="w-[18px] h-[18px] bg-[#18181b] rounded-[5px]"></div>
                <span className="font-semibold text-[13px] text-[#18181b] tracking-[-0.01em]">Plugins</span>
            </div>

            {/* Plugin List */}
            <div className="flex-1 px-2">
                <div
                    onClick={onOpenSubtitleDialog}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">获取字幕</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">自动获取或手动导入</span>
                </div>

                {/* Video Capture Section */}
                <div className="h-px bg-[#e4e4e7] mx-3 my-2" />

                <div
                    onClick={() => onCaptureScreenshot('none')}
                    className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <div className="flex items-center gap-2">
                        <Camera size={14} className="text-gray-500" />
                        <span className="text-[13px] font-medium text-[#18181b]">截图</span>
                    </div>
                    <span className="text-[10px] text-[#a1a1aa] font-mono">⌘S</span>
                </div>

                <div
                    onClick={() => onCaptureScreenshot('important')}
                    className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors duration-150"
                >
                    <div className="flex items-center gap-2">
                        <Star size={14} className="text-amber-500" />
                        <span className="text-[13px] font-medium text-[#18181b]">重点</span>
                    </div>
                    <span className="text-[10px] text-[#a1a1aa] font-mono">⌘I</span>
                </div>

                <div
                    onClick={() => onCaptureScreenshot('difficult')}
                    className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 cursor-pointer transition-colors duration-150"
                >
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-500" />
                        <span className="text-[13px] font-medium text-[#18181b]">难点</span>
                    </div>
                    <span className="text-[10px] text-[#a1a1aa] font-mono">⌘D</span>
                </div>

                <div className="h-px bg-[#e4e4e7] mx-3 my-2" />

                <div
                    onClick={onOpenEnglishLearning}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">英语学习</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">分析字幕中的重点难点词汇</span>
                </div>

                <div
                    onClick={onOpenAssetPanel}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <Package size={14} className="text-gray-500" />
                    <span className="text-[13px] font-medium text-[#18181b]">素材库</span>
                </div>

                <div
                    onClick={onOpenSubtitleLibrary}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <Subtitles size={14} className="text-gray-500" />
                    <span className="text-[13px] font-medium text-[#18181b]">字幕库</span>
                </div>
            </div>

            {/* Recent Sites */}
            {recentSites.length > 0 && (
                <div className="px-2 pb-2 overflow-hidden">
                    <div className="flex flex-col gap-1.5 w-full">
                        {recentSites.map((site, index) => (
                            <button
                                key={index}
                                onClick={() => onNavigateToUrl(site.url, site.lastPosition)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                                title={`${site.url}${site.lastPosition ? ` - 上次观看到 ${formatPosition(site.lastPosition)}` : ''}`}
                            >
                                <img
                                    src={getFaviconUrl(site.url) || '/icon.svg'}
                                    alt=""
                                    className="w-4 h-4 flex-shrink-0"
                                    onError={(e) => {
                                        e.currentTarget.src = '/icon.svg';
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-gray-600 truncate">
                                        {site.title || getDomain(site.url)}
                                    </div>
                                    {site.lastPosition && site.lastPosition > 0 && (
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                            上次 {formatPosition(site.lastPosition)}
                                            {site.duration ? ` / ${formatPosition(site.duration)}` : ''}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Toolbar - Fixed at bottom */}
            <div className={`px-2 overflow-hidden transition-all duration-500 ease-out ${showWelcome ? 'opacity-0 max-h-0 py-0' : 'opacity-100 max-h-20 py-0'}`}>
                <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-full px-4 py-2 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onGoBack}
                            disabled={!canGoBack}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoBack ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <button
                            onClick={onGoForward}
                            disabled={!canGoForward}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoForward ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                        >
                            <ArrowRight size={16} />
                        </button>
                        <button onClick={onReload} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <RotateCw size={16} />
                            )}
                        </button>
                    </div>

                    <form onSubmit={onNavigate} className="flex-1 flex items-center border-l border-gray-200 pl-3 ml-1">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => onInputUrlChange(e.target.value)}
                            className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none font-medium"
                            placeholder="Enter URL..."
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}
