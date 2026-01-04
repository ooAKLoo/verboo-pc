/**
 * 自动更新服务
 * 使用 electron-updater 实现后台自动更新
 */
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

// 配置日志
autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';

// 更新状态类型
export type UpdateStatus =
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';

export interface UpdateInfo {
    status: UpdateStatus;
    version?: string;
    progress?: number;
    error?: string;
}

let mainWindow: BrowserWindow | null = null;

/**
 * 发送更新状态到渲染进程
 */
function sendUpdateStatus(info: UpdateInfo) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', info);
    }
    log.info('[Updater]', info);
}

/**
 * 初始化自动更新
 */
export function initUpdater(win: BrowserWindow) {
    mainWindow = win;

    // 禁用自动下载，让用户决定
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // 检查更新事件
    autoUpdater.on('checking-for-update', () => {
        sendUpdateStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        sendUpdateStatus({
            status: 'available',
            version: info.version
        });
    });

    autoUpdater.on('update-not-available', () => {
        sendUpdateStatus({ status: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress) => {
        sendUpdateStatus({
            status: 'downloading',
            progress: Math.round(progress.percent)
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        sendUpdateStatus({
            status: 'downloaded',
            version: info.version
        });
    });

    autoUpdater.on('error', (error) => {
        sendUpdateStatus({
            status: 'error',
            error: error.message
        });
    });

    // IPC 处理器
    ipcMain.handle('check-for-updates', async () => {
        try {
            const result = await autoUpdater.checkForUpdates();
            return { success: true, data: result?.updateInfo };
        } catch (error) {
            log.error('[Updater] Check failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error) {
            log.error('[Updater] Download failed:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    ipcMain.handle('install-update', () => {
        // 退出并安装更新
        autoUpdater.quitAndInstall(false, true);
        return { success: true };
    });

    ipcMain.handle('get-app-version', () => {
        const { app } = require('electron');
        return { success: true, version: app.getVersion() };
    });

    // 应用启动后延迟检查更新（避免影响启动速度）
    setTimeout(() => {
        log.info('[Updater] Auto checking for updates...');
        autoUpdater.checkForUpdates().catch((err) => {
            log.error('[Updater] Auto check failed:', err);
        });
    }, 10000); // 10秒后检查
}

/**
 * 手动检查更新
 */
export async function checkForUpdates() {
    return autoUpdater.checkForUpdates();
}
