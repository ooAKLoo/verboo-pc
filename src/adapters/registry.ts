/**
 * Platform Adapter Registry
 * 
 * Manages all platform adapters and provides URL matching functionality.
 */

import type { PlatformAdapter, CaptureResult } from './types';

class AdapterRegistry {
    private adapters: PlatformAdapter[] = [];

    /**
     * Register a new platform adapter
     */
    register(adapter: PlatformAdapter): void {
        // Avoid duplicate registration
        if (!this.adapters.some(a => a.platformName === adapter.platformName)) {
            this.adapters.push(adapter);
            console.log(`[AdapterRegistry] Registered adapter: ${adapter.platformName}`);
        }
    }

    /**
     * Get adapter that matches the given URL
     */
    getAdapter(url: string): PlatformAdapter | null {
        for (const adapter of this.adapters) {
            if (adapter.match(url)) {
                return adapter;
            }
        }
        return null;
    }

    /**
     * Check if any adapter can handle the given URL
     */
    canHandle(url: string): boolean {
        return this.getAdapter(url) !== null;
    }

    /**
     * Get all registered adapters
     */
    getAllAdapters(): PlatformAdapter[] {
        return [...this.adapters];
    }

    /**
     * Get list of supported platform names
     */
    getSupportedPlatforms(): string[] {
        return this.adapters.map(a => a.platformName);
    }
}

// Singleton instance
export const adapterRegistry = new AdapterRegistry();

// Export the class for testing
export { AdapterRegistry };
