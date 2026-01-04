import { app, BrowserWindow, session, ipcMain, Menu, MenuItem, WebContentsView } from 'electron';
import path from 'path';

// 自动更新 (仅在生产环境启用)
let updaterInitialized = false;
async function initUpdaterIfNeeded(win: BrowserWindow) {
    if (updaterInitialized || process.env.VITE_DEV_SERVER_URL) return;
    try {
        const { initUpdater } = await import('./updater');
        initUpdater(win);
        updaterInitialized = true;
        console.log('[Main] Updater initialized');
    } catch (error) {
        console.log('[Main] Updater not available:', error);
    }
}

// Set app name as early as possible (before ready event)
app.name = 'Verboo';
import { getYouTubeSubtitles } from './youtube-service';
import {
    initDatabase,
    closeDatabase,
    // Asset functions
    saveContent,
    saveScreenshot,
    getAssets,
    getAssetById,
    updateAsset,
    deleteAsset,
    searchAssets,
    getAssetsCount,
    // Subtitle functions
    saveSubtitles,
    getSubtitlesByUrl,
    getSubtitlesById,
    getAllSubtitles,
    deleteSubtitles,
    // Vocabulary functions
    initVocabDatabase,
    closeVocabDatabase,
    lookupWord,
    lookupWords,
    analyzeTextDifficulty,
    getVocabularyByCategory,
    getVocabularyStats,
    // Platform icons & Author avatars functions
    saveOrUpdatePlatformIcon,
    saveOrUpdateAuthorAvatar,
    getPlatformIcon,
    getAuthorAvatar,
    getAuthorAvatarByName,
    // Types
    type AssetType,
    type WordInfo
} from './database';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Disable HTTP cache in development
if (process.env.VITE_DEV_SERVER_URL) {
    app.commandLine.appendSwitch('disable-http-cache');
}

// Ignore certificate errors in development (for SSL handshake issues)
if (process.env.VITE_DEV_SERVER_URL) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
}

// Get a realistic Chrome User-Agent based on platform
function getChromeUserAgent(): string {
    const chromeVersion = '131.0.0.0';
    const platform = process.platform;

    if (platform === 'darwin') {
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    } else if (platform === 'win32') {
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    } else {
        return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
}

// Export for use in renderer
export const CHROME_USER_AGENT = getChromeUserAgent();

// ============ WebContentsView Manager ============

// Store active WebContentsViews by tabId
const webContentsViews = new Map<string, WebContentsView>();
let mainWindow: BrowserWindow | null = null;

// Current active tab for positioning
let activeTabId: string | null = null;

// View bounds (will be updated by renderer)
let viewBounds = { x: 0, y: 0, width: 800, height: 600 };

/**
 * Create a new WebContentsView for a tab
 */
function createWebContentsView(tabId: string, url: string, initialVisible: boolean = true): void {
    if (!mainWindow) return;

    // Remove existing view if any
    if (webContentsViews.has(tabId)) {
        destroyWebContentsView(tabId);
    }

    const userAgent = getChromeUserAgent();

    const view = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, 'webview-preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        }
    });

    // Set user agent
    view.webContents.setUserAgent(userAgent);

    // Add to window's content view
    mainWindow.contentView.addChildView(view);

    // Set bounds
    view.setBounds(viewBounds);

    // Set border radius (Electron 33+ feature)
    if (typeof view.setBorderRadius === 'function') {
        view.setBorderRadius(16);
    }

    // Navigate to URL
    view.webContents.loadURL(url);

    // Store reference
    webContentsViews.set(tabId, view);

    // If no active tab yet, set this as active
    if (!activeTabId) {
        activeTabId = tabId;
    }

    // Set visibility based on initialVisible parameter
    if (initialVisible && tabId === activeTabId) {
        view.setVisible(true);
    } else {
        view.setVisible(false);
    }

    // Setup event handlers
    setupViewEventHandlers(tabId, view);

    console.log('[Main] WebContentsView created for tab:', tabId);
}

/**
 * Setup event handlers for a WebContentsView
 */
function setupViewEventHandlers(tabId: string, view: WebContentsView): void {
    const webContents = view.webContents;

    // Navigation events
    webContents.on('did-start-loading', () => {
        mainWindow?.webContents.send('wcv-did-start-loading', tabId);
    });

    webContents.on('did-stop-loading', () => {
        mainWindow?.webContents.send('wcv-did-stop-loading', tabId);
    });

    webContents.on('did-navigate', (event, url) => {
        mainWindow?.webContents.send('wcv-did-navigate', tabId, url);
    });

    webContents.on('did-navigate-in-page', (event, url) => {
        mainWindow?.webContents.send('wcv-did-navigate-in-page', tabId, url);
    });

    webContents.on('page-title-updated', (event, title) => {
        mainWindow?.webContents.send('wcv-page-title-updated', tabId, title);
    });

    // IPC from preload script
    webContents.ipc.on('plugin-data', (event, data) => {
        mainWindow?.webContents.send('wcv-ipc-message', tabId, 'plugin-data', data);
    });

    webContents.ipc.on('bilibili-ai-subtitle', (event, data) => {
        mainWindow?.webContents.send('wcv-ipc-message', tabId, 'bilibili-ai-subtitle', data);
    });

    webContents.ipc.on('video-time-update', (event, data) => {
        mainWindow?.webContents.send('wcv-ipc-message', tabId, 'video-time-update', data);
    });

    webContents.ipc.on('show-context-menu', (event, data) => {
        const { x, y, canCapture, platform } = data;
        console.log('[Main] Context menu requested:', { canCapture, platform });

        const menu = new Menu();

        if (canCapture) {
            menu.append(new MenuItem({
                label: '📥 保存素材',
                click: () => {
                    webContents.send('execute-capture');
                }
            }));
            menu.append(new MenuItem({ type: 'separator' }));
        }

        menu.append(new MenuItem({
            label: '在新标签页中打开链接',
            enabled: false,
        }));

        if (mainWindow) {
            menu.popup({ window: mainWindow, x, y });
        }
    });

    webContents.ipc.on('capture-result', (event, result) => {
        console.log('[Main] Capture result received:', result);
        if (result && !result.error) {
            try {
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
                const asset = saveContent(contentData as any);
                console.log('[Main] Content saved:', asset.id);
                mainWindow?.webContents.send('wcv-ipc-message', tabId, 'material-saved', asset);
            } catch (err: any) {
                console.error('[Main] Save failed:', err);
            }
        }
    });

    webContents.ipc.on('video-capture-result', (event, result) => {
        mainWindow?.webContents.send('wcv-video-capture-result', tabId, result);
    });

    // Bilibili subtitle extraction result
    webContents.ipc.on('bilibili-subtitle-result', (event, result) => {
        console.log('[Main] Bilibili subtitle result received:', result.success ? `${result.count} items` : result.error);
        mainWindow?.webContents.send('wcv-bilibili-subtitle-result', tabId, result);
    });
}

/**
 * Destroy a WebContentsView
 */
function destroyWebContentsView(tabId: string): void {
    const view = webContentsViews.get(tabId);
    if (view && mainWindow) {
        mainWindow.contentView.removeChildView(view);
        // WebContentsView doesn't have destroy(), just remove reference
        webContentsViews.delete(tabId);
        console.log('[Main] WebContentsView destroyed for tab:', tabId);
    }
}

/**
 * Switch active tab
 */
function switchActiveTab(tabId: string): void {
    activeTabId = tabId;

    // Hide all views except the active one
    for (const [id, view] of webContentsViews) {
        view.setVisible(id === tabId);
    }
}

/**
 * Update view bounds
 */
function updateViewBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    viewBounds = bounds;

    // Update all views' bounds
    for (const view of webContentsViews.values()) {
        view.setBounds(bounds);
    }
}

function createWindow() {
    const userAgent = getChromeUserAgent();

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../resources/icon.png'),
        titleBarStyle: 'hiddenInset', // macOS: 隐藏标题栏但保留红绿灯按钮
        trafficLightPosition: { x: 16, y: 18 }, // 调整红绿灯位置
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: false, // No longer using webview tag
            webSecurity: true,
        },
    });

    // Store reference for WebContentsView management
    mainWindow = win;

    // Set User-Agent for webview session to avoid Electron detection
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        // Add proper Sec-CH-UA headers to look like a real Chrome browser
        details.requestHeaders['Sec-CH-UA'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
        details.requestHeaders['Sec-CH-UA-Platform'] = process.platform === 'darwin' ? '"macOS"' : process.platform === 'win32' ? '"Windows"' : '"Linux"';
        callback({ requestHeaders: details.requestHeaders });
    });

    // Override User-Agent for the default session
    session.defaultSession.setUserAgent(userAgent);

    // Handle certificate errors for webview
    win.webContents.session.setCertificateVerifyProc((request, callback) => {
        if (process.env.VITE_DEV_SERVER_URL) {
            callback(0);
        } else {
            callback(-3);
        }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL!);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
        // 生产环境初始化自动更新
        initUpdaterIfNeeded(win);
    }

    // Clean up views when window is closed
    win.on('closed', () => {
        for (const tabId of webContentsViews.keys()) {
            destroyWebContentsView(tabId);
        }
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Set app name for macOS Dock hover
    app.setName('Verboo');

    // Set Dock icon on macOS (especially for development mode)
    if (process.platform === 'darwin' && app.dock) {
        const iconPath = path.join(__dirname, '../resources/icon.png');
        app.dock.setIcon(iconPath);
    }

    // Initialize databases
    initDatabase();
    initVocabDatabase();
    console.log('[Main] Databases initialized');

    // Register IPC handlers
    setupIpcHandlers();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

/**
 * Setup IPC handlers for communication with renderer
 */
function setupIpcHandlers() {
    console.log('[Main] Setting up IPC handlers...');

    // ============ WebContentsView IPC Handlers ============

    // Create a new WebContentsView for a tab
    ipcMain.handle('wcv-create', async (event, tabId: string, url: string, initialVisible: boolean = true) => {
        try {
            createWebContentsView(tabId, url, initialVisible);
            return { success: true };
        } catch (error) {
            console.error('[IPC] wcv-create failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Destroy a WebContentsView
    ipcMain.handle('wcv-destroy', async (event, tabId: string) => {
        try {
            destroyWebContentsView(tabId);
            return { success: true };
        } catch (error) {
            console.error('[IPC] wcv-destroy failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Switch active tab
    ipcMain.handle('wcv-switch-tab', async (event, tabId: string) => {
        try {
            switchActiveTab(tabId);
            return { success: true };
        } catch (error) {
            console.error('[IPC] wcv-switch-tab failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Update view bounds
    ipcMain.handle('wcv-update-bounds', async (event, bounds: { x: number; y: number; width: number; height: number }) => {
        try {
            updateViewBounds(bounds);
            return { success: true };
        } catch (error) {
            console.error('[IPC] wcv-update-bounds failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Navigate to URL
    ipcMain.handle('wcv-navigate', async (event, tabId: string, url: string) => {
        try {
            console.log('[IPC] wcv-navigate called:', tabId, url);
            const view = webContentsViews.get(tabId);
            if (view) {
                let finalUrl = url;
                if (!finalUrl.startsWith('http')) {
                    finalUrl = 'https://' + finalUrl;
                }
                console.log('[IPC] Loading URL:', finalUrl);
                view.webContents.loadURL(finalUrl);
                return { success: true };
            }
            console.log('[IPC] View not found for tab:', tabId, 'Available tabs:', Array.from(webContentsViews.keys()));
            return { success: false, error: 'View not found' };
        } catch (error) {
            console.error('[IPC] wcv-navigate failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Go back
    ipcMain.handle('wcv-go-back', async (event, tabId: string) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view && view.webContents.navigationHistory.canGoBack()) {
                view.webContents.navigationHistory.goBack();
                return { success: true };
            }
            return { success: false, error: 'Cannot go back' };
        } catch (error) {
            console.error('[IPC] wcv-go-back failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Go forward
    ipcMain.handle('wcv-go-forward', async (event, tabId: string) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view && view.webContents.navigationHistory.canGoForward()) {
                view.webContents.navigationHistory.goForward();
                return { success: true };
            }
            return { success: false, error: 'Cannot go forward' };
        } catch (error) {
            console.error('[IPC] wcv-go-forward failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Reload
    ipcMain.handle('wcv-reload', async (event, tabId: string) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                view.webContents.reload();
                return { success: true };
            }
            return { success: false, error: 'View not found' };
        } catch (error) {
            console.error('[IPC] wcv-reload failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get current URL
    ipcMain.handle('wcv-get-url', async (event, tabId: string) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                return { success: true, url: view.webContents.getURL() };
            }
            return { success: false, error: 'View not found' };
        } catch (error) {
            console.error('[IPC] wcv-get-url failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get navigation state
    ipcMain.handle('wcv-get-nav-state', async (event, tabId: string) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                return {
                    success: true,
                    canGoBack: view.webContents.navigationHistory.canGoBack(),
                    canGoForward: view.webContents.navigationHistory.canGoForward()
                };
            }
            return { success: false, error: 'View not found' };
        } catch (error) {
            console.error('[IPC] wcv-get-nav-state failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Execute JavaScript in view
    ipcMain.handle('wcv-execute-script', async (event, tabId: string, script: string) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                const result = await view.webContents.executeJavaScript(script);
                return { success: true, result };
            }
            return { success: false, error: 'View not found' };
        } catch (error) {
            console.error('[IPC] wcv-execute-script failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Send message to view (for video capture, etc.)
    ipcMain.handle('wcv-send', async (event, tabId: string, channel: string, ...args: any[]) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                view.webContents.send(channel, ...args);
                return { success: true };
            }
            return { success: false, error: 'View not found' };
        } catch (error) {
            console.error('[IPC] wcv-send failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Hide all views (for modals/dialogs)
    ipcMain.handle('wcv-hide-all', async () => {
        try {
            for (const view of webContentsViews.values()) {
                view.setVisible(false);
            }
            return { success: true };
        } catch (error) {
            console.error('[IPC] wcv-hide-all failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Show active view (restore after modal closes)
    ipcMain.handle('wcv-show-active', async () => {
        try {
            if (activeTabId) {
                const view = webContentsViews.get(activeTabId);
                if (view) {
                    view.setVisible(true);
                }
            }
            return { success: true };
        } catch (error) {
            console.error('[IPC] wcv-show-active failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    console.log('[Main] WebContentsView IPC handlers registered');

    // Handle YouTube subtitle extraction
    ipcMain.handle('get-youtube-subtitles', async (event, url: string) => {
        try {
            console.log('IPC: get-youtube-subtitles called with URL:', url);
            const subtitles = await getYouTubeSubtitles(url);
            console.log('IPC: Returning', subtitles.length, 'subtitles');
            return { success: true, data: subtitles };
        } catch (error) {
            console.error('IPC: get-youtube-subtitles failed:', error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    });

    // Get current webview URL
    ipcMain.handle('get-webview-url', async (event) => {
        // This will be called from renderer to get current URL
        return { success: true };
    });

    // ============ Unified Asset IPC Handlers ============

    // Save content asset
    ipcMain.handle('save-content', async (event, data) => {
        try {
            console.log('[IPC] save-content called:', data.platform);
            const asset = saveContent({
                platform: data.platform,
                title: data.title || '',
                url: data.url,
                author: data.author,
                favicon: data.favicon,
                thumbnail: data.thumbnail,
                content: data.content || '',
                tags: data.tags || [],
                images: data.images || [],
                capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
            });
            return { success: true, data: asset };
        } catch (error) {
            console.error('[IPC] save-content failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Save screenshot asset
    ipcMain.handle('save-screenshot', async (event, data) => {
        try {
            console.log('[IPC] save-screenshot called, markType:', data.markType);
            const asset = saveScreenshot({
                platform: data.platform,
                title: data.title || data.videoTitle || '',
                url: data.url || data.videoUrl,
                author: data.author,
                favicon: data.favicon,
                timestamp: data.timestamp,
                imageData: data.imageData,
                finalImageData: data.finalImageData,
                markType: data.markType,
                selectedSubtitles: data.subtitles || data.selectedSubtitles,
                subtitleStyle: data.subtitleStyle,
                subtitleId: data.subtitleId,
            });

            // Async: Save platform icon and author avatar to local storage (non-blocking)
            // This runs in background and doesn't block the screenshot save
            if (data.platform && data.favicon) {
                saveOrUpdatePlatformIcon(data.platform, data.favicon).catch(err => {
                    console.error('[IPC] Failed to save platform icon:', err);
                });
            }

            if (data.platform && data.author?.profileUrl && data.author?.avatar) {
                saveOrUpdateAuthorAvatar(
                    data.platform,
                    data.author.profileUrl,
                    data.author.avatar,
                    data.author.name || ''
                ).catch(err => {
                    console.error('[IPC] Failed to save author avatar:', err);
                });
            }

            return { success: true, data: asset };
        } catch (error) {
            console.error('[IPC] save-screenshot failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get assets (unified query)
    ipcMain.handle('get-assets', async (event, options?: {
        type?: AssetType;
        platform?: string;
        url?: string;
        limit?: number;
        offset?: number;
    }) => {
        try {
            const assets = getAssets(options || {});
            const count = getAssetsCount({ type: options?.type, platform: options?.platform });
            return { success: true, data: assets, total: count };
        } catch (error) {
            console.error('[IPC] get-assets failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get single asset by ID
    ipcMain.handle('get-asset', async (event, id: number) => {
        try {
            const asset = getAssetById(id);
            return { success: true, data: asset };
        } catch (error) {
            console.error('[IPC] get-asset failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Update asset
    ipcMain.handle('update-asset', async (event, data: { id: number; title?: string; typeData?: any }) => {
        try {
            const { id, ...updateData } = data;
            console.log('[IPC] update-asset called for ID:', id);
            const asset = updateAsset(id, updateData);
            if (asset) {
                return { success: true, data: asset };
            } else {
                return { success: false, error: 'Asset not found' };
            }
        } catch (error) {
            console.error('[IPC] update-asset failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete asset
    ipcMain.handle('delete-asset', async (event, id: number) => {
        try {
            const deleted = deleteAsset(id);
            return { success: deleted };
        } catch (error) {
            console.error('[IPC] delete-asset failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Search assets
    ipcMain.handle('search-assets', async (event, keyword: string, options?: { type?: AssetType; limit?: number }) => {
        try {
            const assets = searchAssets(keyword, options);
            return { success: true, data: assets };
        } catch (error) {
            console.error('[IPC] search-assets failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    console.log('[Main] Asset IPC handlers registered successfully');

    // ============ Subtitle IPC Handlers ============

    // Save subtitles (upsert)
    ipcMain.handle('save-subtitles', async (event, subtitleData) => {
        try {
            console.log('[IPC] save-subtitles called for URL:', subtitleData.videoUrl);
            const subtitle = saveSubtitles({
                videoUrl: subtitleData.videoUrl,
                videoTitle: subtitleData.videoTitle || '',
                platform: subtitleData.platform || '',
                subtitleData: subtitleData.subtitleData || []
            });
            return { success: true, data: subtitle };
        } catch (error) {
            console.error('[IPC] save-subtitles failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get subtitles by URL
    ipcMain.handle('get-subtitles-by-url', async (event, videoUrl: string) => {
        try {
            const subtitle = getSubtitlesByUrl(videoUrl);
            return { success: true, data: subtitle };
        } catch (error) {
            console.error('[IPC] get-subtitles-by-url failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get subtitles by ID
    ipcMain.handle('get-subtitles-by-id', async (event, id: number) => {
        try {
            const subtitle = getSubtitlesById(id);
            return { success: true, data: subtitle };
        } catch (error) {
            console.error('[IPC] get-subtitles-by-id failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get all subtitles
    ipcMain.handle('get-all-subtitles', async (event, options?: { limit?: number; offset?: number }) => {
        try {
            const subtitles = getAllSubtitles(options || {});
            return { success: true, data: subtitles };
        } catch (error) {
            console.error('[IPC] get-all-subtitles failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete subtitles
    ipcMain.handle('delete-subtitles', async (event, id: number) => {
        try {
            const deleted = deleteSubtitles(id);
            return { success: deleted };
        } catch (error) {
            console.error('[IPC] delete-subtitles failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    console.log('[Main] Subtitle IPC handlers registered successfully');

    // ============ Vocabulary IPC Handlers ============

    // Look up a single word
    ipcMain.handle('lookup-word', async (event, word: string) => {
        try {
            const wordInfo = lookupWord(word);
            return { success: true, data: wordInfo };
        } catch (error) {
            console.error('[IPC] lookup-word failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Look up multiple words
    ipcMain.handle('lookup-words', async (event, words: string[]) => {
        try {
            const wordInfoMap = lookupWords(words);
            // Convert Map to object for IPC serialization
            const data: Record<string, WordInfo> = {};
            for (const [word, info] of wordInfoMap) {
                data[word] = info;
            }
            return { success: true, data };
        } catch (error) {
            console.error('[IPC] lookup-words failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Analyze text for difficult words
    ipcMain.handle('analyze-text-difficulty', async (event, text: string) => {
        try {
            console.log('[IPC] analyze-text-difficulty called, text length:', text?.length);
            const results = analyzeTextDifficulty(text);
            console.log('[IPC] analyze-text-difficulty found', results.length, 'difficult words');
            return { success: true, data: results };
        } catch (error) {
            console.error('[IPC] analyze-text-difficulty failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    ipcMain.handle('get-vocabulary', async (event, options?: { category?: string; limit?: number; offset?: number }) => {
        try {
            const category = options?.category || 'all';
            const limit = options?.limit || 100;
            const offset = options?.offset || 0;
            console.log('[IPC] get-vocabulary called, category:', category, 'limit:', limit, 'offset:', offset);
            const results = getVocabularyByCategory(category, limit, offset);
            return { success: true, data: results };
        } catch (error) {
            console.error('[IPC] get-vocabulary failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    ipcMain.handle('get-vocabulary-stats', async () => {
        try {
            console.log('[IPC] get-vocabulary-stats called');
            const stats = getVocabularyStats();
            return { success: true, data: stats };
        } catch (error) {
            console.error('[IPC] get-vocabulary-stats failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get platform icon (local base64 data)
    ipcMain.handle('get-platform-icon', async (event, platform: string) => {
        try {
            const iconData = getPlatformIcon(platform);
            return { success: true, data: iconData };
        } catch (error) {
            console.error('[IPC] get-platform-icon failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get author avatar (local base64 data)
    ipcMain.handle('get-author-avatar', async (event, options: {
        platform: string;
        profileUrl?: string;
        authorName?: string;
    }) => {
        try {
            let avatarData: string | null = null;

            // Try to get by profile URL first (more accurate)
            if (options.profileUrl) {
                avatarData = getAuthorAvatar(options.platform, options.profileUrl);
            }

            // Fallback to author name if profile URL not available or not found
            if (!avatarData && options.authorName) {
                avatarData = getAuthorAvatarByName(options.platform, options.authorName);
            }

            return { success: true, data: avatarData };
        } catch (error) {
            console.error('[IPC] get-author-avatar failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    console.log('[Main] Vocabulary IPC handlers registered successfully');
}

app.on('window-all-closed', () => {
    closeDatabase();
    closeVocabDatabase();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
