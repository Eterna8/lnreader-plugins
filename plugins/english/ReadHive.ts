import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

class ReadHivePlugin implements Plugin.PluginBase {
  id = 'readhive';
  name = 'ReadHive';
  icon = 'src/en/readhive/icon.png';
  site = 'https://readhive.org';
  version = '1.0.9';
  filters: Filters | undefined = undefined;

  imageRequestInit: Plugin.ImageRequestInit = {
    headers: {
      Referer: 'https://readhive.org/',
    },
  };

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];

    try {
      const html = await fetchApi(this.site, {
        headers: { Referer: this.site },
      });
      const $ = loadCheerio(html);

      // Find all series links - these are NOVEL pages, not chapter pages
      $('a[href*="/series/"]').each((i, elem) => {
        const $elem = $(elem);
        const href = $elem.attr('href');

        if (!href) return;

        // CRITICAL: Only get series pages, NOT chapter pages
        // Series pages are like: /series/44854
        // Chapter pages are like: /series/44854/v1/1.1
        const urlParts = href.split('/').filter(p => p);

        // A novel URL should have exactly 2 parts: "series" and the ID number
        // Example: ["series", "44854"]
        if (urlParts.length !== 2 || urlParts[0] !== 'series') {
          return; // Skip chapter links
        }

        // Get the title
        let name = $elem.text().trim();
        if (!name || name.toLowerCase().includes('chapter')) {
          // If the link text looks like a chapter, try to get from image alt
          name = $elem.find('img').attr('alt') || '';
        }

        // Skip if it still looks like a chapter name
        if (
          name.toLowerCase().includes('chapter') ||
          name.match(/vol\.\s*\d/i)
        ) {
          return;
        }

        // Get the cover image
        const $img = $elem.find('img');
        let cover = $img.attr('src') || defaultCover;
        if (cover && !cover.startsWith('http')) {
          cover = this.site + cover;
        }

        const url = href.startsWith('http') ? href : this.site + href;

        // Only add if we have a valid name
        if (name && url) {
          // Check if already added (avoid duplicates)
          if (!novels.find(n => n.url === url)) {
            novels.push({ name, url, cover });
          }
        }
      });
    } catch (error) {
      console.error('Error fetching popular novels:', error);
    }

    return novels;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const novels: Plugin.NovelItem[] = [];

    try {
      const searchUrl = `${this.site}/search?q=${encodeURIComponent(searchTerm)}`;
      const html = await fetchApi(searchUrl, {
        headers: { Referer: this.site },
      });
      const $ = loadCheerio(html);

      // Same logic as popularNovels - only get NOVEL pages, not chapters
      $('a[href*="/series/"]').each((i, elem) => {
        const $elem = $(elem);
        const href = $elem.attr('href');

        if (!href) return;

        // CRITICAL: Filter out chapter links
        const urlParts = href.split('/').filter(p => p);

        // Only accept novel URLs like /series/44854
        if (urlParts.length !== 2 || urlParts[0] !== 'series') {
          return; // Skip chapter links
        }

        let name = $elem.text().trim();
        if (!name || name.toLowerCase().includes('chapter')) {
          name = $elem.find('img').attr('alt') || '';
        }

        // Skip chapter-like names
        if (
          name.toLowerCase().includes('chapter') ||
          name.match(/vol\.\s*\d/i)
        ) {
          return;
        }

        const $img = $elem.find('img');
        let cover = $img.attr('src') || defaultCover;
        if (cover && !cover.startsWith('http')) {
          cover = this.site + cover;
        }

        const url = href.startsWith('http') ? href : this.site + href;

        if (name && url) {
          if (!novels.find(n => n.url === url)) {
            novels.push({ name, url, cover });
          }
        }
      });
    } catch (error) {
      console.error('Error searching novels:', error);
    }

    return novels;
  }

  async parseNovelAndChapters(novelUrl: string): Promise<Plugin.SourceNovel> {
    const novel: Plugin.SourceNovel = {
      url: novelUrl,
      name: 'Untitled',
      cover: defaultCover,
      chapters: [],
    };

    try {
      const html = await fetchApi(novelUrl, {
        headers: { Referer: this.site },
      });
      const $ = loadCheerio(html);

      // Get the title
      novel.name =
        $('h1, .title').first().text().trim() ||
        $('meta[property="og:title"]').attr('content') ||
        'Untitled';

      // Get the cover
      let coverSrc = $('img').first().attr('src') || defaultCover;
      if (!coverSrc.startsWith('http') && coverSrc !== defaultCover) {
        coverSrc = this.site + coverSrc;
      }
      novel.cover = coverSrc;

      // Get author, summary, etc.
      novel.author =
        $('.author, [class*="author"]').first().text().trim() || 'Unknown';
      novel.summary =
        $('.synopsis, [class*="synopsis"], .description')
          .first()
          .text()
          .trim() || '';

      const genres: string[] = [];
      $('[class*="tag"], .genre').each((i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });
      novel.genres = genres.join(', ');

      novel.status = NovelStatus.Ongoing;

      // Parse chapters from the page
      const chapters: Plugin.ChapterItem[] = [];

      // Look for chapter links in the Table of Contents section
      $('a[href*="/series/"]').each((i, elem) => {
        const $elem = $(elem);
        const href = $elem.attr('href');

        if (!href) return;

        // Chapter links should have more than 2 path segments
        // Example: /series/44854/v1/1.1 has 4 segments
        const urlParts = href.split('/').filter(p => p);

        // Must be a chapter link (more than just /series/ID)
        if (urlParts.length <= 2) {
          return; // Skip novel links
        }

        const name = $elem.text().trim();
        if (!name) return;

        // Make sure it looks like a chapter
        if (
          !name.toLowerCase().includes('chapter') &&
          !name.match(/vol\.\s*\d/i) &&
          !name.match(/^\d+/)
        ) {
          return;
        }

        const url = href.startsWith('http') ? href : this.site + href;

        // Extract chapter number from the name or URL
        let chapterNumber = 0;

        // Try multiple patterns
        const chapterMatch = name.match(/Chapter\s+([\d.]+)/i);
        const urlMatch = href.match(/\/v\d+\/([\d.]+)/);
        const numberMatch = name.match(/^([\d.]+)/);

        if (chapterMatch) {
          chapterNumber = parseFloat(chapterMatch[1]);
        } else if (urlMatch) {
          chapterNumber = parseFloat(urlMatch[1]);
        } else if (numberMatch) {
          chapterNumber = parseFloat(numberMatch[1]);
        } else {
          chapterNumber = i + 1;
        }

        // Get release time if available
        const releaseTime =
          $elem
            .closest('div, li, tr')
            .find('[class*="time"], [class*="date"]')
            .first()
            .text()
            .trim() || '';

        chapters.push({
          name,
          url,
          releaseTime,
          chapterNumber,
        });
      });

      // Remove duplicates based on URL
      const uniqueChapters = chapters.filter(
        (chapter, index, self) =>
          index === self.findIndex(c => c.url === chapter.url),
      );

      // Sort chapters by chapter number
      uniqueChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
      novel.chapters = uniqueChapters;
    } catch (error) {
      console.error('Error parsing novel:', error);
    }

    return novel;
  }

  async parseChapter(chapterUrl: string): Promise<string> {
    try {
      const html = await fetchApi(chapterUrl, {
        headers: { Referer: this.site },
      });
      const $ = loadCheerio(html);

      // ReadHive stores chapter text in <p> tags within the main content
      // Remove navigation, headers, and footers first
      $('nav, header, footer, .nav, .menu, .sidebar').remove();

      // Try to find the main content container
      let chapterText =
        $('article').html() ||
        $('main').html() ||
        $('.content').html() ||
        $('#content').html() ||
        '';

      // Fallback: find the element with the most <p> tags (chapter content)
      if (!chapterText || chapterText.length < 500) {
        let maxParagraphs = 0;
        let bestContent = '';

        $('div').each((i, elem) => {
          const $elem = $(elem);
          const paragraphCount = $elem.find('p').length;
          const html = $elem.html() || '';

          // Look for divs with multiple paragraphs and substantial content
          if (paragraphCount > maxParagraphs && html.length > 1000) {
            maxParagraphs = paragraphCount;
            bestContent = html;
          }
        });

        chapterText = bestContent;
      }

      return chapterText || '<p>Chapter content not found</p>';
    } catch (error) {
      console.error('Error parsing chapter:', error);
      return '<p>Error loading chapter</p>';
    }
  }
}

export default new ReadHivePlugin();
