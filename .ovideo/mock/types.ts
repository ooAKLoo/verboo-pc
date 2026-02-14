// .ovideo/mock/types.ts

export type AssetType = "content" | "screenshot";
export type MarkType = "important" | "difficult";
export type Platform = "youtube" | "bilibili" | "bilibili-ai" | "import";

export interface Author {
  name: string;
  avatar?: string;
  profileUrl?: string;
}

export interface Asset {
  id: number;
  type: AssetType;
  platform: string;
  title: string;
  url: string;
  author?: Author;
  favicon?: string;
  timestamp: number; // seconds into video
  markType?: MarkType;
  subtitleText?: string;
  createdAt: string;
}

export interface SubtitleItem {
  start: number;
  duration?: number;
  text: string;
  translation?: string;
}

export interface SubtitleRecord {
  id: number;
  videoUrl: string;
  videoTitle: string;
  platform: Platform;
  subtitleData: SubtitleItem[];
  createdAt: string;
}

export interface VocabularyWord {
  word: string;
  phonetic: string;
  pos: string;
  definitionCn: string;
  definitionEn: string;
  cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  difficulty: "low" | "medium" | "high";
  examTags: string[];
}

export interface SidebarNavItem {
  icon: string;
  label: string;
  shortcut?: string;
  active?: boolean;
}
