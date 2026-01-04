// macOS 公证脚本
// 这个脚本会在打包完成后自动执行
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    // 只在 macOS 上执行
    if (electronPlatformName !== 'darwin') {
        console.log('Skipping notarization - not macOS');
        return;
    }

    // 检查是否配置了 Apple 凭据
    if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
        console.log('Skipping notarization - APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set');
        console.log('To enable notarization, set these environment variables:');
        console.log('  APPLE_ID=your-apple-id@example.com');
        console.log('  APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx');
        console.log('  APPLE_TEAM_ID=your-team-id');
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    console.log(`Notarizing ${appPath}...`);

    try {
        await notarize({
            tool: 'notarytool',
            appPath,
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
        });
        console.log('Notarization complete!');
    } catch (error) {
        console.error('Notarization failed:', error);
        throw error;
    }
};
