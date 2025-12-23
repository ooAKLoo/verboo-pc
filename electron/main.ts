import { app, BrowserWindow, session, ipcMain, Menu, MenuItem } from 'electron';
import path from 'path';
import { getYouTubeSubtitles } from './youtube-service';
import {
    initDatabase,
    closeDatabase,
    saveMaterial,
    getMaterials,
    deleteMaterial,
    searchMaterials,
    getMaterialsCount
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

    // ============ Material CRUD IPC Handlers ============

    // Save a material
    ipcMain.handle('save-material', async (event, materialData) => {
        try {
            console.log('[IPC] save-material called:', materialData.platform);
            const material = saveMaterial({
                platform: materialData.platform,
                title: materialData.title || '',
                content: materialData.content || '',
                author: materialData.author || { name: '' },
                tags: materialData.tags || [],
                images: materialData.images || [],
                originalUrl: materialData.originalUrl,
                capturedAt: new Date(materialData.capturedAt || Date.now()),
            });
            return { success: true, data: material };
        } catch (error) {
            console.error('[IPC] save-material failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Get all materials (with pagination)
    ipcMain.handle('get-materials', async (event, options?: { limit?: number; offset?: number; platform?: string }) => {
        try {
            const materials = getMaterials(options || {});
            const count = getMaterialsCount(options?.platform);
            return { success: true, data: materials, total: count };
        } catch (error) {
            console.error('[IPC] get-materials failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete a material
    ipcMain.handle('delete-material', async (event, id: number) => {
        try {
            const deleted = deleteMaterial(id);
            return { success: deleted };
        } catch (error) {
            console.error('[IPC] delete-material failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Search materials
    ipcMain.handle('search-materials', async (event, keyword: string, limit?: number) => {
        try {
            const materials = searchMaterials(keyword, limit);
            return { success: true, data: materials };
        } catch (error) {
            console.error('[IPC] search-materials failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

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
