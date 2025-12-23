import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Download, Edit3, CheckCircle2, AlertCircle, Search, Clock, Type, AlignVerticalJustifyStart, Palette } from 'lucide-react';
import type { SubtitleItem } from '../utils/subtitleParser';

interface ScreenshotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  screenshotData: {
    imageData: string;
    timestamp: number;
    duration: number;
    videoUrl: string;
    videoTitle: string;
    width: number;
    height: number;
  } | null;
  subtitles?: SubtitleItem[];
  onSave: (data: ScreenshotSaveData) => void;
}

export interface ScreenshotSaveData {
  videoUrl: string;
  videoTitle: string;
  timestamp: number;
  imageData: string;
  // Platform and author info
  platform?: string;
  favicon?: string;
  author?: {
    name: string;
    avatar?: string;
    profileUrl?: string;
  };
  subtitles?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  subtitleStyle?: {
    position: string;
    background: string;
    fontSize: number;
    layout: string;
  };
  finalImageData?: string;
}

type ViewMode = 'preview' | 'edit';

export function ScreenshotDialog({
  isOpen,
  onClose,
  screenshotData,
  subtitles = [],
  onSave
}: ScreenshotDialogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [selectedSubtitles, setSelectedSubtitles] = useState<number[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState({
    position: 'bottom',
    background: 'semi-transparent',
    fontSize: 28, // Now a numeric value
    layout: 'vertical'
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Enhanced subtitle selection states
  const [timeRange, setTimeRange] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSubtitles, setShowAllSubtitles] = useState(false);
  const subtitleListRef = useRef<HTMLDivElement>(null);

  // Filter subtitles based on time range and search query
  const filteredSubtitles = useMemo(() => {
    if (!screenshotData || subtitles.length === 0) return [];

    const currentTime = screenshotData.timestamp;
    let filtered = subtitles.map((sub, index) => ({ sub, index }));

    if (!showAllSubtitles) {
      filtered = filtered.filter(({ sub }) => {
        const subEnd = sub.start + (sub.duration || 0);
        return (
          sub.start >= currentTime - timeRange &&
          sub.start <= currentTime + timeRange
        ) || (
          subEnd >= currentTime - timeRange &&
          subEnd <= currentTime + timeRange
        );
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ sub }) =>
        sub.text.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [screenshotData, subtitles, timeRange, searchQuery, showAllSubtitles]);

  // Find current subtitle index
  const currentSubtitleIndex = useMemo(() => {
    if (!screenshotData || subtitles.length === 0) return -1;
    const currentTime = screenshotData.timestamp;
    return subtitles.findIndex(sub => {
      const end = sub.start + (sub.duration || 0);
      return currentTime >= sub.start && currentTime <= end;
    });
  }, [screenshotData, subtitles]);

  // Auto-select matching subtitle on load
  useEffect(() => {
    if (screenshotData && subtitles.length > 0) {
      const currentTime = screenshotData.timestamp;
      const matchingIndices = subtitles
        .map((sub, index) => ({ sub, index }))
        .filter(({ sub }) => {
          const end = sub.start + (sub.duration || 0);
          return currentTime >= sub.start && currentTime <= end;
        })
        .map(({ index }) => index);

      setSelectedSubtitles(matchingIndices);
    }
  }, [screenshotData, subtitles]);

  // Scroll to current subtitle in edit mode
  useEffect(() => {
    if (viewMode === 'edit' && subtitleListRef.current && currentSubtitleIndex >= 0) {
      const currentElement = subtitleListRef.current.querySelector(`[data-index="${currentSubtitleIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [viewMode, currentSubtitleIndex]);

  // Render canvas with subtitles
  useEffect(() => {
    if (!screenshotData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (selectedSubtitles.length > 0) {
        const selectedSubs = selectedSubtitles.map(i => subtitles[i]);
        drawSubtitles(ctx, selectedSubs, canvas.width, canvas.height);
      }
    };
    img.src = screenshotData.imageData;
  }, [screenshotData, selectedSubtitles, subtitleStyle, subtitles]);

  const drawSubtitles = (
    ctx: CanvasRenderingContext2D,
    subs: SubtitleItem[],
    width: number,
    height: number
  ) => {
    const fontSize = subtitleStyle.fontSize;
    const padding = 20;
    const lineHeight = fontSize * 1.4;

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let yPosition = subtitleStyle.position === 'top'
      ? padding + fontSize / 2
      : height - padding - fontSize / 2;

    subs.forEach((sub) => {
      const text = sub.text;
      const textWidth = ctx.measureText(text).width;

      // Draw background
      if (subtitleStyle.background !== 'none') {
        const bgAlpha = subtitleStyle.background === 'semi-transparent' ? 0.75 : 1;
        ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;

        // Rounded rectangle background
        const bgPadding = { x: 16, y: 8 };
        const bgX = width / 2 - textWidth / 2 - bgPadding.x;
        const bgY = yPosition - fontSize / 2 - bgPadding.y;
        const bgWidth = textWidth + bgPadding.x * 2;
        const bgHeight = fontSize + bgPadding.y * 2;
        const radius = 6;

        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, radius);
        ctx.fill();
      }

      // Draw text with slight shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = 'white';
      ctx.fillText(text, width / 2, yPosition);
      ctx.shadowBlur = 0;

      if (subtitleStyle.layout === 'vertical') {
        yPosition += subtitleStyle.position === 'top' ? lineHeight : -lineHeight;
      }
    });
  };

  const handleSave = async () => {
    if (!screenshotData) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const saveData: ScreenshotSaveData = {
        videoUrl: screenshotData.videoUrl,
        videoTitle: screenshotData.videoTitle,
        timestamp: screenshotData.timestamp,
        imageData: screenshotData.imageData,
        subtitles: selectedSubtitles.length > 0
          ? selectedSubtitles.map(i => ({
              start: subtitles[i].start,
              end: subtitles[i].start + (subtitles[i].duration || 0),
              text: subtitles[i].text
            }))
          : undefined,
        subtitleStyle: selectedSubtitles.length > 0 ? subtitleStyle : undefined,
        finalImageData: canvasRef.current?.toDataURL('image/png')
      };

      await onSave(saveData);
      setMessage({ type: 'success', text: '截图已保存' });
      setTimeout(onClose, 800);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '保存失败'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSubtitle = (index: number) => {
    setSelectedSubtitles(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !screenshotData) return null;

  const currentSubtitle = selectedSubtitles.length > 0
    ? subtitles[selectedSubtitles[0]]?.text
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[860px] max-w-[92vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Linear Style */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e4e4e7]">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-[#18181b] tracking-[-0.01em]">
              {viewMode === 'preview' ? '截图预览' : '编辑截图'}
            </h2>
            {viewMode === 'edit' && (
              <span className="px-2 py-0.5 bg-[#f4f4f5] text-[#71717a] text-[11px] font-medium rounded-md">
                已选 {selectedSubtitles.length} 条字幕
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#f4f4f5] rounded-lg transition-colors duration-150"
          >
            <X size={18} strokeWidth={1.75} className="text-[#71717a]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'preview' ? (
            <div className="p-5 space-y-4">
              {/* Preview Canvas */}
              <div className="relative bg-[#18181b] rounded-lg overflow-hidden">
                <canvas ref={canvasRef} className="w-full h-auto" />
              </div>

              {/* Info Card */}
              <div className="bg-[#fafafa] rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">视频</div>
                    <div className="text-[13px] text-[#3f3f46] truncate">{screenshotData.videoTitle}</div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">时间</div>
                    <div className="text-[13px] font-mono text-[#3f3f46]">
                      {formatTime(screenshotData.timestamp)}
                      <span className="text-[#a1a1aa]"> / {formatTime(screenshotData.duration)}</span>
                    </div>
                  </div>
                </div>

                {currentSubtitle && (
                  <div className="pt-3 border-t border-[#e4e4e7]">
                    <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-1.5">检测到字幕</div>
                    <div className="text-[13px] text-[#18181b] leading-relaxed">"{currentSubtitle}"</div>
                  </div>
                )}
              </div>

              {/* Message Toast */}
              {message && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-[#ecfdf5] text-[#059669]'
                    : 'bg-[#fef2f2] text-[#dc2626]'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span className="text-[13px] font-medium">{message.text}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[500px]">
              {/* Left: Canvas Preview */}
              <div className="flex-1 p-5 bg-[#fafafa] border-r border-[#e4e4e7]">
                <div className="h-full flex flex-col">
                  <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-3">实时预览</div>
                  <div className="flex-1 flex items-center justify-center bg-[#18181b] rounded-lg overflow-hidden">
                    <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
                  </div>
                </div>
              </div>

              {/* Right: Controls */}
              <div className="w-[320px] flex flex-col overflow-hidden">
                {/* Subtitle Selection */}
                <div className="flex-1 p-4 overflow-hidden flex flex-col">
                  <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-3">字幕选择</div>

                  {/* Search */}
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索字幕..."
                      className="w-full h-8 pl-9 pr-3 text-[13px] bg-[#f4f4f5] rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#18181b]/10 placeholder:text-[#a1a1aa] transition-all duration-150"
                    />
                  </div>

                  {/* Time Range */}
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={13} className="text-[#a1a1aa] flex-shrink-0" />
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={timeRange}
                      onChange={(e) => setTimeRange(Number(e.target.value))}
                      disabled={showAllSubtitles}
                      className="flex-1 h-1 bg-[#e4e4e7] rounded-full appearance-none cursor-pointer disabled:opacity-40 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#18181b] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                    <span className="text-[11px] text-[#71717a] font-mono w-10 text-right">±{timeRange}s</span>
                  </div>

                  {/* Show All Toggle */}
                  <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                      showAllSubtitles
                        ? 'bg-[#18181b] border-[#18181b]'
                        : 'border-[#d4d4d8] group-hover:border-[#a1a1aa]'
                    }`}>
                      {showAllSubtitles && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={showAllSubtitles}
                      onChange={(e) => setShowAllSubtitles(e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-[12px] text-[#52525b]">
                      显示全部 <span className="text-[#a1a1aa]">({subtitles.length})</span>
                    </span>
                  </label>

                  {/* Subtitle List */}
                  <div
                    ref={subtitleListRef}
                    className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1"
                  >
                    {filteredSubtitles.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-[13px] text-[#a1a1aa]">
                          {searchQuery ? '未找到匹配字幕' : '无字幕'}
                        </span>
                      </div>
                    ) : (
                      filteredSubtitles.map(({ sub, index }) => {
                        const isCurrent = index === currentSubtitleIndex;
                        const isSelected = selectedSubtitles.includes(index);
                        return (
                          <div
                            key={index}
                            data-index={index}
                            onClick={() => toggleSubtitle(index)}
                            className={`p-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                              isCurrent
                                ? 'bg-[#eff6ff] ring-1 ring-[#3b82f6]/20'
                                : isSelected
                                ? 'bg-[#f0fdf4]'
                                : 'hover:bg-[#f4f4f5]'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-[#18181b] border-[#18181b]'
                                  : 'border-[#d4d4d8]'
                              }`}>
                                {isSelected && (
                                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                    <path d="M1 3L2.5 4.5L7 0.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-[#a1a1aa]">{formatTime(sub.start)}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 bg-[#3b82f6] text-white text-[9px] font-semibold rounded uppercase tracking-wide">
                                  当前
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-[#3f3f46] leading-relaxed pl-5.5 break-words">
                              {sub.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#e4e4e7]">
                    <button
                      onClick={() => {
                        const indices = filteredSubtitles.map(({ index }) => index);
                        setSelectedSubtitles(prev => {
                          const newSet = new Set([...prev, ...indices]);
                          return Array.from(newSet).sort((a, b) => a - b);
                        });
                      }}
                      className="flex-1 h-7 text-[11px] font-medium text-[#3b82f6] bg-[#eff6ff] hover:bg-[#dbeafe] rounded-md transition-colors duration-150"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => setSelectedSubtitles([])}
                      className="flex-1 h-7 text-[11px] font-medium text-[#71717a] bg-[#f4f4f5] hover:bg-[#e4e4e7] rounded-md transition-colors duration-150"
                    >
                      清空
                    </button>
                  </div>
                </div>

                {/* Style Settings */}
                <div className="p-4 border-t border-[#e4e4e7] bg-[#fafafa]">
                  <div className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider mb-3">样式设置</div>

                  <div className="space-y-3">
                    {/* Font Size Slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Type size={12} className="text-[#a1a1aa]" />
                          <span className="text-[11px] text-[#71717a]">字体大小</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#a1a1aa]">{subtitleStyle.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={48}
                        step={2}
                        value={subtitleStyle.fontSize}
                        onChange={(e) => setSubtitleStyle({ ...subtitleStyle, fontSize: Number(e.target.value) })}
                        className="w-full h-1 bg-[#e4e4e7] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#18181b] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                      />
                    </div>

                    {/* Position Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlignVerticalJustifyStart size={12} className="text-[#a1a1aa]" />
                        <span className="text-[11px] text-[#71717a]">位置</span>
                      </div>
                      <div className="flex p-0.5 bg-[#e4e4e7] rounded-md">
                        {['top', 'bottom'].map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setSubtitleStyle({ ...subtitleStyle, position: pos })}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all duration-150 ${
                              subtitleStyle.position === pos
                                ? 'bg-white text-[#18181b] shadow-sm'
                                : 'text-[#71717a] hover:text-[#3f3f46]'
                            }`}
                          >
                            {pos === 'top' ? '顶部' : '底部'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Palette size={12} className="text-[#a1a1aa]" />
                        <span className="text-[11px] text-[#71717a]">背景</span>
                      </div>
                      <div className="flex p-0.5 bg-[#e4e4e7] rounded-md">
                        {[
                          { value: 'semi-transparent', label: '半透明' },
                          { value: 'solid', label: '纯黑' },
                          { value: 'none', label: '无' }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSubtitleStyle({ ...subtitleStyle, background: opt.value })}
                            className={`px-2 py-1 text-[11px] font-medium rounded transition-all duration-150 ${
                              subtitleStyle.background === opt.value
                                ? 'bg-white text-[#18181b] shadow-sm'
                                : 'text-[#71717a] hover:text-[#3f3f46]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Linear Style */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#e4e4e7] bg-[#fafafa]">
          <button
            onClick={onClose}
            className="h-8 px-3.5 text-[13px] font-medium text-[#52525b] hover:text-[#18181b] hover:bg-[#e4e4e7] rounded-lg transition-all duration-150"
          >
            取消
          </button>
          <div className="flex items-center gap-2">
            {viewMode === 'preview' && subtitles.length > 0 && (
              <button
                onClick={() => setViewMode('edit')}
                className="flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-medium text-[#52525b] hover:text-[#18181b] hover:bg-[#e4e4e7] rounded-lg transition-all duration-150"
              >
                <Edit3 size={14} strokeWidth={1.75} />
                编辑字幕
              </button>
            )}
            {viewMode === 'edit' && (
              <button
                onClick={() => setViewMode('preview')}
                className="h-8 px-3.5 text-[13px] font-medium text-[#52525b] hover:text-[#18181b] hover:bg-[#e4e4e7] rounded-lg transition-all duration-150"
              >
                预览
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 h-8 px-4 text-[13px] font-medium text-white bg-[#18181b] hover:bg-[#27272a] disabled:opacity-50 rounded-lg transition-all duration-150"
            >
              <Download size={14} strokeWidth={1.75} />
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
