import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Loader2 } from 'lucide-react';

// Type definition for the webview tag to avoid TS errors
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'webview': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                src?: string;
                id?: string;
                useragent?: string;
                partition?: string;
                webpreferences?: string;
                allowpopups?: string | boolean;
                preload?: string;
            }, HTMLElement>;
        }
    }
}

// @ts-ignore
// import { ipcRenderer } from 'electron'; 
// import path from 'path';

// Use window.require to access Node APIs in the renderer process (with nodeIntegration: true)
// This avoids Vite trying to bundle the 'electron' or 'path' npm packages.
declare global {
    interface Window {
        require: (module: string) => any;
    }
}

const { ipcRenderer } = window.require('electron');
const path = window.require('path');

// Generate Chrome-like User-Agent based on platform
function getChromeUserAgent(): string {
    const chromeVersion = '131.0.0.0';
    const platform = window.navigator.platform;

    if (platform.includes('Mac')) {
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    } else if (platform.includes('Win')) {
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    } else {
        return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
}

const CHROME_USER_AGENT = getChromeUserAgent();

export interface BrowserViewHandle {
    executeScript: (script: string) => Promise<any>;
    getCurrentUrl: () => string;
    captureVideoFrame: () => Promise<any>;
}

interface BrowserViewProps {
    tabId: string;
    initialUrl: string;
    isActive: boolean;
    onData?: (data: any, tabId: string) => void;
    onTitleChange?: (title: string, tabId: string) => void;
    onUrlChange?: (url: string, tabId: string) => void;
}

export const BrowserView = React.forwardRef<BrowserViewHandle, BrowserViewProps>(
    ({ tabId, initialUrl, isActive, onData, onTitleChange, onUrlChange }, ref) => {
        const [url, setUrl] = useState(initialUrl);
        const [inputUrl, setInputUrl] = useState(initialUrl);
        const [isLoading, setIsLoading] = useState(false);
        const [canGoBack, setCanGoBack] = useState(false);
        const [canGoForward, setCanGoForward] = useState(false);
        const webviewRef = useRef<any>(null);

        // Calculate preload script path
        // In development: inside electron folder (but we need compiled js) or dist-electron
        // In production: resources path
        const preloadPath = React.useMemo(() => {
            // Since we are in renderer with nodeIntegration: true, we can use __dirname or process.cwd()
            // But __dirname in vite dev might be weird.
            // Let's assume standard electron-vite structure: dist-electron/webview-preload.js
            const process = window.require('process');
            return path.resolve(process.cwd(), 'dist-electron/webview-preload.js');
        }, []);

        React.useImperativeHandle(ref, () => ({
            executeScript: async (script: string) => {
                if (webviewRef.current) {
                    return webviewRef.current.executeJavaScript(script);
                }
                return null;
            },
            getCurrentUrl: () => {
                return url; // Return the current URL
            },
            captureVideoFrame: async () => {
                return new Promise((resolve, reject) => {
                    if (!webviewRef.current) {
                        reject({ error: 'Webview not available' });
                        return;
                    }

                    // Set up one-time listener for the result
                    const handleResult = (event: any) => {
                        if (event.channel === 'video-capture-result') {
                            const result = event.args[0];
                            if (result.error) {
                                reject(result);
                            } else {
                                resolve(result);
                            }
                        }
                    };

                    webviewRef.current.addEventListener('ipc-message', handleResult);

                    // Send capture command
                    webviewRef.current.send('execute-video-capture');

                    // Clean up after 5 seconds timeout
                    setTimeout(() => {
                        webviewRef.current?.removeEventListener('ipc-message', handleResult);
                        reject({ error: 'Capture timeout' });
                    }, 5000);
                });
            }
        }));

        useEffect(() => {
            const webview = webviewRef.current;
            if (!webview) return;

            const handleDidStartLoading = () => setIsLoading(true);
            const handleDidStopLoading = () => setIsLoading(false);

            // Update URL bar and nav state when page changes
            const handleDidNavigate = (e: any) => {
                setInputUrl(e.url);
                setCanGoBack(webview.canGoBack());
                setCanGoForward(webview.canGoForward());
                // Notify parent of URL change for auto-loading subtitles
                if (onUrlChange) {
                    onUrlChange(e.url, tabId);
                }
            };

            // Also catch in-page navigations
            const handleDidNavigateInPage = (e: any) => {
                setInputUrl(e.url);
                setCanGoBack(webview.canGoBack());
                setCanGoForward(webview.canGoForward());
                // Notify parent of URL change for auto-loading subtitles
                if (onUrlChange) {
                    onUrlChange(e.url, tabId);
                }
            };

            // Update tab title when page title changes
            const handlePageTitleUpdated = (e: any) => {
                if (onTitleChange && e.title) {
                    onTitleChange(e.title, tabId);
                }
            };

            const handleIpcMessage = (event: any) => {
                if (event.channel === 'plugin-data' && onData) {
                    onData(event.args[0], tabId);
                } else if (event.channel === 'bilibili-ai-subtitle' && onData) {
                    // Handle Bilibili AI subtitle data
                    const result = event.args[0];
                    console.log('[BrowserView] Bilibili AI subtitle received:', result);
                    onData({
                        type: 'bilibili-ai-subtitle',
                        data: result.data,
                        count: result.count
                    }, tabId);
                } else if (event.channel === 'video-time-update' && onData) {
                    // Send video time update with a special type
                    onData({
                        type: 'video-time',
                        data: event.args[0]
                    }, tabId);
                } else if (event.channel === 'show-context-menu') {
                    // Forward to main process to show context menu
                    const { x, y, canCapture, platform } = event.args[0];
                    console.log('[BrowserView] Context menu requested:', { canCapture, platform });
                    ipcRenderer.send('show-save-material-menu', { x, y, canCapture, platform });
                } else if (event.channel === 'capture-result') {
                    // Handle capture result from webview
                    const result = event.args[0];
                    console.log('[BrowserView] Capture result received:', result);
                    if (result && !result.error) {
                        // Transform to new save-content format
                        const contentData = {
                            platform: result.platform,
                            title: result.title,
                            url: result.originalUrl,
                            author: result.author,
                            content: result.content,
                            tags: result.tags || [],
                            images: result.images || [],
                            capturedAt: result.capturedAt,
                        };
                        // Send to main process to save using new API
                        ipcRenderer.invoke('save-content', contentData).then((response: any) => {
                            if (response.success) {
                                console.log('[BrowserView] Content saved:', response.data.id);
                                // Notify parent to refresh materials
                                if (onData) {
                                    onData({ type: 'material-saved', data: response.data }, tabId);
                                }
                            } else {
                                console.error('[BrowserView] Save failed:', response.error);
                            }
                        });
                    }
                }
            };

            // Listen for capture command from main process
            const handleCaptureCommand = () => {
                console.log('[BrowserView] Capture command received, forwarding to webview');
                if (webview && isActive) {
                    webview.send('execute-capture');
                }
            };

            ipcRenderer.on('capture-material', handleCaptureCommand);

            webview.addEventListener('did-start-loading', handleDidStartLoading);
            webview.addEventListener('did-stop-loading', handleDidStopLoading);
            webview.addEventListener('did-navigate', handleDidNavigate);
            webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage);
            webview.addEventListener('page-title-updated', handlePageTitleUpdated);
            webview.addEventListener('ipc-message', handleIpcMessage);

            return () => {
                if (!webview) return;
                ipcRenderer.removeListener('capture-material', handleCaptureCommand);
                webview.removeEventListener('did-start-loading', handleDidStartLoading);
                webview.removeEventListener('did-stop-loading', handleDidStopLoading);
                webview.removeEventListener('did-navigate', handleDidNavigate);
                webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage);
                webview.removeEventListener('page-title-updated', handlePageTitleUpdated);
                webview.removeEventListener('ipc-message', handleIpcMessage);
            };
        }, [onData, onUrlChange, isActive, tabId]);

        const handleNavigate = (e: React.FormEvent) => {
            e.preventDefault();
            let target = inputUrl;
            if (!target.startsWith('http')) {
                target = 'https://' + target;
            }
            setUrl(target);
            // Setting url prop triggers webview navigation, but we can also use loadURL if we wanted
        };

        const goBack = () => webviewRef.current?.goBack();
        const goForward = () => webviewRef.current?.goForward();
        const reload = () => webviewRef.current?.reload();

        return (
            <div className={`flex flex-col h-full relative group bg-white ${isActive ? '' : 'hidden'}`}>
                {/* Floating Toolbar - moved to bottom to avoid blocking content */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 w-[600px] max-w-[90%] transition-all duration-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 translate-y-[10px] group-hover:translate-y-0 focus-within:translate-y-0">
                    <div className="bg-white/90 backdrop-blur-md shadow-lg border border-gray-200 rounded-full px-4 py-2 flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={goBack}
                                disabled={!canGoBack}
                                className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoBack ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <button
                                onClick={goForward}
                                disabled={!canGoForward}
                                className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoForward ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                            >
                                <ArrowRight size={16} />
                            </button>
                            <button onClick={reload} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                                {isLoading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <RotateCw size={16} />
                                )}
                            </button>
                        </div>

                        <form onSubmit={handleNavigate} className="flex-1 flex items-center border-l border-gray-200 pl-3 ml-1">
                            <input
                                type="text"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none font-medium"
                                placeholder="Enter URL..."
                            />
                        </form>
                    </div>
                </div>

                {/* Webview Container */}
                <div className="flex-1 w-full h-full pt-0">
                    <webview
                        ref={webviewRef}
                        src={url}
                        className="w-full h-full rounded-none shadow-inner bg-white"
                        preload={`file://${preloadPath}`}
                        useragent={CHROME_USER_AGENT}
                        allowpopups={true}
                        partition="persist:webview"
                        webpreferences="contextIsolation=no, nodeIntegration=yes, enableRemoteModule=no, javascript=yes, plugins=yes, webSecurity=yes"
                    />
                </div>
            </div>
        );
    });

