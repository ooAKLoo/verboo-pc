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

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            webSecurity: true, // Keep web security enabled
        },
    });

    // Handle certificate errors for webview
    mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
        // In development, allow all certificates
        // In production, you should properly verify certificates
        if (process.env.VITE_DEV_SERVER_URL) {
            callback(0); // 0 means success
        } else {
            callback(-3); // Use default verification
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
