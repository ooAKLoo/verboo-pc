import { useState } from 'react';

export interface Tab {
    id: string;
    url: string;
    title: string;
}

interface TabBarProps {
    tabs: Tab[];
    activeTabId: string;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }: TabBarProps) {
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

    // Get display title for tab
    const getTabTitle = (tab: Tab) => {
        if (tab.title && tab.title !== 'New Tab') {
            return tab.title;
        }
        try {
            const url = new URL(tab.url);
            return url.hostname.replace('www.', '');
        } catch {
            return tab.url.slice(0, 20);
        }
    };

    return (
        <div className="flex items-center bg-white border-b border-gray-200 h-10 px-2 gap-1">
            {/* Tabs */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    const isHovered = tab.id === hoveredTabId;

                    return (
                        <div
                            key={tab.id}
                            onMouseEnter={() => setHoveredTabId(tab.id)}
                            onMouseLeave={() => setHoveredTabId(null)}
                            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg min-w-[120px] max-w-[200px] cursor-pointer transition-all ${isActive
                                    ? 'bg-gray-50 text-primary'
                                    : 'bg-transparent text-gray-600 hover:bg-gray-50/50'
                                }`}
                            onClick={() => onTabClick(tab.id)}
                        >
                            {/* Tab Title */}
                            <span className="flex-1 text-xs font-medium truncate">
                                {getTabTitle(tab)}
                            </span>

                            {/* Close Button */}
                            {(isHovered || tabs.length > 1) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabClose(tab.id);
                                    }}
                                    className="flex items-center justify-center w-4 h-4 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* New Tab Button */}
            <button
                onClick={onNewTab}
                className="flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                title="New Tab"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </button>
        </div>
    );
}
