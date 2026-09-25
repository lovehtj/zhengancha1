/* ============================================================
   官网渲染自检（无头 Chrome + DevTools Protocol）
   检查项：
     1) 控制台是否有 JS 报错 / 资源加载失败
     2) 各视口下是否出现横向溢出（最常见、最刺眼的布局 bug）
     3) 关键元素是否真的渲染出来（二维码 SVG、图标、手机模型、标签页）
     4) 标签页点击是否能切换
     5) 深色模式下文字是否仍可见（对比度粗查）
   用法：node 工具/渲染自检.js [baseUrl]
   依赖：本机 Chrome + Node 18+（内置 WebSocket），无第三方包
   ============================================================ */
'use strict';
const { spawn } = require('child_process');
const http = require('http');

const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const PAGES = [
  '/index.html', '/guide.html', '/policy.html', '/404.html',
  // 打印材料（可直接 ⌘P 存 PDF）：自带二维码绘制脚本，同样要盯 JS 报错与横向溢出
  '/materials/App介绍与详细使用说明.html',
  '/materials/一页速查卡.html',
  '/materials/推广卖点.html'
];
const VIEWPORTS = [
  { name: '手机 390', width: 390, height: 844, mobile: true },
  { name: '平板 768', width: 768, height: 1024, mobile: false },
  { name: '桌面 1280', width: 1280, height: 900, mobile: false }
];

function get(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(d)); }).on('error', rej);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 极简 CDP 客户端 ---------- */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.events = []; this.sessionId = null;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.waiting.has(msg.id)) {
        const { resolve, reject } = this.waiting.get(msg.id); this.waiting.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) this.events.push(msg);
    });
  }
  send(method, params, useSession = true) {
    const id = ++this.id;
    const payload = { id, method, params: params || {} };
    if (useSession && this.sessionId) payload.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      setTimeout(() => { if (this.waiting.has(id)) { this.waiting.delete(id); reject(new Error('CDP 超时: ' + method)); } }, 20000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('页面内异常: ' + (r.exceptionDetails.text || '') + ' ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
    return r.result.value;
  }
}

/* 页面内执行的检查脚本（返回结构化结果） */
const PROBE = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = {
    title: document.title,
    scrollWidth: de.scrollWidth,
    clientWidth: vw,
    overflow: de.scrollWidth - vw,
    overflowing: [],
    qr: {},
    icons: document.querySelectorAll('svg').length,
    phoneScreens: document.querySelectorAll('.phone-screen .screen').length,
    tabs: document.querySelectorAll('.tab').length,
    visiblePanels: [...document.querySelectorAll('.tabpanel')].filter(p => getComputedStyle(p).display !== 'none').length,
    revealTotal: document.querySelectorAll('.reveal').length,
    revealHidden: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity === '0').length,
    dlCards: document.querySelectorAll('.dl-card').length,
    bodyColor: getComputedStyle(document.body).color,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    heroH1Size: (() => { const h = document.querySelector('.hero h1'); return h ? getComputedStyle(h).fontSize : null; })()
  };
  document.querySelectorAll('[data-qr]').forEach(el => {
    const svg = el.querySelector('svg');
    const box = el.getBoundingClientRect();
    out.qr[el.getAttribute('data-qr')] = {
      hasSvg: !!svg,
      fallback: !!el.querySelector('.qr-fallback'),
      rendered: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      boxW: Math.round(box.width),
      url: (document.querySelector('[data-qr-url="' + el.getAttribute('data-qr') + '"]') || {}).textContent || ''
    };
  });
  // 找出真正横向溢出的元素（排除刻意 overflow 的容器）
  if (out.overflow > 1) {
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const st = getComputedStyle(el);
      if (st.position === 'fixed') return;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        if (el.closest('.phone-stage') || el.closest('.cmp')) return; // 装饰性元素，可超出
        out.overflowing.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 46), left: Math.round(r.left), right: Math.round(r.right) });
      }
    });
    out.overflowing = out.overflowing.slice(0, 8);
  }
  return out;
})()`;

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/zac_chrome_profile', 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(300);
    try { wsUrl = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/version`)).webSocketDebuggerUrl; } catch (e) {}
  }
  if (!wsUrl) { console.error('✗ 无法连接 Chrome 调试端口'); chrome.kill(); process.exit(1); }
  console.log('✓ 已连接无头 Chrome\n');

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new CDP(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }, false);
  const att = await cdp.send('Target.attachToTarget', { targetId, flatten: true }, false);
  cdp.sessionId = att.sessionId;

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');

  let problems = 0;
  for (const vp of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile
    });
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    for (const page of PAGES) {
      // materials/ 下是可打印的 A4 定宽sheet（794px＝A4@96dpi），**本来就不做响应式**，
      // 窄视口下的横向溢出是设计使然，不是 bug。所以这几页只在桌面宽度下检查。
      if (page.startsWith('/materials/') && vp.width < 1000) continue;
      cdp.events.length = 0;
      await cdp.send('Page.navigate', { url: BASE + page });
      await sleep(1100);
      const r = await cdp.eval(PROBE);
      // 关键：.reveal 是"滚动到视口才淡入"，必须真的滚动一遍再统计，
      // 否则会把它当成"内容不可见"的 bug（第一次跑就踩了这个坑）
      const scrolled = await cdp.eval(`(async () => {
        // 页面有 scroll-behavior:smooth，连续 scrollTo 会互相打断、实际只挪一点，
        // 导致大部分元素根本没进过视口 → 必须先关掉平滑滚动（这是第二次踩的坑）
        const prevBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        const step = Math.round(innerHeight * 0.8);
        for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 110));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 900));
        document.documentElement.style.scrollBehavior = prevBehavior;
        const els = [...document.querySelectorAll('.reveal')];
        return {
          total: els.length,
          shown: els.filter(e => e.classList.contains('in')).length,
          stillHidden: els.filter(e => getComputedStyle(e).opacity === '0').length
        };
      })()`);
      const errs = cdp.events.filter((e) =>
        (e.method === 'Runtime.exceptionThrown') ||
        (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
        .map((e) => e.method === 'Runtime.exceptionThrown'
          ? (e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception || {}).description || '')
          : e.params.entry.text);

      const badge = (r.overflow <= 1 && !errs.length && scrolled.stillHidden === 0) ? '✓' : '✗';
      if (badge === '✗') problems++;
      console.log(`${badge} ${vp.name}  ${page}`);
      console.log(`    标题：${r.title.slice(0, 46)}`);
      console.log(`    横向：scrollWidth=${r.scrollWidth} clientWidth=${r.clientWidth} 溢出=${r.overflow}px`);
      console.log(`    svg 图标=${r.icons}  二维码=${Object.entries(r.qr).map(([k, v]) => k + (v.hasSvg ? '(SVG ' + v.rendered + 'px)' : v.fallback ? '(兜底文案)' : '(空)')).join(' ')}`);
      console.log(`    手机屏=${r.phoneScreens}  标签=${r.tabs}  可见面板=${r.visiblePanels}  下载卡=${r.dlCards}`);
      console.log(`    滚动出现：${scrolled.shown}/${scrolled.total} 已触发，滚动后仍隐藏 ${scrolled.stillHidden}`);
      if (r.heroH1Size) console.log(`    H1 字号=${r.heroH1Size}`);
      if (errs.length) { console.log(`    ✗ 控制台错误 ${errs.length} 条：`); errs.slice(0, 4).forEach((e) => console.log('       ' + String(e).slice(0, 160))); }
      if (r.overflowing.length) { console.log('    ✗ 溢出元素：'); r.overflowing.forEach((o) => console.log(`       <${o.tag} class="${o.cls}"> left=${o.left} right=${o.right}`)); }
      console.log('');
    }
  }

  /* ---- 标签页交互 ---- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(900);
  const tabTest = await cdp.eval(`(() => {
    const tabs = [...document.querySelectorAll('.tab')];
    const before = [...document.querySelectorAll('.tabpanel')].map(p => getComputedStyle(p).display);
    tabs[1].click();
    const after = [...document.querySelectorAll('.tabpanel')].map(p => getComputedStyle(p).display);
    const sel = tabs.map(t => t.getAttribute('aria-selected'));
    return { before, after, sel, panels: document.querySelectorAll('.tabpanel').length };
  })()`);
  const tabOk = tabTest.before[0] !== 'none' && tabTest.after[0] === 'none' && tabTest.after[1] !== 'none' && tabTest.sel.join() === 'false,true,false';
  console.log(`${tabOk ? '✓' : '✗'} 标签页交互：点击第 2 个标签`);
  console.log(`    display 变化 ${JSON.stringify(tabTest.before)} → ${JSON.stringify(tabTest.after)}`);
  console.log(`    aria-selected = ${tabTest.sel.join(',')}\n`);
  if (!tabOk) problems++;

  /* ---- 深色模式 ---- */
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await cdp.send('Page.navigate', { url: BASE + '/index.html' });
  await sleep(900);
  const dark = await cdp.eval(`(() => {
    function lum(c){ const m=c.match(/\\d+(\\.\\d+)?/g).map(Number); const [r,g,b]=m.map(v=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*r+0.7152*g+0.0722*b; }
    const cs = getComputedStyle(document.body);
    const card = document.querySelector('.card');
    const c2 = getComputedStyle(card);
    const L1 = lum(cs.color), L2 = lum(cs.backgroundColor);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const L3 = lum(c2.color), L4 = lum(c2.backgroundColor);
    const ratio2 = (Math.max(L3,L4)+0.05)/(Math.min(L3,L4)+0.05);
    return { bodyColor: cs.color, bodyBg: cs.backgroundColor, bodyRatio: +ratio.toFixed(2), cardRatio: +ratio2.toFixed(2) };
  })()`);
  const darkOk = dark.bodyRatio >= 4.5 && dark.cardRatio >= 4.5;
  console.log(`${darkOk ? '✓' : '✗'} 深色模式对比度：正文 ${dark.bodyRatio}:1，卡片 ${dark.cardRatio}:1（WCAG AA 正文要求 ≥4.5）`);
  console.log(`    body ${dark.bodyColor} on ${dark.bodyBg}\n`);
  if (!darkOk) problems++;

  console.log(problems ? `✗ 共发现 ${problems} 处问题` : '✓ 全部检查通过');
  ws.close(); chrome.kill();
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error('自检失败：', e.message); process.exit(1); });
