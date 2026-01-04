import { useState, useEffect, useCallback } from 'react';
import {
    X,
    Download,
    Check,
    Loader2,
    ExternalLink,
    MessageSquare,
    BarChart3,
    Info,
    RefreshCw,
    ChevronRight,
    Globe
} from 'lucide-react';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '../services/analytics';
import { useTranslation, type Locale } from '../contexts/I18nContext';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';

interface UpdateState {
    status: UpdateStatus;
    version?: string;
    progress?: number;
    error?: string;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const { ipcRenderer } = window.require('electron');
    const { locale, setLocale, t } = useTranslation();

    const [appVersion, setAppVersion] = useState('');
    const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled());
    const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });

    // 获取应用版本
    useEffect(() => {
        ipcRenderer.invoke('get-app-version').then((result: any) => {
            if (result.success) {
                setAppVersion(result.version);
            }
        });
    }, [ipcRenderer]);

    // 监听更新状态
    useEffect(() => {
        const handleUpdateStatus = (_event: any, info: UpdateState) => {
            setUpdateState(info);
        };

        ipcRenderer.on('update-status', handleUpdateStatus);
        return () => {
            ipcRenderer.removeListener('update-status', handleUpdateStatus);
        };
    }, [ipcRenderer]);

    // 检查更新
    const handleCheckUpdate = useCallback(async () => {
        setUpdateState({ status: 'checking' });
        try {
            await ipcRenderer.invoke('check-for-updates');
        } catch (error) {
            setUpdateState({ status: 'error', error: t('settings.checkFailed') });
        }
    }, [ipcRenderer, t]);

    // 下载更新
    const handleDownloadUpdate = useCallback(async () => {
        try {
            await ipcRenderer.invoke('download-update');
        } catch (error) {
            setUpdateState({ status: 'error', error: t('settings.downloadFailed') });
        }
    }, [ipcRenderer, t]);

    // 切换语言
    const handleLanguageChange = useCallback((newLocale: Locale) => {
        setLocale(newLocale);
    }, [setLocale]);

    // 安装更新
    const handleInstallUpdate = useCallback(() => {
        ipcRenderer.invoke('install-update');
    }, [ipcRenderer]);

    // 切换分析开关
    const toggleAnalytics = useCallback(() => {
        const newValue = !analyticsOn;
        setAnalyticsOn(newValue);
        setAnalyticsEnabled(newValue);
    }, [analyticsOn]);

    // 打开反馈表单
    const openFeedback = useCallback(() => {
        // 使用 Tally 表单或 GitHub Issues
        const feedbackUrl = 'https://github.com/YOUR_USERNAME/verboo/issues/new?template=feedback.md';
        const { shell } = window.require('electron');
        shell.openExternal(feedbackUrl);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 设置面板 */}
            <div className="relative w-[400px] max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* 头部 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">{t('settings.title')}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* 内容 */}
                <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(80vh-60px)]">
                    {/* 关于 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Info size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">{t('settings.about')}</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <img src="/verboo.svg" alt="Verboo" className="h-8" />
                                <div>
                                    <div className="text-sm font-medium text-gray-900">Verboo</div>
                                    <div className="text-xs text-gray-500">
                                        {t('settings.version')} {appVersion || '0.0.0'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 语言 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Globe size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">{t('settings.language')}</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-700">{t('settings.languageDesc')}</div>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => handleLanguageChange('zh')}
                                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                                        locale === 'zh'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                >
                                    {t('settings.chinese')}
                                </button>
                                <button
                                    onClick={() => handleLanguageChange('en')}
                                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                                        locale === 'en'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                >
                                    {t('settings.english')}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* 软件更新 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Download size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">{t('settings.update')}</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            {updateState.status === 'idle' && (
                                <button
                                    onClick={handleCheckUpdate}
                                    className="w-full flex items-center justify-between py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                                >
                                    <span>{t('settings.checkUpdate')}</span>
                                    <ChevronRight size={16} className="text-gray-400" />
                                </button>
                            )}

                            {updateState.status === 'checking' && (
                                <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>{t('settings.checking')}</span>
                                </div>
                            )}

                            {updateState.status === 'not-available' && (
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <Check size={14} />
                                        <span>{t('settings.upToDate')}</span>
                                    </div>
                                    <button
                                        onClick={handleCheckUpdate}
                                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        <RefreshCw size={14} className="text-gray-400" />
                                    </button>
                                </div>
                            )}

                            {updateState.status === 'available' && (
                                <div className="space-y-3">
                                    <div className="text-sm text-gray-700">
                                        {t('settings.newVersion')} <span className="font-medium">{updateState.version}</span>
                                    </div>
                                    <button
                                        onClick={handleDownloadUpdate}
                                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        {t('settings.downloadUpdate')}
                                    </button>
                                </div>
                            )}

                            {updateState.status === 'downloading' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">{t('settings.downloading')}</span>
                                        <span className="text-gray-700 font-medium">{updateState.progress}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-300"
                                            style={{ width: `${updateState.progress || 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {updateState.status === 'downloaded' && (
                                <div className="space-y-3">
                                    <div className="text-sm text-green-600">
                                        {t('settings.downloaded')}
                                    </div>
                                    <button
                                        onClick={handleInstallUpdate}
                                        className="w-full py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        {t('settings.installNow')}
                                    </button>
                                </div>
                            )}

                            {updateState.status === 'error' && (
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-sm text-red-500">{updateState.error || t('settings.updateFailed')}</span>
                                    <button
                                        onClick={handleCheckUpdate}
                                        className="text-sm text-blue-500 hover:text-blue-600"
                                    >
                                        {t('common.retry')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 数据与隐私 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">{t('settings.privacy')}</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-700">{t('settings.analytics')}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        {t('settings.analyticsDesc')}
                                    </div>
                                </div>
                                <button
                                    onClick={toggleAnalytics}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                        analyticsOn ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}
                                >
                                    <div
                                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                            analyticsOn ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* 反馈与帮助 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">{t('settings.feedback')}</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                            <button
                                onClick={openFeedback}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors rounded-t-xl"
                            >
                                <span>{t('settings.submitFeedback')}</span>
                                <ExternalLink size={14} className="text-gray-400" />
                            </button>
                            <button
                                onClick={() => {
                                    const { shell } = window.require('electron');
                                    shell.openExternal('https://github.com/YOUR_USERNAME/verboo');
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors rounded-b-xl"
                            >
                                <span>GitHub</span>
                                <ExternalLink size={14} className="text-gray-400" />
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
