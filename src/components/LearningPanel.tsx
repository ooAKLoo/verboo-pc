import { useState, useEffect, useMemo, useCallback } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { BookOpen, ChevronRight, ArrowLeft, Clock, Tag, X } from 'lucide-react';

// Word info from vocabulary database
export interface WordInfo {
    word: string;
    phonetic?: string;
    definitionEn?: string;
    definitionCn?: string;
    pos?: string;
    cefrLevel?: string;
    collinsStar?: number;
    cocaRank?: number;
    bncRank?: number;
    isOxford3000?: boolean;
    isCet4?: boolean;
    isCet6?: boolean;
    isZk?: boolean;
    isGk?: boolean;
    isKy?: boolean;
    isToefl?: boolean;
    isIelts?: boolean;
    isGre?: boolean;
    exchange?: string;
}

export interface DifficultWord {
    word: string;
    info: WordInfo;
    difficulty: 'high' | 'medium' | 'low';
}

export interface SubtitleRecord {
    id: number;
    videoUrl: string;
    videoTitle: string;
    platform: string;
    subtitleData: Array<{
        start: number;
        duration?: number;
        text: string;
        translation?: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

interface LearningPanelProps {
    onClose: () => void;
}

type ViewMode = 'list' | 'detail';

const { ipcRenderer } = window.require('electron');

// Difficulty level colors
const difficultyColors = {
    high: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' },
    low: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500' },
};

// Format time display
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Extract platform display name
const getPlatformName = (platform: string) => {
    const platformMap: Record<string, string> = {
        'youtube': 'YouTube',
        'bilibili': 'B站',
        'bilibili-ai': 'B站 AI',
        'import': '导入',
    };
    return platformMap[platform] || platform;
};

// Word hover card content component
function WordHoverContent({ word }: { word: DifficultWord }) {
    const colors = difficultyColors[word.difficulty];
    const info = word.info;

    // Get exam tags
    const examTags: string[] = [];
    if (info.isOxford3000) examTags.push('Oxford');
    if (info.isCet4) examTags.push('CET-4');
    if (info.isCet6) examTags.push('CET-6');
    if (info.isZk) examTags.push('中考');
    if (info.isGk) examTags.push('高考');
    if (info.isKy) examTags.push('考研');
    if (info.isToefl) examTags.push('TOEFL');
    if (info.isIelts) examTags.push('IELTS');
    if (info.isGre) examTags.push('GRE');

    return (
        <HoverCard.Content
            className="w-[320px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            sideOffset={8}
            align="start"
        >
            {/* Header */}
            <div className={`px-4 py-3 ${colors.bg} border-b ${colors.border}`}>
                <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mt-2`} />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900">{info.word}</h3>
                            {info.phonetic && (
                                <span className="text-xs text-gray-500">{info.phonetic}</span>
                            )}
                        </div>
                        {/* POS & CEFR Level */}
                        <div className="flex items-center gap-1.5 mt-1">
                            {info.pos && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-white/60 rounded">
                                    {info.pos}
                                </span>
                            )}
                            {info.cefrLevel && (
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium ${colors.text} bg-white/60 rounded`}>
                                    {info.cefrLevel}
                                </span>
                            )}
                            {info.collinsStar && info.collinsStar > 0 && (
                                <span className="text-[10px] text-amber-500">
                                    {'★'.repeat(Math.min(info.collinsStar, 5))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-3 max-h-[200px] overflow-y-auto">
                {/* Definition */}
                {info.definitionCn && (
                    <p className="text-sm text-gray-700 leading-relaxed mb-2">{info.definitionCn}</p>
                )}

                {info.definitionEn && (
                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{info.definitionEn}</p>
                )}

                {/* Exam Tags */}
                {examTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                        {examTags.map(tag => (
                            <span
                                key={tag}
                                className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-100 rounded"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <HoverCard.Arrow className="fill-white" />
        </HoverCard.Content>
    );
}

// Highlighted word with hover card
function HighlightedWord({ word, children }: { word: DifficultWord; children: React.ReactNode }) {
    const colors = difficultyColors[word.difficulty];

    return (
        <HoverCard.Root openDelay={200} closeDelay={100}>
            <HoverCard.Trigger asChild>
                <span
                    className={`${colors.bg} ${colors.text} px-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity border-b-2 ${colors.border}`}
                >
                    {children}
                </span>
            </HoverCard.Trigger>
            <HoverCard.Portal>
                <WordHoverContent word={word} />
            </HoverCard.Portal>
        </HoverCard.Root>
    );
}

// Subtitle item with highlighted words
function SubtitleItemWithHighlight({
    subtitle,
    difficultWords,
}: {
    subtitle: { start: number; text: string; translation?: string };
    difficultWords: Map<string, DifficultWord>;
}) {
    // Parse text and highlight difficult words
    const renderHighlightedText = (text: string) => {
        const wordPattern = /\b([a-zA-Z]+)\b/g;
        const parts: Array<{ type: 'text' | 'word'; content: string; wordInfo?: DifficultWord }> = [];
        let lastIndex = 0;
        let match;

        while ((match = wordPattern.exec(text)) !== null) {
            // Add text before the word
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
            }

            const word = match[1].toLowerCase();
            const wordInfo = difficultWords.get(word);

            if (wordInfo) {
                parts.push({ type: 'word', content: match[1], wordInfo });
            } else {
                parts.push({ type: 'text', content: match[1] });
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }

        return parts.map((part, index) => {
            if (part.type === 'word' && part.wordInfo) {
                return (
                    <HighlightedWord key={index} word={part.wordInfo}>
                        {part.content}
                    </HighlightedWord>
                );
            }
            return <span key={index}>{part.content}</span>;
        });
    };

    return (
        <div className="group px-6 py-3 hover:bg-gray-50/50 transition-colors">
            <div className="flex gap-4 items-start">
                <div className="text-[12px] font-mono tabular-nums min-w-[50px] pt-0.5 text-gray-400">
                    {formatTime(subtitle.start)}
                </div>
                <div className="flex-1 space-y-1.5">
                    <div className="text-[15px] leading-[1.7] text-gray-700">
                        {renderHighlightedText(subtitle.text)}
                    </div>
                    {subtitle.translation && (
                        <div className="text-[13px] leading-[1.6] text-gray-400">
                            {subtitle.translation}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function LearningPanel({ onClose }: LearningPanelProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [subtitleRecords, setSubtitleRecords] = useState<SubtitleRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<SubtitleRecord | null>(null);
    const [difficultWords, setDifficultWords] = useState<Map<string, DifficultWord>>(new Map());
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    // Load all subtitle records
    useEffect(() => {
        const loadSubtitles = async () => {
            try {
                setLoading(true);
                const response = await ipcRenderer.invoke('get-all-subtitles', { limit: 100 });
                if (response.success) {
                    setSubtitleRecords(response.data);
                }
            } catch (error) {
                console.error('Failed to load subtitles:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSubtitles();
    }, []);

    // Analyze text when a record is selected
    const analyzeSubtitle = useCallback(async (record: SubtitleRecord) => {
        setAnalyzing(true);
        setSelectedRecord(record);
        setViewMode('detail');

        try {
            // Combine all subtitle text for analysis
            const fullText = record.subtitleData.map(s => s.text).join(' ');
            console.log('[LearningPanel] Analyzing text, length:', fullText.length);
            const response = await ipcRenderer.invoke('analyze-text-difficulty', fullText);
            console.log('[LearningPanel] Analysis response:', response);

            if (response.success) {
                const wordMap = new Map<string, DifficultWord>();
                for (const item of response.data) {
                    wordMap.set(item.word, item);
                }
                console.log('[LearningPanel] Found difficult words:', wordMap.size);
                setDifficultWords(wordMap);
            } else {
                console.error('[LearningPanel] Analysis failed:', response.error);
            }
        } catch (error) {
            console.error('[LearningPanel] Failed to analyze text:', error);
        } finally {
            setAnalyzing(false);
        }
    }, []);

    // Group difficult words by difficulty level
    const groupedWords = useMemo(() => {
        const groups = {
            high: [] as DifficultWord[],
            medium: [] as DifficultWord[],
            low: [] as DifficultWord[],
        };

        for (const word of difficultWords.values()) {
            groups[word.difficulty].push(word);
        }

        return groups;
    }, [difficultWords]);

    // Back to list view
    const handleBackToList = () => {
        setViewMode('list');
        setSelectedRecord(null);
        setDifficultWords(new Map());
    };

    // Render subtitle list view
    const renderListView = () => (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <BookOpen size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-[18px] font-semibold text-gray-900">英语学习</h1>
                        <p className="text-[13px] text-gray-400 mt-0.5">选择字幕，分析重点难点词汇</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>
            </div>

            {/* Subtitle List */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                    </div>
                ) : subtitleRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                        <BookOpen size={48} strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[15px] font-medium text-gray-500">暂无字幕记录</p>
                            <p className="text-[13px] mt-1">浏览视频并获取字幕后，可在此学习</p>
                        </div>
                    </div>
                ) : (
                    <div className="py-3">
                        {subtitleRecords.map((record) => (
                            <div
                                key={record.id}
                                onClick={() => analyzeSubtitle(record)}
                                className="group flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <BookOpen size={20} className="text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[15px] font-medium text-gray-800 truncate">
                                        {record.videoTitle || '未命名视频'}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[12px] text-gray-500 px-2 py-0.5 bg-gray-100 rounded-md">
                                            {getPlatformName(record.platform)}
                                        </span>
                                        <span className="text-[12px] text-gray-400 flex items-center gap-1">
                                            <Clock size={12} />
                                            {record.subtitleData.length} 条字幕
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // Render detail view with highlighted subtitles
    const renderDetailView = () => {
        if (!selectedRecord) return null;

        return (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBackToList}
                            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[16px] font-semibold text-gray-900 truncate">
                                {selectedRecord.videoTitle || '未命名视频'}
                            </h1>
                            <p className="text-[12px] text-gray-400 mt-0.5">
                                {selectedRecord.subtitleData.length} 条字幕
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Word Summary */}
                {!analyzing && difficultWords.size > 0 && (
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-center gap-2 mb-3">
                            <Tag size={16} className="text-gray-400" />
                            <span className="text-[13px] font-medium text-gray-600">
                                难点词汇 ({difficultWords.size})
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {groupedWords.high.slice(0, 8).map(w => (
                                <HighlightedWord key={w.word} word={w}>
                                    {w.word}
                                </HighlightedWord>
                            ))}
                            {groupedWords.medium.slice(0, 8).map(w => (
                                <HighlightedWord key={w.word} word={w}>
                                    {w.word}
                                </HighlightedWord>
                            ))}
                            {difficultWords.size > 16 && (
                                <span className="px-2 py-0.5 text-[12px] text-gray-400">
                                    +{difficultWords.size - 16} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Subtitle List with Highlights */}
                <div className="flex-1 overflow-auto">
                    {analyzing ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                            <span className="text-[13px] text-gray-400">正在分析词汇难度...</span>
                        </div>
                    ) : (
                        <div className="py-4">
                            {selectedRecord.subtitleData.map((subtitle, index) => (
                                <SubtitleItemWithHighlight
                                    key={index}
                                    subtitle={subtitle}
                                    difficultWords={difficultWords}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full bg-white rounded-xl">
            {viewMode === 'list' ? renderListView() : renderDetailView()}
        </div>
    );
}
