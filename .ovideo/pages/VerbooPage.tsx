// .ovideo/pages/VerbooPage.tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import {
  PanelLeft,
  PanelRight,
  Settings,
  Package,
  Subtitles,
  Download,
  Camera,
  Star,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  FileText,
  Image,
  Play,
  Clock,
  Trash2,
  ArrowRight as ArrowRightIcon,
  X,
  Video,
  ChevronDown,
  Search,
  Globe,
  ArrowDownUp,
} from "lucide-react";
import { VerbooLogo } from "./VerbooIcons";
import { VERBOO_LAYOUT, VERBOO_COLORS, VERBOO_FONTS } from "./VerbooLayout";
import {
  MOCK_SUBTITLES,
  MOCK_ASSETS,
  MOCK_ALL_ASSETS,
  MOCK_CURRENT_VIDEO,
  MOCK_SUBTITLE_RECORDS,
} from "../mock/data";

export type VerbooView = "browser" | "welcome" | "asset" | "subtitle";

export interface VerbooPageProps {
  view?: VerbooView;
  highlightRegion?: string;
  showToast?: boolean;
  toastMessage?: string;
}

// ─── Helper: Format Time ──────────────────────────
function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ─── Sub-components ───────────────────────────────

const TitleBar: React.FC = () => {
  const colors = VERBOO_COLORS;
  const layout = VERBOO_LAYOUT;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: layout.canvas.width,
        height: layout.titleBar.height,
      }}
      className="flex items-center justify-between px-4"
    >
      {/* Left: macOS traffic lights + sidebar toggle */}
      <div className="flex items-center" style={{ marginLeft: 70 }}>
        {/* macOS traffic lights placeholder */}
        <div className="flex items-center gap-2 mr-4" style={{ position: "absolute", left: 16, top: 18 }}>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#febc2e" }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#28c840" }} />
        </div>
        <div
          className="p-1.5 rounded-md"
          style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
        >
          <PanelLeft size={16} style={{ color: "#6b7280" }} />
        </div>
      </div>

      {/* Right: panel toggle + settings */}
      <div className="flex items-center gap-1">
        <div
          className="p-1.5 rounded-md"
          style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
        >
          <PanelRight size={16} style={{ color: "#6b7280" }} />
        </div>
        <div
          className="p-1.5 rounded-md"
          style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
        >
          <Settings size={16} style={{ color: "#6b7280" }} />
        </div>
      </div>
    </div>
  );
};

const SidebarPanel: React.FC<{ view: VerbooView }> = ({ view }) => {
  const layout = VERBOO_LAYOUT;
  const colors = VERBOO_COLORS;
  const showVideoControls = view === "browser";

  return (
    <div
      style={{
        position: "absolute",
        top: layout.sidebar.y,
        left: layout.sidebar.x,
        width: layout.sidebar.width,
        height: layout.sidebar.height,
        borderRadius: layout.cornerRadius,
        backgroundColor: colors.card,
      }}
      className="flex flex-col pt-4 pb-2"
    >
      {/* Logo */}
      <div className="flex items-center mb-5 px-4">
        <VerbooLogo />
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-1 px-2">
        {/* Assets */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: view === "asset" ? colors.tabActiveBg : "transparent",
          }}
        >
          <Package
            size={14}
            style={{ color: view === "asset" ? colors.tabActiveText : "#9ca3af" }}
          />
          <span
            className="text-[13px] font-medium"
            style={{
              color: view === "asset" ? colors.tabActiveText : "#6b7280",
            }}
          >
            Assets
          </span>
        </div>

        {/* Subtitles */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: view === "subtitle" ? colors.tabActiveBg : "transparent",
          }}
        >
          <Subtitles
            size={14}
            style={{ color: view === "subtitle" ? colors.tabActiveText : "#9ca3af" }}
          />
          <span
            className="text-[13px] font-medium"
            style={{
              color: view === "subtitle" ? colors.tabActiveText : "#6b7280",
            }}
          >
            Subtitles
          </span>
        </div>
      </div>

      {/* Video controls (only in browser mode) */}
      {showVideoControls && (
        <>
          {/* Divider */}
          <div
            className="mx-5 my-2"
            style={{ height: 1, backgroundColor: colors.borderLight }}
          />

          {/* Get Subtitles */}
          <div className="px-2 flex flex-col gap-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
              <Download size={14} style={{ color: "#6b7280" }} />
              <span
                className="text-[13px] font-medium"
                style={{ color: colors.text }}
              >
                Get Subtitles
              </span>
            </div>

            {/* Screenshot */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Camera size={14} style={{ color: "#6b7280" }} />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: colors.text }}
                >
                  Screenshot
                </span>
              </div>
              <span
                className="text-[10px] font-mono"
                style={{ color: colors.textMuted }}
              >
                ⌘S
              </span>
            </div>

            {/* Important */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Star size={14} style={{ color: colors.warning }} />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: colors.text }}
                >
                  Important
                </span>
              </div>
              <span
                className="text-[10px] font-mono"
                style={{ color: colors.textMuted }}
              >
                ⌘I
              </span>
            </div>

            {/* Difficult */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: colors.danger }} />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: colors.text }}
                >
                  Difficult
                </span>
              </div>
              <span
                className="text-[10px] font-mono"
                style={{ color: colors.textMuted }}
              >
                ⌘D
              </span>
            </div>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Navigation Toolbar (bottom) */}
      {view !== "welcome" && (
        <div className="px-2 pb-0">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              backgroundColor: "rgba(255,255,255,0.9)",
              border: "1px solid #e5e7eb",
            }}
          >
            <div className="flex items-center gap-1">
              <div className="p-1.5 rounded-full">
                <ArrowLeft size={16} style={{ color: "#9ca3af" }} />
              </div>
              <div className="p-1.5 rounded-full">
                <ArrowRight size={16} style={{ color: "#4b5563" }} />
              </div>
              <div className="p-1.5 rounded-full">
                <RotateCw size={16} style={{ color: "#4b5563" }} />
              </div>
            </div>
            <div
              className="flex-1 pl-3 ml-1"
              style={{ borderLeft: "1px solid #e5e7eb" }}
            >
              <span
                className="text-sm font-medium"
                style={{ color: "#9ca3af" }}
              >
                youtube.com/watch?v=3LP...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BrowserContent: React.FC = () => {
  const layout = VERBOO_LAYOUT;
  const colors = VERBOO_COLORS;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.browser.y,
        left: layout.browser.x,
        width: layout.browser.width,
        height: layout.browser.height,
        borderRadius: layout.cornerRadius,
        backgroundColor: colors.card,
        backgroundSize: "24px 24px",
        backgroundImage: `radial-gradient(circle, ${colors.dotGrid} 1px, transparent 1px)`,
        overflow: "hidden",
      }}
    >
      {/* Simulated YouTube video player area */}
      <div
        className="flex flex-col items-center justify-center"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0f0f0f",
        }}
      >
        {/* Video area (dark background with play icon) */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: "100%",
            height: "70%",
            backgroundColor: "#000",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 72,
              height: 72,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          >
            <Play size={32} fill="white" style={{ color: "white", marginLeft: 4 }} />
          </div>

          {/* Video progress bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                width: "18%",
                height: "100%",
                backgroundColor: "#ff0000",
                borderRadius: 2,
              }}
            />
          </div>
        </div>

        {/* Video title area */}
        <div className="w-full px-6 py-4" style={{ backgroundColor: "#0f0f0f" }}>
          <div className="text-base font-semibold text-white mb-1">
            CS50 2024 - Lecture 0 - Scratch
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: "#333" }}
            />
            <div>
              <div className="text-sm font-medium text-white">CS50</div>
              <div className="text-xs" style={{ color: "#aaa" }}>
                3.2M subscribers
              </div>
            </div>
            <div
              className="ml-4 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: "#fff", color: "#0f0f0f" }}
            >
              Subscribe
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResizerHandle: React.FC = () => {
  const layout = VERBOO_LAYOUT;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.resizer.y,
        left: layout.resizer.x,
        width: layout.resizer.width,
        height: layout.resizer.height,
      }}
      className="flex items-center justify-center"
    >
      <div
        className="rounded-full"
        style={{
          width: 4,
          height: 32,
          backgroundColor: "#d1d5db",
        }}
      />
    </div>
  );
};

const InfoPanelContent: React.FC = () => {
  const layout = VERBOO_LAYOUT;
  const colors = VERBOO_COLORS;
  const currentTime = MOCK_CURRENT_VIDEO.currentTime;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.infoPanel.y,
        left: layout.infoPanel.x,
        width: layout.infoPanel.width,
        height: layout.infoPanel.height,
        borderRadius: layout.cornerRadius,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
      className="flex flex-col"
    >
      {/* Tabs */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid #f3f4f6" }}
      >
        <div className="flex items-center gap-1">
          {/* Subtitle Tab (active) */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
            style={{ backgroundColor: colors.tabActiveBg }}
          >
            <FileText size={14} style={{ color: colors.tabActiveText }} />
            <span
              className="text-[13px] font-medium"
              style={{ color: colors.tabActiveText }}
            >
              Subtitle
            </span>
          </div>

          {/* Asset Tab */}
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md">
            <Image size={14} style={{ color: colors.tabInactiveText }} />
            <span
              className="text-[13px] font-medium"
              style={{ color: colors.tabInactiveText }}
            >
              Assets
            </span>
            {/* Badge */}
            <span
              className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
              style={{
                backgroundColor: colors.badgeBg,
                color: colors.badgeText,
              }}
            >
              {MOCK_ASSETS.length}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            placeholder="Search subtitles..."
            className="flex-1 h-8 px-3 text-[13px] rounded-lg"
            style={{
              backgroundColor: colors.tabActiveBg,
              color: colors.textMuted,
              border: "none",
              outline: "none",
            }}
          />
          <div
            className="h-8 px-2.5 flex items-center rounded-md text-[12px] font-medium"
            style={{
              backgroundColor: colors.tabActiveBg,
              color: colors.tabActiveText,
            }}
          >
            Auto
          </div>
        </div>
      </div>

      {/* Subtitle List */}
      <div className="flex-1 overflow-hidden">
        {MOCK_SUBTITLES.map((sub, index) => {
          const isCurrent =
            sub.start <= currentTime &&
            (index === MOCK_SUBTITLES.length - 1 ||
              currentTime < MOCK_SUBTITLES[index + 1].start);

          // Check for marks
          const isMarked =
            index === 0 ? "important" : index === 3 ? "difficult" : null;

          return (
            <div
              key={index}
              className="px-4 py-2.5"
              style={{
                backgroundColor: isMarked === "important"
                  ? colors.markImportantBg
                  : isMarked === "difficult"
                  ? colors.markDifficultBg
                  : isCurrent
                  ? "#fafafa"
                  : "transparent",
                borderLeft: isMarked === "important"
                  ? `2px solid ${colors.markImportantBorder}`
                  : isMarked === "difficult"
                  ? `2px solid ${colors.markDifficultBorder}`
                  : "2px solid transparent",
              }}
            >
              <div className="flex gap-3 items-start">
                {/* Mark icon */}
                {isMarked && (
                  <div className="pt-0.5">
                    {isMarked === "important" ? (
                      <Star
                        size={12}
                        fill={colors.warning}
                        style={{ color: colors.warning }}
                      />
                    ) : (
                      <AlertTriangle
                        size={12}
                        style={{ color: colors.danger }}
                      />
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className="text-[11px] font-mono min-w-[42px] pt-0.5"
                  style={{
                    color: isCurrent
                      ? colors.tabActiveText
                      : colors.textMuted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatTime(sub.start)}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1">
                  <div
                    className="text-[13px]"
                    style={{
                      lineHeight: 1.6,
                      color: isCurrent
                        ? colors.tabActiveText
                        : colors.textSecondary,
                    }}
                  >
                    {sub.text}
                  </div>
                  {sub.translation && (
                    <div
                      className="text-[12px]"
                      style={{
                        lineHeight: 1.5,
                        color: isCurrent
                          ? colors.textLabel
                          : colors.textMuted,
                      }}
                    >
                      {sub.translation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Welcome View ─────────────────────────────────
const WelcomeView: React.FC = () => {
  const layout = VERBOO_LAYOUT;
  const colors = VERBOO_COLORS;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.sidebar.y,
        left: layout.sidebar.x + layout.sidebar.width + layout.gap,
        width:
          layout.canvas.width -
          layout.padding * 2 -
          layout.sidebar.width -
          layout.gap,
        height: layout.sidebar.height,
        borderRadius: layout.cornerRadius,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
      className="flex flex-col items-center justify-center"
    >
      {/* Search Input */}
      <div style={{ width: 420 }}>
        <div
          className="relative flex items-center rounded-full overflow-hidden"
          style={{ backgroundColor: "#f4f4f5" }}
        >
          <div
            className="w-full py-4 px-5 pr-14 text-[15px] font-medium"
            style={{ color: "#a1a1aa" }}
          >
            Enter URL or search...
          </div>
          <div
            className="absolute right-2 p-2.5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#d4d4d8" }}
          >
            <ArrowRightIcon size={16} strokeWidth={2.5} style={{ color: "#a1a1aa" }} />
          </div>
        </div>
      </div>

      {/* Quick Links - Bottom Right */}
      <div
        style={{ position: "absolute", bottom: 24, right: 24 }}
        className="flex gap-2"
      >
        {[
          { name: "YouTube", color: "#ff0000" },
          { name: "Bilibili", color: "#fb7299" },
        ].map((link) => (
          <div
            key={link.name}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium"
            style={{
              backgroundColor: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(228,228,231,0.6)",
              color: "#52525b",
            }}
          >
            <div
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: link.color }}
            />
            {link.name}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Asset Library View ───────────────────────────
const AssetLibraryView: React.FC = () => {
  const layout = VERBOO_LAYOUT;
  const colors = VERBOO_COLORS;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.mainFull.y,
        left: layout.mainFull.x,
        width: layout.mainFull.width,
        height: layout.mainFull.height,
        borderRadius: layout.cornerRadius,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
      className="flex flex-col"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid #f4f4f5` }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "#3f3f46" }}
        >
          Assets
        </span>
        <div className="p-1.5 rounded-lg">
          <X size={18} style={{ color: "#a1a1aa" }} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-8 py-3 flex items-center gap-3">
        {/* Platform filter */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ color: "#71717a" }}
        >
          <Globe size={13} />
          <span>Platform</span>
          <ChevronDown size={10} className="opacity-50" />
        </div>
        {/* Sort */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ color: "#71717a" }}
        >
          <ArrowDownUp size={13} />
          <span>Sort</span>
          <ChevronDown size={10} className="opacity-50" />
        </div>
        {/* Marks */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ color: "#71717a" }}
        >
          <Star size={13} />
          <span>Marks</span>
          <ChevronDown size={10} className="opacity-50" />
        </div>

        <div className="flex-1" />

        {/* Search box */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: "rgba(244,244,245,0.8)", width: 200 }}
        >
          <Search size={12} style={{ color: "#a1a1aa" }} />
          <span className="text-[12px]" style={{ color: "#a1a1aa" }}>
            Search...
          </span>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="flex-1 px-8 pb-4 overflow-hidden">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          {MOCK_ALL_ASSETS.map((asset) => (
            <div
              key={asset.id}
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid #f4f4f5" }}
            >
              {/* Thumbnail */}
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: "16/9",
                  backgroundColor: "#f4f4f5",
                }}
              >
                {/* Timestamp badge */}
                {asset.timestamp > 0 && (
                  <div
                    className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.75)",
                      color: "#fff",
                    }}
                  >
                    <Play size={10} fill="white" />
                    {formatTime(asset.timestamp)}
                  </div>
                )}
                {/* Mark indicator */}
                {asset.markType && (
                  <div className="absolute top-2 right-2">
                    {asset.markType === "important" ? (
                      <Star
                        size={14}
                        fill={colors.warning}
                        style={{ color: colors.warning }}
                      />
                    ) : (
                      <AlertTriangle
                        size={14}
                        style={{ color: colors.danger }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Card content */}
              <div className="p-3">
                <div
                  className="text-[13px] font-medium mb-2"
                  style={{
                    color: colors.tabActiveText,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {asset.title}
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: colors.textLabel }}
                >
                  {asset.author?.name}
                </div>
                <div
                  className="flex items-center justify-between mt-2 text-[11px]"
                  style={{ color: colors.textMuted }}
                >
                  <span>{asset.platform}</span>
                  <span>
                    {new Date(asset.createdAt).toLocaleDateString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Subtitle Library View ────────────────────────
const SubtitleLibraryView: React.FC = () => {
  const layout = VERBOO_LAYOUT;
  const colors = VERBOO_COLORS;
  const record = MOCK_SUBTITLE_RECORDS[0];
  const subtitles = record.subtitleData;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.mainFull.y,
        left: layout.mainFull.x,
        width: layout.mainFull.width,
        height: layout.mainFull.height,
        borderRadius: layout.cornerRadius,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
      className="flex flex-col"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid #f4f4f5` }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "#3f3f46" }}
        >
          Subtitle Library
        </span>
        <div className="p-1.5 rounded-lg">
          <X size={18} style={{ color: "#a1a1aa" }} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-8 py-3 flex items-center gap-3">
        {/* Video Selector */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}
        >
          <Video size={13} />
          <span>{record.videoTitle.slice(0, 20)}...</span>
          <ChevronDown size={10} className="opacity-50" />
        </div>

        {/* Divider */}
        <div
          className="mx-1"
          style={{
            width: 1,
            height: 20,
            backgroundColor: "#f4f4f5",
          }}
        />

        {/* Export */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ color: "#71717a" }}
        >
          <Download size={13} />
          <span>Download</span>
          <ChevronDown size={10} className="opacity-50" />
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: "rgba(244,244,245,0.8)", width: 200 }}
        >
          <Search size={12} style={{ color: "#a1a1aa" }} />
          <span className="text-[12px]" style={{ color: "#a1a1aa" }}>
            Search subtitles...
          </span>
        </div>

        {/* Count */}
        <span className="text-[12px]" style={{ color: "#a1a1aa" }}>
          {subtitles.length} items
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        {/* Table Header */}
        <div
          className="flex items-center h-8 px-6"
          style={{
            backgroundColor: "rgba(250,250,250,0.95)",
            borderBottom: "1px solid rgba(228,228,231,0.6)",
          }}
        >
          <div
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "#71717a", width: 50 }}
          >
            #
          </div>
          <div
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "#71717a", width: 70 }}
          >
            Time
          </div>
          <div
            className="text-[11px] font-medium uppercase tracking-wider flex-1"
            style={{ color: "#71717a" }}
          >
            Content
          </div>
          <div
            className="text-[11px] font-medium uppercase tracking-wider text-right"
            style={{ color: "#71717a", width: 60 }}
          >
            Duration
          </div>
        </div>

        {/* Table Rows */}
        {subtitles.map((sub, index) => (
          <div
            key={index}
            className="flex items-center h-10 px-6"
            style={{ borderBottom: "1px solid #f4f4f5" }}
          >
            <div
              className="text-[11px]"
              style={{
                color: "#a1a1aa",
                width: 50,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {index + 1}
            </div>
            <div
              className="text-[12px] font-mono"
              style={{
                color: "#71717a",
                width: 70,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(sub.start)}
            </div>
            <div className="flex-1 min-w-0 truncate">
              <span className="text-[13px]" style={{ color: "#3f3f46" }}>
                {sub.text}
              </span>
              {sub.translation && (
                <span
                  className="text-[12px] ml-2"
                  style={{ color: "#a1a1aa" }}
                >
                  {sub.translation}
                </span>
              )}
            </div>
            <div
              className="text-[11px] text-right"
              style={{
                color: "#a1a1aa",
                width: 60,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {sub.duration ? `${sub.duration.toFixed(1)}s` : "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Toast Overlay ────────────────────────────────
const ToastOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      position: "absolute",
      top: 10,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 100,
    }}
  >
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-full"
      style={{
        backgroundColor: VERBOO_COLORS.toastBg,
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
      }}
    >
      <Camera size={16} style={{ color: "#fff" }} />
      <span className="text-[13px] font-medium" style={{ color: "#fff" }}>
        {message}
      </span>
    </div>
  </div>
);

// ─── Main Page Component ──────────────────────────
export const VerbooPage: React.FC<VerbooPageProps> = ({
  view = "browser",
  highlightRegion,
  showToast = false,
  toastMessage = "Saved to screenshot library",
}) => {
  const colors = VERBOO_COLORS;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        fontFamily: VERBOO_FONTS.family,
      }}
    >
      {/* Title Bar */}
      <TitleBar />

      {/* Sidebar — always present */}
      <SidebarPanel view={view} />

      {/* View-specific content */}
      {view === "welcome" && <WelcomeView />}

      {view === "browser" && (
        <>
          <BrowserContent />
          <ResizerHandle />
          <InfoPanelContent />
        </>
      )}

      {view === "asset" && <AssetLibraryView />}

      {view === "subtitle" && <SubtitleLibraryView />}

      {/* Toast overlay */}
      {showToast && <ToastOverlay message={toastMessage} />}
    </AbsoluteFill>
  );
};
