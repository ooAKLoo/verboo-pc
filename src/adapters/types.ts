/**
 * Platform Adapter System - Type Definitions
 * 
 * This module defines the core interfaces for the platform adapter system.
 * Each platform (XHS, Twitter, TikTok, Reddit, etc.) implements these interfaces
 * to enable content capture functionality.
 */

/**
 * Author information extracted from a post
 */
export interface Author {
    name: string;
    avatar?: string;
    profileUrl?: string;
}

/**
 * Engagement statistics for a post
 */
export interface EngagementStats {
    likes?: number;      // 点赞数
    comments?: number;   // 评论数
    shares?: number;     // 分享数
    collects?: number;   // 收藏数
    views?: number;      // 浏览数
}

/**
 * Result of capturing content from a platform
 */
export interface CaptureResult {
    platform: string;
    title: string;
    content: string;
    images: string[];
    author: Author;
    tags: string[];
    originalUrl: string;
    capturedAt: Date;
    publishedAt?: Date;  // 发帖时间
    stats?: EngagementStats;  // 互动统计
}

/**
 * Material stored in database
 */
export interface Material extends CaptureResult {
    id: number;
    createdAt: Date;
}

/**
 * Platform adapter interface
 * Implement this interface to add support for a new platform
 */
export interface PlatformAdapter {
    /**
     * Platform display name
     */
    readonly platformName: string;

    /**
     * Platform icon (emoji or icon class)
     */
    readonly platformIcon: string;

    /**
     * Check if this adapter can handle the given URL
     */
    match(url: string): boolean;

    /**
     * Get the extraction script to run in the webview context
     * Returns a string of JavaScript code that will be executed
     */
    getCaptureScript(): string;

    /**
     * Parse the raw extraction result into a CaptureResult
     */
    parseResult(rawData: any, url: string): CaptureResult;
}

/**
 * Database row structure for materials
 */
export interface MaterialRow {
    id: number;
    platform: string;
    title: string | null;
    content: string | null;
    author_name: string | null;
    author_avatar: string | null;
    author_profile_url: string | null;
    tags: string | null; // JSON string
    images: string | null; // JSON string
    original_url: string;
    captured_at: string;
    created_at: string;
    published_at: string | null;  // 发帖时间
    stats: string | null;  // JSON string for engagement stats
}

/**
 * Convert a database row to a Material object
 */
export function rowToMaterial(row: MaterialRow): Material {
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
 * Convert a CaptureResult to database insert parameters
 */
export function captureResultToRow(result: CaptureResult): Omit<MaterialRow, 'id' | 'created_at'> {
    return {
        platform: result.platform,
        title: result.title,
        content: result.content,
        author_name: result.author.name,
        author_avatar: result.author.avatar || null,
        author_profile_url: result.author.profileUrl || null,
        tags: JSON.stringify(result.tags),
        images: JSON.stringify(result.images),
        original_url: result.originalUrl,
        captured_at: result.capturedAt.toISOString(),
        published_at: result.publishedAt ? result.publishedAt.toISOString() : null,
        stats: result.stats ? JSON.stringify(result.stats) : null,
    };
}
