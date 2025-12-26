import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';
import { BookOpen, X, ArrowDownUp, ChevronDown, GraduationCap, Video, FileText, ChevronUp, ArrowUp, ArrowDown, Loader2, Download, FileDown, Printer } from 'lucide-react';

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

type WordSortType = 'frequency' | 'difficulty' | 'alphabet';
type VocabCategory = 'all' | 'zk' | 'gk' | 'cet4' | 'cet6' | 'ky' | 'toefl' | 'ielts' | 'gre' | 'oxford3000';
type SortDirection = 'asc' | 'desc';

const { ipcRenderer } = window.require('electron');

// Sort options for word view
const WORD_SORT_OPTIONS = [
    { value: 'frequency', label: '词频排序', desc: '按COCA词频从低到高' },
    { value: 'difficulty', label: '难度排序', desc: '按难度从高到低' },
    { value: 'alphabet', label: '字母排序', desc: '按字母A-Z顺序' },
];

// Vocabulary category options
const VOCAB_CATEGORIES = [
    { value: 'all', label: '全部词汇', key: null },
    { value: 'zk', label: '中考', key: 'isZk' },
    { value: 'gk', label: '高考', key: 'isGk' },
    { value: 'cet4', label: 'CET-4', key: 'isCet4' },
    { value: 'cet6', label: 'CET-6', key: 'isCet6' },
    { value: 'ky', label: '考研', key: 'isKy' },
    { value: 'toefl', label: 'TOEFL', key: 'isToefl' },
    { value: 'ielts', label: 'IELTS', key: 'isIelts' },
    { value: 'gre', label: 'GRE', key: 'isGre' },
    { value: 'oxford3000', label: 'Oxford 3000', key: 'isOxford3000' },
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
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[180px] bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
    onChange
}: {
    options: Array<{ value: string; label: string; desc: string }>;
    selected: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="p-2 min-w-[180px]">
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">排序方式</div>
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
                                <div className="text-sm font-medium">{option.label}</div>
                                <div className="text-xs text-zinc-400">{option.desc}</div>
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
                                ${isSelected
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'hover:bg-zinc-50 text-zinc-700'
                                }
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
 * VideoSelector - 视频字幕选择器
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
            <div className="text-xs font-medium text-zinc-500 px-2 mb-2">数据来源</div>
            <div className="space-y-0.5">
                {/* All vocabulary option */}
                <button
                    onClick={() => onChange(null)}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                        transition-all duration-150
                        ${selectedId === null
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-zinc-50 text-zinc-700'
                        }
                    `}
                >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">全部词库</div>
                        <div className="text-xs text-zinc-400">浏览词汇数据库</div>
                    </div>
                    {selectedId === null && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-none">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                </button>

                {records.length > 0 && (
                    <>
                        <div className="text-xs font-medium text-zinc-500 px-2 mt-3 mb-2">视频字幕</div>
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
                    </>
                )}
            </div>
        </div>
    );
}

// Export format options
const EXPORT_FORMATS = [
    {
        id: 'anki',
        label: 'Anki',
        desc: '支持 Anki 导入的 TSV 格式',
        icon: FileDown,
        extension: 'txt'
    },
    {
        id: 'momo',
        label: '墨墨背单词',
        desc: 'CSV 格式，可直接导入',
        icon: FileDown,
        extension: 'csv'
    },
    {
        id: 'eudic',
        label: '欧路词典',
        desc: 'CSV 格式生词本',
        icon: FileDown,
        extension: 'csv'
    },
    {
        id: 'quizlet',
        label: 'Quizlet',
        desc: 'Tab 分隔的文本格式',
        icon: FileDown,
        extension: 'txt'
    },
    {
        id: 'csv',
        label: '通用 CSV',
        desc: '适用于大多数背单词软件',
        icon: FileDown,
        extension: 'csv'
    },
    {
        id: 'print',
        label: '打印背诵纸',
        desc: 'HTML 格式，可打印为 PDF',
        icon: Printer,
        extension: 'html'
    },
];

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
                <span className="text-[10px] text-zinc-400">
                    将导出 {words.length} 个词汇
                </span>
            </div>
        </div>
    );
}

// Export utility functions
function exportWords(words: DifficultWord[], format: string) {
    let content = '';
    let filename = `vocabulary_${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';

    switch (format) {
        case 'anki':
            // Anki TSV format: front \t back
            content = words.map(w => {
                const front = w.word;
                const back = [
                    w.info.phonetic || '',
                    w.info.definitionCn || w.info.definitionEn || ''
                ].filter(Boolean).join('\n');
                return `${front}\t${back}`;
            }).join('\n');
            filename += '_anki.txt';
            break;

        case 'momo':
            // 墨墨背单词 CSV: 单词
            content = words.map(w => w.word).join('\n');
            filename += '_momo.csv';
            mimeType = 'text/csv';
            break;

        case 'eudic':
            // 欧路词典 CSV: 单词,音标,释义
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
            // Quizlet: term \t definition
            content = words.map(w => {
                const term = w.word;
                const definition = w.info.definitionCn || w.info.definitionEn || '';
                return `${term}\t${definition}`;
            }).join('\n');
            filename += '_quizlet.txt';
            break;

        case 'csv':
            // 通用 CSV 格式
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
            // 打印背诵纸 HTML
            content = generatePrintHTML(words);
            filename += '_print.html';
            mimeType = 'text/html';
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

// Generate printable HTML for vocabulary study
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
        .word-item {
            display: flex;
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 13px;
        }
        .word-left { flex: 1; }
        .word-text { font-weight: 600; color: #1a1a1a; }
        .word-phonetic { font-size: 11px; color: #888; margin-top: 2px; }
        .word-right { flex: 1.5; font-size: 12px; color: #444; line-height: 1.4; }
        .word-blank { flex: 1.5; border-bottom: 1px dotted #ccc; min-height: 20px; }
        .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
        @media print {
            .page { padding: 15mm; }
            .word-item { break-inside: avoid; }
        }
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

/**
 * WordListItem - 单词列表项组件（Notion/Linear 风格）
 */
function WordListItem({ word }: { word: DifficultWord }) {
    const colors = difficultyColors[word.difficulty];
    const info = word.info;

    // Get vocabulary tags
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
        <HoverCard.Root openDelay={200} closeDelay={100}>
            <HoverCard.Trigger asChild>
                <div className="group table-row cursor-pointer hover:bg-zinc-50/50 transition-colors">
                    {/* Word */}
                    <div className="table-cell h-9 align-middle border-b border-zinc-100 pl-6 pr-3">
                        <div className="flex items-center gap-2 w-[120px]">
                            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} flex-shrink-0`} />
                            <span className={`text-[13px] font-medium ${colors.text} truncate`}>
                                {word.word}
                            </span>
                        </div>
                    </div>

                    {/* Phonetic */}
                    <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3">
                        <span className="text-[12px] text-zinc-400 truncate block w-[100px]">
                            {info.phonetic || '-'}
                        </span>
                    </div>

                    {/* Definition */}
                    <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3 max-w-0 w-full">
                        <span className="text-[13px] text-zinc-600 truncate block">
                            {info.definitionCn || info.definitionEn || '-'}
                        </span>
                    </div>

                    {/* Tags */}
                    <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                            {vocabTags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-zinc-100 text-zinc-500 rounded flex-shrink-0">
                                    {tag}
                                </span>
                            ))}
                            {vocabTags.length > 2 && (
                                <span className="text-[10px] text-zinc-400 flex-shrink-0">+{vocabTags.length - 2}</span>
                            )}
                        </div>
                    </div>

                    {/* COCA Rank */}
                    <div className="table-cell h-9 align-middle border-b border-zinc-100 pr-6 text-right whitespace-nowrap">
                        <span className="text-[11px] text-zinc-400 tabular-nums">
                            {info.cocaRank ? `#${info.cocaRank}` : '-'}
                        </span>
                    </div>
                </div>
            </HoverCard.Trigger>
            <HoverCard.Portal>
                <WordHoverContent word={word} />
            </HoverCard.Portal>
        </HoverCard.Root>
    );
}

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

// Constants for infinite scroll
const BATCH_SIZE = 50; // Number of words to load per batch

export function LearningPanel({ onClose }: LearningPanelProps) {
    const [subtitleRecords, setSubtitleRecords] = useState<SubtitleRecord[]>([]);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [allWords, setAllWords] = useState<DifficultWord[]>([]); // All words from database
    const [videoWords, setVideoWords] = useState<Map<string, DifficultWord>>(new Map()); // Words from selected video
    const [loading, setLoading] = useState(true);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false); // Loading more words
    const [showSubtitles, setShowSubtitles] = useState(false);
    const [dbStats, setDbStats] = useState<Record<string, number>>({});
    const [hasMore, setHasMore] = useState(true); // Whether there are more words to load

    // Filter states
    const [vocabCategory, setVocabCategory] = useState<VocabCategory>('all');
    const [wordSortBy, setWordSortBy] = useState<WordSortType>('difficulty');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [activePopover, setActivePopover] = useState<string | null>(null);


    // Get selected record
    const selectedRecord = useMemo(() => {
        if (!selectedRecordId) return null;
        return subtitleRecords.find(r => r.id === selectedRecordId) || null;
    }, [selectedRecordId, subtitleRecords]);

    // Load more words from database (infinite scroll)
    const loadMoreWords = useCallback(async () => {
        if (loadingMore || !hasMore || selectedRecordId) return;

        setLoadingMore(true);
        try {
            const response = await ipcRenderer.invoke('get-vocabulary', {
                category: vocabCategory,
                limit: BATCH_SIZE,
                offset: allWords.length
            });
            if (response.success) {
                const newWords = response.data as DifficultWord[];
                if (newWords.length < BATCH_SIZE) {
                    setHasMore(false);
                }
                if (newWords.length > 0) {
                    setAllWords(prev => [...prev, ...newWords]);
                }
            }
        } catch (error) {
            console.error('Failed to load more words:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, selectedRecordId, vocabCategory, allWords.length]);

    // Load vocabulary database and subtitle records on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);

                // Load vocabulary stats
                const statsResponse = await ipcRenderer.invoke('get-vocabulary-stats');
                if (statsResponse.success) {
                    setDbStats(statsResponse.data);
                }

                // Load initial vocabulary from database (category: all)
                const vocabResponse = await ipcRenderer.invoke('get-vocabulary', {
                    category: 'all',
                    limit: BATCH_SIZE,
                    offset: 0
                });
                if (vocabResponse.success) {
                    const words = vocabResponse.data as DifficultWord[];
                    setAllWords(words);
                    setHasMore(words.length >= BATCH_SIZE);
                }

                // Load subtitle records
                const subtitleResponse = await ipcRenderer.invoke('get-all-subtitles', { limit: 100 });
                if (subtitleResponse.success) {
                    setSubtitleRecords(subtitleResponse.data);
                }
            } catch (error) {
                console.error('Failed to load initial data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Load vocabulary when category changes - reset and load fresh
    useEffect(() => {
        const loadVocabulary = async () => {
            // Only load from database if no video is selected
            if (selectedRecordId) return;

            setLoading(true);
            try {
                const response = await ipcRenderer.invoke('get-vocabulary', {
                    category: vocabCategory,
                    limit: BATCH_SIZE,
                    offset: 0
                });
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

    // Analyze a subtitle record to get video-specific words
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

    // Handle video selection change
    const handleVideoSelect = (recordId: number | null) => {
        setSelectedRecordId(recordId);
        setActivePopover(null);

        if (recordId) {
            const record = subtitleRecords.find(r => r.id === recordId);
            if (record) {
                analyzeRecord(record);
            }
        } else {
            // Clearing video selection - reload database words
            setVideoWords(new Map());
            setShowSubtitles(false);
        }
    };

    // Calculate vocabulary category stats
    // Use database stats when no video selected, calculate from video words when video selected
    const vocabStats = useMemo(() => {
        if (selectedRecordId) {
            // Calculate stats from video words
            const stats: Record<string, number> = { all: 0 };
            VOCAB_CATEGORIES.forEach(cat => {
                if (cat.value !== 'all') stats[cat.value] = 0;
            });

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
        } else {
            // Use database stats
            return dbStats;
        }
    }, [selectedRecordId, videoWords, dbStats]);

    // Get the current word source: video words if video selected, database words otherwise
    const currentWords = useMemo(() => {
        if (selectedRecordId) {
            return Array.from(videoWords.values());
        }
        return allWords;
    }, [selectedRecordId, videoWords, allWords]);

    // Filter and sort words based on category and sort settings
    const filteredWords = useMemo(() => {
        let words = [...currentWords];

        // Apply vocabulary category filter (only when video is selected, database already filters)
        if (selectedRecordId && vocabCategory !== 'all') {
            const categoryConfig = VOCAB_CATEGORIES.find(c => c.value === vocabCategory);
            if (categoryConfig && categoryConfig.key) {
                const key = categoryConfig.key as keyof WordInfo;
                words = words.filter(w => w.info[key] === true);
            }
        }

        // Apply sort
        words.sort((a, b) => {
            let result = 0;
            if (wordSortBy === 'frequency') {
                // Lower COCA rank = more common word
                const aRank = a.info.cocaRank || 999999;
                const bRank = b.info.cocaRank || 999999;
                result = bRank - aRank; // Default: rare words (high rank) first
            } else if (wordSortBy === 'difficulty') {
                // Sort by difficulty level: high > medium > low
                const diffOrder = { high: 3, medium: 2, low: 1 };
                result = diffOrder[b.difficulty] - diffOrder[a.difficulty];
            } else {
                // Alphabetical
                result = a.word.localeCompare(b.word);
            }
            // Apply sort direction
            return sortDirection === 'asc' ? -result : result;
        });

        return words;
    }, [currentWords, vocabCategory, wordSortBy, sortDirection, selectedRecordId]);

    // Create a filtered word map for subtitle highlighting
    const filteredWordMap = useMemo(() => {
        const map = new Map<string, DifficultWord>();
        filteredWords.forEach(w => map.set(w.word, w));
        return map;
    }, [filteredWords]);

    return (
        <div className="h-full bg-white rounded-xl flex flex-col">

            {/* Filter Bar */}
            <div className="flex-none px-8 py-3 flex items-center gap-3">
                {/* Video Selector */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={selectedRecord ? <Video size={13} /> : <BookOpen size={13} />}
                            label={selectedRecord
                                ? (selectedRecord.videoTitle?.slice(0, 10) + (selectedRecord.videoTitle && selectedRecord.videoTitle.length > 10 ? '...' : '')) || '视频'
                                : '全部词库'}
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

                {/* Word Sort */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<ArrowDownUp size={13} />}
                            label={WORD_SORT_OPTIONS.find(o => o.value === wordSortBy)?.label || '排序'}
                            isActive={activePopover === 'sort'}
                            hasSelection={false}
                            onClick={() => setActivePopover(activePopover === 'sort' ? null : 'sort')}
                        />
                    }
                    isOpen={activePopover === 'sort'}
                    onClose={() => setActivePopover(null)}
                >
                    <SortSelector
                        options={WORD_SORT_OPTIONS}
                        selected={wordSortBy}
                        onChange={(value) => {
                            setWordSortBy(value as WordSortType);
                            setActivePopover(null);
                        }}
                    />
                </FilterPopover>

                {/* Sort Direction Toggle */}
                <button
                    onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                    className={`
                        flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium
                        transition-all duration-200
                        text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700
                    `}
                    title={sortDirection === 'desc' ? '降序（点击切换为升序）' : '升序（点击切换为降序）'}
                >
                    {sortDirection === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>

                {/* Vocab Category Filter */}
                <FilterPopover
                    trigger={
                        <FilterTrigger
                            icon={<GraduationCap size={13} />}
                            label={vocabCategory === 'all' ? '词库' : VOCAB_CATEGORIES.find(c => c.value === vocabCategory)?.label || '词库'}
                            isActive={activePopover === 'vocab'}
                            hasSelection={vocabCategory !== 'all'}
                            onClick={() => setActivePopover(activePopover === 'vocab' ? null : 'vocab')}
                        />
                    }
                    isOpen={activePopover === 'vocab'}
                    onClose={() => setActivePopover(null)}
                >
                    <VocabCategorySelector
                        selected={vocabCategory}
                        vocabStats={vocabStats}
                        onChange={(value) => {
                            setVocabCategory(value as VocabCategory);
                            setActivePopover(null);
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
                            onClick={() => setActivePopover(activePopover === 'export' ? null : 'export')}
                        />
                    }
                    isOpen={activePopover === 'export'}
                    onClose={() => setActivePopover(null)}
                >
                    <ExportMenu
                        words={filteredWords}
                        onExport={(format) => {
                            exportWords(filteredWords, format);
                            setActivePopover(null);
                        }}
                    />
                </FilterPopover>

                {/* Show Subtitles Toggle */}
                {selectedRecord && (
                    <>
                        <div className="w-px h-5 bg-zinc-100 mx-1 flex-none" />
                        <button
                            onClick={() => setShowSubtitles(!showSubtitles)}
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

                {/* Spacer */}
                <div className="flex-1" />

                {/* Word Count */}
                <span className="text-[12px] text-zinc-400 flex-none">
                    {!selectedRecordId && hasMore
                        ? `${filteredWords.length}+ 个词汇`
                        : `${filteredWords.length} 个词汇`
                    }
                    {!selectedRecordId && dbStats[vocabCategory] && (
                        <span className="text-zinc-300 ml-1">/ {dbStats[vocabCategory]}</span>
                    )}
                </span>
            </div>

            {/* Main Content - Left: Word List, Right: Subtitles */}
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
                ) : filteredWords.length === 0 && allWords.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                        <BookOpen size={48} strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[15px] font-medium text-gray-500">词库为空</p>
                            <p className="text-[13px] mt-1">请检查词库数据库是否正确加载</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Word List - Left Panel */}
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
                                <InfiniteScrollWordList
                                    words={filteredWords}
                                    hasMore={hasMore && !selectedRecordId}
                                    loadingMore={loadingMore}
                                    onLoadMore={loadMoreWords}
                                />
                            )}
                        </div>

                        {/* Subtitle Panel - Right Sidebar */}
                        {showSubtitles && selectedRecord && (
                            <div className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col bg-white">
                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-gray-600">
                                        字幕 ({selectedRecord.subtitleData.length})
                                    </span>
                                    <button
                                        onClick={() => setShowSubtitles(false)}
                                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                                    >
                                        <X size={14} className="text-gray-400" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <div className="py-2">
                                        {selectedRecord.subtitleData.map((subtitle, index) => (
                                            <SubtitleItemWithHighlight
                                                key={index}
                                                subtitle={subtitle}
                                                difficultWords={filteredWordMap}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * InfiniteScrollWordList - 无限滚动词汇列表组件
 */
function InfiniteScrollWordList({
    words,
    hasMore,
    loadingMore,
    onLoadMore
}: {
    words: DifficultWord[];
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle scroll to bottom to load more
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (scrollBottom < 300 && hasMore && !loadingMore) {
            onLoadMore();
        }
    }, [hasMore, loadingMore, onLoadMore]);

    return (
        <div ref={containerRef} className="h-full overflow-auto" onScroll={handleScroll}>
            {/* Table Container */}
            <div className="table w-full min-w-[600px]">
                {/* List Header - Notion/Linear 风格 */}
                <div className="table-row sticky top-0 z-10 bg-zinc-50/95 backdrop-blur-sm">
                    <div className="table-cell h-8 align-middle pl-6 pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                        <span className="block w-[120px]">单词</span>
                    </div>
                    <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                        <span className="block w-[100px]">音标</span>
                    </div>
                    <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider w-full">
                        释义
                    </div>
                    <div className="table-cell h-8 align-middle pr-3 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider whitespace-nowrap">
                        标签
                    </div>
                    <div className="table-cell h-8 align-middle pr-6 border-b border-zinc-200/60 text-[11px] text-zinc-500 font-medium uppercase tracking-wider text-right whitespace-nowrap">
                        词频
                    </div>
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
