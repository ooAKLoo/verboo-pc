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
    ChevronRight
} from 'lucide-react';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '../services/analytics';

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
            setUpdateState({ status: 'error', error: '检查失败' });
        }
    }, [ipcRenderer]);

    // 下载更新
    const handleDownloadUpdate = useCallback(async () => {
        try {
            await ipcRenderer.invoke('download-update');
        } catch (error) {
            setUpdateState({ status: 'error', error: '下载失败' });
        }
    }, [ipcRenderer]);

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
                    <h2 className="text-base font-semibold text-gray-900">设置</h2>
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
                            <h3 className="text-sm font-medium text-gray-500">关于</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <img src="/verboo.svg" alt="Verboo" className="h-8" />
                                <div>
                                    <div className="text-sm font-medium text-gray-900">Verboo</div>
                                    <div className="text-xs text-gray-500">
                                        版本 {appVersion || '0.0.0'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 软件更新 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Download size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">软件更新</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            {updateState.status === 'idle' && (
                                <button
                                    onClick={handleCheckUpdate}
                                    className="w-full flex items-center justify-between py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                                >
                                    <span>检查更新</span>
                                    <ChevronRight size={16} className="text-gray-400" />
                                </button>
                            )}

                            {updateState.status === 'checking' && (
                                <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>正在检查...</span>
                                </div>
                            )}

                            {updateState.status === 'not-available' && (
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <Check size={14} />
                                        <span>已是最新版本</span>
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
                                        发现新版本 <span className="font-medium">{updateState.version}</span>
                                    </div>
                                    <button
                                        onClick={handleDownloadUpdate}
                                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        下载更新
                                    </button>
                                </div>
                            )}

                            {updateState.status === 'downloading' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">正在下载...</span>
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
                                        更新已下载完成
                                    </div>
                                    <button
                                        onClick={handleInstallUpdate}
                                        className="w-full py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        立即重启并安装
                                    </button>
                                </div>
                            )}

                            {updateState.status === 'error' && (
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-sm text-red-500">{updateState.error || '更新失败'}</span>
                                    <button
                                        onClick={handleCheckUpdate}
                                        className="text-sm text-blue-500 hover:text-blue-600"
                                    >
                                        重试
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 数据与隐私 */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={14} className="text-gray-400" />
                            <h3 className="text-sm font-medium text-gray-500">数据与隐私</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-700">帮助改进产品</div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        匿名收集使用数据以改进体验
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
                            <h3 className="text-sm font-medium text-gray-500">反馈与帮助</h3>
                        </div>
                        <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                            <button
                                onClick={openFeedback}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors rounded-t-xl"
                            >
                                <span>提交反馈或建议</span>
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
