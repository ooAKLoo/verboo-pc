import { useState, useEffect } from 'react';
import { Trash2, Download, Edit3, ExternalLink, Play, Image as ImageIcon, FileText, ArrowLeft } from 'lucide-react';
import { AssetCard, type Asset, type AssetType, type ScreenshotTypeData, type ContentTypeData } from './AssetCard';
import { useTranslation } from '../contexts/I18nContext';

const { ipcRenderer } = window.require('electron');

type FilterType = 'all' | 'content' | 'screenshot';

interface AssetPanelProps {
    refreshTrigger?: number;
    onEditScreenshot?: (asset: Asset) => void;
}

export function AssetPanel({ refreshTrigger = 0, onEditScreenshot }: AssetPanelProps) {
    const { t } = useTranslation();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

    useEffect(() => {
        loadAssets();
    }, [refreshTrigger, filter]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            const options: { type?: AssetType; limit: number; offset: number } = {
                limit: 50,
                offset: 0
            };

            if (filter !== 'all') {
                options.type = filter;
            }

            const response = await ipcRenderer.invoke('get-assets', options);
            if (response.success) {
                setAssets(response.data);
            } else {
                console.error('Failed to load assets:', response.error);
            }
        } catch (error) {
            console.error('Error loading assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(t('assets.deleteConfirm'))) return;

        try {
            const response = await ipcRenderer.invoke('delete-asset', id);
            if (response.success) {
                setAssets(assets.filter(a => a.id !== id));
                if (selectedAsset?.id === id) {
                    setSelectedAsset(null);
                }
            }
        } catch (error) {
            console.error('Error deleting asset:', error);
        }
    };

    const handleDownload = (asset: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        if (asset.type !== 'screenshot') return;

        const typeData = asset.typeData as ScreenshotTypeData;
        const imageData = typeData.finalImageData || typeData.imageData;
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `screenshot_${asset.id}_${new Date(asset.createdAt).getTime()}.png`;
        link.click();
    };

    const handleEdit = (asset: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onEditScreenshot || asset.type !== 'screenshot') return;
        onEditScreenshot(asset);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFullDate = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Render detail view for selected asset
    const renderDetailView = () => {
        if (!selectedAsset) return null;

        const isScreenshot = selectedAsset.type === 'screenshot';
        const typeData = selectedAsset.typeData;

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#e4e4e7] flex items-center justify-between">
                    <button
                        onClick={() => setSelectedAsset(null)}
                        className="flex items-center gap-1.5 text-[13px] text-[#52525b] hover:text-[#18181b] transition-colors"
                    >
                        <ArrowLeft size={14} />
                        {t('assets.back')}
                    </button>
                    <div className="flex items-center gap-1">
                        {isScreenshot && onEditScreenshot && (
                            <button
                                onClick={(e) => handleEdit(selectedAsset, e)}
                                className="flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-[#3b82f6] bg-[#eff6ff] hover:bg-[#dbeafe] rounded-md transition-colors"
                                title={t('assets.editSubtitle')}
                            >
                                <Edit3 size={12} />
                                {t('assets.edit')}
                            </button>
                        )}
                        {isScreenshot && (
                            <button
                                onClick={(e) => handleDownload(selectedAsset, e)}
                                className="p-1.5 hover:bg-[#f4f4f5] rounded-md transition-colors"
                                title={t('assets.downloadScreenshot')}
                            >
                                <Download size={16} className="text-[#71717a]" />
                            </button>
                        )}
                        <button
                            onClick={(e) => handleDelete(selectedAsset.id, e)}
                            className="p-1.5 hover:bg-[#fef2f2] rounded-md transition-colors"
                            title={t('assets.deleteAsset')}
                        >
                            <Trash2 size={16} className="text-[#dc2626]" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {/* Image/Thumbnail */}
                    {isScreenshot && (
                        <div className="max-w-full mb-4">
                            <img
                                src={(typeData as ScreenshotTypeData).finalImageData || (typeData as ScreenshotTypeData).imageData}
                                alt="Screenshot"
                                className="w-full h-auto rounded-lg border border-[#e4e4e7]"
                            />
                        </div>
                    )}

                    {!isScreenshot && (typeData as ContentTypeData).images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {(typeData as ContentTypeData).images.slice(0, 4).map((img, index) => (
                                <img
                                    key={index}
                                    src={img}
                                    alt={`Image ${index + 1}`}
                                    className="w-full h-auto rounded-lg border border-[#e4e4e7] object-cover aspect-video"
                                />
                            ))}
                        </div>
                    )}

                    {/* Info */}
                    <div className="space-y-3">
                        {/* Platform and Author */}
                        {(selectedAsset.platform || selectedAsset.author) && (
                            <div className="flex items-center gap-3 p-3 bg-[#fafafa] rounded-lg">
                                {selectedAsset.favicon && (
                                    <img
                                        src={selectedAsset.favicon}
                                        alt={selectedAsset.platform || 'platform'}
                                        className="w-5 h-5 rounded"
                                    />
                                )}
                                {selectedAsset.author && (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {selectedAsset.author.avatar && (
                                            <img
                                                src={selectedAsset.author.avatar}
                                                alt={selectedAsset.author.name}
                                                className="w-6 h-6 rounded-full object-cover"
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            {selectedAsset.author.profileUrl ? (
                                                <a
                                                    href={selectedAsset.author.profileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[13px] font-medium text-[#18181b] hover:text-[#3b82f6] truncate block"
                                                >
                                                    {selectedAsset.author.name}
                                                </a>
                                            ) : (
                                                <div className="text-[13px] font-medium text-[#18181b] truncate">
                                                    {selectedAsset.author.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {selectedAsset.platform && !selectedAsset.author && (
                                    <span className="text-[12px] text-[#71717a] capitalize">{selectedAsset.platform}</span>
                                )}
                            </div>
                        )}

                        {/* Title */}
                        <div>
                            <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">{t('assets.labelTitle')}</div>
                            <div className="text-[13px] text-[#18181b]">{selectedAsset.title}</div>
                        </div>

                        {/* Content (for content type) */}
                        {!isScreenshot && (typeData as ContentTypeData).content && (
                            <div>
                                <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">{t('assets.labelContent')}</div>
                                <div className="text-[13px] text-[#3f3f46] whitespace-pre-wrap">
                                    {(typeData as ContentTypeData).content}
                                </div>
                            </div>
                        )}

                        {/* Tags (for content type) */}
                        {!isScreenshot && (typeData as ContentTypeData).tags.length > 0 && (
                            <div>
                                <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1.5">{t('assets.labelTags')}</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(typeData as ContentTypeData).tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="px-2 py-0.5 bg-[#f4f4f5] text-[#52525b] text-[11px] rounded"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Timestamp (for screenshot) */}
                        {isScreenshot && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">{t('assets.labelTimestamp')}</div>
                                    <div className="text-[13px] text-[#18181b] font-mono flex items-center gap-1">
                                        <Play size={12} />
                                        {formatTime((typeData as ScreenshotTypeData).timestamp)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">{t('assets.labelCreatedAt')}</div>
                                    <div className="text-[13px] text-[#18181b]">{formatFullDate(selectedAsset.createdAt)}</div>
                                </div>
                            </div>
                        )}

                        {/* Subtitles (for screenshot) */}
                        {isScreenshot && (typeData as ScreenshotTypeData).selectedSubtitles && (typeData as ScreenshotTypeData).selectedSubtitles!.length > 0 && (
                            <div>
                                <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1.5">{t('assets.labelSubtitle')}</div>
                                <div className="space-y-1">
                                    {(typeData as ScreenshotTypeData).selectedSubtitles!.map((sub, index) => (
                                        <div key={index} className="p-2.5 bg-[#f4f4f5] rounded-lg text-[12px] text-[#3f3f46]">
                                            {sub.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* URL */}
                        <div>
                            <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">{t('assets.labelSource')}</div>
                            <a
                                href={selectedAsset.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-[#3b82f6] hover:underline break-all flex items-center gap-1"
                            >
                                <ExternalLink size={12} />
                                {selectedAsset.url}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-[13px] text-[#a1a1aa]">{t('assets.loading')}</div>
            </div>
        );
    }

    // If asset is selected, show detail view
    if (selectedAsset) {
        return renderDetailView();
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="px-4 py-2 border-b border-[#e4e4e7] flex items-center gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                        filter === 'all'
                            ? 'bg-[#18181b] text-white'
                            : 'text-[#52525b] hover:bg-[#f4f4f5]'
                    }`}
                >
                    {t('assets.all')}
                </button>
                <button
                    onClick={() => setFilter('screenshot')}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                        filter === 'screenshot'
                            ? 'bg-[#18181b] text-white'
                            : 'text-[#52525b] hover:bg-[#f4f4f5]'
                    }`}
                >
                    <ImageIcon size={12} />
                    {t('assets.screenshots')}
                </button>
                <button
                    onClick={() => setFilter('content')}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                        filter === 'content'
                            ? 'bg-[#18181b] text-white'
                            : 'text-[#52525b] hover:bg-[#f4f4f5]'
                    }`}
                >
                    <FileText size={12} />
                    {t('assets.content')}
                </button>
            </div>

            {/* Empty State */}
            {assets.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                    <ImageIcon size={28} strokeWidth={1.5} className="text-[#e4e4e7]" />
                    <div className="text-center">
                        <div className="text-[13px] font-medium text-[#71717a] mb-1">{t('assets.empty')}</div>
                        <div className="text-[12px] text-[#a1a1aa]">
                            {filter === 'screenshot' && t('assets.emptyScreenshotHint')}
                            {filter === 'content' && t('assets.emptyContentHint')}
                            {filter === 'all' && t('assets.emptyAllHint')}
                        </div>
                    </div>
                </div>
            )}

            {/* Grid View */}
            {assets.length > 0 && (
                <div className="flex-1 overflow-auto p-4">
                    <div className="grid grid-cols-1 gap-3">
                        {assets.map((asset) => (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                onClick={() => setSelectedAsset(asset)}
                                onDelete={(e) => handleDelete(asset.id, e)}
                                onDownload={asset.type === 'screenshot' ? (e) => handleDownload(asset, e) : undefined}
                                onEdit={asset.type === 'screenshot' && onEditScreenshot ? (e) => handleEdit(asset, e) : undefined}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
