import type { ReactNode } from 'react';

interface LayoutProps {
    left: ReactNode;
    main: ReactNode;
    right: ReactNode;
    leftCollapsed: boolean;
    rightCollapsed: boolean;
}

export function Layout({ left, main, right, leftCollapsed, rightCollapsed }: LayoutProps) {
    return (
        <div className="flex h-screen w-screen overflow-hidden p-3 gap-3" style={{ backgroundColor: '#f5f5f5' }}>
            {/* Left Sidebar - Floating Card */}
            <div
                className={`transition-all duration-300 ease-in-out floating-card overflow-hidden ${leftCollapsed ? 'w-0 opacity-0 p-0' : 'w-64 opacity-100'
                    }`}
            >
                {left}
            </div>

            {/* Main Content - Floating Card */}
            <div className="flex-1 flex flex-col min-w-0 relative floating-card bg-dot-grid overflow-hidden">
                {main}
            </div>

            {/* Right Sidebar - Floating Card */}
            <div
                className={`transition-all duration-300 ease-in-out floating-card z-20 overflow-hidden ${rightCollapsed ? 'w-0 opacity-0 p-0' : 'w-80 opacity-100'
                    }`}
            >
                {right}
            </div>
        </div>
    );
}
