"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHROME_USER_AGENT = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
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
    const chromeVersion = '120.0.0.0';
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
function createWindow() {
    const userAgent = getChromeUserAgent();
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            webSecurity: true,
        },
    });
    // Set User-Agent for webview session to avoid Electron detection
    electron_1.session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        // Remove headers that might expose Electron
        delete details.requestHeaders['Sec-Ch-Ua'];
        callback({ requestHeaders: details.requestHeaders });
    });
    // Override User-Agent for the default session
    electron_1.session.defaultSession.setUserAgent(userAgent);
    // Handle certificate errors for webview
    mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
        if (process.env.VITE_DEV_SERVER_URL) {
            callback(0);
        }
        else {
            callback(-3);
        }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    // Initialize database
    (0, database_1.initDatabase)();
    console.log('[Main] Database initialized');
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
            console.log('[IPC] save-screenshot called');
            const asset = (0, database_1.saveScreenshot)({
                platform: data.platform,
                title: data.title || data.videoTitle || '',
                url: data.url || data.videoUrl,
                author: data.author,
                favicon: data.favicon,
                timestamp: data.timestamp,
                imageData: data.imageData,
                finalImageData: data.finalImageData,
                selectedSubtitles: data.subtitles || data.selectedSubtitles,
                subtitleStyle: data.subtitleStyle,
                subtitleId: data.subtitleId,
            });
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
    // ============ Context Menu Handler ============
    // Show context menu for saving material
    electron_1.ipcMain.on('show-save-material-menu', (event, { x, y, canCapture }) => {
        const menu = new electron_1.Menu();
        if (canCapture) {
            menu.append(new electron_1.MenuItem({
                label: '📥 保存素材',
                click: () => {
                    event.sender.send('capture-material');
                }
            }));
            menu.append(new electron_1.MenuItem({ type: 'separator' }));
        }
        menu.append(new electron_1.MenuItem({
            label: '在新标签页中打开链接',
            enabled: false, // Placeholder for future
        }));
        const window = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (window) {
            menu.popup({ window, x, y });
        }
    });
}
electron_1.app.on('window-all-closed', () => {
    (0, database_1.closeDatabase)();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
