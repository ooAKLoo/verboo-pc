import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { BrowserView } from './components/BrowserView';
import type { BrowserViewHandle, NavigationState } from './components/BrowserView';
import { InfoPanel } from './components/InfoPanel';
import { LearningPanel } from './components/LearningPanel';
import { AssetPanelFull } from './components/AssetPanelFull';
import { SubtitleLibraryPanel } from './components/SubtitleLibraryPanel';
import { WelcomePage } from './components/WelcomePage';
import { SubtitleDialog } from './components/SubtitleDialog';
import { ScreenshotDialog } from './components/ScreenshotDialog';
import type { ScreenshotSaveData } from './components/ScreenshotDialog';
import { Toast } from './components/Toast';
import type { SubtitleItem } from './utils/subtitleParser';
import type { Asset, ScreenshotTypeData } from './components/AssetCard';
import { PanelLeft, PanelRight } from 'lucide-react';
import { ViewProvider, useView, NavigationProvider, useNavigation } from './contexts';

interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error' | 'screenshot';
}

interface PendingAISubtitle {
  data: SubtitleItem[];
  count: number;
}

// 内部 App 组件，使用 Context
function AppContent() {
  const { ipcRenderer } = window.require('electron');

  // 从 Context 获取视图状态
  const {
    viewMode,
    isWelcomeExiting,
    isInWelcomeMode,
    leftCollapsed,
    rightCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
    setRightCollapsed,
    exitWelcomeAndNavigate,
    closePanel,
  } = useView();

  // 从 Context 获取导航状态
  const {
    browserRef,
    currentUrl,
    pageTitle,
    updateNavigationState,
    updateCurrentUrl,
    updatePageTitle,
    updateVideoTime,
    updateVideoDuration,
    pendingSeekRef,
    navigateToUrl,
  } = useNavigation();

  // 对话框状态
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [showEnglishLearning, setShowEnglishLearning] = useState(false);
  const [isScreenshotEditorOpen, setIsScreenshotEditorOpen] = useState(false);
  const [editingScreenshot, setEditingScreenshot] = useState<any>(null);

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);

  // 字幕和素材数据
  const [subtitleData, setSubtitleData] = useState<SubtitleItem[] | null>(null);
  const [materialRefreshTrigger, setMaterialRefreshTrigger] = useState(0);
  const [subtitleMarks, setSubtitleMarks] = useState<Array<{ timestamp: number; markType: 'important' | 'difficult' }>>([]);

  // Track last loaded URL
  const lastLoadedUrlRef = useRef<string>('');

  // Pending AI subtitle
  const [pendingAISubtitle, setPendingAISubtitle] = useState<PendingAISubtitle | null>(null);

  // Toast helpers
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'screenshot' = 'success') => {
    setToast({ id: Date.now().toString(), message, type });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  // AI subtitle handlers
  const acceptAISubtitle = useCallback(async () => {
    if (!pendingAISubtitle) return;
    setSubtitleData(pendingAISubtitle.data);
    const url = currentUrl || browserRef.current?.getCurrentUrl() || '';
    if (url) {
      await saveSubtitlesToDatabase(url, pageTitle, 'bilibili-ai', pendingAISubtitle.data);
      lastLoadedUrlRef.current = url;
    }
    setPendingAISubtitle(null);
    if (rightCollapsed) setRightCollapsed(false);
    showToast('AI字幕已替换', 'success');
  }, [pendingAISubtitle, currentUrl, pageTitle, rightCollapsed, setRightCollapsed, showToast]);

  const dismissAISubtitle = useCallback(() => setPendingAISubtitle(null), []);

  // Auto-load subtitles
  useEffect(() => {
    if (!currentUrl || lastLoadedUrlRef.current === currentUrl) return;
    const isVideoPage = currentUrl.includes('youtube.com/watch') || currentUrl.includes('bilibili.com/video');
    if (!isVideoPage) return;
    if (Array.isArray(subtitleData) && subtitleData.length > 0) {
      lastLoadedUrlRef.current = currentUrl;
      return;
    }
    const loadSubtitles = async () => {
      try {
        const response = await ipcRenderer.invoke('get-subtitles-by-url', currentUrl);
        if (response.success && response.data?.subtitleData) {
          setSubtitleData(response.data.subtitleData);
          lastLoadedUrlRef.current = currentUrl;
        }
      } catch (error) {
        console.error('[App] Failed to auto-load subtitles:', error);
      }
    };
    loadSubtitles();
  }, [currentUrl, subtitleData, ipcRenderer]);

  // URL change handler
  const handleUrlChange = useCallback((url: string) => {
    if (url !== currentUrl) setSubtitleMarks([]);
    updateCurrentUrl(url);
  }, [currentUrl, updateCurrentUrl]);

  // Subtitle handlers
  const handleGetYouTubeSubtitles = async () => {
    if (!browserRef.current) return;
    const url = browserRef.current.getCurrentUrl();
    if (!url.includes('youtube.com/watch')) throw new Error('请先打开 YouTube 视频页面');
    const response = await ipcRenderer.invoke('get-youtube-subtitles', url);
    if (response.success) {
      setSubtitleData(response.data);
      if (rightCollapsed) setRightCollapsed(false);
      await saveSubtitlesToDatabase(url, pageTitle, 'youtube', response.data);
      lastLoadedUrlRef.current = url;
    } else {
      throw new Error(response.error || '获取失败');
    }
  };

  const handleGetBilibiliSubtitles = async () => {
    if (!browserRef.current) return;
    const url = browserRef.current.getCurrentUrl();
    if (!url.includes('bilibili.com/video')) throw new Error('请先打开 B站 视频页面');
    const subtitles = await browserRef.current.extractBilibiliSubtitles();
    setSubtitleData(subtitles);
    if (rightCollapsed) setRightCollapsed(false);
    await saveSubtitlesToDatabase(url, pageTitle, 'bilibili', subtitles);
    lastLoadedUrlRef.current = url;
  };

  const handleImportSubtitles = async (subtitles: SubtitleItem[]) => {
    setSubtitleData(subtitles);
    if (rightCollapsed) setRightCollapsed(false);
    const url = browserRef.current?.getCurrentUrl() || '';
    if (url) {
      await saveSubtitlesToDatabase(url, pageTitle, 'import', subtitles);
      lastLoadedUrlRef.current = url;
    }
  };

  const saveSubtitlesToDatabase = async (videoUrl: string, videoTitle: string, platform: string, data: SubtitleItem[]) => {
    try {
      const response = await ipcRenderer.invoke('save-subtitles', { videoUrl, videoTitle, platform, subtitleData: data });
      if (response.success) console.log('[App] Subtitles saved:', response.data.id);
    } catch (error) {
      console.error('[App] Failed to save subtitles:', error);
    }
  };

  // Screenshot handler
  type MarkType = 'none' | 'important' | 'difficult';
  const handleCaptureScreenshot = async (markType: MarkType = 'none') => {
    if (!browserRef.current) {
      showToast('浏览器未就绪', 'error');
      return;
    }
    try {
      const result = await browserRef.current.captureVideoFrame();
      const currentSubtitles = Array.isArray(subtitleData) ? subtitleData : [];
      const matchingSubtitles = currentSubtitles.filter((sub: SubtitleItem) => {
        const end = sub.start + (sub.duration || 0);
        return result.timestamp >= sub.start && result.timestamp <= end;
      });

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
          ? matchingSubtitles.map((sub: SubtitleItem) => ({ start: sub.start, end: sub.start + (sub.duration || 0), text: sub.text }))
          : undefined,
        subtitleStyle: matchingSubtitles.length > 0
          ? { position: 'bottom', background: 'semi-transparent', fontSize: 28, layout: 'vertical' }
          : undefined
      };

      const response = await ipcRenderer.invoke('save-screenshot', saveData);
      if (response.success) {
        setMaterialRefreshTrigger(prev => prev + 1);
        if (markType === 'important' || markType === 'difficult') {
          setSubtitleMarks(prev => [...prev, { timestamp: result.timestamp, markType }]);
        }
        const toastMessage = markType === 'important' ? '已标记为重点' : markType === 'difficult' ? '已标记为难点' : '已保存到截图库';
        showToast(toastMessage, 'screenshot');
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error: any) {
      showToast(error.message || '截图失败', 'error');
    }
  };

  // Screenshot editor
  const handleEditScreenshot = async (asset: Asset) => {
    await ipcRenderer.invoke('wcv-hide-all');
    const typeData = asset.typeData as ScreenshotTypeData;
    let subtitles: SubtitleItem[] = [];
    try {
      const response = await ipcRenderer.invoke('get-subtitles-by-url', asset.url);
      if (response.success && response.data?.subtitleData) subtitles = response.data.subtitleData;
    } catch {}
    setEditingScreenshot({
      id: asset.id,
      imageData: typeData.imageData,
      timestamp: typeData.timestamp,
      videoUrl: asset.url,
      videoTitle: asset.title,
      subtitles
    });
    setIsScreenshotEditorOpen(true);
  };

  const handleSaveEditedScreenshot = async (data: ScreenshotSaveData) => {
    const response = await ipcRenderer.invoke('update-asset', {
      id: editingScreenshot.id,
      typeData: { selectedSubtitles: data.subtitles, subtitleStyle: data.subtitleStyle, finalImageData: data.finalImageData }
    });
    if (response.success) {
      setMaterialRefreshTrigger(prev => prev + 1);
      setIsScreenshotEditorOpen(false);
      setEditingScreenshot(null);
      showToast('截图已更新', 'success');
    }
  };

  // Browser data handler
  const handleBrowserData = useCallback((data: any) => {
    if (data?.type === 'video-time') {
      updateVideoTime(data.data.currentTime);
      if (data.data.duration) updateVideoDuration(data.data.duration);
      if (pendingSeekRef.current !== null && data.data.currentTime > 0) {
        const seekTo = pendingSeekRef.current;
        pendingSeekRef.current = null;
        browserRef.current?.executeScript(`(function(){ const v=document.querySelector('video'); if(v) v.currentTime=${seekTo}; })();`);
      }
    } else if (data?.type === 'subtitle') {
      setSubtitleData(prev => [...(Array.isArray(prev) ? prev : []), data]);
      if (rightCollapsed && !isInWelcomeMode) setRightCollapsed(false);
    } else if (data?.type === 'transcript') {
      setSubtitleData(data.data);
      if (rightCollapsed && !isInWelcomeMode) setRightCollapsed(false);
    } else if (data?.type === 'material-saved') {
      setMaterialRefreshTrigger(prev => prev + 1);
      if (rightCollapsed && !isInWelcomeMode) setRightCollapsed(false);
    } else if (data?.type === 'bilibili-ai-subtitle') {
      setPendingAISubtitle({ data: data.data, count: data.count });
    } else if (data) {
      setSubtitleData(data);
      if (rightCollapsed && !isInWelcomeMode) setRightCollapsed(false);
    }
  }, [rightCollapsed, isInWelcomeMode, setRightCollapsed, updateVideoTime, updateVideoDuration, pendingSeekRef, browserRef]);

  return (
    <div className="w-full h-full font-sans antialiased text-primary bg-background selection:bg-accent/20">
      {/* Dialogs */}
      <SubtitleDialog
        isOpen={isSubtitleDialogOpen}
        onClose={() => { setIsSubtitleDialogOpen(false); ipcRenderer.invoke('wcv-show-active'); }}
        onSubtitlesImport={handleImportSubtitles}
        onAutoFetch={handleGetYouTubeSubtitles}
        onBilibiliFetch={handleGetBilibiliSubtitles}
        currentUrl={browserRef.current?.getCurrentUrl() || ''}
      />

      <ScreenshotDialog
        isOpen={isScreenshotEditorOpen}
        onClose={() => { setIsScreenshotEditorOpen(false); setEditingScreenshot(null); ipcRenderer.invoke('wcv-show-active'); }}
        screenshotData={editingScreenshot}
        subtitles={editingScreenshot?.subtitles || []}
        onSave={handleSaveEditedScreenshot}
      />

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* AI Subtitle Prompt */}
      {pendingAISubtitle && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-gray-700">检测到 AI 字幕 ({pendingAISubtitle.count} 条)</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={acceptAISubtitle} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg">使用此字幕</button>
              <button onClick={dismissAISubtitle} className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg">忽略</button>
            </div>
          </div>
        </div>
      )}

      {/* Titlebar */}
      <div className="fixed top-0 left-0 right-0 h-[52px] flex items-center justify-between px-4 z-50" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center" style={{ marginLeft: '70px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button onClick={toggleLeftPanel} className="p-1.5 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 rounded-md transition-all">
            <PanelLeft size={16} className={leftCollapsed ? "opacity-50" : "opacity-100"} />
          </button>
        </div>
        {!isInWelcomeMode && (
          <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => viewMode !== 'browser' ? closePanel() : toggleRightPanel()}
              className="p-1.5 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 rounded-md transition-all"
            >
              <PanelRight size={16} className={(rightCollapsed && viewMode === 'browser') ? "opacity-50" : "opacity-100"} />
            </button>
          </div>
        )}
      </div>

      {/* Layout */}
      <Layout
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        learningMode={viewMode === 'learning'}
        assetMode={viewMode === 'asset'}
        subtitleMode={viewMode === 'subtitle'}
        left={
          <Sidebar
            onOpenSubtitleDialog={() => { ipcRenderer.invoke('wcv-hide-all'); setIsSubtitleDialogOpen(true); }}
            onCaptureScreenshot={handleCaptureScreenshot}
          />
        }
        main={
          <div className="flex flex-col h-full">
            <div className="flex-1 relative">
              {viewMode === 'welcome' && <WelcomePage onNavigate={navigateToUrl} isExiting={isWelcomeExiting} />}
              <BrowserView
                ref={browserRef}
                initialUrl="about:blank"
                initialVisible={viewMode === 'browser'}
                onTitleChange={updatePageTitle}
                onUrlChange={handleUrlChange}
                onNavigationStateChange={updateNavigationState}
                onData={handleBrowserData}
              />
            </div>
          </div>
        }
        right={
          <InfoPanel
            data={subtitleData}
            currentVideoTime={0}
            materialRefreshTrigger={materialRefreshTrigger}
            onEditScreenshot={handleEditScreenshot}
            showEnglishLearning={showEnglishLearning}
            onCloseEnglishLearning={() => setShowEnglishLearning(false)}
            subtitleMarks={subtitleMarks}
            currentUrl={currentUrl}
          />
        }
        learning={<LearningPanel onClose={closePanel} />}
        asset={<AssetPanelFull onClose={closePanel} refreshTrigger={materialRefreshTrigger} onEditScreenshot={handleEditScreenshot} />}
        subtitle={<SubtitleLibraryPanel onClose={closePanel} />}
      />
    </div>
  );
}

// 根组件：提供 Context Providers
function App() {
  const { ipcRenderer } = window.require('electron');

  return (
    <ViewProvider
      onWcvShow={() => ipcRenderer.invoke('wcv-show-active')}
      onWcvHide={() => ipcRenderer.invoke('wcv-hide-all')}
    >
      <NavigationProviderWrapper>
        <AppContent />
      </NavigationProviderWrapper>
    </ViewProvider>
  );
}

// NavigationProvider 包装器，需要访问 useView
function NavigationProviderWrapper({ children }: { children: React.ReactNode }) {
  const { isInWelcomeMode, viewMode, exitWelcomeAndNavigate, switchView } = useView();

  const handleNavigateToUrl = useCallback(async (url: string, seekTo?: number) => {
    if (isInWelcomeMode && viewMode === 'welcome') {
      await exitWelcomeAndNavigate();
    } else if (viewMode !== 'browser') {
      switchView('browser');
    }
  }, [isInWelcomeMode, viewMode, exitWelcomeAndNavigate, switchView]);

  return (
    <NavigationProvider onNavigateToUrl={handleNavigateToUrl}>
      {children}
    </NavigationProvider>
  );
}

export default App;
