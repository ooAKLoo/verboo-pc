import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { BrowserViewHandle, NavigationState } from '../components/BrowserView';

interface NavigationContextValue {
  // 导航状态
  inputUrl: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  currentUrl: string;
  pageTitle: string;

  // 视频相关
  currentVideoTime: number;
  videoDuration: number;

  // 导航方法
  setInputUrl: (url: string) => void;
  navigate: (e: React.FormEvent) => void;
  navigateToUrl: (url: string, seekTo?: number) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;

  // 内部使用
  browserRef: React.RefObject<BrowserViewHandle | null>;
  updateNavigationState: (state: NavigationState) => void;
  updateCurrentUrl: (url: string) => void;
  updatePageTitle: (title: string) => void;
  updateVideoTime: (time: number) => void;
  updateVideoDuration: (duration: number) => void;
  pendingSeekRef: React.MutableRefObject<number | null>;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
  children: ReactNode;
  onNavigateToUrl?: (url: string, seekTo?: number) => Promise<void>;
}

export function NavigationProvider({ children, onNavigateToUrl }: NavigationProviderProps) {
  const browserRef = useRef<BrowserViewHandle | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // 导航状态
  const [navState, setNavState] = useState<NavigationState>({
    inputUrl: 'https://www.google.com',
    isLoading: false,
    canGoBack: false,
    canGoForward: false
  });

  // 页面信息
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('New Tab');

  // 视频信息
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // 设置输入 URL
  const setInputUrl = useCallback((url: string) => {
    browserRef.current?.setInputUrl(url);
  }, []);

  // 表单提交导航
  const navigate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    browserRef.current?.navigate(navState.inputUrl);
  }, [navState.inputUrl]);

  // 导航到指定 URL
  const navigateToUrl = useCallback(async (url: string, seekTo?: number) => {
    if (seekTo && seekTo > 0) {
      pendingSeekRef.current = seekTo;
    }

    if (onNavigateToUrl) {
      await onNavigateToUrl(url, seekTo);
    } else {
      browserRef.current?.navigate(url);
    }
  }, [onNavigateToUrl]);

  // 导航控制
  const goBack = useCallback(() => {
    browserRef.current?.goBack();
  }, []);

  const goForward = useCallback(() => {
    browserRef.current?.goForward();
  }, []);

  const reload = useCallback(() => {
    browserRef.current?.reload();
  }, []);

  // 状态更新方法
  const updateNavigationState = useCallback((state: NavigationState) => {
    setNavState(state);
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

  const value: NavigationContextValue = {
    inputUrl: navState.inputUrl,
    isLoading: navState.isLoading,
    canGoBack: navState.canGoBack,
    canGoForward: navState.canGoForward,
    currentUrl,
    pageTitle,
    currentVideoTime,
    videoDuration,
    setInputUrl,
    navigate,
    navigateToUrl,
    goBack,
    goForward,
    reload,
    browserRef,
    updateNavigationState,
    updateCurrentUrl,
    updatePageTitle,
    updateVideoTime,
    updateVideoDuration,
    pendingSeekRef,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
