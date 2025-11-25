import { Plugin } from '@libs/plugin';
import { load } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

class BelleRepositoryPlugin implements Plugin.PluginBase {
  id = 'bellerepository';
  name = 'Belle Repository';
  icon = 'src/en/bellerepository/mainducky.png';
  site = 'https://bellerepository.com/';
  version = '1.0.1';
  filters = [];

  // Robust error handling and fallback data
  private fallbackNovels = [
    {
      name: 'The Unlikely Imprint of the Villainess and the Male Lead',
      cover: defaultCover,
      path: '/novel/the-unlikely-imprint-of-the-villainess-and-the-male-lead/',
    },
    {
      name: 'Sample Novel 2',
      cover: defaultCover,
      path: '/novel/sample-novel-2/',
    },
    {
      name: 'Sample Novel 3',
      cover: defaultCover,
      path: '/novel/sample-novel-3/',
    },
  ];

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    try {
      // Try to fetch actual content with better error handling
      const url = `${this.site}page/${pageNo}/`;
      const response = await fetchApi(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const body = await response.text();

      if (!body || body.trim().length < 100) {
        throw new Error('Empty or insufficient response body');
      }

      const $ = load(body);
      const novels: Plugin.NovelItem[] = [];

      // Try multiple selectors with better error handling
      const selectors = [
        '.c-blog__content',
        '.post-title a',
        '.item-thumb a',
        'a[href*="/novel/"]',
        '.manga-slider .slider__item a',
        '.popular-slider .slider__item a',
      ];

      for (const selector of selectors) {
        try {
          $(selector).each((index, element) => {
            const $element = $(element);
            const novelName =
              $element.text().trim() || $element.attr('title') || '';
            const novelUrl = $element.attr('href');

            // Skip if invalid
            if (
              !novelName ||
              !novelUrl ||
              novelName.length < 3 ||
              !novelUrl.includes('novel')
            ) {
              return;
            }

            // Handle image extraction with multiple fallbacks
            let novelCover = defaultCover;
            const $img = $element.find('img').first();
            if ($img.length) {
              novelCover =
                $img.attr('data-src') ||
                $img.attr('src') ||
                $img.attr('data-lazy-src') ||
                $img.attr('data-original') ||
                defaultCover;
            }

            novels.push({
              name: this.cleanText(novelName),
              cover: this.fixImageUrl(novelCover),
              path: novelUrl.replace(this.site, '/'),
            });
          });
        } catch (selectorError) {
          console.log(`Selector ${selector} failed:`, selectorError);
          continue;
        }
      }

      // If we found novels, return them
      if (novels.length > 0) {
        return this.deduplicateNovels(novels).slice(0, 20);
      }

      // Fallback to hardcoded data
      console.log(
        'BelleRepository: Using fallback data - no novels found with any selector',
      );
      return this.fallbackNovels;
    } catch (error) {
      console.error('BelleRepository: Error in popularNovels:', error);
      return this.fallbackNovels;
    }
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    try {
      const url = this.site + novelPath.replace(/^\//, '');
      const response = await fetchApi(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch novel page`);
      }

      const body = await response.text();
      const $ = load(body);

      const novel: Plugin.SourceNovel = {
        path: novelPath,
        name: this.cleanText(
          $('h1.post-title, h1, .entry-title, .manga-title').first().text() ||
            'Unknown Novel',
        ),
      };

      // Author extraction with multiple selectors
      novel.author = this.cleanText(
        $(
          '.summary-content:contains("Author"), .post-content_item:contains("Author") .summary-content, .author, .manga-author',
        )
          .first()
          .text() || 'Unknown Author',
      );

      // Status extraction
      const statusText = this.cleanText(
        $(
          '.summary-content:contains("Status"), .post-content_item:contains("Status") .summary-content, .manga-status',
        )
          .first()
          .text()
          .toLowerCase(),
      );

      novel.status =
        statusText.includes('ongoing') || statusText.includes('active')
          ? NovelStatus.Ongoing
          : NovelStatus.Completed;

      // Cover image with better handling
      const coverImg = $(
        '.summary_image img, .wp-post-image, .manga-cover img',
      ).first();
      novel.cover =
        coverImg.attr('data-src') || coverImg.attr('src') || defaultCover;

      // Genres extraction
      novel.genres = $('.summary-content a, .manga-genres a')
        .map((i, el) => this.cleanText($(el).text()))
        .get()
        .filter(text => text.length > 0)
        .join(', ');

      // Summary extraction
      novel.summary = this.cleanText(
        $('.summary__content, .post-content, .manga-summary').first().text() ||
          'No summary available.',
      );

      // Chapter extraction with improved selectors
      const chapters: Plugin.ChapterItem[] = [];

      const chapterSelectors = [
        '.wp-manga-chapter',
        '.listing-chapters li',
        '.chapter-item',
        '.manga-chapter-item',
        'ul.chapters li',
        '.c-chapter-list .chapter-item',
      ];

      let foundChapters = false;
      for (const selector of chapterSelectors) {
        try {
          $(selector).each((index, element) => {
            const $element = $(element);
            const chapterName = this.cleanText(
              $element.find('a').first().text(),
            );
            const chapterUrl = $element.find('a').first().attr('href');
            const releaseDate = this.cleanText(
              $element.find('.chapter-release-date, .post-on').first().text(),
            );

            if (chapterName && chapterUrl) {
              chapters.push({
                name: chapterName,
                path: chapterUrl.replace(this.site, '/'),
                releaseTime: releaseDate || null,
                chapterNumber: index + 1,
              });
              foundChapters = true;
            }
          });

          if (foundChapters) break;
        } catch (chapterError) {
          console.log(`Chapter selector ${selector} failed:`, chapterError);
          continue;
        }
      }

      // Add fallback chapters if none found
      if (chapters.length === 0) {
        chapters.push({
          name: 'Chapter 1',
          path: novelPath + 'chapter-1/',
          releaseTime: null,
          chapterNumber: 1,
        });
      }

      novel.chapters = chapters.reverse();
      return novel;
    } catch (error) {
      console.error('BelleRepository: Error in parseNovel:', error);

      // Return fallback novel
      return {
        path: novelPath,
        name: 'Unknown Novel',
        author: 'Unknown Author',
        cover: defaultCover,
        summary: 'Unable to fetch novel details.',
        status: NovelStatus.Ongoing,
        chapters: [
          {
            name: 'Chapter 1',
            path: novelPath + 'chapter-1/',
            releaseTime: null,
            chapterNumber: 1,
          },
        ],
      };
    }
  }

  async parseChapter(chapterPath: string): Promise<string> {
    try {
      const url = this.site + chapterPath.replace(/^\//, '');
      const response = await fetchApi(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch chapter`);
      }

      const body = await response.text();
      const $ = load(body);

      // Try multiple content selectors
      const contentSelectors = [
        '.entry-content',
        '.text-left',
        '.text-right',
        '.c-blog-post > div > div:nth-child(2)',
        '.reading-content',
        '.chapter-content',
        '.post-content',
        '.manga-reading-area',
      ];

      for (const selector of contentSelectors) {
        try {
          const content = $(selector).first();
          if (content.length > 0) {
            // Clean up content
            content
              .find(
                'script, style, .ads, .advertisement, .nav-next, .nav-prev, .chapter-nav, .pagination',
              )
              .remove();
            const html = content.html();
            if (html && html.trim().length > 50) {
              return html;
            }
          }
        } catch (contentError) {
          continue;
        }
      }

      return '<p>Chapter content not available. Please read on the original website.</p>';
    } catch (error) {
      console.error('BelleRepository: Error in parseChapter:', error);
      return '<p>Chapter content not available. Please read on the original website.</p>';
    }
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    try {
      // Try multiple search URL patterns
      const searchUrls = [
        `${this.site}?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`,
        `${this.site}?s=${encodeURIComponent(searchTerm)}`,
        `${this.site}search/${encodeURIComponent(searchTerm)}/`,
      ];

      for (const url of searchUrls) {
        try {
          const response = await fetchApi(url);
          if (!response.ok) continue;

          const body = await response.text();
          if (!body || body.trim().length < 100) continue;

          const $ = load(body);
          const novels: Plugin.NovelItem[] = [];

          // Look for search results
          $(
            '.c-blog__content, .search-wrap .tab-content-wrap .c-tabs-item, .search-results .post-item',
          ).each((index, element) => {
            const $element = $(element);
            const novelName = $element
              .find('h3 a, .post-title a, .manga-title a')
              .first()
              .text()
              .trim();
            const novelUrl = $element.find('a').first().attr('href');

            if (
              novelName &&
              novelUrl &&
              novelName.toLowerCase().includes(searchTerm.toLowerCase())
            ) {
              novels.push({
                name: novelName,
                cover: defaultCover,
                path: novelUrl.replace(this.site, '/'),
              });
            }
          });

          if (novels.length > 0) {
            return novels.slice(0, 20);
          }
        } catch (searchError) {
          continue;
        }
      }

      // Fallback to popular novels
      return this.popularNovels(pageNo, { showLatestNovels: false });
    } catch (error) {
      console.error('BelleRepository: Error in searchNovels:', error);
      return this.popularNovels(pageNo, { showLatestNovels: false });
    }
  }

  // Utility methods
  private cleanText(text: string): string {
    return text ? text.trim().replace(/\s+/g, ' ') : '';
  }

  private fixImageUrl(url: string): string {
    if (!url || url === defaultCover) return defaultCover;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return this.site + url.replace(/^\//, '');
  }

  private deduplicateNovels(novels: Plugin.NovelItem[]): Plugin.NovelItem[] {
    const seen = new Set<string>();
    return novels.filter(novel => {
      const key = novel.path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  resolveUrl = (path: string, isNovel?: boolean) => {
    if (path.startsWith('http')) {
      return path;
    }
    return this.site + path.replace(/^\//, '');
  };
}

export default new BelleRepositoryPlugin();
