import { app, BrowserWindow, session, ipcMain, Menu, MenuItem, WebContentsView } from 'electron';
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

// Store WebContentsViews for each tab
const tabViews = new Map<string, WebContentsView>();
let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true,
        },
    });

    // Set User-Agent for main window
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    mainWindow.webContents.session.setUserAgent(userAgent);

    // Handle certificate errors
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

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Initialize database
    initDatabase();
    console.log('[Main] Database initialized');

    // Set User-Agent for webview partition
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    session.defaultSession.setUserAgent(userAgent);

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
 * Show context menu for saving material
 */
function showContextMenu(tabId: string, data: { platform: string | null; canCapture: boolean }) {
    const menu = new Menu();

    if (data.canCapture) {
        menu.append(new MenuItem({
            label: '📥 保存素材',
            click: () => {
                const view = tabViews.get(tabId);
                if (view) {
                    view.webContents.send('execute-capture');
                }
            }
        }));
        menu.append(new MenuItem({ type: 'separator' }));
    }

    menu.append(new MenuItem({
        label: '在新标签页中打开链接',
        enabled: false, // Placeholder for future
    }));

    if (mainWindow) {
        menu.popup({ window: mainWindow });
    }
}

/**
 * Handle capture result from webview
 */
async function handleCaptureResult(tabId: string, result: any) {
    if (result && !result.error) {
        try {
            // Save to database
            const response = await saveMaterial({
                platform: result.platform,
                title: result.title || '',
                content: result.content || '',
                author: result.author || { name: '' },
                tags: result.tags || [],
                images: result.images || [],
                originalUrl: result.originalUrl,
                capturedAt: new Date(result.capturedAt || Date.now()),
                publishedAt: result.publishedAt ? new Date(result.publishedAt) : undefined,
                stats: result.stats,
            });

            console.log('[Main] Material saved:', response.id);

            // Notify renderer to refresh materials
            if (mainWindow) {
                mainWindow.webContents.send('material-saved', { tabId, material: response });
            }
        } catch (error) {
            console.error('[Main] Save failed:', error);
        }
    } else {
        console.error('[Main] Capture failed:', result?.error);
    }
}

/**
 * Setup IPC handlers for communication with renderer
 */
function setupIpcHandlers() {
    // Create a new tab view
    ipcMain.handle('create-tab-view', async (event, { tabId, url, bounds }) => {
        try {
            if (!mainWindow) return { success: false, error: 'No main window' };

            const view = new WebContentsView({
                webPreferences: {
                    preload: path.join(__dirname, 'webview-preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            // Set User-Agent for this view
            const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            view.webContents.setUserAgent(userAgent);

            // Set bounds
            view.setBounds(bounds);

            // Add to window
            mainWindow.contentView.addChildView(view);

            // Load URL
            await view.webContents.loadURL(url);

            // Store reference
            tabViews.set(tabId, view);

            // Setup event handlers
            view.webContents.on('did-start-loading', () => {
                event.sender.send('tab-loading-changed', { tabId, isLoading: true });
            });

            view.webContents.on('did-stop-loading', () => {
                event.sender.send('tab-loading-changed', { tabId, isLoading: false });
            });

            view.webContents.on('did-navigate', (e, url) => {
                event.sender.send('tab-navigated', { tabId, url });
            });

            view.webContents.on('did-navigate-in-page', (e, url) => {
                event.sender.send('tab-navigated', { tabId, url });
            });

            view.webContents.on('page-title-updated', (e, title) => {
                event.sender.send('tab-title-changed', { tabId, title });
            });

            // Setup IPC message forwarding from webview to main process
            view.webContents.ipc.on('show-context-menu', (e, data) => {
                console.log('[Main] Context menu requested:', data);
                showContextMenu(tabId, data);
            });

            view.webContents.ipc.on('capture-result', (e, result) => {
                console.log('[Main] Capture result received:', result);
                handleCaptureResult(tabId, result);
            });

            return { success: true };
        } catch (error) {
            console.error('[IPC] create-tab-view failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Remove a tab view
    ipcMain.handle('remove-tab-view', async (event, tabId: string) => {
        try {
            const view = tabViews.get(tabId);
            if (view && mainWindow) {
                mainWindow.contentView.removeChildView(view);
                tabViews.delete(tabId);
            }
            return { success: true };
        } catch (error) {
            console.error('[IPC] remove-tab-view failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Show a tab view
    ipcMain.handle('show-tab-view', async (event, { tabId, bounds }) => {
        try {
            const view = tabViews.get(tabId);
            if (view) {
                view.setBounds(bounds);
                view.setVisible(true);
            }
            return { success: true };
        } catch (error) {
            console.error('[IPC] show-tab-view failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Hide a tab view
    ipcMain.handle('hide-tab-view', async (event, tabId: string) => {
        try {
            const view = tabViews.get(tabId);
            if (view) {
                view.setVisible(false);
            }
            return { success: true };
        } catch (error) {
            console.error('[IPC] hide-tab-view failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Navigate tab view
    ipcMain.handle('navigate-tab-view', async (event, { tabId, url }) => {
        try {
            const view = tabViews.get(tabId);
            if (view) {
                await view.webContents.loadURL(url);
            }
            return { success: true };
        } catch (error) {
            console.error('[IPC] navigate-tab-view failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // Go back
    ipcMain.handle('tab-go-back', async (event, tabId: string) => {
        try {
            const view = tabViews.get(tabId);
            if (view && view.webContents.canGoBack()) {
                view.webContents.goBack();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Go forward
    ipcMain.handle('tab-go-forward', async (event, tabId: string) => {
        try {
            const view = tabViews.get(tabId);
            if (view && view.webContents.canGoForward()) {
                view.webContents.goForward();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Reload
    ipcMain.handle('tab-reload', async (event, tabId: string) => {
        try {
            const view = tabViews.get(tabId);
            if (view) {
                view.webContents.reload();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Get navigation state
    ipcMain.handle('get-tab-navigation-state', async (event, tabId: string) => {
        try {
            const view = tabViews.get(tabId);
            if (view) {
                return {
                    success: true,
                    canGoBack: view.webContents.canGoBack(),
                    canGoForward: view.webContents.canGoForward(),
                    url: view.webContents.getURL()
                };
            }
            return { success: false };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Execute script in tab
    ipcMain.handle('execute-script-in-tab', async (event, { tabId, script }) => {
        try {
            const view = tabViews.get(tabId);
            if (view) {
                const result = await view.webContents.executeJavaScript(script);
                return { success: true, data: result };
            }
            return { success: false, error: 'Tab not found' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

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

}

app.on('window-all-closed', () => {
    closeDatabase();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
