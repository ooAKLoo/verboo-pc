import React, { useRef, useEffect, useState } from 'react';

declare global {
    interface Window {
        require: (module: string) => any;
    }
}

const { ipcRenderer } = window.require('electron');

// Fixed view ID for single browser view
const VIEW_ID = 'main-view';

export interface BrowserViewHandle {
    executeScript: (script: string) => Promise<any>;
    getCurrentUrl: () => string;
    captureVideoFrame: () => Promise<any>;
    goBack: () => void;
    goForward: () => void;
    reload: () => void;
    navigate: (targetUrl: string) => void;
    setInputUrl: (url: string) => void;
}

export interface NavigationState {
    inputUrl: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
}

interface BrowserViewProps {
    initialUrl: string;
    onData?: (data: any) => void;
    onTitleChange?: (title: string) => void;
    onUrlChange?: (url: string) => void;
    onNavigationStateChange?: (state: NavigationState) => void;
}

export const BrowserView = React.forwardRef<BrowserViewHandle, BrowserViewProps>(
    ({ initialUrl, onData, onTitleChange, onUrlChange, onNavigationStateChange }, ref) => {
        const [inputUrl, setInputUrl] = useState(initialUrl);
        const [isLoading, setIsLoading] = useState(false);
        const [canGoBack, setCanGoBack] = useState(false);
        const [canGoForward, setCanGoForward] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);
        const isCreatedRef = useRef(false);
        const pendingCaptureRef = useRef<{
            resolve: (value: any) => void;
            reject: (reason: any) => void;
        } | null>(null);

        // Store callbacks in refs to avoid re-renders
        const onDataRef = useRef(onData);
        const onTitleChangeRef = useRef(onTitleChange);
        const onUrlChangeRef = useRef(onUrlChange);
        const onNavigationStateChangeRef = useRef(onNavigationStateChange);
        onDataRef.current = onData;
        onTitleChangeRef.current = onTitleChange;
        onUrlChangeRef.current = onUrlChange;
        onNavigationStateChangeRef.current = onNavigationStateChange;

        // Create WebContentsView when component mounts
        useEffect(() => {
            if (!isCreatedRef.current) {
                isCreatedRef.current = true;
                ipcRenderer.invoke('wcv-create', VIEW_ID, initialUrl);
                console.log('[BrowserView] Created WebContentsView');
            }

            return () => {
                // Delay destroy to handle React StrictMode
                setTimeout(() => {
                    if (!document.querySelector(`[data-view-id="${VIEW_ID}"]`)) {
                        ipcRenderer.invoke('wcv-destroy', VIEW_ID);
                        console.log('[BrowserView] Destroyed WebContentsView');
                    }
                }, 100);
            };
        }, [initialUrl]);

        // Update bounds when container size changes
        useEffect(() => {
            const updateBounds = () => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    ipcRenderer.invoke('wcv-update-bounds', {
                        x: Math.round(rect.left),
                        y: Math.round(rect.top),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    });
                }
            };

            // Initial update
            updateBounds();

            // Use ResizeObserver to track size changes
            const resizeObserver = new ResizeObserver(updateBounds);
            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
            }

            // Also update on window resize
            window.addEventListener('resize', updateBounds);

            return () => {
                resizeObserver.disconnect();
                window.removeEventListener('resize', updateBounds);
            };
        }, []);

        // Setup IPC event listeners
        useEffect(() => {
            const handleDidStartLoading = (event: any, viewId: string) => {
                if (viewId === VIEW_ID) {
                    setIsLoading(true);
                }
            };

            const handleDidStopLoading = (event: any, viewId: string) => {
                if (viewId === VIEW_ID) {
                    setIsLoading(false);
                }
            };

            const handleDidNavigate = (event: any, viewId: string, eventUrl: string) => {
                if (viewId === VIEW_ID) {
                    setInputUrl(eventUrl);
                    ipcRenderer.invoke('wcv-get-nav-state', VIEW_ID).then((result: any) => {
                        if (result.success) {
                            setCanGoBack(result.canGoBack);
                            setCanGoForward(result.canGoForward);
                        }
                    });
                    if (onUrlChangeRef.current) {
                        onUrlChangeRef.current(eventUrl);
                    }
                }
            };

            const handleDidNavigateInPage = (event: any, viewId: string, eventUrl: string) => {
                if (viewId === VIEW_ID) {
                    setInputUrl(eventUrl);
                    ipcRenderer.invoke('wcv-get-nav-state', VIEW_ID).then((result: any) => {
                        if (result.success) {
                            setCanGoBack(result.canGoBack);
                            setCanGoForward(result.canGoForward);
                        }
                    });
                    if (onUrlChangeRef.current) {
                        onUrlChangeRef.current(eventUrl);
                    }
                }
            };

            const handlePageTitleUpdated = (event: any, viewId: string, title: string) => {
                if (viewId === VIEW_ID && onTitleChangeRef.current) {
                    onTitleChangeRef.current(title);
                }
            };

            const handleIpcMessage = (event: any, viewId: string, channel: string, data: any) => {
                if (viewId !== VIEW_ID) return;

                if (channel === 'plugin-data' && onDataRef.current) {
                    onDataRef.current(data);
                } else if (channel === 'bilibili-ai-subtitle' && onDataRef.current) {
                    console.log('[BrowserView] Bilibili AI subtitle received:', data);
                    onDataRef.current({
                        type: 'bilibili-ai-subtitle',
                        data: data.data,
                        count: data.count
                    });
                } else if (channel === 'video-time-update' && onDataRef.current) {
                    onDataRef.current({
                        type: 'video-time',
                        data: data
                    });
                } else if (channel === 'material-saved' && onDataRef.current) {
                    onDataRef.current({ type: 'material-saved', data: data });
                }
            };

            const handleVideoCaptureResult = (event: any, viewId: string, result: any) => {
                if (viewId === VIEW_ID && pendingCaptureRef.current) {
                    if (result.error) {
                        pendingCaptureRef.current.reject(result);
                    } else {
                        pendingCaptureRef.current.resolve(result);
                    }
                    pendingCaptureRef.current = null;
                }
            };

            ipcRenderer.on('wcv-did-start-loading', handleDidStartLoading);
            ipcRenderer.on('wcv-did-stop-loading', handleDidStopLoading);
            ipcRenderer.on('wcv-did-navigate', handleDidNavigate);
            ipcRenderer.on('wcv-did-navigate-in-page', handleDidNavigateInPage);
            ipcRenderer.on('wcv-page-title-updated', handlePageTitleUpdated);
            ipcRenderer.on('wcv-ipc-message', handleIpcMessage);
            ipcRenderer.on('wcv-video-capture-result', handleVideoCaptureResult);

            return () => {
                ipcRenderer.removeListener('wcv-did-start-loading', handleDidStartLoading);
                ipcRenderer.removeListener('wcv-did-stop-loading', handleDidStopLoading);
                ipcRenderer.removeListener('wcv-did-navigate', handleDidNavigate);
                ipcRenderer.removeListener('wcv-did-navigate-in-page', handleDidNavigateInPage);
                ipcRenderer.removeListener('wcv-page-title-updated', handlePageTitleUpdated);
                ipcRenderer.removeListener('wcv-ipc-message', handleIpcMessage);
                ipcRenderer.removeListener('wcv-video-capture-result', handleVideoCaptureResult);
            };
        }, []);

        // Notify parent of navigation state changes
        useEffect(() => {
            if (onNavigationStateChangeRef.current) {
                onNavigationStateChangeRef.current({ inputUrl, isLoading, canGoBack, canGoForward });
            }
        }, [inputUrl, isLoading, canGoBack, canGoForward]);

        // Expose methods via ref
        React.useImperativeHandle(ref, () => ({
            executeScript: async (script: string) => {
                const result = await ipcRenderer.invoke('wcv-execute-script', VIEW_ID, script);
                return result.success ? result.result : null;
            },
            getCurrentUrl: () => {
                return inputUrl;
            },
            captureVideoFrame: () => {
                return new Promise((resolve, reject) => {
                    pendingCaptureRef.current = { resolve, reject };
                    ipcRenderer.invoke('wcv-send', VIEW_ID, 'execute-video-capture');

                    setTimeout(() => {
                        if (pendingCaptureRef.current) {
                            pendingCaptureRef.current.reject({ error: 'Capture timeout' });
                            pendingCaptureRef.current = null;
                        }
                    }, 5000);
                });
            },
            goBack: () => {
                ipcRenderer.invoke('wcv-go-back', VIEW_ID);
            },
            goForward: () => {
                ipcRenderer.invoke('wcv-go-forward', VIEW_ID);
            },
            reload: () => {
                ipcRenderer.invoke('wcv-reload', VIEW_ID);
            },
            navigate: (targetUrl: string) => {
                let finalUrl = targetUrl;
                if (!finalUrl.startsWith('http')) {
                    finalUrl = 'https://' + finalUrl;
                }
                setInputUrl(finalUrl);
                ipcRenderer.invoke('wcv-navigate', VIEW_ID, finalUrl);
            },
            setInputUrl: (newUrl: string) => setInputUrl(newUrl)
        }));

        return (
            <div
                ref={containerRef}
                data-view-id={VIEW_ID}
                className="flex flex-col h-full relative bg-white"
            >
                {/* WebContentsView will be positioned over this area by main process */}
                <div className="flex-1 w-full h-full" />
            </div>
        );
    });
