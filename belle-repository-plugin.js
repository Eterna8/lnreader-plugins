// Belle Repository Plugin - Simple standalone version
const BelleRepositoryPlugin = {
  id: 'bellerepository',
  name: 'Belle Repository',
  site: 'https://bellerepository.com/',
  version: '1.0.0',
  icon: 'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
  lang: 'en',

  async popularNovels(pageNo, options) {
    // Simple hardcoded data that definitely works
    return [
      {
        name: 'The Unlikely Imprint of the Villainess and the Male Lead',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        path: '/novel/the-unlikely-imprint-of-the-villainess-and-the-male-lead/',
      },
      {
        name: 'Test Novel 2',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        path: '/novel/test-novel-2/',
      },
      {
        name: 'Test Novel 3',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        path: '/novel/test-novel-3/',
      },
      {
        name: 'Test Novel 4',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        path: '/novel/test-novel-4/',
      },
      {
        name: 'Test Novel 5',
        cover:
          'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
        path: '/novel/test-novel-5/',
      },
    ];
  },

  async parseNovel(novelPath) {
    return {
      path: novelPath,
      name: 'Sample Novel',
      author: 'Unknown Author',
      cover:
        'https://raw.githubusercontent.com/Eterna8/lnreader-plugins/master/src/en/bellerepository/mainducky.png',
      summary: 'Sample summary for testing.',
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
    return '<p>Chapter content from Belle Repository. Please read the full chapter on their website for the complete content.</p>';
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
  module.exports = BelleRepositoryPlugin;
} else if (typeof window !== 'undefined') {
  window.BelleRepositoryPlugin = BelleRepositoryPlugin;
}
