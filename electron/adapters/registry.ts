/**
 * Platform Adapter Registry
 *
 * Singleton registry that manages all platform adapters.
 * Provides URL matching and adapter lookup functionality.
 */

import type { PlatformAdapter, PlatformInfo } from './types';

class AdapterRegistry {
    private adapters: Map<string, PlatformAdapter> = new Map();

    /**
     * Register a platform adapter
     */
    register(adapter: PlatformAdapter): void {
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
    getAdapterForUrl(url: string): PlatformAdapter | null {
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
    getAdapter(platformId: string): PlatformAdapter | null {
        return this.adapters.get(platformId) || null;
    }

    /**
     * Check if any adapter can handle the URL
     */
    canHandle(url: string): boolean {
        return this.getAdapterForUrl(url) !== null;
    }

    /**
     * Get all registered adapters
     */
    getAllAdapters(): PlatformAdapter[] {
        return Array.from(this.adapters.values());
    }

    /**
     * Get all platform info
     */
    getAllPlatforms(): PlatformInfo[] {
        return this.getAllAdapters().map(a => a.platform);
    }

    /**
     * Get platforms that support content capture
     */
    getContentCapablePlatforms(): PlatformInfo[] {
        return this.getAllAdapters()
            .filter(a => a.capabilities.canCaptureContent)
            .map(a => a.platform);
    }

    /**
     * Get platforms that support video capture
     */
    getVideoCapablePlatforms(): PlatformInfo[] {
        return this.getAllAdapters()
            .filter(a => a.capabilities.canCaptureVideo)
            .map(a => a.platform);
    }
}

// Singleton instance
export const adapterRegistry = new AdapterRegistry();
