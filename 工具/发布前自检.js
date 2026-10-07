#!/usr/bin/env node
/**
 * 发布前自检 —— 在部署**之前**把"会让页面静默坏掉"的问题挡住。
 *
 * 为什么需要它（真实事故，2026-10-06）：
 *   官网部署后"下载既没有地址也没有二维码"。排查发现线上 `assets/config.js`
 *   是一个**带 git 冲突标记的半成品**（`<<<<<<< HEAD` / `=======` / `>>>>>>>`）——
 *   它是语法错误，于是 `window.ZAC_CONFIG` 根本没生成，`site.js` 无法填版本/体积，
 *   也无法生成下载链接与二维码。页面看起来"没报错"，但下载区是空的。
 *
 * 检查项：
 *   1) 任何文本文件里**不得有 git 冲突标记**
 *   2) 所有 .js 必须能通过语法编译（vm.Script）
 *   3) `assets/config.js` 必须能加载出 `window.ZAC_CONFIG`，且必需的键齐全
 *   4) `config.js` 里**同一个键不得出现两次**（后来的会静默覆盖前面的 —— 这是本次事故的第二个隐患）
 *   5) HTML 里引用的 `assets/*`（含 ?v= 版本戳）必须真实存在
 *   6) 下载要素必须齐全：`iosUrl` 与 `androidPath` 非空（否则页面上不会出现二维码/链接）
 *
 * 用法：
 *   node 工具/发布前自检.js            # 退出码 0 通过 / 1 失败
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const problems = [];
const notes = [];
const rel = (p) => path.relative(ROOT, p) || '.';

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const TEXT = /\.(html|js|css|md|txt|json|yml|yaml)$/i;

/* 1) 冲突标记 */
for (const f of walk(ROOT)) {
  if (!TEXT.test(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const hits = lines
    .map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => l.startsWith('<<<<<<<') || l.startsWith('>>>>>>>') || l.trim() === '=======');
  if (hits.length) {
    problems.push(`${rel(f)} 有 ${hits.length} 处 git 冲突标记（第 ${hits.map(h => h.i).join(', ')} 行）→ 未解决的合并，必须先修好再部署`);
  }
}

/* 2) JS 语法 */
const jsFiles = walk(ROOT).filter((f) => f.endsWith('.js') && !f.includes(path.sep + '工具' + path.sep))
  .concat(walk(path.join(ROOT, '工具')).filter((f) => f.endsWith('.js')));
for (const f of jsFiles) {
  try {
    new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f });
  } catch (e) {
    problems.push(`${rel(f)} 语法错误：${e.message.split('\n')[0]}`);
  }
}

/* 3/4) config.js 载入 + 重复键 */
const cfgPath = path.join(ROOT, 'assets', 'config.js');
if (!fs.existsSync(cfgPath)) {
  problems.push('assets/config.js 不存在');
} else {
  const src = fs.readFileSync(cfgPath, 'utf8');
  // 重复键检测：只看顶层 `键:`（2 空格缩进）
  const seen = new Map();
  src.split('\n').forEach((l, i) => {
    const m = /^ {2}([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(l);
    if (!m) return;
    if (seen.has(m[1])) {
      problems.push(`assets/config.js 里键 \`${m[1]}\` 出现了两次（第 ${seen.get(m[1])} 行与第 ${i + 1} 行）→ 后者会静默覆盖前者，必须删掉一个`);
    } else seen.set(m[1], i + 1);
  });
  const sandbox = { window: {} };
  try {
    vm.createContext(sandbox);
    new vm.Script(src, { filename: cfgPath }).runInContext(sandbox);
  } catch (e) {
    problems.push(`assets/config.js 无法执行：${e.message.split('\n')[0]}`);
  }
  const cfg = sandbox.window.ZAC_CONFIG;
  if (!cfg) {
    problems.push('assets/config.js 执行后没有 window.ZAC_CONFIG → site.js 无法填版本/体积，也生成不了下载链接与二维码（本次事故即此）');
  } else {
    const required = ['iosUrl', 'androidPath', 'version', 'build', 'apkSize', 'iosSize', 'minAndroid', 'minIOS'];
    const missing = required.filter((k) => cfg[k] === undefined || cfg[k] === '');
    if (missing.length) problems.push(`config.js 缺少必需键或值为空：${missing.join(', ')}`);
    if (!cfg.iosUrl || !cfg.androidPath) {
      problems.push('iosUrl / androidPath 为空 → 页面上不会出现下载二维码与链接');
    } else {
      notes.push(`下载要素齐全：iOS=${cfg.iosUrl}`);
      notes.push(`               安卓=${cfg.androidPath}`);
      notes.push(`               版本=${cfg.version}（build ${cfg.build}）· 安卓 ${cfg.apkSize} · iOS ${cfg.iosSize}`);
    }
  }
}

/* 5) HTML 引用的 assets 是否存在 */
for (const f of walk(ROOT).filter((x) => x.endsWith('.html'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:src|href)="((?:\.\/)?assets\/[^"?]+)(?:\?[^"]*)?"/g)) {
    const target = path.join(ROOT, m[1].replace(/^\.\//, ''));
    if (!fs.existsSync(target)) problems.push(`${rel(f)} 引用了不存在的资源：${m[1]}`);
  }
}

/* 输出 */
console.log('发布前自检');
console.log('─'.repeat(56));
if (notes.length) notes.forEach((n) => console.log('  ℹ️  ' + n));
const total = walk(ROOT).filter((f) => TEXT.test(f)).length;
console.log(`  扫描文本文件 ${total} 个`);
if (problems.length === 0) {
  console.log('\n✅ 通过：没有冲突标记、脚本可编译、config.js 可加载且键唯一、资源齐全');
  process.exit(0);
}
console.log(`\n❌ 发现 ${problems.length} 个问题（**不要部署**）：`);
problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
process.exit(1);
