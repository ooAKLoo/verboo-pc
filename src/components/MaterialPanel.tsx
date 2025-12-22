/**
 * MaterialPanel Component
 * 
 * Displays a grid of saved materials with search functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { MaterialCard } from './MaterialCard';
import type { Material } from './MaterialCard';

const { ipcRenderer } = window.require('electron');

interface MaterialPanelProps {
    onOpenLink?: (url: string) => void;
    refreshTrigger?: number; // Increment to trigger refresh
}

export function MaterialPanel({ onOpenLink, refreshTrigger }: MaterialPanelProps) {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [total, setTotal] = useState(0);

    // Fetch materials
    const fetchMaterials = useCallback(async () => {
        setLoading(true);
        try {
            const response = await ipcRenderer.invoke('get-materials', { limit: 50 });
            if (response.success) {
                setMaterials(response.data);
                setTotal(response.total);
            }
        } catch (error) {
            console.error('[MaterialPanel] Failed to fetch materials:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Search materials
    const searchMaterials = useCallback(async (keyword: string) => {
        if (!keyword.trim()) {
            fetchMaterials();
            return;
        }
        setLoading(true);
        try {
            const response = await ipcRenderer.invoke('search-materials', keyword);
            if (response.success) {
                setMaterials(response.data);
            }
        } catch (error) {
            console.error('[MaterialPanel] Search failed:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchMaterials]);

    // Delete material
    const handleDelete = async (id: number) => {
        try {
            const response = await ipcRenderer.invoke('delete-material', id);
            if (response.success) {
                setMaterials(materials.filter(m => m.id !== id));
                setTotal(total - 1);
            }
        } catch (error) {
            console.error('[MaterialPanel] Delete failed:', error);
        }
    };

    // Initial fetch and refresh trigger
    useEffect(() => {
        fetchMaterials();
    }, [fetchMaterials, refreshTrigger]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm) {
                searchMaterials(searchTerm);
            } else {
                fetchMaterials();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, searchMaterials, fetchMaterials]);

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-medium text-gray-800">
                        素材库
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                            {total} 个
                        </span>
                    </h2>
                    <button
                        onClick={() => fetchMaterials()}
                        className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                        title="刷新"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 4v6h-6M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    </button>
                </div>
                <input
                    type="text"
                    placeholder="搜索素材..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            <span className="text-xs">加载中...</span>
                        </div>
                    </div>
                ) : materials.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-500">暂无素材</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {searchTerm ? '未找到匹配的素材' : '右键点击网页内容保存素材'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {materials.map((material) => (
                            <MaterialCard
                                key={material.id}
                                material={material}
                                onDelete={handleDelete}
                                onOpenLink={onOpenLink}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MaterialPanel;
