// 简易 SVG 图标生成器 - 运行一次即可: node generate-icons.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function makeSVG(size) {
  const r = size * 0.15;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#c62828"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
    font-size="${size * 0.5}" font-family="Arial" fill="white" font-weight="bold">联播</text>
</svg>`;
}

// PWA 需要 PNG，这里先生成 SVG 占位（实际部署时替换为 PNG）
[192, 512].forEach(s => {
  fs.writeFileSync(path.join(dir, `icon-${s}.svg`), makeSVG(s));
  console.log(`Generated icon-${s}.svg`);
});

console.log('图标已生成。如需 PNG 格式，可用在线工具将 SVG 转换为 PNG。');
