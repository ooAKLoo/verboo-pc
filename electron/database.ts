/**
 * SQLite Database Module
 *
 * Unified asset management system for storing all types of captured materials.
 * Uses better-sqlite3 for synchronous database operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

// ============ Type Definitions ============

export type AssetType = 'content' | 'screenshot';

// Database row interface
interface AssetRow {
    id: number;
    type: AssetType;
    platform: string | null;
    title: string | null;
    url: string;
    author_name: string | null;
    author_avatar: string | null;
    author_profile_url: string | null;
    favicon: string | null;
    thumbnail: string | null;
    type_data: string;
    subtitle_id: number | null;
    created_at: string;
    updated_at: string;
}

interface SubtitleRow {
    id: number;
    video_url: string;
    video_title: string | null;
    platform: string | null;
    subtitle_data: string;
    created_at: string;
    updated_at: string;
}

// Content type_data structure
export interface ContentTypeData {
    content: string;
    tags: string[];
    images: string[];
    capturedAt: string;
}

// Screenshot type_data structure
export interface ScreenshotTypeData {
    timestamp: number;
    imageData: string;
    finalImageData?: string;
    markType?: 'important' | 'difficult';
    selectedSubtitles?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    subtitleStyle?: {
        position: string;
        background: string;
        fontSize: number;
        layout: string;
    };
}

// Unified Asset interface
export interface Asset {
    id: number;
    type: AssetType;
    platform: string;
    title: string;
    url: string;
    author?: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    favicon?: string;
    thumbnail?: string;
    typeData: ContentTypeData | ScreenshotTypeData;
    subtitleId?: number;
    createdAt: Date;
    updatedAt: Date;
}

// Input interfaces
export interface SaveContentInput {
    platform: string;
    title: string;
    url: string;
    author?: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    favicon?: string;
    thumbnail?: string;
    content: string;
    tags: string[];
    images: string[];
    capturedAt?: Date;
}

export interface SaveScreenshotInput {
    platform?: string;
    title: string;
    url: string;
    author?: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    favicon?: string;
    timestamp: number;
    imageData: string;
    finalImageData?: string;
    markType?: 'important' | 'difficult';
    selectedSubtitles?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    subtitleStyle?: {
        position: string;
        background: string;
        fontSize: number;
        layout: string;
    };
    subtitleId?: number;
}

export interface Subtitle {
    id: number;
    videoUrl: string;
    videoTitle: string;
    platform: string;
    subtitleData: Array<{
        start: number;
        duration?: number;
        text: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

export interface SaveSubtitleInput {
    videoUrl: string;
    videoTitle: string;
    platform: string;
    subtitleData: Array<{
        start: number;
        duration?: number;
        text: string;
    }>;
}

let db: Database.Database | null = null;

/**
 * Get database path in user data directory
 */
function getDatabasePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'verboo-materials.db');
}

/**
 * Initialize database connection and create tables
 */
export function initDatabase(): Database.Database {
    if (db) return db;

    const dbPath = getDatabasePath();
    console.log('[Database] Initializing database at:', dbPath);

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create unified assets table
    db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('content', 'screenshot')),
      platform TEXT,
      title TEXT,
      url TEXT NOT NULL,
      author_name TEXT,
      author_avatar TEXT,
      author_profile_url TEXT,
      favicon TEXT,
      thumbnail TEXT,
      type_data TEXT NOT NULL,
      subtitle_id INTEGER REFERENCES subtitles(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_platform ON assets(platform);
    CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
    CREATE INDEX IF NOT EXISTS idx_assets_url ON assets(url);

    CREATE TABLE IF NOT EXISTS subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_url TEXT NOT NULL UNIQUE,
      video_title TEXT,
      platform TEXT,
      subtitle_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_subtitles_video_url ON subtitles(video_url);
  `);

    console.log('[Database] Database initialized successfully');
    return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        console.log('[Database] Database closed');
    }
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
    if (!db) {
        return initDatabase();
    }
    return db;
}

// ============ Asset CRUD Functions ============

/**
 * Convert database row to Asset object
 */
function rowToAsset(row: AssetRow): Asset {
    const typeData = JSON.parse(row.type_data);

    return {
        id: row.id,
        type: row.type,
        platform: row.platform || '',
        title: row.title || '',
        url: row.url,
        author: row.author_name ? {
            name: row.author_name,
            avatar: row.author_avatar || undefined,
            profileUrl: row.author_profile_url || undefined,
        } : undefined,
        favicon: row.favicon || undefined,
        thumbnail: row.thumbnail || undefined,
        typeData,
        subtitleId: row.subtitle_id || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Save a content asset
 */
export function saveContent(input: SaveContentInput): Asset {
    const db = getDatabase();

    const typeData: ContentTypeData = {
        content: input.content,
        tags: input.tags,
        images: input.images,
        capturedAt: (input.capturedAt || new Date()).toISOString(),
    };

    // Use first image as thumbnail if available
    const thumbnail = input.thumbnail || (input.images.length > 0 ? input.images[0] : null);

    const stmt = db.prepare(`
    INSERT INTO assets (
      type, platform, title, url,
      author_name, author_avatar, author_profile_url,
      favicon, thumbnail, type_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const result = stmt.run(
        'content',
        input.platform,
        input.title,
        input.url,
        input.author?.name || null,
        input.author?.avatar || null,
        input.author?.profileUrl || null,
        input.favicon || null,
        thumbnail,
        JSON.stringify(typeData)
    );

    console.log('[Database] Saved content asset with ID:', result.lastInsertRowid);

    const savedRow = db.prepare('SELECT * FROM assets WHERE id = ?')
        .get(result.lastInsertRowid) as AssetRow;

    return rowToAsset(savedRow);
}

/**
 * Save a screenshot asset
 */
export function saveScreenshot(input: SaveScreenshotInput): Asset {
    const db = getDatabase();

    const typeData: ScreenshotTypeData = {
        timestamp: input.timestamp,
        imageData: input.imageData,
        finalImageData: input.finalImageData,
        markType: input.markType,
        selectedSubtitles: input.selectedSubtitles,
        subtitleStyle: input.subtitleStyle,
    };

    // Use imageData as thumbnail (or finalImageData if available)
    const thumbnail = input.finalImageData || input.imageData;

    const stmt = db.prepare(`
    INSERT INTO assets (
      type, platform, title, url,
      author_name, author_avatar, author_profile_url,
      favicon, thumbnail, type_data, subtitle_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const result = stmt.run(
        'screenshot',
        input.platform || null,
        input.title,
        input.url,
        input.author?.name || null,
        input.author?.avatar || null,
        input.author?.profileUrl || null,
        input.favicon || null,
        thumbnail,
        JSON.stringify(typeData),
        input.subtitleId || null
    );

    console.log('[Database] Saved screenshot asset with ID:', result.lastInsertRowid);

    const savedRow = db.prepare('SELECT * FROM assets WHERE id = ?')
        .get(result.lastInsertRowid) as AssetRow;

    return rowToAsset(savedRow);
}

/**
 * Get assets with pagination and filtering
 */
export function getAssets(
    options: {
        type?: AssetType;
        platform?: string;
        url?: string;
        limit?: number;
        offset?: number
    } = {}
): Asset[] {
    const db = getDatabase();
    const { type, platform, url, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM assets WHERE 1=1';
    const params: any[] = [];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    if (platform) {
        query += ' AND platform = ?';
        params.push(platform);
    }

    if (url) {
        // Extract video identifier for matching
        // YouTube: ?v=VIDEO_ID, Bilibili: /video/BV... or /video/av...
        let videoId = '';

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
            if (match) videoId = match[1];
        } else if (url.includes('bilibili.com')) {
            const match = url.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/i);
            if (match) videoId = match[1];
        }

        if (videoId) {
            console.log('[Database] Filtering by videoId:', videoId);
            query += ' AND url LIKE ?';
            params.push('%' + videoId + '%');
        } else {
            // Fallback: exact match or prefix match
            const baseUrl = url.split('&')[0];
            console.log('[Database] Filtering by baseUrl:', baseUrl);
            query += ' AND (url = ? OR url LIKE ?)';
            params.push(url, baseUrl + '%');
        }
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    console.log('[Database] Query:', query, 'Params:', params.slice(0, -2));
    const rows = db.prepare(query).all(...params) as AssetRow[];
    console.log('[Database] Found', rows.length, 'assets');
    return rows.map(rowToAsset);
}

/**
 * Get a single asset by ID
 */
export function getAssetById(id: number): Asset | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
    return row ? rowToAsset(row) : null;
}

/**
 * Update an asset
 */
export function updateAsset(id: number, input: {
    title?: string;
    typeData?: Partial<ContentTypeData> | Partial<ScreenshotTypeData>;
}): Asset | null {
    const db = getDatabase();

    // First get the existing asset
    const existing = getAssetById(id);
    if (!existing) return null;

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];

    if (input.title !== undefined) {
        updates.push('title = ?');
        params.push(input.title);
    }

    if (input.typeData !== undefined) {
        // Merge with existing typeData
        const mergedTypeData = { ...existing.typeData, ...input.typeData };
        updates.push('type_data = ?');
        params.push(JSON.stringify(mergedTypeData));

        // Update thumbnail if finalImageData changed (for screenshots)
        if ('finalImageData' in input.typeData && input.typeData.finalImageData) {
            updates.push('thumbnail = ?');
            params.push(input.typeData.finalImageData);
        }
    }

    params.push(id);
    const stmt = db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    console.log('[Database] Updated asset with ID:', id);
    return getAssetById(id);
}

/**
 * Delete an asset by ID
 */
export function deleteAsset(id: number): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    console.log('[Database] Deleted asset with ID:', id, 'Changes:', result.changes);
    return result.changes > 0;
}

/**
 * Search assets by keyword
 */
export function searchAssets(
    keyword: string,
    options: { type?: AssetType; limit?: number } = {}
): Asset[] {
    const db = getDatabase();
    const { type, limit = 50 } = options;
    const searchPattern = `%${keyword}%`;

    let query = `
    SELECT * FROM assets
    WHERE (title LIKE ? OR type_data LIKE ?)
  `;
    const params: any[] = [searchPattern, searchPattern];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as AssetRow[];
    return rows.map(rowToAsset);
}

/**
 * Get total count of assets
 */
export function getAssetsCount(options: { type?: AssetType; platform?: string } = {}): number {
    const db = getDatabase();
    const { type, platform } = options;

    let query = 'SELECT COUNT(*) as count FROM assets WHERE 1=1';
    const params: any[] = [];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    if (platform) {
        query += ' AND platform = ?';
        params.push(platform);
    }

    const result = db.prepare(query).get(...params) as { count: number };
    return result.count;
}

// ============ Subtitle CRUD Functions ============

/**
 * Convert database row to Subtitle object
 */
function rowToSubtitle(row: SubtitleRow): Subtitle {
    return {
        id: row.id,
        videoUrl: row.video_url,
        videoTitle: row.video_title || '',
        platform: row.platform || '',
        subtitleData: row.subtitle_data ? JSON.parse(row.subtitle_data) : [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Save or update subtitles (upsert by video_url)
 */
export function saveSubtitles(input: SaveSubtitleInput): Subtitle {
    const db = getDatabase();

    // Check if subtitles already exist for this URL
    const existing = db.prepare('SELECT id FROM subtitles WHERE video_url = ?').get(input.videoUrl) as { id: number } | undefined;

    if (existing) {
        // Update existing record
        const stmt = db.prepare(`
            UPDATE subtitles SET
                video_title = ?,
                platform = ?,
                subtitle_data = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(
            input.videoTitle,
            input.platform,
            JSON.stringify(input.subtitleData),
            existing.id
        );
        console.log('[Database] Updated subtitles with ID:', existing.id);

        const savedRow = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(existing.id) as SubtitleRow;
        return rowToSubtitle(savedRow);
    } else {
        // Insert new record
        const stmt = db.prepare(`
            INSERT INTO subtitles (video_url, video_title, platform, subtitle_data)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(
            input.videoUrl,
            input.videoTitle,
            input.platform,
            JSON.stringify(input.subtitleData)
        );
        console.log('[Database] Saved subtitles with ID:', result.lastInsertRowid);

        const savedRow = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(result.lastInsertRowid) as SubtitleRow;
        return rowToSubtitle(savedRow);
    }
}

/**
 * Get subtitles by video URL
 */
export function getSubtitlesByUrl(videoUrl: string): Subtitle | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM subtitles WHERE video_url = ?').get(videoUrl) as SubtitleRow | undefined;
    return row ? rowToSubtitle(row) : null;
}

/**
 * Get subtitles by ID
 */
export function getSubtitlesById(id: number): Subtitle | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(id) as SubtitleRow | undefined;
    return row ? rowToSubtitle(row) : null;
}

/**
 * Get all subtitles with pagination
 */
export function getAllSubtitles(options: { limit?: number; offset?: number } = {}): Subtitle[] {
    const db = getDatabase();
    const { limit = 100, offset = 0 } = options;

    const rows = db.prepare('SELECT * FROM subtitles ORDER BY updated_at DESC LIMIT ? OFFSET ?')
        .all(limit, offset) as SubtitleRow[];
    return rows.map(rowToSubtitle);
}

/**
 * Delete subtitles by ID
 */
export function deleteSubtitles(id: number): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM subtitles WHERE id = ?').run(id);
    console.log('[Database] Deleted subtitles with ID:', id, 'Changes:', result.changes);
    return result.changes > 0;
}

/**
 * Get total count of subtitles
 */
export function getSubtitlesCount(): number {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM subtitles').get() as { count: number };
    return result.count;
}

// ============ Vocabulary Database Functions ============

let vocabDb: Database.Database | null = null;

/**
 * Word info from vocabulary database
 */
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

interface VocabRow {
    word: string;
    phonetic: string | null;
    definition_en: string | null;
    definition_cn: string | null;
    pos: string | null;
    cefr_level: string | null;
    collins_star: number;
    coca_rank: number;
    bnc_rank: number;
    is_oxford_3000: number;
    is_cet4: number;
    is_cet6: number;
    is_zk: number;
    is_gk: number;
    is_ky: number;
    is_toefl: number;
    is_ielts: number;
    is_gre: number;
    exchange: string | null;
}

/**
 * Get vocabulary database path
 */
function getVocabDbPath(): string {
    // In development, use the python-data folder
    // In production, we should bundle this or copy to userData
    if (process.env.VITE_DEV_SERVER_URL) {
        return path.join(__dirname, '..', 'python-data', 'verboo_vocabulary.db');
    }
    // Production: look in resources folder
    return path.join(process.resourcesPath || __dirname, 'python-data', 'verboo_vocabulary.db');
}

/**
 * Initialize vocabulary database connection (read-only)
 */
export function initVocabDatabase(): Database.Database | null {
    if (vocabDb) return vocabDb;

    const dbPath = getVocabDbPath();
    console.log('[Database] Initializing vocabulary database at:', dbPath);

    try {
        // Open in read-only mode
        vocabDb = new Database(dbPath, { readonly: true, fileMustExist: true });
        console.log('[Database] Vocabulary database initialized successfully');
        return vocabDb;
    } catch (error) {
        console.error('[Database] Failed to open vocabulary database:', error);
        return null;
    }
}

/**
 * Close vocabulary database connection
 */
export function closeVocabDatabase(): void {
    if (vocabDb) {
        vocabDb.close();
        vocabDb = null;
        console.log('[Database] Vocabulary database closed');
    }
}

/**
 * Convert vocab row to WordInfo
 */
function rowToWordInfo(row: VocabRow): WordInfo {
    return {
        word: row.word,
        phonetic: row.phonetic || undefined,
        definitionEn: row.definition_en || undefined,
        definitionCn: row.definition_cn || undefined,
        pos: row.pos || undefined,
        cefrLevel: row.cefr_level || undefined,
        collinsStar: row.collins_star || undefined,
        cocaRank: row.coca_rank || undefined,
        bncRank: row.bnc_rank || undefined,
        isOxford3000: row.is_oxford_3000 === 1,
        isCet4: row.is_cet4 === 1,
        isCet6: row.is_cet6 === 1,
        isZk: row.is_zk === 1,
        isGk: row.is_gk === 1,
        isKy: row.is_ky === 1,
        isToefl: row.is_toefl === 1,
        isIelts: row.is_ielts === 1,
        isGre: row.is_gre === 1,
        exchange: row.exchange || undefined,
    };
}

/**
 * Look up a single word
 */
export function lookupWord(word: string): WordInfo | null {
    const db = initVocabDatabase();
    if (!db) return null;

    const row = db.prepare('SELECT * FROM words WHERE word = ?').get(word.toLowerCase()) as VocabRow | undefined;
    return row ? rowToWordInfo(row) : null;
}

/**
 * Look up multiple words at once
 */
export function lookupWords(words: string[]): Map<string, WordInfo> {
    const result = new Map<string, WordInfo>();
    const db = initVocabDatabase();
    console.log('[Database] lookupWords - vocabDb status:', db ? 'connected' : 'null');
    if (!db || words.length === 0) {
        console.log('[Database] lookupWords - returning empty (db null or no words)');
        return result;
    }

    // Deduplicate and lowercase
    const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];

    // Batch query for efficiency - limit to first 500 words to avoid SQL issues
    const wordsToQuery = uniqueWords.slice(0, 500);
    const placeholders = wordsToQuery.map(() => '?').join(',');
    const query = `SELECT * FROM words WHERE word IN (${placeholders})`;

    try {
        const rows = db.prepare(query).all(...wordsToQuery) as VocabRow[];
        console.log('[Database] lookupWords - query returned', rows.length, 'rows');

        for (const row of rows) {
            result.set(row.word, rowToWordInfo(row));
        }
    } catch (error) {
        console.error('[Database] lookupWords - query error:', error);
    }

    return result;
}

/**
 * Determine if a word is considered "difficult" based on CEFR level and frequency
 * Returns difficulty level: 'high' | 'medium' | 'low' | null
 */
export function getWordDifficulty(word: WordInfo): 'high' | 'medium' | 'low' | null {
    // High difficulty: C1/C2 level, GRE words, low frequency
    if (word.cefrLevel === 'C1' || word.cefrLevel === 'C2' || word.isGre) {
        return 'high';
    }

    // Medium difficulty: B2 level, TOEFL/IELTS/考研词汇, or COCA rank > 5000
    if (
        word.cefrLevel === 'B2' ||
        word.isToefl ||
        word.isIelts ||
        word.isKy ||
        (word.cocaRank && word.cocaRank > 5000)
    ) {
        return 'medium';
    }

    // Low difficulty: B1 level, CET-6
    if (word.cefrLevel === 'B1' || word.isCet6) {
        return 'low';
    }

    // Basic words (A1, A2, CET-4, 中考/高考) - not marked as difficult
    return null;
}

/**
 * Analyze text and find difficult words
 * Returns array of words with their info and difficulty level
 */
export function analyzeTextDifficulty(text: string): Array<{
    word: string;
    info: WordInfo;
    difficulty: 'high' | 'medium' | 'low';
}> {
    // Extract words from text (simple tokenization)
    const wordPattern = /\b[a-zA-Z]{2,}\b/g;
    const matches = text.match(wordPattern) || [];
    console.log('[Database] analyzeTextDifficulty - extracted words count:', matches.length);

    // Get unique words
    const uniqueWords = [...new Set(matches.map(w => w.toLowerCase()))];
    console.log('[Database] analyzeTextDifficulty - unique words count:', uniqueWords.length);

    // Look up all words
    const wordInfoMap = lookupWords(uniqueWords);
    console.log('[Database] analyzeTextDifficulty - found in database:', wordInfoMap.size);

    const results: Array<{
        word: string;
        info: WordInfo;
        difficulty: 'high' | 'medium' | 'low';
    }> = [];

    for (const [word, info] of wordInfoMap) {
        const difficulty = getWordDifficulty(info);
        if (difficulty) {
            results.push({ word, info, difficulty });
        }
    }

    // Sort by difficulty (high first) then by word
    results.sort((a, b) => {
        const diffOrder = { high: 0, medium: 1, low: 2 };
        const diffCompare = diffOrder[a.difficulty] - diffOrder[b.difficulty];
        if (diffCompare !== 0) return diffCompare;
        return a.word.localeCompare(b.word);
    });

    return results;
}

/**
 * Get vocabulary words by category with pagination
 * @param category - vocabulary category filter (e.g., 'gk', 'zk', 'cet4', etc.) or 'all'
 * @param limit - max number of words to return
 * @param offset - pagination offset
 * @returns Array of words with their info and difficulty level
 */
export function getVocabularyByCategory(
    category: string = 'all',
    limit: number = 100,
    offset: number = 0
): Array<{
    word: string;
    info: WordInfo;
    difficulty: 'high' | 'medium' | 'low';
}> {
    const db = initVocabDatabase();
    if (!db) {
        console.error('[Database] getVocabularyByCategory - database not initialized');
        return [];
    }

    // Build WHERE clause based on category
    let whereClause = '';
    const categoryMap: Record<string, string> = {
        'zk': 'is_zk = 1',
        'gk': 'is_gk = 1',
        'cet4': 'is_cet4 = 1',
        'cet6': 'is_cet6 = 1',
        'ky': 'is_ky = 1',
        'toefl': 'is_toefl = 1',
        'ielts': 'is_ielts = 1',
        'gre': 'is_gre = 1',
        'oxford3000': 'is_oxford_3000 = 1',
    };

    if (category !== 'all' && categoryMap[category]) {
        whereClause = `WHERE ${categoryMap[category]}`;
    }

    // Query with ordering by difficulty indicators
    const query = `
        SELECT * FROM words
        ${whereClause}
        ORDER BY
            CASE
                WHEN cefr_level = 'C2' THEN 1
                WHEN cefr_level = 'C1' THEN 2
                WHEN is_gre = 1 THEN 3
                WHEN cefr_level = 'B2' THEN 4
                WHEN is_toefl = 1 OR is_ielts = 1 THEN 5
                ELSE 6
            END,
            coca_rank DESC NULLS LAST,
            word ASC
        LIMIT ? OFFSET ?
    `;

    try {
        const rows = db.prepare(query).all(limit, offset) as VocabRow[];
        console.log('[Database] getVocabularyByCategory - found', rows.length, 'words for category:', category);

        const results: Array<{
            word: string;
            info: WordInfo;
            difficulty: 'high' | 'medium' | 'low';
        }> = [];

        for (const row of rows) {
            const info = rowToWordInfo(row);
            const difficulty = getWordDifficulty(info);
            if (difficulty) {
                results.push({ word: row.word, info, difficulty });
            }
        }

        return results;
    } catch (error) {
        console.error('[Database] getVocabularyByCategory - query error:', error);
        return [];
    }
}

/**
 * Get vocabulary statistics by category
 * @returns Object with count for each category
 */
export function getVocabularyStats(): Record<string, number> {
    const db = initVocabDatabase();
    if (!db) {
        console.error('[Database] getVocabularyStats - database not initialized');
        return {};
    }

    try {
        const stats: Record<string, number> = {};

        // Get total count
        const totalRow = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number };
        stats.all = totalRow.count;

        // Get counts for each category
        const categories = [
            { key: 'zk', column: 'is_zk' },
            { key: 'gk', column: 'is_gk' },
            { key: 'cet4', column: 'is_cet4' },
            { key: 'cet6', column: 'is_cet6' },
            { key: 'ky', column: 'is_ky' },
            { key: 'toefl', column: 'is_toefl' },
            { key: 'ielts', column: 'is_ielts' },
            { key: 'gre', column: 'is_gre' },
            { key: 'oxford3000', column: 'is_oxford_3000' },
        ];

        for (const cat of categories) {
            const row = db.prepare(`SELECT COUNT(*) as count FROM words WHERE ${cat.column} = 1`).get() as { count: number };
            stats[cat.key] = row.count;
        }

        console.log('[Database] getVocabularyStats:', stats);
        return stats;
    } catch (error) {
        console.error('[Database] getVocabularyStats - error:', error);
        return {};
    }
}
