
interface SidebarProps {
    onRunPlugin: (script: string) => void;
    onGetYouTubeSubtitles: () => Promise<void>;
}

export function Sidebar({ onRunPlugin, onGetYouTubeSubtitles }: SidebarProps) {
    return (
        <div className="h-full flex flex-col p-4 font-sans bg-white">
            <div className="flex items-center gap-2 mb-6 mt-2 px-2">
                {/* Logo */}
                <div className="w-5 h-5 bg-gradient-to-tr from-accent to-blue-400 rounded shadow-sm"></div>
                <span className="font-medium text-sm text-primary tracking-tight">Plugins</span>
            </div>

            <div className="space-y-1">
                <div
                    onClick={() => onRunPlugin(`
                        // Test Verboo API
                        (() => {
                            if (window.verboo && typeof window.verboo.sendData === 'function') {
                                alert('✅ Verboo API 已正确加载');
                                window.verboo.sendData({
                                    type: 'test',
                                    message: 'Verboo API works!',
                                    url: document.location.href,
                                    title: document.title
                                });
                            } else {
                                alert('❌ Verboo API 未加载。请刷新页面重试。');
                                console.error('window.verboo:', window.verboo);
                            }
                        })();
                    `)}
                    className="group flex flex-col px-3 py-2.5 text-sm rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200"
                >
                    <span className="font-medium text-primary">测试 API</span>
                    <span className="text-xs text-tertiary mt-0.5">检查 Verboo API 是否加载</span>
                </div>

                <div
                    onClick={() => onRunPlugin('document.title')}
                    className="group flex flex-col px-3 py-2.5 text-sm rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200"
                >
                    <span className="font-medium text-primary">Get Page Title</span>
                    <span className="text-xs text-tertiary mt-0.5">Extracts document.title</span>
                </div>

                <div
                    onClick={() => onRunPlugin('Array.from(document.links).map(l => l.href)')}
                    className="group flex flex-col px-3 py-2.5 text-sm rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200"
                >
                    <span className="font-medium text-primary">Get Links</span>
                    <span className="text-xs text-tertiary mt-0.5">Extract all links</span>
                </div>

                <div
                    onClick={onGetYouTubeSubtitles}
                    className="group flex flex-col px-3 py-2.5 text-sm rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200"
                >
                    <span className="font-medium text-primary">YouTube Transcript</span>
                    <span className="text-xs text-tertiary mt-0.5">获取完整字幕</span>
                </div>

            </div >

            <div className="mt-auto px-2">
                <button className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-secondary hover:text-primary transition-colors">
                    + 新建项目
                </button>
            </div>
        </div >
    );
}
