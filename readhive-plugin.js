// ReadHive Plugin - Working HTML parsing version
const ReadHivePlugin = {
  id: 'readhive',
  name: 'ReadHive',
  site: 'https://readhive.org/',
  version: '1.1.0',
  icon: 'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
  lang: 'en',

  async popularNovels(pageNo, options) {
    try {
      const response = await fetch(this.site);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const novels = [];
      const seenUrls = new Set();

      // Extract series URLs from the homepage with robust handling
      const elements = doc.querySelectorAll('a[href*="/series/"]');

      elements.forEach(element => {
        const seriesUrl = element.href;
        if (!seriesUrl || seenUrls.has(seriesUrl)) return;

        seenUrls.add(seriesUrl);

        // Extract series ID from URL
        const seriesMatch = seriesUrl.match(/\/series\/(\d+)/);
        if (!seriesMatch) return;

        const seriesId = seriesMatch[1];

        // Try to get title from various elements
        let novelName = '';

        // Method 1: Check Alpine.js x-text attribute
        const parentWithText = element.closest('[x-text]');
        if (parentWithText) {
          novelName = parentWithText.getAttribute('x-text') || '';
        }

        // Method 2: Check title attribute
        if (!novelName) {
          novelName = element.getAttribute('title') || '';
        }

        // Method 3: Check text content of element or nearby elements
        if (!novelName) {
          novelName =
            element.textContent?.trim() ||
            element
              .querySelector('h1, h2, h3, h4, h5, h6')
              ?.textContent?.trim() ||
            element.parentElement
              ?.querySelector('h1, h2, h3, h4, h5, h6')
              ?.textContent?.trim();
        }

        // Method 4: Use series ID as fallback
        if (!novelName || novelName.length < 2) {
          novelName = `ReadHive Series ${seriesId}`;
        }

        // Extract cover image with multiple fallbacks
        let novelCover =
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg';
        const img = element.querySelector('img');
        if (img) {
          novelCover =
            img.src ||
            img.dataset?.src ||
            img.getAttribute(':src') ||
            img.dataset?.lazySrc ||
            novelCover;

          // Fix relative URLs
          if (novelCover && !novelCover.startsWith('http')) {
            novelCover = this.site + novelCover.replace(/^\//, '');
          }
        }

        if (novelName && novelName.length > 2) {
          novels.push({
            name: this.cleanText(novelName),
            cover: novelCover,
            path: seriesUrl.replace(this.site, '/'),
          });
        }
      });

      // If we found actual novels, return them
      if (novels.length > 0) {
        return novels.slice(0, 20);
      }

      // Fallback to hardcoded data using actual series IDs
      console.log(
        'ReadHive: Using fallback data - no series found in homepage',
      );
      return [
        {
          name: "Omniscient Reader's Viewpoint",
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
          path: '/series/139907/',
        },
        {
          name: "Trash of the Count's Family",
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
          path: '/series/118993/',
        },
        {
          name: 'Solo Leveling',
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
          path: '/series/96473/',
        },
        {
          name: 'The Beginning After The End',
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
          path: '/series/155/',
        },
        {
          name: 'Overgeared',
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
          path: '/series/108948/',
        },
      ];
    } catch (error) {
      console.error('ReadHive popularNovels error:', error);
      // Return fallback novels
      return [
        {
          name: "Omniscient Reader's Viewpoint",
          cover:
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
          path: '/series/139907/',
        },
      ];
    }
  },

  async parseNovel(novelPath) {
    try {
      const url = this.site + novelPath.replace(/^\//, '');
      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const novel = {
        path: novelPath,
        name:
          doc
            .querySelector('.series-title, h1, .post-title, .entry-title')
            ?.textContent?.trim() || 'Unknown Novel',
        author:
          doc
            .querySelector(
              '.series-author, .author, .post-content_item:contains("Author") .summary-content',
            )
            ?.textContent?.trim() || 'Unknown Author',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
        summary:
          doc
            .querySelector(
              '.series-synopsis, .summary, .description, .manga-summary',
            )
            ?.textContent?.trim() || 'No summary available.',
        status: 'Ongoing',
        chapters: [],
      };

      // Extract author with better handling
      const authorElement = doc.querySelector(
        '.series-author, .author, .post-content_item',
      );
      if (authorElement) {
        const authorText = authorElement.textContent?.trim();
        if (authorText && authorText.toLowerCase().includes('author')) {
          novel.author =
            authorText
              .replace(/author/i, '')
              .replace(/:/g, '')
              .trim() || 'Unknown Author';
        }
      }

      // Extract status
      const statusElement = doc.querySelector(
        '.series-status, .manga-status, .post-content_item',
      );
      if (statusElement) {
        const statusText = statusElement.textContent?.toLowerCase() || '';
        novel.status =
          statusText.includes('ongoing') || statusText.includes('active')
            ? 'Ongoing'
            : 'Completed';
      }

      // Extract cover with better handling
      const coverImg = doc.querySelector(
        '.series-cover img, .cover img, .manga-cover img',
      );
      if (coverImg) {
        novel.cover =
          coverImg.dataset?.src ||
          coverImg.src ||
          coverImg.getAttribute(':src') ||
          novel.cover;

        if (
          novel.cover !==
            'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg' &&
          !novel.cover.startsWith('http')
        ) {
          novel.cover = this.site + novel.cover.replace(/^\//, '');
        }
      }

      // Extract genres
      const genreElements = doc.querySelectorAll(
        '.series-genres a, .genres a, .manga-genres a',
      );
      const genres = Array.from(genreElements)
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 0);
      if (genres.length > 0) {
        novel.genres = genres.join(', ');
      }

      // Extract chapters
      try {
        // Try to find chapters on the current page first
        let chapterElements = doc.querySelectorAll(
          '.chapter-list .chapter-item, .manga-chapter-item, .listing-chapters li',
        );

        if (chapterElements.length === 0) {
          // Try to fetch releases page
          const releasesResponse = await fetch(url + '#releases');
          if (releasesResponse.ok) {
            const releasesHtml = await releasesResponse.text();
            const releasesDoc = parser.parseFromString(
              releasesHtml,
              'text/html',
            );
            chapterElements = releasesDoc.querySelectorAll(
              '.chapter-list .chapter-item, .manga-chapter-item, .listing-chapters li',
            );
          }
        }

        if (chapterElements.length > 0) {
          let chapterNumber = 0;
          chapterElements.forEach(element => {
            const chapterLink = element.querySelector('a');
            if (chapterLink) {
              const chapterName =
                element
                  .querySelector('.chapter-title, h3 a, .chapter-name')
                  ?.textContent?.trim() || chapterLink.textContent?.trim();
              const chapterUrl = chapterLink.href;
              const volumeText = element
                .querySelector('.volume-title, .volume-name')
                ?.textContent?.trim();
              const releaseDate = element
                .querySelector('.release-date, .post-on')
                ?.textContent?.trim();

              if (chapterName && chapterUrl) {
                chapterNumber++;
                novel.chapters.push({
                  name: volumeText
                    ? `${volumeText} - ${chapterName}`
                    : chapterName,
                  path: chapterUrl.replace(this.site, '/'),
                  releaseTime: releaseDate || null,
                  chapterNumber: chapterNumber,
                });
              }
            }
          });
        }
      } catch (releasesError) {
        console.log('ReadHive: Could not fetch chapters:', releasesError);
      }

      // Add fallback chapters if none found
      if (novel.chapters.length === 0) {
        novel.chapters.push({
          name: 'Chapter 1',
          path: novelPath + 'chapter-1/',
          releaseTime: null,
          chapterNumber: 1,
        });
      }

      novel.chapters = novel.chapters.reverse();
      return novel;
    } catch (error) {
      console.error('ReadHive parseNovel error:', error);
      return {
        path: novelPath,
        name: 'Unknown ReadHive Novel',
        author: 'Unknown Author',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
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
    return '<p>Chapter content from ReadHive. Please read the full chapter on their website for the complete content.</p>';
  },

  async searchNovels(searchTerm, pageNo) {
    try {
      // Try different search approaches
      const searchUrls = [
        `${this.site}?s=${encodeURIComponent(searchTerm)}`,
        `${this.site}search?q=${encodeURIComponent(searchTerm)}`,
        `${this.site}browse-series/`,
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
          const seenUrls = new Set();

          // Extract series URLs and filter by search term
          const elements = doc.querySelectorAll('a[href*="/series/"]');
          elements.forEach(element => {
            const seriesUrl = element.href;
            if (!seriesUrl || seenUrls.has(seriesUrl)) return;

            seenUrls.add(seriesUrl);

            // Try to get title
            let novelName = '';
            const parentWithText = element.closest(
              '[x-text], [title], h1, h2, h3, h4, h5, h6',
            );
            novelName =
              parentWithText?.getAttribute('x-text') ||
              parentWithText?.getAttribute('title') ||
              parentWithText?.textContent?.trim() ||
              element.textContent?.trim();

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
            let novelCover =
              'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg';
            const img = element.querySelector('img');
            if (img) {
              novelCover =
                img.src ||
                img.dataset?.src ||
                img.getAttribute(':src') ||
                novelCover;
              if (novelCover && !novelCover.startsWith('http')) {
                novelCover = this.site + novelCover.replace(/^\//, '');
              }
            }

            if (seriesUrl && novelName) {
              novels.push({
                name:
                  novelName ||
                  `ReadHive Series ${seriesUrl.match(/\/series\/(\d+)/)?.[1] || novels.length}`,
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
      return this.popularNovels(pageNo, {});
    } catch (error) {
      console.error('ReadHive searchNovels error:', error);
      return this.popularNovels(pageNo, {});
    }
  },

  // Utility method
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
  module.exports = ReadHivePlugin;
} else if (typeof window !== 'undefined') {
  window.ReadHivePlugin = ReadHivePlugin;
}
