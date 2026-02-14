"use strict";
/**
 * SQLite Database Module
 *
 * Unified asset management system for storing all types of captured materials.
 * Uses better-sqlite3 for synchronous database operations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.closeDatabase = closeDatabase;
exports.getDatabase = getDatabase;
exports.saveContent = saveContent;
exports.saveScreenshot = saveScreenshot;
exports.getAssets = getAssets;
exports.getAssetById = getAssetById;
exports.updateAsset = updateAsset;
exports.deleteAsset = deleteAsset;
exports.searchAssets = searchAssets;
exports.getAssetsCount = getAssetsCount;
exports.saveSubtitles = saveSubtitles;
exports.getSubtitlesByUrl = getSubtitlesByUrl;
exports.getSubtitlesById = getSubtitlesById;
exports.getAllSubtitles = getAllSubtitles;
exports.deleteSubtitles = deleteSubtitles;
exports.getSubtitlesCount = getSubtitlesCount;
exports.initVocabDatabase = initVocabDatabase;
exports.closeVocabDatabase = closeVocabDatabase;
exports.lookupWord = lookupWord;
exports.lookupWords = lookupWords;
exports.getWordDifficulty = getWordDifficulty;
exports.analyzeTextDifficulty = analyzeTextDifficulty;
exports.getVocabularyByCategory = getVocabularyByCategory;
exports.getVocabularyStats = getVocabularyStats;
exports.downloadImageAsBase64 = downloadImageAsBase64;
exports.saveOrUpdatePlatformIcon = saveOrUpdatePlatformIcon;
exports.getPlatformIcon = getPlatformIcon;
exports.saveOrUpdateAuthorAvatar = saveOrUpdateAuthorAvatar;
exports.getAuthorAvatar = getAuthorAvatar;
exports.getAuthorAvatarByName = getAuthorAvatarByName;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
let db = null;
/**
 * Get database path in user data directory
 */
function getDatabasePath() {
    const userDataPath = electron_1.app.getPath('userData');
    return path_1.default.join(userDataPath, 'verboo-materials.db');
}
/**
 * Initialize database connection and create tables
 */
function initDatabase() {
    if (db)
        return db;
    const dbPath = getDatabasePath();
    console.log('[Database] Initializing database at:', dbPath);
    db = new better_sqlite3_1.default(dbPath);
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
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('[Database] Database closed');
    }
}
/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}
// ============ Asset CRUD Functions ============
/**
 * Convert database row to Asset object
 */
function rowToAsset(row) {
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
 * Parse known video platforms and extract a stable identity.
 * This is used to keep subtitle association stable even when URL params change.
 */
function parseVideoIdentity(rawUrl) {
    if (!rawUrl)
        return null;
    try {
        const url = new URL(rawUrl);
        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        // YouTube (watch / youtu.be / shorts / embed)
        if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be') {
            let videoId = '';
            if (hostname === 'youtu.be') {
                videoId = url.pathname.split('/').filter(Boolean)[0] || '';
            }
            else if (url.pathname === '/watch') {
                videoId = url.searchParams.get('v') || '';
            }
            else if (url.pathname.startsWith('/shorts/')) {
                videoId = url.pathname.split('/')[2] || '';
            }
            else if (url.pathname.startsWith('/embed/')) {
                videoId = url.pathname.split('/')[2] || '';
            }
            if (videoId) {
                return {
                    platform: 'youtube',
                    videoId,
                    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`
                };
            }
        }
        // Bilibili (/video/BV... or /video/av...)
        if (hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')) {
            const match = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i);
            if (match) {
                const id = match[1];
                const normalizedId = /^BV/i.test(id) ? `BV${id.slice(2)}` : id.toLowerCase();
                return {
                    platform: 'bilibili',
                    videoId: normalizedId,
                    canonicalUrl: `https://www.bilibili.com/video/${normalizedId}`
                };
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
/**
 * Normalize a subtitle URL so new saves are stable and deduplicated.
 */
function normalizeSubtitleVideoUrl(videoUrl) {
    const trimmed = (videoUrl || '').trim();
    if (!trimmed)
        return '';
    const identity = parseVideoIdentity(trimmed);
    if (identity)
        return identity.canonicalUrl;
    try {
        const url = new URL(trimmed);
        url.hash = '';
        return url.toString();
    }
    catch {
        return trimmed;
    }
}
/**
 * Find an existing subtitle row by exact URL candidates, then by parsed video identity.
 */
function findSubtitleRowByUrlOrIdentity(videoUrl) {
    const db = getDatabase();
    const normalizedUrl = normalizeSubtitleVideoUrl(videoUrl);
    const candidates = Array.from(new Set([videoUrl, normalizedUrl].filter(Boolean)));
    for (const candidate of candidates) {
        const row = db.prepare('SELECT * FROM subtitles WHERE video_url = ?').get(candidate);
        if (row)
            return row;
    }
    const target = parseVideoIdentity(videoUrl);
    if (!target)
        return undefined;
    const rows = db.prepare('SELECT id, video_url FROM subtitles ORDER BY updated_at DESC').all();
    const matched = rows.find((row) => {
        const identity = parseVideoIdentity(row.video_url);
        return Boolean(identity && identity.platform === target.platform && identity.videoId === target.videoId);
    });
    if (!matched)
        return undefined;
    return db.prepare('SELECT * FROM subtitles WHERE id = ?').get(matched.id);
}
/**
 * Enhance assets with locally stored icons and avatars
 * This replaces remote URLs with local base64 data when available
 */
function enhanceAssetsWithLocalMedia(assets) {
    const db = getDatabase();
    // Collect unique platforms and author profile URLs
    const platforms = new Set();
    const authorKeys = new Set(); // "platform|profileUrl"
    for (const asset of assets) {
        if (asset.platform) {
            platforms.add(asset.platform);
        }
        if (asset.platform && asset.author?.profileUrl) {
            authorKeys.add(`${asset.platform}|${asset.author.profileUrl}`);
        }
    }
    // Batch fetch platform icons
    const platformIcons = new Map();
    if (platforms.size > 0) {
        const platformList = Array.from(platforms);
        const placeholders = platformList.map(() => '?').join(',');
        const iconRows = db.prepare(`SELECT platform, icon_data FROM platform_icons WHERE platform IN (${placeholders}) AND icon_data IS NOT NULL`).all(...platformList);
        for (const row of iconRows) {
            platformIcons.set(row.platform, row.icon_data);
        }
    }
    // Batch fetch author avatars
    const authorAvatars = new Map();
    if (authorKeys.size > 0) {
        // Build query for all author keys
        const conditions = [];
        const params = [];
        for (const key of authorKeys) {
            const [platform, profileUrl] = key.split('|');
            conditions.push('(platform = ? AND author_profile_url = ?)');
            params.push(platform, profileUrl);
        }
        const avatarRows = db.prepare(`SELECT platform, author_profile_url, avatar_data FROM author_avatars
             WHERE (${conditions.join(' OR ')}) AND avatar_data IS NOT NULL`).all(...params);
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
function saveContent(input) {
    const db = getDatabase();
    const typeData = {
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
    const result = stmt.run('content', input.platform, input.title, input.url, input.author?.name || null, input.author?.avatar || null, input.author?.profileUrl || null, input.favicon || null, thumbnail, JSON.stringify(typeData));
    console.log('[Database] Saved content asset with ID:', result.lastInsertRowid);
    const savedRow = db.prepare('SELECT * FROM assets WHERE id = ?')
        .get(result.lastInsertRowid);
    return rowToAsset(savedRow);
}
/**
 * Save a screenshot asset
 */
function saveScreenshot(input) {
    const db = getDatabase();
    const typeData = {
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
    const result = stmt.run('screenshot', input.platform || null, input.title, input.url, input.author?.name || null, input.author?.avatar || null, input.author?.profileUrl || null, input.favicon || null, thumbnail, JSON.stringify(typeData), input.subtitleId || null);
    console.log('[Database] Saved screenshot asset with ID:', result.lastInsertRowid);
    const savedRow = db.prepare('SELECT * FROM assets WHERE id = ?')
        .get(result.lastInsertRowid);
    return rowToAsset(savedRow);
}
/**
 * Get assets with pagination and filtering
 */
function getAssets(options = {}) {
    const db = getDatabase();
    const { type, platform, url, limit = 50, offset = 0 } = options;
    let query = 'SELECT * FROM assets WHERE 1=1';
    const params = [];
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
            if (match)
                videoId = match[1];
        }
        else if (url.includes('bilibili.com')) {
            const match = url.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/i);
            if (match)
                videoId = match[1];
        }
        if (videoId) {
            console.log('[Database] Filtering by videoId:', videoId);
            query += ' AND url LIKE ?';
            params.push('%' + videoId + '%');
        }
        else {
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
    const rows = db.prepare(query).all(...params);
    console.log('[Database] Found', rows.length, 'assets');
    const assets = rows.map(rowToAsset);
    // Enhance with locally stored icons and avatars
    return enhanceAssetsWithLocalMedia(assets);
}
/**
 * Get a single asset by ID
 */
function getAssetById(id) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!row)
        return null;
    const asset = rowToAsset(row);
    // Enhance with locally stored icons and avatars
    const enhanced = enhanceAssetsWithLocalMedia([asset]);
    return enhanced[0];
}
/**
 * Update an asset
 */
function updateAsset(id, input) {
    const db = getDatabase();
    // First get the existing asset
    const existing = getAssetById(id);
    if (!existing)
        return null;
    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];
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
function deleteAsset(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    console.log('[Database] Deleted asset with ID:', id, 'Changes:', result.changes);
    return result.changes > 0;
}
/**
 * Search assets by keyword
 */
function searchAssets(keyword, options = {}) {
    const db = getDatabase();
    const { type, limit = 50 } = options;
    const searchPattern = `%${keyword}%`;
    let query = `
    SELECT * FROM assets
    WHERE (title LIKE ? OR type_data LIKE ?)
  `;
    const params = [searchPattern, searchPattern];
    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const rows = db.prepare(query).all(...params);
    const assets = rows.map(rowToAsset);
    // Enhance with locally stored icons and avatars
    return enhanceAssetsWithLocalMedia(assets);
}
/**
 * Get total count of assets
 */
function getAssetsCount(options = {}) {
    const db = getDatabase();
    const { type, platform } = options;
    let query = 'SELECT COUNT(*) as count FROM assets WHERE 1=1';
    const params = [];
    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }
    if (platform) {
        query += ' AND platform = ?';
        params.push(platform);
    }
    const result = db.prepare(query).get(...params);
    return result.count;
}
// ============ Subtitle CRUD Functions ============
/**
 * Convert database row to Subtitle object
 */
function rowToSubtitle(row) {
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
function saveSubtitles(input) {
    const db = getDatabase();
    const normalizedVideoUrl = normalizeSubtitleVideoUrl(input.videoUrl);
    // Check if subtitles already exist for this URL or same video identity
    const existing = findSubtitleRowByUrlOrIdentity(input.videoUrl);
    if (existing) {
        // Prefer canonical URL, but don't violate unique constraint
        let targetVideoUrl = existing.video_url;
        if (normalizedVideoUrl && normalizedVideoUrl !== existing.video_url) {
            const occupied = db.prepare('SELECT id FROM subtitles WHERE video_url = ?').get(normalizedVideoUrl);
            if (!occupied || occupied.id === existing.id) {
                targetVideoUrl = normalizedVideoUrl;
            }
        }
        // Update existing record
        const stmt = db.prepare(`
            UPDATE subtitles SET
                video_url = ?,
                video_title = ?,
                platform = ?,
                subtitle_data = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(targetVideoUrl, input.videoTitle, input.platform, JSON.stringify(input.subtitleData), existing.id);
        console.log('[Database] Updated subtitles with ID:', existing.id);
        const savedRow = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(existing.id);
        return rowToSubtitle(savedRow);
    }
    else {
        // Insert new record
        const stmt = db.prepare(`
            INSERT INTO subtitles (video_url, video_title, platform, subtitle_data)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(normalizedVideoUrl || input.videoUrl, input.videoTitle, input.platform, JSON.stringify(input.subtitleData));
        console.log('[Database] Saved subtitles with ID:', result.lastInsertRowid);
        const savedRow = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(result.lastInsertRowid);
        return rowToSubtitle(savedRow);
    }
}
/**
 * Get subtitles by video URL
 */
function getSubtitlesByUrl(videoUrl) {
    const row = findSubtitleRowByUrlOrIdentity(videoUrl);
    return row ? rowToSubtitle(row) : null;
}
/**
 * Get subtitles by ID
 */
function getSubtitlesById(id) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(id);
    return row ? rowToSubtitle(row) : null;
}
/**
 * Get all subtitles with pagination
 */
function getAllSubtitles(options = {}) {
    const db = getDatabase();
    const { limit = 100, offset = 0 } = options;
    const rows = db.prepare('SELECT * FROM subtitles ORDER BY updated_at DESC LIMIT ? OFFSET ?')
        .all(limit, offset);
    return rows.map(rowToSubtitle);
}
/**
 * Delete subtitles by ID
 */
function deleteSubtitles(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM subtitles WHERE id = ?').run(id);
    console.log('[Database] Deleted subtitles with ID:', id, 'Changes:', result.changes);
    return result.changes > 0;
}
/**
 * Get total count of subtitles
 */
function getSubtitlesCount() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM subtitles').get();
    return result.count;
}
// ============ Vocabulary Database Functions ============
let vocabDb = null;
/**
 * Get vocabulary database path
 */
function getVocabDbPath() {
    // In development, use the python-data folder
    // In production, we should bundle this or copy to userData
    if (process.env.VITE_DEV_SERVER_URL) {
        return path_1.default.join(__dirname, '..', 'python-data', 'verboo_vocabulary.db');
    }
    // Production: look in resources folder
    return path_1.default.join(process.resourcesPath || __dirname, 'python-data', 'verboo_vocabulary.db');
}
/**
 * Initialize vocabulary database connection (read-only)
 */
function initVocabDatabase() {
    if (vocabDb)
        return vocabDb;
    const dbPath = getVocabDbPath();
    console.log('[Database] Initializing vocabulary database at:', dbPath);
    try {
        // Open in read-only mode
        vocabDb = new better_sqlite3_1.default(dbPath, { readonly: true, fileMustExist: true });
        console.log('[Database] Vocabulary database initialized successfully');
        return vocabDb;
    }
    catch (error) {
        console.error('[Database] Failed to open vocabulary database:', error);
        return null;
    }
}
/**
 * Close vocabulary database connection
 */
function closeVocabDatabase() {
    if (vocabDb) {
        vocabDb.close();
        vocabDb = null;
        console.log('[Database] Vocabulary database closed');
    }
}
/**
 * Convert vocab row to WordInfo
 */
function rowToWordInfo(row) {
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
function lookupWord(word) {
    const db = initVocabDatabase();
    if (!db)
        return null;
    const row = db.prepare('SELECT * FROM words WHERE word = ?').get(word.toLowerCase());
    return row ? rowToWordInfo(row) : null;
}
/**
 * Look up multiple words at once
 */
function lookupWords(words) {
    const result = new Map();
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
        const rows = db.prepare(query).all(...wordsToQuery);
        console.log('[Database] lookupWords - query returned', rows.length, 'rows');
        for (const row of rows) {
            result.set(row.word, rowToWordInfo(row));
        }
    }
    catch (error) {
        console.error('[Database] lookupWords - query error:', error);
    }
    return result;
}
/**
 * Determine if a word is considered "difficult" based on CEFR level and frequency
 * Returns difficulty level: 'high' | 'medium' | 'low' | null
 */
function getWordDifficulty(word) {
    // High difficulty: C1/C2 level, GRE words, low frequency
    if (word.cefrLevel === 'C1' || word.cefrLevel === 'C2' || word.isGre) {
        return 'high';
    }
    // Medium difficulty: B2 level, TOEFL/IELTS/考研词汇, or COCA rank > 5000
    if (word.cefrLevel === 'B2' ||
        word.isToefl ||
        word.isIelts ||
        word.isKy ||
        (word.cocaRank && word.cocaRank > 5000)) {
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
function analyzeTextDifficulty(text) {
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
    const results = [];
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
        if (diffCompare !== 0)
            return diffCompare;
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
function getVocabularyByCategory(category = 'all', limit = 100, offset = 0) {
    const db = initVocabDatabase();
    if (!db) {
        console.error('[Database] getVocabularyByCategory - database not initialized');
        return [];
    }
    // Build WHERE clause based on category
    let whereClause = '';
    const categoryMap = {
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
        const rows = db.prepare(query).all(limit, offset);
        console.log('[Database] getVocabularyByCategory - found', rows.length, 'words for category:', category);
        const results = [];
        for (const row of rows) {
            const info = rowToWordInfo(row);
            const difficulty = getWordDifficulty(info);
            if (difficulty) {
                results.push({ word: row.word, info, difficulty });
            }
        }
        return results;
    }
    catch (error) {
        console.error('[Database] getVocabularyByCategory - query error:', error);
        return [];
    }
}
/**
 * Get vocabulary statistics by category
 * @returns Object with count for each category
 */
function getVocabularyStats() {
    const db = initVocabDatabase();
    if (!db) {
        console.error('[Database] getVocabularyStats - database not initialized');
        return {};
    }
    try {
        const stats = {};
        // Get total count
        const totalRow = db.prepare('SELECT COUNT(*) as count FROM words').get();
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
            const row = db.prepare(`SELECT COUNT(*) as count FROM words WHERE ${cat.column} = 1`).get();
            stats[cat.key] = row.count;
        }
        console.log('[Database] getVocabularyStats:', stats);
        return stats;
    }
    catch (error) {
        console.error('[Database] getVocabularyStats - error:', error);
        return {};
    }
}
/**
 * Download image from URL and convert to base64
 * Returns null if download fails
 */
async function downloadImageAsBase64(url) {
    if (!url)
        return null;
    try {
        // Use dynamic import for node-fetch compatibility
        const { net } = await Promise.resolve().then(() => __importStar(require('electron')));
        return new Promise((resolve) => {
            const request = net.request(url);
            const chunks = [];
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
                    }
                    else {
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
                    }
                    catch (error) {
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
    }
    catch (error) {
        console.error('[Database] downloadImageAsBase64 - error:', error);
        return null;
    }
}
/**
 * Save or update platform icon
 * Downloads the icon if not exists or URL changed
 */
async function saveOrUpdatePlatformIcon(platform, sourceUrl) {
    if (!platform || !sourceUrl)
        return null;
    const db = getDatabase();
    // Check if exists
    const existing = db.prepare('SELECT * FROM platform_icons WHERE platform = ?').get(platform);
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
function getPlatformIcon(platform) {
    if (!platform)
        return null;
    const db = getDatabase();
    const row = db.prepare('SELECT icon_data FROM platform_icons WHERE platform = ?').get(platform);
    return row?.icon_data || null;
}
/**
 * Save or update author avatar
 * Downloads the avatar if not exists or URL changed
 */
async function saveOrUpdateAuthorAvatar(platform, profileUrl, sourceUrl, authorName) {
    if (!platform || !profileUrl || !sourceUrl)
        return null;
    const db = getDatabase();
    // Check if exists
    const existing = db.prepare('SELECT * FROM author_avatars WHERE platform = ? AND author_profile_url = ?').get(platform, profileUrl);
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
function getAuthorAvatar(platform, profileUrl) {
    if (!platform || !profileUrl)
        return null;
    const db = getDatabase();
    const row = db.prepare('SELECT avatar_data FROM author_avatars WHERE platform = ? AND author_profile_url = ?').get(platform, profileUrl);
    return row?.avatar_data || null;
}
/**
 * Get author avatar by platform and author name (fallback)
 */
function getAuthorAvatarByName(platform, authorName) {
    if (!platform || !authorName)
        return null;
    const db = getDatabase();
    const row = db.prepare('SELECT avatar_data FROM author_avatars WHERE platform = ? AND author_name = ? ORDER BY updated_at DESC LIMIT 1').get(platform, authorName);
    return row?.avatar_data || null;
}
