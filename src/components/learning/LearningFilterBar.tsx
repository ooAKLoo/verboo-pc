import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, GraduationCap, Video, FileText, Download, FileDown, Printer } from 'lucide-react';
import {
    DifficultWord,
    SubtitleRecord,
    VocabCategory,
    VOCAB_CATEGORIES
} from './types';

// Export format options
const EXPORT_FORMATS = [
    { id: 'anki', label: 'Anki', desc: '支持 Anki 导入的 TSV 格式', icon: FileDown, extension: 'txt' },
    { id: 'momo', label: '墨墨背单词', desc: 'CSV 格式，可直接导入', icon: FileDown, extension: 'csv' },
    { id: 'eudic', label: '欧路词典', desc: 'CSV 格式生词本', icon: FileDown, extension: 'csv' },
    { id: 'quizlet', label: 'Quizlet', desc: 'Tab 分隔的文本格式', icon: FileDown, extension: 'txt' },
    { id: 'csv', label: '通用 CSV', desc: '适用于大多数背单词软件', icon: FileDown, extension: 'csv' },
    { id: 'print', label: '打印背诵纸', desc: 'HTML 格式，可打印为 PDF', icon: Printer, extension: 'html' },
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
 * VocabCategorySelector - 词库分类选择器
 */
function VocabCategorySelector({
    selected,
    vocabStats,
    onChange
}: {
    selected: string;
    vocabStats: Record<string, number>;
    onChange: (value: string) => void;
}) {
    return (
        <div className="p-2 min-w-[200px] max-h-[320px] overflow-y-auto">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">词库分类</div>
            <div className="space-y-0.5">
                {VOCAB_CATEGORIES.map(category => {
                    const isSelected = selected === category.value;
                    const count = vocabStats[category.value] || 0;
                    return (
                        <button
                            key={category.value}
                            onClick={() => onChange(category.value)}
                            className={`
                                w-full flex items-center justify-between px-3 py-2 rounded-lg text-left
                                transition-all duration-150
                                ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'}
                            `}
                        >
                            <span className="text-sm font-medium">{category.label}</span>
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
 * VideoSelector - 数据来源选择器（仅视频）
 */
function VideoSelector({
    records,
    selectedId,
    onChange
}: {
    records: SubtitleRecord[];
    selectedId: number | null;
    onChange: (id: number | null) => void;
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
            <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-xs font-medium text-zinc-500">视频字幕</span>
                {selectedId !== null && (
                    <button onClick={() => onChange(null)} className="text-[10px] text-zinc-400 hover:text-zinc-600">
                        清除
                    </button>
                )}
            </div>
            <div className="space-y-0.5">
                {records.length === 0 ? (
                    <div className="px-3 py-4 text-center text-zinc-400">
                        <Video size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">暂无视频字幕</p>
                    </div>
                ) : (
                    records.map(record => {
                        const isSelected = selectedId === record.id;
                        return (
                            <button
                                key={record.id}
                                onClick={() => onChange(record.id)}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                                    transition-all duration-150
                                    ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-zinc-50 text-zinc-700'}
                                `}
                            >
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <Video size={14} className="text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{record.videoTitle || '未命名视频'}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-zinc-400">{getPlatformName(record.platform)}</span>
                                        <span className="text-xs text-zinc-300">·</span>
                                        <span className="text-xs text-zinc-400">{record.subtitleData.length} 条</span>
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
                    })
                )}
            </div>
        </div>
    );
}

/**
 * ExportMenu - 导出菜单组件
 */
function ExportMenu({
    words,
    onExport
}: {
    words: DifficultWord[];
    onExport: (format: string) => void;
}) {
    return (
        <div className="p-2 min-w-[220px]">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">导出格式</div>
            <div className="space-y-0.5">
                {EXPORT_FORMATS.map(format => {
                    const IconComponent = format.icon;
                    return (
                        <button
                            key={format.id}
                            onClick={() => onExport(format.id)}
                            disabled={words.length === 0}
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
                <span className="text-[10px] text-zinc-400">将导出 {words.length} 个词汇</span>
            </div>
        </div>
    );
}

// Export utility functions
export function exportWords(words: DifficultWord[], format: string) {
    let content = '';
    let filename = `vocabulary_${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';

    switch (format) {
        case 'anki':
            content = words.map(w => {
                const front = w.word;
                const back = [w.info.phonetic || '', w.info.definitionCn || w.info.definitionEn || ''].filter(Boolean).join('\n');
                return `${front}\t${back}`;
            }).join('\n');
            filename += '_anki.txt';
            break;
        case 'momo':
            content = words.map(w => w.word).join('\n');
            filename += '_momo.csv';
            mimeType = 'text/csv';
            break;
        case 'eudic':
            content = 'word,phonetic,definition\n';
            content += words.map(w => {
                const word = w.word;
                const phonetic = (w.info.phonetic || '').replace(/"/g, '""');
                const definition = (w.info.definitionCn || w.info.definitionEn || '').replace(/"/g, '""');
                return `"${word}","${phonetic}","${definition}"`;
            }).join('\n');
            filename += '_eudic.csv';
            mimeType = 'text/csv';
            break;
        case 'quizlet':
            content = words.map(w => `${w.word}\t${w.info.definitionCn || w.info.definitionEn || ''}`).join('\n');
            filename += '_quizlet.txt';
            break;
        case 'csv':
            content = 'word,phonetic,pos,definition_cn,definition_en,cefr,coca_rank\n';
            content += words.map(w => {
                const cols = [
                    w.word,
                    (w.info.phonetic || '').replace(/"/g, '""'),
                    w.info.pos || '',
                    (w.info.definitionCn || '').replace(/"/g, '""'),
                    (w.info.definitionEn || '').replace(/"/g, '""'),
                    w.info.cefrLevel || '',
                    w.info.cocaRank?.toString() || ''
                ];
                return cols.map(c => `"${c}"`).join(',');
            }).join('\n');
            filename += '.csv';
            mimeType = 'text/csv';
            break;
        case 'print':
            content = generatePrintHTML(words);
            filename += '_print.html';
            mimeType = 'text/html';
            break;
        default:
            return;
    }

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

function generatePrintHTML(words: DifficultWord[]): string {
    const wordsPerPage = 30;
    const pages: DifficultWord[][] = [];
    for (let i = 0; i < words.length; i += wordsPerPage) {
        pages.push(words.slice(i, i + wordsPerPage));
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>词汇背诵纸</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .page { page-break-after: always; padding: 20mm; }
        .page:last-child { page-break-after: auto; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #333; }
        .header h1 { font-size: 18px; font-weight: 600; }
        .header p { font-size: 12px; color: #666; margin-top: 5px; }
        .word-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .word-item { display: flex; border: 1px solid #e5e5e5; border-radius: 4px; padding: 8px 12px; font-size: 13px; }
        .word-left { flex: 1; }
        .word-text { font-weight: 600; color: #1a1a1a; }
        .word-phonetic { font-size: 11px; color: #888; margin-top: 2px; }
        .word-right { flex: 1.5; font-size: 12px; color: #444; line-height: 1.4; }
        .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
        @media print { .page { padding: 15mm; } .word-item { break-inside: avoid; } }
    </style>
</head>
<body>
${pages.map((pageWords, pageIndex) => `
    <div class="page">
        <div class="header">
            <h1>词汇背诵纸</h1>
            <p>共 ${words.length} 词 · 第 ${pageIndex + 1}/${pages.length} 页 · ${new Date().toLocaleDateString('zh-CN')}</p>
        </div>
        <div class="word-grid">
            ${pageWords.map(w => `
                <div class="word-item">
                    <div class="word-left">
                        <div class="word-text">${w.word}</div>
                        ${w.info.phonetic ? `<div class="word-phonetic">${w.info.phonetic}</div>` : ''}
                    </div>
                    <div class="word-right">${w.info.definitionCn || w.info.definitionEn || ''}</div>
                </div>
            `).join('')}
        </div>
        <div class="footer">Generated by Verboo</div>
    </div>
`).join('')}
</body>
</html>`;
}

export interface LearningFilterBarProps {
    subtitleRecords: SubtitleRecord[];
    selectedRecordId: number | null;
    selectedRecord: SubtitleRecord | null;
    vocabCategory: VocabCategory;
    vocabStats: Record<string, number>;
    filteredWords: DifficultWord[];
    hasMore: boolean;
    dbStats: Record<string, number>;
    showSubtitles: boolean;
    activePopover: string | null;
    onVideoSelect: (id: number | null) => void;
    onVocabCategoryChange: (category: VocabCategory) => void;
    onExport: (format: string) => void;
    onToggleSubtitles: () => void;
    onActivePopoverChange: (popover: string | null) => void;
}

export function LearningFilterBar({
    subtitleRecords,
    selectedRecordId,
    selectedRecord,
    vocabCategory,
    vocabStats,
    filteredWords,
    hasMore,
    dbStats,
    showSubtitles,
    activePopover,
    onVideoSelect,
    onVocabCategoryChange,
    onExport,
    onToggleSubtitles,
    onActivePopoverChange
}: LearningFilterBarProps) {
    return (
        <div className="flex-none px-8 py-3 flex items-center gap-3">
            {/* 数据来源选择器 */}
            <FilterPopover
                trigger={
                    <FilterTrigger
                        icon={<Video size={13} />}
                        label={
                            selectedRecord
                                ? (selectedRecord.videoTitle?.slice(0, 10) + (selectedRecord.videoTitle && selectedRecord.videoTitle.length > 10 ? '...' : '')) || '视频'
                                : '数据来源'
                        }
                        isActive={activePopover === 'video'}
                        hasSelection={selectedRecordId !== null}
                        onClick={() => onActivePopoverChange(activePopover === 'video' ? null : 'video')}
                    />
                }
                isOpen={activePopover === 'video'}
                onClose={() => onActivePopoverChange(null)}
            >
                <VideoSelector
                    records={subtitleRecords}
                    selectedId={selectedRecordId}
                    onChange={onVideoSelect}
                />
            </FilterPopover>

            <div className="w-px h-5 bg-zinc-100 mx-1 flex-none" />

            {/* Vocab Category Filter */}
            <FilterPopover
                trigger={
                    <FilterTrigger
                        icon={<GraduationCap size={13} />}
                        label={vocabCategory === 'all' ? '词库' : VOCAB_CATEGORIES.find(c => c.value === vocabCategory)?.label || '词库'}
                        isActive={activePopover === 'vocab'}
                        hasSelection={vocabCategory !== 'all'}
                        onClick={() => onActivePopoverChange(activePopover === 'vocab' ? null : 'vocab')}
                    />
                }
                isOpen={activePopover === 'vocab'}
                onClose={() => onActivePopoverChange(null)}
            >
                <VocabCategorySelector
                    selected={vocabCategory}
                    vocabStats={vocabStats}
                    onChange={(value) => {
                        onVocabCategoryChange(value as VocabCategory);
                        onActivePopoverChange(null);
                    }}
                />
            </FilterPopover>

            {/* Export Button */}
            <FilterPopover
                trigger={
                    <FilterTrigger
                        icon={<Download size={13} />}
                        label="导出"
                        isActive={activePopover === 'export'}
                        hasSelection={false}
                        onClick={() => onActivePopoverChange(activePopover === 'export' ? null : 'export')}
                    />
                }
                isOpen={activePopover === 'export'}
                onClose={() => onActivePopoverChange(null)}
            >
                <ExportMenu
                    words={filteredWords}
                    onExport={(format) => {
                        onExport(format);
                        onActivePopoverChange(null);
                    }}
                />
            </FilterPopover>

            {/* Show Subtitles Toggle */}
            {selectedRecord && (
                <>
                    <div className="w-px h-5 bg-zinc-100 mx-1 flex-none" />
                    <button
                        onClick={onToggleSubtitles}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                            transition-all duration-200
                            ${showSubtitles
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                            }
                        `}
                    >
                        <FileText size={13} />
                        <span>字幕</span>
                        {showSubtitles ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                </>
            )}

            <div className="flex-1" />

            {/* Word Count */}
            <span className="text-[12px] text-zinc-400 flex-none">
                {selectedRecordId === null && hasMore
                    ? `${filteredWords.length}+ 个词汇`
                    : `${filteredWords.length} 个词汇`
                }
                {selectedRecordId === null && dbStats[vocabCategory] && (
                    <span className="text-zinc-300 ml-1">/ {dbStats[vocabCategory]}</span>
                )}
            </span>
        </div>
    );
}
