// 使用 Resend HTTP API 发邮件（避免云平台封锁 SMTP 端口）
// 注册: https://resend.com  免费 100封/天

function checkConfig() {
  const { RESEND_API_KEY, MAIL_TO } = process.env;
  if (!RESEND_API_KEY || !MAIL_TO) {
    console.log('[Mail] 未配置 RESEND_API_KEY 或 MAIL_TO，跳过邮件');
    return false;
  }
  return true;
}

export async function sendNewsMail(dateStr, abstract, articles) {
  if (!checkConfig()) return;
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

  const subject = `📺 新闻联播 ${d} (${articles.length}条)`;
  const mailTo = process.env.MAIL_TO;
  console.log(`[Mail] 正在通过 Resend API 发送至 ${mailTo}...`);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'onboarding@resend.dev',
      to: mailTo,
      subject,
      html,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error(`Resend API 错误: ${result.message || JSON.stringify(result)}`);
  }
  console.log(`[Mail] ✅ 邮件已发送至 ${mailTo}, id: ${result.id}`);
}
