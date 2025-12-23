"use strict";
/**
 * Platform Adapters - Main Entry Point
 *
 * This file exports the adapter registry and ensures all adapters are registered.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericAdapter = exports.XHSAdapter = exports.BilibiliAdapter = exports.YouTubeAdapter = exports.genericAdapter = exports.adapterRegistry = exports.isCaptureError = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "isCaptureError", { enumerable: true, get: function () { return types_1.isCaptureError; } });
// Export registry
var registry_1 = require("./registry");
Object.defineProperty(exports, "adapterRegistry", { enumerable: true, get: function () { return registry_1.adapterRegistry; } });
// Import adapters to trigger auto-registration
require("./youtube-adapter");
require("./bilibili-adapter");
require("./xhs-adapter");
// Export generic adapter (used as fallback, not auto-registered)
var generic_adapter_1 = require("./generic-adapter");
Object.defineProperty(exports, "genericAdapter", { enumerable: true, get: function () { return generic_adapter_1.genericAdapter; } });
// Re-export adapter classes for direct use if needed
var youtube_adapter_1 = require("./youtube-adapter");
Object.defineProperty(exports, "YouTubeAdapter", { enumerable: true, get: function () { return youtube_adapter_1.YouTubeAdapter; } });
var bilibili_adapter_1 = require("./bilibili-adapter");
Object.defineProperty(exports, "BilibiliAdapter", { enumerable: true, get: function () { return bilibili_adapter_1.BilibiliAdapter; } });
var xhs_adapter_1 = require("./xhs-adapter");
Object.defineProperty(exports, "XHSAdapter", { enumerable: true, get: function () { return xhs_adapter_1.XHSAdapter; } });
var generic_adapter_2 = require("./generic-adapter");
Object.defineProperty(exports, "GenericAdapter", { enumerable: true, get: function () { return generic_adapter_2.GenericAdapter; } });
