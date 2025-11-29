"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fetch_1 = require("@libs/fetch");
var cheerio_1 = require("cheerio");
var defaultCover_1 = require("@libs/defaultCover");
var ReadHivePlugin = /** @class */ (function () {
    function ReadHivePlugin() {
        var _this = this;
        this.id = 'readhive';
        this.name = 'ReadHive';
        this.icon = 'src/en/readhive/icon.png';
        this.site = 'https://readhive.org';
        this.version = '2.0.0';
        this.filters = undefined;
        this.resolveUrl = function (path) {
            if (path.startsWith('http'))
                return path;
            return _this.site + (path.startsWith('/') ? path : '/' + path);
        };
    }
    ReadHivePlugin.prototype.popularNovels = function (pageNo, options) {
        return __awaiter(this, void 0, void 0, function () {
            var novels, url, result, body, $;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        novels = [];
                        if (pageNo > 1)
                            return [2 /*return*/, novels];
                        url = this.site;
                        return [4 /*yield*/, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, result.text()];
                    case 2:
                        body = _a.sent();
                        $ = (0, cheerio_1.load)(body);
                        if (options.showLatestNovels) {
                            $('h2:contains("Latest Updates")')
                                .next('div.flex.flex-wrap')
                                .children('div.flex.flex-col.w-full.px-2.mb-4')
                                .each(function (i, el) {
                                var name = $(el).find('a.text-lg.font-medium').text().trim();
                                var path = $(el).find('a.peer').attr('href');
                                var cover = $(el).find('img').attr('src');
                                if (cover && !cover.startsWith('http')) {
                                    cover = _this.resolveUrl(cover);
                                }
                                if (path) {
                                    novels.push({ name: name, path: path, cover: cover || defaultCover_1.defaultCover });
                                }
                            });
                        }
                        else {
                            $('h2:contains("Popular This Month")')
                                .nextAll('div')
                                .find('.swiper-slide.w-32.flex-shrink-0.group')
                                .each(function (i, el) {
                                var name = $(el).find('h6.mt-2.text-sm.font-medium').text().trim();
                                var path = $(el).find('a').attr('href');
                                var cover = $(el).find('img').attr('src');
                                if (cover && !cover.startsWith('http')) {
                                    cover = _this.resolveUrl(cover);
                                }
                                if (path) {
                                    if (!novels.some(function (novel) { return novel.path === path; })) {
                                        novels.push({ name: name, path: path, cover: cover || defaultCover_1.defaultCover });
                                    }
                                }
                            });
                        }
                        return [2 /*return*/, novels];
                }
            });
        });
    };
    ReadHivePlugin.prototype.searchNovels = function (searchTerm, pageNo) {
        return __awaiter(this, void 0, void 0, function () {
            var url, result, body, $, novels;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.site, "/?s=").concat(searchTerm, "&page=").concat(pageNo);
                        return [4 /*yield*/, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, result.text()];
                    case 2:
                        body = _a.sent();
                        $ = (0, cheerio_1.load)(body);
                        novels = [];
                        $('div.col-6.col-md-3.mb-4').each(function (i, el) {
                            var name = $(el).find('h5').text().trim();
                            var path = $(el).find('a').attr('href');
                            var cover = $(el).find('img').attr('src');
                            if (cover && !cover.startsWith('http')) {
                                cover = _this.resolveUrl(cover);
                            }
                            if (path) {
                                novels.push({ name: name, path: path, cover: cover || defaultCover_1.defaultCover });
                            }
                        });
                        return [2 /*return*/, novels];
                }
            });
        });
    };
    ReadHivePlugin.prototype.parseNovel = function (novelPath) {
        return __awaiter(this, void 0, void 0, function () {
            var novel, url, result, body, $, summaryParagraphs, genres, chapters;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        novel = {
                            path: novelPath,
                            name: 'UNKNOWN',
                            chapters: [],
                        };
                        url = this.resolveUrl(novelPath);
                        return [4 /*yield*/, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, result.text()];
                    case 2:
                        body = _a.sent();
                        $ = (0, cheerio_1.load)(body);
                        novel.name = $('h1.flex-grow.flex-shrink.mb-1.text-2xl.font-bold.lg\:text-3xl.line-clamp-4').text().trim();
                        novel.cover = this.resolveUrl($('div.aspect-w-3.aspect-h-4.lg\:aspect-w-4.lg\:aspect-h-6.rounded.overflow-hidden img').attr('src') || defaultCover_1.defaultCover);
                        novel.author = $('span.leading-7.md\:text-xl').text().trim();
                        summaryParagraphs = [];
                        $('h2:contains("Synopsis")')
                            .next('div.mb-4')
                            .find('p')
                            .each(function (i, el) {
                            summaryParagraphs.push($(el).text().trim());
                        });
                        novel.summary = summaryParagraphs.join('\n');
                        genres = [];
                        $('div.flex.flex-wrap a.px-3.py-1.mb-1.mr-2.text-sm.text-foreground.bg-shade.rounded.shadow-md.hover\:bg-red.hover\:text-white').each(function () {
                            genres.push($(this).text());
                        });
                        novel.genres = genres.join(', ');
                        chapters = [];
                        $('h3:contains("Table of Contents")')
                            .next('div.p-2.overflow-hidden.border.border-accent-border.rounded.shadow')
                            .find('a.flex.items-center.p-2.rounded.bg-accent.hover\:bg-accent-hover')
                            .each(function (i, el) {
                            var chapterName = $(el).find('span.ml-1').text().trim();
                            var chapterPath = $(el).attr('href');
                            var releaseTime = $(el).find('span.text-xs').text().trim();
                            if (chapterPath) {
                                chapters.push({
                                    name: chapterName,
                                    path: chapterPath.replace(_this.site, ''),
                                    releaseTime: releaseTime,
                                });
                            }
                        });
                        novel.chapters = chapters;
                        return [2 /*return*/, novel];
                }
            });
        });
    };
    ReadHivePlugin.prototype.parseChapter = function (chapterPath) {
        return __awaiter(this, void 0, void 0, function () {
            var url, result, body, $, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = this.resolveUrl(chapterPath);
                        return [4 /*yield*/, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        result = _a.sent();
                        return [4 /*yield*/, result.text()];
                    case 2:
                        body = _a.sent();
                        $ = (0, cheerio_1.load)(body);
                        content = $('div.relative.lg\:grid-in-content.mt-4');
                        content.find('div.socials').remove();
                        content.find('div.reader-settings').remove();
                        content.find('div.nav-wrapper').remove();
                        content.find('div.code-block').remove(); // Remove code blocks
                        content.find('p:contains("• • •")').remove(); // Remove specific separator
                        return [2 /*return*/, content.html() || ''];
                }
            });
        });
    };
    return ReadHivePlugin;
}());
exports.default = new ReadHivePlugin();
