import { useState, useEffect, useRef } from 'react';
import { AssetPanel } from './AssetPanel';
import type { Asset } from './AssetCard';
import { FileText, Package, SearchX, FileX } from 'lucide-react';

interface InfoPanelProps {
    data: any;
    currentVideoTime?: number;
    materialRefreshTrigger?: number;
    onEditScreenshot?: (asset: Asset) => void;
}

type TabType = 'subtitles' | 'assets';

export function InfoPanel({ data, currentVideoTime = 0, materialRefreshTrigger = 0, onEditScreenshot }: InfoPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('subtitles');
    const [searchTerm, setSearchTerm] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    // Auto-scroll to current subtitle based on video time
    useEffect(() => {
        if (!autoScroll || !Array.isArray(data) || data.length === 0) return;

        // If we have video time, scroll to the current subtitle
        if (currentVideoTime > 0) {
            // Find the index of the current subtitle
            const currentIndex = data.findIndex((item, index) => {
                if (item.start === undefined) return false;
                const nextItem = data[index + 1];
                const nextStart = nextItem?.start || Infinity;
                return item.start <= currentVideoTime && currentVideoTime < nextStart;
            });

            // Scroll to the current subtitle
            if (currentIndex >= 0 && itemRefs.current[currentIndex]) {
                itemRefs.current[currentIndex]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        } else {
            // Fall back to scroll to bottom when no video time
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }
    }, [data, autoScroll, currentVideoTime]);

    // Filter data based on search (search both original and translation)
    const filteredData = Array.isArray(data)
        ? data.filter(item => {
            if (!searchTerm) return true;
            const text = item.text || JSON.stringify(item);
            const translation = item.translation || '';
            const searchLower = searchTerm.toLowerCase();
            return text.toLowerCase().includes(searchLower) ||
                translation.toLowerCase().includes(searchLower);
        })
        : data;

    // Format time display
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    // Export subtitles as text
    const exportAsText = () => {
        if (!Array.isArray(data) || data.length === 0) return;

        const text = data.map(item => {
            if (item.start !== undefined) {
                return `[${formatTime(item.start)}] ${item.text}`;
            }
            return item.text || JSON.stringify(item);
        }).join('\n\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitle_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Export subtitles as SRT
    const exportAsSRT = () => {
        if (!Array.isArray(data) || data.length === 0) return;

        const srt = data.map((item, index) => {
            if (item.start !== undefined) {
                const start = formatSRTTime(item.start);
                const end = formatSRTTime(item.start + (item.duration || 2));
                return `${index + 1}\n${start} --> ${end}\n${item.text}\n`;
            }
            return '';
        }).filter(Boolean).join('\n');

        const blob = new Blob([srt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitle_${new Date().toISOString().slice(0, 10)}.srt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Format time for SRT (HH:MM:SS,mmm)
    const formatSRTTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
        { id: 'subtitles', label: '字幕', icon: FileText },
        { id: 'assets', label: '素材库', icon: Package },
    ];

    return (
        <div className="h-full flex flex-col font-sans bg-white text-primary">
            {/* Tab Navigation - Linear Style */}
            <div className="px-4 pt-4 pb-3">
                <div className="relative flex p-0.5 bg-[#f4f4f5] rounded-lg">
                    {/* Sliding indicator */}
                    <div
                        className="absolute top-0.5 bottom-0.5 rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] transition-all duration-200 ease-out"
                        style={{
                            width: `calc(${100 / tabs.length}% - 2px)`,
                            left: activeTab === 'subtitles' ? '2px' : `calc(${100 / tabs.length}% - 0px)`,
                        }}
                    />
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative z-10 flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-1.5 ${
                                activeTab === tab.id
                                    ? 'text-[#18181b]'
                                    : 'text-[#71717a] hover:text-[#3f3f46]'
                            }`}
                        >
                            <tab.icon size={14} strokeWidth={1.75} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Assets Tab */}
            {activeTab === 'assets' && (
                <AssetPanel
                    refreshTrigger={materialRefreshTrigger}
                    onEditScreenshot={onEditScreenshot}
                />
            )}

            {/* Subtitles Tab */}
            {activeTab === 'subtitles' && (
                <>
                    {/* Toolbar - Linear Style */}
                    <div className="px-4 py-3">
                        <div className="flex items-center gap-2">
                            {/* Search Input */}
                            {Array.isArray(data) && data.length > 0 && (
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="搜索字幕..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full h-8 px-3 text-[13px] bg-[#f4f4f5] rounded-lg focus:outline-none focus:bg-[#e4e4e7] transition-all duration-150 placeholder:text-[#a1a1aa]"
                                    />
                                </div>
                            )}
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                                {Array.isArray(data) && data.length > 0 && (
                                    <>
                                        <button
                                            onClick={exportAsText}
                                            className="h-8 px-2.5 text-[12px] font-medium text-[#52525b] bg-transparent hover:bg-[#f4f4f5] rounded-md transition-colors duration-150"
                                            title="导出为文本"
                                        >
                                            TXT
                                        </button>
                                        <button
                                            onClick={exportAsSRT}
                                            className="h-8 px-2.5 text-[12px] font-medium text-[#52525b] bg-transparent hover:bg-[#f4f4f5] rounded-md transition-colors duration-150"
                                            title="导出为SRT字幕"
                                        >
                                            SRT
                                        </button>
                                        <div className="w-px h-4 bg-[#e4e4e7] mx-1" />
                                    </>
                                )}
                                <button
                                    onClick={() => setAutoScroll(!autoScroll)}
                                    className={`h-8 px-2.5 text-[12px] font-medium rounded-md transition-all duration-150 ${
                                        autoScroll
                                            ? 'text-[#18181b] bg-[#f4f4f5]'
                                            : 'text-[#71717a] bg-transparent hover:bg-[#f4f4f5]'
                                    }`}
                                >
                                    {autoScroll ? '自动' : '手动'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Subtitle List - Linear Style */}
                    <div ref={scrollRef} className="flex-1 overflow-auto">
                        {Array.isArray(filteredData) && filteredData.length > 0 ? (
                            <div className="pb-6">
                                {filteredData.map((item, index) => {
                                    const isCurrent = item.start !== undefined &&
                                        currentVideoTime > 0 &&
                                        item.start <= currentVideoTime &&
                                        (filteredData[index + 1]?.start === undefined || currentVideoTime < filteredData[index + 1].start);

                                    return (
                                        <div
                                            key={index}
                                            ref={(el) => { itemRefs.current[index] = el; }}
                                            className={`group px-4 py-2.5 transition-all duration-200 cursor-default ${
                                                isCurrent
                                                    ? 'bg-[#fafafa]'
                                                    : 'hover:bg-[#fafafa]/50'
                                            }`}
                                        >
                                            {item.start !== undefined ? (
                                                <div className="flex gap-3 items-start">
                                                    {/* Timestamp */}
                                                    <div className={`text-[11px] font-mono tabular-nums min-w-[42px] pt-0.5 transition-colors duration-200 ${
                                                        isCurrent ? 'text-[#18181b]' : 'text-[#a1a1aa] group-hover:text-[#71717a]'
                                                    }`}>
                                                        {formatTime(item.start)}
                                                    </div>
                                                    {/* Content */}
                                                    <div className="flex-1 space-y-1">
                                                        <div className={`text-[13px] leading-[1.6] transition-colors duration-200 ${
                                                            isCurrent ? 'text-[#18181b]' : 'text-[#52525b]'
                                                        }`}>
                                                            {searchTerm ? (
                                                                <span dangerouslySetInnerHTML={{
                                                                    __html: (item.text || '').replace(
                                                                        new RegExp(searchTerm, 'gi'),
                                                                        (match: string) => `<mark class="bg-[#fef08a] text-[#18181b] px-0.5 rounded-sm">${match}</mark>`
                                                                    )
                                                                }} />
                                                            ) : (
                                                                item.text
                                                            )}
                                                        </div>
                                                        {item.translation && (
                                                            <div className={`text-[12px] leading-[1.5] transition-colors duration-200 ${
                                                                isCurrent ? 'text-[#71717a]' : 'text-[#a1a1aa]'
                                                            }`}>
                                                                {searchTerm ? (
                                                                    <span dangerouslySetInnerHTML={{
                                                                        __html: (item.translation || '').replace(
                                                                            new RegExp(searchTerm, 'gi'),
                                                                            (match: string) => `<mark class="bg-[#fef08a] text-[#18181b] px-0.5 rounded-sm">${match}</mark>`
                                                                        )
                                                                    }} />
                                                                ) : (
                                                                    item.translation
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : item.type === 'subtitle' ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-medium">{item.platform}</div>
                                                    <div className={`text-[13px] leading-[1.6] ${
                                                        isCurrent ? 'text-[#18181b]' : 'text-[#52525b]'
                                                    }`}>{item.text}</div>
                                                </div>
                                            ) : (
                                                <pre className="text-[11px] text-[#71717a] whitespace-pre-wrap break-all font-mono">
                                                    {JSON.stringify(item, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : Array.isArray(data) && data.length > 0 && searchTerm ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
                                <SearchX size={20} strokeWidth={1.5} className="text-[#d4d4d8]" />
                                <span className="text-[13px] text-[#a1a1aa]">未找到匹配的字幕</span>
                            </div>
                        ) : data ? (
                            <div className="p-4">
                                <pre className="text-[11px] text-[#71717a] whitespace-pre-wrap break-all font-mono">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center gap-3">
                                <FileX size={28} strokeWidth={1.5} className="text-[#e4e4e7]" />
                                <div className="text-center">
                                    <div className="text-[13px] font-medium text-[#71717a] mb-1">等待字幕数据</div>
                                    <div className="text-[12px] text-[#a1a1aa]">点击左侧插件提取字幕</div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
