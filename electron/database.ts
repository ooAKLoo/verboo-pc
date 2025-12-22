/**
 * SQLite Database Module
 * 
 * Manages SQLite database for storing captured materials.
 * Uses better-sqlite3 for synchronous database operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

interface MaterialRow {
    id: number;
    platform: string;
    title: string | null;
    content: string | null;
    author_name: string | null;
    author_avatar: string | null;
    author_profile_url: string | null;
    tags: string | null;
    images: string | null;
    original_url: string;
    captured_at: string;
    created_at: string;
    published_at: string | null;
    stats: string | null;
}

interface Material {
    id: number;
    platform: string;
    title: string;
    content: string;
    author: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    tags: string[];
    images: string[];
    originalUrl: string;
    capturedAt: Date;
    createdAt: Date;
    publishedAt?: Date;
    stats?: {
        likes?: number;
        comments?: number;
        shares?: number;
        collects?: number;
        views?: number;
    };
}

interface SaveMaterialInput {
    platform: string;
    title: string;
    content: string;
    author: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    tags: string[];
    images: string[];
    originalUrl: string;
    capturedAt: Date;
    publishedAt?: Date;
    stats?: {
        likes?: number;
        comments?: number;
        shares?: number;
        collects?: number;
        views?: number;
    };
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT,
      stats TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_materials_platform ON materials(platform);
    CREATE INDEX IF NOT EXISTS idx_materials_captured_at ON materials(captured_at);
    CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at);
  `);

    // Add published_at and stats columns if they don't exist (for existing databases)
    try {
        db.exec('ALTER TABLE materials ADD COLUMN published_at TEXT');
    } catch (e) {
        // Column already exists
    }
    try {
        db.exec('ALTER TABLE materials ADD COLUMN stats TEXT');
    } catch (e) {
        // Column already exists
    }

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

/**
 * Convert database row to Material object
 */
function rowToMaterial(row: MaterialRow): Material {
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
        publishedAt: row.published_at ? new Date(row.published_at) : undefined,
        stats: row.stats ? JSON.parse(row.stats) : undefined,
    };
}

/**
 * Save a material to database
 */
export function saveMaterial(input: SaveMaterialInput): Material {
    const db = getDatabase();

    const stmt = db.prepare(`
    INSERT INTO materials (
      platform, title, content, author_name, author_avatar,
      author_profile_url, tags, images, original_url, captured_at, published_at, stats
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const result = stmt.run(
        input.platform,
        input.title,
        input.content,
        input.author.name,
        input.author.avatar || null,
        input.author.profileUrl || null,
        JSON.stringify(input.tags),
        JSON.stringify(input.images),
        input.originalUrl,
        input.capturedAt.toISOString(),
        input.publishedAt ? input.publishedAt.toISOString() : null,
        input.stats ? JSON.stringify(input.stats) : null
    );

    console.log('[Database] Saved material with ID:', result.lastInsertRowid);

    // Fetch and return the saved material
    const savedRow = db.prepare('SELECT * FROM materials WHERE id = ?')
        .get(result.lastInsertRowid) as MaterialRow;

    return rowToMaterial(savedRow);
}

/**
 * Get all materials with pagination
 */
export function getMaterials(
    options: { limit?: number; offset?: number; platform?: string } = {}
): Material[] {
    const db = getDatabase();
    const { limit = 50, offset = 0, platform } = options;

    let query = 'SELECT * FROM materials';
    const params: any[] = [];

    if (platform) {
        query += ' WHERE platform = ?';
        params.push(platform);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as MaterialRow[];
    return rows.map(rowToMaterial);
}

/**
 * Get a single material by ID
 */
export function getMaterialById(id: number): Material | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as MaterialRow | undefined;
    return row ? rowToMaterial(row) : null;
}

/**
 * Delete a material by ID
 */
export function deleteMaterial(id: number): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    console.log('[Database] Deleted material with ID:', id, 'Changes:', result.changes);
    return result.changes > 0;
}

/**
 * Search materials by keyword
 */
export function searchMaterials(keyword: string, limit: number = 50): Material[] {
    const db = getDatabase();
    const searchPattern = `%${keyword}%`;

    const rows = db.prepare(`
    SELECT * FROM materials 
    WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(searchPattern, searchPattern, searchPattern, limit) as MaterialRow[];

    return rows.map(rowToMaterial);
}

/**
 * Get total count of materials
 */
export function getMaterialsCount(platform?: string): number {
    const db = getDatabase();

    if (platform) {
        const result = db.prepare('SELECT COUNT(*) as count FROM materials WHERE platform = ?')
            .get(platform) as { count: number };
        return result.count;
    }

    const result = db.prepare('SELECT COUNT(*) as count FROM materials')
        .get() as { count: number };
    return result.count;
}
