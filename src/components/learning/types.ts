// 共享类型和常量

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

export type WordSortType = 'frequency' | 'difficulty' | 'alphabet' | 'cefr';
export type VocabCategory = 'all' | 'zk' | 'gk' | 'cet4' | 'cet6' | 'ky' | 'toefl' | 'ielts' | 'gre' | 'oxford3000';
export type SortDirection = 'asc' | 'desc';
export type TableColumnSortKey = 'word' | 'frequency' | 'cefr';

export const COLUMN_SORT_MAP: Record<TableColumnSortKey, WordSortType> = {
    word: 'alphabet',
    frequency: 'frequency',
    cefr: 'cefr'
};

export const TAG_FILTER_OPTIONS = [
    { key: 'isZk', label: '中考' },
    { key: 'isGk', label: '高考' },
    { key: 'isCet4', label: 'CET-4' },
    { key: 'isCet6', label: 'CET-6' },
    { key: 'isKy', label: '考研' },
    { key: 'isToefl', label: 'TOEFL' },
    { key: 'isIelts', label: 'IELTS' },
    { key: 'isGre', label: 'GRE' },
    { key: 'isOxford3000', label: 'Oxford 3000' },
] as const;

export type TagFilterKey = typeof TAG_FILTER_OPTIONS[number]['key'];

export const VOCAB_CATEGORIES = [
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

export const CEFR_STYLES: Record<string, { bg: string; text: string }> = {
    A1: { bg: 'bg-green-50', text: 'text-green-600' },
    A2: { bg: 'bg-green-100', text: 'text-green-700' },
    B1: { bg: 'bg-blue-50', text: 'text-blue-600' },
    B2: { bg: 'bg-blue-100', text: 'text-blue-700' },
    C1: { bg: 'bg-purple-50', text: 'text-purple-600' },
    C2: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export const CEFR_ORDER: Record<string, number> = {
    A1: 1,
    A2: 2,
    B1: 3,
    B2: 4,
    C1: 5,
    C2: 6,
};

export const difficultyColors = {
    high: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' },
    low: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-500' },
};
