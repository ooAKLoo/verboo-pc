import { useState, useRef } from 'react';
import { X, Upload, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseSubtitle, type SubtitleItem } from '../utils/subtitleParser';
import { useTranslation } from '../contexts/I18nContext';

interface SubtitleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubtitlesImport: (subtitles: SubtitleItem[]) => void;
  onAutoFetch?: () => Promise<void>;
  onBilibiliFetch?: () => Promise<void>;
  currentUrl?: string;
}

type TabType = 'auto' | 'manual';

export function SubtitleDialog({
  isOpen,
  onClose,
  onSubtitlesImport,
  onAutoFetch,
  onBilibiliFetch,
  currentUrl = ''
}: SubtitleDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isYouTube = currentUrl.includes('youtube.com/watch');
  const isBilibili = currentUrl.includes('bilibili.com/video');
  const canAutoFetch = isYouTube || isBilibili;

  // 处理文件拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFile(files[0]);
    }
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
  };

  // 处理文件导入
  const handleFile = async (file: File) => {
    setMessage(null);
    setIsLoading(true);

    try {
      const content = await file.text();
      const subtitles = parseSubtitle(content, file.name);

      if (subtitles.length === 0) {
        throw new Error(t('subtitleDialog.parseError'));
      }

      onSubtitlesImport(subtitles);
      setMessage({ type: 'success', text: t('subtitleDialog.importSuccess').replace('{count}', String(subtitles.length)) });

      // 延迟关闭对话框
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '导入失败'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 处理自动获取 (YouTube)
  const handleAutoFetch = async () => {
    if (!onAutoFetch) return;

    setMessage(null);
    setIsLoading(true);

    try {
      await onAutoFetch();
      setMessage({ type: 'success', text: '字幕获取成功' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '获取失败'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 处理 Bilibili 字幕获取
  const handleBilibiliFetch = async () => {
    if (!onBilibiliFetch) return;

    setMessage(null);
    setIsLoading(true);

    try {
      await onBilibiliFetch();
      setMessage({ type: 'success', text: 'B站字幕获取成功' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '获取失败'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 第三方平台推荐
  const platforms = [
    { name: 'B站字幕下载', url: 'https://kedou.life', desc: '哔哩哔哩视频字幕' },
    { name: 'YouTube Subtitles', url: 'https://downloadyoutubesubtitles.com', desc: 'YouTube 字幕下载' },
    { name: 'DownSub', url: 'https://downsub.com', desc: '多平台字幕下载' }
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e4e4e7]">
          <h2 className="text-[15px] font-semibold text-[#18181b]">获取字幕</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#71717a] hover:text-[#18181b] hover:bg-[#f4f4f5] rounded-md transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="relative flex p-0.5 bg-[#f4f4f5] rounded-lg">
            <div
              className="absolute top-0.5 bottom-0.5 rounded-md bg-white shadow-sm transition-all duration-200 ease-out"
              style={{
                width: `calc(50% - 2px)`,
                left: activeTab === 'auto' ? '2px' : 'calc(50% + 0px)',
              }}
            />
            <button
              onClick={() => setActiveTab('auto')}
              className={`relative z-10 flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-200 ${
                activeTab === 'auto' ? 'text-[#18181b]' : 'text-[#71717a]'
              }`}
            >
              自动获取
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`relative z-10 flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-200 ${
                activeTab === 'manual' ? 'text-[#18181b]' : 'text-[#71717a]'
              }`}
            >
              手动导入
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[280px]">
          {activeTab === 'auto' ? (
            <div className="space-y-4">
              {/* Current URL */}
              <div>
                <label className="block text-[12px] font-medium text-[#71717a] mb-2">
                  当前页面
                </label>
                <div className="px-3 py-2 bg-[#f4f4f5] rounded-lg text-[13px] text-[#18181b] truncate">
                  {currentUrl || '未知'}
                </div>
              </div>

              {/* Fetch Button */}
              {isYouTube && (
                <button
                  onClick={handleAutoFetch}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    isLoading
                      ? 'bg-[#f4f4f5] text-[#a1a1aa] cursor-not-allowed'
                      : 'bg-[#18181b] text-white hover:bg-[#27272a] active:scale-[0.98]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>获取中...</span>
                    </>
                  ) : (
                    <span>获取 YouTube 字幕</span>
                  )}
                </button>
              )}

              {isBilibili && (
                <button
                  onClick={handleBilibiliFetch}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    isLoading
                      ? 'bg-[#f4f4f5] text-[#a1a1aa] cursor-not-allowed'
                      : 'bg-[#fb7299] text-white hover:bg-[#f95d89] active:scale-[0.98]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>获取中...</span>
                    </>
                  ) : (
                    <span>获取 B站 AI 字幕</span>
                  )}
                </button>
              )}

              {/* Info Notice */}
              {!canAutoFetch && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-[#fef3c7] rounded-lg">
                  <AlertCircle size={16} className="text-[#f59e0b] mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-[#92400e]">
                    请先打开 YouTube 或 B站 视频页面
                  </p>
                </div>
              )}

              {isBilibili && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-[#e0f2fe] rounded-lg">
                  <AlertCircle size={16} className="text-[#0284c7] mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-[#0369a1]">
                    将自动打开 AI 小助手面板并提取字幕列表
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-[#18181b] bg-[#f4f4f5]'
                    : 'border-[#e4e4e7] hover:border-[#d4d4d8] hover:bg-[#fafafa]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".srt,.vtt,.txt,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Upload size={32} className={`mx-auto mb-3 ${isDragging ? 'text-[#18181b]' : 'text-[#d4d4d8]'}`} />

                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-[#71717a]" />
                    <span className="text-[13px] text-[#71717a]">解析中...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-[#18181b] mb-1">
                      拖拽字幕文件到这里
                    </p>
                    <p className="text-[12px] text-[#a1a1aa] mb-3">
                      或点击选择文件
                    </p>
                    <p className="text-[11px] text-[#71717a]">
                      支持 .srt .vtt .txt .json
                    </p>
                  </>
                )}
              </div>

              {/* Recommended Platforms */}
              <div>
                <label className="block text-[12px] font-medium text-[#71717a] mb-2">
                  推荐下载平台
                </label>
                <div className="space-y-2">
                  {platforms.map((platform) => (
                    <a
                      key={platform.url}
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 bg-[#f4f4f5] hover:bg-[#e4e4e7] rounded-lg transition-colors duration-150 group"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[#18181b]">
                          {platform.name}
                        </div>
                        <div className="text-[11px] text-[#a1a1aa]">
                          {platform.desc}
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-[#a1a1aa] group-hover:text-[#71717a]" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg mt-4 ${
              message.type === 'success' ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 size={16} className="text-[#16a34a] mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-[#dc2626] mt-0.5 flex-shrink-0" />
              )}
              <p className={`text-[12px] ${
                message.type === 'success' ? 'text-[#166534]' : 'text-[#991b1b]'
              }`}>
                {message.text}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
