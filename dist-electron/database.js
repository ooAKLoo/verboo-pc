"use strict";
/**
 * SQLite Database Module
 *
 * Manages SQLite database for storing captured materials.
 * Uses better-sqlite3 for synchronous database operations.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.closeDatabase = closeDatabase;
exports.getDatabase = getDatabase;
exports.saveMaterial = saveMaterial;
exports.getMaterials = getMaterials;
exports.getMaterialById = getMaterialById;
exports.deleteMaterial = deleteMaterial;
exports.searchMaterials = searchMaterials;
exports.getMaterialsCount = getMaterialsCount;
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
    // Create materials table
    db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      title TEXT,
      content TEXT,
      author_name TEXT,
      author_avatar TEXT,
      author_profile_url TEXT,
      tags TEXT,
      images TEXT,
      original_url TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_materials_platform ON materials(platform);
    CREATE INDEX IF NOT EXISTS idx_materials_captured_at ON materials(captured_at);
    CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at);
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
/**
 * Convert database row to Material object
 */
function rowToMaterial(row) {
    return {
        id: row.id,
        platform: row.platform,
        title: row.title || '',
        content: row.content || '',
        author: {
            name: row.author_name || '',
            avatar: row.author_avatar || undefined,
            profileUrl: row.author_profile_url || undefined,
        },
        tags: row.tags ? JSON.parse(row.tags) : [],
        images: row.images ? JSON.parse(row.images) : [],
        originalUrl: row.original_url,
        capturedAt: new Date(row.captured_at),
        createdAt: new Date(row.created_at),
    };
}
/**
 * Save a material to database
 */
function saveMaterial(input) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO materials (
      platform, title, content, author_name, author_avatar, 
      author_profile_url, tags, images, original_url, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(input.platform, input.title, input.content, input.author.name, input.author.avatar || null, input.author.profileUrl || null, JSON.stringify(input.tags), JSON.stringify(input.images), input.originalUrl, input.capturedAt.toISOString());
    console.log('[Database] Saved material with ID:', result.lastInsertRowid);
    // Fetch and return the saved material
    const savedRow = db.prepare('SELECT * FROM materials WHERE id = ?')
        .get(result.lastInsertRowid);
    return rowToMaterial(savedRow);
}
/**
 * Get all materials with pagination
 */
function getMaterials(options = {}) {
    const db = getDatabase();
    const { limit = 50, offset = 0, platform } = options;
    let query = 'SELECT * FROM materials';
    const params = [];
    if (platform) {
        query += ' WHERE platform = ?';
        params.push(platform);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.prepare(query).all(...params);
    return rows.map(rowToMaterial);
}
/**
 * Get a single material by ID
 */
function getMaterialById(id) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
    return row ? rowToMaterial(row) : null;
}
/**
 * Delete a material by ID
 */
function deleteMaterial(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    console.log('[Database] Deleted material with ID:', id, 'Changes:', result.changes);
    return result.changes > 0;
}
/**
 * Search materials by keyword
 */
function searchMaterials(keyword, limit = 50) {
    const db = getDatabase();
    const searchPattern = `%${keyword}%`;
    const rows = db.prepare(`
    SELECT * FROM materials 
    WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(searchPattern, searchPattern, searchPattern, limit);
    return rows.map(rowToMaterial);
}
/**
 * Get total count of materials
 */
function getMaterialsCount(platform) {
    const db = getDatabase();
    if (platform) {
        const result = db.prepare('SELECT COUNT(*) as count FROM materials WHERE platform = ?')
            .get(platform);
        return result.count;
    }
    const result = db.prepare('SELECT COUNT(*) as count FROM materials')
        .get();
    return result.count;
}
