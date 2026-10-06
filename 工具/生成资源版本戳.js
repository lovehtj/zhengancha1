#!/usr/bin/env node
/**
 * 生成资源版本戳 —— 给 HTML 里的 assets 引用加 ?v=<内容指纹>，防止浏览器/微信 WebView 用到旧 JS。
 *
 * 为什么需要它：
 *   GitHub Pages 给 HTML 和 JS 都发 `Cache-Control: max-age=600`。改版后如果用户（尤其微信内置
 *   浏览器）在缓存有效期内打开，可能出现「新 HTML + 旧 site.js」的错配——页面是新文案，交互却
 *   还是旧逻辑。带上内容指纹后，只要 assets 里任何一个字节变了，URL 就变，缓存必然失效。
 *
 * 指纹算法：对 `assets/` 下**每个文件**的「文件名 + 内容」做 FNV-1a 32 位。
 * 也就是说：**只要跑一次这个脚本，assets 里所有资源的 URL 一起换**（同一个站点快照共用一个戳，便于排查）。
 *
 * 用法：
 *   node 工具/生成资源版本戳.js          # 写入（幂等：内容没变就什么都不改）
 *   node 工具/生成资源版本戳.js --check  # 只检查：有文件是旧戳就退出码 1（部署前自检用）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'assets');

/** 参与指纹的资源 = assets/ 下的全部文件（不写死文件名，以后加图片/文本自动被覆盖） */
function assetFiles() {
  return fs.readdirSync(ASSET_DIR)
    .filter((f) => !f.startsWith('.') && fs.statSync(path.join(ASSET_DIR, f)).isFile())
    .sort();
}

// 会被改写的页面：根目录 4 个页面 + materials 下的资料页（后者用 ../assets/ 前缀）
function pages() {
  const list = fs.readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(ROOT, f));
  const matDir = path.join(ROOT, 'materials');
  if (fs.existsSync(matDir)) {
    for (const f of fs.readdirSync(matDir).filter((f) => f.endsWith('.html'))) {
      list.push(path.join(matDir, f));
    }
  }
  return list.sort();
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function stamp() {
  let buf = '';
  for (const name of assetFiles()) {
    buf += name + '\u0000' + fs.readFileSync(path.join(ASSET_DIR, name), 'utf8') + '\u0000';
  }
  return fnv1a(buf).toString(16).padStart(8, '0');
}

// 只匹配「属性值 / CSS url() 位置」的资源引用：
//   (?<=["'(])  前一个字符必须是引号或左括号 —— 这条是关键护栏。
//   曾经踩过的坑：不用护栏时，正文里的 `android_app/assets/privacy_policy.txt</code>` 会被匹配，
//   且把 `</code` 当成查询串吃掉（`[^"'\s>)]*` 允许 `<` `/`），直接改坏 policy.html。
//   加了护栏 + 把查询串限制在安全字符集后，正文里的路径不会再被碰。
// 查询串只允许 ?v=xxxx 这类安全字符，绝不吞 `<`、`/`、`>` 等标记字符。
const REF = /(?<=["'(])((?:\.\.\/)?assets\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+)(\?[A-Za-z0-9=&_.%-]*)?/g;

/**
 * 正则自测：护栏一旦被人改松，立刻在这里报错（而不是又去改坏某个页面）。
 * 这个坑真实发生过：policy.html 正文里的 `android_app/assets/privacy_policy.txt</code>`
 * 被匹配并把 `</code` 当查询串吃掉，页面结构被改坏。
 */
function assertPatternSafe() {
  const mustMatch = [
    '<link rel="stylesheet" href="assets/site.css">',
    '<script src="assets/config.js?v=old12345"></script>',
    '<script src="../assets/qr.js"></script>',
    '<img src="assets/app-icon.png?v=old12345" alt="图标">',
    'background:url(assets/app-icon.png) no-repeat'
  ];
  const mustNotMatch = [
    '正文里的 <code>android_app/assets/privacy_policy.txt</code> 生成',
    '见 ../android_app/assets/privacy_policy.txt 说明',
    'xassets/site.js',
    'data:assets/site.js'
  ];
  const problems = [];
  for (const s of mustMatch) if (!new RegExp(REF.source).test(s)) problems.push('该匹配却没匹配：' + s);
  for (const s of mustNotMatch) if (new RegExp(REF.source).test(s)) problems.push('不该匹配却匹配了：' + s);
  if (problems.length) {
    console.error('✗ 资源引用正则自测失败：');
    for (const p of problems) console.error('    ' + p);
    process.exit(2);
  }

  // 端到端：把「正文路径 + 紧跟闭合标签」跑一遍替换，确认标记字符不会被吃掉
  const sample = '正文 <code>android_app/assets/privacy_policy.txt</code> 生成';
  const after = sample.replace(new RegExp(REF.source, 'g'), (m, file) => file + '?v=deadbeef');
  if (after !== sample) {
    console.error('✗ 端到端自测失败：正文里的路径被改动了 → ' + after);
    process.exit(2);
  }
}

function main() {
  assertPatternSafe();
  const checkOnly = process.argv.includes('--check');
  const v = stamp();

  // ① 先全量体检：算好每个页面的新内容，并顺手做死链检查（引用的 assets 文件必须真实存在）。
  //    顺序很重要——**先验后写**：一旦发现死链，一个文件都不落盘，避免"改了一半"的中间态。
  const plan = [];
  const missing = [];
  for (const page of pages()) {
    const rel = path.relative(ROOT, page);
    const src = fs.readFileSync(page, 'utf8');
    const scan = new RegExp(REF.source, 'g');
    let mm;
    while ((mm = scan.exec(src))) {
      const file = mm[1].replace(/^\.\.\//, '');
      if (!fs.existsSync(path.join(ROOT, file))) missing.push(rel + ' → ' + file);
    }
    plan.push({ rel, page, src, out: src.replace(REF, (m, file) => file + '?v=' + v), hits: (src.match(REF) || []).length });
  }

  if (missing.length) {
    console.error('✗ 引用了不存在的资源（线上会 404），本次不做任何修改：');
    for (const m of missing) console.error('    ' + m);
    process.exit(3);
  }

  // ② 再统一写入
  let touched = 0;
  let stale = 0;
  for (const { rel, page, src, out, hits } of plan) {
    if (out === src) {
      console.log((checkOnly ? '  ✓ ' : '  · ') + rel + '（' + hits + ' 处，' +
        (checkOnly ? '已是最新戳 ' + v : '无需改动') + '）');
      continue;
    }
    if (checkOnly) {
      console.log('  ✗ ' + rel + '：资源戳不是 ' + v + '，请运行 node 工具/生成资源版本戳.js');
      stale++;
      continue;
    }
    fs.writeFileSync(page, out);
    console.log('  ✓ ' + rel + '：' + hits + ' 处资源引用 → ?v=' + v);
    touched++;
  }

  if (checkOnly) {
    if (stale) {
      console.log('\n资源版本戳过期：' + stale + ' 个页面需要更新。');
      process.exit(1);
    }
    console.log('\n资源版本戳一致：' + v);
    return;
  }
  console.log('\n资源版本戳：' + v + (touched ? '（已写入 ' + touched + ' 个页面）' : '（无需改动）'));
}

main();
