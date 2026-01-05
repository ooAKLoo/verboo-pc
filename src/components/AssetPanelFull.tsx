import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Trash2, Download, ExternalLink, Play, Image as ImageIcon, ArrowLeft, X, ArrowDownUp, ChevronDown, Star, AlertTriangle, Globe, Video, Search, Clock, Type, AlignVerticalJustifyStart, Palette, Check, Edit3, ChevronLeft, ChevronRight, Copy, Layers, CreditCard, GalleryVertical, LayoutTemplate } from 'lucide-react';
import { AssetCard, type Asset, type AssetType, type ScreenshotTypeData, type ContentTypeData } from './AssetCard';
import type { SubtitleItem } from '../utils/subtitleParser';
import { useTranslation } from '../contexts/I18nContext';
import { ScreenshotRenderer, type DisplayMode, type SeparatorStyle } from '../utils/screenshot';

const { ipcRenderer } = window.require('electron');

type FilterType = 'all' | 'content' | 'screenshot';
type MarkFilter = 'all' | 'important' | 'difficult' | 'none';
type SortType = 'created' | 'timestamp';

// Sort options for assets
const SORT_OPTIONS = [
    { value: 'created', labelKey: 'assets.sortCreated', descKey: 'assets.sortCreatedDesc' },
    { value: 'timestamp', labelKey: 'assets.sortTimestamp', descKey: 'assets.sortTimestampDesc' },
];

// Mark filter options
const MARK_OPTIONS = [
    { value: 'all', labelKey: 'assets.markAll', icon: null },
    { value: 'important', labelKey: 'assets.markImportant', icon: Star, color: 'text-amber-500' },
    { value: 'difficult', labelKey: 'assets.markDifficult', icon: AlertTriangle, color: 'text-red-500' },
    { value: 'none', labelKey: 'assets.markNone', icon: null },
];


/**
 * FilterTrigger - 筛选触发按钮
 */
function FilterTrigger({
    icon,
    label,
    isActive,
    hasSelection,
    onClick
}: {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    hasSelection: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 flex-none
                ${isActive
                    ? 'bg-zinc-200/80 text-zinc-900'
                    : hasSelection
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                }
            `}
        >
            {icon}
            <span>{label}</span>
            <ChevronDown size={10} className={`opacity-50 ${isActive ? 'rotate-180' : ''} transition-transform`} />
        </button>
    );
}

/**
 * FilterPopover - 筛选弹出面板容器
 */
function FilterPopover({
    trigger,
    isOpen,
    onClose,
    children
}: {
    trigger: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    return (
        <div className="relative flex-none" ref={popoverRef}>
            {trigger}

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[180px] bg-white rounded-xl border border-zinc-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * SortSelector - 排序选择器
 */
function SortSelector({
    options,
    selected,
    onChange,
    t
}: {
    options: typeof SORT_OPTIONS;
    selected: string;
    onChange: (value: string) => void;
    t: (key: string) => string;
}) {
    return (
        <div className="p-2 min-w-[180px]">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">{t('assets.sortBy')}</div>
            <div className="space-y-0.5">
                {options.map(option => {
                    const isSelected = selected === option.value;
                    return (
                        <button
                            key={option.value}
                            onClick={() => onChange(option.value)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 hover:bg-zinc-50 text-zinc-700"
                        >
                            <div>
                                <div className="text-sm font-medium">{t(option.labelKey)}</div>
                                <div className="text-xs text-zinc-400">{t(option.descKey)}</div>
                            </div>
                            {isSelected && (
                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-none">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * MarkSelector - 标记筛选选择器
 */
function MarkSelector({
    selected,
    markStats,
    onChange,
    t
}: {
    selected: string;
    markStats: Record<string, number>;
    onChange: (value: string) => void;
    t: (key: string) => string;
}) {
    return (
        <div className="p-2 min-w-[180px]">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">{t('assets.filterMark')}</div>
            <div className="space-y-0.5">
                {MARK_OPTIONS.map(option => {
                    const isSelected = selected === option.value;
                    const count = option.value === 'all'
                        ? Object.values(markStats).reduce((a, b) => a + b, 0)
                        : markStats[option.value] || 0;
                    const IconComponent = option.icon;

                    return (
                        <button
                            key={option.value}
                            onClick={() => onChange(option.value)}
                            className={`
                                w-full flex items-center justify-between px-3 py-2 rounded-lg text-left
                                transition-all duration-150
                                ${isSelected
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'hover:bg-zinc-50 text-zinc-700'
                                }
                            `}
                        >
                            <div className="flex items-center gap-2">
                                {IconComponent && <IconComponent size={14} className={option.color} />}
                                <span className="text-sm font-medium">{t(option.labelKey)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">{count}</span>
                                {isSelected && (
                                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-none">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


/**
 * ScreenshotDetailView - 截图详情视图，包含内联字幕编辑
 */
function ScreenshotDetailView({
    asset,
    onBack,
    onClose,
    onDelete,
    onDownload,
    onUpdate,
    onPrev,
    onNext,
    hasPrev,
    hasNext,
    currentIndex,
    totalCount,
    t
}: {
    asset: Asset;
    onBack: () => void;
    onClose: () => void;
    onDelete: (id: number) => void;
    onDownload: (asset: Asset) => void;
    onUpdate: (asset: Asset) => void;
    onPrev?: () => void;
    onNext?: () => void;
    hasPrev?: boolean;
    hasNext?: boolean;
    currentIndex?: number;
    totalCount?: number;
    t: (key: string) => string;
}) {
    const screenshotData = asset.typeData as ScreenshotTypeData;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const subtitleListRef = useRef<HTMLDivElement>(null);

    // Subtitle state
    const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
    const [selectedSubtitles, setSelectedSubtitles] = useState<number[]>([]);
    const [subtitleStyle, setSubtitleStyle] = useState({
        position: screenshotData.subtitleStyle?.position || 'bottom',
        background: screenshotData.subtitleStyle?.background || 'semi-transparent',
        fontSize: screenshotData.subtitleStyle?.fontSize || 28,
        layout: screenshotData.subtitleStyle?.layout || 'vertical'
    });

    // UI state
    const [timeRange, setTimeRange] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [loadingSubtitles, setLoadingSubtitles] = useState(true);

    // 显示模式状态
    const [displayMode, setDisplayMode] = useState<DisplayMode>('overlay');
    const [stitchSeparator, setStitchSeparator] = useState<SeparatorStyle>('white');
    const [stitchSeparatorWidth, setStitchSeparatorWidth] = useState(1);
    const [stitchCropRatio, setStitchCropRatio] = useState(0.10); // 裁剪比例 0%-80%

    // 卡片模式选项（时间戳默认显示）
    const [cardShowTimestamp, setCardShowTimestamp] = useState(true);

    // 创建渲染器实例
    const rendererRef = useRef<ScreenshotRenderer | null>(null);

    // Track if initial load is complete to avoid auto-save on mount
    const isInitializedRef = useRef(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs to get latest values without causing re-renders
    const selectedSubtitlesRef = useRef(selectedSubtitles);
    const subtitleStyleRef = useRef(subtitleStyle);
    const isSavingRef = useRef(false);
    const lastSavedRef = useRef<string>('');
    selectedSubtitlesRef.current = selectedSubtitles;
    subtitleStyleRef.current = subtitleStyle;

    // Load subtitles from database - try subtitleId first, then by videoUrl
    useEffect(() => {
        const loadSubtitles = async () => {
            setLoadingSubtitles(true);
            try {
                // First try by subtitleId
                if (asset.subtitleId) {
                    const response = await ipcRenderer.invoke('get-subtitles-by-id', asset.subtitleId);
                    if (response.success && response.data?.subtitleData) {
                        setSubtitles(response.data.subtitleData);
                        setLoadingSubtitles(false);
                        return;
                    }
                }

                // Fallback: find subtitle record by video URL
                if (asset.url) {
                    const response = await ipcRenderer.invoke('get-subtitles-by-url', asset.url);
                    if (response.success && response.data?.subtitleData) {
                        setSubtitles(response.data.subtitleData);
                    }
                }
            } catch (error) {
                console.error('Error loading subtitles:', error);
            } finally {
                setLoadingSubtitles(false);
            }
        };
        loadSubtitles();
    }, [asset.subtitleId, asset.url]);

    // Initialize selected subtitles from existing data
    useEffect(() => {
        if (screenshotData.selectedSubtitles && subtitles.length > 0) {
            const selectedIndices: number[] = [];
            screenshotData.selectedSubtitles.forEach(savedSub => {
                const index = subtitles.findIndex(s =>
                    Math.abs(s.start - savedSub.start) < 0.5 && s.text === savedSub.text
                );
                if (index >= 0) selectedIndices.push(index);
            });
            setSelectedSubtitles(selectedIndices);
        }
    }, [screenshotData.selectedSubtitles, subtitles]);

    // Filter subtitles based on time range and search
    // When searching, search all subtitles; otherwise filter by time range
    const filteredSubtitles = useMemo(() => {
        if (subtitles.length === 0) return [];

        const currentTime = screenshotData.timestamp;
        let filtered = subtitles.map((sub, index) => ({ sub, index }));

        if (searchQuery.trim()) {
            // Search in all subtitles (ignore time range)
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(({ sub }) =>
                sub.text.toLowerCase().includes(query)
            );
        } else {
            // No search query: filter by time range
            filtered = filtered.filter(({ sub }) => {
                const subEnd = sub.start + (sub.duration || 0);
                return (
                    sub.start >= currentTime - timeRange &&
                    sub.start <= currentTime + timeRange
                ) || (
                    subEnd >= currentTime - timeRange &&
                    subEnd <= currentTime + timeRange
                );
            });
        }

        return filtered;
    }, [subtitles, screenshotData.timestamp, timeRange, searchQuery]);

    // Current subtitle index
    const currentSubtitleIndex = useMemo(() => {
        if (subtitles.length === 0) return -1;
        const currentTime = screenshotData.timestamp;
        return subtitles.findIndex(sub => {
            const end = sub.start + (sub.duration || 0);
            return currentTime >= sub.start && currentTime <= end;
        });
    }, [subtitles, screenshotData.timestamp]);

    // Render canvas with display mode using ScreenshotRenderer
    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 创建或更新渲染器
        const cardOptions = {
            showTimestamp: cardShowTimestamp,
            timestamp: screenshotData.timestamp
        };

        if (!rendererRef.current) {
            rendererRef.current = new ScreenshotRenderer({
                subtitleStyle,
                displayMode,
                stitchSeparator,
                stitchSeparatorWidth,
                stitchCropRatio,
                videoTitle: asset.title,
                cardOptions
            });
        } else {
            rendererRef.current.updateConfig({
                subtitleStyle,
                displayMode,
                stitchSeparator,
                stitchSeparatorWidth,
                stitchCropRatio,
                videoTitle: asset.title,
                cardOptions
            });
        }

        const img = new Image();
        img.onload = () => {
            const selectedSubs = selectedSubtitles.map(i => subtitles[i]).filter(Boolean);
            rendererRef.current?.render(canvas, ctx, img, selectedSubs);
        };
        img.src = screenshotData.imageData;
    }, [screenshotData.imageData, selectedSubtitles, subtitles, displayMode, subtitleStyle, stitchSeparator, stitchSeparatorWidth, stitchCropRatio, asset.title, cardShowTimestamp]);

    const toggleSubtitle = (index: number) => {
        setSelectedSubtitles(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index].sort((a, b) => a - b)
        );
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const doSave = useCallback(async () => {
        if (!canvasRef.current || isSavingRef.current) return;

        const currentSelectedSubtitles = selectedSubtitlesRef.current;
        const currentSubtitleStyle = subtitleStyleRef.current;

        // Create a signature of current state to detect if save is needed
        // Include display settings to ensure changes trigger saves
        const currentSignature = JSON.stringify({
            selected: currentSelectedSubtitles,
            style: currentSubtitleStyle,
            displayMode,
            stitchSeparator,
            stitchSeparatorWidth,
            stitchCropRatio,
            cardShowTimestamp
        });

        // Skip if nothing changed since last save
        if (currentSignature === lastSavedRef.current) {
            return;
        }

        isSavingRef.current = true;
        setIsSaving(true);

        try {
            const finalImageData = canvasRef.current.toDataURL('image/png');
            const newSubtitles = currentSelectedSubtitles.length > 0
                ? currentSelectedSubtitles.map(i => ({
                    start: subtitles[i].start,
                    end: subtitles[i].start + (subtitles[i].duration || 0),
                    text: subtitles[i].text
                }))
                : [];

            const response = await ipcRenderer.invoke('update-asset', {
                id: asset.id,
                typeData: {
                    ...screenshotData,
                    selectedSubtitles: newSubtitles,
                    subtitleStyle: currentSubtitleStyle,
                    finalImageData: finalImageData
                }
            });

            if (response.success) {
                lastSavedRef.current = currentSignature;
                setSaveMessage(t('assets.saved'));
                const updatedAsset = {
                    ...asset,
                    typeData: {
                        ...screenshotData,
                        selectedSubtitles: newSubtitles,
                        subtitleStyle: currentSubtitleStyle,
                        finalImageData: finalImageData
                    }
                };
                onUpdate(updatedAsset);
                setTimeout(() => setSaveMessage(null), 1500);
            } else {
                setSaveMessage(t('assets.saveFailed'));
                setTimeout(() => setSaveMessage(null), 2000);
            }
        } catch (error) {
            console.error('Error saving:', error);
            setSaveMessage(t('assets.saveFailed'));
            setTimeout(() => setSaveMessage(null), 2000);
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);
        }
    }, [asset.id, screenshotData, subtitles, onUpdate, t, displayMode, stitchSeparator, stitchSeparatorWidth, stitchCropRatio, cardShowTimestamp]);

    // Auto-save when selectedSubtitles, subtitleStyle, or display settings change
    useEffect(() => {
        // Skip auto-save on initial load
        if (!isInitializedRef.current) {
            return;
        }

        // Clear previous timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce save
        saveTimeoutRef.current = setTimeout(() => {
            doSave();
        }, 500);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [selectedSubtitles, subtitleStyle, displayMode, stitchSeparator, stitchSeparatorWidth, stitchCropRatio, cardShowTimestamp]);

    // Mark as initialized after subtitles are loaded and initial selection is set
    useEffect(() => {
        if (!loadingSubtitles && subtitles.length > 0) {
            // Small delay to ensure initial selectedSubtitles is set
            const timer = setTimeout(() => {
                isInitializedRef.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loadingSubtitles, subtitles.length]);

    const hasSubtitles = subtitles.length > 0;
    const showSidebar = loadingSubtitles || hasSubtitles;

    return (
        <div className="h-full flex bg-white rounded-2xl overflow-hidden">
            {/* Left Section - Header + Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-none px-5 py-3 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="p-1.5 -ml-1 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                        <ArrowLeft size={18} className="text-zinc-500" />
                    </button>

                    <div className="flex items-center gap-1">
                        {(isSaving || saveMessage) && (
                            <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                                isSaving ? 'text-zinc-500 bg-zinc-100' :
                                saveMessage === t('assets.saved') ? 'text-green-600 bg-green-50' :
                                saveMessage === t('assets.urlCopied') ? 'text-zinc-600 bg-[#f8f8f8]' : 'text-red-600 bg-red-50'
                            }`}>
                                {isSaving && <div className="w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />}
                                {isSaving ? t('assets.saving') : saveMessage}
                            </span>
                        )}
                        <button
                            onClick={() => {
                                // Download directly from canvas to ensure current display mode is captured
                                if (canvasRef.current) {
                                    const imageData = canvasRef.current.toDataURL('image/png');
                                    const link = document.createElement('a');
                                    link.href = imageData;
                                    link.download = `screenshot_${asset.id}_${new Date(asset.createdAt).getTime()}.png`;
                                    link.click();
                                } else {
                                    onDownload(asset);
                                }
                            }}
                            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                            title={t('assets.download')}
                        >
                            <Download size={16} className="text-zinc-500" />
                        </button>
                        <button
                            onClick={() => onDelete(asset.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('assets.deleteAsset')}
                        >
                            <Trash2 size={16} className="text-red-500" />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-auto px-5 pb-5">
                    {/* Title & Meta */}
                    <div className="mb-4">
                        <h1 className="text-lg font-semibold text-zinc-900 leading-snug mb-2">
                            {asset.title}
                        </h1>
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(asset.url);
                                        setSaveMessage(t('assets.urlCopied'));
                                        setTimeout(() => setSaveMessage(null), 1500);
                                    }}
                                    className="group flex items-center gap-1.5 hover:text-blue-500 transition-colors cursor-pointer"
                                    title={t('assets.clickToCopy')}
                                >
                                    {asset.favicon && (
                                        <img src={asset.favicon} alt="" className="w-4 h-4 rounded" />
                                    )}
                                    <span className="max-w-[300px] truncate">{asset.url}</span>
                                    <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                                {asset.author?.name && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                        <span>{asset.author.name}</span>
                                    </>
                                )}
                            </div>
                            <span className="font-mono flex items-center gap-1 flex-shrink-0">
                                <Play size={10} />
                                {formatTime(screenshotData.timestamp)}
                            </span>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div className="bg-zinc-900 rounded-xl overflow-hidden">
                        <canvas ref={canvasRef} className="w-full h-auto" />
                    </div>

                    {/* Style Settings - Below Image */}
                    {hasSubtitles && (
                        <div className="mt-4 p-3 bg-[#f8f8f8] rounded-xl space-y-3">
                            {/* Display Mode Selector - First Row */}
                            <div className="flex items-center gap-2">
                                <LayoutTemplate size={12} className="text-zinc-400" />
                                <span className="text-[11px] text-zinc-500">{t('assets.displayMode')}</span>
                                <div className="relative grid grid-cols-4 gap-0.5 p-1 bg-white rounded-lg">
                                    {[
                                        { value: 'overlay', icon: Layers, labelKey: 'assets.modeOverlay' },
                                        { value: 'separated', icon: AlignVerticalJustifyStart, labelKey: 'assets.modeSeparated' },
                                        { value: 'card', icon: CreditCard, labelKey: 'assets.modeCard' },
                                        { value: 'stitch', icon: GalleryVertical, labelKey: 'assets.modeStitch' }
                                    ].map((mode, index) => {
                                        const Icon = mode.icon;
                                        return (
                                            <button
                                                key={mode.value}
                                                onClick={() => setDisplayMode(mode.value as DisplayMode)}
                                                className={`relative z-10 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                                                    displayMode === mode.value
                                                        ? 'bg-zinc-100 text-zinc-900'
                                                        : 'text-zinc-500 hover:text-zinc-700'
                                                }`}
                                                title={t(mode.labelKey)}
                                            >
                                                <Icon size={12} />
                                                <span className="hidden sm:inline">{t(mode.labelKey)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>


                            {/* Stitch Settings - Only show when stitch mode is selected */}
                            {displayMode === 'stitch' && (
                                <div className="flex items-center gap-4 pl-5 flex-wrap">
                                    {/* 裁剪比例 */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-zinc-500">{t('assets.cropRatio')}</span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={0.8}
                                            step={0.05}
                                            value={stitchCropRatio}
                                            onChange={(e) => setStitchCropRatio(Number(e.target.value))}
                                            className="w-24 h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900"
                                        />
                                        <span className="text-[11px] font-mono text-zinc-400 w-8">{Math.round(stitchCropRatio * 100)}%</span>
                                    </div>
                                    {/* 分隔线 */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-zinc-500">{t('assets.separator')}</span>
                                        <div className="relative grid grid-cols-3 gap-0.5 p-1 bg-white rounded-lg">
                                            {[
                                                { value: 'white', labelKey: 'assets.separatorWhite' },
                                                { value: 'black', labelKey: 'assets.separatorBlack' },
                                                { value: 'none', labelKey: 'assets.separatorNone' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setStitchSeparator(opt.value as SeparatorStyle)}
                                                    className={`relative z-10 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-200 ${
                                                        stitchSeparator === opt.value
                                                            ? 'bg-zinc-100 text-zinc-900'
                                                            : 'text-zinc-500 hover:text-zinc-700'
                                                    }`}
                                                >
                                                    {t(opt.labelKey)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {stitchSeparator !== 'none' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-zinc-500">{t('assets.separatorWidth')}</span>
                                            <input
                                                type="range"
                                                min={0}
                                                max={12}
                                                step={1}
                                                value={stitchSeparatorWidth}
                                                onChange={(e) => setStitchSeparatorWidth(Number(e.target.value))}
                                                className="w-16 h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900"
                                            />
                                            <span className="text-[11px] font-mono text-zinc-400 w-6">{stitchSeparatorWidth}px</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Original Settings - Second Row */}
                            <div className="flex items-center gap-6 flex-wrap">
                                {/* Font Size */}
                                <div className="flex items-center gap-2">
                                    <Type size={12} className="text-zinc-400" />
                                    <span className="text-[11px] text-zinc-500">{t('assets.fontSize')}</span>
                                    <input
                                        type="range"
                                        min={16}
                                        max={48}
                                        step={2}
                                        value={subtitleStyle.fontSize}
                                        onChange={(e) => setSubtitleStyle({ ...subtitleStyle, fontSize: Number(e.target.value) })}
                                        className="w-20 h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900"
                                    />
                                    <span className="text-[11px] font-mono text-zinc-400 w-8">{subtitleStyle.fontSize}px</span>
                                </div>

                                {/* Position - Only show for overlay and stitch modes */}
                                {(displayMode === 'overlay' || displayMode === 'stitch') && (
                                    <div className="flex items-center gap-2">
                                        <AlignVerticalJustifyStart size={12} className="text-zinc-400" />
                                        <div className="relative grid grid-cols-2 gap-0.5 p-1 bg-white rounded-lg">
                                            {/* Sliding indicator */}
                                            <div
                                                className="absolute top-1 bottom-1 bg-zinc-100 rounded-md transition-all duration-200 ease-out pointer-events-none"
                                                style={{
                                                    width: 'calc(50% - 6px)',
                                                    left: subtitleStyle.position === 'top' ? '4px' : 'calc(50% + 2px)'
                                                }}
                                            />
                                            {['top', 'bottom'].map((pos) => (
                                                <button
                                                    key={pos}
                                                    onClick={() => setSubtitleStyle({ ...subtitleStyle, position: pos })}
                                                    className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-md transition-colors duration-200 text-center ${
                                                        subtitleStyle.position === pos
                                                            ? 'text-zinc-900'
                                                            : 'text-zinc-500 hover:text-zinc-700'
                                                    }`}
                                                >
                                                    {pos === 'top' ? t('assets.positionTop') : t('assets.positionBottom')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Background - Only show for overlay and stitch modes */}
                                {(displayMode === 'overlay' || displayMode === 'stitch') && (
                                    <div className="flex items-center gap-2">
                                        <Palette size={12} className="text-zinc-400" />
                                        <div className="relative grid grid-cols-3 gap-0.5 p-1 bg-white rounded-lg">
                                            {/* Sliding indicator */}
                                            <div
                                                className="absolute top-1 bottom-1 bg-zinc-100 rounded-md transition-all duration-200 ease-out pointer-events-none"
                                                style={{
                                                    width: 'calc(33.333% - 4px)',
                                                    left: subtitleStyle.background === 'semi-transparent' ? '4px'
                                                        : subtitleStyle.background === 'solid' ? 'calc(33.333% + 2px)'
                                                        : 'calc(66.666%)'
                                                }}
                                            />
                                            {[
                                                { value: 'semi-transparent', labelKey: 'assets.bgSemiTransparent' },
                                                { value: 'solid', labelKey: 'assets.bgSolid' },
                                                { value: 'none', labelKey: 'assets.bgNone' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setSubtitleStyle({ ...subtitleStyle, background: opt.value })}
                                                    className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-md transition-colors duration-200 text-center ${
                                                        subtitleStyle.background === opt.value
                                                            ? 'text-zinc-900'
                                                            : 'text-zinc-500 hover:text-zinc-700'
                                                    }`}
                                                >
                                                    {t(opt.labelKey)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Navigation Buttons - Fixed at Bottom */}
                {(onPrev || onNext) && (
                    <div className="flex-none px-5 py-3 flex items-center justify-between">
                        <button
                            onClick={onPrev}
                            disabled={!hasPrev}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                hasPrev
                                    ? 'text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200'
                                    : 'text-zinc-300 cursor-not-allowed'
                            }`}
                        >
                            <ChevronLeft size={16} />
                            <span>{t('assets.prevAsset')}</span>
                        </button>

                        {/* Current position indicator */}
                        {currentIndex !== undefined && totalCount !== undefined && (
                            <span className="text-xs text-zinc-400 font-mono">
                                {currentIndex + 1} / {totalCount}
                            </span>
                        )}

                        <button
                            onClick={onNext}
                            disabled={!hasNext}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                hasNext
                                    ? 'text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200'
                                    : 'text-zinc-300 cursor-not-allowed'
                            }`}
                        >
                            <span>{t('assets.nextAsset')}</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Right Section - Subtitle Selection */}
            {loadingSubtitles ? (
                    <div className="w-72 flex-shrink-0 m-3 ml-0 bg-[#f8f8f8] rounded-2xl flex items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full mx-auto mb-2" />
                            <span className="text-[12px] text-zinc-400">{t('assets.loadingSubtitles')}</span>
                        </div>
                    </div>
                ) : hasSubtitles && (
                    <div className="w-72 flex-shrink-0 m-3 ml-0 bg-[#f8f8f8] rounded-2xl flex flex-col overflow-hidden">
                        {/* Sidebar Header */}
                        <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-medium text-zinc-700">{t('assets.subtitleSelect')}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const indices = filteredSubtitles.map(({ index }) => index);
                                        setSelectedSubtitles(prev => {
                                            const newSet = new Set([...prev, ...indices]);
                                            return Array.from(newSet).sort((a, b) => a - b);
                                        });
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                >
                                    {t('assets.selectAll')}
                                </button>
                                <button
                                    onClick={() => setSelectedSubtitles([])}
                                    className="px-2 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-zinc-100 rounded transition-colors"
                                >
                                    {t('assets.clear')}
                                </button>
                            </div>
                        </div>
                        {/* Search */}
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('assets.searchSubtitle')}
                                className="w-full h-7 pl-7 pr-2 text-[11px] bg-zinc-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 placeholder:text-zinc-400"
                            />
                        </div>
                        {/* Time Range Filter */}
                        <div className="flex items-center gap-2 mt-2">
                            <Clock size={11} className="text-zinc-400" />
                            <input
                                type="range"
                                min={5}
                                max={60}
                                step={5}
                                value={timeRange}
                                onChange={(e) => setTimeRange(Number(e.target.value))}
                                className="flex-1 h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900"
                            />
                            <span className="text-[10px] text-zinc-500 font-mono w-6">±{timeRange}s</span>
                        </div>
                    </div>

                    {/* Subtitle List */}
                    <div ref={subtitleListRef} className="flex-1 overflow-auto px-2 pb-2 space-y-1.5">
                        {filteredSubtitles.length === 0 ? (
                            <div className="text-center py-8 text-[12px] text-zinc-400">
                                {searchQuery ? t('assets.noMatchingSubtitle') : t('assets.noSubtitle')}
                            </div>
                        ) : (
                            filteredSubtitles.map(({ sub, index }) => {
                                const isCurrent = index === currentSubtitleIndex;
                                const isSelected = selectedSubtitles.includes(index);
                                return (
                                    <div
                                        key={index}
                                        data-index={index}
                                        onClick={() => toggleSubtitle(index)}
                                        className={`p-2 rounded-lg cursor-pointer transition-all ${
                                            isCurrent
                                                ? 'bg-blue-50'
                                                : isSelected
                                                ? 'bg-green-50'
                                                : 'bg-white hover:bg-zinc-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-3 h-3 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                isSelected ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300'
                                            }`}>
                                                {isSelected && <Check size={7} className="text-white" />}
                                            </div>
                                            <span className="text-[10px] font-mono text-zinc-400">{formatTime(sub.start)}</span>
                                            {isCurrent && (
                                                <span className="px-1 py-0.5 bg-blue-500 text-white text-[8px] font-semibold rounded uppercase">
                                                    {t('assets.current')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-zinc-600 leading-relaxed line-clamp-2">
                                            {sub.text}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


interface AssetPanelFullProps {
    onClose: () => void;
    refreshTrigger?: number;
    onEditScreenshot?: (asset: Asset) => void;
}

export function AssetPanelFull({ onClose, refreshTrigger = 0, onEditScreenshot }: AssetPanelFullProps) {
    const { t } = useTranslation();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

    // 多选状态
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Advanced filter states
    const [markFilter, setMarkFilter] = useState<MarkFilter>('all');
    const [sortBy, setSortBy] = useState<SortType>('created');
    const [selectedSource, setSelectedSource] = useState<string | null>(null); // 选中的视频URL
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null); // 选中的平台
    const [activePopover, setActivePopover] = useState<string | null>(null);

    // 多选相关方法
    const hasSelection = selectedIds.size > 0;
    const selectedItems = useMemo(() =>
        assets.filter(asset => selectedIds.has(asset.id)),
        [assets, selectedIds]
    );

    const toggleSelection = useCallback((id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    useEffect(() => {
        loadAssets();
    }, [refreshTrigger, filter]);

    // Calculate mark stats from assets
    const markStats = useMemo(() => {
        const stats: Record<string, number> = { important: 0, difficult: 0, none: 0 };
        assets.forEach(asset => {
            if (asset.type === 'screenshot') {
                const typeData = asset.typeData as ScreenshotTypeData;
                const mark = typeData.markType;
                if (mark === 'important') stats.important++;
                else if (mark === 'difficult') stats.difficult++;
                else stats.none++;
            } else {
                stats.none++;
            }
        });
        return stats;
    }, [assets]);

    // Get unique sources (videos) from assets
    const sourceOptions = useMemo(() => {
        const sources = new Map<string, { title: string; platform?: string; count: number }>();
        assets.forEach(asset => {
            const url = asset.url || 'unknown';
            if (!sources.has(url)) {
                sources.set(url, {
                    title: asset.title || '未知来源',
                    platform: asset.platform,
                    count: 0
                });
            }
            sources.get(url)!.count++;
        });
        return Array.from(sources.entries())
            .map(([url, data]) => ({ url, ...data }))
            .sort((a, b) => b.count - a.count);
    }, [assets]);

    // Get unique platforms from assets
    const platformOptions = useMemo(() => {
        const platforms = new Map<string, { title: string; count: number }>();
        assets.forEach(asset => {
            const platform = asset.platform || 'unknown';
            const title = platform === 'youtube' ? 'YouTube' :
                platform === 'bilibili' ? 'Bilibili' :
                    platform || '其他';
            if (!platforms.has(platform)) {
                platforms.set(platform, { title, count: 0 });
            }
            platforms.get(platform)!.count++;
        });
        return Array.from(platforms.entries())
            .map(([key, data]) => ({ key, ...data }))
            .sort((a, b) => b.count - a.count);
    }, [assets]);

    // Filter and sort assets
    const filteredAssets = useMemo(() => {
        let result = [...assets];

        // Apply source filter (video)
        if (selectedSource) {
            result = result.filter(asset => asset.url === selectedSource);
        }

        // Apply platform filter
        if (selectedPlatform) {
            result = result.filter(asset => (asset.platform || 'unknown') === selectedPlatform);
        }

        // Apply mark filter (only for screenshots)
        if (markFilter !== 'all') {
            result = result.filter(asset => {
                if (asset.type !== 'screenshot') {
                    return markFilter === 'none';
                }
                const typeData = asset.typeData as ScreenshotTypeData;
                const mark = typeData.markType;
                if (markFilter === 'none') return !mark;
                return mark === markFilter;
            });
        }

        // Apply sort
        result.sort((a, b) => {
            if (sortBy === 'created') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                // Sort by timestamp (only applies to screenshots)
                const aTime = a.type === 'screenshot' ? (a.typeData as ScreenshotTypeData).timestamp : 0;
                const bTime = b.type === 'screenshot' ? (b.typeData as ScreenshotTypeData).timestamp : 0;
                return bTime - aTime;
            }
        });

        return result;
    }, [assets, selectedSource, selectedPlatform, markFilter, sortBy]);

    // selectAll 需要在 filteredAssets 之后定义
    const selectAll = useCallback(() => {
        setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }, [filteredAssets]);

    // 批量删除 - 直接执行
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        try {
            for (const id of selectedIds) {
                await ipcRenderer.invoke('delete-asset', id);
            }
            setAssets(prev => prev.filter(a => !selectedIds.has(a.id)));
            clearSelection();
        } catch (error) {
            console.error('Error batch deleting assets:', error);
        }
    };

    // 批量下载 - 直接下载到 Downloads 文件夹
    const handleBatchDownload = () => {
        if (selectedIds.size === 0) return;

        selectedItems.forEach(asset => {
            if (asset.type === 'screenshot') {
                const typeData = asset.typeData as ScreenshotTypeData;
                const imageData = typeData.finalImageData || typeData.imageData;
                const link = document.createElement('a');
                link.href = imageData;
                link.download = `screenshot_${asset.id}_${new Date(asset.createdAt).getTime()}.png`;
                link.click();
            }
        });
        clearSelection();
    };

    // 获取可下载的截图数量
    const downloadableCount = useMemo(() =>
        selectedItems.filter(a => a.type === 'screenshot').length,
        [selectedItems]
    );

    const loadAssets = async () => {
        setLoading(true);
        try {
            const options: { type?: AssetType; limit: number; offset: number } = {
                limit: 100,
                offset: 0
            };

            if (filter !== 'all') {
                options.type = filter;
            }

            const response = await ipcRenderer.invoke('get-assets', options);
            if (response.success) {
                setAssets(response.data);
            } else {
                console.error('Failed to load assets:', response.error);
            }
        } catch (error) {
            console.error('Error loading assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            const response = await ipcRenderer.invoke('delete-asset', id);
            if (response.success) {
                setAssets(assets.filter(a => a.id !== id));
                if (selectedAsset?.id === id) {
                    setSelectedAsset(null);
                }
            }
        } catch (error) {
            console.error('Error deleting asset:', error);
        }
    };

    const handleDownload = (asset: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        if (asset.type !== 'screenshot') return;

        const typeData = asset.typeData as ScreenshotTypeData;
        const imageData = typeData.finalImageData || typeData.imageData;
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `screenshot_${asset.id}_${new Date(asset.createdAt).getTime()}.png`;
        link.click();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFullDate = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Render detail view for selected asset
    const renderDetailView = () => {
        if (!selectedAsset) return null;

        const isScreenshot = selectedAsset.type === 'screenshot';
        const typeData = selectedAsset.typeData;
        const screenshotData = isScreenshot ? typeData as ScreenshotTypeData : null;
        const contentData = !isScreenshot ? typeData as ContentTypeData : null;

        // Handle direct edit on image click
        const handleImageClick = () => {
            if (isScreenshot && onEditScreenshot) {
                onEditScreenshot(selectedAsset);
            }
        };

        return (
            <div className="h-full flex flex-col bg-white rounded-2xl overflow-hidden">
                {/* Minimal Header */}
                <div className="flex-none px-5 py-3 flex items-center justify-between">
                    <button
                        onClick={() => setSelectedAsset(null)}
                        className="p-1.5 -ml-1 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                        <ArrowLeft size={18} className="text-zinc-500" />
                    </button>

                    <div className="flex items-center gap-1">
                        {isScreenshot && (
                            <button
                                onClick={(e) => handleDownload(selectedAsset, e)}
                                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                                title={t('assets.download')}
                            >
                                <Download size={16} className="text-zinc-500" />
                            </button>
                        )}
                        <button
                            onClick={(e) => handleDelete(selectedAsset.id, e)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('assets.deleteAsset')}
                        >
                            <Trash2 size={16} className="text-red-500" />
                        </button>
                    </div>
                </div>

                {/* Main Content - Scrollable */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-3xl mx-auto px-5 pb-5">

                        {/* Title & Meta Row */}
                        <div className="mb-4">
                            <h1 className="text-lg font-semibold text-zinc-900 leading-snug mb-1">
                                {selectedAsset.title}
                            </h1>
                            <div className="flex items-center gap-3 text-xs text-zinc-400">
                                <span>{formatFullDate(selectedAsset.createdAt)}</span>
                                {isScreenshot && screenshotData && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                        <span className="font-mono flex items-center gap-1">
                                            <Play size={10} />
                                            {formatTime(screenshotData.timestamp)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Primary Image - Clickable for Edit */}
                        {isScreenshot && screenshotData && (
                            <div
                                className={`relative group mb-5 rounded-xl overflow-hidden bg-zinc-900 ${onEditScreenshot ? 'cursor-pointer' : ''}`}
                                onClick={handleImageClick}
                            >
                                <img
                                    src={screenshotData.finalImageData || screenshotData.imageData}
                                    alt="Screenshot"
                                    className="w-full h-auto"
                                />
                                {/* Edit Overlay on Hover */}
                                {onEditScreenshot && (
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-zinc-900">
                                            <Edit3 size={16} />
                                            {t('assets.clickToEdit')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Content Images */}
                        {!isScreenshot && contentData && contentData.images.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                {contentData.images.map((img, index) => (
                                    <img
                                        key={index}
                                        src={img}
                                        alt={`Image ${index + 1}`}
                                        className="w-full h-auto rounded-xl object-cover aspect-video"
                                    />
                                ))}
                            </div>
                        )}

                        {/* Subtitle Section - 参照 subtitle-display.html 设计 */}
                        {isScreenshot && screenshotData?.selectedSubtitles && screenshotData.selectedSubtitles.length > 0 && (
                            <div
                                className={`mb-5 py-6 px-8 bg-zinc-50 rounded-xl ${onEditScreenshot ? 'cursor-pointer hover:bg-blue-50/30 transition-colors group' : ''}`}
                                onClick={handleImageClick}
                            >
                                {/* 字幕块：左侧装饰条 + 文本 */}
                                <div className="flex gap-5">
                                    {/* 左侧装饰条 */}
                                    <div className="w-[3px] bg-zinc-200 rounded-full flex-shrink-0" />
                                    {/* 字幕文本区 */}
                                    <div className="flex-1 space-y-0">
                                        {screenshotData.selectedSubtitles.map((sub, index) => (
                                            <p key={index} className="text-[17px] text-zinc-600 leading-[2] font-normal">
                                                {sub.text}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                                {/* 编辑提示 */}
                                {onEditScreenshot && (
                                    <div className="mt-4 flex justify-end">
                                        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <Edit3 size={12} />
                                            {t('assets.clickToEdit')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Content Text */}
                        {!isScreenshot && contentData?.content && (
                            <div className="mb-5 p-4 bg-zinc-50 rounded-xl">
                                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">{t('assets.labelContent')}</div>
                                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                                    {contentData.content}
                                </p>
                            </div>
                        )}

                        {/* Tags */}
                        {!isScreenshot && contentData && contentData.tags.length > 0 && (
                            <div className="mb-5">
                                <div className="flex flex-wrap gap-2">
                                    {contentData.tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="px-2.5 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-full"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer Meta */}
                        <div className="flex items-center justify-between py-4 mt-2 bg-zinc-50 rounded-xl px-4">
                            {/* Source */}
                            <div className="flex items-center gap-2">
                                {selectedAsset.favicon && (
                                    <img
                                        src={selectedAsset.favicon}
                                        alt={selectedAsset.platform || 'platform'}
                                        className="w-4 h-4 rounded"
                                    />
                                )}
                                {selectedAsset.author?.avatar && (
                                    <img
                                        src={selectedAsset.author.avatar}
                                        alt={selectedAsset.author.name}
                                        className="w-5 h-5 rounded-full object-cover"
                                    />
                                )}
                                {selectedAsset.author?.name && (
                                    <span className="text-xs text-zinc-600">{selectedAsset.author.name}</span>
                                )}
                            </div>

                            {/* Link */}
                            <a
                                href={selectedAsset.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-500 transition-colors"
                            >
                                <ExternalLink size={12} />
                                <span className="max-w-[200px] truncate">{selectedAsset.url}</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Handle asset update from detail view
    const handleAssetUpdate = (updatedAsset: Asset) => {
        setAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a));
        setSelectedAsset(updatedAsset);
    };

    // Handle delete from detail view
    const handleDeleteFromDetail = async (id: number) => {
        try {
            // Find current index before deleting
            const currentIndex = filteredAssets.findIndex(a => a.id === id);

            const response = await ipcRenderer.invoke('delete-asset', id);
            if (response.success) {
                const newAssets = assets.filter(a => a.id !== id);
                setAssets(newAssets);

                // Calculate new filtered assets after deletion
                const newFilteredAssets = filteredAssets.filter(a => a.id !== id);

                if (newFilteredAssets.length === 0) {
                    // No more assets, close detail view
                    setSelectedAsset(null);
                } else if (currentIndex < newFilteredAssets.length) {
                    // Switch to next asset (same index position)
                    setSelectedAsset(newFilteredAssets[currentIndex]);
                } else {
                    // Was last item, switch to previous (now last)
                    setSelectedAsset(newFilteredAssets[newFilteredAssets.length - 1]);
                }
            }
        } catch (error) {
            console.error('Error deleting asset:', error);
        }
    };

    // Handle download from detail view
    const handleDownloadFromDetail = (asset: Asset) => {
        if (asset.type !== 'screenshot') return;
        const typeData = asset.typeData as ScreenshotTypeData;
        const imageData = typeData.finalImageData || typeData.imageData;
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `screenshot_${asset.id}_${new Date(asset.createdAt).getTime()}.png`;
        link.click();
    };

    // Navigation logic for switching between assets
    const currentAssetIndex = useMemo(() => {
        if (!selectedAsset) return -1;
        return filteredAssets.findIndex(a => a.id === selectedAsset.id);
    }, [selectedAsset, filteredAssets]);

    const handlePrevAsset = useCallback(() => {
        if (currentAssetIndex > 0) {
            setSelectedAsset(filteredAssets[currentAssetIndex - 1]);
        }
    }, [currentAssetIndex, filteredAssets]);

    const handleNextAsset = useCallback(() => {
        if (currentAssetIndex < filteredAssets.length - 1) {
            setSelectedAsset(filteredAssets[currentAssetIndex + 1]);
        }
    }, [currentAssetIndex, filteredAssets]);

    // If screenshot is selected, show inline editor
    if (selectedAsset && selectedAsset.type === 'screenshot') {
        return (
            <div className="h-full bg-white rounded-xl overflow-hidden">
                <ScreenshotDetailView
                    key={selectedAsset.id}
                    asset={selectedAsset}
                    onBack={() => setSelectedAsset(null)}
                    onClose={onClose}
                    onDelete={handleDeleteFromDetail}
                    onDownload={handleDownloadFromDetail}
                    onUpdate={handleAssetUpdate}
                    onPrev={handlePrevAsset}
                    onNext={handleNextAsset}
                    hasPrev={currentAssetIndex > 0}
                    hasNext={currentAssetIndex < filteredAssets.length - 1}
                    currentIndex={currentAssetIndex}
                    totalCount={filteredAssets.length}
                    t={t}
                />
            </div>
        );
    }

    // If content asset is selected, show detail view
    if (selectedAsset) {
        return (
            <div className="h-full bg-white rounded-xl">
                {renderDetailView()}
            </div>
        );
    }

    return (
        <div className="h-full bg-white rounded-2xl flex flex-col relative">

            {/* Header with close button */}
            <div className="flex-none px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700">{t('assets.title')}</span>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                    <X size={18} className="text-zinc-400" />
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex-none px-5 pb-3 flex items-center gap-3">
                {/* Sort Trigger */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<ArrowDownUp size={13} />}
                            label={t(SORT_OPTIONS.find(o => o.value === sortBy)?.labelKey || 'assets.sortBy')}
                            isActive={activePopover === 'sort'}
                            hasSelection={false}
                            onClick={() => setActivePopover(activePopover === 'sort' ? null : 'sort')}
                        />
                    }
                    isOpen={activePopover === 'sort'}
                    onClose={() => setActivePopover(null)}
                >
                    <SortSelector
                        options={SORT_OPTIONS}
                        selected={sortBy}
                        onChange={(value) => {
                            setSortBy(value as SortType);
                            setActivePopover(null);
                        }}
                        t={t}
                    />
                </FilterPopover>

                {/* Mark Filter Trigger (only show when screenshot filter is active or all) */}
                {(filter === 'all' || filter === 'screenshot') && (
                    <FilterPopover
                        trigger={
                            <FilterTrigger
                                icon={markFilter === 'important' ? <Star size={13} className="text-amber-500" /> :
                                    markFilter === 'difficult' ? <AlertTriangle size={13} className="text-red-500" /> :
                                        <Star size={13} />}
                                label={markFilter === 'all' ? t('assets.filterMark') : t(MARK_OPTIONS.find(o => o.value === markFilter)?.labelKey || 'assets.filterMark')}
                                isActive={activePopover === 'mark'}
                                hasSelection={markFilter !== 'all'}
                                onClick={() => setActivePopover(activePopover === 'mark' ? null : 'mark')}
                            />
                        }
                        isOpen={activePopover === 'mark'}
                        onClose={() => setActivePopover(null)}
                    >
                        <MarkSelector
                            selected={markFilter}
                            markStats={markStats}
                            onChange={(value) => {
                                setMarkFilter(value as MarkFilter);
                                setActivePopover(null);
                            }}
                            t={t}
                        />
                    </FilterPopover>
                )}

                {/* Divider */}
                <div className="w-px h-5 bg-zinc-100 mx-1 flex-none" />

                {/* Video Filter */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<Video size={13} />}
                            label={selectedSource ? (sourceOptions.find(s => s.url === selectedSource)?.title.slice(0, 10) + (sourceOptions.find(s => s.url === selectedSource)?.title.length! > 10 ? '...' : '') || t('assets.video')) : t('assets.video')}
                            isActive={activePopover === 'source'}
                            hasSelection={!!selectedSource}
                            onClick={() => setActivePopover(activePopover === 'source' ? null : 'source')}
                        />
                    }
                    isOpen={activePopover === 'source'}
                    onClose={() => setActivePopover(null)}
                >
                    <div className="p-2 min-w-[240px] max-h-[300px] overflow-auto">
                        <div className="text-xs font-medium text-zinc-500 px-2 mb-2">{t('assets.selectVideo')}</div>
                        <div className="space-y-0.5">
                            {/* All option */}
                            <button
                                onClick={() => {
                                    setSelectedSource(null);
                                    setActivePopover(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 ${!selectedSource ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'
                                    }`}
                            >
                                <span className="text-sm font-medium">{t('assets.allVideos')}</span>
                                <span className="text-xs text-zinc-400">{assets.length}</span>
                            </button>
                            {/* Video options */}
                            {sourceOptions.map(source => (
                                <button
                                    key={source.url}
                                    onClick={() => {
                                        setSelectedSource(source.url);
                                        setActivePopover(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 ${selectedSource === source.url ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0 mr-2">
                                        <div className="text-sm font-medium truncate">{source.title}</div>
                                        {source.platform && (
                                            <div className="text-xs text-zinc-400">
                                                {source.platform === 'youtube' ? 'YouTube' :
                                                    source.platform === 'bilibili' ? 'Bilibili' : source.platform}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-zinc-400 flex-shrink-0">{source.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </FilterPopover>

                {/* Platform Filter */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<Globe size={13} />}
                            label={selectedPlatform ? (platformOptions.find(p => p.key === selectedPlatform)?.title || t('assets.platform')) : t('assets.platform')}
                            isActive={activePopover === 'platform'}
                            hasSelection={!!selectedPlatform}
                            onClick={() => setActivePopover(activePopover === 'platform' ? null : 'platform')}
                        />
                    }
                    isOpen={activePopover === 'platform'}
                    onClose={() => setActivePopover(null)}
                >
                    <div className="p-2 min-w-[180px]">
                        <div className="text-xs font-medium text-zinc-500 px-2 mb-2">{t('assets.selectPlatform')}</div>
                        <div className="space-y-0.5">
                            {/* All option */}
                            <button
                                onClick={() => {
                                    setSelectedPlatform(null);
                                    setActivePopover(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 ${!selectedPlatform ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'
                                    }`}
                            >
                                <span className="text-sm font-medium">{t('assets.allPlatforms')}</span>
                                <span className="text-xs text-zinc-400">{assets.length}</span>
                            </button>
                            {/* Platform options */}
                            {platformOptions.map(platform => (
                                <button
                                    key={platform.key}
                                    onClick={() => {
                                        setSelectedPlatform(platform.key);
                                        setActivePopover(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 ${selectedPlatform === platform.key ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'
                                        }`}
                                >
                                    <span className="text-sm font-medium">{platform.title}</span>
                                    <span className="text-xs text-zinc-400">{platform.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </FilterPopover>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Count */}
                <span className="text-[12px] text-zinc-400 flex-none">
                    {t('assets.assetsCount').replace('{count}', String(filteredAssets.length))}
                </span>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                </div>
            ) : assets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                    <ImageIcon size={48} strokeWidth={1.5} />
                    <div className="text-center">
                        <p className="text-[15px] font-medium text-gray-500">{t('assets.empty')}</p>
                        <p className="text-[13px] mt-1">
                            {filter === 'screenshot' && t('assets.useShortcut')}
                            {filter === 'content' && t('assets.emptyContentHint')}
                            {filter === 'all' && t('assets.emptyAllHint')}
                        </p>
                    </div>
                </div>
            ) : filteredAssets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                    <Star size={48} strokeWidth={1.5} />
                    <div className="text-center">
                        <p className="text-[15px] font-medium text-gray-500">{t('assets.noMatchingAssets')}</p>
                        <p className="text-[13px] mt-1">{t('assets.adjustFilters')}</p>
                    </div>
                </div>
            ) : (
                /* Flat View */
                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAssets.map((asset) => (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                onClick={() => setSelectedAsset(asset)}
                                onDelete={(e) => handleDelete(asset.id, e)}
                                onDownload={asset.type === 'screenshot' ? (e) => handleDownload(asset, e) : undefined}
                                isSelected={selectedIds.has(asset.id)}
                                onToggleSelect={() => toggleSelection(asset.id)}
                                hasSelection={hasSelection}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* FloatingActionBar - 底部灵动岛 */}
            {hasSelection && (
                <FloatingActionBar
                    selectedCount={selectedIds.size}
                    totalCount={filteredAssets.length}
                    downloadableCount={downloadableCount}
                    onClearSelection={clearSelection}
                    onSelectAll={selectAll}
                    onBatchDownload={handleBatchDownload}
                    onBatchDelete={handleBatchDelete}
                    t={t}
                />
            )}
        </div>
    );
}

/**
 * FloatingActionBar - 底部灵动岛
 * 参照 Ohoo 项目的设计，深色玻璃质感
 */
function FloatingActionBar({
    selectedCount,
    totalCount,
    downloadableCount,
    onClearSelection,
    onSelectAll,
    onBatchDownload,
    onBatchDelete,
    t,
}: {
    selectedCount: number;
    totalCount: number;
    downloadableCount: number;
    onClearSelection: () => void;
    onSelectAll: () => void;
    onBatchDownload: () => void;
    onBatchDelete: () => void;
    t: (key: string) => string;
}) {
    const isAllSelected = totalCount > 0 && selectedCount === totalCount;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
            {/* 深色玻璃质感容器 - 灵动岛风格 */}
            <div className="flex items-center gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-white/10 text-zinc-200 ring-1 ring-black">

                {/* 1. 左侧计数与全选控制区 */}
                <div className="relative flex items-center space-x-2 px-3 py-1.5 bg-white/10 rounded-xl mr-1">
                    {/* 数量显示 */}
                    <span className="text-xs font-medium text-white">
                        {selectedCount} / {totalCount}
                    </span>

                    {/* 分隔点 */}
                    <span className="text-zinc-500 text-xs">·</span>

                    {/* 全选/取消 切换按钮 */}
                    <button
                        onClick={onSelectAll}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        {isAllSelected ? t('assets.cancel') : t('assets.selectAll')}
                    </button>

                    {/* 微型关闭按钮 - 右上角徽章风格 */}
                    <button
                        onClick={onClearSelection}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-600 hover:bg-zinc-500 text-white flex items-center justify-center transition-colors ring-2 ring-zinc-900"
                        title="清空选择"
                    >
                        <X size={10} strokeWidth={2.5} />
                    </button>
                </div>

                {/* 分割线 */}
                <div className="w-px h-4 bg-white/10" />

                {/* 2. 操作按钮组 */}
                <div className="flex items-center gap-1 px-1">
                    {/* 下载按钮 - 只有有可下载截图时才启用 */}
                    <button
                        onClick={onBatchDownload}
                        disabled={downloadableCount === 0}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            downloadableCount > 0
                                ? 'hover:bg-white/10 text-white/90'
                                : 'text-white/30 cursor-not-allowed'
                        }`}
                        title={t('assets.batchDownload')}
                    >
                        <Download size={14} />
                        <span>{t('assets.batchDownload')}</span>
                        {downloadableCount > 0 && downloadableCount !== selectedCount && (
                            <span className="text-[10px] text-white/50">({downloadableCount})</span>
                        )}
                    </button>

                    {/* 删除按钮 */}
                    <button
                        onClick={onBatchDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 text-white/90 hover:text-red-400 rounded-lg text-xs font-medium transition-colors"
                        title={t('assets.batchDelete')}
                    >
                        <Trash2 size={14} />
                        <span>{t('assets.batchDelete')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
