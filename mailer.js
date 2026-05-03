import nodemailer from 'nodemailer';

let transporter = null;

function init() {
  if (transporter) return true;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.log('[Mail] 邮箱未配置，跳过邮件发送');
    return false;
  }
  const port = Number(SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
  console.log('[Mail] 邮件服务已配置');
  return true;
}

export async function sendNewsMail(dateStr, abstract, articles) {
  if (!init()) return;
  const d = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6)}`;

  const articleList = articles.map((a, i) =>
    `<div style="margin-bottom:16px;padding:14px;background:#f9f9f9;border-radius:8px;">
      <h3 style="margin:0 0 8px;color:#c62828;font-size:15px;">${i + 1}. ${a.title}</h3>
      <div style="font-size:14px;line-height:1.8;color:#333;">${a.content}</div>
      ${a.link ? `<a href="${a.link}" style="color:#c62828;font-size:13px;">查看原文 →</a>` : ''}
    </div>`
  ).join('');

  const html = `
<div style="max-width:640px;margin:0 auto;font-family:-apple-system,'PingFang SC','Noto Sans SC',sans-serif;">
  <div style="background:linear-gradient(135deg,#c62828,#8e0000);padding:20px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">📺 新闻联播 ${d}</h1>
    <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;">共 ${articles.length} 条新闻</p>
  </div>
  <div style="padding:20px;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
    <div style="background:linear-gradient(135deg,#fff8e1,#fff3e0);padding:16px;border-radius:8px;border-left:4px solid #ffa000;margin-bottom:20px;">
      <h2 style="margin:0 0 10px;font-size:16px;color:#c62828;">📋 今日摘要</h2>
      <p style="font-size:14px;line-height:1.8;margin:0;color:#333;">${abstract.replace(/\n/g, '<br>')}</p>
    </div>
    <h2 style="font-size:16px;color:#212121;margin:0 0 12px;">📰 详细新闻</h2>
    ${articleList}
    <p style="text-align:center;color:#999;font-size:12px;margin-top:20px;">—— 新闻联播 PWA 自动发送 ——</p>
  </div>
</div>`;

  console.log(`[Mail] 正在发送至 ${process.env.MAIL_TO} (SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}, 用户: ${process.env.SMTP_USER})`);
  await transporter.sendMail({
    from: `"新闻联播" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO,
    subject: `📺 新闻联播 ${d} (${articles.length}条)`,
    html,
  });
  console.log(`[Mail] ✅ 邮件已发送至 ${process.env.MAIL_TO}`);
}
