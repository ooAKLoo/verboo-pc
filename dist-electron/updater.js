"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initUpdater = initUpdater;
exports.checkForUpdates = checkForUpdates;
/**
 * 自动更新服务
 * 使用 electron-updater 实现后台自动更新
 */
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
// 配置日志
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_updater_1.autoUpdater.logger.transports.file.level = 'info';
// 开发环境也允许检查更新（仅用于测试）
if (process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged) {
    // 强制设置更新源（开发环境下 electron-updater 无法读取 electron-builder 配置）
    electron_updater_1.autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'ooAKLoo',
        repo: 'verboo-pc'
    });
}
let mainWindow = null;
/**
 * 发送更新状态到渲染进程
 */
function sendUpdateStatus(info) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', info);
    }
    electron_log_1.default.info('[Updater]', info);
}
/**
 * 初始化自动更新
 */
function initUpdater(win) {
    mainWindow = win;
    // 禁用自动下载，让用户决定
    electron_updater_1.autoUpdater.autoDownload = false;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    // 检查更新事件
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        sendUpdateStatus({ status: 'checking' });
    });
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        sendUpdateStatus({
            status: 'available',
            version: info.version
        });
    });
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        sendUpdateStatus({ status: 'not-available' });
    });
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        sendUpdateStatus({
            status: 'downloading',
            progress: Math.round(progress.percent)
        });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        sendUpdateStatus({
            status: 'downloaded',
            version: info.version
        });
    });
    electron_updater_1.autoUpdater.on('error', (error) => {
        // 记录完整错误到日志
        electron_log_1.default.error('[Updater] Error:', error);
        // 转换为用户友好的错误信息
        let userFriendlyError = '检查更新失败，请稍后重试';
        if (error.message.includes('404') || error.message.includes('Cannot find')) {
            // 更新文件不存在（常见于新版本刚发布时）
            userFriendlyError = '暂无可用更新';
        }
        else if (error.message.includes('net::') || error.message.includes('ENOTFOUND')) {
            // 网络错误
            userFriendlyError = '网络连接失败，请检查网络后重试';
        }
        else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
            // 超时
            userFriendlyError = '连接超时，请稍后重试';
        }
        sendUpdateStatus({
            status: 'error',
            error: userFriendlyError
        });
    });
    // IPC 处理器
    electron_1.ipcMain.handle('check-for-updates', async () => {
        try {
            const result = await electron_updater_1.autoUpdater.checkForUpdates();
            return { success: true, data: result?.updateInfo };
        }
        catch (error) {
            electron_log_1.default.error('[Updater] Check failed:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('download-update', async () => {
        try {
            await electron_updater_1.autoUpdater.downloadUpdate();
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[Updater] Download failed:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('install-update', () => {
        // 退出并安装更新
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
        return { success: true };
    });
    // get-app-version 已移至 main.ts，确保开发/生产环境都可用
    // 应用启动后延迟检查更新（避免影响启动速度）
    setTimeout(() => {
        electron_log_1.default.info('[Updater] Auto checking for updates...');
        electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
            electron_log_1.default.error('[Updater] Auto check failed:', err);
        });
    }, 10000); // 10秒后检查
}
/**
 * 手动检查更新
 */
async function checkForUpdates() {
    return electron_updater_1.autoUpdater.checkForUpdates();
}
