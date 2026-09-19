/* ============================================================
   打印排版自检（材料页 → A4）
   ------------------------------------------------------------
   为了"一页速查卡必须是一页"这类要求，光看屏幕是没用的：
   必须在**打印媒体 + A4 尺寸**下量一次内容高度。
   本脚本用无头 Chrome 的打印仿真量出：
     · 内容高度 / A4 可打印高度
     · 估算页数（有小数即为溢出）
     · 溢出最多的元素（便于精准压缩）
   用法：node 工具/打印排版自检.js
   ============================================================ */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const A4_W = Math.round((210 / 25.4) * 96);   // 794px @96dpi
const A4_H = Math.round((297 / 25.4) * 96);   // 1123px
const MARGIN_MM = 12;                         // 与各材料 @page/print padding 大致一致
const PAD = Math.round((MARGIN_MM / 25.4) * 96);

const ROOT = path.join(__dirname, '..');
const TARGETS = [
  { file: path.join(ROOT, '..', '上架资料', '一页速查卡.html'), label: '一页速查卡', mustBeOnePage: true },
  { file: path.join(ROOT, '..', '上架资料', '推广卖点.html'), label: '推广卖点', mustBeOnePage: true },
  { file: path.join(ROOT, '..', '上架资料', 'App介绍与详细使用说明.html'), label: 'App介绍与详细使用说明', mustBeOnePage: false }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(d)); }).on('error', rej);
});

const PROBE = `(() => {
  // 打印媒体下，纸张宽度 = A4 宽度减去页边距
  const sheet = document.querySelector('.sheet') || document.body;
  const prev = { w: sheet.style.width, p: sheet.style.padding, m: sheet.style.margin, s: sheet.style.boxShadow, minh: sheet.style.minHeight };
  sheet.style.width = '${A4_W - PAD * 2}px';
  sheet.style.padding = '0';
  sheet.style.margin = '0';
  sheet.style.minHeight = '0';
  sheet.style.boxShadow = 'none';
  const limit = ${A4_H - PAD * 2};
  const h = Math.ceil(sheet.getBoundingClientRect().height);
  // 找出"最靠下的元素"，用来定位是哪一块把内容顶出去的
  const kids = [...sheet.children].map(el => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 40), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  }).sort((a, b) => b.bottom - a.bottom).slice(0, 5);
  Object.assign(sheet.style, { width: prev.w, padding: prev.p, margin: prev.m, boxShadow: prev.s, minHeight: prev.minh });
  return { contentH: h, limit, pages: +(h / limit).toFixed(2), over: h - limit, kids };
})()`;

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/zac_chrome_pdf', 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(300);
    try { wsUrl = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/version`)).webSocketDebuggerUrl; } catch (e) {}
  }
  if (!wsUrl) { console.error('✗ 无法连接 Chrome'); chrome.kill(); process.exit(1); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const waiting = new Map(); let sessionId = null;
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.reject(new Error(JSON.stringify(m.error))) : w.resolve(m.result); }
  });
  const send = (method, params, useSession = true) => {
    const i = ++id; const p = { id: i, method, params: params || {} };
    if (useSession && sessionId) p.sessionId = sessionId;
    ws.send(JSON.stringify(p));
    return new Promise((resolve, reject) => { waiting.set(i, { resolve, reject }); setTimeout(() => { if (waiting.has(i)) { waiting.delete(i); reject(new Error('超时 ' + method)); } }, 20000); });
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false);
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await send('Emulation.setDeviceMetricsOverride', { width: A4_W, height: A4_H, deviceScaleFactor: 1, mobile: false });

  console.log(`A4 打印区：${A4_W - PAD * 2}×${A4_H - PAD * 2}px（纸 ${A4_W}×${A4_H}，页边距 ${MARGIN_MM}mm）\n`);
  let bad = 0;
  for (const t of TARGETS) {
    if (!fs.existsSync(t.file)) { console.log(`! 找不到 ${t.file}`); continue; }
    await send('Page.navigate', { url: 'file://' + t.file });
    await sleep(900);
    const r = (await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })).result.value;
    const ok = !t.mustBeOnePage || r.over <= 0;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${t.label}`);
    console.log(`    内容高 ${r.contentH}px / 单页 ${r.limit}px → 约 ${r.pages} 页${r.over > 0 ? `（超出 ${r.over}px）` : `（余 ${-r.over}px）`}`);
    console.log(`    最靠下的块：` + r.kids.map((k) => `${k.tag}.${k.cls}=${k.h}px`).join('  '));
    if (t.mustBeOnePage && r.over > 0) console.log(`    → 需要压缩约 ${Math.ceil(r.over)}px（≈${(r.over / 96 * 25.4).toFixed(1)}mm）`);
    console.log('');
  }
  console.log(bad ? `✗ ${bad} 份材料超出单页` : '✓ 需要单页的材料都在一页内');
  ws.close(); chrome.kill();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('自检失败：', e.message); process.exit(1); });
