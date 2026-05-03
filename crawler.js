import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const NEWS_DIR = path.join(DATA_DIR, 'news');
const CATALOGUE_PATH = path.join(DATA_DIR, 'catalogue.json');

// 确保目录和文件存在
if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });
if (!fs.existsSync(CATALOGUE_PATH)) fs.writeFileSync(CATALOGUE_PATH, '[]');

/**
 * 格式化日期为 YYYYMMDD
 */
export const getDateString = (date = new Date()) => {
  const pad = n => (n < 10 ? '0' + n : '' + n);
  return '' + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
};

/**
 * 带重试的 HTTP 请求
 */
const fetchHTML = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'accept': 'text/html, */*; q=0.01',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
          'sec-ch-ua-mobile': '?0',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'x-requested-with': 'XMLHttpRequest',
          'Referer': url,
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 15000,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.log(`[Crawler] Fetch attempt ${i + 1}/${retries} failed for ${url}: ${e.message}`);
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
};

/**
 * 获取某天的新闻列表
 * @returns {{ abstractLink: string, newsLinks: string[] }}
 */
const getNewsList = async (date) => {
  const html = await fetchHTML(`http://tv.cctv.com/lm/xwlb/day/${date}.shtml`);
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  const links = [];
  dom.window.document.querySelectorAll('a').forEach(a => {
    const href = a.href;
    if (href && !links.includes(href)) links.push(href);
  });
  const abstractLink = links.shift();
  console.log(`[Crawler] 获取新闻列表: 简介链接 + ${links.length} 条新闻`);
  return { abstractLink, newsLinks: links };
};

/**
 * 获取新闻简介/摘要
 */
const getAbstract = async (link) => {
  const html = await fetchHTML(link);
  const dom = new JSDOM(html);
  const el = dom.window.document.querySelector(
    '#page_body > div.allcontent > div.video18847 > div.playingCon > div.nrjianjie_shadow > div > ul > li:nth-child(1) > p'
  );
  if (!el) {
    console.log('[Crawler] 未找到摘要元素，尝试备用选择器...');
    const fallback = dom.window.document.querySelector('.nrjianjie_shadow p');
    return fallback ? fallback.innerHTML.replace(/；/g, '；\n\n').replace(/：/g, '：\n\n') : '';
  }
  return el.innerHTML.replace(/；/g, '；\n\n').replace(/：/g, '：\n\n');
};

/**
 * 逐条获取新闻正文
 */
const getNewsArticles = async (links) => {
  const articles = [];
  console.log(`[Crawler] 共 ${links.length} 条新闻，开始逐条抓取...`);
  for (let i = 0; i < links.length; i++) {
    const url = links[i];
    try {
      const html = await fetchHTML(url);
      const dom = new JSDOM(html);
      const title = dom.window.document.querySelector(
        '#page_body > div.allcontent > div.video18847 > div.playingVideo > div.tit'
      )?.innerHTML?.replace('[视频]', '').trim() || '';
      const content = dom.window.document.querySelector('#content_area')?.innerHTML || '';
      articles.push({ title, content, link: url });
      // 控制台进度
      if ((i + 1) % 5 === 0 || i === links.length - 1) {
        console.log(`[Crawler] 进度: ${i + 1}/${links.length}`);
      }
      // 请求间隔，避免被封
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`[Crawler] 第 ${i + 1} 条抓取失败 (${url}): ${e.message}`);
      articles.push({ title: '(抓取失败)', content: '', link: url });
    }
  }
  return articles;
};

/**
 * 抓取指定日期的新闻联播
 * @param {string} dateStr - YYYYMMDD 格式日期
 * @param {boolean} force - 是否强制重新抓取
 * @returns {object|null} 抓取结果
 */
export const crawlDate = async (dateStr, force = false) => {
  console.log(`\n[Crawler] ======== 开始抓取 ${dateStr} ========`);

  const newsPath = path.join(NEWS_DIR, `${dateStr}.json`);

  // 已有数据且非强制模式
  if (!force && fs.existsSync(newsPath)) {
    console.log(`[Crawler] ${dateStr} 数据已存在，跳过 (使用 force=true 强制重新抓取)`);
    return null;
  }

  try {
    // 1. 获取新闻列表
    const { abstractLink, newsLinks } = await getNewsList(dateStr);
    if (!abstractLink || newsLinks.length === 0) {
      console.log(`[Crawler] ${dateStr} 未找到新闻（可能尚未发布）`);
      return null;
    }

    // 2. 获取摘要
    console.log('[Crawler] 抓取新闻摘要...');
    const abstract = await getAbstract(abstractLink);

    // 3. 逐条获取新闻内容
    const articles = await getNewsArticles(newsLinks);

    const newsData = {
      date: dateStr,
      abstract,
      articles,
      crawledAt: new Date().toISOString(),
    };

    // 4. 保存新闻详情
    fs.writeFileSync(newsPath, JSON.stringify(newsData, null, 2));

    // 5. 更新目录索引
    const catalogue = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf-8'));
    const filtered = catalogue.filter(c => c.date !== dateStr);
    filtered.unshift({
      date: dateStr,
      abstract,
      articleCount: articles.length,
      crawledAt: newsData.crawledAt,
    });
    fs.writeFileSync(CATALOGUE_PATH, JSON.stringify(filtered, null, 2));

    console.log(`[Crawler] ✅ ${dateStr} 抓取完成: ${articles.length} 条新闻`);
    return newsData;
  } catch (e) {
    console.error(`[Crawler] ❌ ${dateStr} 抓取失败: ${e.message}`);
    return null;
  }
};

/**
 * 抓取今天的新闻
 */
export const crawlToday = () => crawlDate(getDateString());
