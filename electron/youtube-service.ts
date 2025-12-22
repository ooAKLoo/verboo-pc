import fetch from 'node-fetch';

interface Subtitle {
    start: number;
    duration: number;
    text: string;
    translation?: string;
}

interface CaptionTrack {
    baseUrl: string;
    name: {
        simpleText: string;
    };
    languageCode: string;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Parse JSON3 subtitle format (YouTube's modern format)
 */
function parseJson3Subtitles(json: any): Subtitle[] {
    console.log('[YouTube] Parsing JSON3 format');

    const events = json?.events;
    if (!Array.isArray(events)) {
        console.log('[YouTube] No events array found');
        return [];
    }

    const subtitles: Subtitle[] = [];

    for (const event of events) {
        if (!event.segs) continue;

        const startMs = event.tStartMs || 0;
        const durationMs = event.dDurationMs || 0;

        const text = event.segs
            .map((seg: any) => seg.utf8 || '')
            .join('')
            .trim();

        if (text) {
            subtitles.push({
                start: startMs / 1000,
                duration: durationMs / 1000,
                text,
            });
        }
    }

    console.log(`[YouTube] Parsed ${subtitles.length} subtitles from JSON3`);
    return subtitles;
}

/**
 * Use InnerTube API to get subtitles (most reliable method)
 */
async function getSubtitlesViaInnerTube(videoId: string): Promise<Subtitle[]> {
    console.log('[YouTube] Trying InnerTube API for video:', videoId);

    const payload = {
        context: {
            client: {
                hl: 'en',
                gl: 'US',
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00',
            },
        },
        videoId,
    };

    const response = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': '2.20240101.00.00',
            'Origin': 'https://www.youtube.com',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`InnerTube API failed: HTTP ${response.status}`);
    }

    const data: any = await response.json();

    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
        throw new Error('No caption tracks found via InnerTube');
    }

    console.log('[YouTube] Found caption tracks via InnerTube:', captionTracks.map((t: any) => ({
        lang: t.languageCode,
        name: t.name?.simpleText,
    })));

    // Use first caption track
    const track = captionTracks[0];
    const baseUrl = track.baseUrl;

    if (!baseUrl) {
        throw new Error('Caption track has no baseUrl');
    }

    // Request JSON3 format
    const subtitleUrl = `${baseUrl}&fmt=json3`;
    console.log('[YouTube] Fetching subtitles from InnerTube URL');

    const subtitleResponse = await fetch(subtitleUrl, {
        headers: {
            'Accept': 'application/json',
            'Origin': 'https://www.youtube.com',
        },
    });

    if (!subtitleResponse.ok) {
        throw new Error(`Subtitle fetch failed: HTTP ${subtitleResponse.status}`);
    }

    const subtitleJson = await subtitleResponse.json();
    return parseJson3Subtitles(subtitleJson);
}

/**
 * Get video metadata from HTML page
 */
async function getVideoMetadata(videoId: string): Promise<any> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    console.log('[YouTube] Fetching video page:', url);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });

    const html = await response.text();

    // Extract ytInitialPlayerResponse from HTML
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) {
        throw new Error('无法找到视频播放器数据');
    }

    const playerResponse = JSON.parse(match[1]);
    return playerResponse;
}

/**
 * Download subtitles using baseUrl from page metadata
 */
async function downloadSubtitlesFromBaseUrl(baseUrl: string): Promise<Subtitle[]> {
    console.log('[YouTube] Trying baseUrl method');

    // Request JSON3 format
    const url = `${baseUrl}&fmt=json3`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'Origin': 'https://www.youtube.com',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    return parseJson3Subtitles(json);
}

/**
 * Main function: Get subtitles for a YouTube video
 */
export async function getYouTubeSubtitles(url: string): Promise<Subtitle[]> {
    // 1. Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('无效的 YouTube URL');
    }

    console.log('[YouTube] Processing video ID:', videoId);

    // Try method 1: InnerTube API (most reliable)
    try {
        const subtitles = await getSubtitlesViaInnerTube(videoId);
        if (subtitles.length > 0) {
            console.log(`[YouTube] ✅ InnerTube API success: ${subtitles.length} subtitles`);
            return subtitles;
        }
    } catch (error) {
        console.log('[YouTube] InnerTube API failed:', (error as Error).message);
    }

    // Try method 2: HTML page metadata + baseUrl
    try {
        console.log('[YouTube] Trying HTML page method');
        const metadata = await getVideoMetadata(videoId);

        const captionTracks = metadata?.captions?.playerCaptionsTracklistRenderer?.captionTracks as CaptionTrack[];

        if (!captionTracks || captionTracks.length === 0) {
            throw new Error('该视频没有字幕');
        }

        console.log('[YouTube] Found caption tracks from page:', captionTracks.map(t => ({
            lang: t.languageCode,
            name: t.name?.simpleText,
        })));

        // Use first caption track
        const track = captionTracks[0];
        console.log('[YouTube] Selected track:', track.languageCode, track.name?.simpleText);

        const subtitles = await downloadSubtitlesFromBaseUrl(track.baseUrl);

        if (subtitles.length > 0) {
            console.log(`[YouTube] ✅ HTML page method success: ${subtitles.length} subtitles`);
            return subtitles;
        }
    } catch (error) {
        console.log('[YouTube] HTML page method failed:', (error as Error).message);
    }

    // All methods failed
    throw new Error('所有字幕获取方法均失败,请检查视频是否有字幕或网络连接');
}
