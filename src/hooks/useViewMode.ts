import { useState, useCallback, useEffect } from 'react';

// 视图模式枚举
export type ViewMode = 'welcome' | 'browser' | 'learning' | 'asset' | 'subtitle';

// 动画时长常量
const WELCOME_EXIT_ANIMATION_MS = 500;

interface UseViewModeOptions {
  onWcvShow?: () => Promise<void>;
  onWcvHide?: () => Promise<void>;
}

interface UseViewModeReturn {
  // 当前视图模式
  viewMode: ViewMode;
  // 欢迎页是否正在退出动画
  isWelcomeExiting: boolean;
  // 是否处于欢迎页模式（未导航过）
  isInWelcomeMode: boolean;
  // 用户当前是否能看到欢迎页
  isWelcomeVisible: boolean;
  // 左侧面板折叠状态
  leftCollapsed: boolean;
  // 右侧面板折叠状态
  rightCollapsed: boolean;
  // 切换左侧面板
  toggleLeftPanel: () => void;
  // 切换右侧面板
  toggleRightPanel: () => void;
  // 设置右侧面板折叠状态
  setRightCollapsed: (collapsed: boolean) => void;
  // 切换到指定视图
  switchView: (mode: ViewMode) => void;
  // 从欢迎页导航到浏览器（带动画）
  exitWelcomeAndNavigate: () => Promise<void>;
  // 关闭当前面板，返回浏览器视图
  closePanel: () => void;
}

export function useViewMode(options: UseViewModeOptions = {}): UseViewModeReturn {
  const { onWcvShow, onWcvHide } = options;

  // 核心状态
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [isWelcomeExiting, setIsWelcomeExiting] = useState(false);
  const [isInWelcomeMode, setIsInWelcomeMode] = useState(true); // 是否从未导航过

  // 面板折叠状态
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  // 派生状态：用户当前是否能看到欢迎页
  const isWelcomeVisible = viewMode === 'welcome' && !isWelcomeExiting;

  // 集中管理 WCV 可见性
  useEffect(() => {
    if (viewMode === 'browser') {
      onWcvShow?.();
    } else {
      onWcvHide?.();
    }
  }, [viewMode, onWcvShow, onWcvHide]);

  // 切换左侧面板
  const toggleLeftPanel = useCallback(() => {
    setLeftCollapsed(prev => !prev);
  }, []);

  // 切换右侧面板
  const toggleRightPanel = useCallback(() => {
    setRightCollapsed(prev => !prev);
  }, []);

  // 切换视图模式
  const switchView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // 从欢迎页退出并导航到浏览器（带动画）
  const exitWelcomeAndNavigate = useCallback(async () => {
    if (!isInWelcomeMode) {
      // 已经离开过欢迎页，直接切换
      setViewMode('browser');
      return;
    }

    // 首次离开欢迎页，播放退出动画
    setIsWelcomeExiting(true);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setViewMode('browser');
        setIsWelcomeExiting(false);
        setIsInWelcomeMode(false);
        setLeftCollapsed(false);
        setRightCollapsed(false);
        resolve();
      }, WELCOME_EXIT_ANIMATION_MS);
    });
  }, [isInWelcomeMode]);

  // 关闭当前面板，返回浏览器视图
  const closePanel = useCallback(() => {
    if (isInWelcomeMode) {
      // 如果从未导航过，返回欢迎页
      setViewMode('welcome');
    } else {
      // 否则返回浏览器
      setViewMode('browser');
    }
  }, [isInWelcomeMode]);

  return {
    viewMode,
    isWelcomeExiting,
    isInWelcomeMode,
    isWelcomeVisible,
    leftCollapsed,
    rightCollapsed,
    toggleLeftPanel,
    toggleRightPanel,
    setRightCollapsed,
    switchView,
    exitWelcomeAndNavigate,
    closePanel,
  };
}
