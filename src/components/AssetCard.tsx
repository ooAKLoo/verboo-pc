import { Clock, Trash2, Download, Edit3, ExternalLink, Play } from 'lucide-react';

export type AssetType = 'content' | 'screenshot';

export interface ContentTypeData {
    content: string;
    tags: string[];
    images: string[];
    capturedAt: string;
}

export interface ScreenshotTypeData {
    timestamp: number;
    imageData: string;
    finalImageData?: string;
    selectedSubtitles?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    subtitleStyle?: {
        position: string;
        background: string;
        fontSize: number;
        layout: string;
    };
}

export interface Asset {
    id: number;
    type: AssetType;
    platform: string;
    title: string;
    url: string;
    author?: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    favicon?: string;
    thumbnail?: string;
    typeData: ContentTypeData | ScreenshotTypeData;
    subtitleId?: number;
    createdAt: Date;
    updatedAt: Date;
}

interface AssetCardProps {
    asset: Asset;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onDownload?: (e: React.MouseEvent) => void;
    onEdit?: (e: React.MouseEvent) => void;
}

export function AssetCard({ asset, onClick, onDelete, onDownload, onEdit }: AssetCardProps) {
    const isScreenshot = asset.type === 'screenshot';
    const typeData = asset.typeData as ScreenshotTypeData | ContentTypeData;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get thumbnail based on asset type
    const getThumbnail = () => {
        if (isScreenshot) {
            const screenshotData = typeData as ScreenshotTypeData;
            return screenshotData.finalImageData || screenshotData.imageData;
        }
        // For content, use first image or thumbnail
        const contentData = typeData as ContentTypeData;
        return asset.thumbnail || (contentData.images.length > 0 ? contentData.images[0] : null);
    };

    const thumbnail = getThumbnail();

    return (
        <div
            onClick={onClick}
            className="group relative bg-white border border-[#e4e4e7] rounded-lg overflow-hidden hover:border-[#d4d4d8] hover:shadow-sm transition-all cursor-pointer"
        >
            {/* Thumbnail */}
            <div className="aspect-video bg-[#f4f4f5] relative overflow-hidden">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={asset.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-[#a1a1aa] text-[11px]">无预览</div>
                    </div>
                )}

                {/* Type Badge & Time */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    {isScreenshot && (
                        <div className="px-2 py-1 bg-black/75 text-white text-[11px] rounded font-mono flex items-center gap-1">
                            <Play size={10} fill="white" />
                            {formatTime((typeData as ScreenshotTypeData).timestamp)}
                        </div>
                    )}
                    {!isScreenshot && (
                        <div className="px-2 py-1 bg-[#3b82f6]/90 text-white text-[10px] rounded font-medium">
                            内容
                        </div>
                    )}
                </div>

                {/* Platform Badge */}
                {asset.platform && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded text-[11px] text-[#52525b]">
                        {asset.favicon && (
                            <img
                                src={asset.favicon}
                                alt={asset.platform}
                                className="w-3.5 h-3.5 rounded"
                            />
                        )}
                        <span className="capitalize">{asset.platform}</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                {/* Author */}
                {asset.author?.name && (
                    <div className="flex items-center gap-2 mb-2">
                        {asset.author.avatar && (
                            <img
                                src={asset.author.avatar}
                                alt={asset.author.name}
                                className="w-4 h-4 rounded-full object-cover"
                            />
                        )}
                        <span className="text-[11px] text-[#71717a] truncate flex-1">
                            {asset.author.name}
                        </span>
                    </div>
                )}

                {/* Title */}
                <div className="text-[13px] font-medium text-[#18181b] line-clamp-2 mb-2">
                    {asset.title}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-[#a1a1aa]">
                    <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(asset.createdAt)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isScreenshot && onEdit && (
                            <button
                                onClick={onEdit}
                                className="p-1 hover:bg-[#eff6ff] rounded text-[#3b82f6]"
                                title="编辑"
                            >
                                <Edit3 size={14} />
                            </button>
                        )}
                        {isScreenshot && onDownload && (
                            <button
                                onClick={onDownload}
                                className="p-1 hover:bg-[#f4f4f5] rounded text-[#71717a]"
                                title="下载"
                            >
                                <Download size={14} />
                            </button>
                        )}
                        {!isScreenshot && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(asset.url, '_blank');
                                }}
                                className="p-1 hover:bg-[#f4f4f5] rounded text-[#71717a]"
                                title="打开链接"
                            >
                                <ExternalLink size={14} />
                            </button>
                        )}
                        <button
                            onClick={onDelete}
                            className="p-1 hover:bg-[#fef2f2] rounded text-[#dc2626]"
                            title="删除"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
