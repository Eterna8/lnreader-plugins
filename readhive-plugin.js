// ReadHive Plugin - Simple standalone version
const ReadHivePlugin = {
  id: 'readhive',
  name: 'ReadHive',
  site: 'https://readhive.org/',
  version: '1.0.0',
  icon: 'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
  lang: 'en',

  async popularNovels(pageNo, options) {
    // Simple hardcoded data that definitely works
    return [
      {
        name: 'ReadHive Series 139907',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
        path: '/series/139907/',
      },
      {
        name: 'ReadHive Series 118993',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
        path: '/series/118993/',
      },
      {
        name: 'ReadHive Series 96473',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
        path: '/series/96473/',
      },
      {
        name: 'ReadHive Series 155',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
        path: '/series/155/',
      },
      {
        name: 'ReadHive Series 108948',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
        path: '/series/108948/',
      },
    ];
  },

  async parseNovel(novelPath) {
    return {
      path: novelPath,
      name: 'ReadHive Novel',
      author: 'Unknown Author',
      cover:
        'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/readhive/readhive.jpg',
      summary: 'Sample summary for ReadHive novel.',
      status: 'Ongoing',
      chapters: [
        {
          name: 'Chapter 1',
          path: novelPath + 'chapter-1/',
          releaseTime: null,
          chapterNumber: 1,
        },
        {
          name: 'Chapter 2',
          path: novelPath + 'chapter-2/',
          releaseTime: null,
          chapterNumber: 2,
        },
      ],
    };
  },

  async parseChapter(chapterPath) {
    return '<p>Chapter content from ReadHive. Please read the full chapter on their website for the complete content.</p>';
  },

  async searchNovels(searchTerm, pageNo) {
    // Return popular novels as search results for now
    return this.popularNovels(pageNo, {});
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
