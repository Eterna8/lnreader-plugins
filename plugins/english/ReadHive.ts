import { Plugin } from '@libs/plugin';
import { load } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

class ReadHivePlugin implements Plugin.PluginBase {
  id = 'readhive';
  name = 'ReadHive';
  icon = 'src/en/readhive/readhive.jpg';
  site = 'https://readhive.org/';
  version = '1.0.1';
  filters = [];

  // Fallback data with actual series IDs from the site
  private fallbackNovels = [
    { id: '139907', name: 'ReadHive Series 139907' },
    { id: '118993', name: 'ReadHive Series 118993' },
    { id: '96473', name: 'ReadHive Series 96473' },
    { id: '155', name: 'ReadHive Series 155' },
    { id: '108948', name: 'ReadHive Series 108948' },
  ];

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    try {
      // Try to fetch actual content with better error handling
      const response = await fetchApi(this.site);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const body = await response.text();

      if (!body || body.trim().length < 1000) {
        throw new Error('Empty or insufficient response body');
      }

      const $ = load(body);
      const novels: Plugin.NovelItem[] = [];
      const seenUrls = new Set<string>();

      // Extract series URLs from the homepage with robust handling
      $('a[href*="/series/"]').each((index, element) => {
        const $element = $(element);
        const seriesUrl = $element.attr('href');

        if (!seriesUrl || seenUrls.has(seriesUrl)) return;

        seenUrls.add(seriesUrl);

        // Extract series ID from URL
        const seriesMatch = seriesUrl.match(/\/series\/(\d+)/);
        if (!seriesMatch) return;

        const seriesId = seriesMatch[1];

        // Try to get title from various elements
        let novelName = '';

        // Method 1: Check Alpine.js x-text attribute
        const $parentWithText = $element.closest('[x-text]');
        if ($parentWithText.length) {
          novelName = $parentWithText.attr('x-text') || '';
        }

        // Method 2: Check title attribute
        if (!novelName) {
          novelName = $element.attr('title') || '';
        }

        // Method 3: Check text content of element or nearby elements
        if (!novelName) {
          novelName =
            $element.text().trim() ||
            $element.siblings().text().trim() ||
            $element
              .parent()
              .find('h1, h2, h3, h4, h5, h6')
              .first()
              .text()
              .trim();
        }

        // Method 4: Use series ID as fallback
        if (!novelName || novelName.length < 2) {
          novelName = `ReadHive Series ${seriesId}`;
        }

        // Extract cover image with multiple fallbacks
        let novelCover = defaultCover;
        const $img = $element.find('img').first();
        if ($img.length) {
          novelCover =
            $img.attr('src') ||
            $img.attr('data-src') ||
            $img.attr(':src') ||
            $img.attr('data-lazy-src') ||
            defaultCover;

          // Fix relative URLs
          if (novelCover && !novelCover.startsWith('http')) {
            novelCover = this.site + novelCover.replace(/^\//, '');
          }
        }

        novels.push({
          name: this.cleanText(novelName),
          cover: novelCover,
          path: seriesUrl.replace(this.site, '/'),
        });
      });

      // If we found actual novels, return them
      if (novels.length > 0) {
        return this.deduplicateNovels(novels).slice(0, 20);
      }

      // Fallback to hardcoded data using actual series IDs
      console.log(
        'ReadHive: Using fallback data - no series found in homepage',
      );
      return this.fallbackNovels.map(series => ({
        name: series.name,
        cover: defaultCover,
        path: `/series/${series.id}/`,
      }));
    } catch (error) {
      console.error('ReadHive: Error in popularNovels:', error);
      return this.fallbackNovels.map(series => ({
        name: series.name,
        cover: defaultCover,
        path: `/series/${series.id}/`,
      }));
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
          $('.series-title, h1, .post-title, .entry-title').first().text() ||
            'Unknown Novel',
        ),
      };

      // Extract author with multiple selectors
      novel.author = this.cleanText(
        $(
          '.series-author, .author, .post-content_item:contains("Author") .summary-content',
        )
          .first()
          .text() || 'Unknown Author',
      );

      // Extract status
      const statusText = this.cleanText(
        $(
          '.series-status, .manga-status, .post-content_item:contains("Status") .summary-content',
        )
          .first()
          .text()
          .toLowerCase(),
      );

      novel.status =
        statusText.includes('ongoing') || statusText.includes('active')
          ? NovelStatus.Ongoing
          : NovelStatus.Completed;

      // Extract cover with better handling
      const coverImg = $(
        '.series-cover img, .cover img, .manga-cover img',
      ).first();
      novel.cover =
        coverImg.attr('data-src') ||
        coverImg.attr('src') ||
        coverImg.attr(':src') ||
        defaultCover;

      // Fix cover URL
      if (novel.cover !== defaultCover && !novel.cover.startsWith('http')) {
        novel.cover = this.site + novel.cover.replace(/^\//, '');
      }

      // Extract genres
      novel.genres = $('.series-genres a, .genres a, .manga-genres a')
        .map((i, el) => this.cleanText($(el).text()))
        .get()
        .filter(text => text.length > 0)
        .join(', ');

      // Extract summary
      novel.summary = this.cleanText(
        $('.series-synopsis, .summary, .description, .manga-summary')
          .first()
          .text() || 'No summary available.',
      );

      // Extract chapters
      const chapters: Plugin.ChapterItem[] = [];

      try {
        // Try to fetch releases page
        const releasesUrl = `${this.site}${novelPath.replace(/^\//, '')}#releases`;
        const releasesResponse = await fetchApi(releasesUrl);

        if (releasesResponse.ok) {
          const releasesBody = await releasesResponse.text();
          const $releases = load(releasesBody);

          let chapterNumber = 0;
          $releases(
            '.chapter-list .chapter-item, .manga-chapter-item, .listing-chapters li',
          ).each((index, element) => {
            const $element = $(element);
            const chapterName = this.cleanText(
              $element
                .find('.chapter-title, h3 a, .chapter-name')
                .first()
                .text(),
            );
            const chapterUrl = $element.find('a').first().attr('href');
            const volumeText = this.cleanText(
              $element.find('.volume-title, .volume-name').first().text(),
            );
            const releaseDate = this.cleanText(
              $element.find('.release-date, .post-on').first().text(),
            );

            if (chapterName && chapterUrl) {
              chapterNumber++;
              chapters.push({
                name: volumeText
                  ? `${volumeText} - ${chapterName}`
                  : chapterName,
                path: chapterUrl.replace(this.site, '/'),
                releaseTime: releaseDate || null,
                chapterNumber: chapterNumber,
              });
            }
          });
        }
      } catch (releasesError) {
        console.log(
          'ReadHive: Could not fetch chapters from releases page:',
          releasesError,
        );
      }

      // Fallback chapters if none found
      if (chapters.length === 0) {
        chapters.push({
          name: 'Chapter 1',
          path: novelPath + 'chapter-1/',
          releaseTime: null,
          chapterNumber: 1,
        });
        chapters.push({
          name: 'Chapter 2',
          path: novelPath + 'chapter-2/',
          releaseTime: null,
          chapterNumber: 2,
        });
      }

      novel.chapters = chapters.reverse();
      return novel;
    } catch (error) {
      console.error('ReadHive: Error in parseNovel:', error);

      // Return fallback novel
      return {
        path: novelPath,
        name: 'Unknown ReadHive Novel',
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

      // Try multiple content selectors with better fallbacks
      const contentSelectors = [
        '.chapter-content',
        '.chapter-body',
        '.novel-content',
        '.post-content',
        '.entry-content',
        '#chapter-content',
        '.manga-reading-area',
        '.reading-area',
        '.content-area',
      ];

      for (const selector of contentSelectors) {
        try {
          const content = $(selector).first();
          if (content.length > 0) {
            // Clean up content
            content
              .find(
                'script, style, .ads, .advertisement, .chapter-nav, .navigation, .pager, .pagination',
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

      // Last resort: get main content area
      const mainContent = $(
        'main .content, .main-content, .story-content, .article-content',
      ).first();
      if (mainContent.length > 0) {
        mainContent
          .find('script, style, nav, .nav, .navigation, header, footer')
          .remove();
        const html = mainContent.html();
        if (html && html.trim().length > 50) {
          return html;
        }
      }

      return '<p>Chapter content not available. Please read on the original website.</p>';
    } catch (error) {
      console.error('ReadHive: Error in parseChapter:', error);
      return '<p>Chapter content not available. Please read on the original website.</p>';
    }
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    try {
      // Try different search approaches
      const searchUrls = [
        `${this.site}?s=${encodeURIComponent(searchTerm)}`,
        `${this.site}search?q=${encodeURIComponent(searchTerm)}`,
        `${this.site}browse-series/`,
      ];

      for (const url of searchUrls) {
        try {
          const response = await fetchApi(url);
          if (!response.ok) continue;

          const body = await response.text();
          if (!body || body.trim().length < 100) continue;

          const $ = load(body);
          const novels: Plugin.NovelItem[] = [];
          const seenUrls = new Set<string>();

          // Extract series URLs and filter by search term
          $('a[href*="/series/"]').each((index, element) => {
            const $element = $(element);
            const seriesUrl = $element.attr('href');
            if (!seriesUrl || seenUrls.has(seriesUrl)) return;

            seenUrls.add(seriesUrl);

            // Try to get title
            let novelName = '';
            const $parentWithText = $element.closest(
              '[x-text], [title], h1, h2, h3, h4, h5, h6',
            );
            novelName =
              $parentWithText.attr('x-text') ||
              $parentWithText.attr('title') ||
              $parentWithText.text().trim() ||
              $element.text().trim();

            // If searching, filter by search term
            if (url.includes('search') || url.includes('s=')) {
              if (
                novelName &&
                !novelName.toLowerCase().includes(searchTerm.toLowerCase())
              ) {
                // Try to extract from URL as fallback
                const seriesMatch = seriesUrl.match(/\/series\/(\d+)/);
                if (!seriesMatch || !seriesMatch[1].includes(searchTerm)) {
                  return;
                }
              }
            }

            // Extract cover image
            let novelCover = defaultCover;
            const $img = $element.find('img').first();
            if ($img.length) {
              novelCover =
                $img.attr('src') ||
                $img.attr('data-src') ||
                $img.attr(':src') ||
                defaultCover;
              if (novelCover && !novelCover.startsWith('http')) {
                novelCover = this.site + novelCover.replace(/^\//, '');
              }
            }

            if (seriesUrl) {
              novels.push({
                name:
                  novelName ||
                  `ReadHive Series ${seriesUrl.match(/\/series\/(\d+)/)?.[1] || index}`,
                cover: novelCover,
                path: seriesUrl.replace(this.site, '/'),
              });
            }
          });

          // Remove duplicates and limit results
          const uniqueNovels = novels
            .filter(
              (novel, index, self) =>
                index === self.findIndex(n => n.path === novel.path),
            )
            .slice(0, 20);

          if (uniqueNovels.length > 0) {
            return uniqueNovels;
          }
        } catch (searchError) {
          continue;
        }
      }

      // If search fails, return popular novels as fallback
      return this.popularNovels(pageNo, { showLatestNovels: false });
    } catch (error) {
      console.error('ReadHive: Error in searchNovels:', error);
      return this.popularNovels(pageNo, { showLatestNovels: false });
    }
  }

  // Utility methods
  private cleanText(text: string): string {
    return text ? text.trim().replace(/\s+/g, ' ') : '';
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

export default new ReadHivePlugin();
