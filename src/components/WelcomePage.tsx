import { useState, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../contexts/I18nContext';

// Recent sites stored in localStorage (shared with Sidebar)
interface RecentSite {
    url: string;
    title: string;
    favicon?: string;
    lastPosition?: number;
    duration?: number;
}

const RECENT_SITES_KEY = 'verboo_recent_sites';

function loadRecentSites(): RecentSite[] {
    try {
        const stored = localStorage.getItem(RECENT_SITES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function getFaviconUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}/favicon.ico`;
    } catch {
        return '';
    }
}

function formatPosition(seconds: number): string {
    if (!seconds || seconds < 0) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface WelcomePageProps {
    onNavigate: (url: string, seekTo?: number) => void;
    isExiting: boolean;
}

export function WelcomePage({ onNavigate, isExiting }: WelcomePageProps) {
    const { t, locale } = useTranslation();
    const [inputUrl, setInputUrl] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [recentSites, setRecentSites] = useState<RecentSite[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // 调试日志
    console.log('[WelcomePage] Render - locale:', locale, 'isExiting:', isExiting);

    useEffect(() => {
        console.log('[WelcomePage] Mount effect');
        setRecentSites(loadRecentSites());
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 400);
        return () => {
            console.log('[WelcomePage] Cleanup');
            clearTimeout(timer);
        };
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputUrl.trim()) return;

        let url = inputUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }
        onNavigate(url);
    };

    const quickLinks = [
        { name: 'YouTube', url: 'https://www.youtube.com', icon: '/icons8-youtube.svg' },
        { name: 'Bilibili', url: 'https://www.bilibili.com', icon: '/icons8-bilibili.svg' },
    ];

    return (
        <div
            className={`
                absolute inset-0 z-30 bg-white
                flex flex-col items-center justify-center
                transition-all duration-700 ease-out
                ${isExiting ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'}
            `}
        >

            {/* Content */}
            <div className="relative z-10 w-full max-w-md px-8">
                {/* Search Input */}
                <form
                    onSubmit={handleSubmit}
                    className={`
                        transition-all duration-700 delay-200
                        ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
                    `}
                >
                    <div
                        className={`
                            relative group
                            transition-all duration-300
                            ${isFocused ? 'scale-[1.02]' : 'scale-100'}
                        `}
                    >
                        {/* Input container */}
                        <div
                            className={`
                                relative flex items-center
                                bg-zinc-100
                                rounded-full overflow-hidden
                                transition-all duration-300
                                ${isFocused ? 'bg-zinc-50' : ''}
                            `}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder={t('welcome.placeholder')}
                                className="
                                    w-full py-4 px-5 pr-14
                                    text-[15px] text-zinc-800 font-medium
                                    bg-transparent outline-none
                                    placeholder:text-zinc-400 placeholder:font-normal
                                "
                            />
                            <button
                                type="submit"
                                disabled={!inputUrl.trim()}
                                className={`
                                    absolute right-2 p-2.5 rounded-full
                                    transition-all duration-200
                                    ${inputUrl.trim()
                                        ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                                        : 'bg-zinc-200 text-zinc-400'
                                    }
                                `}
                            >
                                <ArrowRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Quick Links - Bottom Right */}
            <div
                className={`
                    absolute bottom-6 right-6 flex gap-2
                    transition-all duration-700 delay-300
                    ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
                `}
            >
                {quickLinks.map(link => (
                    <button
                        key={link.name}
                        onClick={() => onNavigate(link.url)}
                        className="
                            flex items-center gap-2 px-4 py-2
                            bg-white/60 backdrop-blur-sm
                            border border-zinc-200/60
                            rounded-full
                            text-[13px] font-medium text-zinc-600
                            hover:bg-white hover:border-zinc-300/80 hover:text-zinc-900
                            transition-all duration-200
                        "
                    >
                        <img src={link.icon} alt="" className="w-4 h-4" />
                        {link.name}
                    </button>
                ))}
            </div>
        </div>
    );
}
