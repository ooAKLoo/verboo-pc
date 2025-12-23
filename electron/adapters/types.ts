/**
 * Platform Adapter System - Type Definitions
 *
 * Unified interface for all platform adapters.
 * Each platform implements these interfaces to enable content/video capture.
 */

/**
 * Author/Channel information
 */
export interface AuthorInfo {
    name: string;
    avatar?: string;
    profileUrl?: string;
}

/**
 * Platform metadata
 */
export interface PlatformInfo {
    id: string;           // e.g., 'youtube', 'bilibili', 'xhs'
    name: string;         // Display name, e.g., 'YouTube', '哔哩哔哩'
    favicon: string;      // Favicon URL
}

/**
 * Content capture result (articles, posts, etc.)
 */
export interface ContentCaptureResult {
    title: string;
    content: string;
    images: string[];
    author: AuthorInfo;
    tags: string[];
    url: string;
    capturedAt: string;
}

/**
 * Video frame capture result
 */
export interface VideoCaptureResult {
    imageData: string;      // Base64 PNG
    timestamp: number;      // Current time in seconds
    duration: number;       // Total duration
    videoUrl: string;
    videoTitle: string;
    width: number;
    height: number;
    author: AuthorInfo;
}

/**
 * Adapter capabilities
 */
export interface AdapterCapabilities {
    /** Can capture content (articles, posts) */
    canCaptureContent: boolean;
    /** Can capture video frames */
    canCaptureVideo: boolean;
    /** Can extract subtitles */
    canExtractSubtitles: boolean;
}

/**
 * Base Platform Adapter Interface
 *
 * All platform adapters must implement this interface.
 * Adapters should be stateless and work purely with DOM.
 */
export interface PlatformAdapter {
    /**
     * Platform metadata
     */
    readonly platform: PlatformInfo;

    /**
     * Adapter capabilities
     */
    readonly capabilities: AdapterCapabilities;

    /**
     * Check if this adapter can handle the given URL
     */
    match(url: string): boolean;

    /**
     * Get author/channel info from the current page
     * Returns null if not available
     */
    getAuthorInfo(): AuthorInfo | null;

    /**
     * Get video title from the current page
     * Returns null if not on a video page
     */
    getVideoTitle(): string | null;

    /**
     * Find the main video element on the page
     * Returns null if no video found
     */
    findVideoElement(): HTMLVideoElement | null;

    /**
     * Capture content from the current page (articles, posts, etc.)
     * Returns null if content capture is not supported or failed
     */
    captureContent(): ContentCaptureResult | null;
}

/**
 * Error result for capture operations
 */
export interface CaptureError {
    error: string;
    code?: string;
}

/**
 * Combined capture result type
 */
export type CaptureResult<T> = T | CaptureError;

/**
 * Check if result is an error
 */
export function isCaptureError(result: any): result is CaptureError {
    return result && typeof result.error === 'string';
}
