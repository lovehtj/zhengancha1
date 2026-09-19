/* ============================================================
 * qr.js — 极简二维码生成器（无任何依赖，无 CDN，可离线）
 * ------------------------------------------------------------
 * 为什么自己写：官网要能在纯离线/内网环境下打开，且下载二维码必须
 * 随 config.js 里的网址即时变化（不能依赖某个在线二维码 API）。
 *
 * 实现范围（够用且经过交叉验证）：
 *   · 字节模式（UTF-8），纠错等级 M
 *   · 版本 1~10 自动选择（版本 10 可容纳 213 字节，足够放长网址）
 *   · 完整 Reed-Solomon 纠错、8 种掩码自动择优、格式信息/版本信息
 *   · 输出 SVG（矢量，任意缩放不糊）
 *
 * 正确性验证：工具/校验二维码.js 会把本文件的模块矩阵与
 * Apple CoreImage（CIQRCodeGenerator，系统实现）逐模块比对。
 * ============================================================ */
(function (root) {
  'use strict';

  // 版本 -> [总数据码字, 每块纠错码字, 组1块数, 组1数据码字, 组2块数, 组2数据码字]（纠错等级 M）
  var M_TABLE = {
    1:  [16, 10, 1, 16, 0, 0],
    2:  [28, 16, 1, 28, 0, 0],
    3:  [44, 26, 1, 44, 0, 0],
    4:  [64, 18, 2, 32, 0, 0],
    5:  [86, 24, 2, 43, 0, 0],
    6:  [108, 16, 4, 27, 0, 0],
    7:  [124, 18, 4, 31, 0, 0],
    8:  [154, 22, 2, 38, 2, 39],
    9:  [182, 22, 3, 36, 2, 37],
    10: [216, 26, 4, 43, 1, 44]
  };

  // 校正图形中心坐标（版本 1 无）
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  var MAX_VERSION = 10;

  // ---------- GF(256) ----------
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // 本原多项式
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  // 生成多项式
  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], 1);
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  // 计算纠错码字
  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j + 1], factor);
    }
    return res;
  }

  // ---------- 数据编码 ----------
  function utf8Bytes(str) {
    var out = [], s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= MAX_VERSION; v++) {
      var spec = M_TABLE[v];
      var capacity = spec[0] - (v <= 9 ? 2 : 3); // 模式指示符 4bit + 长度指示符（v1-9 为 8bit）
      if (byteLen <= capacity) return v;
    }
    return 0;
  }

  function buildCodewords(bytes, version) {
    var spec = M_TABLE[version];
    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }
    push(4, 4);                                 // 字节模式
    push(bytes.length, version <= 9 ? 8 : 16);  // 字符计数
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    // 结束符 + 补齐到字节边界
    var totalDataBits = spec[0] * 8;
    for (var t = 0; t < 4 && bits.length < totalDataBits; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    // 填充码字
    var pads = [0xec, 0x11], p = 0;
    while (bits.length < totalDataBits) {
      push(pads[p++ % 2], 8);
    }
    var cw = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byteVal = 0;
      for (var k = 0; k < 8; k++) byteVal = (byteVal << 1) | bits[b + k];
      cw.push(byteVal);
    }
    return cw;
  }

  function interleave(cw, version) {
    var spec = M_TABLE[version];
    var ecLen = spec[1], n1 = spec[2], d1 = spec[3], n2 = spec[4], d2 = spec[5];
    var blocks = [], offset = 0;
    for (var i = 0; i < n1; i++) { blocks.push(cw.slice(offset, offset + d1)); offset += d1; }
    for (var j = 0; j < n2; j++) { blocks.push(cw.slice(offset, offset + d2)); offset += d2; }
    var ecBlocks = blocks.map(function (b) { return rsEncode(b, ecLen); });
    var out = [], maxData = Math.max(d1, d2);
    for (var c = 0; c < maxData; c++) {
      for (var bi = 0; bi < blocks.length; bi++) {
        if (c < blocks[bi].length) out.push(blocks[bi][c]);
      }
    }
    for (var e = 0; e < ecLen; e++) {
      for (var bj = 0; bj < ecBlocks.length; bj++) out.push(ecBlocks[bj][e]);
    }
    return out;
  }

  // ---------- 矩阵 ----------
  function buildMatrix(version, codewords, forcedMask) {
    var size = version * 4 + 17;
    var mod = [], fn = [];
    for (var i = 0; i < size; i++) {
      mod.push(new Array(size).fill(0));
      fn.push(new Array(size).fill(false));
    }

    function setFn(x, y, dark) { mod[y][x] = dark ? 1 : 0; fn[y][x] = true; }

    // 定位图形（含分隔符）
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          var d = Math.max(Math.abs(dx), Math.abs(dy));
          setFn(x, y, d !== 2 && d <= 3);
        }
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    // 定时图形
    for (var t = 0; t < size; t++) {
      if (!fn[6][t]) setFn(t, 6, t % 2 === 0);
      if (!fn[t][6]) setFn(6, t, t % 2 === 0);
    }

    // 校正图形
    // 注意：**只跳过三个角**（与定位图形重叠的那三个），不能按"该位置已是功能模块"来跳过——
    // 版本 7 起校正图形会落在定时图形所在的行/列上（如 v7 的 (22,6)），
    // 用"已占用则跳过"会漏画这些校正图形 → 功能模块位置错位 → 整块数据错位、二维码不可扫。
    var coords = ALIGN[version];
    var lastPos = coords.length - 1;
    for (var a = 0; a < coords.length; a++) {
      for (var b = 0; b < coords.length; b++) {
        if ((a === 0 && b === 0) || (a === 0 && b === lastPos) || (a === lastPos && b === 0)) continue;
        var ax = coords[a], ay = coords[b];
        for (var dy2 = -2; dy2 <= 2; dy2++) {
          for (var dx2 = -2; dx2 <= 2; dx2++) {
            setFn(ax + dx2, ay + dy2,
              Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
          }
        }
      }
    }

    // 固定黑模块
    setFn(8, size - 8, true);

    // 预留格式信息区（先占位，选完掩码再写）
    drawFormat(0);

    function drawFormat(mask) {
      var data = (0 << 3) | mask; // 纠错等级 M 的编码为 0
      var rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      for (var j = 0; j <= 5; j++) setFn(8, j, ((bits >>> j) & 1) !== 0);
      setFn(8, 7, ((bits >>> 6) & 1) !== 0);
      setFn(8, 8, ((bits >>> 7) & 1) !== 0);
      setFn(7, 8, ((bits >>> 8) & 1) !== 0);
      for (var k = 9; k < 15; k++) setFn(14 - k, 8, ((bits >>> k) & 1) !== 0);
      for (var m = 0; m < 8; m++) setFn(size - 1 - m, 8, ((bits >>> m) & 1) !== 0);
      for (var n = 8; n < 15; n++) setFn(8, size - 15 + n, ((bits >>> n) & 1) !== 0);
    }

    // 版本信息（版本 >= 7）
    if (version >= 7) {
      var vrem = version;
      for (var vi = 0; vi < 12; vi++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1f25);
      var vbits = (version << 12) | vrem;
      for (var p = 0; p < 18; p++) {
        var bit = ((vbits >>> p) & 1) !== 0;
        var u = Math.floor(p / 3), w = p % 3;
        setFn(size - 11 + w, u, bit);
        setFn(u, size - 11 + w, bit);
      }
    }

    // 数据填充（右下角起，蛇形）
    var idx = 0, total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var col = 0; col < 2; col++) {
          var x2 = right - col;
          var upward = ((right + 1) & 2) === 0;
          var y2 = upward ? size - 1 - vert : vert;
          if (fn[y2][x2]) continue;
          var dark = false;
          if (idx < total) {
            dark = ((codewords[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0;
            idx++;
          }
          mod[y2][x2] = dark ? 1 : 0;
        }
      }
    }

    // 掩码
    function maskFn(mask, x, y) {
      switch (mask) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return (x * y) % 2 + (x * y) % 3 === 0;
        case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
        case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      }
      return false;
    }

    function applyMask(mask) {
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          if (!fn[y][x] && maskFn(mask, x, y)) mod[y][x] ^= 1;
        }
      }
    }

    var best = 0;
    if (forcedMask === undefined || forcedMask === null) {
      var bestPenalty = Infinity;
      for (var mk = 0; mk < 8; mk++) {
        applyMask(mk);
        drawFormat(mk);
        var pen = penalty(mod, size);
        if (pen < bestPenalty) { bestPenalty = pen; best = mk; }
        applyMask(mk); // 还原
      }
    } else {
      best = forcedMask;
    }
    applyMask(best);
    drawFormat(best);

    return { size: size, modules: mod, mask: best, version: version };
  }

  // 4 条掩码罚分规则（用于择优；只影响"选哪个掩码"，不影响可扫性）
  function penalty(mod, size) {
    var score = 0;
    // 规则1：连续同色
    for (var y = 0; y < size; y++) {
      var run = 1;
      for (var x = 1; x < size; x++) {
        if (mod[y][x] === mod[y][x - 1]) { run++; }
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (var x2 = 0; x2 < size; x2++) {
      var run2 = 1;
      for (var y2 = 1; y2 < size; y2++) {
        if (mod[y2][x2] === mod[y2 - 1][x2]) { run2++; }
        else { if (run2 >= 5) score += run2 - 2; run2 = 1; }
      }
      if (run2 >= 5) score += run2 - 2;
    }
    // 规则2：2x2 同色块
    for (var yy = 0; yy < size - 1; yy++) {
      for (var xx = 0; xx < size - 1; xx++) {
        var c = mod[yy][xx];
        if (c === mod[yy][xx + 1] && c === mod[yy + 1][xx] && c === mod[yy + 1][xx + 1]) score += 3;
      }
    }
    // 规则3：类似定位图形的 1:1:3:1:1 图案
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function match(arr, i, row, col, horizontal) {
      for (var k = 0; k < 11; k++) {
        var v = horizontal ? mod[row][i + k] : mod[i + k][col];
        if (v !== arr[k]) return false;
      }
      return true;
    }
    for (var i3 = 0; i3 < size; i3++) {
      for (var j3 = 0; j3 + 11 <= size; j3++) {
        if (match(pat1, j3, i3, 0, true) || match(pat2, j3, i3, 0, true)) score += 40;
        if (match(pat1, j3, 0, i3, false) || match(pat2, j3, 0, i3, false)) score += 40;
      }
    }
    // 规则4：黑模块占比
    var dark = 0;
    for (var y3 = 0; y3 < size; y3++) for (var x3 = 0; x3 < size; x3++) dark += mod[y3][x3];
    var percent = dark * 100 / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  function matrix(text, opts) {
    opts = opts || {};
    var bytes = utf8Bytes(text);
    var version = opts.version || pickVersion(bytes.length);
    if (!version) throw new Error('内容过长：' + bytes.length + ' 字节（上限 ' + MAX_VERSION + ' 版本 M 级）');
    var cw = interleave(buildCodewords(bytes, version), version);
    return buildMatrix(version, cw, opts.mask);
  }

  // 输出内联 SVG（可自由缩放、可换色）
  function svg(text, opts) {
    opts = opts || {};
    var m = matrix(text, opts);
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var dim = m.size + quiet * 2;
    var dark = opts.dark || '#0b1f16';
    var light = opts.light || '#ffffff';
    var path = [];
    for (var y = 0; y < m.size; y++) {
      for (var x = 0; x < m.size; x++) {
        if (m.modules[y][x]) path.push('M' + (x + quiet) + ' ' + (y + quiet) + 'h1v1h-1z');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
      '" shape-rendering="crispEdges" role="img" aria-label="下载二维码">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path d="' + path.join('') + '" fill="' + dark + '"/></svg>';
  }

  root.QR = { matrix: matrix, svg: svg, MAX_VERSION: MAX_VERSION, _table: M_TABLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.QR;
})(typeof window !== 'undefined' ? window : globalThis);
