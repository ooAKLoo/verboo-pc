"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHROME_USER_AGENT = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const i18n_1 = require("./i18n");
// 自动更新 (仅在生产环境启用)
let updaterInitialized = false;
async function initUpdaterIfNeeded(win) {
    if (updaterInitialized || process.env.VITE_DEV_SERVER_URL)
        return;
    try {
        const { initUpdater } = await Promise.resolve().then(() => __importStar(require('./updater')));
        initUpdater(win);
        updaterInitialized = true;
        console.log('[Main] Updater initialized');
    }
    catch (error) {
        console.log('[Main] Updater not available:', error);
    }
}
// Set app name as early as possible (before ready event)
electron_1.app.name = 'Verboo';
const youtube_service_1 = require("./youtube-service");
const database_1 = require("./database");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
// Disable HTTP cache in development
if (process.env.VITE_DEV_SERVER_URL) {
    electron_1.app.commandLine.appendSwitch('disable-http-cache');
}
// Ignore certificate errors in development (for SSL handshake issues)
if (process.env.VITE_DEV_SERVER_URL) {
    electron_1.app.commandLine.appendSwitch('ignore-certificate-errors');
}
// Get a realistic Chrome User-Agent based on platform
function getChromeUserAgent() {
    const chromeVersion = '131.0.0.0';
    const platform = process.platform;
    if (platform === 'darwin') {
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
    else if (platform === 'win32') {
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
    else {
        return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
    }
}
// Export for use in renderer
exports.CHROME_USER_AGENT = getChromeUserAgent();
// ============ WebContentsView Manager ============
// Store active WebContentsViews by tabId
const webContentsViews = new Map();
let mainWindow = null;
// Current active tab for positioning
let activeTabId = null;
// View bounds (will be updated by renderer)
let viewBounds = { x: 0, y: 0, width: 800, height: 600 };
/**
 * Create a new WebContentsView for a tab
 */
function createWebContentsView(tabId, url, initialVisible = true) {
    if (!mainWindow)
        return;
    // Remove existing view if any
    if (webContentsViews.has(tabId)) {
        destroyWebContentsView(tabId);
    }
    const userAgent = getChromeUserAgent();
    const view = new electron_1.WebContentsView({
        webPreferences: {
            preload: path_1.default.join(__dirname, 'webview-preload.js'),
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
    }
    else {
        view.setVisible(false);
    }
    // Setup event handlers
    setupViewEventHandlers(tabId, view);
    console.log('[Main] WebContentsView created for tab:', tabId);
}
/**
 * Setup event handlers for a WebContentsView
 */
function setupViewEventHandlers(tabId, view) {
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
        const menu = new electron_1.Menu();
        if (canCapture) {
            menu.append(new electron_1.MenuItem({
                label: (0, i18n_1.t)('contextMenu.saveAsset'),
                click: () => {
                    webContents.send('execute-capture');
                }
            }));
            menu.append(new electron_1.MenuItem({ type: 'separator' }));
        }
        menu.append(new electron_1.MenuItem({
            label: (0, i18n_1.t)('contextMenu.openInNewTab'),
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
                const asset = (0, database_1.saveContent)(contentData);
                console.log('[Main] Content saved:', asset.id);
                mainWindow?.webContents.send('wcv-ipc-message', tabId, 'material-saved', asset);
            }
            catch (err) {
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
function destroyWebContentsView(tabId) {
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
function switchActiveTab(tabId) {
    activeTabId = tabId;
    // Hide all views except the active one
    for (const [id, view] of webContentsViews) {
        view.setVisible(id === tabId);
    }
}
/**
 * Update view bounds
 */
function updateViewBounds(bounds) {
    viewBounds = bounds;
    // Update all views' bounds
    for (const view of webContentsViews.values()) {
        view.setBounds(bounds);
    }
}
function createWindow() {
    const userAgent = getChromeUserAgent();
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        icon: path_1.default.join(__dirname, '../resources/icon.png'),
        titleBarStyle: 'hiddenInset', // macOS: 隐藏标题栏但保留红绿灯按钮
        trafficLightPosition: { x: 16, y: 18 }, // 调整红绿灯位置
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: false, // No longer using webview tag
            webSecurity: true,
        },
    });
    // Store reference for WebContentsView management
    mainWindow = win;
    // Set User-Agent for webview session to avoid Electron detection
    electron_1.session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        // Add proper Sec-CH-UA headers to look like a real Chrome browser
        details.requestHeaders['Sec-CH-UA'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
        details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
        details.requestHeaders['Sec-CH-UA-Platform'] = process.platform === 'darwin' ? '"macOS"' : process.platform === 'win32' ? '"Windows"' : '"Linux"';
        callback({ requestHeaders: details.requestHeaders });
    });
    // Override User-Agent for the default session
    electron_1.session.defaultSession.setUserAgent(userAgent);
    // Handle certificate errors for webview
    win.webContents.session.setCertificateVerifyProc((request, callback) => {
        if (process.env.VITE_DEV_SERVER_URL) {
            callback(0);
        }
        else {
            callback(-3);
        }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
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
electron_1.app.whenReady().then(() => {
    // Set app name for macOS Dock hover
    electron_1.app.setName('Verboo');
    // Set Dock icon on macOS (especially for development mode)
    if (process.platform === 'darwin' && electron_1.app.dock) {
        const iconPath = path_1.default.join(__dirname, '../resources/icon.png');
        electron_1.app.dock.setIcon(iconPath);
    }
    // Load saved locale
    (0, i18n_1.loadLocaleFromStorage)();
    // Initialize databases
    (0, database_1.initDatabase)();
    (0, database_1.initVocabDatabase)();
    console.log('[Main] Databases initialized');
    // Register IPC handlers
    setupIpcHandlers();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
/**
 * Setup IPC handlers for communication with renderer
 */
function setupIpcHandlers() {
    console.log('[Main] Setting up IPC handlers...');
    // ============ App Version IPC Handler ============
    electron_1.ipcMain.handle('get-app-version', () => {
        return { success: true, version: electron_1.app.getVersion() };
    });
    // ============ Locale IPC Handler ============
    electron_1.ipcMain.handle('set-locale', async (event, locale) => {
        try {
            (0, i18n_1.setLocale)(locale);
            (0, i18n_1.saveLocaleToStorage)(locale);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] set-locale failed:', error);
            return { success: false, error: error.message };
        }
    });
    // ============ WebContentsView IPC Handlers ============
    // Create a new WebContentsView for a tab
    electron_1.ipcMain.handle('wcv-create', async (event, tabId, url, initialVisible = true) => {
        try {
            createWebContentsView(tabId, url, initialVisible);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] wcv-create failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Destroy a WebContentsView
    electron_1.ipcMain.handle('wcv-destroy', async (event, tabId) => {
        try {
            destroyWebContentsView(tabId);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] wcv-destroy failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Switch active tab
    electron_1.ipcMain.handle('wcv-switch-tab', async (event, tabId) => {
        try {
            switchActiveTab(tabId);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] wcv-switch-tab failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Update view bounds
    electron_1.ipcMain.handle('wcv-update-bounds', async (event, bounds) => {
        try {
            updateViewBounds(bounds);
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] wcv-update-bounds failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Navigate to URL
    electron_1.ipcMain.handle('wcv-navigate', async (event, tabId, url) => {
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
        }
        catch (error) {
            console.error('[IPC] wcv-navigate failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Go back
    electron_1.ipcMain.handle('wcv-go-back', async (event, tabId) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view && view.webContents.navigationHistory.canGoBack()) {
                view.webContents.navigationHistory.goBack();
                return { success: true };
            }
            return { success: false, error: 'Cannot go back' };
        }
        catch (error) {
            console.error('[IPC] wcv-go-back failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Go forward
    electron_1.ipcMain.handle('wcv-go-forward', async (event, tabId) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view && view.webContents.navigationHistory.canGoForward()) {
                view.webContents.navigationHistory.goForward();
                return { success: true };
            }
            return { success: false, error: 'Cannot go forward' };
        }
        catch (error) {
            console.error('[IPC] wcv-go-forward failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Reload
    electron_1.ipcMain.handle('wcv-reload', async (event, tabId) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                view.webContents.reload();
                return { success: true };
            }
            return { success: false, error: 'View not found' };
        }
        catch (error) {
            console.error('[IPC] wcv-reload failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get current URL
    electron_1.ipcMain.handle('wcv-get-url', async (event, tabId) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                return { success: true, url: view.webContents.getURL() };
            }
            return { success: false, error: 'View not found' };
        }
        catch (error) {
            console.error('[IPC] wcv-get-url failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get navigation state
    electron_1.ipcMain.handle('wcv-get-nav-state', async (event, tabId) => {
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
        }
        catch (error) {
            console.error('[IPC] wcv-get-nav-state failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Execute JavaScript in view
    electron_1.ipcMain.handle('wcv-execute-script', async (event, tabId, script) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                const result = await view.webContents.executeJavaScript(script);
                return { success: true, result };
            }
            return { success: false, error: 'View not found' };
        }
        catch (error) {
            console.error('[IPC] wcv-execute-script failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Send message to view (for video capture, etc.)
    electron_1.ipcMain.handle('wcv-send', async (event, tabId, channel, ...args) => {
        try {
            const view = webContentsViews.get(tabId);
            if (view) {
                view.webContents.send(channel, ...args);
                return { success: true };
            }
            return { success: false, error: 'View not found' };
        }
        catch (error) {
            console.error('[IPC] wcv-send failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Hide all views (for modals/dialogs)
    electron_1.ipcMain.handle('wcv-hide-all', async () => {
        try {
            for (const view of webContentsViews.values()) {
                view.setVisible(false);
            }
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] wcv-hide-all failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Show active view (restore after modal closes)
    electron_1.ipcMain.handle('wcv-show-active', async () => {
        try {
            if (activeTabId) {
                const view = webContentsViews.get(activeTabId);
                if (view) {
                    view.setVisible(true);
                }
            }
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] wcv-show-active failed:', error);
            return { success: false, error: error.message };
        }
    });
    console.log('[Main] WebContentsView IPC handlers registered');
    // Handle YouTube subtitle extraction
    electron_1.ipcMain.handle('get-youtube-subtitles', async (event, url) => {
        try {
            console.log('IPC: get-youtube-subtitles called with URL:', url);
            const subtitles = await (0, youtube_service_1.getYouTubeSubtitles)(url);
            console.log('IPC: Returning', subtitles.length, 'subtitles');
            return { success: true, data: subtitles };
        }
        catch (error) {
            console.error('IPC: get-youtube-subtitles failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    // Get current webview URL
    electron_1.ipcMain.handle('get-webview-url', async (event) => {
        // This will be called from renderer to get current URL
        return { success: true };
    });
    // ============ Unified Asset IPC Handlers ============
    // Save content asset
    electron_1.ipcMain.handle('save-content', async (event, data) => {
        try {
            console.log('[IPC] save-content called:', data.platform);
            const asset = (0, database_1.saveContent)({
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
        }
        catch (error) {
            console.error('[IPC] save-content failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Save screenshot asset
    electron_1.ipcMain.handle('save-screenshot', async (event, data) => {
        try {
            console.log('[IPC] save-screenshot called, markType:', data.markType);
            const asset = (0, database_1.saveScreenshot)({
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
                (0, database_1.saveOrUpdatePlatformIcon)(data.platform, data.favicon).catch(err => {
                    console.error('[IPC] Failed to save platform icon:', err);
                });
            }
            if (data.platform && data.author?.profileUrl && data.author?.avatar) {
                (0, database_1.saveOrUpdateAuthorAvatar)(data.platform, data.author.profileUrl, data.author.avatar, data.author.name || '').catch(err => {
                    console.error('[IPC] Failed to save author avatar:', err);
                });
            }
            return { success: true, data: asset };
        }
        catch (error) {
            console.error('[IPC] save-screenshot failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get assets (unified query)
    electron_1.ipcMain.handle('get-assets', async (event, options) => {
        try {
            const assets = (0, database_1.getAssets)(options || {});
            const count = (0, database_1.getAssetsCount)({ type: options?.type, platform: options?.platform });
            return { success: true, data: assets, total: count };
        }
        catch (error) {
            console.error('[IPC] get-assets failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get single asset by ID
    electron_1.ipcMain.handle('get-asset', async (event, id) => {
        try {
            const asset = (0, database_1.getAssetById)(id);
            return { success: true, data: asset };
        }
        catch (error) {
            console.error('[IPC] get-asset failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Update asset
    electron_1.ipcMain.handle('update-asset', async (event, data) => {
        try {
            const { id, ...updateData } = data;
            console.log('[IPC] update-asset called for ID:', id);
            const asset = (0, database_1.updateAsset)(id, updateData);
            if (asset) {
                return { success: true, data: asset };
            }
            else {
                return { success: false, error: 'Asset not found' };
            }
        }
        catch (error) {
            console.error('[IPC] update-asset failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Delete asset
    electron_1.ipcMain.handle('delete-asset', async (event, id) => {
        try {
            const deleted = (0, database_1.deleteAsset)(id);
            return { success: deleted };
        }
        catch (error) {
            console.error('[IPC] delete-asset failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Search assets
    electron_1.ipcMain.handle('search-assets', async (event, keyword, options) => {
        try {
            const assets = (0, database_1.searchAssets)(keyword, options);
            return { success: true, data: assets };
        }
        catch (error) {
            console.error('[IPC] search-assets failed:', error);
            return { success: false, error: error.message };
        }
    });
    console.log('[Main] Asset IPC handlers registered successfully');
    // ============ Subtitle IPC Handlers ============
    // Save subtitles (upsert)
    electron_1.ipcMain.handle('save-subtitles', async (event, subtitleData) => {
        try {
            console.log('[IPC] save-subtitles called for URL:', subtitleData.videoUrl);
            const subtitle = (0, database_1.saveSubtitles)({
                videoUrl: subtitleData.videoUrl,
                videoTitle: subtitleData.videoTitle || '',
                platform: subtitleData.platform || '',
                subtitleData: subtitleData.subtitleData || []
            });
            return { success: true, data: subtitle };
        }
        catch (error) {
            console.error('[IPC] save-subtitles failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get subtitles by URL
    electron_1.ipcMain.handle('get-subtitles-by-url', async (event, videoUrl) => {
        try {
            const subtitle = (0, database_1.getSubtitlesByUrl)(videoUrl);
            return { success: true, data: subtitle };
        }
        catch (error) {
            console.error('[IPC] get-subtitles-by-url failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get subtitles by ID
    electron_1.ipcMain.handle('get-subtitles-by-id', async (event, id) => {
        try {
            const subtitle = (0, database_1.getSubtitlesById)(id);
            return { success: true, data: subtitle };
        }
        catch (error) {
            console.error('[IPC] get-subtitles-by-id failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get all subtitles
    electron_1.ipcMain.handle('get-all-subtitles', async (event, options) => {
        try {
            const subtitles = (0, database_1.getAllSubtitles)(options || {});
            return { success: true, data: subtitles };
        }
        catch (error) {
            console.error('[IPC] get-all-subtitles failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Delete subtitles
    electron_1.ipcMain.handle('delete-subtitles', async (event, id) => {
        try {
            const deleted = (0, database_1.deleteSubtitles)(id);
            return { success: deleted };
        }
        catch (error) {
            console.error('[IPC] delete-subtitles failed:', error);
            return { success: false, error: error.message };
        }
    });
    console.log('[Main] Subtitle IPC handlers registered successfully');
    // ============ Vocabulary IPC Handlers ============
    // Look up a single word
    electron_1.ipcMain.handle('lookup-word', async (event, word) => {
        try {
            const wordInfo = (0, database_1.lookupWord)(word);
            return { success: true, data: wordInfo };
        }
        catch (error) {
            console.error('[IPC] lookup-word failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Look up multiple words
    electron_1.ipcMain.handle('lookup-words', async (event, words) => {
        try {
            const wordInfoMap = (0, database_1.lookupWords)(words);
            // Convert Map to object for IPC serialization
            const data = {};
            for (const [word, info] of wordInfoMap) {
                data[word] = info;
            }
            return { success: true, data };
        }
        catch (error) {
            console.error('[IPC] lookup-words failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Analyze text for difficult words
    electron_1.ipcMain.handle('analyze-text-difficulty', async (event, text) => {
        try {
            console.log('[IPC] analyze-text-difficulty called, text length:', text?.length);
            const results = (0, database_1.analyzeTextDifficulty)(text);
            console.log('[IPC] analyze-text-difficulty found', results.length, 'difficult words');
            return { success: true, data: results };
        }
        catch (error) {
            console.error('[IPC] analyze-text-difficulty failed:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('get-vocabulary', async (event, options) => {
        try {
            const category = options?.category || 'all';
            const limit = options?.limit || 100;
            const offset = options?.offset || 0;
            console.log('[IPC] get-vocabulary called, category:', category, 'limit:', limit, 'offset:', offset);
            const results = (0, database_1.getVocabularyByCategory)(category, limit, offset);
            return { success: true, data: results };
        }
        catch (error) {
            console.error('[IPC] get-vocabulary failed:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('get-vocabulary-stats', async () => {
        try {
            console.log('[IPC] get-vocabulary-stats called');
            const stats = (0, database_1.getVocabularyStats)();
            return { success: true, data: stats };
        }
        catch (error) {
            console.error('[IPC] get-vocabulary-stats failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get platform icon (local base64 data)
    electron_1.ipcMain.handle('get-platform-icon', async (event, platform) => {
        try {
            const iconData = (0, database_1.getPlatformIcon)(platform);
            return { success: true, data: iconData };
        }
        catch (error) {
            console.error('[IPC] get-platform-icon failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get author avatar (local base64 data)
    electron_1.ipcMain.handle('get-author-avatar', async (event, options) => {
        try {
            let avatarData = null;
            // Try to get by profile URL first (more accurate)
            if (options.profileUrl) {
                avatarData = (0, database_1.getAuthorAvatar)(options.platform, options.profileUrl);
            }
            // Fallback to author name if profile URL not available or not found
            if (!avatarData && options.authorName) {
                avatarData = (0, database_1.getAuthorAvatarByName)(options.platform, options.authorName);
            }
            return { success: true, data: avatarData };
        }
        catch (error) {
            console.error('[IPC] get-author-avatar failed:', error);
            return { success: false, error: error.message };
        }
    });
    console.log('[Main] Vocabulary IPC handlers registered successfully');
    // ============ File Save IPC Handlers ============
    // Save base64 image to Downloads folder
    electron_1.ipcMain.handle('save-image-to-downloads', async (event, data) => {
        try {
            console.log('[IPC] save-image-to-downloads called:', data.filename);
            // Get Downloads folder path
            const downloadsPath = electron_1.app.getPath('downloads');
            const filePath = path_1.default.join(downloadsPath, data.filename);
            // Extract base64 content (remove data:image/png;base64, prefix)
            const base64Content = data.base64Data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');
            // Write file
            fs_1.default.writeFileSync(filePath, buffer);
            console.log('[IPC] Image saved to:', filePath);
            return { success: true, filePath };
        }
        catch (error) {
            console.error('[IPC] save-image-to-downloads failed:', error);
            return { success: false, error: error.message };
        }
    });
    console.log('[Main] File Save IPC handlers registered successfully');
}
electron_1.app.on('window-all-closed', () => {
    (0, database_1.closeDatabase)();
    (0, database_1.closeVocabDatabase)();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
