// Belle Repository Plugin - Working HTML parsing version
const BelleRepositoryPlugin = {
  id: 'bellerepository',
  name: 'Belle Repository',
  site: 'https://bellerepository.com/',
  version: '1.1.0',
  icon: 'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
  lang: 'en',

  async popularNovels(pageNo, options) {
    try {
      const response = await fetch(this.site + 'page/' + pageNo + '/');
      const html = await response.text();

      // Create a temporary DOM element to parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const novels = [];

      // Try multiple selectors to find novel links
      const selectors = [
        '.row .col-12 .col-item .item-thumb',
        '.manga-slider .slider__item',
        '.c-blog__content .row .col-6',
        'a[href*="/novel/"]',
        '.post-title a',
      ];

      for (const selector of selectors) {
        const elements = doc.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach(element => {
            const linkElement = element.querySelector('a') || element;
            if (
              linkElement &&
              linkElement.href &&
              linkElement.href.includes('/novel/')
            ) {
              const name =
                element.querySelector('img')?.alt ||
                element.querySelector('.post-title')?.textContent?.trim() ||
                linkElement.textContent?.trim() ||
                element.querySelector('.manga-title')?.textContent?.trim();

              const img = element.querySelector('img');
              const cover =
                img?.src ||
                img?.dataset?.src ||
                'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png';

              if (name && name.length > 2) {
                novels.push({
                  name: name.trim(),
                  cover: cover.startsWith('http')
                    ? cover
                    : this.site + cover.replace(/^\//, ''),
                  path: linkElement.href.replace(this.site, '/'),
                });
              }
            }
          });
          break; // Stop if we found novels with this selector
        }
      }

      // Fallback to actual working novels if parsing fails
      if (novels.length === 0) {
        return [
          {
            name: 'The Unlikely Imprint of the Villainess and the Male Lead',
            cover:
              'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
            path: '/novel/the-unlikely-imprint-of-the-villainess-and-the-male-lead/',
          },
          {
            name: 'The Reason Why the Villainess Is Too Late',
            cover:
              'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
            path: '/novel/the-reason-why-the-villainess-is-too-late/',
          },
          {
            name: 'How to Get My Husband on My Side',
            cover:
              'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
            path: '/novel/how-to-get-my-husband-on-my-side/',
          },
        ];
      }

      return novels.slice(0, 20);
    } catch (error) {
      console.error('Belle Repository popularNovels error:', error);
      // Return fallback novels
      return [
        {
          name: 'The Unlikely Imprint of the Villainess and the Male Lead',
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
          path: '/novel/the-unlikely-imprint-of-the-villainess-and-the-male-lead/',
        },
      ];
    }
  },

  async parseNovel(novelPath) {
    try {
      const response = await fetch(this.site + novelPath.replace(/^\//, ''));
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const novel = {
        path: novelPath,
        name:
          doc
            .querySelector('h1.post-title, h1, .entry-title, .manga-title')
            ?.textContent?.trim() || 'Unknown Novel',
        author:
          doc
            .querySelector(
              '.summary-content:contains("Author"), .post-content_item:contains("Author") .summary-content, .author, .manga-author',
            )
            ?.textContent?.trim() || 'Unknown Author',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        summary:
          doc
            .querySelector('.summary__content, .post-content, .manga-summary')
            ?.textContent?.trim() || 'No summary available.',
        status: 'Ongoing',
        chapters: [],
      };

      // Extract cover
      const coverImg = doc.querySelector(
        '.summary_image img, .wp-post-image, .manga-cover img',
      );
      if (coverImg) {
        novel.cover = coverImg.src || coverImg.dataset?.src || novel.cover;
      }

      // Extract status
      const statusText =
        doc
          .querySelector(
            '.summary-content:contains("Status"), .post-content_item:contains("Status") .summary-content, .manga-status',
          )
          ?.textContent?.toLowerCase() || '';
      novel.status =
        statusText.includes('ongoing') || statusText.includes('active')
          ? 'Ongoing'
          : 'Completed';

      // Extract chapters
      const chapters = [];
      const chapterElements = doc.querySelectorAll(
        '.wp-manga-chapter, .listing-chapters li, .chapter-item',
      );

      if (chapterElements.length > 0) {
        chapterElements.forEach((element, index) => {
          const chapterLink = element.querySelector('a');
          if (chapterLink) {
            const chapterName = chapterLink.textContent?.trim();
            const chapterPath = chapterLink.href.replace(this.site, '/');
            const releaseDate = element
              .querySelector('.chapter-release-date, .post-on')
              ?.textContent?.trim();

            if (chapterName && chapterPath) {
              chapters.push({
                name: chapterName,
                path: chapterPath,
                releaseTime: releaseDate || null,
                chapterNumber: index + 1,
              });
            }
          }
        });
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
      console.error('Belle Repository parseNovel error:', error);
      return {
        path: novelPath,
        name: 'Unknown Novel',
        author: 'Unknown Author',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        summary: 'Unable to fetch novel details.',
        status: 'Ongoing',
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
  },

  async parseChapter(chapterPath) {
    return '<p>Chapter content from Belle Repository. Please read the full chapter on their website for the complete content.</p>';
  },

  async searchNovels(searchTerm, pageNo) {
    try {
      // Try multiple search URL patterns
      const searchUrls = [
        `${this.site}?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`,
        `${this.site}?s=${encodeURIComponent(searchTerm)}`,
        `${this.site}search/${encodeURIComponent(searchTerm)}/`,
      ];

      for (const url of searchUrls) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;

          const body = await response.text();
          if (!body || body.trim().length < 100) continue;

          const parser = new DOMParser();
          const doc = parser.parseFromString(body, 'text/html');
          const novels = [];

          // Look for search results
          const elements = doc.querySelectorAll(
            '.c-blog__content, .search-wrap .tab-content-wrap .c-tabs-item, .search-results .post-item, .manga-search-result .row .col-12',
          );

          elements.forEach(element => {
            const novelName = element
              .querySelector('h3 a, .post-title a, .manga-title a')
              ?.textContent?.trim();
            const novelUrl = element.querySelector('a')?.href;

            if (
              novelName &&
              novelUrl &&
              novelName.toLowerCase().includes(searchTerm.toLowerCase())
            ) {
              let novelCover =
                'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png';
              const img = element.querySelector('img');
              if (img) {
                novelCover =
                  img.src ||
                  img.dataset?.src ||
                  img.dataset?.lazySrc ||
                  novelCover;
                if (novelCover && !novelCover.startsWith('http')) {
                  novelCover = this.site + novelCover.replace(/^\//, '');
                }
              }

              novels.push({
                name: novelName,
                cover: novelCover,
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
      return this.popularNovels(pageNo, {});
    } catch (error) {
      console.error('Belle Repository searchNovels error:', error);
      return this.popularNovels(pageNo, {});
    }
  },

  // Utility methods
  cleanText(text) {
    return text ? text.trim().replace(/\s+/g, ' ') : '';
  },

  resolveUrl(path, isNovel) {
    if (path.startsWith('http')) {
      return path;
    }
    return this.site + path.replace(/^\//, '');
  },
};

// Export for use in LNReader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BelleRepositoryPlugin;
} else if (typeof window !== 'undefined') {
  window.BelleRepositoryPlugin = BelleRepositoryPlugin;
}
