"use strict";
/**
 * SQLite Database Module
 *
 * Unified asset management system for storing all types of captured materials.
 * Uses better-sqlite3 for synchronous database operations.
 */
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
    const { type, platform, limit = 50, offset = 0 } = options;
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
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.prepare(query).all(...params);
    return rows.map(rowToAsset);
}
/**
 * Get a single asset by ID
 */
function getAssetById(id) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    return row ? rowToAsset(row) : null;
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
    return rows.map(rowToAsset);
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
    // Check if subtitles already exist for this URL
    const existing = db.prepare('SELECT id FROM subtitles WHERE video_url = ?').get(input.videoUrl);
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
        stmt.run(input.videoTitle, input.platform, JSON.stringify(input.subtitleData), existing.id);
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
        const result = stmt.run(input.videoUrl, input.videoTitle, input.platform, JSON.stringify(input.subtitleData));
        console.log('[Database] Saved subtitles with ID:', result.lastInsertRowid);
        const savedRow = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(result.lastInsertRowid);
        return rowToSubtitle(savedRow);
    }
}
/**
 * Get subtitles by video URL
 */
function getSubtitlesByUrl(videoUrl) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM subtitles WHERE video_url = ?').get(videoUrl);
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
