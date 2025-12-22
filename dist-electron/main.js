"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
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
        }
        else {
            callback(-3); // Use default verification
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
    // ============ Material CRUD IPC Handlers ============
    // Save a material
    electron_1.ipcMain.handle('save-material', async (event, materialData) => {
        try {
            console.log('[IPC] save-material called:', materialData.platform);
            const material = (0, database_1.saveMaterial)({
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
        }
        catch (error) {
            console.error('[IPC] save-material failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Get all materials (with pagination)
    electron_1.ipcMain.handle('get-materials', async (event, options) => {
        try {
            const materials = (0, database_1.getMaterials)(options || {});
            const count = (0, database_1.getMaterialsCount)(options?.platform);
            return { success: true, data: materials, total: count };
        }
        catch (error) {
            console.error('[IPC] get-materials failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Delete a material
    electron_1.ipcMain.handle('delete-material', async (event, id) => {
        try {
            const deleted = (0, database_1.deleteMaterial)(id);
            return { success: deleted };
        }
        catch (error) {
            console.error('[IPC] delete-material failed:', error);
            return { success: false, error: error.message };
        }
    });
    // Search materials
    electron_1.ipcMain.handle('search-materials', async (event, keyword, limit) => {
        try {
            const materials = (0, database_1.searchMaterials)(keyword, limit);
            return { success: true, data: materials };
        }
        catch (error) {
            console.error('[IPC] search-materials failed:', error);
            return { success: false, error: error.message };
        }
    });
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
