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
    const novels: Plugin.NovelItem[] = [];

    const url = `${this.site}/?page=${pageNo}`;
    const result = await fetchApi(url);
    const body = await result.text();
    $('div.col-6.col-md-3.mb-4').each((i, el) => {
      const name = $(el).find('h5').text().trim();
      const path = $(el).find('a').attr('href');
      let cover = $(el).find('img').attr('src');

      if (cover && !cover.startsWith('http')) {
        cover = this.resolveUrl(cover);
      }
      if (path) {
        novels.push({ name, path, cover: cover || defaultCover });
      }
    });

    return novels;
  }
  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/?s=${searchTerm}&page=${pageNo}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = loadCheerio(body);

    const novels: Plugin.NovelItem[] = [];
    $('div.col-6.col-md-3.mb-4').each((i, el) => {
      const name = $(el).find('h5').text().trim();
      const path = $(el).find('a').attr('href');
      let cover = $(el).find('img').attr('src');

      if (cover && !cover.startsWith('http')) {
        cover = this.resolveUrl(cover);
      }
      if (path) {
        novels.push({ name, path, cover: cover || defaultCover });
      }
    });
    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: 'UNKNOWN',
      chapters: [],
    };
    const url = this.resolveUrl(novelPath);
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = loadCheerio(body);

    novel.name = $('h1.name').text().trim();
    novel.cover = this.resolveUrl(
      $('img.series-cover').attr('src') || defaultCover,
    );

    $('div.extra a').each(function () {
      const detailName = $(this).find('span.name').text().trim();
      const detailValue = $(this).find('span.value').text().trim();

      switch (detailName) {
        case 'Author':
          novel.author = detailValue;
          break;
        case 'Status':
          if (detailValue.toLowerCase().includes('ongoing')) {
            novel.status = NovelStatus.Ongoing;
          } else if (detailValue.toLowerCase().includes('completed')) {
            novel.status = NovelStatus.Completed;
          } else {
            novel.status = NovelStatus.Unknown;
          }
          break;
      }
    });

    const genres: string[] = [];
    $('a.tag[href*="genre"]').each(function () {
      genres.push($(this).text());
    });
    novel.genres = genres.join(', ');

    novel.summary = $('.summary-content').text().trim();

    const chapters: Plugin.ChapterItem[] = [];
    $('#releases a.chapter-link').each((i, el) => {
      const chapterName = $(el).find('span.chapter-title').text().trim();
      const chapterPath = $(el).attr('href');
      const releaseDate = $(el).find('span.chapter-update').text().trim();

      if (chapterPath) {
        chapters.push({
          name: chapterName,
          path: chapterPath.substring(this.site.length),
          releaseTime: releaseDate,
        });
      }
    });

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.resolveUrl(chapterPath);
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = loadCheerio(body);

    const content = $('div.text-left');
    content.find('div.socials').remove();
    content.find('div.reader-settings').remove();
    content.find('div.nav-wrapper').remove();

    return content.html() || '';
  }
}
export default new ReadHivePlugin();
