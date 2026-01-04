import React, { createContext, useContext, type ReactNode } from 'react';
import { useViewMode, type ViewMode } from '../hooks/useViewMode';

interface ViewContextValue {
  // 视图状态
  viewMode: ViewMode;
  isWelcomeExiting: boolean;
  isInWelcomeMode: boolean;
  isWelcomeVisible: boolean;

  // 面板折叠状态
  leftCollapsed: boolean;
  rightCollapsed: boolean;

  // 操作方法
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightCollapsed: (collapsed: boolean) => void;
  switchView: (mode: ViewMode) => void;
  exitWelcomeAndNavigate: () => Promise<void>;
  closePanel: () => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

interface ViewProviderProps {
  children: ReactNode;
  onWcvShow?: () => Promise<void>;
  onWcvHide?: () => Promise<void>;
}

export function ViewProvider({ children, onWcvShow, onWcvHide }: ViewProviderProps) {
  const viewMode = useViewMode({
    onWcvShow,
    onWcvHide,
  });

  return (
    <ViewContext.Provider value={viewMode}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
}

// 重新导出类型
export type { ViewMode };
