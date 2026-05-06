// 使用 PushPlus 微信推送（HTTP API，无端口限制）
// 官网: https://www.pushplus.plus
// 支持多人推送: PUSHPLUS_TOKEN=token1,token2,token3

export async function sendNewsMail(dateStr, abstract, articles) {
  const tokens = (process.env.PUSHPLUS_TOKEN || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!tokens.length) {
    console.log('[PushPlus] 未配置 PUSHPLUS_TOKEN，跳过微信推送');
    return;
  }

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

  const title = `📺 新闻联播 ${d} (${articles.length}条)`;

  let failCount = 0;
  for (const token of tokens) {
    try {
      console.log(`[PushPlus] 正在推送至 token: ${token.slice(0, 8)}...`);
      const res = await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          title,
          content: html,
          template: 'html',
        }),
      });
      const result = await res.json();
      if (result.code === 200) {
        console.log(`[PushPlus] ✅ 推送成功 (${token.slice(0, 8)}...)`);
      } else {
        console.error(`[PushPlus] ❌ 推送失败 (${token.slice(0, 8)}...): ${result.msg}`);
        failCount++;
      }
    } catch (e) {
      console.error(`[PushPlus] ❌ 请求失败 (${token.slice(0, 8)}...): ${e.message}`);
      failCount++;
    }
  }
  if (failCount === tokens.length) {
    throw new Error(`所有 ${tokens.length} 个推送均失败`);
  }
  console.log(`[PushPlus] 推送完成: ${tokens.length - failCount}/${tokens.length} 成功`);
}
