const isDetail = location.pathname.includes('detail');
const $ = id => document.getElementById(id);
const fmt = d => d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6);

function showStatus(msg, type) {
  const el = $('status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-bar' + (type ? ' '+type : '');
  el.style.display = 'block';
  if (type === 'success') setTimeout(() => el.style.display = 'none', 3000);
}

// ===== 列表页 =====
async function loadList() {
  try {
    const res = await fetch('/api/news');
    const list = await res.json();
    const el = $('news-list');
    if (!list.length) {
      el.innerHTML = '<div class="empty"><div class="icon">📭</div>' +
        '<div class="msg">暂无新闻数据</div>' +
        '<div class="hint">点击「抓取今日新闻」开始</div></div>';
      return;
    }
    el.innerHTML = list.map(item =>
      '<a class="news-card" href="/detail.html?date='+item.date+'">' +
        '<div class="date">'+fmt(item.date) +
          (item.articleCount ? '<span class="count">'+item.articleCount+'条</span>' : '') +
        '</div>' +
        '<div class="abstract">'+item.abstract.replace(/\n/g,' ')+'</div>' +
      '</a>'
    ).join('');
  } catch(e) {
    $('news-list').innerHTML = '<div class="empty"><div class="icon">⚠️</div><div class="msg">加载失败</div></div>';
  }
}

// ===== 详情页 =====
async function loadDetail() {
  const date = new URLSearchParams(location.search).get('date');
  if (!date) {
    $('news-detail').innerHTML = '<div class="empty"><div class="msg">无效日期</div></div>';
    return;
  }
  $('page-title').textContent = '新闻联播 ' + fmt(date);
  try {
    const res = await fetch('/api/news/' + date);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    let html = '';
    if (data.abstract) {
      html += '<div class="detail-abstract"><h2>📋 新闻摘要</h2>' +
        '<div>' + data.abstract.replace(/\n/g,'<br>') + '</div></div>';
    }
    if (data.articles && data.articles.length) {
      html += data.articles.map((a, i) =>
        '<div class="article-card">' +
          '<h3>' + (i+1) + '. ' + a.title + '</h3>' +
          '<div class="content">' + a.content + '</div>' +
          (a.link ? '<a class="source-link" href="'+a.link+'" target="_blank" rel="noopener">查看原文 →</a>' : '') +
        '</div>'
      ).join('');
    }
    $('news-detail').innerHTML = html || '<div class="empty"><div class="msg">暂无内容</div></div>';
  } catch(e) {
    $('news-detail').innerHTML = '<div class="empty"><div class="icon">📭</div><div class="msg">未找到该日新闻</div></div>';
  }
}

// ===== 推送订阅 =====
function b64ToUint8(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function setupPush() {
  const btn = $('btn-subscribe');
  if (!btn) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.textContent = '浏览器不支持推送';
    btn.disabled = true;
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    btn.textContent = '✓ 推送已开启';
    btn.disabled = true;
    return;
  }
  btn.onclick = async () => {
    try {
      btn.textContent = '授权中...'; btn.disabled = true;
      const { key } = await (await fetch('/api/vapid-public-key')).json();
      if (!key) {
        showStatus('服务端未配置推送密钥，请参考 README', 'error');
        btn.textContent = '未配置推送'; return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(key)
      });
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      btn.textContent = '✓ 推送已开启';
      showStatus('推送已开启，每天19:35将收到新闻摘要', 'success');
    } catch(e) {
      btn.textContent = '开启推送通知'; btn.disabled = false;
      showStatus('开启失败: ' + e.message, 'error');
    }
  };
}

// ===== 手动抓取 =====
function setupCrawl() {
  const btn = $('btn-crawl');
  if (!btn) return;
  btn.onclick = async () => {
    btn.textContent = '抓取中...'; btn.disabled = true;
    showStatus('正在从央视网抓取今日新闻联播...');
    try {
      const res = await fetch('/api/crawl', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showStatus('抓取成功！共 ' + data.articles + ' 条新闻', 'success');
        loadList();
      } else {
        showStatus(data.message || '无新内容', 'error');
      }
    } catch(e) {
      showStatus('抓取失败: ' + e.message, 'error');
    }
    btn.textContent = '抓取今日新闻'; btn.disabled = false;
  };
}

// ===== 初始化 =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
if (isDetail) {
  loadDetail();
} else {
  loadList();
  setupPush();
  setupCrawl();
}
