/* ============================================================
   由「应用内隐私政策正文」生成官网隐私政策页
   ------------------------------------------------------------
   为什么这么做：App Store 审核要求三方口径一致
     ① App Store Connect 隐私问卷   ② App 内置 assets/privacy_policy.txt   ③ 官网政策页
   手工维护三处必然漂移，所以这里把 ② 作为唯一数据源，直接生成 ③。
   用法：node 工具/生成隐私政策页.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, '..', 'android_app', 'assets', 'privacy_policy.txt');
const OUT = path.join(ROOT, 'policy.html');

const raw = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
// 去掉发布前提示行（应用内文本末尾会带一句"请替换邮箱"的备注）
const lines = raw.split('\n').filter((l) => !l.includes('请将上述联系邮箱替换'));
const text = lines.join('\n').trim();

const CN_NUM = '一二三四五六七八九十';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const blocks = [];
const intro = [];   // 首个一级标题之前的说明段（含"本应用是什么/为何制定本政策"）
let cur = null;
for (const line of text.split('\n')) {
  const t = line.trim();
  if (!t) continue;
  if (/^《.*》隐私政策$/.test(t)) continue;        // 文档大标题（页面已有 h2）
  if (/^更新日期|^生效日期/.test(t)) continue;      // 日期单独展示
  const h = /^([一二三四五六七八九十]+)、(.+)$/.exec(t);
  if (h) {
    if (cur) blocks.push(cur);
    cur = { title: h[2].trim(), items: [] };
    continue;
  }
  if (!cur) { intro.push(t); continue; }           // 引导段
  const li = /^(\d+)\.\s*(.+)$/.exec(t);
  if (li) cur.items.push({ n: li[1], text: li[2].trim() });
  else cur.items.push({ text: t });                // 续行/无编号段落
}
if (cur) blocks.push(cur);

const headline = text.split('\n')[0].replace(/^《|》$/g, '');
const dates = text.split('\n').filter((l) => /更新日期|生效日期/.test(l));

const body = blocks.map((b, i) => {
  const items = b.items.map((it) =>
    it.n
      ? `        <li><b>${esc(it.text.split('：')[0])}${it.text.includes('：') ? '：' : ''}</b>${esc(it.text.split('：').slice(1).join('：'))}</li>`
      : `        <p>${esc(it.text)}</p>`
  ).join('\n');
  return `      <section class="p-block" id="p${i + 1}">
        <h2><span class="n">${CN_NUM[i] || i + 1}</span>${esc(b.title)}</h2>
        <ul class="p-list">
${items}
        </ul>
      </section>`;
}).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>证安查 · 隐私政策</title>
<meta name="description" content="证安查 App 隐私政策：证件识别全程在本机完成，台账数据仅存储在设备本地；仅在用户主动使用联网核验时，将证书编号或企业名称等必要信息提交至住建部、应急管理部官方公开查询服务。不接入任何广告或统计 SDK。">
<meta name="theme-color" content="#07c160">
<meta name="robots" content="index,follow">
<link rel="icon" href="assets/app-icon.png">
<link rel="apple-touch-icon" href="assets/app-icon.png">
<link rel="stylesheet" href="assets/site.css">
<script>document.documentElement.classList.add('js');</script>
<style>
  .p-wrap{max-width:820px;margin:0 auto}
  .p-meta{color:var(--ink-3);font-size:13.5px;margin:6px 0 26px;display:flex;flex-wrap:wrap;gap:6px 18px}
  .p-block{border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;margin-bottom:14px;background:var(--bg)}
  .p-block h2{font-size:17px;margin:0 0 12px;display:flex;align-items:center;gap:9px}
  .p-block h2 .n{width:24px;height:24px;border-radius:8px;background:var(--brand-50);color:var(--brand-700);
    display:grid;place-items:center;font-size:12.5px;font-weight:800;flex:none}
  .p-list{list-style:none;padding:0;margin:0}
  .p-list li{position:relative;padding-left:20px;margin:9px 0;color:var(--ink-2);font-size:14.8px}
  .p-list li::before{content:"";position:absolute;left:4px;top:10px;width:6px;height:6px;border-radius:50%;background:var(--brand)}
  .p-list p{margin:9px 0;color:var(--ink-2);font-size:14.8px}
  .p-list b{color:var(--ink)}
  .p-intro{border-left:3px solid var(--brand-100);padding:2px 0 2px 16px;margin-bottom:20px}
  .p-intro p{color:var(--ink-2);font-size:14.8px;margin:8px 0}
  .p-summary{background:var(--brand-50);border:1px solid var(--brand-100);border-radius:var(--radius);padding:18px 20px;margin-bottom:22px}
  .p-summary h2{font-size:15px;color:var(--brand-700);margin-bottom:10px}
  .p-summary ul{list-style:none;padding:0;margin:0}
  .p-summary li{display:flex;gap:9px;color:var(--ink-2);font-size:14.5px;margin:7px 0}
  .p-summary svg{width:17px;height:17px;color:var(--brand-600);flex:none;margin-top:3px}
</style>
</head>
<body>

<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="index.html">
      <img src="assets/app-icon.png" alt="证安查图标" width="30" height="30">
      <span>证安查</span>
    </a>
    <nav class="nav-links" aria-label="主导航">
      <a href="index.html#how">怎么用</a>
      <a href="index.html#feature">功能</a>
      <a href="index.html#download">下载</a>
      <a href="guide.html">使用说明</a>
      <a href="policy.html" aria-current="page">隐私政策</a>
    </nav>
    <div class="nav-cta"><a class="btn btn-primary btn-sm" href="index.html#download">免费下载</a></div>
  </div>
</header>

<main>
<section>
  <div class="wrap p-wrap">
    <div class="sec-head reveal" style="margin-bottom:18px">
      <span class="eyebrow">隐私政策</span>
      <h2>${esc(headline)}</h2>
    </div>
    <div class="p-meta">
${dates.map((d) => `      <span>${esc(d)}</span>`).join('\n')}
      <span>适用版本：iOS <span data-as-version>2.0.4</span> · 安卓 <span data-version>2.0.4</span></span>
    </div>

${intro.length ? `    <div class="p-intro reveal">
${intro.map((p) => `      <p>${esc(p)}</p>`).join('\n')}
    </div>
` : ''}
    <div class="p-summary reveal">
      <h2>一句话总结</h2>
      <ul>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>证件识别（OCR）全程在您的手机本地完成，证件照片与台账只存本机。</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>只有您主动点「联网查询补全」时，才把证书编号 / 姓名 / 企业名称发给政府官方查询平台。</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>没有账号、没有广告 SDK、没有第三方统计，不上传任何自建服务器。</span></li>
      </ul>
    </div>

${body}

    <p style="color:var(--ink-3);font-size:13px;margin-top:18px">
      本页内容与 App 内置隐私政策正文一致（由 <code>工具/生成隐私政策页.js</code> 从
      <code>android_app/assets/privacy_policy.txt</code> 生成，避免多处维护产生偏差）。
    </p>
  </div>
</section>
</main>

<footer class="site">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="index.html" style="margin-bottom:8px">
          <img src="assets/app-icon.png" alt="" width="26" height="26">
          <span>证安查</span>
        </a>
        <p style="font-size:13px">面向建筑施工企业的证件识别与台账管理工具。</p>
      </div>
      <div class="foot-links">
        <a href="index.html">首页</a>
        <a href="guide.html">使用说明</a>
        <a href="index.html#download">下载</a>
        <a href="index.html#faq">常见问题</a>
      </div>
      <div style="font-size:13px">
        <div>联系邮箱</div>
        <a data-contact href="mailto:qinshunhuan@vip.qq.com">qinshunhuan@vip.qq.com</a>
      </div>
    </div>
    <p class="foot-note">© <span data-year>2026</span> 证安查 · ZhengAnCha</p>
  </div>
</footer>

<script src="assets/config.js"></script>
<script src="assets/site.js"></script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`✓ 已生成 ${path.relative(process.cwd(), OUT)}`);
console.log(`  源文件：${path.relative(process.cwd(), SRC)}`);
console.log(`  章节数：${blocks.length}（${blocks.map((b) => b.title).join(' / ')}）`);
console.log(`  引导段：${intro.length} 段`);
console.log(`  日期行：${dates.join('；')}`);
