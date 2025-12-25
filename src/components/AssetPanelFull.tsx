import { useState, useEffect } from 'react';
import { Trash2, Download, Edit3, ExternalLink, Play, Image as ImageIcon, FileText, ArrowLeft, X, Package } from 'lucide-react';
import { AssetCard, type Asset, type AssetType, type ScreenshotTypeData, type ContentTypeData } from './AssetCard';

const { ipcRenderer } = window.require('electron');

type FilterType = 'all' | 'content' | 'screenshot';

interface AssetPanelFullProps {
    onClose: () => void;
    refreshTrigger?: number;
    onEditScreenshot?: (asset: Asset) => void;
}

export function AssetPanelFull({ onClose, refreshTrigger = 0, onEditScreenshot }: AssetPanelFullProps) {
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
                limit: 100,
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
        if (!confirm('确定要删除这个素材吗？')) return;

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
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedAsset(null)}
                            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[16px] font-semibold text-gray-900 truncate">
                                {selectedAsset.title}
                            </h1>
                            <p className="text-[12px] text-gray-400 mt-0.5">
                                {formatFullDate(selectedAsset.createdAt)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isScreenshot && onEditScreenshot && (
                            <button
                                onClick={(e) => handleEdit(selectedAsset, e)}
                                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                                <Edit3 size={14} />
                                编辑
                            </button>
                        )}
                        {isScreenshot && (
                            <button
                                onClick={(e) => handleDownload(selectedAsset, e)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="下载截图"
                            >
                                <Download size={18} className="text-gray-500" />
                            </button>
                        )}
                        <button
                            onClick={(e) => handleDelete(selectedAsset.id, e)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除素材"
                        >
                            <Trash2 size={18} className="text-red-500" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors ml-2"
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-4xl mx-auto">
                        {/* Image/Thumbnail */}
                        {isScreenshot && (
                            <div className="mb-6">
                                <img
                                    src={(typeData as ScreenshotTypeData).finalImageData || (typeData as ScreenshotTypeData).imageData}
                                    alt="Screenshot"
                                    className="w-full h-auto rounded-xl border border-gray-200 shadow-sm"
                                />
                            </div>
                        )}

                        {!isScreenshot && (typeData as ContentTypeData).images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                {(typeData as ContentTypeData).images.map((img, index) => (
                                    <img
                                        key={index}
                                        src={img}
                                        alt={`Image ${index + 1}`}
                                        className="w-full h-auto rounded-xl border border-gray-200 object-cover aspect-video"
                                    />
                                ))}
                            </div>
                        )}

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column */}
                            <div className="space-y-5">
                                {/* Platform and Author */}
                                {(selectedAsset.platform || selectedAsset.author) && (
                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                        {selectedAsset.favicon && (
                                            <img
                                                src={selectedAsset.favicon}
                                                alt={selectedAsset.platform || 'platform'}
                                                className="w-6 h-6 rounded"
                                            />
                                        )}
                                        {selectedAsset.author && (
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {selectedAsset.author.avatar && (
                                                    <img
                                                        src={selectedAsset.author.avatar}
                                                        alt={selectedAsset.author.name}
                                                        className="w-8 h-8 rounded-full object-cover"
                                                    />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    {selectedAsset.author.profileUrl ? (
                                                        <a
                                                            href={selectedAsset.author.profileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[14px] font-medium text-gray-900 hover:text-blue-600 truncate block"
                                                        >
                                                            {selectedAsset.author.name}
                                                        </a>
                                                    ) : (
                                                        <div className="text-[14px] font-medium text-gray-900 truncate">
                                                            {selectedAsset.author.name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {selectedAsset.platform && !selectedAsset.author && (
                                            <span className="text-[13px] text-gray-600 capitalize">{selectedAsset.platform}</span>
                                        )}
                                    </div>
                                )}

                                {/* Timestamp (for screenshot) */}
                                {isScreenshot && (
                                    <div className="p-4 bg-gray-50 rounded-xl">
                                        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">视频时间点</div>
                                        <div className="text-[15px] text-gray-900 font-mono flex items-center gap-2">
                                            <Play size={14} className="text-gray-500" />
                                            {formatTime((typeData as ScreenshotTypeData).timestamp)}
                                        </div>
                                    </div>
                                )}

                                {/* Content (for content type) */}
                                {!isScreenshot && (typeData as ContentTypeData).content && (
                                    <div>
                                        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">内容</div>
                                        <div className="text-[14px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                                            {(typeData as ContentTypeData).content}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column */}
                            <div className="space-y-5">
                                {/* Subtitles (for screenshot) */}
                                {isScreenshot && (typeData as ScreenshotTypeData).selectedSubtitles && (typeData as ScreenshotTypeData).selectedSubtitles!.length > 0 && (
                                    <div>
                                        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">字幕</div>
                                        <div className="space-y-2">
                                            {(typeData as ScreenshotTypeData).selectedSubtitles!.map((sub, index) => (
                                                <div key={index} className="p-3 bg-gray-50 rounded-xl text-[13px] text-gray-700 leading-relaxed">
                                                    {sub.text}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tags (for content type) */}
                                {!isScreenshot && (typeData as ContentTypeData).tags.length > 0 && (
                                    <div>
                                        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">标签</div>
                                        <div className="flex flex-wrap gap-2">
                                            {(typeData as ContentTypeData).tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[12px] rounded-lg"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* URL */}
                                <div>
                                    <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">来源链接</div>
                                    <a
                                        href={selectedAsset.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[13px] text-blue-600 hover:underline break-all flex items-center gap-1.5"
                                    >
                                        <ExternalLink size={14} />
                                        {selectedAsset.url}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // If asset is selected, show detail view
    if (selectedAsset) {
        return (
            <div className="h-full bg-white rounded-xl">
                {renderDetailView()}
            </div>
        );
    }

    return (
        <div className="h-full bg-white rounded-xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                        <Package size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-[18px] font-semibold text-gray-900">素材库</h1>
                        <p className="text-[13px] text-gray-400 mt-0.5">管理您收集的截图和内容</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                        filter === 'all'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    全部
                </button>
                <button
                    onClick={() => setFilter('screenshot')}
                    className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        filter === 'screenshot'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <ImageIcon size={14} />
                    截图
                </button>
                <button
                    onClick={() => setFilter('content')}
                    className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                        filter === 'content'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <FileText size={14} />
                    内容
                </button>
                <div className="flex-1" />
                <span className="text-[12px] text-gray-400">
                    {assets.length} 个素材
                </span>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                </div>
            ) : assets.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                    <ImageIcon size={48} strokeWidth={1.5} />
                    <div className="text-center">
                        <p className="text-[15px] font-medium text-gray-500">暂无素材</p>
                        <p className="text-[13px] mt-1">
                            {filter === 'screenshot' && '使用 ⌘S 截取视频画面'}
                            {filter === 'content' && '右键保存网页内容'}
                            {filter === 'all' && '开始收集您的素材'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
