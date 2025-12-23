/**
 * Platform Adapters - Main Entry Point
 *
 * This file exports the adapter registry and ensures all adapters are registered.
 */

// Export types
export type {
    PlatformAdapter,
    PlatformInfo,
    AdapterCapabilities,
    AuthorInfo,
    ContentCaptureResult,
    VideoCaptureResult,
    CaptureError,
    CaptureResult
} from './types';

export { isCaptureError } from './types';

// Export registry
export { adapterRegistry } from './registry';

// Import adapters to trigger auto-registration
import './youtube-adapter';
import './bilibili-adapter';
import './xhs-adapter';

// Export generic adapter (used as fallback, not auto-registered)
export { genericAdapter } from './generic-adapter';

// Re-export adapter classes for direct use if needed
export { YouTubeAdapter } from './youtube-adapter';
export { BilibiliAdapter } from './bilibili-adapter';
export { XHSAdapter } from './xhs-adapter';
export { GenericAdapter } from './generic-adapter';
