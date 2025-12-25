import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { BrowserView } from './components/BrowserView';
import type { BrowserViewHandle, NavigationState } from './components/BrowserView';
import { InfoPanel } from './components/InfoPanel';
import { LearningPanel } from './components/LearningPanel';
import { AssetPanelFull } from './components/AssetPanelFull';
import { SubtitleDialog } from './components/SubtitleDialog';
import { ScreenshotDialog } from './components/ScreenshotDialog';
import type { ScreenshotSaveData } from './components/ScreenshotDialog';
import { Toast } from './components/Toast';
import type { SubtitleItem } from './utils/subtitleParser';
import type { Asset, ScreenshotTypeData } from './components/AssetCard';
import { PanelLeft, PanelRight } from 'lucide-react';

interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'screenshot';
}

// Pending AI subtitle state for user confirmation
interface PendingAISubtitle {
  data: SubtitleItem[];
  count: number;
}

function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [showEnglishLearning, setShowEnglishLearning] = useState(false);
  const [learningMode, setLearningMode] = useState(false);
  const [assetMode, setAssetMode] = useState(false);

  // Screenshot editing mode (for post-processing)
  const [isScreenshotEditorOpen, setIsScreenshotEditorOpen] = useState(false);
  const [editingScreenshot, setEditingScreenshot] = useState<any>(null);

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);

  // Single page data
  const [subtitleData, setSubtitleData] = useState<SubtitleItem[] | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('New Tab');
  const [materialRefreshTrigger, setMaterialRefreshTrigger] = useState(0);

  // Subtitle marks (important/difficult)
  const [subtitleMarks, setSubtitleMarks] = useState<Array<{ timestamp: number; markType: 'important' | 'difficult' }>>([]);

  // Track last loaded URL to avoid duplicate loads
  const lastLoadedUrlRef = useRef<string>('');

  // Navigation state for Sidebar toolbar
  const [navState, setNavState] = useState<NavigationState>({
    inputUrl: 'https://www.google.com',
    isLoading: false,
    canGoBack: false,
    canGoForward: false
  });

  // Pending AI subtitle for confirmation
  const [pendingAISubtitle, setPendingAISubtitle] = useState<PendingAISubtitle | null>(null);

  const browserRef = useRef<BrowserViewHandle>(null);
  const { ipcRenderer } = window.require('electron');

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'screenshot' = 'success') => {
    setToast({
      id: Date.now().toString(),
      message,
      type
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  // Accept AI subtitle and replace current subtitles
  const acceptAISubtitle = useCallback(async () => {
    if (!pendingAISubtitle) return;

    const { data } = pendingAISubtitle;
    console.log('[App] Accepting AI subtitle:', data.length, 'items');

    // Update subtitle data
    setSubtitleData(data);

    // Save to database
    const url = currentUrl || browserRef.current?.getCurrentUrl() || '';
    if (url) {
      await saveSubtitlesToDatabase(url, pageTitle, 'bilibili-ai', data);
      lastLoadedUrlRef.current = url;
    }

    // Clear pending and show success
    setPendingAISubtitle(null);
    if (rightCollapsed) setRightCollapsed(false);
    showToast('AI字幕已替换', 'success');
  }, [pendingAISubtitle, currentUrl, pageTitle, rightCollapsed, showToast]);

  // Dismiss AI subtitle prompt
  const dismissAISubtitle = useCallback(() => {
    setPendingAISubtitle(null);
  }, []);

  // Auto-load subtitles when URL changes
  useEffect(() => {
    if (!currentUrl) return;

    // Skip if already loaded for this URL
    if (lastLoadedUrlRef.current === currentUrl) return;

    // Only auto-load for video pages
    const isVideoPage = currentUrl.includes('youtube.com/watch') ||
                        currentUrl.includes('bilibili.com/video');
    if (!isVideoPage) return;

    // Check if we already have subtitles loaded in memory
    if (Array.isArray(subtitleData) && subtitleData.length > 0) {
      lastLoadedUrlRef.current = currentUrl;
      return;
    }

    // Try to load from database
    const loadSubtitles = async () => {
      try {
        const response = await ipcRenderer.invoke('get-subtitles-by-url', currentUrl);
        if (response.success && response.data && response.data.subtitleData) {
          console.log('[App] Auto-loaded subtitles for:', currentUrl);
          setSubtitleData(response.data.subtitleData);
          lastLoadedUrlRef.current = currentUrl;
        }
      } catch (error) {
        console.error('[App] Failed to auto-load subtitles:', error);
      }
    };

    loadSubtitles();
  }, [currentUrl, subtitleData, ipcRenderer]);

  // Handle title change
  const handleTitleChange = useCallback((title: string) => {
    setPageTitle(title);
  }, []);

  // Handle URL changes from BrowserView
  const handleUrlChange = useCallback((url: string) => {
    // Clear marks when navigating to a new page
    if (url !== currentUrl) {
      setSubtitleMarks([]);
    }
    setCurrentUrl(url);
  }, [currentUrl]);

  // Handle navigation state changes from BrowserView
  const handleNavigationStateChange = useCallback((state: NavigationState) => {
    setNavState(state);
  }, []);

  // Navigation callbacks for Sidebar
  const handleInputUrlChange = (url: string) => {
    if (browserRef.current) {
      browserRef.current.setInputUrl(url);
    }
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (browserRef.current) {
      browserRef.current.navigate(navState.inputUrl);
    }
  };

  const handleGoBack = () => {
    browserRef.current?.goBack();
  };

  const handleGoForward = () => {
    browserRef.current?.goForward();
  };

  const handleReload = () => {
    browserRef.current?.reload();
  };

  const handleRunPlugin = async (script: string) => {
    if (browserRef.current) {
      try {
        const result = await browserRef.current.executeScript(script);
        setSubtitleData(result);
        if (rightCollapsed) setRightCollapsed(false);
      } catch (error) {
        console.error("Plugin execution failed:", error);
      }
    }
  };

  const handleGetYouTubeSubtitles = async () => {
    if (!browserRef.current) return;

    try {
      const url = browserRef.current.getCurrentUrl();

      if (!url.includes('youtube.com/watch')) {
        throw new Error('请先打开 YouTube 视频页面');
      }

      console.log('Calling IPC to get subtitles for:', url);
      const response = await ipcRenderer.invoke('get-youtube-subtitles', url);

      if (response.success) {
        console.log('Got subtitles:', response.data.length);
        setSubtitleData(response.data);
        if (rightCollapsed) setRightCollapsed(false);

        // Save/update subtitles to database (upsert)
        await saveSubtitlesToDatabase(url, pageTitle, 'youtube', response.data);
        lastLoadedUrlRef.current = url;
      } else {
        throw new Error(response.error || '获取失败');
      }
    } catch (error) {
      console.error('Failed to get subtitles:', error);
      throw error;
    }
  };

  const handleImportSubtitles = async (subtitles: SubtitleItem[]) => {
    setSubtitleData(subtitles);
    if (rightCollapsed) setRightCollapsed(false);

    // Save/update imported subtitles (upsert)
    const url = browserRef.current?.getCurrentUrl() || '';
    if (url) {
      await saveSubtitlesToDatabase(url, pageTitle, 'import', subtitles);
      lastLoadedUrlRef.current = url;
    }
  };

  // Save subtitles to database (upsert by video_url)
  const saveSubtitlesToDatabase = async (videoUrl: string, videoTitle: string, platform: string, subtitleDataToSave: SubtitleItem[]) => {
    try {
      const response = await ipcRenderer.invoke('save-subtitles', {
        videoUrl,
        videoTitle,
        platform,
        subtitleData: subtitleDataToSave
      });
      if (response.success) {
        console.log('[App] Subtitles saved/updated:', response.data.id);
      }
    } catch (error) {
      console.error('[App] Failed to save subtitles:', error);
    }
  };

  // Mark type for captures
  type MarkType = 'none' | 'important' | 'difficult';

  // Quick capture - silent save with toast feedback
  const handleCaptureScreenshot = async (markType: MarkType = 'none') => {
    if (!browserRef.current) {
      showToast('浏览器未就绪', 'error');
      return;
    }

    try {
      const result = await browserRef.current.captureVideoFrame();
      const currentSubtitles = Array.isArray(subtitleData) ? subtitleData : [];

      // Find matching subtitle for current timestamp
      const matchingSubtitles = currentSubtitles.filter((sub: SubtitleItem) => {
        const end = sub.start + (sub.duration || 0);
        return result.timestamp >= sub.start && result.timestamp <= end;
      });

      // Prepare save data with mark type
      const saveData: ScreenshotSaveData = {
        videoUrl: result.videoUrl,
        videoTitle: result.videoTitle,
        timestamp: result.timestamp,
        imageData: result.imageData,
        platform: result.platform,
        favicon: result.favicon,
        author: result.author,
        markType: markType !== 'none' ? markType : undefined,
        subtitles: matchingSubtitles.length > 0
          ? matchingSubtitles.map((sub: SubtitleItem) => ({
              start: sub.start,
              end: sub.start + (sub.duration || 0),
              text: sub.text
            }))
          : undefined,
        subtitleStyle: matchingSubtitles.length > 0
          ? { position: 'bottom', background: 'semi-transparent', fontSize: 28, layout: 'vertical' }
          : undefined
      };

      // Save screenshot silently
      const response = await ipcRenderer.invoke('save-screenshot', saveData);

      if (response.success) {
        console.log('[App] Screenshot saved:', response.data.id, 'mark:', markType);
        setMaterialRefreshTrigger(prev => prev + 1);

        // Add mark to subtitle marks if it's important or difficult
        if (markType === 'important' || markType === 'difficult') {
          setSubtitleMarks(prev => [...prev, { timestamp: result.timestamp, markType }]);
        }

        // Show different toast based on mark type
        const toastMessage = markType === 'important' ? '已标记为重点' :
                           markType === 'difficult' ? '已标记为难点' :
                           '已保存到截图库';
        showToast(toastMessage, 'screenshot');
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error: any) {
      console.error('[App] Screenshot failed:', error);
      showToast(error.error || error.message || '截图失败', 'error');
    }
  };

  // Open screenshot editor for post-processing
  const handleEditScreenshot = async (asset: Asset) => {
    try {
      // Hide WebContentsView so modal is visible
      await ipcRenderer.invoke('wcv-hide-all');

      const typeData = asset.typeData as ScreenshotTypeData;
      const videoUrl = asset.url;

      // Always fetch latest subtitles by videoUrl
      let subtitles: SubtitleItem[] = [];
      const response = await ipcRenderer.invoke('get-subtitles-by-url', videoUrl);
      if (response.success && response.data && response.data.subtitleData) {
        subtitles = response.data.subtitleData;
        console.log('[App] Loaded latest subtitles for editing:', subtitles.length);
      }

      setEditingScreenshot({
        id: asset.id,
        imageData: typeData.imageData,
        timestamp: typeData.timestamp,
        duration: 0,
        videoUrl: asset.url,
        videoTitle: asset.title,
        width: 0,
        height: 0,
        subtitles
      });
      setIsScreenshotEditorOpen(true);
    } catch (error) {
      console.error('[App] Failed to load subtitles for editing:', error);
      const typeData = asset.typeData as ScreenshotTypeData;
      setEditingScreenshot({
        id: asset.id,
        imageData: typeData.imageData,
        timestamp: typeData.timestamp,
        duration: 0,
        videoUrl: asset.url,
        videoTitle: asset.title,
        width: 0,
        height: 0,
        subtitles: []
      });
      setIsScreenshotEditorOpen(true);
    }
  };

  // Save edited screenshot
  const handleSaveEditedScreenshot = async (data: ScreenshotSaveData) => {
    try {
      const updateData = {
        id: editingScreenshot.id,
        typeData: {
          selectedSubtitles: data.subtitles,
          subtitleStyle: data.subtitleStyle,
          finalImageData: data.finalImageData,
        }
      };

      const response = await ipcRenderer.invoke('update-asset', updateData);

      if (response.success) {
        console.log('[App] Screenshot updated:', response.data.id);
        setMaterialRefreshTrigger(prev => prev + 1);
        setIsScreenshotEditorOpen(false);
        setEditingScreenshot(null);
        showToast('截图已更新', 'success');
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('[App] Failed to update screenshot:', error);
      throw error;
    }
  };

  // Video duration state
  const [videoDuration, setVideoDuration] = useState(0);

  // Pending seek position (for resuming video)
  const pendingSeekRef = useRef<number | null>(null);

  // Handle data from BrowserView
  const handleBrowserData = useCallback((data: any) => {
    if (data && data.type === 'video-time') {
      setCurrentVideoTime(data.data.currentTime);
      if (data.data.duration) {
        setVideoDuration(data.data.duration);
      }
      // Handle pending seek (resume position)
      if (pendingSeekRef.current !== null && data.data.currentTime > 0) {
        const seekTo = pendingSeekRef.current;
        pendingSeekRef.current = null;
        // Seek video to saved position
        browserRef.current?.executeScript(`
          (function() {
            const video = document.querySelector('video');
            if (video) {
              video.currentTime = ${seekTo};
              console.log('[Verboo] Resumed to position:', ${seekTo});
            }
          })();
        `);
      }
    }
    else if (data && data.type === 'subtitle') {
      setSubtitleData(prev => {
        const currentList = Array.isArray(prev) ? prev : [];
        return [...currentList, data];
      });
      if (rightCollapsed) setRightCollapsed(false);
    }
    else if (data && data.type === 'transcript') {
      setSubtitleData(data.data);
      if (rightCollapsed) setRightCollapsed(false);
    }
    else if (data && data.type === 'material-saved') {
      setMaterialRefreshTrigger(prev => prev + 1);
      if (rightCollapsed) setRightCollapsed(false);
    }
    else if (data && data.type === 'bilibili-ai-subtitle') {
      console.log('[App] Received Bilibili AI subtitle:', data.count, 'items');
      setPendingAISubtitle({
        data: data.data,
        count: data.count
      });
    }
    else if (data) {
      setSubtitleData(data);
      if (rightCollapsed) setRightCollapsed(false);
    }
  }, [rightCollapsed]);

  return (
    <div className="w-full h-full font-sans antialiased text-primary bg-background selection:bg-accent/20">
      {/* Subtitle Dialog */}
      <SubtitleDialog
        isOpen={isSubtitleDialogOpen}
        onClose={() => {
          setIsSubtitleDialogOpen(false);
          ipcRenderer.invoke('wcv-show-active');
        }}
        onSubtitlesImport={handleImportSubtitles}
        onAutoFetch={handleGetYouTubeSubtitles}
        currentUrl={browserRef.current?.getCurrentUrl() || ''}
      />

      {/* Screenshot Editor (for post-processing) */}
      <ScreenshotDialog
        isOpen={isScreenshotEditorOpen}
        onClose={() => {
          setIsScreenshotEditorOpen(false);
          setEditingScreenshot(null);
          ipcRenderer.invoke('wcv-show-active');
        }}
        screenshotData={editingScreenshot}
        subtitles={editingScreenshot?.subtitles || []}
        onSave={handleSaveEditedScreenshot}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}

      {/* AI Subtitle Confirmation Prompt */}
      {pendingAISubtitle && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-gray-700">
                检测到 AI 字幕 ({pendingAISubtitle.count} 条)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={acceptAISubtitle}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                使用此字幕
              </button>
              <button
                onClick={dismissAISubtitle}
                className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                忽略
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Titlebar with Toggle Buttons */}
      <div
        className="fixed top-0 left-0 right-0 h-[52px] flex items-center justify-between px-4 z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left side - after traffic lights (macOS) */}
        <div className="flex items-center" style={{ marginLeft: '70px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="p-1.5 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 rounded-md transition-all duration-200 shadow-sm"
          >
            <PanelLeft size={16} className={leftCollapsed ? "opacity-50" : "opacity-100"} />
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => {
              if (learningMode) {
                setLearningMode(false);
                ipcRenderer.invoke('wcv-show-active');
              } else if (assetMode) {
                setAssetMode(false);
                ipcRenderer.invoke('wcv-show-active');
              } else {
                setRightCollapsed(!rightCollapsed);
              }
            }}
            className="p-1.5 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 rounded-md transition-all duration-200 shadow-sm"
          >
            <PanelRight size={16} className={(rightCollapsed && !learningMode && !assetMode) ? "opacity-50" : "opacity-100"} />
          </button>
        </div>
      </div>

      <Layout
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        learningMode={learningMode}
        assetMode={assetMode}
        left={
          <Sidebar
            onRunPlugin={handleRunPlugin}
            onOpenSubtitleDialog={() => {
              ipcRenderer.invoke('wcv-hide-all');
              setIsSubtitleDialogOpen(true);
            }}
            onCaptureScreenshot={handleCaptureScreenshot}
            onOpenEnglishLearning={() => {
              setLearningMode(true);
              setAssetMode(false);
              ipcRenderer.invoke('wcv-hide-all');
            }}
            onOpenAssetPanel={() => {
              setAssetMode(true);
              setLearningMode(false);
              ipcRenderer.invoke('wcv-hide-all');
            }}
            inputUrl={navState.inputUrl}
            onInputUrlChange={handleInputUrlChange}
            onNavigate={handleNavigate}
            onNavigateToUrl={(url, seekTo) => {
              if (seekTo && seekTo > 0) {
                pendingSeekRef.current = seekTo;
              }
              browserRef.current?.navigate(url);
            }}
            isLoading={navState.isLoading}
            canGoBack={navState.canGoBack}
            canGoForward={navState.canGoForward}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            onReload={handleReload}
            currentUrl={currentUrl}
            pageTitle={pageTitle}
            currentVideoTime={currentVideoTime}
            videoDuration={videoDuration}
          />
        }
        main={
          <div className="flex flex-col h-full">
            <div className="flex-1 relative">
              <BrowserView
                ref={browserRef}
                initialUrl="https://www.google.com"
                onTitleChange={handleTitleChange}
                onUrlChange={handleUrlChange}
                onNavigationStateChange={handleNavigationStateChange}
                onData={handleBrowserData}
              />
            </div>
          </div>
        }
        right={
          <InfoPanel
            data={subtitleData}
            currentVideoTime={currentVideoTime}
            materialRefreshTrigger={materialRefreshTrigger}
            onEditScreenshot={handleEditScreenshot}
            showEnglishLearning={showEnglishLearning}
            onCloseEnglishLearning={() => setShowEnglishLearning(false)}
            subtitleMarks={subtitleMarks}
          />
        }
        learning={
          <LearningPanel
            onClose={() => {
              setLearningMode(false);
              ipcRenderer.invoke('wcv-show-active');
            }}
          />
        }
        asset={
          <AssetPanelFull
            onClose={() => {
              setAssetMode(false);
              ipcRenderer.invoke('wcv-show-active');
            }}
            refreshTrigger={materialRefreshTrigger}
            onEditScreenshot={handleEditScreenshot}
          />
        }
      />
    </div>
  );
}

export default App;
