/**
 * MaterialCard Component
 * 
 * Displays a captured material with image thumbnail.
 * Shows additional info (author, platform, link) on hover.
 */

import React, { useState } from 'react';
import { Trash2, ExternalLink, BookMarked, Twitter, Music, Hash } from 'lucide-react';

export interface Material {
    id: number;
    platform: string;
    title: string;
    content: string;
    author: {
        name: string;
        avatar?: string;
        profileUrl?: string;
    };
    tags: string[];
    images: string[];
    originalUrl: string;
    capturedAt: Date | string;
    createdAt: Date | string;
}

interface MaterialCardProps {
    material: Material;
    onDelete?: (id: number) => void;
    onOpenLink?: (url: string) => void;
}

// Platform icon mapping
const PLATFORM_ICONS: { [key: string]: React.ReactNode } = {
    '小红书': <BookMarked size={12} />,
    'Twitter': <Twitter size={12} />,
    'TikTok': <Music size={12} />,
    'Reddit': <Hash size={12} />,
};

export function MaterialCard({ material, onDelete, onOpenLink }: MaterialCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const platformIcon = PLATFORM_ICONS[material.platform] || <BookMarked size={12} />;
    const hasImages = material.images && material.images.length > 0;
    const primaryImage = hasImages ? material.images[0] : null;

    const handleOpenLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onOpenLink) {
            onOpenLink(material.originalUrl);
        } else {
            window.open(material.originalUrl, '_blank');
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete && window.confirm('确定要删除这个素材吗？')) {
            onDelete(material.id);
        }
    };

    const formatDate = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div
            className="material-card group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {/* Image Container */}
            <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                {primaryImage && !imageError ? (
                    <img
                        src={primaryImage}
                        alt={material.title || 'Material'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-gray-50 to-gray-100">
                        {platformIcon}
                    </div>
                )}

                {/* Image count badge */}
                {hasImages && material.images.length > 1 && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full">
                        {material.images.length}张
                    </div>
                )}

                {/* Platform badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-xs rounded-full flex items-center gap-1 shadow-sm">
                    <span>{platformIcon}</span>
                    <span className="text-gray-600">{material.platform}</span>
                </div>

                {/* Delete button - visible on hover */}
                <button
                    onClick={handleDelete}
                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    title="删除"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Title (always visible) */}
            <div className="p-3">
                <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">
                    {material.title || material.content?.slice(0, 50) || '无标题'}
                </h3>
            </div>

            {/* Expanded Info (hover/click) */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-3 pb-3 space-y-2 border-t border-gray-50 pt-2">
                    {/* Author */}
                    {material.author?.name && (
                        <div className="flex items-center gap-2">
                            {material.author.avatar ? (
                                <img
                                    src={material.author.avatar}
                                    alt={material.author.name}
                                    className="w-5 h-5 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                    {material.author.name[0]}
                                </div>
                            )}
                            <span className="text-xs text-gray-600 truncate">{material.author.name}</span>
                        </div>
                    )}

                    {/* Tags */}
                    {material.tags && material.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {material.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                    #{tag}
                                </span>
                            ))}
                            {material.tags.length > 3 && (
                                <span className="text-xs text-gray-400">+{material.tags.length - 3}</span>
                            )}
                        </div>
                    )}

                    {/* Content preview */}
                    {material.content && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                            {material.content}
                        </p>
                    )}

                    {/* Footer: date & link */}
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-gray-400">
                            {formatDate(material.capturedAt)}
                        </span>
                        <button
                            onClick={handleOpenLink}
                            className="text-xs text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1"
                        >
                            查看原帖
                            <ExternalLink size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MaterialCard;
