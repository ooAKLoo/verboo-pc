import React, { useRef, useEffect, useState } from 'react';

declare global {
    interface Window {
        require: NodeRequire;
    }
}

const { ipcRenderer } = window.require('electron');

export interface BrowserViewHandle {
    executeScript: (script: string) => Promise<any>;
    getCurrentUrl: () => Promise<string>;
}

interface BrowserViewProps {
    tabId: string;
    initialUrl: string;
    isActive: boolean;
    onData?: (data: any, tabId: string) => void;
    onTitleChange?: (title: string, tabId: string) => void;
}

export const BrowserView = React.forwardRef<BrowserViewHandle, BrowserViewProps>(
    ({ tabId, initialUrl, isActive, onData, onTitleChange }, ref) => {
        const [url, setUrl] = useState(initialUrl);
        const [inputUrl, setInputUrl] = useState(initialUrl);
        const [isLoading, setIsLoading] = useState(false);
        const [canGoBack, setCanGoBack] = useState(false);
        const [canGoForward, setCanGoForward] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);
        const [viewCreated, setViewCreated] = useState(false);

        React.useImperativeHandle(ref, () => ({
            executeScript: async (script: string) => {
                const response = await ipcRenderer.invoke('execute-script-in-tab', { tabId, script });
                if (response.success) {
                    return response.data;
                }
                throw new Error(response.error);
            },
            getCurrentUrl: async () => {
                const response = await ipcRenderer.invoke('get-tab-navigation-state', tabId);
                if (response.success) {
                    return response.url;
                }
                return '';
            }
        }));

        // Calculate bounds for WebContentsView
        const getBounds = () => {
            if (!containerRef.current) {
                return { x: 0, y: 0, width: 800, height: 600 };
            }
            const rect = containerRef.current.getBoundingClientRect();
            return {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
        };

        // Create view on mount
        useEffect(() => {
            const createView = async () => {
                // Wait for DOM to be ready
                await new Promise(resolve => setTimeout(resolve, 100));

                const bounds = getBounds();
                console.log(`[BrowserView] Creating view for tab ${tabId}`, bounds);

                const response = await ipcRenderer.invoke('create-tab-view', { tabId, url, bounds });
                if (response.success) {
                    setViewCreated(true);
                    console.log(`[BrowserView] View created for tab ${tabId}`);
                } else {
                    console.error(`[BrowserView] Failed to create view:`, response.error);
                }
            };

            createView();

            // Cleanup on unmount
            return () => {
                console.log(`[BrowserView] Removing view for tab ${tabId}`);
                ipcRenderer.invoke('remove-tab-view', tabId);
            };
        }, [tabId]);

        // Handle tab activation/deactivation
        useEffect(() => {
            if (!viewCreated) return;

            const updateViewVisibility = async () => {
                const bounds = getBounds();

                if (isActive) {
                    console.log(`[BrowserView] Showing tab ${tabId}`, bounds);
                    await ipcRenderer.invoke('show-tab-view', { tabId, bounds });
                    updateNavigationState();
                } else {
                    console.log(`[BrowserView] Hiding tab ${tabId}`);
                    await ipcRenderer.invoke('hide-tab-view', tabId);
                }
            };

            updateViewVisibility();
        }, [isActive, viewCreated]);

        // Handle window resize
        useEffect(() => {
            if (!viewCreated || !isActive) return;

            const handleResize = () => {
                const bounds = getBounds();
                console.log(`[BrowserView] Resizing tab ${tabId}`, bounds);
                ipcRenderer.invoke('show-tab-view', { tabId, bounds });
            };

            // Debounce resize events
            let resizeTimer: NodeJS.Timeout;
            const debouncedResize = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(handleResize, 100);
            };

            window.addEventListener('resize', debouncedResize);
            return () => {
                window.removeEventListener('resize', debouncedResize);
                clearTimeout(resizeTimer);
            };
        }, [viewCreated, isActive, tabId]);

        // Listen for events from main process
        useEffect(() => {
            const handleLoadingChanged = (_event: any, data: any) => {
                if (data.tabId === tabId) {
                    setIsLoading(data.isLoading);
                }
            };

            const handleNavigated = (_event: any, data: any) => {
                if (data.tabId === tabId) {
                    setInputUrl(data.url);
                    updateNavigationState();
                }
            };

            const handleTitleChanged = (_event: any, data: any) => {
                if (data.tabId === tabId && onTitleChange) {
                    onTitleChange(data.title, tabId);
                }
            };

            ipcRenderer.on('tab-loading-changed', handleLoadingChanged);
            ipcRenderer.on('tab-navigated', handleNavigated);
            ipcRenderer.on('tab-title-changed', handleTitleChanged);

            return () => {
                ipcRenderer.removeListener('tab-loading-changed', handleLoadingChanged);
                ipcRenderer.removeListener('tab-navigated', handleNavigated);
                ipcRenderer.removeListener('tab-title-changed', handleTitleChanged);
            };
        }, [tabId, onTitleChange]);

        // Update navigation state
        const updateNavigationState = async () => {
            const response = await ipcRenderer.invoke('get-tab-navigation-state', tabId);
            if (response.success) {
                setCanGoBack(response.canGoBack);
                setCanGoForward(response.canGoForward);
            }
        };

        const handleNavigate = async (e: React.FormEvent) => {
            e.preventDefault();
            let target = inputUrl;
            if (!target.startsWith('http')) {
                target = 'https://' + target;
            }
            setUrl(target);
            await ipcRenderer.invoke('navigate-tab-view', { tabId, url: target });
        };

        const goBack = async () => {
            await ipcRenderer.invoke('tab-go-back', tabId);
            setTimeout(updateNavigationState, 100);
        };

        const goForward = async () => {
            await ipcRenderer.invoke('tab-go-forward', tabId);
            setTimeout(updateNavigationState, 100);
        };

        const reload = async () => {
            await ipcRenderer.invoke('tab-reload', tabId);
        };

        return (
            <div className={`flex flex-col h-full ${isActive ? '' : 'hidden'}`}>
                {/* Top Toolbar - Fixed position */}
                <div className="flex-shrink-0 p-2 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        {/* Navigation buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={goBack}
                                disabled={!canGoBack}
                                className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${!canGoBack ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                                title="Back"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            </button>
                            <button
                                onClick={goForward}
                                disabled={!canGoForward}
                                className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${!canGoForward ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                                title="Forward"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                            <button
                                onClick={reload}
                                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
                                title="Reload"
                            >
                                {isLoading ? (
                                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                                )}
                            </button>
                        </div>

                        {/* URL input */}
                        <form onSubmit={handleNavigate} className="flex-1">
                            <input
                                type="text"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter URL..."
                            />
                        </form>
                    </div>
                </div>

                {/* WebContentsView Container */}
                <div ref={containerRef} className="flex-1 w-full bg-white" />
            </div>
        );
    });
