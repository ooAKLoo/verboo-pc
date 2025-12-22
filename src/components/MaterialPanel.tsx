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

    // Export materials to HTML
    const exportToHTML = () => {
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>素材库导出 - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 30px; color: #333; }
        .stats { background: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .material { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .material h2 { color: #333; margin-bottom: 10px; font-size: 18px; }
        .meta { display: flex; gap: 15px; font-size: 14px; color: #666; margin-bottom: 15px; flex-wrap: wrap; }
        .meta span { background: #f0f0f0; padding: 4px 10px; border-radius: 4px; }
        .content { color: #555; line-height: 1.6; margin-bottom: 15px; white-space: pre-wrap; }
        .images { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px; }
        .images img { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; }
        .tags { display: flex; gap: 8px; flex-wrap: wrap; }
        .tag { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
        .author { margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
        .author img { width: 32px; height: 32px; border-radius: 50%; }
        .link { color: #1976d2; text-decoration: none; font-size: 14px; }
        .link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>素材库导出</h1>
        <div class="stats">
            <strong>导出时间:</strong> ${new Date().toLocaleString('zh-CN')} |
            <strong>素材数量:</strong> ${materials.length}
        </div>
        ${materials.map(m => `
        <div class="material">
            <h2>${m.title || '无标题'}</h2>
            <div class="meta">
                <span>📱 ${m.platform}</span>
                <span>📅 ${new Date(m.capturedAt).toLocaleString('zh-CN')}</span>
            </div>
            ${m.content ? `<div class="content">${m.content}</div>` : ''}
            ${m.images && m.images.length > 0 ? `
            <div class="images">
                ${m.images.map(img => `<img src="${img}" alt="素材图片" loading="lazy">`).join('')}
            </div>
            ` : ''}
            ${m.tags && m.tags.length > 0 ? `
            <div class="tags">
                ${m.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
            ` : ''}
            ${m.author?.name ? `
            <div class="author">
                ${m.author.avatar ? `<img src="${m.author.avatar}" alt="${m.author.name}">` : ''}
                <span>作者: ${m.author.name}</span>
            </div>
            ` : ''}
            ${m.originalUrl ? `<div style="margin-top: 10px;"><a href="${m.originalUrl}" class="link" target="_blank">查看原文 →</a></div>` : ''}
        </div>
        `).join('')}
    </div>
</body>
</html>
        `.trim();

        // Download HTML file
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `素材库_${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Export materials to CSV
    const exportToCSV = () => {
        const headers = ['ID', '平台', '标题', '内容', '作者', '标签', '图片数量', '原始链接', '采集时间'];
        const rows = materials.map(m => [
            m.id,
            m.platform,
            m.title || '',
            (m.content || '').replace(/[\n\r]/g, ' ').replace(/"/g, '""'),
            m.author?.name || '',
            (m.tags || []).join(', '),
            (m.images || []).length,
            m.originalUrl || '',
            new Date(m.capturedAt).toLocaleString('zh-CN')
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Add BOM for Excel UTF-8 support
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `素材库_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Export materials to Markdown
    const exportToMarkdown = () => {
        const md = `# 素材库导出

**导出时间:** ${new Date().toLocaleString('zh-CN')}
**素材数量:** ${materials.length}

---

${materials.map((m, index) => `
## ${index + 1}. ${m.title || '无标题'}

**平台:** ${m.platform}
**采集时间:** ${new Date(m.capturedAt).toLocaleString('zh-CN')}
${m.author?.name ? `**作者:** ${m.author.name}\n` : ''}
${m.originalUrl ? `**原文链接:** ${m.originalUrl}\n` : ''}

${m.content ? `### 内容\n\n${m.content}\n` : ''}

${m.tags && m.tags.length > 0 ? `**标签:** ${m.tags.map(t => `#${t}`).join(' ')}\n` : ''}

${m.images && m.images.length > 0 ? `### 图片 (${m.images.length}张)\n\n${m.images.map((img, i) => `![图片${i + 1}](${img})`).join('\n\n')}\n` : ''}

---
`).join('\n')}

*导出自 Verboo 素材库*
        `.trim();

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `素材库_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Show export menu
    const [showExportMenu, setShowExportMenu] = useState(false);

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
                    <div className="flex items-center gap-1">
                        {/* Export button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
                                title="导出"
                                disabled={materials.length === 0}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                            {/* Export menu */}
                            {showExportMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowExportMenu(false)}
                                    />
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                                        <button
                                            onClick={() => { exportToHTML(); setShowExportMenu(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                            <span>📄</span>
                                            <span>导出为 HTML</span>
                                        </button>
                                        <button
                                            onClick={() => { exportToMarkdown(); setShowExportMenu(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                            <span>📝</span>
                                            <span>导出为 Markdown</span>
                                        </button>
                                        <button
                                            onClick={() => { exportToCSV(); setShowExportMenu(false); }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                            <span>📊</span>
                                            <span>导出为 CSV</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Refresh button */}
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
