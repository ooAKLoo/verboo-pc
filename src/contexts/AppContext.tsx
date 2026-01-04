import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { BrowserViewHandle, NavigationState } from '../components/BrowserView';

// ============ 类型定义 ============

export type ViewMode = 'welcome' | 'browser' | 'learning' | 'asset' | 'subtitle';

interface AppContextValue {
  // -------- 视图状态 --------
  viewMode: ViewMode;
  isWelcomeExiting: boolean;
  isWelcomeVisible: boolean;     // 用户当前是否能看到欢迎页
  hasNavigated: boolean;         // 是否曾经导航过（有有效 URL）
  leftCollapsed: boolean;
  rightCollapsed: boolean;

  // -------- 导航状态 --------
  inputUrl: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  currentUrl: string;
  pageTitle: string;
  currentVideoTime: number;
  videoDuration: number;

  // -------- 视图操作 --------
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightCollapsed: (collapsed: boolean) => void;
  switchView: (mode: ViewMode) => void;
  closePanel: () => void;

  // -------- 导航操作 --------
  setInputUrl: (url: string) => void;
  navigate: (e: React.FormEvent) => void;
  navigateToUrl: (url: string, seekTo?: number) => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;

  // -------- 视频控制 --------
  pauseVideo: () => void;

  // -------- 内部使用（BrowserView 绑定） --------
  browserRef: React.RefObject<BrowserViewHandle | null>;
  updateNavigationState: (state: NavigationState) => void;
  updateCurrentUrl: (url: string) => void;
  updatePageTitle: (title: string) => void;
  updateVideoTime: (time: number) => void;
  updateVideoDuration: (duration: number) => void;
  pendingSeekRef: React.MutableRefObject<number | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ============ 常量 ============

const WELCOME_EXIT_ANIMATION_MS = 500;

// ============ Provider ============

interface AppProviderProps {
  children: ReactNode;
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };
}

export function AppProvider({ children, ipcRenderer }: AppProviderProps) {
  // -------- Refs --------
  const browserRef = useRef<BrowserViewHandle | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // -------- 视图状态 --------
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [isWelcomeExiting, setIsWelcomeExiting] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  // -------- 导航状态 --------
  const [navState, setNavState] = useState<NavigationState>({
    inputUrl: 'https://www.google.com',
    isLoading: false,
    canGoBack: false,
    canGoForward: false
  });
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('New Tab');
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // -------- 派生状态 --------
  const isWelcomeVisible = viewMode === 'welcome' && !isWelcomeExiting;
  // 判断是否曾经导航过：有有效的 currentUrl
  const hasNavigated = Boolean(currentUrl && currentUrl !== 'about:blank');

  // -------- WCV 可见性管理（统一在这里） --------
  useEffect(() => {
    if (viewMode === 'browser') {
      ipcRenderer.invoke('wcv-show-active');
    } else {
      ipcRenderer.invoke('wcv-hide-all');
    }
  }, [viewMode, ipcRenderer]);

  // -------- 视图操作 --------
  const toggleLeftPanel = useCallback(() => {
    setLeftCollapsed(prev => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightCollapsed(prev => !prev);
  }, []);

  const switchView = useCallback((mode: ViewMode) => {
    // 离开 browser 模式时暂停视频
    if (viewMode === 'browser' && mode !== 'browser') {
      browserRef.current?.executeScript(
        `(function(){ const v = document.querySelector('video'); if(v && !v.paused) v.pause(); })()`
      );
    }
    setViewMode(mode);
  }, [viewMode]);

  const closePanel = useCallback(() => {
    // 有有效 URL 就回到 browser，否则回 welcome
    setViewMode(hasNavigated ? 'browser' : 'welcome');
  }, [hasNavigated]);

  // -------- 导航操作 --------
  const setInputUrl = useCallback((url: string) => {
    browserRef.current?.setInputUrl(url);
  }, []);

  const navigate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    browserRef.current?.navigate(navState.inputUrl);
  }, [navState.inputUrl]);

  const goBack = useCallback(() => {
    browserRef.current?.goBack();
  }, []);

  const goForward = useCallback(() => {
    browserRef.current?.goForward();
  }, []);

  const reload = useCallback(() => {
    browserRef.current?.reload();
  }, []);

  // -------- 视频控制 --------
  const pauseVideo = useCallback(() => {
    browserRef.current?.executeScript(
      `(function(){ const v = document.querySelector('video'); if(v && !v.paused) v.pause(); })()`
    );
  }, []);

  // -------- 核心：统一的导航方法 --------
  const navigateToUrl = useCallback(async (url: string, seekTo?: number) => {
    // 规范化 URL
    let finalUrl = url;
    if (!finalUrl.startsWith('http')) {
      finalUrl = 'https://' + finalUrl;
    }

    // 立即更新 inputUrl，避免显示延迟
    setNavState(prev => ({ ...prev, inputUrl: finalUrl }));

    // 保存 seek 位置
    if (seekTo && seekTo > 0) {
      pendingSeekRef.current = seekTo;
    }

    // 首次导航时展开面板
    if (!hasNavigated) {
      setLeftCollapsed(false);
      setRightCollapsed(false);
    }

    if (viewMode === 'welcome') {
      // 从欢迎页导航：播放退出动画
      setIsWelcomeExiting(true);

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          setViewMode('browser');
          setIsWelcomeExiting(false);
          resolve();
        }, WELCOME_EXIT_ANIMATION_MS);
      });

      browserRef.current?.navigate(finalUrl);
    } else if (viewMode !== 'browser') {
      // 从其他面板导航：切换到 browser
      setViewMode('browser');
      // 等待视图切换完成
      await new Promise<void>(resolve => setTimeout(resolve, 100));
      browserRef.current?.navigate(finalUrl);
    } else {
      // 已在 browser 模式：直接导航
      browserRef.current?.navigate(finalUrl);
    }
  }, [hasNavigated, viewMode]);

  // -------- 状态更新方法（供 BrowserView 调用） --------
  const updateNavigationState = useCallback((state: NavigationState) => {
    setNavState(prev => {
      // 如果当前已有有效 URL，不要被 about:blank 覆盖
      if (state.inputUrl === 'about:blank' && prev.inputUrl && prev.inputUrl !== 'about:blank') {
        return { ...state, inputUrl: prev.inputUrl };
      }
      return state;
    });
  }, []);

  const updateCurrentUrl = useCallback((url: string) => {
    setCurrentUrl(url);
  }, []);

  const updatePageTitle = useCallback((title: string) => {
    setPageTitle(title);
  }, []);

  const updateVideoTime = useCallback((time: number) => {
    setCurrentVideoTime(time);
  }, []);

  const updateVideoDuration = useCallback((duration: number) => {
    setVideoDuration(duration);
  }, []);

  // -------- Context Value --------
  const value: AppContextValue = {
    // 视图状态
    viewMode,
    isWelcomeExiting,
    isWelcomeVisible,
    hasNavigated,
    leftCollapsed,
    rightCollapsed,

    // 导航状态
    inputUrl: navState.inputUrl,
    isLoading: navState.isLoading,
    canGoBack: navState.canGoBack,
    canGoForward: navState.canGoForward,
    currentUrl,
    pageTitle,
    currentVideoTime,
    videoDuration,

    // 视图操作
    toggleLeftPanel,
    toggleRightPanel,
    setRightCollapsed,
    switchView,
    closePanel,

    // 导航操作
    setInputUrl,
    navigate,
    navigateToUrl,
    goBack,
    goForward,
    reload,

    // 视频控制
    pauseVideo,

    // 内部使用
    browserRef,
    updateNavigationState,
    updateCurrentUrl,
    updatePageTitle,
    updateVideoTime,
    updateVideoDuration,
    pendingSeekRef,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// ============ Hook ============

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
