import { useState, useEffect, useRef } from 'react';
import { AssetPanel } from './AssetPanel';
import type { Asset } from './AssetCard';
import { EnglishLearning } from './EnglishLearning';
import { FileText, Package, SearchX, FileX, Sparkles, BookOpen, Star, AlertTriangle } from 'lucide-react';

// Mark type for subtitles
type MarkType = 'important' | 'difficult';

// Marked subtitle info
interface SubtitleMark {
    timestamp: number; // The timestamp when mark was created
    markType: MarkType;
}

interface InfoPanelProps {
    data: any;
    currentVideoTime?: number;
    materialRefreshTrigger?: number;
    onEditScreenshot?: (asset: Asset) => void;
    showEnglishLearning?: boolean;
    onCloseEnglishLearning?: () => void;
    // New: marks from captures
    subtitleMarks?: SubtitleMark[];
}

type TabType = 'subtitles' | 'assets' | 'learning';

export function InfoPanel({ data, currentVideoTime = 0, materialRefreshTrigger = 0, onEditScreenshot, showEnglishLearning = false, onCloseEnglishLearning, subtitleMarks = [] }: InfoPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('subtitles');
    const [searchTerm, setSearchTerm] = useState('');

    // Switch to learning tab when showEnglishLearning changes
    useEffect(() => {
        if (showEnglishLearning) {
            setActiveTab('learning');
        }
    }, [showEnglishLearning]);
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

    // Check if a subtitle has marks (based on timestamp overlap)
    const getSubtitleMark = (subtitleStart: number, subtitleDuration: number = 0): MarkType | null => {
        const subtitleEnd = subtitleStart + (subtitleDuration || 3); // Default 3 seconds if no duration
        for (const mark of subtitleMarks) {
            if (mark.timestamp >= subtitleStart && mark.timestamp <= subtitleEnd) {
                return mark.markType;
            }
        }
        return null;
    };

    // Copy subtitles to English Learning Prompt template
    const [copySuccess, setCopySuccess] = useState(false);

    const copyToPrompt = async () => {
        if (!Array.isArray(data) || data.length === 0) return;

        // Extract subtitle text
        const subtitleText = data.map(item => {
            if (item.start !== undefined) {
                return `[${formatTime(item.start)}] ${item.text}${item.translation ? `\n${item.translation}` : ''}`;
            }
            return item.text || '';
        }).filter(Boolean).join('\n\n');

        // English Learning Prompt template
        const promptTemplate = `# Role
你是一位拥有 20 年教学经验的高级同传翻译和英语教育专家，擅长捕捉英语中那些"字面意思"与"实际语境意义"存在巨大偏差的地道表达。

# Task
我会为你提供一段视频字幕文本。请你深度扫描并提取出符合"翻译不对称性"特征的短语、习惯用语（Idioms）、习语（Phrasal Verbs）或职场专业表达。

# Selection Criteria (关键筛选标准)
请优先提取符合以下条件的表达：
1. **语义不对称：** 整体翻译 ≠ 逐词翻译之和。学习者即便认识所有单词，也很容易猜错意思。
2. **场景高频：** 在专业视频、职场或真实生活对话中经常出现。
3. **文化内涵：** 带有英语思维特色，无法在中文里直接找到一一对应字面翻译的词。

# Output Format
请以 Markdown 表格形式输出，包含以下字段：
- **Phrase/Expression**: 原短语
- **Literal Trap**: 字面直译的误区（故意写错，提示用户容易在哪跌倒）
- **Authentic Meaning**: 真实地道含义（中文）
- **Why it matters**: 解释为什么这个词重要，或者它的应用语境是什么。
- **Contextual Example**: 基于给定的字幕内容或其场景，给出一个例句。

# Workflow
1. 过滤掉简单的基础词汇和可以直接字面对应的短语。
2. 识别具有"翻译不对称性"的表达。
3. 按照上述表格格式输出。

# Input Subtitles
${subtitleText}
`;

        try {
            await navigator.clipboard.writeText(promptTemplate);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
        { id: 'subtitles', label: '字幕', icon: FileText },
        { id: 'assets', label: '素材库', icon: Package },
        { id: 'learning', label: '学习', icon: BookOpen },
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
                            left: activeTab === 'subtitles' ? '2px' : activeTab === 'assets' ? `calc(${100 / tabs.length}%)` : `calc(${200 / tabs.length}%)`,
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

            {/* Learning Tab */}
            {activeTab === 'learning' && (
                <EnglishLearning
                    onBack={() => {
                        setActiveTab('subtitles');
                        onCloseEnglishLearning?.();
                    }}
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
                                            onClick={copyToPrompt}
                                            className={`h-8 px-2.5 text-[12px] font-medium rounded-md transition-all duration-150 flex items-center gap-1 ${
                                                copySuccess
                                                    ? 'text-green-600 bg-green-50'
                                                    : 'text-[#52525b] bg-transparent hover:bg-[#f4f4f5]'
                                            }`}
                                            title="复制字幕到英语学习Prompt"
                                        >
                                            <Sparkles size={12} />
                                            {copySuccess ? '已复制' : 'AI学习'}
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

                                    // Check if this subtitle has a mark
                                    const mark = item.start !== undefined ? getSubtitleMark(item.start, item.duration) : null;

                                    return (
                                        <div
                                            key={index}
                                            ref={(el) => { itemRefs.current[index] = el; }}
                                            className={`group px-4 py-2.5 transition-all duration-200 cursor-default ${
                                                mark === 'important'
                                                    ? 'bg-amber-50/70 border-l-2 border-amber-400'
                                                    : mark === 'difficult'
                                                    ? 'bg-red-50/70 border-l-2 border-red-400'
                                                    : isCurrent
                                                    ? 'bg-[#fafafa]'
                                                    : 'hover:bg-[#fafafa]/50'
                                            }`}
                                        >
                                            {item.start !== undefined ? (
                                                <div className="flex gap-3 items-start">
                                                    {/* Mark Icon */}
                                                    {mark && (
                                                        <div className="pt-0.5">
                                                            {mark === 'important' ? (
                                                                <Star size={12} className="text-amber-500 fill-amber-500" />
                                                            ) : (
                                                                <AlertTriangle size={12} className="text-red-500" />
                                                            )}
                                                        </div>
                                                    )}
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
