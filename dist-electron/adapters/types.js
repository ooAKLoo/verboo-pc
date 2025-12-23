"use strict";
/**
 * Platform Adapter System - Type Definitions
 *
 * Unified interface for all platform adapters.
 * Each platform implements these interfaces to enable content/video capture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCaptureError = isCaptureError;
/**
 * Check if result is an error
 */
function isCaptureError(result) {
    return result && typeof result.error === 'string';
}
