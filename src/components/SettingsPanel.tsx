import { useState, useEffect, useCallback } from 'react';
import {
    X,
    Download,
    Check,
    Loader2,
    MessageSquare,
    BarChart3,
    Info,
    RefreshCw,
    ChevronRight,
    Globe
} from 'lucide-react';
import { isAnalyticsEnabled, setAnalyticsEnabled, analytics } from '../services/analytics';
import { useTranslation, type Locale } from '../contexts/I18nContext';
import { FeedbackDialog } from './FeedbackDialog';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'error';

interface UpdateState {
    status: UpdateStatus;
    version?: string;
    releaseNotes?: string;
    downloadUrl?: string;
    forceUpdate?: boolean;
    error?: string;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const { ipcRenderer } = window.require('electron');
    const { locale, setLocale, t } = useTranslation();

    const [appVersion, setAppVersion] = useState('');
    const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled());
    const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    // 获取应用版本
    useEffect(() => {
        ipcRenderer.invoke('get-app-version').then((result: any) => {
            if (result.success) {
                setAppVersion(result.version);
            }
        });
    }, [ipcRenderer]);

    // 检查更新 (使用 Orbit SDK)
    const handleCheckUpdate = useCallback(async () => {
        setUpdateState({ status: 'checking' });
        try {
            const result = await analytics.checkUpdate();
            if (result.hasUpdate) {
                setUpdateState({
                    status: 'available',
                    version: result.latestVersion,
                    releaseNotes: result.releaseNotes,
                    downloadUrl: result.downloadUrl,
                    forceUpdate: result.forceUpdate,
                });
            } else {
                setUpdateState({ status: 'not-available' });
            }
        } catch (error) {
            setUpdateState({ status: 'error', error: t('settings.checkFailed') });
        }
    }, [t]);

    // 下载更新 (打开下载链接)
    const handleDownloadUpdate = useCallback(() => {
        if (updateState.downloadUrl) {
            const { shell } = window.require('electron');
            shell.openExternal(updateState.downloadUrl);
        }
    }, [updateState.downloadUrl]);

    // 切换语言
    const handleLanguageChange = useCallback((newLocale: Locale) => {
        setLocale(newLocale);
    }, [setLocale]);

    // 切换分析开关
    const toggleAnalytics = useCallback(() => {
        const newValue = !analyticsOn;
        setAnalyticsOn(newValue);
        setAnalyticsEnabled(newValue);
    }, [analyticsOn]);

    // 打开反馈弹窗
    const openFeedback = useCallback(() => {
        setFeedbackOpen(true);
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
                                <img src="./verboo.svg" alt="Verboo" className="h-8" />
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
                        <div className="bg-gray-50 rounded-xl overflow-hidden">
                            <button
                                onClick={() => handleLanguageChange('zh')}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-100"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🇨🇳</span>
                                    <span className="text-sm text-gray-700">简体中文</span>
                                </div>
                                {locale === 'zh' && (
                                    <Check size={16} className="text-blue-500" />
                                )}
                            </button>
                            <button
                                onClick={() => handleLanguageChange('en')}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🇺🇸</span>
                                    <span className="text-sm text-gray-700">English</span>
                                </div>
                                {locale === 'en' && (
                                    <Check size={16} className="text-blue-500" />
                                )}
                            </button>
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
                                    {updateState.releaseNotes && (
                                        <div className="text-xs text-gray-500 bg-white rounded-lg p-2 max-h-20 overflow-y-auto">
                                            {updateState.releaseNotes}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleDownloadUpdate}
                                        className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        {t('settings.downloadUpdate')}
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
                                    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${analyticsOn ? 'bg-blue-500' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${analyticsOn ? 'translate-x-4' : 'translate-x-0'
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
                        <div className="bg-gray-50 rounded-xl">
                            <button
                                onClick={openFeedback}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors rounded-xl"
                            >
                                <span>{t('settings.submitFeedback')}</span>
                                <ChevronRight size={14} className="text-gray-400" />
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            {/* 反馈弹窗 */}
            <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </div>
    );
}
