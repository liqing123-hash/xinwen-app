# 📺 新闻联播 PWA

自建爬虫抓取央视新闻联播文字稿，手机端查看 + 定时推送通知。

## 功能

- **自建爬虫** — 从央视网 (tv.cctv.com) 实时抓取新闻联播文字稿
- **移动端 UI** — 卡片式新闻列表，点击查看详情，支持添加到桌面
- **定时推送** — 每天 19:35 自动抓取当天新闻，Web Push 推送摘要到手机
- **点击通知** — 直接跳转到当天新闻详情页
- **手动抓取** — 支持手动触发抓取，也支持抓取历史日期

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 生成 VAPID 推送密钥
npm run generate-vapid

# 3. 配置环境变量
cp .env.example .env
# 将生成的 publicKey 和 privateKey 填入 .env

# 4. 启动服务
npm start
```

打开 `http://localhost:3000`，在手机浏览器访问（同一局域网下用电脑 IP）。

## 推送设置

1. 手机浏览器打开应用后，点击「开启推送通知」
2. 允许通知权限
3. 每天 19:35 将自动收到当天新闻摘要推送
4. 点击通知直接查看详情

> **注意**: Web Push 推送需要 HTTPS。本地开发可用 `localhost`，
> 部署到服务器需要配置 SSL 证书（或使用 Railway / Render 等平台自带 HTTPS）。

## 部署

推荐部署到支持 Node.js 的平台：

- **Railway** — `railway up`
- **Render** — 连接 Git 仓库自动部署
- **VPS** — 使用 `pm2 start server.js` 守护进程

确保设置环境变量 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`TZ=Asia/Shanghai`。

## API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/news` | GET | 新闻列表（日期+摘要） |
| `/api/news/:date` | GET | 指定日期详细新闻 |
| `/api/crawl` | POST | 手动触发抓取 `{date?}` |
| `/api/subscribe` | POST | 订阅推送通知 |
| `/api/vapid-public-key` | GET | 获取 VAPID 公钥 |

## 技术栈

- **后端**: Express + node-cron + web-push + jsdom
- **前端**: 原生 HTML/CSS/JS，PWA (Service Worker)
- **爬虫**: node-fetch + jsdom 解析央视网页面
- **存储**: JSON 文件（无需数据库）
