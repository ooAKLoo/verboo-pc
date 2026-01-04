import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X, GraduationCap } from 'lucide-react';

import type {
    WordInfo,
    DifficultWord,
    SubtitleRecord,
    WordSortType,
    VocabCategory,
    SortDirection,
    TagFilterKey,
} from './learning/types';
import {
    VOCAB_CATEGORIES,
    CEFR_ORDER,
    difficultyColors
} from './learning/types';
import { LearningFilterBar, exportWords } from './learning/LearningFilterBar';
import { LearningWordTable } from './learning/LearningWordTable';

// Re-export types for external use
export type { WordInfo, DifficultWord, SubtitleRecord };

interface LearningPanelProps {
    onClose: () => void;
}

const { ipcRenderer } = window.require('electron');

// Constants for infinite scroll
const BATCH_SIZE = 50;

// Hover card position state type
interface HoverCardState {
    word: DifficultWord;
    x: number;
    y: number;
}

// Global hover card manager for debounced display
function useWordHoverCard(delay: number = 400) {
    const [hoverState, setHoverState] = useState<HoverCardState | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const showTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingWordRef = useRef<HoverCardState | null>(null);

    const showCard = useCallback((word: DifficultWord, x: number, y: number) => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
        pendingWordRef.current = { word, x, y };
        if (isVisible && hoverState?.word.word === word.word) {
            setHoverState({ word, x, y });
            return;
        }
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
        }
        showTimerRef.current = setTimeout(() => {
            if (pendingWordRef.current) {
                setHoverState(pendingWordRef.current);
                setIsVisible(true);
            }
        }, delay);
    }, [delay, isVisible, hoverState]);

    const hideCard = useCallback(() => {
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
        pendingWordRef.current = null;
        hideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
            setHoverState(null);
        }, 150);
    }, []);

    const cancelHide = useCallback(() => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (showTimerRef.current) clearTimeout(showTimerRef.current);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);

    return { hoverState, isVisible, showCard, hideCard, cancelHide };
}

// Context for hover card management
const HoverCardContext = React.createContext<ReturnType<typeof useWordHoverCard> | null>(null);

// Word hover card content component
function WordHoverCardPopup({
    state,
    onMouseEnter,
    onMouseLeave
}: {
    state: HoverCardState;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}) {
    const colors = difficultyColors[state.word.difficulty];
    const info = state.word.info;
    const cardRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: state.x, y: state.y });

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

    useEffect(() => {
        if (!cardRef.current) return;
        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        const padding = 12;
        let newX = state.x + 12;
        let newY = state.y + 16;
        if (newX + rect.width > window.innerWidth - padding) newX = state.x - rect.width - 12;
        if (newX < padding) newX = padding;
        if (newY + rect.height > window.innerHeight - padding) newY = state.y - rect.height - 8;
        if (newY < padding) newY = padding;
        setPosition({ x: newX, y: newY });
    }, [state.x, state.y]);

    return createPortal(
        <div
            ref={cardRef}
            className="fixed z-[9999] w-[320px] bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ left: position.x, top: position.y }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className={`px-4 py-3 ${colors.bg} border-b ${colors.border}`}>
                <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mt-2`} />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900">{info.word}</h3>
                            {info.phonetic && <span className="text-xs text-gray-500">{info.phonetic}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            {info.pos && <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-white/60 rounded">{info.pos}</span>}
                            {info.cefrLevel && <span className={`px-1.5 py-0.5 text-[10px] font-medium ${colors.text} bg-white/60 rounded`}>{info.cefrLevel}</span>}
                            {info.collinsStar && info.collinsStar > 0 && <span className="text-[10px] text-amber-500">{'★'.repeat(Math.min(info.collinsStar, 5))}</span>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="px-4 py-3 max-h-[200px] overflow-y-auto">
                {info.definitionCn && <p className="text-sm text-gray-700 leading-relaxed mb-2">{info.definitionCn}</p>}
                {info.definitionEn && <p className="text-xs text-gray-500 leading-relaxed mb-2">{info.definitionEn}</p>}
                {examTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                        {examTags.map(tag => <span key={tag} className="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-100 rounded">{tag}</span>)}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

// Format time display
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Highlighted word with hover interaction
function HighlightedWord({ word, children }: { word: DifficultWord; children: React.ReactNode }) {
    const colors = difficultyColors[word.difficulty];
    const hoverContext = React.useContext(HoverCardContext);

    const handleMouseEnter = (e: React.MouseEvent) => {
        hoverContext?.showCard(word, e.clientX, e.clientY);
    };
    const handleMouseLeave = () => {
        hoverContext?.hideCard();
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (hoverContext?.isVisible && hoverContext?.hoverState?.word.word === word.word) {
            hoverContext?.showCard(word, e.clientX, e.clientY);
        }
    };

    return (
        <span
            className={`${colors.bg} ${colors.text} px-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity border-b-2 ${colors.border}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            {children}
        </span>
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
    const renderHighlightedText = (text: string) => {
        const wordPattern = /\b([a-zA-Z]+)\b/g;
        const parts: Array<{ type: 'text' | 'word'; content: string; wordInfo?: DifficultWord }> = [];
        let lastIndex = 0;
        let match;

        while ((match = wordPattern.exec(text)) !== null) {
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
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }

        return parts.map((part, index) => {
            if (part.type === 'word' && part.wordInfo) {
                return <HighlightedWord key={index} word={part.wordInfo}>{part.content}</HighlightedWord>;
            }
            return <span key={index}>{part.content}</span>;
        });
    };

    return (
        <div className="group px-6 py-3 hover:bg-gray-50/50 transition-colors">
            <div className="flex gap-4 items-start">
                <div className="text-[12px] font-mono tabular-nums min-w-[50px] pt-0.5 text-gray-400">{formatTime(subtitle.start)}</div>
                <div className="flex-1 space-y-1.5">
                    <div className="text-[15px] leading-[1.7] text-gray-700">{renderHighlightedText(subtitle.text)}</div>
                    {subtitle.translation && <div className="text-[13px] leading-[1.6] text-gray-400">{subtitle.translation}</div>}
                </div>
            </div>
        </div>
    );
}

export function LearningPanel({ onClose }: LearningPanelProps) {
    const [subtitleRecords, setSubtitleRecords] = useState<SubtitleRecord[]>([]);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [allWords, setAllWords] = useState<DifficultWord[]>([]);
    const [videoWords, setVideoWords] = useState<Map<string, DifficultWord>>(new Map());
    const [loading, setLoading] = useState(true);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showSubtitles, setShowSubtitles] = useState(false);
    const [dbStats, setDbStats] = useState<Record<string, number>>({});
    const [hasMore, setHasMore] = useState(true);

    const hoverCardManager = useWordHoverCard(400);

    const [vocabCategory, setVocabCategory] = useState<VocabCategory>('all');
    const [wordSortBy, setWordSortBy] = useState<WordSortType>('difficulty');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [activePopover, setActivePopover] = useState<string | null>(null);
    const [selectedTagFilters, setSelectedTagFilters] = useState<Set<TagFilterKey>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const selectedRecord = useMemo(() => {
        if (selectedRecordId === null) return null;
        return subtitleRecords.find(r => r.id === selectedRecordId) || null;
    }, [selectedRecordId, subtitleRecords]);

    const loadMoreWords = useCallback(async () => {
        if (loadingMore || !hasMore || selectedRecordId !== null) return;
        setLoadingMore(true);
        try {
            const response = await ipcRenderer.invoke('get-vocabulary', {
                category: vocabCategory,
                limit: BATCH_SIZE,
                offset: allWords.length
            });
            if (response.success) {
                const newWords = response.data as DifficultWord[];
                if (newWords.length < BATCH_SIZE) setHasMore(false);
                if (newWords.length > 0) setAllWords(prev => [...prev, ...newWords]);
            }
        } catch (error) {
            console.error('Failed to load more words:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, selectedRecordId, vocabCategory, allWords.length]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const statsResponse = await ipcRenderer.invoke('get-vocabulary-stats');
                if (statsResponse.success) setDbStats(statsResponse.data);

                const vocabResponse = await ipcRenderer.invoke('get-vocabulary', { category: 'all', limit: BATCH_SIZE, offset: 0 });
                if (vocabResponse.success) {
                    const words = vocabResponse.data as DifficultWord[];
                    setAllWords(words);
                    setHasMore(words.length >= BATCH_SIZE);
                }

                const subtitleResponse = await ipcRenderer.invoke('get-all-subtitles', { limit: 100 });
                if (subtitleResponse.success) setSubtitleRecords(subtitleResponse.data);
            } catch (error) {
                console.error('Failed to load initial data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        const loadVocabulary = async () => {
            if (selectedRecordId !== null) return;
            setLoading(true);
            try {
                const response = await ipcRenderer.invoke('get-vocabulary', { category: vocabCategory, limit: BATCH_SIZE, offset: 0 });
                if (response.success) {
                    const words = response.data as DifficultWord[];
                    setAllWords(words);
                    setHasMore(words.length >= BATCH_SIZE);
                }
            } catch (error) {
                console.error('Failed to load vocabulary:', error);
            } finally {
                setLoading(false);
            }
        };
        loadVocabulary();
    }, [vocabCategory, selectedRecordId]);

    const analyzeRecord = async (record: SubtitleRecord) => {
        setLoadingVideo(true);
        try {
            const fullText = record.subtitleData.map(s => s.text).join(' ');
            const response = await ipcRenderer.invoke('analyze-text-difficulty', fullText);
            if (response.success) {
                const wordMap = new Map<string, DifficultWord>();
                for (const item of response.data) {
                    wordMap.set(item.word, item);
                }
                setVideoWords(wordMap);
            }
        } catch (error) {
            console.error('Failed to analyze:', error);
        } finally {
            setLoadingVideo(false);
        }
    };

    const handleVideoSelect = (recordId: number | null) => {
        setSelectedRecordId(recordId);
        setActivePopover(null);
        if (recordId !== null) {
            const record = subtitleRecords.find(r => r.id === recordId);
            if (record) analyzeRecord(record);
        } else {
            setVideoWords(new Map());
            setShowSubtitles(false);
        }
    };

    const handleHeaderSort = useCallback((sortType: WordSortType) => {
        if (wordSortBy === sortType) {
            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setWordSortBy(sortType);
            setSortDirection('desc');
        }
    }, [wordSortBy]);

    const vocabStats = useMemo(() => {
        if (selectedRecordId !== null) {
            const stats: Record<string, number> = { all: 0 };
            VOCAB_CATEGORIES.forEach(cat => { if (cat.value !== 'all') stats[cat.value] = 0; });
            videoWords.forEach(word => {
                const info = word.info;
                stats.all++;
                if (info.isZk) stats.zk++;
                if (info.isGk) stats.gk++;
                if (info.isCet4) stats.cet4++;
                if (info.isCet6) stats.cet6++;
                if (info.isKy) stats.ky++;
                if (info.isToefl) stats.toefl++;
                if (info.isIelts) stats.ielts++;
                if (info.isGre) stats.gre++;
                if (info.isOxford3000) stats.oxford3000++;
            });
            return stats;
        }
        return dbStats;
    }, [selectedRecordId, videoWords, dbStats]);

    const currentWords = useMemo(() => {
        if (selectedRecordId !== null) return Array.from(videoWords.values());
        return allWords;
    }, [selectedRecordId, videoWords, allWords]);

    const filteredWords = useMemo(() => {
        let words = [...currentWords];

        // 搜索过滤：匹配单词、音标、释义
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            words = words.filter(w => {
                const word = w.word.toLowerCase();
                const phonetic = (w.info.phonetic || '').toLowerCase();
                const definitionCn = (w.info.definitionCn || '').toLowerCase();
                const definitionEn = (w.info.definitionEn || '').toLowerCase();
                return word.includes(query) ||
                       phonetic.includes(query) ||
                       definitionCn.includes(query) ||
                       definitionEn.includes(query);
            });
        }

        if (selectedRecordId !== null && vocabCategory !== 'all') {
            const categoryConfig = VOCAB_CATEGORIES.find(c => c.value === vocabCategory);
            if (categoryConfig && categoryConfig.key) {
                const key = categoryConfig.key as keyof WordInfo;
                words = words.filter(w => w.info[key] === true);
            }
        }

        if (selectedTagFilters.size > 0) {
            words = words.filter(w => {
                const info = w.info;
                for (const tagKey of selectedTagFilters) {
                    if (info[tagKey] === true) return true;
                }
                return false;
            });
        }

        words.sort((a, b) => {
            let result = 0;
            switch (wordSortBy) {
                case 'frequency':
                    const aRank = a.info.cocaRank || 999999;
                    const bRank = b.info.cocaRank || 999999;
                    result = bRank - aRank;
                    break;
                case 'difficulty':
                    const diffOrder = { high: 3, medium: 2, low: 1 };
                    result = diffOrder[b.difficulty] - diffOrder[a.difficulty];
                    break;
                case 'cefr':
                    const aCefr = CEFR_ORDER[a.info.cefrLevel?.toUpperCase() || ''] || 0;
                    const bCefr = CEFR_ORDER[b.info.cefrLevel?.toUpperCase() || ''] || 0;
                    result = bCefr - aCefr;
                    break;
                case 'alphabet':
                default:
                    result = a.word.localeCompare(b.word);
                    break;
            }
            return sortDirection === 'asc' ? -result : result;
        });

        return words;
    }, [currentWords, vocabCategory, wordSortBy, sortDirection, selectedRecordId, selectedTagFilters, searchQuery]);

    const filteredWordMap = useMemo(() => {
        const map = new Map<string, DifficultWord>();
        filteredWords.forEach(w => map.set(w.word, w));
        return map;
    }, [filteredWords]);

    return (
        <HoverCardContext.Provider value={hoverCardManager}>
            <div className="h-full bg-white rounded-xl flex flex-col">
                {/* Header */}
                <div className="flex-none px-4 py-3 flex items-center justify-between border-b border-zinc-100">
                    <span className="text-sm font-medium text-zinc-700">英语学习</span>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                        <X size={18} className="text-zinc-400" />
                    </button>
                </div>

                {/* Filter Bar */}
                <LearningFilterBar
                    subtitleRecords={subtitleRecords}
                    selectedRecordId={selectedRecordId}
                    selectedRecord={selectedRecord}
                    vocabCategory={vocabCategory}
                    vocabStats={vocabStats}
                    filteredWords={filteredWords}
                    hasMore={hasMore}
                    dbStats={dbStats}
                    showSubtitles={showSubtitles}
                    activePopover={activePopover}
                    searchQuery={searchQuery}
                    onVideoSelect={handleVideoSelect}
                    onVocabCategoryChange={setVocabCategory}
                    onExport={(format) => exportWords(filteredWords, format)}
                    onToggleSubtitles={() => setShowSubtitles(!showSubtitles)}
                    onActivePopoverChange={setActivePopover}
                    onSearchChange={setSearchQuery}
                />

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                            <span className="text-[13px] text-gray-400">加载词库数据...</span>
                        </div>
                    ) : loadingVideo ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                            <span className="text-[13px] text-gray-400">正在分析视频词汇...</span>
                        </div>
                    ) : filteredWords.length === 0 && allWords.length === 0 && selectedRecordId === null ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                            <BookOpen size={48} strokeWidth={1.5} />
                            <div className="text-center">
                                <p className="text-[15px] font-medium text-gray-500">词库为空</p>
                                <p className="text-[13px] mt-1">请检查词库数据库是否正确加载</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Word List */}
                            <div className="flex-1 overflow-hidden">
                                {filteredWords.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                                        <GraduationCap size={48} strokeWidth={1.5} />
                                        <div className="text-center">
                                            <p className="text-[15px] font-medium text-gray-500">没有符合条件的词汇</p>
                                            <p className="text-[13px] mt-1">尝试调整词库筛选条件</p>
                                        </div>
                                    </div>
                                ) : (
                                    <LearningWordTable
                                        words={filteredWords}
                                        hasMore={hasMore && selectedRecordId === null}
                                        loadingMore={loadingMore}
                                        onLoadMore={loadMoreWords}
                                        sortBy={wordSortBy}
                                        sortDirection={sortDirection}
                                        onSortChange={handleHeaderSort}
                                        selectedTagFilters={selectedTagFilters}
                                        onTagFiltersChange={setSelectedTagFilters}
                                    />
                                )}
                            </div>

                            {/* Subtitle Panel */}
                            {showSubtitles && selectedRecord && (
                                <div className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col bg-white">
                                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                        <span className="text-[12px] font-medium text-gray-600">字幕 ({selectedRecord.subtitleData.length})</span>
                                        <button onClick={() => setShowSubtitles(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                                            <X size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <div className="py-2">
                                            {selectedRecord.subtitleData.map((subtitle, index) => (
                                                <SubtitleItemWithHighlight key={index} subtitle={subtitle} difficultWords={filteredWordMap} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Hover Card */}
                {hoverCardManager.isVisible && hoverCardManager.hoverState && (
                    <WordHoverCardPopup
                        state={hoverCardManager.hoverState}
                        onMouseEnter={hoverCardManager.cancelHide}
                        onMouseLeave={hoverCardManager.hideCard}
                    />
                )}
            </div>
        </HoverCardContext.Provider>
    );
}
