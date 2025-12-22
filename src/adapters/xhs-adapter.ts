/**
 * XHS (小红书) Platform Adapter
 * 
 * Captures content from Xiaohongshu posts including:
 * - Post title and content
 * - Images
 * - Author information
 * - Tags/hashtags
 */

import type { PlatformAdapter, CaptureResult } from './types';
import { adapterRegistry } from './registry';

export class XHSAdapter implements PlatformAdapter {
    readonly platformName = '小红书';
    readonly platformIcon = '📕';

    /**
     * Match XHS URLs
     */
    match(url: string): boolean {
        return (
            url.includes('xiaohongshu.com') ||
            url.includes('xhslink.com') ||
            url.includes('xhs.cn')
        );
    }

    /**
     * Get the capture script to execute in webview
     */
    getCaptureScript(): string {
        return `
      (function() {
        try {
          const result = {
            title: '',
            content: '',
            images: [],
            author: {
              name: '',
              avatar: '',
              profileUrl: ''
            },
            tags: []
          };

          // Extract title - try multiple selectors
          const titleEl = document.querySelector('#detail-title') 
            || document.querySelector('.title')
            || document.querySelector('[class*="title"]');
          if (titleEl) {
            result.title = titleEl.textContent?.trim() || '';
          }

          // Extract content/description
          const contentEl = document.querySelector('#detail-desc')
            || document.querySelector('.desc')
            || document.querySelector('[class*="content"]')
            || document.querySelector('.note-text');
          if (contentEl) {
            result.content = contentEl.textContent?.trim() || '';
          }

          // Extract images from carousel or single image
          const imageEls = document.querySelectorAll('.swiper-slide img, .carousel img, [class*="image"] img');
          if (imageEls.length > 0) {
            imageEls.forEach(img => {
              const src = img.src || img.dataset.src;
              if (src && !result.images.includes(src)) {
                result.images.push(src);
              }
            });
          }
          
          // Fallback: get main images
          if (result.images.length === 0) {
            const mainImages = document.querySelectorAll('img[src*="xhscdn"], img[src*="xiaohongshu"]');
            mainImages.forEach(img => {
              const src = img.src;
              if (src && src.includes('http') && !result.images.includes(src)) {
                result.images.push(src);
              }
            });
          }

          // Extract author info
          const authorNameEl = document.querySelector('.author-wrapper .name')
            || document.querySelector('[class*="nickname"]')
            || document.querySelector('.user-name');
          if (authorNameEl) {
            result.author.name = authorNameEl.textContent?.trim() || '';
          }

          const authorAvatarEl = document.querySelector('.author-wrapper img')
            || document.querySelector('[class*="avatar"] img');
          if (authorAvatarEl) {
            result.author.avatar = authorAvatarEl.src || '';
          }

          const authorLinkEl = document.querySelector('.author-wrapper a')
            || document.querySelector('[class*="user"] a');
          if (authorLinkEl) {
            result.author.profileUrl = authorLinkEl.href || '';
          }

          // Extract tags/hashtags
          const tagEls = document.querySelectorAll('[class*="tag"] a, .hashtag, [id*="hash-tag"]');
          tagEls.forEach(tag => {
            const tagText = tag.textContent?.trim().replace(/^#/, '');
            if (tagText && !result.tags.includes(tagText)) {
              result.tags.push(tagText);
            }
          });

          // Also look for hashtags in content
          const hashtagRegex = /#([^#\\s]+)/g;
          const contentText = result.content || '';
          let match;
          while ((match = hashtagRegex.exec(contentText)) !== null) {
            const tag = match[1].trim();
            if (tag && !result.tags.includes(tag)) {
              result.tags.push(tag);
            }
          }

          return result;
        } catch (error) {
          return { error: error.message || 'Unknown error' };
        }
      })();
    `;
    }

    /**
     * Parse raw extraction result into CaptureResult
     */
    parseResult(rawData: any, url: string): CaptureResult {
        if (rawData.error) {
            throw new Error(rawData.error);
        }

        return {
            platform: this.platformName,
            title: rawData.title || '',
            content: rawData.content || '',
            images: rawData.images || [],
            author: {
                name: rawData.author?.name || '未知作者',
                avatar: rawData.author?.avatar,
                profileUrl: rawData.author?.profileUrl,
            },
            tags: rawData.tags || [],
            originalUrl: url,
            capturedAt: new Date(),
        };
    }
}

// Auto-register the adapter
adapterRegistry.register(new XHSAdapter());
