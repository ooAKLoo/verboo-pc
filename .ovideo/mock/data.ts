// .ovideo/mock/data.ts
import type {
  Asset,
  SubtitleItem,
  SubtitleRecord,
  VocabularyWord,
} from "./types";

// ─── Current Video Info ───────────────────────────
export const MOCK_CURRENT_VIDEO = {
  title: "CS50 2024 - Lecture 0 - Scratch",
  url: "https://www.youtube.com/watch?v=3LPJfIKxwWc",
  platform: "youtube",
  author: { name: "CS50" },
  currentTime: 125, // 2:05 into the video
};

// ─── Subtitle Data (right panel) ──────────────────
export const MOCK_SUBTITLES: SubtitleItem[] = [
  {
    start: 0,
    duration: 4.5,
    text: "All right, this is CS50.",
    translation: "好的，这是CS50。",
  },
  {
    start: 4.5,
    duration: 3.2,
    text: "And this is the start of a journey.",
    translation: "这是一段旅程的开始。",
  },
  {
    start: 7.7,
    duration: 5.1,
    text: "Whereby when you leave this course, you'll be able to do things you couldn't before.",
    translation: "学完这门课后，你将能做到以前做不到的事情。",
  },
  {
    start: 12.8,
    duration: 4.0,
    text: "You'll understand computational thinking.",
    translation: "你将理解计算思维。",
  },
  {
    start: 16.8,
    duration: 3.5,
    text: "You'll be able to solve problems more effectively.",
    translation: "你将能够更有效地解决问题。",
  },
  {
    start: 120,
    duration: 5.2,
    text: "So let me go ahead and introduce what a computer scientist would call pseudocode.",
    translation: "那让我来介绍一下计算机科学家所说的伪代码。",
  },
  {
    start: 125.2,
    duration: 4.0,
    text: "Pseudocode isn't a formal language. It's just English-like syntax.",
    translation: "伪代码不是正式语言，只是类英语的语法。",
  },
];

// ─── Screenshot Assets (right panel asset tab) ────
export const MOCK_ASSETS: Asset[] = [
  {
    id: 1,
    type: "screenshot",
    platform: "youtube",
    title: "CS50 2024 - Lecture 0 - Scratch",
    url: "https://www.youtube.com/watch?v=3LPJfIKxwWc",
    author: { name: "CS50" },
    timestamp: 342,
    markType: "important",
    subtitleText:
      "The determinant of a matrix tells you how much areas get scaled",
    createdAt: "2025-03-15T10:30:00Z",
  },
  {
    id: 2,
    type: "screenshot",
    platform: "youtube",
    title: "CS50 2024 - Lecture 0 - Scratch",
    url: "https://www.youtube.com/watch?v=3LPJfIKxwWc",
    author: { name: "CS50" },
    timestamp: 128,
    subtitleText: "Pseudocode isn't a formal language",
    createdAt: "2025-03-15T10:22:00Z",
  },
  {
    id: 3,
    type: "screenshot",
    platform: "youtube",
    title: "CS50 2024 - Lecture 0 - Scratch",
    url: "https://www.youtube.com/watch?v=3LPJfIKxwWc",
    author: { name: "CS50" },
    timestamp: 567,
    markType: "difficult",
    createdAt: "2025-03-15T09:45:00Z",
  },
  {
    id: 4,
    type: "screenshot",
    platform: "youtube",
    title: "CS50 2024 - Lecture 0 - Scratch",
    url: "https://www.youtube.com/watch?v=3LPJfIKxwWc",
    author: { name: "CS50" },
    timestamp: 890,
    subtitleText: "So this is what we call an algorithm",
    createdAt: "2025-03-15T09:15:00Z",
  },
];

// ─── Asset Library (full panel) ───────────────────
export const MOCK_ALL_ASSETS: Asset[] = [
  ...MOCK_ASSETS,
  {
    id: 5,
    type: "screenshot",
    platform: "bilibili",
    title: "3Blue1Brown - Linear Algebra Explained Visually",
    url: "https://www.bilibili.com/video/BV1ys411472E",
    author: { name: "3Blue1Brown" },
    timestamp: 128,
    markType: "difficult",
    subtitleText:
      "The determinant of a matrix tells you how much areas get scaled",
    createdAt: "2025-03-14T15:22:00Z",
  },
  {
    id: 6,
    type: "screenshot",
    platform: "youtube",
    title: "TED Talk - The Power of Vulnerability",
    url: "https://www.youtube.com/watch?v=iCvmsMzlF7o",
    author: { name: "TED" },
    timestamp: 567,
    createdAt: "2025-03-13T09:15:00Z",
  },
  {
    id: 7,
    type: "screenshot",
    platform: "youtube",
    title: "MIT OpenCourseWare - Introduction to Algorithms",
    url: "https://www.youtube.com/watch?v=HtSuA80QTyo",
    author: { name: "MIT OpenCourseWare" },
    timestamp: 890,
    markType: "important",
    createdAt: "2025-03-11T14:45:00Z",
  },
  {
    id: 8,
    type: "content",
    platform: "xiaohongshu",
    title: "IELTS Writing Tips - Task 2 Structure",
    url: "https://www.xiaohongshu.com/explore/abc123",
    author: { name: "English Coach" },
    timestamp: 0,
    createdAt: "2025-03-12T18:00:00Z",
  },
];

// ─── Subtitle Library (full panel) ────────────────
export const MOCK_SUBTITLE_RECORDS: SubtitleRecord[] = [
  {
    id: 1,
    videoUrl: "https://www.youtube.com/watch?v=3LPJfIKxwWc",
    videoTitle: "CS50 2024 - Lecture 0 - Scratch",
    platform: "youtube",
    subtitleData: MOCK_SUBTITLES,
    createdAt: "2025-03-15T10:00:00Z",
  },
  {
    id: 2,
    videoUrl: "https://www.bilibili.com/video/BV1ys411472E",
    videoTitle: "3Blue1Brown - Linear Algebra Explained Visually",
    platform: "bilibili",
    subtitleData: [
      { start: 0, duration: 3.0, text: "Hey everyone, welcome back." },
      {
        start: 3.0,
        duration: 4.5,
        text: "Today we're going to talk about linear transformations.",
      },
      {
        start: 7.5,
        duration: 5.0,
        text: "The key insight is that every linear transformation can be described by a matrix.",
      },
      {
        start: 12.5,
        duration: 4.0,
        text: "And conversely, every matrix represents some linear transformation.",
      },
    ],
    createdAt: "2025-03-14T15:00:00Z",
  },
  {
    id: 3,
    videoUrl: "https://www.youtube.com/watch?v=iCvmsMzlF7o",
    videoTitle: "TED Talk - The Power of Vulnerability",
    platform: "youtube",
    subtitleData: [
      {
        start: 0,
        duration: 5.2,
        text: "So, I'll start with this: a couple years ago, an event planner called me.",
        translation: "那么，我从这里开始：几年前，一位活动策划人联系了我。",
      },
      {
        start: 5.2,
        duration: 4.8,
        text: "Because I was going to do a speaking event.",
        translation: "因为我即将做一个演讲活动。",
      },
      {
        start: 10.0,
        duration: 6.0,
        text: "And she said, I'm really struggling with how to write about you on the little flyer.",
        translation: "她说，我真的很纠结该怎么在宣传单上介绍你。",
      },
    ],
    createdAt: "2025-03-13T09:00:00Z",
  },
];

// ─── Vocabulary (learning panel) ──────────────────
export const MOCK_VOCABULARY: VocabularyWord[] = [
  {
    word: "vulnerability",
    phonetic: "/ˌvʌlnərəˈbɪləti/",
    pos: "n.",
    definitionCn: "脆弱性；易受伤害",
    definitionEn: "the quality of being easily hurt or attacked",
    cefrLevel: "C1",
    difficulty: "high",
    examTags: ["CET-6", "TOEFL", "IELTS", "GRE"],
  },
  {
    word: "determinant",
    phonetic: "/dɪˈtɜːrmɪnənt/",
    pos: "n.",
    definitionCn: "决定因素；行列式",
    definitionEn: "a factor that decisively affects the nature of something",
    cefrLevel: "C1",
    difficulty: "high",
    examTags: ["CET-6", "TOEFL", "GRE"],
  },
  {
    word: "transformation",
    phonetic: "/ˌtrænsfərˈmeɪʃən/",
    pos: "n.",
    definitionCn: "转变；变换",
    definitionEn: "a thorough or dramatic change in form or appearance",
    cefrLevel: "B2",
    difficulty: "medium",
    examTags: ["CET-4", "CET-6", "TOEFL", "IELTS"],
  },
  {
    word: "computational",
    phonetic: "/ˌkɒmpjuˈteɪʃənl/",
    pos: "adj.",
    definitionCn: "计算的；计算机的",
    definitionEn: "relating to or using computers or computation",
    cefrLevel: "C1",
    difficulty: "high",
    examTags: ["CET-6", "TOEFL", "GRE"],
  },
  {
    word: "effectively",
    phonetic: "/ɪˈfektɪvli/",
    pos: "adv.",
    definitionCn: "有效地；实际上",
    definitionEn: "in a way that is successful and achieves what you want",
    cefrLevel: "B1",
    difficulty: "low",
    examTags: ["CET-4", "CET-6", "TOEFL", "IELTS"],
  },
  {
    word: "conversely",
    phonetic: "/ˈkɒnvɜːsli/",
    pos: "adv.",
    definitionCn: "相反地",
    definitionEn: "in a way that is the opposite of something",
    cefrLevel: "B2",
    difficulty: "medium",
    examTags: ["CET-6", "TOEFL", "IELTS", "GRE"],
  },
];
