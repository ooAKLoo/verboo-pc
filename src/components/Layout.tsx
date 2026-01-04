import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';

interface LayoutProps {
    left: ReactNode;
    main: ReactNode;
    right: ReactNode;
    learning?: ReactNode;
    asset?: ReactNode;
    subtitle?: ReactNode;
    leftCollapsed: boolean;
    rightCollapsed: boolean;
    learningMode?: boolean;
    assetMode?: boolean;
    subtitleMode?: boolean;
}

const MIN_RIGHT_WIDTH = 100;

export function Layout({ left, main, right, learning, asset, subtitle, leftCollapsed, rightCollapsed, learningMode, assetMode, subtitleMode }: LayoutProps) {
    const [rightWidth, setRightWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const lastXRef = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        lastXRef.current = e.clientX;
        setIsResizing(true);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            // 计算增量：向左拖动 = clientX 变小 = delta 为负 = 宽度增加
            const delta = e.clientX - lastXRef.current;
            lastXRef.current = e.clientX; // 关键：每次更新位置

            setRightWidth(prev => Math.max(MIN_RIGHT_WIDTH, prev - delta));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        // 使用 window 而不是 document，确保捕获所有事件
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    return (
        <div className="flex w-screen overflow-hidden p-3 pt-[52px]" style={{ backgroundColor: '#f5f5f5', height: '100vh' }}>
            {/* Left Sidebar - Floating Card */}
            <div
                className={`transition-all duration-300 ease-in-out floating-card overflow-hidden ${leftCollapsed ? 'w-0 opacity-0 p-0 mr-0' : 'w-64 opacity-100 mr-3'
                    }`}
            >
                {left}
            </div>

            {/* Panel Modes - Full width panel */}
            {learningMode && (
                <div className="flex-1 flex flex-col min-w-0 relative floating-card overflow-hidden">
                    {learning}
                </div>
            )}
            {assetMode && (
                <div className="flex-1 flex flex-col min-w-0 relative floating-card overflow-hidden">
                    {asset}
                </div>
            )}
            {subtitleMode && (
                <div className="flex-1 flex flex-col min-w-0 relative floating-card overflow-hidden">
                    {subtitle}
                </div>
            )}

            {/* Main Content - 始终存在，panel 模式时隐藏 */}
            <div
                className={`flex-1 flex flex-col min-w-0 relative floating-card bg-dot-grid overflow-hidden ${
                    learningMode || assetMode || subtitleMode ? 'hidden' : ''
                }`}
            >
                {main}
            </div>

            {/* Resizer - iPad 风格拖拽条 */}
            {!rightCollapsed && !learningMode && !assetMode && !subtitleMode && (
                <div
                    className="flex items-center justify-center flex-shrink-0 cursor-col-resize group w-3 mx-0"
                    onMouseDown={handleMouseDown}
                >
                    <div
                        className={`w-1 rounded-full transition-all duration-200 ease-out ${isResizing
                            ? 'h-16 bg-gray-500'
                            : 'h-8 bg-gray-300 group-hover:h-12 group-hover:bg-gray-500'
                            }`}
                    />
                </div>
            )}

            {/* Right Sidebar - Floating Card */}
            {!learningMode && !assetMode && !subtitleMode && (
                <div
                    className={`transition-opacity duration-300 ease-in-out floating-card z-20 overflow-hidden ${rightCollapsed ? 'w-0 opacity-0 p-0' : 'opacity-100'
                        }`}
                    style={{ width: rightCollapsed ? 0 : `${rightWidth}px` }}
                >
                    {right}
                </div>
            )}
        </div>
    );
}
