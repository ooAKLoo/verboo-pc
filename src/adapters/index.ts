/**
 * Platform Adapters - Main Export
 * 
 * This file exports all adapter-related modules and auto-registers adapters.
 */

// Export types
export type {
    PlatformAdapter,
    CaptureResult,
    Material,
    Author,
    MaterialRow
} from './types';

export {
    rowToMaterial,
    captureResultToRow
} from './types';

// Export registry
export { adapterRegistry, AdapterRegistry } from './registry';

// Import adapters to trigger auto-registration
import './xhs-adapter';

// Re-export adapter classes for direct use if needed
export { XHSAdapter } from './xhs-adapter';
