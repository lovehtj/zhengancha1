/* ============================================================
   证安查官网 · 交互脚本（原生 JS，无依赖）
   1) 依据 assets/config.js 实时生成下载二维码（assets/qr.js）
   2) 三类台账标签切换  3) 滚动出现  4) 复制链接  5) 目录高亮
   ============================================================ */
(function () {
  'use strict';
  var C = window.ZAC_CONFIG || {};

  /* ---------- 地址解析 ---------- */
  function baseUrl() {
    if (C.siteUrl && /^https?:\/\//i.test(C.siteUrl)) return C.siteUrl.replace(/\/+$/, '/');
    if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      return location.origin + location.pathname.replace(/[^/]*$/, '');
    }
    return '';
  }
  function absUrl(p) {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    var b = baseUrl();
    return b ? b + String(p).replace(/^\/+/, '') : '';
  }

  var URLS = {
    site: baseUrl(),
    ios: absUrl(C.iosUrl),
    android: absUrl(C.androidPath)
  };

  /* ---------- 二维码渲染 ---------- */
  function renderQr(el) {
    var key = el.getAttribute('data-qr');
    var url = URLS[key];
    var hint = document.querySelector('[data-qr-url="' + key + '"]');

    if (!url) {
      // 未配置（或本地 file:// 打开）时给出明确指引，而不是画一个扫不开的码
      el.innerHTML = '<div class="qr-fallback">' +
        (key === 'ios'
          ? 'iOS 版请在 App Store 搜索「证安查」<br><span style="font-size:12px">（在 config.js 填入 iosUrl 后自动生成扫码入口）</span>'
          : '二维码待生成<br><span style="font-size:12px">部署到 http(s) 后自动生成；<br>也可在 config.js 里填写 siteUrl</span>') +
        '</div>';
      if (hint) hint.textContent = key === 'ios' ? 'App Store 搜索：证安查' : '—';
      return;
    }
    try {
      el.innerHTML = window.QR.svg(url, { quiet: 3, dark: '#0b1f16', light: '#ffffff' });
      if (hint) hint.textContent = url;
    } catch (e) {
      el.innerHTML = '<div class="qr-fallback">二维码生成失败：' + e.message + '</div>';
      if (hint) hint.textContent = url;
    }
  }

  function bindCopy() {
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-copy]');
      if (!btn) return;
      var val = btn.getAttribute('data-copy');
      if (val === 'site' || val === 'android' || val === 'ios') val = URLS[val] || '';
      if (!val) { toast('暂无可复制的地址'); return; }
      var done = function () { toast('已复制：' + val); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(done, function () { legacyCopy(val, done); });
      } else { legacyCopy(val, done); }
    });
  }
  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:99;' +
        'background:#0c1f17;color:#fff;padding:11px 18px;border-radius:999px;font-size:14px;' +
        'box-shadow:0 12px 30px -10px rgba(0,0,0,.5);opacity:0;transition:opacity .2s;max-width:86vw;' +
        'overflow-wrap:anywhere;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 2200);
  }

  /* ---------- 标签切换 ---------- */
  function bindTabs() {
    document.querySelectorAll('[data-tabs]').forEach(function (group) {
      var tabs = group.querySelectorAll('.tab');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) {
            var on = t === tab;
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            var panel = document.getElementById(t.getAttribute('aria-controls'));
            if (panel) panel.classList.toggle('is-on', on);
          });
        });
        tab.addEventListener('keydown', function (e) {
          var list = Array.prototype.slice.call(tabs);
          var i = list.indexOf(tab);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            var n = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
            n.focus(); n.click();
          }
        });
      });
    });
  }

  /* ---------- 滚动出现 ---------- */
  function bindReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 顶栏阴影 ---------- */
  function bindNav() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- 目录高亮 ---------- */
  function bindToc() {
    var links = document.querySelectorAll('.toc a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var a = map[en.target.id];
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-84px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- 版本号注入 ---------- */
  function fillVersion() {
    document.querySelectorAll('[data-version]').forEach(function (el) {
      el.textContent = C.version || '';
    });
    document.querySelectorAll('[data-build]').forEach(function (el) {
      el.textContent = C.build || '';
    });
    document.querySelectorAll('[data-as-version]').forEach(function (el) {
      el.textContent = C.appStoreVersion || '';
    });
    document.querySelectorAll('[data-as-build]').forEach(function (el) {
      el.textContent = C.appStoreBuild || '';
    });
    // iOS 上架包已提交、尚未过审时，页面上如实标注「审核中」。
    // 过审后把 config.js 的 appStoreInReview 改成 false，这些标注自动隐藏。
    var inReview = C.appStoreInReview === true;
    document.querySelectorAll('[data-as-review]').forEach(function (el) {
      el.hidden = !inReview;
    });
    document.querySelectorAll('[data-apk-size]').forEach(function (el) {
      el.textContent = C.apkSize || '';
    });
    document.querySelectorAll('[data-ios-size]').forEach(function (el) {
      el.textContent = C.iosSize || '';
    });
    document.querySelectorAll('[data-min-android]').forEach(function (el) {
      el.textContent = C.minAndroid || '';
    });
    document.querySelectorAll('[data-min-ios]').forEach(function (el) {
      el.textContent = C.minIOS || '';
    });
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
    // 隐私政策链接可指向站外（与 App Store Connect 填写的一致）
    if (C.privacyUrl) {
      document.querySelectorAll('[data-policy-link]').forEach(function (a) { a.href = C.privacyUrl; });
    }
    document.querySelectorAll('[data-contact]').forEach(function (el) {
      if (C.contactEmail) {
        el.textContent = C.contactEmail;
        if (el.tagName === 'A') el.href = 'mailto:' + C.contactEmail;
      }
    });
  }

  /* 下载/跳转链接统一处理：
     · iOS：配置了 iosUrl → 按钮直连 App Store；未配置 → 指向 App Store 搜索页
       （宁可给一个能用但文案诚实的按钮，也不要一个点不动的死按钮）
     · Android：配置了 APK 地址 → 直链并触发下载 */
  function bindDownloadLinks() {
    document.querySelectorAll('[data-ios-link]').forEach(function (el) {
      if (URLS.ios) {
        el.href = URLS.ios;
        el.target = '_blank';
        el.rel = 'noopener';
        el.removeAttribute('data-ios-fallback');
      } else {
        el.href = 'https://apps.apple.com/cn/search?term=' + encodeURIComponent('证安查');
        el.target = '_blank';
        el.rel = 'noopener';
        el.textContent = '在 App Store 搜索';
        el.setAttribute('data-ios-fallback', '1');
      }
    });
    document.querySelectorAll('[data-android-link]').forEach(function (el) {
      if (!URLS.android) {
        el.classList.add('is-disabled');
        el.textContent = '部署后自动生效';
        return;
      }
      // 自动区分「APK 直链」和「下载落地页」：前者触发下载，后者只是跳转。
      // 落地页加 download 属性没有意义（跨域会被忽略），文案也要跟着改，否则用户以为点错。
      var isLanding = typeof C.androidIsLanding === 'boolean'
        ? C.androidIsLanding
        : !/\.apk(\?|#|$)/i.test(URLS.android);
      el.href = URLS.android;
      if (isLanding) {
        el.removeAttribute('download');
        el.target = '_blank';
        el.rel = 'noopener';
        el.textContent = '打开安卓下载页';
      } else {
        el.setAttribute('download', '');
        el.textContent = '下载 APK';
      }
      el.setAttribute('data-android-landing', isLanding ? '1' : '0');
    });
    /* og:image / og:url 相对路径对社交平台抓取无效，运行时补成绝对地址 */
    var b = baseUrl();
    if (b) {
      document.querySelectorAll('meta[property="og:image"]').forEach(function (m) {
        if (!/^https?:/i.test(m.getAttribute('content') || '')) {
          m.setAttribute('content', b + String(m.getAttribute('content') || '').replace(/^\/+/, ''));
        }
      });
      document.querySelectorAll('meta[property="og:url"]').forEach(function (m) {
        m.setAttribute('content', b);
      });
    }

    /* 结构化数据里补上下载地址，便于搜索引擎收录 */
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (tag) {
      try {
        var data = JSON.parse(tag.textContent);
        if (URLS.ios) { data.downloadUrl = URLS.ios; data.installUrl = URLS.ios; }
        if (URLS.android) data.downloadUrl = data.downloadUrl || URLS.android;
        if (C.appStoreVersion) data.softwareVersion = C.appStoreVersion;
        tag.textContent = JSON.stringify(data);
      } catch (e) { /* 结构化数据有问题不影响页面 */ }
    });
  }

  function boot() {
    fillVersion();
    bindDownloadLinks();
    document.querySelectorAll('[data-qr]').forEach(renderQr);
    bindTabs(); bindReveal(); bindNav(); bindCopy(); bindToc();
  }
  // 脚本在 body 末尾执行时 DOMContentLoaded 尚未触发；但若被 defer/异步加载则可能已触发，
  // 两种情形都要能初始化。
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
