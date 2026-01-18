import { useState, useCallback } from 'react';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { analytics } from '../services/analytics';
import { useTranslation } from '../contexts/I18nContext';

interface FeedbackDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

type FeedbackStatus = 'idle' | 'submitting' | 'success' | 'error';

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
    const { t } = useTranslation();
    const [content, setContent] = useState('');
    const [contact, setContact] = useState('');
    const [status, setStatus] = useState<FeedbackStatus>('idle');

    const handleSubmit = useCallback(async () => {
        if (!content.trim()) return;

        setStatus('submitting');
        try {
            const success = await analytics.sendFeedback(content.trim(), contact.trim() || undefined);
            if (success) {
                setStatus('success');
                setTimeout(() => {
                    setContent('');
                    setContact('');
                    setStatus('idle');
                    onClose();
                }, 2000);
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
    }, [content, contact, onClose]);

    const handleClose = useCallback(() => {
        if (status === 'submitting') return;
        setContent('');
        setContact('');
        setStatus('idle');
        onClose();
    }, [status, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* 反馈弹窗 */}
            <div className="relative w-[400px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* 头部 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">{t('feedback.title')}</h2>
                    <button
                        onClick={handleClose}
                        disabled={status === 'submitting'}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* 内容 */}
                <div className="p-5">
                    {status === 'success' ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                                <Check size={24} className="text-emerald-500" />
                            </div>
                            <p className="text-sm text-gray-600">{t('feedback.success')}</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* 反馈内容 */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="text-sm text-gray-500 mb-2">
                                    {t('feedback.content')} <span className="text-red-400">*</span>
                                </div>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder={t('feedback.contentPlaceholder')}
                                    disabled={status === 'submitting'}
                                    className="w-full h-28 px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 placeholder:text-gray-400"
                                />
                            </div>

                            {/* 联系方式 */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="text-sm text-gray-500 mb-2">
                                    {t('feedback.contact')}
                                    <span className="text-gray-400 ml-1">({t('common.optional')})</span>
                                </div>
                                <input
                                    type="text"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    placeholder={t('feedback.contactPlaceholder')}
                                    disabled={status === 'submitting'}
                                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 placeholder:text-gray-400"
                                />
                            </div>

                            {/* 错误提示 */}
                            {status === 'error' && (
                                <div className="flex items-center gap-2 text-sm text-red-500 px-1">
                                    <AlertCircle size={14} />
                                    <span>{t('feedback.error')}</span>
                                </div>
                            )}

                            {/* 提交按钮 */}
                            <button
                                onClick={handleSubmit}
                                disabled={!content.trim() || status === 'submitting'}
                                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>{t('feedback.submitting')}</span>
                                    </>
                                ) : (
                                    <span>{t('feedback.submit')}</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
