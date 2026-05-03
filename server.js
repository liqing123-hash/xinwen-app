import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import webPush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { crawlDate, crawlToday, getDateString } from './crawler.js';
import { sendNewsMail } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const NEWS_DIR = path.join(DATA_DIR, 'news');
const CATALOGUE_PATH = path.join(DATA_DIR, 'catalogue.json');
const SUBS_PATH = path.join(DATA_DIR, 'subscriptions.json');

[DATA_DIR, NEWS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
[CATALOGUE_PATH, SUBS_PATH].forEach(f => { if (!fs.existsSync(f)) fs.writeFileSync(f, '[]'); });

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails('mailto:xinwen@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('[Push] VAPID 密钥已配置');
} else {
  console.log('[Push] VAPID 未配置，推送不可用。运行 npm run generate-vapid 生成');
}

app.use(express.json());
app.use(express.static('public'));

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid' });
  const subs = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8'));
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    fs.writeFileSync(SUBS_PATH, JSON.stringify(subs, null, 2));
    console.log(`[Push] 新订阅, 共 ${subs.length} 个`);
  }
  res.json({ success: true });
});

app.get('/api/news', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf-8')));
});

app.get('/api/news/:date', (req, res) => {
  const d = req.params.date;
  if (!/^\d{8}$/.test(d)) return res.status(400).json({ error: 'Bad date' });
  const p = path.join(NEWS_DIR, `${d}.json`);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
});

app.post('/api/crawl', async (req, res) => {
  const date = req.body.date || getDateString();
  if (!/^\d{8}$/.test(date)) return res.status(400).json({ error: 'Bad date' });
  try {
    const result = await crawlDate(date, req.body.force || false);
    if (result) {
      res.json({ success: true, date, articles: result.articles.length });
    } else {
      res.json({ success: false, message: '无新内容或已存在' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: 测试发送邮件 (用最近一天的数据)
app.post('/api/test-mail', async (req, res) => {
  try {
    const catalogue = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf-8'));
    if (!catalogue.length) return res.json({ success: false, message: '无新闻数据，请先抓取' });
    const latest = catalogue[0];
    const newsPath = path.join(NEWS_DIR, `${latest.date}.json`);
    const data = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
    await sendNewsMail(data.date, data.abstract, data.articles);
    res.json({ success: true, message: `测试邮件已发送 (${latest.date})` });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

async function sendPushToAll(title, body, url) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('[Push] VAPID 未配置，跳过推送');
    return;
  }
  const subs = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf-8'));
  if (!subs.length) { console.log('[Push] 无订阅者'); return; }
  const payload = JSON.stringify({ title, body, url });
  const valid = [];
  for (const sub of subs) {
    try {
      await webPush.sendNotification(sub, payload);
      valid.push(sub);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        console.log('[Push] 移除过期订阅');
      } else {
        valid.push(sub);
        console.error('[Push] 发送失败:', e.message);
      }
    }
  }
  fs.writeFileSync(SUBS_PATH, JSON.stringify(valid, null, 2));
  console.log(`[Push] 推送完成, 成功 ${valid.length}/${subs.length}`);
}

// 每天 20:00 自动抓取 + 推送
cron.schedule('0 20 * * *', async () => {
  console.log('[Cron] 开始每日抓取...');
  const dateStr = getDateString();
  const result = await crawlDate(dateStr);
  if (result) {
    const summary = result.abstract.replace(/\n/g, ' ').substring(0, 120) + '...';
    const d = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6)}`;
    try { await sendPushToAll(`新闻联播 ${d}`, summary, `/detail.html?date=${dateStr}`); } catch(e) { console.error('[Cron] Web Push 失败:', e.message); }
    try { await sendNewsMail(dateStr, result.abstract, result.articles); } catch(e) { console.error('[Cron] 微信推送失败:', e.message); }
  } else {
    console.log('[Cron] 无新内容, 30分钟后重试...');
    setTimeout(async () => {
      const r = await crawlDate(dateStr);
      if (r) {
        const s = r.abstract.replace(/\n/g, ' ').substring(0, 120) + '...';
        const d = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6)}`;
        try { await sendPushToAll(`新闻联播 ${d}`, s, `/detail.html?date=${dateStr}`); } catch(e) { console.error('[Cron] Web Push 失败:', e.message); }
        try { await sendNewsMail(dateStr, r.abstract, r.articles); } catch(e) { console.error('[Cron] 微信推送失败:', e.message); }
      }
    }, 30 * 60 * 1000);
  }
}, { timezone: 'Asia/Shanghai' });

// 额外: 每天 21:00 重试 (部分新闻发布较晚)
cron.schedule('0 21 * * *', async () => {
  const dateStr = getDateString();
  const p = path.join(NEWS_DIR, `${dateStr}.json`);
  if (fs.existsSync(p)) return;
  console.log('[Cron] 重试抓取...');
  const r = await crawlDate(dateStr);
  if (r) {
    const s = r.abstract.replace(/\n/g, ' ').substring(0, 120) + '...';
    const d = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6)}`;
    try { await sendPushToAll(`新闻联播 ${d}`, s, `/detail.html?date=${dateStr}`); } catch(e) { console.error('[Cron] Web Push 失败:', e.message); }
    try { await sendNewsMail(dateStr, r.abstract, r.articles); } catch(e) { console.error('[Cron] 微信推送失败:', e.message); }
  }
}, { timezone: 'Asia/Shanghai' });

app.listen(PORT, () => {
  console.log(`[Server] 运行在 http://localhost:${PORT}`);
  console.log(`[Server] VAPID: ${VAPID_PUBLIC ? '已配置' : '未配置'}`);
});
