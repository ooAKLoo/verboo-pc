import { useState, useEffect, useMemo, useRef } from 'react';
import { Video, ChevronDown, Download, FileDown, Subtitles, Search, X } from 'lucide-react';
import type { SubtitleItem } from '../utils/subtitleParser';

export interface SubtitleRecord {
    id: number;
    videoUrl: string;
    videoTitle: string;
    platform: string;
    subtitleData: SubtitleItem[];
    createdAt: Date;
    updatedAt: Date;
}

interface SubtitleLibraryPanelProps {
    onClose: () => void;
}

const { ipcRenderer } = window.require('electron');

// Export format options for subtitles
const SUBTITLE_EXPORT_FORMATS = [
    {
        id: 'srt',
        label: 'SRT',
        desc: '通用字幕格式，兼容大多数播放器',
        icon: FileDown,
        extension: 'srt'
    },
    {
        id: 'vtt',
        label: 'WebVTT',
        desc: 'HTML5 视频字幕标准格式',
        icon: FileDown,
        extension: 'vtt'
    },
    {
        id: 'txt',
        label: '纯文本',
        desc: '仅包含文字内容，不含时间轴',
        icon: FileDown,
        extension: 'txt'
    },
    {
        id: 'json',
        label: 'JSON',
        desc: '结构化数据，便于程序处理',
        icon: FileDown,
        extension: 'json'
    },
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
 * VideoSelector - 视频字幕选择器
 */
function VideoSelector({
    records,
    selectedId,
    onChange
}: {
    records: SubtitleRecord[];
    selectedId: number | null;
    onChange: (id: number) => void;
}) {
    const getPlatformName = (platform: string) => {
        switch (platform) {
            case 'youtube': return 'YouTube';
            case 'bilibili': return 'B站';
            case 'bilibili-ai': return 'B站 AI';
            default: return platform || '导入';
        }
    };

    return (
        <div className="p-2 min-w-[280px] max-h-[400px] overflow-y-auto">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">选择视频</div>
            <div className="space-y-0.5">
                {records.map(record => {
                    const isSelected = selectedId === record.id;
                    return (
                        <button
                            key={record.id}
                            onClick={() => onChange(record.id)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                                transition-all duration-150
                                ${isSelected
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'hover:bg-zinc-50 text-zinc-700'
                                }
                            `}
                        >
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Video size={14} className="text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                    {record.videoTitle || '未命名视频'}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-zinc-400">
                                        {getPlatformName(record.platform)}
                                    </span>
                                    <span className="text-xs text-zinc-300">·</span>
                                    <span className="text-xs text-zinc-400">
                                        {record.subtitleData.length} 条
                                    </span>
                                </div>
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
 * ExportMenu - 导出菜单组件
 */
function SubtitleExportMenu({
    subtitles,
    onExport
}: {
    subtitles: SubtitleItem[];
    onExport: (format: string) => void;
}) {
    return (
        <div className="p-2 min-w-[220px]">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">导出格式</div>
            <div className="space-y-0.5">
                {SUBTITLE_EXPORT_FORMATS.map(format => {
                    const IconComponent = format.icon;
                    return (
                        <button
                            key={format.id}
                            onClick={() => onExport(format.id)}
                            disabled={subtitles.length === 0}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150 hover:bg-zinc-50 text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <IconComponent size={14} className="text-zinc-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{format.label}</div>
                                <div className="text-xs text-zinc-400">{format.desc}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-100 px-2">
                <span className="text-[10px] text-zinc-400">
                    将导出 {subtitles.length} 条字幕
                </span>
            </div>
        </div>
    );
}

// Format time for SRT (HH:MM:SS,mmm)
function formatTimeSRT(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Format time for VTT (HH:MM:SS.mmm)
function formatTimeVTT(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Format time for display (MM:SS)
function formatTimeDisplay(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Export subtitles to various formats
function exportSubtitles(subtitles: SubtitleItem[], format: string, videoTitle: string) {
    let content = '';
    let filename = `${videoTitle || 'subtitles'}_${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';

    switch (format) {
        case 'srt':
            // SRT format
            content = subtitles.map((sub, index) => {
                const start = formatTimeSRT(sub.start);
                const end = formatTimeSRT(sub.start + (sub.duration || 3));
                let text = sub.text;
                if (sub.translation) {
                    text += '\n' + sub.translation;
                }
                return `${index + 1}\n${start} --> ${end}\n${text}\n`;
            }).join('\n');
            filename += '.srt';
            break;

        case 'vtt':
            // WebVTT format
            content = 'WEBVTT\n\n';
            content += subtitles.map((sub, index) => {
                const start = formatTimeVTT(sub.start);
                const end = formatTimeVTT(sub.start + (sub.duration || 3));
                let text = sub.text;
                if (sub.translation) {
                    text += '\n' + sub.translation;
                }
                return `${index + 1}\n${start} --> ${end}\n${text}\n`;
            }).join('\n');
            filename += '.vtt';
            break;

        case 'txt':
            // Plain text (only text content)
            content = subtitles.map(sub => sub.text).join('\n');
            filename += '.txt';
            break;

        case 'json':
            // JSON format
            content = JSON.stringify(subtitles, null, 2);
            filename += '.json';
            mimeType = 'application/json';
            break;

        default:
            return;
    }

    // Download file
    const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * SubtitleItem - 单条字幕显示组件
 */
function SubtitleListItem({
    subtitle,
    index
}: {
    subtitle: SubtitleItem;
    index: number;
}) {
    return (
        <div className="group table-row cursor-pointer hover:bg-zinc-50/50 transition-colors">
            {/* Index */}
            <div className="table-cell h-10 align-middle border-b border-zinc-100 pl-6 pr-3">
                <span className="text-[11px] text-zinc-400 tabular-nums">
                    {index + 1}
                </span>
            </div>

            {/* Time */}
            <div className="table-cell h-10 align-middle border-b border-zinc-100 pr-3">
                <span className="text-[12px] font-mono text-zinc-500 tabular-nums">
                    {formatTimeDisplay(subtitle.start)}
                </span>
            </div>

            {/* Text */}
            <div className="table-cell h-10 align-middle border-b border-zinc-100 pr-3 max-w-0 w-full">
                <div className="truncate">
                    <span className="text-[13px] text-zinc-700">
                        {subtitle.text}
                    </span>
                    {subtitle.translation && (
                        <span className="text-[12px] text-zinc-400 ml-2">
                            {subtitle.translation}
                        </span>
                    )}
                </div>
            </div>

            {/* Duration */}
            <div className="table-cell h-10 align-middle border-b border-zinc-100 pr-6 text-right whitespace-nowrap">
                <span className="text-[11px] text-zinc-400 tabular-nums">
                    {subtitle.duration ? `${subtitle.duration.toFixed(1)}s` : '-'}
                </span>
            </div>
        </div>
    );
}

export function SubtitleLibraryPanel({ onClose }: SubtitleLibraryPanelProps) {
    const [subtitleRecords, setSubtitleRecords] = useState<SubtitleRecord[]>([]);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activePopover, setActivePopover] = useState<string | null>(null);

    // Get selected record
    const selectedRecord = useMemo(() => {
        if (!selectedRecordId) return null;
        return subtitleRecords.find(r => r.id === selectedRecordId) || null;
    }, [selectedRecordId, subtitleRecords]);

    // Load subtitle records on mount
    useEffect(() => {
        const loadSubtitleRecords = async () => {
            try {
                setLoading(true);
                const response = await ipcRenderer.invoke('get-all-subtitles', { limit: 100 });
                if (response.success) {
                    setSubtitleRecords(response.data);
                    // 默认选中第一个视频
                    if (response.data.length > 0 && !selectedRecordId) {
                        setSelectedRecordId(response.data[0].id);
                    }
                }
            } catch (error) {
                console.error('Failed to load subtitle records:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSubtitleRecords();
    }, []);

    // Get current subtitles based on selection
    const currentSubtitles = useMemo(() => {
        return selectedRecord?.subtitleData || [];
    }, [selectedRecord]);

    // Filter subtitles by search query
    const filteredSubtitles = useMemo(() => {
        if (!searchQuery.trim()) return currentSubtitles;
        const query = searchQuery.toLowerCase();
        return currentSubtitles.filter(sub =>
            sub.text.toLowerCase().includes(query) ||
            (sub.translation && sub.translation.toLowerCase().includes(query))
        );
    }, [currentSubtitles, searchQuery]);

    // Handle video selection change
    const handleVideoSelect = (recordId: number) => {
        setSelectedRecordId(recordId);
        setActivePopover(null);
    };

    // Handle export
    const handleExport = (format: string) => {
        const title = selectedRecord?.videoTitle || 'all_subtitles';
        exportSubtitles(filteredSubtitles, format, title);
        setActivePopover(null);
    };

    return (
        <div className="h-full bg-white rounded-xl flex flex-col">
            {/* Header */}
            <div className="flex-none px-4 py-3 flex items-center justify-between border-b border-zinc-100">
                <span className="text-sm font-medium text-zinc-700">字幕库</span>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                    <X size={18} className="text-zinc-400" />
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex-none px-8 py-3 flex items-center gap-3">
                {/* Video Selector */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<Video size={13} />}
                            label={selectedRecord
                                ? (selectedRecord.videoTitle?.slice(0, 15) + (selectedRecord.videoTitle && selectedRecord.videoTitle.length > 15 ? '...' : '')) || '选择视频'
                                : '选择视频'}
                            isActive={activePopover === 'video'}
                            hasSelection={!!selectedRecordId}
                            onClick={() => setActivePopover(activePopover === 'video' ? null : 'video')}
                        />
                    }
                    isOpen={activePopover === 'video'}
                    onClose={() => setActivePopover(null)}
                >
                    <VideoSelector
                        records={subtitleRecords}
                        selectedId={selectedRecordId}
                        onChange={handleVideoSelect}
                    />
                </FilterPopover>

                {/* Divider */}
                <div className="w-px h-5 bg-zinc-100 mx-1 flex-none" />

                {/* Export Button */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<Download size={13} />}
                            label="下载"
                            isActive={activePopover === 'export'}
                            hasSelection={false}
                            onClick={() => setActivePopover(activePopover === 'export' ? null : 'export')}
                        />
                    }
                    isOpen={activePopover === 'export'}
                    onClose={() => setActivePopover(null)}
                >
                    <SubtitleExportMenu
                        subtitles={filteredSubtitles}
                        onExport={handleExport}
                    />
                </FilterPopover>

                {/* Search Box */}
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-full">
                    <Search size={13} className="text-zinc-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索字幕内容..."
                        className="flex-1 text-xs bg-transparent outline-none placeholder-zinc-400"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-zinc-200 rounded-full">
                            <X size={12} className="text-zinc-400" />
                        </button>
                    )}
                </div>

                {/* Subtitle Count */}
                <span className="text-[12px] text-zinc-400 flex-none">
                    {filteredSubtitles.length} 条字幕
                </span>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full">
                        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                        <span className="text-[13px] text-gray-400">加载字幕数据...</span>
                    </div>
                ) : subtitleRecords.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 h-full">
                        <Subtitles size={48} strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[15px] font-medium text-gray-500">暂无字幕</p>
                            <p className="text-[13px] mt-1">请先获取或导入视频字幕</p>
                        </div>
                    </div>
                ) : filteredSubtitles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 h-full">
                        <Search size={48} strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[15px] font-medium text-gray-500">未找到匹配字幕</p>
                            <p className="text-[13px] mt-1">尝试其他搜索词</p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-auto">
                        {/* Table Container */}
                        <div className="table w-full min-w-[500px]">
                            {/* List Header */}
                            <div className="table-row sticky top-0 z-10 bg-zinc-50/95 backdrop-blur-sm">
                                <div className="table-cell h-8 align-middle pl-6 pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider w-[50px]">
                                    #
                                </div>
                                <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider w-[70px]">
                                    时间
                                </div>
                                <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider w-full">
                                    内容
                                </div>
                                <div className="table-cell h-8 align-middle pr-6 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider text-right whitespace-nowrap w-[60px]">
                                    时长
                                </div>
                            </div>
                            {filteredSubtitles.map((subtitle, index) => (
                                <SubtitleListItem key={index} subtitle={subtitle} index={index} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
