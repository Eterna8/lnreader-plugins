import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters } from '@libs/filterInputs';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';

class ReadHivePlugin implements Plugin.PluginBase {
  id = 'readhive';
  name = 'ReadHive';
  icon = 'src/en/readhive/FO721D5FA0CC7-02-scaled-e1658075230203-150x150.jpg';
  site = 'https://readhive.org';
  version = '2.0.0';
  filters: Filters | undefined = undefined;

  resolveUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    return this.site + (path.startsWith('/') ? path : '/' + path);
  };

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) return [];

    const url = this.site;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = loadCheerio(body);

    const novels: Plugin.NovelItem[] = [];
    const processedPaths = new Set<string>();

    if (options.showLatestNovels) {
      $('h2:contains("Latest Updates")')
        .next('.flex-wrap')
        .find('.px-2.mb-4')
        .each((i, el) => {
          const path = $(el).find('a.peer').attr('href');
          if (path && !processedPaths.has(path)) {
            const name = $(el).find('a.text-lg').text().trim();
            let cover = $(el).find('img').attr('src');
            if (cover && !cover.startsWith('http')) {
              cover = this.resolveUrl(cover);
            }
            novels.push({ name, path, cover: cover || defaultCover });
            processedPaths.add(path);
          }
        });
    } else {
      $('h2:contains("Popular")')
        .nextAll('.swiper')
        .find('.swiper-slide')
        .each((i, el) => {
          const path = $(el).find('a').attr('href');
          if (path && !processedPaths.has(path)) {
            const name = $(el).find('h6').text().trim();
            let cover = $(el).find('img').attr('src');
            if (cover && !cover.startsWith('http')) {
              cover = this.resolveUrl(cover);
            }
            novels.push({ name, path, cover: cover || defaultCover });
            processedPaths.add(path);
          }
        });
    }

    return novels;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    // ReadHive needs THIS **exact** form payload
    const form = new FormData();
    form.append('search', searchTerm);
    form.append('orderBy', 'recent'); // site ALWAYS uses "recent"
    form.append('post', '60916bbfb9'); // taken from x-data="browse('...')"
    form.append('action', 'fetch_browse'); // required action

    // Perform the AJAX request
    const result = await fetchApi(`${this.site}/ajax`, {
      method: 'POST',
      body: form,
    });

    // Response may be JSON or raw HTML
    const raw = await result.text();
    let html = raw;

    // If it's JSON, extract the HTML portion
    try {
      const json = JSON.parse(raw);
      if (json && json.html) html = json.html;
    } catch (_) {}

    // Now parse the returned HTML fragment
    const $ = loadCheerio(html);
    const novels: Plugin.NovelItem[] = [];

    // These are where ReadHive's AJAX search cards appear
    $('div.px-2.mb-4').each((i, el) => {
      const path = $(el).find('a.peer').attr('href');
      const name = $(el).find('a.text-lg').text().trim();
      let cover = $(el).find('img').attr('src');

      if (path && name) {
        if (cover && !cover.startsWith('http')) cover = this.resolveUrl(cover);
        novels.push({
          name,
          path,
          cover: cover || defaultCover,
        });
      }
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = this.resolveUrl(novelPath);
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = loadCheerio(body);

    const name = $('h1[class*="line-clamp-4"]').text().trim();
    const cover =
      $('img[alt*="Cover"]').attr('src') ||
      $('img[class*="object-cover"]').attr('src') ||
      defaultCover;

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: name,
      cover: this.resolveUrl(cover),
      author: $('span[class*="leading-7"]').text().trim(),
      summary: $('h2:contains("Synopsis")').next('div').find('p').text().trim(),
      genres: $('div.lg\\:grid-in-info a[href*="/genre/"]')
        .map((i, el) => $(el).text())
        .get()
        .join(', '),
      chapters: [],
    };

    const chapterElements = $('div.grid-cols-1 a[href*="/series/"]');

    const chapters: Plugin.ChapterItem[] = chapterElements
      .map((i, el) => {
        const path = $(el).attr('href');
        if (!path) return null;

        const chapterName = $(el).find('span[class*="ml-1"]').text().trim();
        const releaseTime = $(el).find('span.text-xs').text().trim();

        return {
          name: chapterName,
          path: path.replace(this.site, ''),
          releaseTime: releaseTime,
        };
      })
      .get()
      .filter(Boolean) as Plugin.ChapterItem[];

    novel.chapters = chapters.reverse();
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.resolveUrl(chapterPath);
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = loadCheerio(body);

    const content = $(
      'div[class*="lg:grid-in-content"] div[style*="font-size"]',
    );

    content.find('div[data-fuse]').remove();
    content.find('div.socials').remove();
    content.find('div.reader-settings').remove();
    content.find('div.nav-wrapper').remove();
    content.find('p:contains("• • •")').remove();

    content.find('p').each((i, el) => {
      if ($(el).html()?.trim() === '&nbsp;' || $(el).html()?.trim() === '') {
        $(el).remove();
      }
    });

    return content.html() || '';
  }
}
export default new ReadHivePlugin();
