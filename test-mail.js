import nodemailer from 'nodemailer';
import fs from 'fs';

const transporter = nodemailer.createTransport({
  service: 'QQ',
  auth: {
    user: '226783030@qq.com',
    pass: 'cgvmqvltshhrbhch',
  },
});

const data = JSON.parse(fs.readFileSync('./data/news/20260502.json', 'utf-8'));
const d = '2026-05-02';

console.log('正在发送测试邮件 (端口587)...');
transporter.sendMail({
  from: '"新闻联播" <226783030@qq.com>',
  to: 'bnll57777@gmail.com',
  subject: `📺 测试 - 新闻联播 ${d} (${data.articles.length}条)`,
  html: `<h1>📺 新闻联播 ${d}</h1><p>${data.abstract.replace(/\n/g,'<br>')}</p><p>共${data.articles.length}条新闻</p>`,
}).then(() => {
  console.log('✅ 发送成功！请检查 bnll57777@gmail.com 收件箱（含垃圾箱）');
}).catch(e => {
  console.error('❌ 失败:', e.message);
  console.log('尝试端口465...');
  const t2 = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user: '226783030@qq.com', pass: 'cgvmqvltshhrbhch' },
    tls: { rejectUnauthorized: false },
  });
  return t2.sendMail({
    from: '"新闻联播" <226783030@qq.com>',
    to: 'bnll57777@gmail.com',
    subject: `📺 测试 - 新闻联播 ${d}`,
    html: `<h1>📺 新闻联播 ${d}</h1><p>${data.abstract.replace(/\n/g,'<br>')}</p>`,
  });
}).then(r => { if(r) console.log('✅ 端口465发送成功！'); })
  .catch(e2 => console.error('❌ 两个端口都失败:', e2.message));
