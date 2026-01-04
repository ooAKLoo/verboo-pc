import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDownUp, ChevronDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import {
    DifficultWord,
    WordSortType,
    SortDirection,
    TableColumnSortKey,
    TagFilterKey,
    COLUMN_SORT_MAP,
    TAG_FILTER_OPTIONS,
    CEFR_STYLES,
    difficultyColors
} from './types';

/**
 * SortableHeader - 可排序表头组件
 */
function SortableHeader({
    label,
    columnKey,
    currentSort,
    sortDirection,
    onSort,
    className = '',
    align = 'left'
}: {
    label: string;
    columnKey: TableColumnSortKey;
    currentSort: WordSortType;
    sortDirection: SortDirection;
    onSort: (sortType: WordSortType) => void;
    className?: string;
    align?: 'left' | 'right';
}) {
    const sortType = COLUMN_SORT_MAP[columnKey];
    const isActive = currentSort === sortType;

    const handleClick = () => {
        onSort(sortType);
    };

    return (
        <div
            onClick={handleClick}
            className={`
                table-cell h-8 align-middle border-b border-zinc-200/60
                text-[11px] font-medium uppercase tracking-wider cursor-pointer
                select-none transition-colors duration-150
                ${isActive ? 'text-zinc-700 bg-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/30'}
                ${align === 'right' ? 'text-right' : ''}
                ${className}
            `}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                <span>{label}</span>
                <div className={`flex flex-col transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                    {isActive ? (
                        sortDirection === 'asc' ? (
                            <ArrowUp size={12} className="text-blue-500" />
                        ) : (
                            <ArrowDown size={12} className="text-blue-500" />
                        )
                    ) : (
                        <ArrowDownUp size={10} className="text-zinc-400" />
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * TagFilterHeader - 标签筛选表头（Excel风格）
 */
function TagFilterHeader({
    selectedTags,
    onTagsChange,
    className = ''
}: {
    selectedTags: Set<TagFilterKey>;
    onTagsChange: (tags: Set<TagFilterKey>) => void;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const hasFilter = selectedTags.size > 0;

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleToggleTag = (key: TagFilterKey) => {
        const newTags = new Set(selectedTags);
        if (newTags.has(key)) {
            newTags.delete(key);
        } else {
            newTags.add(key);
        }
        onTagsChange(newTags);
    };

    const handleSelectAll = () => {
        onTagsChange(new Set(TAG_FILTER_OPTIONS.map(o => o.key)));
    };

    const handleClearAll = () => {
        onTagsChange(new Set());
    };

    return (
        <div className={`table-cell h-8 align-middle border-b border-zinc-200/60 relative ${className}`} ref={popoverRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-1 cursor-pointer select-none
                    text-[11px] font-medium uppercase tracking-wider
                    transition-colors duration-150
                    ${hasFilter ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}
                `}
            >
                <span>标签</span>
                <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                {hasFilter && (
                    <span className="ml-0.5 px-1 py-0.5 text-[9px] bg-blue-100 text-blue-600 rounded">
                        {selectedTags.size}
                    </span>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-white rounded-lg border border-zinc-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 bg-zinc-50">
                        <span className="text-[11px] text-zinc-500 font-medium">筛选标签</span>
                        <div className="flex items-center gap-2">
                            <button onClick={handleSelectAll} className="text-[10px] text-blue-500 hover:text-blue-600">全选</button>
                            <span className="text-zinc-300">|</span>
                            <button onClick={handleClearAll} className="text-[10px] text-zinc-400 hover:text-zinc-600">清空</button>
                        </div>
                    </div>
                    <div className="py-1 max-h-[280px] overflow-y-auto">
                        {TAG_FILTER_OPTIONS.map(option => {
                            const isChecked = selectedTags.has(option.key);
                            return (
                                <label
                                    key={option.key}
                                    className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-50 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleTag(option.key)}
                                        className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                    />
                                    <span className={`text-[12px] ${isChecked ? 'text-zinc-700' : 'text-zinc-500'}`}>
                                        {option.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * WordListItem - 单词列表项组件
 */
function WordListItem({ word }: { word: DifficultWord }) {
    const colors = difficultyColors[word.difficulty];
    const info = word.info;
    const cefrLevel = info.cefrLevel?.toUpperCase() || '';
    const cefrStyle = CEFR_STYLES[cefrLevel] || { bg: 'bg-zinc-100', text: 'text-zinc-500' };

    const vocabTags: string[] = [];
    if (info.isGk) vocabTags.push('高考');
    if (info.isZk) vocabTags.push('中考');
    if (info.isCet4) vocabTags.push('CET4');
    if (info.isCet6) vocabTags.push('CET6');
    if (info.isKy) vocabTags.push('考研');
    if (info.isToefl) vocabTags.push('TOEFL');
    if (info.isIelts) vocabTags.push('IELTS');
    if (info.isGre) vocabTags.push('GRE');

    return (
        <div className="group table-row hover:bg-zinc-50/50 transition-colors">
            <div className="table-cell h-9 align-middle border-b border-zinc-100 pl-6 pr-3 w-[120px]">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} flex-shrink-0`} />
                    <span className={`text-[13px] font-medium ${colors.text} truncate`}>{word.word}</span>
                </div>
            </div>
            <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3 w-[100px]">
                <span className="text-[12px] text-zinc-400 truncate block">{info.phonetic || '-'}</span>
            </div>
            <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3">
                <span className="text-[13px] text-zinc-600 truncate block">{info.definitionCn || info.definitionEn || '-'}</span>
            </div>
            <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3 w-[120px]">
                <div className="flex items-center gap-1">
                    {vocabTags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-zinc-100 text-zinc-500 rounded flex-shrink-0">{tag}</span>
                    ))}
                    {vocabTags.length > 2 && (
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">+{vocabTags.length - 2}</span>
                    )}
                </div>
            </div>
            <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3 text-right w-[70px]">
                <span className="text-[11px] text-zinc-400 tabular-nums">{info.cocaRank ? `#${info.cocaRank}` : '-'}</span>
            </div>
            <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-6 w-[50px]">
                {cefrLevel ? (
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${cefrStyle.bg} ${cefrStyle.text}`}>{cefrLevel}</span>
                ) : (
                    <span className="text-[11px] text-zinc-300">-</span>
                )}
            </div>
        </div>
    );
}

export interface LearningWordTableProps {
    words: DifficultWord[];
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    sortBy: WordSortType;
    sortDirection: SortDirection;
    onSortChange: (sortType: WordSortType) => void;
    selectedTagFilters: Set<TagFilterKey>;
    onTagFiltersChange: (tags: Set<TagFilterKey>) => void;
}

export function LearningWordTable({
    words,
    hasMore,
    loadingMore,
    onLoadMore,
    sortBy,
    sortDirection,
    onSortChange,
    selectedTagFilters,
    onTagFiltersChange
}: LearningWordTableProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (scrollBottom < 300 && hasMore && !loadingMore) {
            onLoadMore();
        }
    }, [hasMore, loadingMore, onLoadMore]);

    return (
        <div ref={containerRef} className="h-full overflow-auto" onScroll={handleScroll}>
            <div className="table w-full table-fixed">
                <div className="table-row sticky top-0 z-10 bg-zinc-50/95 backdrop-blur-sm group">
                    <SortableHeader
                        label="单词"
                        columnKey="word"
                        currentSort={sortBy}
                        sortDirection={sortDirection}
                        onSort={onSortChange}
                        className="pl-6 pr-3 w-[120px]"
                    />
                    <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider w-[100px]">
                        音标
                    </div>
                    <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                        释义
                    </div>
                    <TagFilterHeader
                        selectedTags={selectedTagFilters}
                        onTagsChange={onTagFiltersChange}
                        className="pr-3 w-[120px]"
                    />
                    <SortableHeader
                        label="词频"
                        columnKey="frequency"
                        currentSort={sortBy}
                        sortDirection={sortDirection}
                        onSort={onSortChange}
                        className="pr-3 w-[70px]"
                        align="right"
                    />
                    <SortableHeader
                        label="CEFR"
                        columnKey="cefr"
                        currentSort={sortBy}
                        sortDirection={sortDirection}
                        onSort={onSortChange}
                        className="pr-6 w-[50px]"
                    />
                </div>
                {words.map((word) => (
                    <WordListItem key={word.word} word={word} />
                ))}
            </div>
            {hasMore && (
                <div className="flex items-center justify-center py-6 border-t border-zinc-100">
                    {loadingMore ? (
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="text-[12px]">加载更多...</span>
                        </div>
                    ) : (
                        <span className="text-[12px] text-zinc-400">滚动加载更多</span>
                    )}
                </div>
            )}
            {!hasMore && words.length > 0 && (
                <div className="flex items-center justify-center py-4 border-t border-zinc-100">
                    <span className="text-[12px] text-zinc-400">已加载全部 {words.length} 个词汇</span>
                </div>
            )}
        </div>
    );
}
