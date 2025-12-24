import { ArrowLeft, ArrowRight, RotateCw, Loader2 } from 'lucide-react';

interface SidebarProps {
    onRunPlugin: (script: string) => void;
    onOpenSubtitleDialog: () => void;
    onCaptureScreenshot: () => void;
    onOpenEnglishLearning: () => void;
    // Navigation toolbar props
    inputUrl: string;
    onInputUrlChange: (url: string) => void;
    onNavigate: (e: React.FormEvent) => void;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    onGoBack: () => void;
    onGoForward: () => void;
    onReload: () => void;
}

export function Sidebar({
    onRunPlugin,
    onOpenSubtitleDialog,
    onCaptureScreenshot,
    onOpenEnglishLearning,
    inputUrl,
    onInputUrlChange,
    onNavigate,
    isLoading,
    canGoBack,
    canGoForward,
    onGoBack,
    onGoForward,
    onReload
}: SidebarProps) {
    return (
        <div className="h-full flex flex-col py-4 font-sans bg-white">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5 px-4">
                <div className="w-[18px] h-[18px] bg-[#18181b] rounded-[5px]"></div>
                <span className="font-semibold text-[13px] text-[#18181b] tracking-[-0.01em]">Plugins</span>
            </div>

            {/* Plugin List */}
            <div className="flex-1 px-2">
                <div
                    onClick={() => onRunPlugin('document.title')}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">Get Page Title</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">Extracts document.title</span>
                </div>

                <div
                    onClick={() => onRunPlugin('Array.from(document.links).map(l => l.href)')}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">Get Links</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">Extract all links</span>
                </div>

                <div
                    onClick={onOpenSubtitleDialog}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">获取字幕</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">自动获取或手动导入</span>
                </div>

                <div
                    onClick={onCaptureScreenshot}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">视频截图</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">捕获当前画面和字幕</span>
                </div>

                <div className="h-px bg-[#e4e4e7] mx-3 my-2" />

                <div
                    onClick={onOpenEnglishLearning}
                    className="group flex flex-col px-3 py-2 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-colors duration-150"
                >
                    <span className="text-[13px] font-medium text-[#18181b]">英语学习</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">分析字幕中的重点难点词汇</span>
                </div>
            </div>

            {/* Navigation Toolbar - Fixed at bottom */}
            <div className="px-2 pb-2">
                <div className="bg-white/90 backdrop-blur-md shadow-lg border border-gray-200 rounded-full px-4 py-2 flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onGoBack}
                            disabled={!canGoBack}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoBack ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <button
                            onClick={onGoForward}
                            disabled={!canGoForward}
                            className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${!canGoForward ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'}`}
                        >
                            <ArrowRight size={16} />
                        </button>
                        <button onClick={onReload} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <RotateCw size={16} />
                            )}
                        </button>
                    </div>

                    <form onSubmit={onNavigate} className="flex-1 flex items-center border-l border-gray-200 pl-3 ml-1">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => onInputUrlChange(e.target.value)}
                            className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none font-medium"
                            placeholder="Enter URL..."
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}
