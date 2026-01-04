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

    -- Platform icons table (shared across same platform)
    CREATE TABLE IF NOT EXISTS platform_icons (
      platform TEXT PRIMARY KEY,
      icon_data TEXT,
      source_url TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Author avatars table (shared across same author)
    CREATE TABLE IF NOT EXISTS author_avatars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      author_profile_url TEXT NOT NULL,
      author_name TEXT,
      avatar_data TEXT,
      source_url TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform, author_profile_url)
    );

    CREATE INDEX IF NOT EXISTS idx_author_avatars_lookup ON author_avatars(platform, author_profile_url);
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
 * Enhance assets with locally stored icons and avatars
 * This replaces remote URLs with local base64 data when available
 */
function enhanceAssetsWithLocalMedia(assets: Asset[]): Asset[] {
    const db = getDatabase();

    // Collect unique platforms and author profile URLs
    const platforms = new Set<string>();
    const authorKeys = new Set<string>(); // "platform|profileUrl"

    for (const asset of assets) {
        if (asset.platform) {
            platforms.add(asset.platform);
        }
        if (asset.platform && asset.author?.profileUrl) {
            authorKeys.add(`${asset.platform}|${asset.author.profileUrl}`);
        }
    }

    // Batch fetch platform icons
    const platformIcons = new Map<string, string>();
    if (platforms.size > 0) {
        const platformList = Array.from(platforms);
        const placeholders = platformList.map(() => '?').join(',');
        const iconRows = db.prepare(
            `SELECT platform, icon_data FROM platform_icons WHERE platform IN (${placeholders}) AND icon_data IS NOT NULL`
        ).all(...platformList) as Array<{ platform: string; icon_data: string }>;

        for (const row of iconRows) {
            platformIcons.set(row.platform, row.icon_data);
        }
    }

    // Batch fetch author avatars
    const authorAvatars = new Map<string, string>();
    if (authorKeys.size > 0) {
        // Build query for all author keys
        const conditions: string[] = [];
        const params: string[] = [];

        for (const key of authorKeys) {
            const [platform, profileUrl] = key.split('|');
            conditions.push('(platform = ? AND author_profile_url = ?)');
            params.push(platform, profileUrl);
        }

        const avatarRows = db.prepare(
            `SELECT platform, author_profile_url, avatar_data FROM author_avatars
             WHERE (${conditions.join(' OR ')}) AND avatar_data IS NOT NULL`
        ).all(...params) as Array<{ platform: string; author_profile_url: string; avatar_data: string }>;

        for (const row of avatarRows) {
            authorAvatars.set(`${row.platform}|${row.author_profile_url}`, row.avatar_data);
        }
    }

    // Enhance assets with local media
    return assets.map(asset => {
        const enhanced = { ...asset };

        // Replace favicon with local icon if available
        if (asset.platform) {
            const localIcon = platformIcons.get(asset.platform);
            if (localIcon) {
                enhanced.favicon = localIcon;
            }
        }

        // Replace author avatar with local avatar if available
        if (asset.platform && asset.author?.profileUrl) {
            const localAvatar = authorAvatars.get(`${asset.platform}|${asset.author.profileUrl}`);
            if (localAvatar && asset.author) {
                enhanced.author = {
                    ...asset.author,
                    avatar: localAvatar
                };
            }
        }

        return enhanced;
    });
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
    const assets = rows.map(rowToAsset);
    // Enhance with locally stored icons and avatars
    return enhanceAssetsWithLocalMedia(assets);
}

/**
 * Get a single asset by ID
 */
export function getAssetById(id: number): Asset | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
    if (!row) return null;
    const asset = rowToAsset(row);
    // Enhance with locally stored icons and avatars
    const enhanced = enhanceAssetsWithLocalMedia([asset]);
    return enhanced[0];
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
    const assets = rows.map(rowToAsset);
    // Enhance with locally stored icons and avatars
    return enhanceAssetsWithLocalMedia(assets);
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

    // Query with ordering - alphabetical by default for consistent pagination
    const query = `
        SELECT * FROM words
        ${whereClause}
        ORDER BY word ASC
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

// ============ Platform Icons & Author Avatars Functions ============

interface PlatformIconRow {
    platform: string;
    icon_data: string | null;
    source_url: string | null;
    updated_at: string;
}

interface AuthorAvatarRow {
    id: number;
    platform: string;
    author_profile_url: string;
    author_name: string | null;
    avatar_data: string | null;
    source_url: string | null;
    updated_at: string;
}

/**
 * Download image from URL and convert to base64
 * Returns null if download fails
 */
export async function downloadImageAsBase64(url: string): Promise<string | null> {
    if (!url) return null;

    try {
        // Use dynamic import for node-fetch compatibility
        const { net } = await import('electron');

        return new Promise((resolve) => {
            const request = net.request(url);
            const chunks: Buffer[] = [];

            request.on('response', (response) => {
                if (response.statusCode !== 200) {
                    console.log('[Database] downloadImageAsBase64 - non-200 status:', response.statusCode);
                    resolve(null);
                    return;
                }

                const contentType = response.headers['content-type'];
                let mimeType = 'image/png';
                if (contentType) {
                    if (Array.isArray(contentType)) {
                        mimeType = contentType[0] || 'image/png';
                    } else {
                        mimeType = contentType;
                    }
                }

                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                response.on('end', () => {
                    try {
                        const buffer = Buffer.concat(chunks);
                        const base64 = buffer.toString('base64');
                        const dataUrl = `data:${mimeType};base64,${base64}`;
                        resolve(dataUrl);
                    } catch (error) {
                        console.error('[Database] downloadImageAsBase64 - encode error:', error);
                        resolve(null);
                    }
                });

                response.on('error', (error) => {
                    console.error('[Database] downloadImageAsBase64 - response error:', error);
                    resolve(null);
                });
            });

            request.on('error', (error) => {
                console.error('[Database] downloadImageAsBase64 - request error:', error);
                resolve(null);
            });

            // Set timeout
            setTimeout(() => {
                request.abort();
                resolve(null);
            }, 10000); // 10 second timeout

            request.end();
        });
    } catch (error) {
        console.error('[Database] downloadImageAsBase64 - error:', error);
        return null;
    }
}

/**
 * Save or update platform icon
 * Downloads the icon if not exists or URL changed
 */
export async function saveOrUpdatePlatformIcon(platform: string, sourceUrl: string): Promise<string | null> {
    if (!platform || !sourceUrl) return null;

    const db = getDatabase();

    // Check if exists
    const existing = db.prepare('SELECT * FROM platform_icons WHERE platform = ?').get(platform) as PlatformIconRow | undefined;

    if (existing) {
        // If URL hasn't changed, return existing data
        if (existing.source_url === sourceUrl && existing.icon_data) {
            console.log('[Database] Platform icon exists and URL unchanged:', platform);
            return existing.icon_data;
        }

        // URL changed or no data, download and update
        console.log('[Database] Updating platform icon:', platform);
        const iconData = await downloadImageAsBase64(sourceUrl);

        if (iconData) {
            db.prepare(`
                UPDATE platform_icons
                SET icon_data = ?, source_url = ?, updated_at = CURRENT_TIMESTAMP
                WHERE platform = ?
            `).run(iconData, sourceUrl, platform);
            return iconData;
        }

        // Download failed, return existing data if available
        return existing.icon_data;
    }

    // Not exists, download and insert
    console.log('[Database] Saving new platform icon:', platform);
    const iconData = await downloadImageAsBase64(sourceUrl);

    db.prepare(`
        INSERT INTO platform_icons (platform, icon_data, source_url)
        VALUES (?, ?, ?)
    `).run(platform, iconData, sourceUrl);

    return iconData;
}

/**
 * Get platform icon by platform ID
 */
export function getPlatformIcon(platform: string): string | null {
    if (!platform) return null;

    const db = getDatabase();
    const row = db.prepare('SELECT icon_data FROM platform_icons WHERE platform = ?').get(platform) as { icon_data: string | null } | undefined;
    return row?.icon_data || null;
}

/**
 * Save or update author avatar
 * Downloads the avatar if not exists or URL changed
 */
export async function saveOrUpdateAuthorAvatar(
    platform: string,
    profileUrl: string,
    sourceUrl: string,
    authorName: string
): Promise<string | null> {
    if (!platform || !profileUrl || !sourceUrl) return null;

    const db = getDatabase();

    // Check if exists
    const existing = db.prepare(
        'SELECT * FROM author_avatars WHERE platform = ? AND author_profile_url = ?'
    ).get(platform, profileUrl) as AuthorAvatarRow | undefined;

    if (existing) {
        // If URL hasn't changed, return existing data
        if (existing.source_url === sourceUrl && existing.avatar_data) {
            console.log('[Database] Author avatar exists and URL unchanged:', authorName);
            return existing.avatar_data;
        }

        // URL changed or no data, download and update
        console.log('[Database] Updating author avatar:', authorName);
        const avatarData = await downloadImageAsBase64(sourceUrl);

        if (avatarData) {
            db.prepare(`
                UPDATE author_avatars
                SET avatar_data = ?, source_url = ?, author_name = ?, updated_at = CURRENT_TIMESTAMP
                WHERE platform = ? AND author_profile_url = ?
            `).run(avatarData, sourceUrl, authorName, platform, profileUrl);
            return avatarData;
        }

        // Download failed, return existing data if available
        return existing.avatar_data;
    }

    // Not exists, download and insert
    console.log('[Database] Saving new author avatar:', authorName);
    const avatarData = await downloadImageAsBase64(sourceUrl);

    db.prepare(`
        INSERT INTO author_avatars (platform, author_profile_url, author_name, avatar_data, source_url)
        VALUES (?, ?, ?, ?, ?)
    `).run(platform, profileUrl, authorName, avatarData, sourceUrl);

    return avatarData;
}

/**
 * Get author avatar by platform and profile URL
 */
export function getAuthorAvatar(platform: string, profileUrl: string): string | null {
    if (!platform || !profileUrl) return null;

    const db = getDatabase();
    const row = db.prepare(
        'SELECT avatar_data FROM author_avatars WHERE platform = ? AND author_profile_url = ?'
    ).get(platform, profileUrl) as { avatar_data: string | null } | undefined;
    return row?.avatar_data || null;
}

/**
 * Get author avatar by platform and author name (fallback)
 */
export function getAuthorAvatarByName(platform: string, authorName: string): string | null {
    if (!platform || !authorName) return null;

    const db = getDatabase();
    const row = db.prepare(
        'SELECT avatar_data FROM author_avatars WHERE platform = ? AND author_name = ? ORDER BY updated_at DESC LIMIT 1'
    ).get(platform, authorName) as { avatar_data: string | null } | undefined;
    return row?.avatar_data || null;
}
