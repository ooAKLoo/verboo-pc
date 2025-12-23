// 字幕数据结构
export interface SubtitleItem {
  start: number;
  duration?: number;
  text: string;
  translation?: string;
}

// 解析 SRT 格式字幕
export function parseSRT(content: string): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];

  // 规范化换行符
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) continue;

    // 找到时间戳行
    let timeLineIndex = -1;
    let timeLine = '';

    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        timeLine = lines[i];
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    // 文本在时间戳之后
    const textLines = lines.slice(timeLineIndex + 1);
    if (textLines.length === 0) continue;

    // 解析时间戳: 00:00:01,000 --> 00:00:04,000
    // 也支持没有毫秒的格式: 00:00:01 --> 00:00:04
    const timeMatch = timeLine.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[,.](\d{1,3}))?\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})(?:[,.](\d{1,3}))?/);
    if (!timeMatch) continue;

    const [, h1, m1, s1, ms1 = '0', h2, m2, s2, ms2 = '0'] = timeMatch;
    const start = parseInt(h1) * 3600 + parseInt(m1) * 60 + parseInt(s1) + parseInt(ms1.padEnd(3, '0')) / 1000;
    const end = parseInt(h2) * 3600 + parseInt(m2) * 60 + parseInt(s2) + parseInt(ms2.padEnd(3, '0')) / 1000;

    subtitles.push({
      start,
      duration: end - start,
      text: textLines.join('\n').trim()
    });
  }

  return subtitles;
}

// 解析 VTT 格式字幕
export function parseVTT(content: string): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];

  // 移除 WEBVTT 头部
  const cleanContent = content.replace(/^WEBVTT.*?\n\n/s, '');
  const blocks = cleanContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // VTT 可能有标识符行，也可能没有
    let timeLine = lines[0];
    let textLines = lines.slice(1);

    // 如果第一行不是时间戳，尝试第二行
    if (!timeLine.includes('-->')) {
      timeLine = lines[1];
      textLines = lines.slice(2);
    }

    // 解析时间戳: 00:00:01.000 --> 00:00:04.000
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (!timeMatch) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    const start = parseInt(h1) * 3600 + parseInt(m1) * 60 + parseInt(s1) + parseInt(ms1) / 1000;
    const end = parseInt(h2) * 3600 + parseInt(m2) * 60 + parseInt(s2) + parseInt(ms2) / 1000;

    subtitles.push({
      start,
      duration: end - start,
      text: textLines.join('\n')
    });
  }

  return subtitles;
}

// 解析 JSON 格式字幕
export function parseJSON(content: string): SubtitleItem[] {
  try {
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      // 如果是数组，尝试映射到我们的格式
      return data.map(item => {
        if (typeof item === 'string') {
          // 纯文本数组
          return { start: 0, text: item };
        }

        // 假设对象格式
        return {
          start: item.start || item.startTime || 0,
          duration: item.duration || item.dur || undefined,
          text: item.text || item.content || '',
          translation: item.translation || item.trans || undefined
        };
      });
    }

    return [];
  } catch (error) {
    throw new Error('无效的 JSON 格式');
  }
}

// 解析纯文本格式（每行一条字幕）
export function parseText(content: string): SubtitleItem[] {
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map((line, index) => ({
    start: index,
    text: line.trim()
  }));
}

// 自动检测并解析字幕文件
export function parseSubtitle(content: string, filename: string): SubtitleItem[] {
  const ext = filename.toLowerCase().split('.').pop();

  try {
    switch (ext) {
      case 'srt':
        return parseSRT(content);

      case 'vtt':
        return parseVTT(content);

      case 'json':
        return parseJSON(content);

      case 'txt':
      default:
        // 尝试自动检测格式
        if (content.trim().startsWith('WEBVTT')) {
          return parseVTT(content);
        } else if (content.includes('-->')) {
          return parseSRT(content);
        } else if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
          return parseJSON(content);
        } else {
          return parseText(content);
        }
    }
  } catch (error) {
    throw new Error(`解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
