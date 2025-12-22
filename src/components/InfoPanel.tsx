import { useState, useEffect, useRef } from 'react';
import { MaterialPanel } from './MaterialPanel';

interface InfoPanelProps {
    data: any;
    currentVideoTime?: number;
    materialRefreshTrigger?: number;
    onOpenLink?: (url: string) => void;
}

type TabType = 'subtitles' | 'materials';

export function InfoPanel({ data, currentVideoTime = 0, materialRefreshTrigger = 0, onOpenLink }: InfoPanelProps) {
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

    // Tab button component
    const TabButton = ({ tab, label, icon }: { tab: TabType; label: string; icon: string }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${activeTab === tab
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
        >
            <span>{icon}</span>
            <span>{label}</span>
        </button>
    );

    return (
        <div className="h-full flex flex-col font-sans bg-white text-primary">
            {/* Tab Navigation */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    <TabButton tab="subtitles" label="字幕" icon="📜" />
                    <TabButton tab="materials" label="素材" icon="📦" />
                </div>
            </div>

            {/* Materials Tab */}
            {activeTab === 'materials' && (
                <MaterialPanel
                    refreshTrigger={materialRefreshTrigger}
                    onOpenLink={onOpenLink}
                />
            )}

            {/* Subtitles Tab */}
            {activeTab === 'subtitles' && (
                <>
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-medium text-gray-800">字幕</h2>
                            <div className="flex gap-2 items-center">
                                {Array.isArray(data) && data.length > 0 && (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={exportAsText}
                                            className="text-xs px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                                            title="导出为文本"
                                        >
                                            TXT
                                        </button>
                                        <button
                                            onClick={exportAsSRT}
                                            className="text-xs px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                                            title="导出为SRT字幕"
                                        >
                                            SRT
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={() => setAutoScroll(!autoScroll)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${autoScroll ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}
                                >
                                    {autoScroll ? '自动滚动' : '手动滚动'}
                                </button>
                            </div>
                        </div>
                        {Array.isArray(data) && data.length > 0 && (
                            <input
                                type="text"
                                placeholder="搜索字幕..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
                            />
                        )}
                    </div>

                    <div ref={scrollRef} className="flex-1 bg-gray-50/50 overflow-auto">
                        {Array.isArray(filteredData) && filteredData.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {filteredData.map((item, index) => {
                                    // Check if this is the current subtitle being played
                                    const isCurrent = item.start !== undefined &&
                                        currentVideoTime > 0 &&
                                        item.start <= currentVideoTime &&
                                        (filteredData[index + 1]?.start === undefined || currentVideoTime < filteredData[index + 1].start);

                                    return (
                                        <div
                                            key={index}
                                            ref={(el) => { itemRefs.current[index] = el; }}
                                            className={`px-4 py-3 transition-colors cursor-pointer group ${isCurrent ? 'bg-blue-100/80 border-l-4 border-blue-500' : 'hover:bg-blue-50/50'
                                                }`}
                                        >
                                            {item.start !== undefined ? (
                                                // Transcript item with timestamp
                                                <div className="flex gap-3 items-start">
                                                    <div className="text-xs text-blue-600 font-mono font-medium min-w-[45px] pt-0.5 group-hover:text-blue-700">
                                                        {formatTime(item.start)}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        {/* Original text */}
                                                        <div className="text-sm text-gray-700 font-sans leading-relaxed">
                                                            {searchTerm ? (
                                                                <span dangerouslySetInnerHTML={{
                                                                    __html: (item.text || '').replace(
                                                                        new RegExp(searchTerm, 'gi'),
                                                                        (match: string) => `<mark class="bg-yellow-200 px-0.5">${match}</mark>`
                                                                    )
                                                                }} />
                                                            ) : (
                                                                item.text
                                                            )}
                                                        </div>
                                                        {/* Translation if available */}
                                                        {item.translation && (
                                                            <div className="text-sm text-gray-500 font-sans leading-relaxed border-l-2 border-blue-200 pl-2">
                                                                {searchTerm ? (
                                                                    <span dangerouslySetInnerHTML={{
                                                                        __html: (item.translation || '').replace(
                                                                            new RegExp(searchTerm, 'gi'),
                                                                            (match: string) => `<mark class="bg-yellow-200 px-0.5">${match}</mark>`
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
                                                    <div className="text-[10px] text-tertiary uppercase tracking-wider font-bold">{item.platform}</div>
                                                    <div className="text-sm text-primary font-sans leading-relaxed">{item.text}</div>
                                                </div>
                                            ) : (
                                                <pre className="text-xs text-secondary whitespace-pre-wrap break-all">
                                                    {JSON.stringify(item, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : Array.isArray(data) && data.length > 0 && searchTerm ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
                                <span className="text-xs">未找到匹配的字幕</span>
                            </div>
                        ) : data ? (
                            <div className="p-4">
                                <pre className="text-xs text-secondary whitespace-pre-wrap break-all">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-tertiary gap-2">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20">
                                    <path d="M7 8h10M7 12h4M7 16h10" />
                                    <rect x="3" y="4" width="18" height="16" rx="2" />
                                </svg>
                                <div className="text-center">
                                    <div className="text-sm font-medium mb-1">等待字幕数据</div>
                                    <div className="text-xs text-gray-400">点击左侧插件提取字幕</div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

