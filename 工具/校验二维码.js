/* 交叉验证 assets/qr.js：把它的模块矩阵与 Apple CoreImage（CIQRCodeGenerator）逐模块比对。
 * 用法：node 工具/校验二维码.js
 * 依赖：macOS 自带 swift（无需额外安装）
 */
const { execFileSync } = require('child_process');
const path = require('path');
const QR = require(path.join(__dirname, '..', 'assets', 'qr.js'));

const SWIFT = path.join(__dirname, 'apple_qr.swift');

function appleMatrix(text) {
  const out = execFileSync('swift', [SWIFT, text], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const lines = out.trim().split('\n');
  const [w, h] = lines[0].split('x').map(Number);
  const rows = lines.slice(1);
  if (rows.length !== h) throw new Error('行数不符');
  return rows.map((r) => r.split('').map((c) => (c === '1' ? 1 : 0)));
}

// CoreImage 的输出带 1 个模块宽的静默区（尺寸 = 4v+17+2），比对前裁掉边框
function stripBorder(m, n) {
  return m.slice(n, m.length - n).map((row) => row.slice(n, row.length - n));
}

function same(a, b) {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    if (a[y].length !== b[y].length) return false;
    for (let x = 0; x < a[y].length; x++) if (a[y][x] !== b[y][x]) return false;
  }
  return true;
}

function diffCount(a, b) {
  let n = 0;
  for (let y = 0; y < Math.min(a.length, b.length); y++) {
    for (let x = 0; x < Math.min(a[y].length, b[y].length); x++) if (a[y][x] !== b[y][x]) n++;
  }
  return n;
}

// 说明：Apple 的实现会对含数字的串做「数字模式+字节模式」混合分段优化，
// 因此这类串无法逐模块比对（模式不同、数据码字自然不同，但两者都合规可扫）。
// 下面这组用例刻意**不含数字**，强制双方都走纯字节模式，
// 从而把版本选择、RS 纠错、交织、模块布局、格式信息、v7+ 版本信息、掩码择优全部覆盖到。
const A = (n) => 'a'.repeat(n);
const CASES = [
  // 版本 1~2
  'https://zac.leato.top/',
  '证安查官网下载',
  // 版本 3
  'https://zac.leato.top/download/?os=android',
  // 版本 4（强制字节模式）
  'https://zac.leato.top/' + A(26),
  // 版本 5~6
  'https://zac.leato.top/' + A(60),
  'https://zac.leato.top/' + A(85),
  // 版本 7（开始出现版本信息模块）
  'https://zac.leato.top/' + A(105),
  // 版本 8
  'https://zac.leato.top/' + A(135),
  // 版本 10
  'https://zac.leato.top/' + A(190),
  // 含中文的长串（UTF-8 多字节 + 高位字节）
  'https://zac.leato.top/下载/扫码安装.html?channel=' + A(20),
];

let pass = 0, fail = 0;
for (const text of CASES) {
  const raw = appleMatrix(text);
  let mine, err = null;
  try { mine = QR.matrix(text).modules; } catch (e) { err = e.message; }
  if (err) { console.log(`✗ ${text}\n   qr.js 报错: ${err}`); fail++; continue; }

  // 依次尝试 0/1/2 模块边框，找到尺寸匹配的裁剪方式
  let apple = null, border = -1;
  for (const b of [0, 1, 2]) {
    if (raw.length - b * 2 === mine.length) { apple = stripBorder(raw, b); border = b; break; }
  }
  if (!apple) {
    console.log(`✗ 尺寸不一致  ${text}\n   apple=${raw.length} (裁边后需等于) mine=${mine.length}`);
    fail++;
    continue;
  }

  if (same(apple, mine)) {
    console.log(`✓ 完全一致  ${mine.length}×${mine.length} (苹果侧裁掉 ${border} 模块静默区)  ${text}`);
    pass++;
    continue;
  }
  const d = diffCount(apple, mine);
  let note = `尺寸一致(${mine.length}×${mine.length}) 差异模块=${d}`;
  const hits = [];
  for (let mk = 0; mk < 8; mk++) {
    if (same(apple, QR.matrix(text, { mask: mk }).modules)) hits.push(mk);
  }
  note += hits.length ? `  （仅掩码不同：Apple 用掩码 ${hits.join(',')}）` : '  （数据/纠错/布局不同——实现有误）';
  console.log(`✗ 不一致  ${text}\n   ${note}`);
  fail++;
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
