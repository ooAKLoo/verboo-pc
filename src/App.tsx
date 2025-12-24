import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { BrowserView } from './components/BrowserView';
import type { BrowserViewHandle, NavigationState } from './components/BrowserView';
import { InfoPanel } from './components/InfoPanel';
import { TabBar, type Tab } from './components/TabBar';
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
  tabId: string;
  data: SubtitleItem[];
  count: number;
}

function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [showEnglishLearning, setShowEnglishLearning] = useState(false);

  // Screenshot editing mode (for post-processing)
  const [isScreenshotEditorOpen, setIsScreenshotEditorOpen] = useState(false);
  const [editingScreenshot, setEditingScreenshot] = useState<any>(null);

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);

  // Tab management
  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'tab-1',
    url: 'https://www.google.com',
    title: 'New Tab'
  }]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Per-tab data: subtitles and current URL
  const [tabData, setTabData] = useState<{ [tabId: string]: any }>({});
  const [tabVideoTime, setTabVideoTime] = useState<{ [tabId: string]: number }>({});
  const [tabUrls, setTabUrls] = useState<{ [tabId: string]: string }>({});
  const [materialRefreshTrigger, setMaterialRefreshTrigger] = useState(0);

  // Track last loaded URL to avoid duplicate loads
  const lastLoadedUrlRef = useRef<{ [tabId: string]: string }>({});

  // Navigation state for Sidebar toolbar
  const [navState, setNavState] = useState<NavigationState>({
    inputUrl: 'https://www.google.com',
    isLoading: false,
    canGoBack: false,
    canGoForward: false
  });

  // Pending AI subtitle for confirmation
  const [pendingAISubtitle, setPendingAISubtitle] = useState<PendingAISubtitle | null>(null);

  const browserRef = React.useRef<BrowserViewHandle>(null);
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

    const { tabId, data } = pendingAISubtitle;
    console.log('[App] Accepting AI subtitle for tab:', tabId, data.length, 'items');

    // Update tab data with AI subtitles
    setTabData(prev => ({
      ...prev,
      [tabId]: data
    }));

    // Save to database
    const url = tabUrls[tabId] || browserRef.current?.getCurrentUrl() || '';
    const activeTab = tabs.find(t => t.id === tabId);
    if (url) {
      await saveSubtitlesToDatabase(url, activeTab?.title || '', 'bilibili-ai', data);
      lastLoadedUrlRef.current[tabId] = url;
    }

    // Clear pending and show success
    setPendingAISubtitle(null);
    if (rightCollapsed) setRightCollapsed(false);
    showToast('AI字幕已替换', 'success');
  }, [pendingAISubtitle, tabUrls, tabs, rightCollapsed, showToast]);

  // Dismiss AI subtitle prompt
  const dismissAISubtitle = useCallback(() => {
    setPendingAISubtitle(null);
  }, []);

  // Auto-load subtitles when URL changes
  useEffect(() => {
    const currentUrl = tabUrls[activeTabId];
    if (!currentUrl) return;

    // Skip if already loaded for this URL
    if (lastLoadedUrlRef.current[activeTabId] === currentUrl) return;

    // Only auto-load for video pages
    const isVideoPage = currentUrl.includes('youtube.com/watch') ||
                        currentUrl.includes('bilibili.com/video');
    if (!isVideoPage) return;

    // Check if we already have subtitles loaded in memory
    const existingData = tabData[activeTabId];
    if (Array.isArray(existingData) && existingData.length > 0) {
      lastLoadedUrlRef.current[activeTabId] = currentUrl;
      return;
    }

    // Try to load from database
    const loadSubtitles = async () => {
      try {
        const response = await ipcRenderer.invoke('get-subtitles-by-url', currentUrl);
        if (response.success && response.data && response.data.subtitleData) {
          console.log('[App] Auto-loaded subtitles for:', currentUrl);
          setTabData(prev => ({
            ...prev,
            [activeTabId]: response.data.subtitleData
          }));
          lastLoadedUrlRef.current[activeTabId] = currentUrl;
        }
      } catch (error) {
        console.error('[App] Failed to auto-load subtitles:', error);
      }
    };

    loadSubtitles();
  }, [tabUrls, activeTabId, ipcRenderer]);

  // Tab management functions
  const handleNewTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: Tab = {
      id: newTabId,
      url: 'https://www.google.com',
      title: 'New Tab'
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // Clean up tab data
    setTabData(prev => {
      const newData = { ...prev };
      delete newData[tabId];
      return newData;
    });
    setTabVideoTime(prev => {
      const newData = { ...prev };
      delete newData[tabId];
      return newData;
    });
    setTabUrls(prev => {
      const newData = { ...prev };
      delete newData[tabId];
      return newData;
    });
    delete lastLoadedUrlRef.current[tabId];

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleTitleChange = (title: string, tabId: string) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId ? { ...tab, title } : tab
    ));
  };

  // Handle URL changes from BrowserView
  const handleUrlChange = (url: string, tabId: string) => {
    setTabUrls(prev => ({
      ...prev,
      [tabId]: url
    }));
  };

  // Handle navigation state changes from BrowserView
  const handleNavigationStateChange = (state: NavigationState, tabId: string) => {
    if (tabId === activeTabId) {
      setNavState(state);
    }
  };

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
        setTabData(prev => ({
          ...prev,
          [activeTabId]: result
        }));
        if (rightCollapsed) setRightCollapsed(false);
      } catch (error) {
        console.error("Plugin execution failed:", error);
        setTabData(prev => ({
          ...prev,
          [activeTabId]: { error: String(error) }
        }));
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
        setTabData(prev => ({
          ...prev,
          [activeTabId]: response.data
        }));
        if (rightCollapsed) setRightCollapsed(false);

        // Save/update subtitles to database (upsert)
        const activeTab = tabs.find(t => t.id === activeTabId);
        await saveSubtitlesToDatabase(url, activeTab?.title || '', 'youtube', response.data);

        // Update last loaded URL
        lastLoadedUrlRef.current[activeTabId] = url;
      } else {
        throw new Error(response.error || '获取失败');
      }
    } catch (error) {
      console.error('Failed to get subtitles:', error);
      throw error;
    }
  };

  const handleImportSubtitles = async (subtitles: SubtitleItem[]) => {
    setTabData(prev => ({
      ...prev,
      [activeTabId]: subtitles
    }));
    if (rightCollapsed) setRightCollapsed(false);

    // Save/update imported subtitles (upsert)
    const url = browserRef.current?.getCurrentUrl() || '';
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (url) {
      await saveSubtitlesToDatabase(url, activeTab?.title || '', 'import', subtitles);
      lastLoadedUrlRef.current[activeTabId] = url;
    }
  };

  // Save subtitles to database (upsert by video_url)
  const saveSubtitlesToDatabase = async (videoUrl: string, videoTitle: string, platform: string, subtitleData: SubtitleItem[]) => {
    try {
      const response = await ipcRenderer.invoke('save-subtitles', {
        videoUrl,
        videoTitle,
        platform,
        subtitleData
      });
      if (response.success) {
        console.log('[App] Subtitles saved/updated:', response.data.id);
      }
    } catch (error) {
      console.error('[App] Failed to save subtitles:', error);
    }
  };

  // Quick capture - silent save with toast feedback
  const handleCaptureScreenshot = async () => {
    if (!browserRef.current) {
      showToast('浏览器未就绪', 'error');
      return;
    }

    try {
      const result = await browserRef.current.captureVideoFrame();
      const currentSubtitles = Array.isArray(tabData[activeTabId]) ? tabData[activeTabId] : [];

      // Find matching subtitle for current timestamp
      const matchingSubtitles = currentSubtitles.filter((sub: SubtitleItem) => {
        const end = sub.start + (sub.duration || 0);
        return result.timestamp >= sub.start && result.timestamp <= end;
      });

      // Prepare save data - no subtitleId needed, use videoUrl for association
      const saveData: ScreenshotSaveData = {
        videoUrl: result.videoUrl,
        videoTitle: result.videoTitle,
        timestamp: result.timestamp,
        imageData: result.imageData,
        // Platform and author info
        platform: result.platform,
        favicon: result.favicon,
        author: result.author,
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
        console.log('[App] Screenshot saved:', response.data.id);
        setMaterialRefreshTrigger(prev => prev + 1);
        showToast('已保存到截图库', 'screenshot');
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error: any) {
      console.error('[App] Screenshot failed:', error);
      showToast(error.error || error.message || '截图失败', 'error');
    }
  };

  // Open screenshot editor for post-processing
  // Load latest subtitles by videoUrl when editing
  // Now handles both old Screenshot type and new Asset type
  const handleEditScreenshot = async (asset: Asset) => {
    try {
      // Extract data from the new Asset format
      const typeData = asset.typeData as ScreenshotTypeData;
      const videoUrl = asset.url;

      // Always fetch latest subtitles by videoUrl
      let subtitles: SubtitleItem[] = [];
      const response = await ipcRenderer.invoke('get-subtitles-by-url', videoUrl);
      if (response.success && response.data && response.data.subtitleData) {
        subtitles = response.data.subtitleData;
        console.log('[App] Loaded latest subtitles for editing:', subtitles.length);
      }

      // Transform Asset to ScreenshotDialog format
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
      // Still open editor without subtitles
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
      // Transform ScreenshotSaveData to Asset update format
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

  return (
    <div className="w-full h-full font-sans antialiased text-primary bg-background selection:bg-accent/20">
      {/* Subtitle Dialog */}
      <SubtitleDialog
        isOpen={isSubtitleDialogOpen}
        onClose={() => setIsSubtitleDialogOpen(false)}
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
      {pendingAISubtitle && pendingAISubtitle.tabId === activeTabId && (
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

      {/* Floating Toggle Buttons */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="p-1.5 bg-transparent text-tertiary hover:text-primary hover:bg-white/5 rounded-md transition-all duration-200"
        >
          <PanelLeft size={18} className={leftCollapsed ? "opacity-50" : "opacity-100"} />
        </button>
      </div>

      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="p-1.5 bg-transparent text-tertiary hover:text-primary hover:bg-white/5 rounded-md transition-all duration-200"
        >
          <PanelRight size={18} className={rightCollapsed ? "opacity-50" : "opacity-100"} />
        </button>
      </div>

      <Layout
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        left={
          <Sidebar
            onRunPlugin={handleRunPlugin}
            onOpenSubtitleDialog={() => setIsSubtitleDialogOpen(true)}
            onCaptureScreenshot={handleCaptureScreenshot}
            onOpenEnglishLearning={() => { setShowEnglishLearning(true); if (rightCollapsed) setRightCollapsed(false); }}
            inputUrl={navState.inputUrl}
            onInputUrlChange={handleInputUrlChange}
            onNavigate={handleNavigate}
            isLoading={navState.isLoading}
            canGoBack={navState.canGoBack}
            canGoForward={navState.canGoForward}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            onReload={handleReload}
          />
        }
        main={
          <div className="flex flex-col h-full">
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onTabClose={handleCloseTab}
              onNewTab={handleNewTab}
            />
            <div className="flex-1 relative">
              {tabs.map((tab) => (
                <BrowserView
                  key={tab.id}
                  ref={tab.id === activeTabId ? browserRef : null}
                  tabId={tab.id}
                  initialUrl={tab.url}
                  isActive={tab.id === activeTabId}
                  onTitleChange={handleTitleChange}
                  onUrlChange={handleUrlChange}
                  onNavigationStateChange={handleNavigationStateChange}
                  onData={(data, tabId) => {
                    if (data && data.type === 'video-time') {
                      setTabVideoTime(prev => ({
                        ...prev,
                        [tabId]: data.data.currentTime
                      }));
                    }
                    else if (data && data.type === 'subtitle') {
                      setTabData((prev) => {
                        const currentList = Array.isArray(prev[tabId]) ? prev[tabId] : [];
                        return {
                          ...prev,
                          [tabId]: [...currentList, data]
                        };
                      });
                      if (rightCollapsed) setRightCollapsed(false);
                    }
                    else if (data && data.type === 'transcript') {
                      setTabData(prev => ({
                        ...prev,
                        [tabId]: data.data
                      }));
                      if (rightCollapsed) setRightCollapsed(false);
                    }
                    else if (data && data.type === 'material-saved') {
                      setMaterialRefreshTrigger(prev => prev + 1);
                      if (rightCollapsed) setRightCollapsed(false);
                    }
                    else if (data && data.type === 'bilibili-ai-subtitle') {
                      // Store pending AI subtitle for user confirmation
                      console.log('[App] Received Bilibili AI subtitle:', data.count, 'items');
                      setPendingAISubtitle({
                        tabId,
                        data: data.data,
                        count: data.count
                      });
                    }
                    else {
                      setTabData(prev => ({
                        ...prev,
                        [tabId]: data
                      }));
                      if (rightCollapsed) setRightCollapsed(false);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        }
        right={
          <InfoPanel
            data={tabData[activeTabId]}
            currentVideoTime={tabVideoTime[activeTabId] || 0}
            materialRefreshTrigger={materialRefreshTrigger}
            onEditScreenshot={handleEditScreenshot}
            showEnglishLearning={showEnglishLearning}
            onCloseEnglishLearning={() => setShowEnglishLearning(false)}
          />
        }
      />
    </div>
  );
}

export default App;
