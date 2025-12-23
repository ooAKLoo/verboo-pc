import { app, BrowserWindow, session, ipcMain, Menu, MenuItem } from 'electron';
import path from 'path';
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
    // Types
    type AssetType
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
    const chromeVersion = '120.0.0.0';
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

function createWindow() {
    const userAgent = getChromeUserAgent();

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            webSecurity: true,
        },
    });

    // Set User-Agent for webview session to avoid Electron detection
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        // Remove headers that might expose Electron
        delete details.requestHeaders['Sec-Ch-Ua'];
        callback({ requestHeaders: details.requestHeaders });
    });

    // Override User-Agent for the default session
    session.defaultSession.setUserAgent(userAgent);

    // Handle certificate errors for webview
    mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
        if (process.env.VITE_DEV_SERVER_URL) {
            callback(0);
        } else {
            callback(-3);
        }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    // Initialize database
    initDatabase();
    console.log('[Main] Database initialized');

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
            console.log('[IPC] save-screenshot called');
            const asset = saveScreenshot({
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
        } catch (error) {
            console.error('[IPC] save-screenshot failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get assets (unified query)
    ipcMain.handle('get-assets', async (event, options?: {
        type?: AssetType;
        platform?: string;
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

    // ============ Context Menu Handler ============

    // Show context menu for saving material
    ipcMain.on('show-save-material-menu', (event, { x, y, canCapture }) => {
        const menu = new Menu();

        if (canCapture) {
            menu.append(new MenuItem({
                label: '📥 保存素材',
                click: () => {
                    event.sender.send('capture-material');
                }
            }));
            menu.append(new MenuItem({ type: 'separator' }));
        }

        menu.append(new MenuItem({
            label: '在新标签页中打开链接',
            enabled: false, // Placeholder for future
        }));

        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            menu.popup({ window, x, y });
        }
    });
}

app.on('window-all-closed', () => {
    closeDatabase();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
