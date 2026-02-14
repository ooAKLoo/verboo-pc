// .ovideo/pages/VerbooLayout.ts
// Verboo - Video Learning Assistant layout constants
// Frozen from responsive Electron app at ~1920×1080 viewport

// ─── Canvas ───────────────────────────────────────
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

// ─── Spacing ──────────────────────────────────────
const TITLE_BAR_HEIGHT = 52;
const OUTER_PADDING = 12;
const SIDEBAR_WIDTH = 256; // w-64
const GAP = 12; // mr-3 = 0.75rem = 12px
const RIGHT_PANEL_WIDTH = 320;
const RESIZER_WIDTH = 12;

// ─── Computed ─────────────────────────────────────
const CONTENT_TOP = TITLE_BAR_HEIGHT;
const CONTENT_HEIGHT = CANVAS_HEIGHT - TITLE_BAR_HEIGHT - OUTER_PADDING;
const MAIN_LEFT = OUTER_PADDING + SIDEBAR_WIDTH + GAP;
const MAIN_WIDTH_BROWSER =
  CANVAS_WIDTH -
  OUTER_PADDING * 2 -
  SIDEBAR_WIDTH -
  GAP -
  RESIZER_WIDTH -
  RIGHT_PANEL_WIDTH;
const MAIN_WIDTH_FULL =
  CANVAS_WIDTH - OUTER_PADDING * 2 - SIDEBAR_WIDTH - GAP;
const RIGHT_PANEL_LEFT =
  CANVAS_WIDTH - OUTER_PADDING - RIGHT_PANEL_WIDTH;

// ─── Master Layout ────────────────────────────────
export const VERBOO_LAYOUT = {
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  titleBar: { height: TITLE_BAR_HEIGHT },
  padding: OUTER_PADDING,
  gap: GAP,
  cornerRadius: 16,

  sidebar: {
    x: OUTER_PADDING,
    y: CONTENT_TOP,
    width: SIDEBAR_WIDTH,
    height: CONTENT_HEIGHT,
  },

  // Browser mode: 3-column layout
  browser: {
    x: MAIN_LEFT,
    y: CONTENT_TOP,
    width: MAIN_WIDTH_BROWSER,
    height: CONTENT_HEIGHT,
  },

  resizer: {
    x: MAIN_LEFT + MAIN_WIDTH_BROWSER,
    y: CONTENT_TOP,
    width: RESIZER_WIDTH,
    height: CONTENT_HEIGHT,
  },

  infoPanel: {
    x: RIGHT_PANEL_LEFT,
    y: CONTENT_TOP,
    width: RIGHT_PANEL_WIDTH,
    height: CONTENT_HEIGHT,
  },

  // Full-width panel mode (assets / subtitles / learning)
  mainFull: {
    x: MAIN_LEFT,
    y: CONTENT_TOP,
    width: MAIN_WIDTH_FULL,
    height: CONTENT_HEIGHT,
  },

  // Welcome page search area (centered)
  welcome: {
    searchArea: {
      x: 560,
      y: 440,
      width: 800,
      height: 200,
    },
    quickLinks: {
      x: 1680,
      y: 1032,
      width: 220,
      height: 36,
    },
  },
};

// ─── Colors ───────────────────────────────────────
export const VERBOO_COLORS = {
  // Backgrounds
  background: "#f5f5f5",
  card: "#ffffff",
  cardHover: "#f0f0f0",
  cardActive: "#e5e5e5",

  // Text
  text: "#1a1a1a",
  textSecondary: "#525252",
  textMuted: "#a1a1aa",
  textLabel: "#71717a",

  // Accent & Brand
  accent: "#5E6AD2",
  accentDark: "#18181b",

  // Borders
  border: "rgba(0, 0, 0, 0.08)",
  borderLight: "#e4e4e7",
  borderHover: "rgba(0, 0, 0, 0.12)",

  // Tabs
  tabActiveBg: "#f4f4f5",
  tabActiveText: "#18181b",
  tabInactiveText: "#71717a",

  // Semantic
  danger: "#dc2626",
  warning: "#f59e0b",
  success: "#16a34a",
  info: "#3b82f6",

  // Special
  bilibiliPink: "#fb7299",
  dotGrid: "#d0d0d0",
  toastBg: "#18181b",
  badgeBg: "#e4e4e7",
  badgeText: "#52525b",
  overlay: "rgba(0, 0, 0, 0.30)",

  // Marks
  markImportantBg: "rgba(251, 191, 36, 0.1)",
  markImportantBorder: "#f59e0b",
  markDifficultBg: "rgba(239, 68, 68, 0.1)",
  markDifficultBorder: "#ef4444",
};

// ─── Typography ───────────────────────────────────
export const VERBOO_FONTS = {
  family: "'Inter', system-ui, Avenir, Helvetica, Arial, sans-serif",
  sizes: {
    xl: { size: 20, lineHeight: 28, weight: 600 },
    lg: { size: 16, lineHeight: 24, weight: 600 },
    title: { size: 15, lineHeight: 20, weight: 600 },
    base: { size: 14, lineHeight: 20, weight: 400 },
    body: { size: 13, lineHeight: 18, weight: 400 },
    caption: { size: 12, lineHeight: 16, weight: 500 },
    label: { size: 11, lineHeight: 14, weight: 500 },
    badge: { size: 10, lineHeight: 14, weight: 600 },
    micro: { size: 9, lineHeight: 12, weight: 500 },
  },
};
