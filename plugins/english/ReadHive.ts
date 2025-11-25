import { Plugin } from '@libs/plugin';
import { load } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

/**
 * ReadHive plugin for LNReader (Custom Laravel Backend)
 *
 * ReadHive uses a custom PHP/Laravel backend with Alpine.js + Tailwind CSS
 * NOT a WordPress/Madara site, so we need custom parsing
 *
 * Supports:
 * - /series/ID/v1/1.1 (chapter format)
 * - /series/ID/1/ (simpler chapter format)
 * - Alpine.js data attributes
 * - Custom Laravel routes
 */

class ReadHivePlugin implements Plugin.PluginBase {
  id = 'readhive';
  name = 'ReadHive';
  icon = 'src/en/readhive/readhive.jpg';
  site = 'https://readhive.org/';
  version = '1.0.3';
  filters = [];

  resolveUrl = (path: string) => {
    try {
      return new URL(path, this.site).toString();
    } catch {
      return this.site + path;
    }
  };

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    try {
      const url = this.site + '/';
      const response = await fetchApi(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const $ = load(html);

      // Try common card selectors for Laravel sites
      const cards = $(
        '.series-card, .series-item, .novel-card, .post, .card',
      ).slice(0, 40);
      cards.each((i, el) => {
        const a = $(el).find('a[href*="/series/"]').first();
        if (!a || !a.attr('href')) return;
        const href = this.resolveUrl(a.attr('href')!);
        const title = (
          a.text() ||
          $(el).find('h2, h3, .title').text() ||
          ''
        ).trim();
        const img = $(el).find('img').first();
        const cover = img?.attr('src')
          ? this.resolveUrl(img.attr('src')!)
          : defaultCover;
        novels.push({
          name: title || href,
          path: href.replace(this.site, '/'),
          cover: cover || defaultCover,
        });
      });

      // Fallback: any '/series/' links on homepage
      if (!novels.length) {
        const seen = new Set<string>();
        $('a[href*="/series/"]').each((i, el) => {
          const href = $(el).attr('href') || '';
          const abs = this.resolveUrl(href);
          if (seen.has(abs)) return;
          seen.add(abs);
          const title = ($(el).text() || '').trim() || abs;
          novels.push({
            name: title,
            path: abs.replace(this.site, '/'),
            cover: defaultCover,
          });
        });
      }
    } catch (err) {
      console.warn('ReadHive popularNovels error', err);
    }
    return novels;
  }

  async searchNovels(
    searchTerm: string,
    pageNo?: number,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    try {
      const url = `${this.site}/?s=${encodeURIComponent(searchTerm)}`;
      const response = await fetchApi(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const $ = load(html);

      // Look for series cards first
      const cardSel = '.series-card, .series-item, .novel-card, .post, .card';
      const cards = $(cardSel);
      if (cards.length) {
        cards.each((i, el) => {
          const a = $(el).find('a[href*="/series/"]').first();
          if (!a || !a.attr('href')) return;
          const href = this.resolveUrl(a.attr('href')!);
          const title = (
            a.text() ||
            $(el).find('h2, h3, .title').text() ||
            ''
          ).trim();
          const img = $(el).find('img').first();
          const cover = img?.attr('src')
            ? this.resolveUrl(img.attr('src')!)
            : defaultCover;
          novels.push({
            name: title || href,
            path: href.replace(this.site, '/'),
            cover: cover || defaultCover,
          });
        });
      } else {
        // Fallback: any link with /series/
        const seen = new Set<string>();
        $('a[href*="/series/"]').each((i, el) => {
          const href = $(el).attr('href') || '';
          const abs = this.resolveUrl(href);
          if (seen.has(abs)) return;
          seen.add(abs);
          const title = ($(el).text() || '').trim() || abs;
          novels.push({
            name: title,
            path: abs.replace(this.site, '/'),
            cover: defaultCover,
          });
        });
      }
    } catch (err) {
      console.warn('ReadHive searchNovels error', err);
    }
    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: 'Untitled',
      cover: defaultCover,
      chapters: [],
    };
    try {
      const url = this.resolveUrl(novelPath);
      const response = await fetchApi(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const $ = load(html);

      // Title
      const title = $(
        'h1.series-title, h1, .series-title, .post-title, .entry-title',
      )
        .first()
        .text()
        .trim();
      if (title) novel.name = title;

      // Cover
      let cover =
        $('img.cover, img.series-cover, .cover img, .post-thumbnail img')
          .first()
          .attr('src') || null;
      if (!cover)
        cover = $('meta[property="og:image"]').attr('content') || null;
      if (cover) novel.cover = this.resolveUrl(cover);

      // Summary
      const summarySel =
        '.series-synopsis, .summary, .desc, .description, .entry-summary, .post-excerpt';
      let summary = '';
      for (const sel of summarySel.split(',')) {
        const txt = $(sel.trim()).first().text().trim();
        if (txt) {
          summary = txt;
          break;
        }
      }
      if (!summary)
        summary = $('meta[name="description"]').attr('content') || '';
      if (summary) novel.summary = summary;

      // Status & genres (best-effort)
      const statusText = $('.status, .series-status, .novel-status')
        .first()
        .text()
        .trim()
        .toLowerCase();
      if (statusText.includes('complete') || statusText.includes('completed'))
        novel.status = NovelStatus.Completed;
      else if (statusText) novel.status = NovelStatus.Ongoing;

      const genres = $('.genres, .tags, .series-genres, .post-tags')
        .first()
        .text()
        .trim();
      if (genres) novel.genres = genres;

      // Author
      const author = $('.author, .series-author, .post-author')
        .first()
        .text()
        .trim();
      if (author) novel.author = author;

      // Chapters: parse releases or chapter lists
      const chapters: Plugin.ChapterItem[] = [];
      const chapterContainers = [
        '#releases',
        '.releases',
        '#chapter-list',
        '.chapter-list',
        '.chapters',
        '.series-chapters',
        '.list-chapters',
        '.post-content',
      ];

      let foundChapters = false;
      for (const sel of chapterContainers) {
        const container = $(sel);
        if (!container || !container.length) continue;
        container.find('a[href]').each((i, el) => {
          const a = $(el);
          const href = a.attr('href') || '';
          if (!href) return;
          const abs = this.resolveUrl(href);
          if (!abs.includes('/series/')) return;
          const t = (a.text() || a.attr('title') || '').trim() || abs;
          chapters.push({
            name: t,
            path: abs.replace(this.site, '/'),
            releaseTime: '',
            chapterNumber: 0,
          });
        });
        if (chapters.length) {
          foundChapters = true;
          break;
        }
      }

      // Fallback: scan all links for chapter-like patterns
      if (!foundChapters) {
        const seen = new Set<string>();
        $('a[href*="/series/"]').each((i, el) => {
          const a = $(el);
          const href = a.attr('href') || '';
          const abs = this.resolveUrl(href);
          // match patterns like /series/12345/1/ or /series/12345/v1/1.1
          if (!abs.match(/\/series\/\d+\/(.+)?/)) return;
          // try to filter out the overview link itself
          if (abs.replace(/\/+$/, '') === url.replace(/\/+$/, '')) return;
          if (seen.has(abs)) return;
          seen.add(abs);
          const t = (a.text() || a.attr('title') || '').trim() || abs;
          chapters.push({
            name: t,
            path: abs.replace(this.site, '/'),
            releaseTime: '',
            chapterNumber: 0,
          });
        });
      }

      // Dedupe while preserving order
      const unique: Plugin.ChapterItem[] = [];
      const seenUrls = new Set<string>();
      for (const c of chapters) {
        if (seenUrls.has(c.path)) continue;
        seenUrls.add(c.path);
        unique.push(c);
      }

      // Heuristic sort: extract numeric chapter id from URL or title
      function extractNum(u: string): number | null {
        // try to match trailing /{number}/ or v{num}/{num} or /v1/1.1
        const m1 = u.match(/\/(\d+(?:\.\d+)?)(?:\/)?$/);
        if (m1) return Number(m1[1]);
        const m2 = u.match(/v\d+\/(\d+(?:\.\d+)?)/);
        if (m2) return Number(m2[1]);
        return null;
      }
      unique.sort((a, b) => {
        const na = extractNum(a.path);
        const nb = extractNum(b.path);
        if (na !== null && nb !== null) return na - nb;
        if (na !== null) return -1;
        if (nb !== null) return 1;
        return a.name.localeCompare(b.name);
      });

      // Attempt to fill chapterNumber from order (descending to ascending).
      for (let i = 0; i < unique.length; i++) {
        // assign a reverse index so earlier chapters have lower numbers
        unique[i].chapterNumber = i + 1;
      }

      novel.chapters = unique;
    } catch (err) {
      console.error('ReadHive parseNovel error', err);
      novel.chapters = novel.chapters || [];
    }

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    try {
      const url = this.resolveUrl(chapterPath);
      const response = await fetchApi(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const $ = load(html);

      // Title
      let title = $('h1.chapter-title, .chapter-title, h1, .post-title')
        .first()
        .text()
        .trim();

      // Try common content selectors
      const contentSelectors = [
        '.chapter-content',
        '.entry-content',
        '.post-content',
        '.reader-content',
        '#chapter-content',
        '.content',
        'article',
      ];

      let contentHtml = '';
      for (const sel of contentSelectors) {
        const el = $(sel).first();
        if (el && el.text().trim().length > 50) {
          contentHtml = el.html() || '';
          break;
        }
      }

      // If not found, pick largest text container
      if (!contentHtml) {
        let bestHtml = '';
        let bestLen = 0;
        $('div, section, article').each((i, el) => {
          const txt = $(el).text() || '';
          if (txt.length > bestLen) {
            bestLen = txt.length;
            bestHtml = $(el).html() || '';
          }
        });
        contentHtml = bestHtml;
      }

      if (!contentHtml) return '';

      // Load content into cheerio to remove noise
      const content$ = load(contentHtml);

      // Remove scripts, iframes, share bars, ads, comments
      content$(
        'script, iframe, .share, .shares, .ads, .advert, .toc, .nav, .comments, style, noscript, .related',
      ).remove();

      // Remove empty paragraphs
      content$('p').each((i, el) => {
        if ((content$(el).text() || '').trim().length === 0)
          content$(el).remove();
      });

      // Make image src absolute
      content$('img').each((i, el) => {
        const src =
          content$(el).attr('src') || content$(el).attr('data-src') || '';
        if (src) content$(el).attr('src', this.resolveUrl(src));
      });

      // Return cleaned HTML (title + content)
      const cleaned = `<h1>${title || ''}</h1>\n${content$.html() || ''}`;
      return cleaned;
    } catch (err) {
      console.error('ReadHive parseChapter error', err);
      return '';
    }
  }
}

export default new ReadHivePlugin();
