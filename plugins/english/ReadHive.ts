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
    const $ = loadCheerio(body);

    $('article.bs').each((i, el) => {
      const name = $(el).find('.ntitle').text().trim();
      const path = $(el).find('a').attr('href')?.substring(this.site.length);
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
    $('article.bs').each((i, el) => {
      const name = $(el).find('.ntitle').text().trim();
      const path = $(el).find('a').attr('href')?.substring(this.site.length);
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

    novel.name = $('.entry-title').text().trim();
    novel.cover = $('img.wp-post-image').attr('src') || defaultCover;

    $('.spe > span').each(function () {
      const detailName = $(this).find('b').text().trim();
      const detailValue = $(this).find('b').remove().end().text().trim();

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
    $('.genxed > a').each(function () {
      genres.push($(this).text());
    });
    novel.genres = genres.join(', ');

    novel.summary = $('.entry-content p').text().trim();

    const chapters: Plugin.ChapterItem[] = [];
    $('#releases ul > li').each((i, el) => {
      const chapterName = $(el).find('.chapternum').text().trim();
      const chapterPath = $(el).find('a').attr('href');
      const releaseDate = $(el).find('.chapterdate').text().trim();

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

    const content = $('#content');
    content
      .find('p:contains("Previous Chapter"), p:contains("Next Chapter")')
      .remove();

    return content.html() || '';
  }
}
export default new ReadHivePlugin();
