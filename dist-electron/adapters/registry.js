"use strict";
/**
 * Platform Adapter Registry
 *
 * Singleton registry that manages all platform adapters.
 * Provides URL matching and adapter lookup functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterRegistry = void 0;
class AdapterRegistry {
    adapters = new Map();
    /**
     * Register a platform adapter
     */
    register(adapter) {
        const id = adapter.platform.id;
        if (this.adapters.has(id)) {
            console.warn(`[AdapterRegistry] Adapter '${id}' already registered, skipping`);
            return;
        }
        this.adapters.set(id, adapter);
        console.log(`[AdapterRegistry] Registered: ${adapter.platform.name}`);
    }
    /**
     * Get adapter that matches the given URL
     */
    getAdapterForUrl(url) {
        for (const adapter of this.adapters.values()) {
            if (adapter.match(url)) {
                return adapter;
            }
        }
        return null;
    }
    /**
     * Get adapter by platform ID
     */
    getAdapter(platformId) {
        return this.adapters.get(platformId) || null;
    }
    /**
     * Check if any adapter can handle the URL
     */
    canHandle(url) {
        return this.getAdapterForUrl(url) !== null;
    }
    /**
     * Get all registered adapters
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    /**
     * Get all platform info
     */
    getAllPlatforms() {
        return this.getAllAdapters().map(a => a.platform);
    }
    /**
     * Get platforms that support content capture
     */
    getContentCapablePlatforms() {
        return this.getAllAdapters()
            .filter(a => a.capabilities.canCaptureContent)
            .map(a => a.platform);
    }
    /**
     * Get platforms that support video capture
     */
    getVideoCapablePlatforms() {
        return this.getAllAdapters()
            .filter(a => a.capabilities.canCaptureVideo)
            .map(a => a.platform);
    }
}
// Singleton instance
exports.adapterRegistry = new AdapterRegistry();
