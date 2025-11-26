import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

/**
 * ReadHive plugin for LNReader-style plugin playgrounds.
 *
 * Notes:
 * - This plugin prefers API endpoints when available (AJAX), but falls back to HTML parsing.
 * - NovelItem/path style is used to match your existing plugins (BelleRepository).
 * - Chapter numbers support both integer and decimal formats (1, 2, 1.1, 1.2, ...).
 * - Image requests include a Referer header to avoid some hotlink protections.
 */

class ReadHivePlugin implements Plugin.PluginBase {
  id = 'readhive';
  name = 'ReadHive';
  icon = 'src/en/readhive/icon.png';
  site = 'https://readhive.org';
  version = '1.0.7';
  filters: Filters | undefined = undefined;

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: {
      Referer: 'https://readhive.org/',
    },
  };

  // Helper: build a full URL from a stored path.
  resolveUrl = (path: string, isNovel?: boolean) => {
    if (!path) return this.site;
    if (path.startsWith('http')) return path;
    // Many saved paths in other plugins are like "/series/44854/" or "series/44854/"
    return this.site + (path.startsWith('/') ? path : '/' + path);
  };

  // -----------------------------
  // POPULAR NOVELS (or latest)
  // -----------------------------
  // ReadHive doesn't expose a simple HTML "popular" list; try common ajax endpoints first,
  // then fall back to /series/ page parsing.
  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];

    // 1) Try common admin-ajax endpoints (some WP/Madara-like setups)
    const tryAjaxEndpoints = [
      // NOTE: Some sites use different action names; these are safe to try and will be caught on failure
      `${this.site}/wp-admin/admin-ajax.php?action=manga_get_latest_updates`,
      `${this.site}/wp-admin/admin-ajax.php?action=manga_get_all_series`,
      // older-style endpoint example (ReadHive-specific patterns) - won't hurt to attempt
      `${this.site}/api/series?limit=50&page=${pageNo}`,
    ];

    for (const ajaxUrl of tryAjaxEndpoints) {
      try {
        const res = await fetchApi(ajaxUrl, {
          headers: { Referer: this.site },
        });
        if (!res.ok) continue;
        const text = await res.text();
        // Try parse JSON safely
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          // sometimes the endpoint returns HTML or other payloads; skip JSON parsing errors
          json = null;
        }
        if (json && Array.isArray(json.data || json)) {
          // Many endpoints put items under data, others return array directly.
          const arr = Array.isArray(json.data) ? json.data : json;
          for (const it of arr) {
            // Try to determine ID/path and title/cover robustly
            let path = '';
            if (it.url) {
              // make relative path (keep same format as BelleRepository)
              path = it.url.replace(/^https?:\/\/[^/]+/, '');
            } else if (it.link) {
              path = it.link.replace(/^https?:\/\/[^/]+/, '');
            } else if (it.slug && it.id) {
              path = `/series/${it.id}/`;
            } else {
              continue;
            }

            let name =
              (it.title && (it.title.rendered || it.title)) ||
              it.name ||
              it.title ||
              '';
            // If title includes volume/chapter string, remove leading "Vol. X " if it's the whole title:
            name = name.toString().trim();

            // Cover
            let cover = defaultCover;
            if (it.image || it.cover || it.thumbnail) {
              const src = it.image || it.cover || it.thumbnail;
              cover = src.startsWith('http')
                ? src
                : this.site + (src.startsWith('/') ? src : '/' + src);
            }

            // push unique
            if (name && path && !novels.find(n => n.path === path)) {
              novels.push({ name, path, cover });
            }
          }
          // If we got results from an ajax endpoint, return them (no need to fallback)
          if (novels.length) return novels;
        }
      } catch (e) {
        // ignore and continue to next endpoint/fallback
      }
    }

    // 2) Fallback: parse HTML listing pages (best-effort)
    try {
      // ReadHive often lists series at /series/ or paginated /series/?page=#
      const htmlUrl = `${this.site}/series/?page=${pageNo}`;
      const res = await fetchApi(htmlUrl, { headers: { Referer: this.site } });
      if (res.ok) {
        const body = await res.text();
        const $ = loadCheerio(body);

        // Try a few selectors that could point to series cards
        const cardSelectors = [
          '.series-card',
          '.novel-card',
          '.card',
          '.item',
          '.series-list .item',
          '.entry-item',
        ];

        for (const sel of cardSelectors) {
          $(sel).each((i, el) => {
            try {
              const el$ = $(el);
              // title detection attempts
              let name = el$
                .find('h2, h3, .title, .name')
                .first()
                .text()
                .trim();
              if (!name) {
                // maybe the anchor contains the title
                name = el$.find('a').first().text().trim();
              }

              // cover detection
              let cover = defaultCover;
              const img = el$.find('img').first();
              if (img && img.attr) {
                const src =
                  img.attr('data-src') ||
                  img.attr('src') ||
                  img.attr('data-lazy-src');
                if (src) {
                  cover = src.startsWith('http')
                    ? src
                    : this.site + (src.startsWith('/') ? src : '/' + src);
                }
              }

              // path detection: first anchor link to /series/{id}/
              const href =
                el$.find('a[href*="/series/"]').first().attr('href') || '';
              const path = href ? href.replace(/^https?:\/\/[^/]+/, '') : '';

              if (name && path && !novels.find(n => n.path === path)) {
                novels.push({ name, path, cover });
              }
            } catch {
              // ignore single-card errors
            }
          });
          if (novels.length) break;
        }
      }
    } catch {
      // fallback failed - we'll return what we have (possibly empty)
    }

    return novels;
  }

  // -----------------------------
  // SEARCH
  // -----------------------------
  // Try search endpoint, then fallback to scraping search results HTML
  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];
    const searchEndpoints = [
      `${this.site}/?s=${encodeURIComponent(searchTerm)}`,
      `${this.site}/search?q=${encodeURIComponent(searchTerm)}`,
      // attempt a JSON-ish endpoint pattern
      `${this.site}/api/series?search=${encodeURIComponent(searchTerm)}&page=${pageNo}`,
    ];

    for (const url of searchEndpoints) {
      try {
        const res = await fetchApi(url, { headers: { Referer: this.site } });
        if (!res.ok) continue;
        const txt = await res.text();

        // Try JSON parse
        try {
          const json = JSON.parse(txt);
          const arr = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json)
              ? json
              : null;
          if (arr) {
            for (const it of arr) {
              let path = it.url
                ? it.url.replace(/^https?:\/\/[^/]+/, '')
                : it.link
                  ? it.link.replace(/^https?:\/\/[^/]+/, '')
                  : '';
              let name =
                (it.title && (it.title.rendered || it.title)) ||
                it.name ||
                it.title ||
                '';
              if (!path || !name) continue;
              let cover = defaultCover;
              if (it.image || it.cover) {
                const src = it.image || it.cover;
                cover = src.startsWith('http')
                  ? src
                  : this.site + (src.startsWith('/') ? src : '/' + src);
              }
              if (!novels.find(n => n.path === path))
                novels.push({ name, path, cover });
            }
            if (novels.length) return novels;
          }
        } catch {
          // not JSON: try parsing HTML search results
          const $ = loadCheerio(txt);
          $('a[href*="/series/"]').each((i, el) => {
            try {
              const $el = $(el);
              const href = $el.attr('href') || '';
              const urlParts = href.split('/').filter(Boolean);
              if (urlParts.length === 2 && urlParts[0] === 'series') {
                const path = href.replace(/^https?:\/\/[^/]+/, '');
                let name = $el.text().trim();
                if (!name)
                  name = $el
                    .closest('.series-card, .card, .item')
                    .find('h2, h3, .title')
                    .first()
                    .text()
                    .trim();
                if (!name) return;
                let cover = defaultCover;
                const img = $el.find('img').first();
                if (img && img.attr) {
                  const src = img.attr('data-src') || img.attr('src');
                  if (src)
                    cover = src.startsWith('http')
                      ? src
                      : this.site + (src.startsWith('/') ? src : '/' + src);
                }
                if (!novels.find(n => n.path === path))
                  novels.push({ name, path, cover });
              }
            } catch {
              // ignore
            }
          });
          if (novels.length) return novels;
        }
      } catch {
        // try next search endpoint
      }
    }

    return novels;
  }

  // -----------------------------
  // PARSE NOVEL + CHAPTER LIST
  // -----------------------------
  // Use API releases endpoint when possible; fallback to scanning page for chapter links.
  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: 'Untitled',
      cover: defaultCover,
      chapters: [],
    };

    try {
      const novelUrl = this.resolveUrl(novelPath, true);
      const pageRes = await fetchApi(novelUrl, {
        headers: { Referer: this.site },
      });
      const pageHtml = await pageRes.text();
      const $page = loadCheerio(pageHtml);

      // Title
      const title =
        $page('h1.series-title').first().text().trim() ||
        $page('h1').first().text().trim() ||
        $page('meta[property="og:title"]').attr('content') ||
        '';
      if (title) novel.name = title;

      // Cover: try meta og:image, specific selectors, then the first img
      let cover = $page('meta[property="og:image"]').attr('content') || '';
      if (!cover) {
        cover =
          $page('.series-cover img').attr('src') ||
          $page('.cover img').attr('src') ||
          $page('img').first().attr('src') ||
          '';
      }
      if (cover) {
        novel.cover = cover.startsWith('http')
          ? cover
          : this.site + (cover.startsWith('/') ? cover : '/' + cover);
      }

      // Summary / author / genres (best-effort)
      const summary =
        $page('.series-summary').text().trim() ||
        $page('.synopsis').text().trim() ||
        $page('.description').text().trim() ||
        '';
      if (summary) novel.summary = summary;

      const author = $page("a[href*='author'], .author, [class*='author']")
        .first()
        .text()
        .trim();
      if (author) novel.author = author;

      const genres: string[] = [];
      $page('[class*="tag"], a[href*="/tag/"], .genre').each((i, el) => {
        const t = $page(el).text().trim();
        if (t) genres.push(t);
      });
      if (genres.length) novel.genres = genres.join(', ');

      // 1) Try known API: earlier we saw readhive returns a releases JSON
      const seriesIdMatch = novelPath.match(/\/?series\/?(\d+)\/?/);
      let chapters: Plugin.ChapterItem[] = [];

      if (seriesIdMatch) {
        const seriesId = seriesIdMatch[1];

        // Candidate release endpoints that some variations use:
        const possibleReleaseUrls = [
          `${this.site}/api/series/${seriesId}/releases`,
          `${this.site}/api/series/${seriesId}/releases/`,
          `${this.site}/api/series/${seriesId}/chapters`,
          `${this.site}/series/${seriesId}/ajax/chapters/`, // older pattern
          `${this.site}/series/${seriesId}/releases`, // raw path
        ];

        for (const relUrl of possibleReleaseUrls) {
          try {
            const relRes = await fetchApi(relUrl, {
              headers: { Referer: novelUrl },
            });
            if (!relRes.ok) continue;
            const relText = await relRes.text();
            // Parse JSON if possible
            try {
              const relJson = JSON.parse(relText);
              const arr = Array.isArray(relJson.data)
                ? relJson.data
                : Array.isArray(relJson)
                  ? relJson
                  : relJson.items || null;
              if (arr && arr.length) {
                for (const it of arr) {
                  // entry might contain title and url like you pasted earlier
                  const rawTitle =
                    (it.title && (it.title.rendered || it.title)) ||
                    it.title ||
                    it.name ||
                    '';
                  const rawUrl = it.url || it.link || it.path || '';
                  if (!rawUrl) continue;
                  const path = rawUrl.replace(/^https?:\/\/[^/]+/, '');
                  // Extract chapter number (supports decimals)
                  let chapterNumber = 0;
                  const m =
                    rawTitle.match(/Chapter\s*([\d.]+)/i) ||
                    rawUrl.match(/\/v\d+\/([\d.]+)/) ||
                    rawUrl.match(/\/series\/\d+\/(\d+(?:\.\d+)?)/);
                  if (m) chapterNumber = parseFloat(m[1]);
                  const name =
                    rawTitle || `Chapter ${chapterNumber || ''}`.trim();

                  chapters.push({
                    name,
                    path,
                    releaseTime: it.date || it.release_time || '',
                    chapterNumber: chapterNumber || 0,
                  });
                }
                // break if we got chapters
                if (chapters.length) break;
              }
            } catch {
              // not json: some endpoints respond with HTML (like WordPress AJAX); try to load it
              const $rel = loadCheerio(relText);
              // find anchors with /series/{id}/v... or /series/{id}/{chapter}
              $rel('a[href*="/series/"]').each((i, el) => {
                const href = $rel(el).attr('href') || '';
                const text = $rel(el).text().trim();
                const urlParts = href.split('/').filter(Boolean);
                if (urlParts.length > 2) {
                  const path = href.replace(/^https?:\/\/[^/]+/, '');
                  // parse chapter number
                  let chapterNumber = 0;
                  const m =
                    text.match(/Chapter\s*([\d.]+)/i) ||
                    href.match(/\/v\d+\/([\d.]+)/) ||
                    href.match(/\/series\/\d+\/(\d+(?:\.\d+)?)/);
                  if (m) chapterNumber = parseFloat(m[1]);
                  chapters.push({
                    name: text || `Chapter ${chapterNumber || ''}`.trim(),
                    path,
                    releaseTime: '',
                    chapterNumber: chapterNumber || 0,
                  });
                }
              });
              if (chapters.length) break;
            }
          } catch {
            // ignore and try next possibleReleaseUrls
          }
        }
      }

      // 2) Fallback: scan current page HTML for chapter links in #releases or similar
      if (chapters.length === 0) {
        const releaseSelectors = [
          '#releases a',
          '.releases a',
          '.chapter-list a',
          '.chapters a',
          'a[href*="/series/"]',
        ];
        const found = new Map<string, Plugin.ChapterItem>();
        for (const sel of releaseSelectors) {
          $page(sel).each((i, el) => {
            try {
              const $el = $page(el);
              const href = $el.attr('href') || '';
              if (!href) return;
              const urlParts = href.split('/').filter(Boolean);
              // require that this is a chapter link (more than just /series/{id})
              if (urlParts.length <= 2) return;
              const path = href.replace(/^https?:\/\/[^/]+/, '');
              // text could be "Vol. 1 Chapter 1.1 - Title"
              const raw = $el.text().trim();
              const m =
                raw.match(/Chapter\s*([\d.]+)/i) ||
                href.match(/\/v\d+\/([\d.]+)/) ||
                href.match(/\/series\/\d+\/(\d+(?:\.\d+)?)/);
              const chapterNumber = m ? parseFloat(m[1]) : 0;
              const name = raw || `Chapter ${chapterNumber || ''}`.trim();
              if (!found.has(path)) {
                found.set(path, {
                  name,
                  path,
                  releaseTime: '',
                  chapterNumber: chapterNumber || 0,
                });
              }
            } catch {
              // ignore
            }
          });
          if (found.size) break;
        }
        chapters = Array.from(found.values());
      }

      // Deduplicate by path
      const unique: Plugin.ChapterItem[] = [];
      for (const ch of chapters) {
        if (!unique.find(u => u.path === ch.path)) unique.push(ch);
      }

      // Sort by chapterNumber (handle decimals) but keep unknowns last
      unique.sort((a, b) => {
        const an =
          typeof a.chapterNumber === 'number'
            ? a.chapterNumber
            : parseFloat(String(a.chapterNumber) || '0');
        const bn =
          typeof b.chapterNumber === 'number'
            ? b.chapterNumber
            : parseFloat(String(b.chapterNumber) || '0');
        return (isNaN(an) ? 1 : 0) - (isNaN(bn) ? 1 : 0) || an - bn;
      });

      novel.chapters = unique;
      // final fallbacks for status
      novel.status = novel.status || NovelStatus.Ongoing;
    } catch (err) {
      console.error('ReadHive parseNovel error:', err);
    }

    return novel;
  }

  // -----------------------------
  // PARSE CHAPTER (content)
  // -----------------------------
  // Your environment already reads chapters fine — this is robust and similar to what worked before.
  async parseChapter(chapterPath: string): Promise<string> {
    try {
      const chapterUrl = this.resolveUrl(chapterPath);
      const res = await fetchApi(chapterUrl, {
        headers: { Referer: this.site },
      });
      const body = await res.text();
      const $ = loadCheerio(body);

      // Remove common noise
      $(
        'nav, header, footer, .nav, .menu, .sidebar, .ads, .advertisement',
      ).remove();

      // Try common content selectors (ReadHive/nuxt-built sites often use one of these)
      const contentSelectors = [
        '.chapter-content',
        '.reading-content',
        '.entry-content',
        '.reader-content',
        '.content',
        'article',
        'main',
      ];

      let contentHtml = '';
      for (const sel of contentSelectors) {
        const el = $(sel).first();
        if (el && el.length && el.text().trim().length > 50) {
          contentHtml = el.html() || '';
          break;
        }
      }

      // If still empty, pick the largest div/section by text length
      if (!contentHtml) {
        let maxLen = 0;
        $('div, section, article').each((i, el) => {
          const txt = $(el).text() || '';
          if (txt.length > maxLen) {
            maxLen = txt.length;
            contentHtml = $(el).html() || '';
          }
        });
      }

      // Fix image src attributes to absolute urls if needed
      const content$ = loadCheerio(contentHtml || '');
      content$('img').each((i, el) => {
        const src = content$(el).attr('src') || content$(el).attr('data-src');
        if (src && !src.startsWith('http')) {
          content$(el).attr(
            'src',
            this.site + (src.startsWith('/') ? src : '/' + src),
          );
        }
      });

      return (
        content$.html() || contentHtml || '<p>Chapter content not found</p>'
      );
    } catch (err) {
      console.error('ReadHive parseChapter error:', err);
      return '<p>Error loading chapter</p>';
    }
  }
}

export default new ReadHivePlugin();
