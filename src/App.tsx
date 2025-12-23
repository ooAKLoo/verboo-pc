import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { BrowserView } from './components/BrowserView';
import type { BrowserViewHandle } from './components/BrowserView';
import { InfoPanel } from './components/InfoPanel';
import { TabBar, type Tab } from './components/TabBar';
import { PanelLeft, PanelRight } from 'lucide-react';

function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Tab management
  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'tab-1',
    url: 'https://www.google.com',
    title: 'New Tab'
  }]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Per-tab data
  const [tabData, setTabData] = useState<{ [tabId: string]: any }>({});
  const [tabVideoTime, setTabVideoTime] = useState<{ [tabId: string]: number }>({});
  const [materialRefreshTrigger, setMaterialRefreshTrigger] = useState(0);

  const browserRef = React.useRef<BrowserViewHandle>(null);
  const { ipcRenderer } = window.require('electron');

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
    if (tabs.length === 1) return; // Keep at least one tab

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // Clean up tab data
    const newTabData = { ...tabData };
    const newTabVideoTime = { ...tabVideoTime };
    delete newTabData[tabId];
    delete newTabVideoTime[tabId];
    setTabData(newTabData);
    setTabVideoTime(newTabVideoTime);

    // Switch to another tab if closing active tab
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


  const handleRunPlugin = async (script: string) => {
    if (browserRef.current) {
      try {
        const result = await browserRef.current.executeScript(script);
        setTabData({
          ...tabData,
          [activeTabId]: result
        });
        if (rightCollapsed) setRightCollapsed(false); // Auto-open info panel
      } catch (error) {
        console.error("Plugin execution failed:", error);
        setTabData({
          ...tabData,
          [activeTabId]: { error: String(error) }
        });
      }
    }
  };

  const handleGetYouTubeSubtitles = async () => {
    if (!browserRef.current) return;

    try {
      // Get current URL from webview
      const url = browserRef.current.getCurrentUrl();

      if (!url.includes('youtube.com/watch')) {
        alert('请先打开 YouTube 视频页面');
        return;
      }

      console.log('Calling IPC to get subtitles for:', url);

      // Call Electron main process via IPC
      const response = await ipcRenderer.invoke('get-youtube-subtitles', url);

      if (response.success) {
        console.log('Got subtitles:', response.data.length);
        setTabData({
          ...tabData,
          [activeTabId]: response.data
        });
        if (rightCollapsed) setRightCollapsed(false);
        alert(`字幕提取成功!共 ${response.data.length} 条`);
      } else {
        console.error('Failed to get subtitles:', response.error);
        alert('提取失败: ' + response.error);
      }
    } catch (error) {
      console.error('IPC call failed:', error);
      alert('提取失败: ' + String(error));
    }
  };

  return (
    <div className="w-full h-full font-sans antialiased text-primary bg-background selection:bg-accent/20">
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
        left={<Sidebar onRunPlugin={handleRunPlugin} onGetYouTubeSubtitles={handleGetYouTubeSubtitles} />}
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
                  onData={(data, tabId) => {
                    if (data && data.type === 'video-time') {
                      // Update current video time for this tab
                      setTabVideoTime({
                        ...tabVideoTime,
                        [tabId]: data.data.currentTime
                      });
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
                      // For full transcript, replace the entire state for this tab
                      setTabData({
                        ...tabData,
                        [tabId]: data.data
                      });
                      if (rightCollapsed) setRightCollapsed(false);
                    }
                    else if (data && data.type === 'material-saved') {
                      // Trigger material panel refresh
                      setMaterialRefreshTrigger(prev => prev + 1);
                      if (rightCollapsed) setRightCollapsed(false);
                    }
                    else {
                      setTabData({
                        ...tabData,
                        [tabId]: data
                      });
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
          />
        }
      />
    </div>
  );
}

export default App;
