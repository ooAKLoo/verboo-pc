interface SidebarProps {
    onRunPlugin: (script: string) => void;
    onOpenSubtitleDialog: () => void;
}

export function Sidebar({ onRunPlugin, onOpenSubtitleDialog }: SidebarProps) {
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
            </div>
        </div>
    );
}
