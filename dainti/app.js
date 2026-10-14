/* ===== 江汉区老旧电梯更新项目 · 进度看台 v0.2 =====
   数据源:《2026年江汉区老旧电梯更新项目更新计划表》提前批点位进度台账(242 台)
   地图主视图 + 阶段推进漏斗 + 逐点里程碑时间线
*/
(function () {
  'use strict';

  const DATA = window.__PLAN_DATA__;
  if (!DATA) { document.body.innerHTML = '<div style="padding:40px;color:#fff">数据未加载：请先运行 scripts/build_dataset.py</div>'; return; }

  const META = DATA.meta;
  const ALL = DATA.points.slice();
  const STAGES = META.stages;                       // [{code,name}]
  const RANK = {}; STAGES.forEach((s, i) => RANK[s.code] = i);
  const COM = {};
  DATA.communities.forEach(c => COM[c.community] = c);

  /* ---- 进度阶段分组(地图着色用 6 档,比 12 档易读) ---- */
  const GROUPS = [
    { id: 'G0', name: '未启动', from: 0, to: 0, color: '#64748b', desc: '品牌未定' },
    { id: 'G1', name: '品牌与方案', from: 1, to: 3, color: '#6366f1', desc: '品牌/组价/跟审' },
    { id: 'G2', name: '公示与投票', from: 4, to: 6, color: '#a855f7', desc: '公示/征询/结果' },
    { id: 'G3', name: '签约与到货', from: 7, to: 8, color: '#f59e0b', desc: '协议/到货' },
    { id: 'G4', name: '施工中', from: 9, to: 9, color: '#22c55e', desc: '已开工' },
    { id: 'G5', name: '完工验收', from: 10, to: 11, color: '#14b8a6', desc: '完工/特检移交' },
  ];
  const GROUP_OF = {};
  STAGES.forEach((s, i) => { GROUP_OF[s.code] = GROUPS.find(g => i >= g.from && i <= g.to).id; });
  const GROUP_BY_ID = {}; GROUPS.forEach(g => GROUP_BY_ID[g.id] = g);

  const ZONE_COLOR = { '南片区': '#ffb020', '中片区': '#4b9dff', '北片区': '#33d0c0', '其他': '#8b95a8' };
  const BRAND_PALETTE = { '日立': '#33d0c0', '通力': '#4b9dff', '奥的斯': '#a78bfa', '三菱': '#ffb020', '蒂升': '#f472b6', '康力': '#22d3a7', '未确定': '#64748b' };
  const COM_PALETTE = ['#33d0c0', '#4b9dff', '#a78bfa', '#ffb020', '#f472b6', '#22d3a7', '#60a5fa', '#facc15', '#fb923c', '#38bdf8', '#c084fc', '#4ade80'];

  /* ---------------- 坐标:WGS-84 -> GCJ-02 ---------------- */
  const PI = Math.PI, A = 6378245.0, EE = 0.00669342162296594323;
  const outOfChina = (lat, lng) => !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  function tLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return r;
  }
  function tLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return r;
  }
  function wgs84ToGcj02(lat, lng) {
    if (outOfChina(lat, lng)) return [lat, lng];
    let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * PI;
    let magic = Math.sin(radLat); magic = 1 - EE * magic * magic;
    const sq = Math.sqrt(magic);
    dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sq) * PI);
    dLng = (dLng * 180) / ((A / sq) * Math.cos(radLat) * PI);
    return [lat + dLat, lng + dLng];
  }

  /* ---- 点位坐标:小区中心 + 已在构建阶段算好的展开偏移 ---- */
  ALL.forEach(p => {
    const [glat, glng] = wgs84ToGcj02(p._clat != null ? p._clat : p.lat, p._clng != null ? p._clng : p.lng);
    p._lat = glat; p._lng = glng; p._group = GROUP_OF[p.stage]; p._rank = RANK[p.stage];
  });
  const COMMUNITIES = DATA.communities.map(c => {
    const [glat, glng] = wgs84ToGcj02(c.lat, c.lng);
    return { ...c, _lat: glat, _lng: glng, points: ALL.filter(p => p.community === c.community) };
  });
  const STREETS = Object.keys(META.byStreet).sort((a, b) => META.byStreet[b] - META.byStreet[a]);
  const BRANDS = Object.keys(META.byBrand).sort((a, b) => META.byBrand[b] - META.byBrand[a]);

  const RISK_COLOR = { high: '#ef4444', watch: '#f59e0b', notstarted: '#64748b', ok: '#22c55e', };
  const RISK_NAME = { high: '高风险', watch: '关注', notstarted: '未启动', ok: '正常' };
  const RISK_ORDER = ['high', 'watch', 'notstarted', 'ok'];

  const state = {
    view: 'point', map: 'standard', colorBy: 'stage',
    streetOn: new Set(STREETS), groupOn: new Set(GROUPS.map(g => g.id)),
    brandOn: new Set(BRANDS), riskOn: new Set(RISK_ORDER),
    q: '', showHull: true, reviewOnly: false,
    tab: 'funnel', tlMode: 'month', tlOpen: false,
    riskThreshold: 60, personOn: new Set(),
    selected: null, selectedCommunity: null,
  };

  /* ---- 联系人:小区 -> 人名列表(前端复刻 Python 侧的拆分规则) ---- */
  function splitPeople(raw) {
    if (!raw) return [];
    let t = String(raw);
    t = t.replace(/1[3-9]\d{9}/g, '').replace(/[（(][^）)]*[）)]/g, '');
    return t.split(/[、,，/／\s]+/).filter(Boolean);
  }
  const COM_PEOPLE = {};
  DATA.communities.forEach(c => {
    const set = new Set();
    Object.values(c.contacts || {}).forEach(v => splitPeople(v).forEach(n => set.add(n)));
    COM_PEOPLE[c.community] = [...set];
  });
  ALL.forEach(p => { p._people = COM_PEOPLE[p.community] || []; });

  /* ---- 风险:阈值可调,默认 60/30 天(与构建侧一致) ---- */
  function riskOf(p) {
    if (p.risk === 'notstarted') return 'notstarted';
    if (p._rank >= 9) return 'ok';
    const d = p.stalledDays;
    if (d == null) return 'notstarted';
    const hi = state.riskThreshold;
    if (d > hi) return 'high';
    if (d > hi / 2) return 'watch';
    return 'ok';
  }
  const riskCount = k => visible().filter(p => riskOf(p) === k).length;

  /* ---- 停滞最久的点位(风险清单) ---- */
  function stalledList(level) {
    return visible().filter(p => riskOf(p) === level && p.stalledDays != null)
      .sort((a, b) => b.stalledDays - a.stalledDays);
  }

  /* ---------------- 过滤 ---------------- */
  const hit = p => (!state.reviewOnly || p.geoConfidence === 'review')
    && state.streetOn.has(p.street) && state.groupOn.has(p._group)
    && state.brandOn.has(p.brand || '未确定') && state.riskOn.has(riskOf(p))
    && (state.personOn.size === 0 || p._people.some(n => state.personOn.has(n)))
    && (!state.q || (p.address + p.community + p.street + (p.deviceCode || '') + (p.brand || '')).toLowerCase().includes(state.q));
  const visible = () => ALL.filter(hit);

  function pointColor(p) {
    if (state.colorBy === 'risk') return RISK_COLOR[riskOf(p)];
    if (state.colorBy === 'stage') return GROUP_BY_ID[p._group].color;
    if (state.colorBy === 'zone') return ZONE_COLOR[p.zone] || '#8b95a8';
    return BRAND_PALETTE[p.brand] || '#64748b';
  }
  // 小区取"最差"档:只要有一台高风险,小区就按高风险显示,便于一眼定位问题小区
  function comColor(c) {
    if (state.colorBy === 'risk') {
      const rs = c.points.map(riskOf);
      for (const k of ['high', 'watch', 'notstarted', 'ok']) if (rs.includes(k)) return RISK_COLOR[k];
      return '#64748b';
    }
    if (state.colorBy === 'stage') return GROUP_BY_ID[GROUP_OF[c.maxStage]].color;
    if (state.colorBy === 'zone') return ZONE_COLOR[c.zone];
    return BRAND_PALETTE[c.brands[0]] || '#64748b';
  }

  /* ---------------- 地图 ---------------- */
  const map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([30.612, 114.262], 12);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const TILES = {
    standard: { url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', sub: '1234', max: 18 },
    satellite: { url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', sub: '1234', max: 18 },
    dark: { url: 'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}', sub: '1234', max: 18 },
  };
  let tileLayer = null;
  function setBasemap(kind) {
    const t = TILES[kind];
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(t.url, { subdomains: t.sub, maxZoom: t.max, maxNativeZoom: 18 }).addTo(map);
    if (kind === 'dark') tileLayer.getContainer().style.filter = 'invert(1) hue-rotate(190deg) brightness(.85) contrast(1.05)';
  }
  setBasemap('standard');

  const layers = { hull: L.layerGroup().addTo(map), markers: L.layerGroup().addTo(map), heat: L.layerGroup().addTo(map) };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v + amt));
    return '#' + ((cl(n >> 16) << 16) | (cl((n >> 8) & 255) << 8) | cl(n & 255)).toString(16).padStart(6, '0');
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* 片区凸包 */
  function convexHull(pts) {
    if (pts.length < 3) return pts;
    const s = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const build = arr => { const st = []; for (const p of arr) { while (st.length >= 2 && cross(st[st.length - 2], st[st.length - 1], p) <= 0) st.pop(); st.push(p); } return st; };
    return build(s).slice(0, -1).concat(build(s.reverse()).slice(0, -1));
  }
  function drawHulls() {
    layers.hull.clearLayers();
    if (!state.showHull) return;
    if (state.colorBy !== 'zone' && map.getZoom() >= 15) return;
    Object.keys(META.zones).forEach(z => {
      const pts = ALL.filter(p => p.zone === z).map(p => [p._lat, p._lng]);
      if (new Set(pts.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6))).size < 3) return;
      const hull = convexHull(pts);
      if (hull.length < 3) return;
      const c = ZONE_COLOR[z] || '#8b95a8';
      const cy = hull.reduce((s, p) => s + p[0], 0) / hull.length, cx = hull.reduce((s, p) => s + p[1], 0) / hull.length;
      L.polygon(hull.map(p => [cy + (p[0] - cy) * 1.14, cx + (p[1] - cx) * 1.14]), {
        color: c, weight: 1.3, opacity: .65, fillColor: c, fillOpacity: .045, dashArray: '6 6', interactive: false,
      }).addTo(layers.hull);
    });
  }

  function pinRadius(floors) { return Math.max(6, Math.min(17, 5.5 + ((floors || 8) - 7) * 1.4)); }

  function drawPoints() {
    layers.markers.clearLayers();
    const vis = visible();
    const showLabel = map.getZoom() >= 15;
    vis.forEach(p => {
      const c = pointColor(p), r = pinRadius(p.floors);
      const sel = state.selected && state.selected.seq === p.seq;
      const m = L.marker([p._lat, p._lng], {
        icon: L.divIcon({
          className: '', iconSize: [r, r], iconAnchor: [r / 2, r / 2],
          html: `<div class="pin${sel ? ' sel' : ''}${p.geoConfidence === 'review' ? ' review' : ''}"
            style="width:${r}px;height:${r}px;
            background:radial-gradient(circle at 32% 30%, ${shade(c, 40)}, ${shade(c, -35)})"></div>`,
        }),
        zIndexOffset: sel ? 1000 : 0,
      });
      m.bindTooltip(`<b>${p.community}</b>${p.geoConfidence === 'review' ? ' <span style="color:#ffb020">· 坐标待复核</span>' : ''}<br>${STAGES[p._rank].name} · ${p.brand || '品牌未定'}<br>${p.floors}层 · ${p.households}户`
        + (p.dates && Object.keys(p.dates).length ? `<br><span style="opacity:.7">${Object.entries(p.dates).slice(-2).map(([k, v]) => k + ' ' + v).join('<br>')}</span>` : ''),
        { className: 'jh-tip', direction: 'top', offset: [0, -r / 2], opacity: 1 });
      m.on('click', () => selectPoint(p, true));
      m.addTo(layers.markers);
      if (showLabel && (sel || vis.length <= 60)) {
        L.marker([p._lat, p._lng], {
          interactive: false,
          icon: L.divIcon({ className: '', html: `<div class="clabel" style="transform:translate(-50%,0) translateY(${r / 2 + 2}px)">${p.address.slice(0, 10)}</div>` }),
        }).addTo(layers.markers);
      }
    });
  }

  function drawCommunities() {
    layers.markers.clearLayers();
    const maxE = Math.max(...COMMUNITIES.map(c => c.elevators));
    COMMUNITIES.forEach(c => {
      const on = c.points.some(hit);
      const cnt = c.points.filter(hit).length;
      const r = 13 + Math.sqrt(c.elevators / maxE) * 27;
      const col = comColor(c);
      const sel = state.selectedCommunity === c.community;
      const m = L.marker([c._lat, c._lng], {
        icon: L.divIcon({
          className: '', iconSize: [r, r], iconAnchor: [r / 2, r / 2],
          html: `<div class="ccluster" style="width:${r}px;height:${r}px;font-size:${r > 34 ? 15 : 12}px;
            background:radial-gradient(circle at 34% 30%, ${shade(col, 38)}, ${col});
            ${sel ? 'box-shadow:0 0 0 5px rgba(51,208,192,.45),0 3px 16px rgba(0,0,0,.6);' : ''}
            ${on ? '' : 'opacity:.16;filter:grayscale(.8)'}">${cnt}</div>`,
        }),
        zIndexOffset: sel ? 1000 : 0,
      });
      m.bindTooltip(`<b>${c.community}</b><br>${c.street}街道 · ${cnt}/${c.elevators} 台<br>最远 ${STAGES[RANK[c.maxStage]].name}`,
        { className: 'jh-tip', direction: 'top', offset: [0, -r / 2], opacity: 1 });
      m.on('click', () => selectCommunity(c, true));
      m.addTo(layers.markers);
      if (on) L.marker([c._lat, c._lng], {
        interactive: false,
        icon: L.divIcon({ className: '', html: `<div class="clabel" style="transform:translate(-50%,0) translateY(${r / 2 + 2}px)">${c.community}</div>` }),
      }).addTo(layers.markers);
    });
  }

  let heatLayer = null;
  function drawHeat() {
    layers.heat.clearLayers();
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    const vis = visible();
    if (!vis.length) return;
    const R = 44, pad = R * 2;
    const Layer = L.Layer.extend({
      onAdd(m) {
        this._cv = L.DomUtil.create('canvas', 'leaflet-zoom-animated');
        m.getPanes().overlayPane.appendChild(this._cv);
        m.on('moveend zoomend', this._reset, this); this._reset();
      },
      onRemove(m) { m.off('moveend zoomend', this._reset, this); L.DomUtil.remove(this._cv); },
      _reset() {
        const size = map.getSize(), tl = map.containerPointToLayerPoint([0, 0]);
        const cv = this._cv, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
        cv.width = (size.x + pad * 2) * dpr; cv.height = (size.y + pad * 2) * dpr;
        cv.style.width = (size.x + pad * 2) + 'px'; cv.style.height = (size.y + pad * 2) + 'px';
        L.DomUtil.setPosition(cv, tl.subtract([pad, pad]));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = 'lighter';
        vis.forEach(p => {
          const pt = map.latLngToContainerPoint([p._lat, p._lng]);
          const x = pt.x + pad, y = pt.y + pad;
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          const col = pointColor(p);
          g.addColorStop(0, hexA(col, .5)); g.addColorStop(.45, hexA(col, .16)); g.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, PI * 2); ctx.fill();
        });
      },
    });
    heatLayer = new Layer(); heatLayer.addTo(map);
  }

  function redraw() {
    drawHulls();
    layers.markers.clearLayers(); layers.heat.clearLayers();
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (state.view === 'point') drawPoints();
    else if (state.view === 'community') drawCommunities();
    else drawHeat();
    updateStatusbar();
  }

  /* ---------------- 顶栏 / KPI ---------------- */
  function renderTopStats() {
    const c = META.counts, pr = META.progress;
    const items = [
      [c.elevators, '电梯总台数', '台'], [pr.started, '已开工 · 台账', '台'],
      [pr.delivered, '到货 · 台账', '台'], [pr.signed, '已签协议 · 台账', '台'],
      [c.households, '涉及居民', '户'],
    ];
    document.getElementById('topStats').innerHTML = items
      .map(([v, l, u]) => `<div class="ts"><b>${v}<small>${u}</small></b><span>${l}</span></div>`).join('');
  }

  function renderKpi() {
    const c = META.counts, pr = META.progress, vis = visible();
    const el = [
      ['筛选台数', vis.length, '台', `共 ${c.elevators} 台`],
      ['涉及小区', new Set(vis.map(p => p.community)).size, '个', `共 ${c.communities} 个`],
      ['涉及居民', vis.reduce((s, p) => s + (p.households || 0), 0), '户', `共 ${c.households} 户`],
      ['未启动', vis.filter(p => p.stage === 'S0').length, '台', `全项目 ${pr.notStarted} 台`],
    ];
    document.getElementById('kpiGrid').innerHTML = el.map(([l, v, u, s]) =>
      `<div class="kpi"><b>${v}<small>${u}</small></b><span>${l}</span>
        <span style="color:var(--txt-3);font-size:9.5px">${s}</span></div>`).join('');

    const pct = n => vis.length ? (vis.filter(p => p._rank >= n).length / vis.length * 100) : 0;
    const cnt = n => vis.filter(p => p._rank >= n).length;
    document.getElementById('coverage').innerHTML = `
      <div class="cov-row"><span class="lbl">已开工</span><span class="cov-bar">
        <i style="width:${pct(9)}%;background:linear-gradient(90deg,#22c55e,#14b8a6)"></i></span>
        <span class="val">${cnt(9)}/${vis.length}</span></div>
      <div class="cov-row"><span class="lbl">已到货</span><span class="cov-bar">
        <i style="width:${pct(8)}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></i></span>
        <span class="val">${cnt(8)}/${vis.length}</span></div>
      <div class="cov-row"><span class="lbl">过公示投票</span><span class="cov-bar">
        <i style="width:${pct(5)}%;background:linear-gradient(90deg,#a855f7,#d946ef)"></i></span>
        <span class="val">${cnt(5)}/${vis.length}</span></div>`;
    document.getElementById('sourceHint').textContent = `台账 ${c.elevators} 台 · 计划 ${c.planned} 台`;
  }

  /* ---------------- 阶段推进漏斗 ---------------- */
  // 官方漏斗阶段 -> 台账阶段码(两口径对账用)
  const FUNNEL_MAP = {
    '已确定品牌': null, '分包厂家方案组价完成': 'S2', '总包汇总提供方案组价审计审核': null,
    '跟审出具意见': 'S3', '方案公告公示完成': 'S4', '意见征询投票': 'S5',
    '意见结果公示': 'S6', '协议书签订': 'S7', '电梯到货': 'S8', '电梯开工': 'S9', '特将验收': 'S11',
  };
  const FUNNEL_TO_STAGE = {
    '已确定品牌': '品牌确定时间', '分包厂家方案组价完成': '方案组价完成', '总包汇总提供方案组价审计审核': '价格审计审核',
    '跟审出具意见': '跟审出具意见', '方案公告公示完成': '方案公告公示完成时间', '意见征询投票': '意见征询投票',
    '意见结果公示': '意见公示', '协议书签订': '协议书签订', '电梯到货': '到货时间', '电梯开工': '开工日期',
    '特将验收': '特检报告日期',
  };
  const BRAND_STAGES = new Set(['已确定品牌', '有意向品牌', '无意向品牌']);
  function renderFunnel() {
    // 前 3 行是"品牌确认状态"(互斥分类,不是推进阶段),收成一行摘要,把纵向空间让给真正的漏斗
    const brandRows = META.funnel.filter(f => BRAND_STAGES.has(f.stage));
    const pipeRows = META.funnel.filter(f => !BRAND_STAGES.has(f.stage));
    const brandSummary = `<div class="fn-brand">${brandRows.map(f => {
      const tot = brandRows.reduce((a, b) => a + b.count, 0) || 1;
      const col = f.stage[0] === '已' && f.stage.includes('确定') ? '#6366f1' : f.count === 0 ? '#475569' : '#f59e0b';
      return `<span class="fn-brand-item"><i style="background:${col}"></i>${f.stage.replace('品牌', '')}
        <b>${f.count}</b><em>${(f.count / tot * 100).toFixed(0)}%</em></span>`;
    }).join('')}</div>`;
    const max = Math.max(...pipeRows.map(f => f.count), 1);
    const rows = pipeRows.map(f => {
      const code = FUNNEL_MAP[f.stage];
      const ledger = code ? META.reached[code] : null;
      const gid = code ? GROUP_OF[code] : null;
      const col = gid ? GROUP_BY_ID[gid].color : '#64748b';
      const dim = gid && !state.groupOn.has(gid);
      const warn = (ledger != null && Math.abs(ledger - f.count) > Math.max(3, f.count * 0.12));
      return `<div class="fn-row${gid ? ' clickable' : ''}${dim ? ' dim' : ''}" ${gid ? `data-g="${gid}"` : ''}>
        <div class="fn-top">
          <span class="fn-name"><i class="dot" style="background:${col}"></i>${f.stage}</span>
          <span class="fn-val">${f.count}<small> 台</small></span>
        </div>
        <div class="fn-track"><div class="fn-fill" style="width:${f.count / max * 100}%;
          background:linear-gradient(90deg,${col},${shade(col, -30)})"></div></div>
        <div class="fn-sub"><span>${f.communities || '—'}</span>
          ${ledger != null ? `<span class="${warn ? 'warn' : ''}">台账 ${ledger}${warn ? ' ⚠' : ''}</span>` : ''}</div>
      </div>`;
    }).join('');
    document.getElementById('funnel').innerHTML =
      `<div class="fn-note">官方口径 = 计划表底部汇总；台账 = 逐台里程碑日期反推，不符处标 ⚠</div>`
      + brandSummary + rows
      + `<div class="fn-foot">当前筛选 <b>${visible().length}</b> 台 · ${new Set(visible().map(p => p.community)).size} 个小区</div>`;
    document.querySelectorAll('.fn-row.clickable').forEach(n =>
      n.onclick = () => {
        const g = n.dataset.g;
        state.groupOn.has(g) ? state.groupOn.delete(g) : state.groupOn.add(g);
        renderKpi(); renderFunnel(); renderCommunityList(); redraw();
      });
  }

  /* ---------------- 风险面板 ---------------- */
  function renderRisk() {
    const vis = visible();
    const counts = {}; RISK_ORDER.forEach(k => counts[k] = riskCount(k));
    const list = stalledList('high').concat(stalledList('watch'));
    const cards = RISK_ORDER.map(k => `<div class="risk-card${state.riskOn.has(k) ? '' : ' off'}"
        data-risk="${k}" style="--rc:${RISK_COLOR[k]}">
        <b>${counts[k]}</b><span>${RISK_NAME[k]}</span></div>`).join('');
    const totalStalled = RISK_ORDER.map(k => counts[k]).reduce((a, b) => a + b, 0);
    document.getElementById('riskPanel').innerHTML = `
      <div class="risk-sum">${cards}</div>
      <div class="risk-threshold">停滞阈值
        <select id="riskSel">
          ${[30, 45, 60, 90].map(t => `<option value="${t}"${t === state.riskThreshold ? ' selected' : ''}>
            高风险 &gt; ${t} 天${t === 60 ? '（默认）' : ''}</option>`).join('')}
        </select>
        <span>基准日 ${META.asOf}</span></div>
      <div class="risk-sec">停滞最久的 ${Math.min(list.length, 60)} 台（共 ${list.length} 台需关注）</div>
      <div class="risk-list">
        ${list.slice(0, 60).map(p => {
          const lv = riskOf(p);
          return `<div class="risk-item" data-p="${p.seq}" style="--rc:${RISK_COLOR[lv]}">
            <div class="ri-top"><span class="ri-name">${p.community} · ${p.address.replace(p.community, '').slice(0, 12) || '—'}</span>
              <span class="ri-days">${p.stalledDays} 天</span></div>
            <div class="ri-sub"><span>卡在「${STAGES[p._rank].name}」</span><span>${p.street}街道</span>
              <span>${p.brand || '品牌未定'}</span><span>末次 ${p.lastDate || '—'}</span></div>
          </div>`;
        }).join('') || '<div class="empty">无</div>'}
      </div>`;
    document.querySelectorAll('#riskPanel .risk-card').forEach(n =>
      n.onclick = () => {
        const k = n.dataset.risk;
        state.riskOn.has(k) ? state.riskOn.delete(k) : state.riskOn.add(k);
        apply();
      });
    const sel = document.getElementById('riskSel');
    if (sel) sel.onchange = e => { state.riskThreshold = +e.target.value; apply(); };
    document.querySelectorAll('#riskPanel .risk-item').forEach(n =>
      n.onclick = () => selectPoint(ALL.find(x => x.seq === +n.dataset.p), true));
    document.getElementById('riskBadge').textContent = counts.high;
    document.getElementById('riskBadge').className = counts.high ? '' : 'zero';
  }

  /* ---------------- 联系人面板 ---------------- */
  function renderPeople() {
    const byRole = {};
    (META.contactRoles || []).forEach(r => byRole[r] = []);
    COMMUNITIES.forEach(c => {
      Object.entries(c.contacts || {}).forEach(([role, raw]) => {
        const names = splitPeople(raw);
        names.forEach(n => {
          (byRole[role] = byRole[role] || []).push({ name: n, community: c.community, elevators: c.elevators });
        });
      });
    });
    // 按角色聚合到人
    const agg = (role) => {
      const m = {};
      byRole[role].forEach(x => {
        const a = m[x.name] = m[x.name] || { name: x.name, communities: 0, elevators: 0, phone: null };
        a.communities++; a.elevators += x.elevators;
      });
      return Object.values(m).sort((a, b) => b.elevators - a.elevators);
    };
    const phoneOf = {}; (META.people || []).forEach(p => { if (p.phone) phoneOf[p.name] = p.phone; });
    const groups = (META.contactRoles || []).filter(r => byRole[r] && byRole[r].length);
    document.getElementById('peoplePanel').innerHTML =
      `<div class="pp-role" style="border:0;margin:0 0 2px">共 ${META.people ? META.people.length : 0} 位对接人 ·
        ${state.personOn.size ? `已选 ${state.personOn.size} 人` : '点击任一人筛选地图'}</div>`
      + groups.map(role => `<div class="pp-role">${role}</div>` +
        agg(role).map(x => `<div class="pp${state.personOn.has(x.name) ? ' on' : ''}" data-name="${x.name}">
            <div class="pp-av">${x.name.slice(0, 1)}</div>
            <div><div class="pp-name">${x.name}</div>
              <div class="pp-ph">${phoneOf[x.name] || '—'}</div></div>
            <div class="pp-cnt"><b>${x.elevators}</b>${x.communities} 个小区</div>
          </div>`).join('')).join('')
      + `<div class="pp-role">原表中留空的角色（需补录）</div>
         <div class="risk-sec" style="border:0;color:var(--txt-3);line-height:1.7">
           ${(META.contactRolesEmpty || []).join(' · ')}</div>`;
    document.querySelectorAll('#peoplePanel .pp').forEach(n =>
      n.onclick = () => {
        const nm = n.dataset.name;
        state.personOn.has(nm) ? state.personOn.delete(nm) : state.personOn.add(nm);
        apply();
      });
  }

  /* ---------------- 时间轴 / 甘特 ---------------- */
  function openTimeline(open) {
    state.tlOpen = (open === undefined) ? !state.tlOpen : !!open;
    document.getElementById('timelineDrawer').classList.toggle('open', state.tlOpen);
    document.getElementById('btnTimeline').classList.toggle('on', state.tlOpen);
    // 抽屉改变地图高度,必须让 Leaflet 重新量尺寸
    setTimeout(() => map.invalidateSize(), 240);
    if (state.tlOpen) renderTimeline();
  }

  function renderTimeline() {
    const TL = META.timeline, months = TL.months, st = TL.stages;
    const mLabel = m => `${+m.slice(5, 7)}月`;
    const pal = c => GROUP_BY_ID[GROUP_OF[c]] ? GROUP_BY_ID[GROUP_OF[c]].color : '#64748b';
    const body = document.getElementById('tlBody');
    document.getElementById('tlHint').textContent =
      `基准日 ${META.asOf} · 共 ${Object.values(META.monthTotals).reduce((a, b) => a + b, 0)} 条里程碑记录`;

    if (state.tlMode === 'matrix') {
      // 全为 0 的阶段(尚无任何记录)不占行,否则会挤掉"当月合计"
      const shown = st.filter(x => x.total > 0);
      const zero = st.filter(x => !x.total).map(x => x.name);
      const max = Math.max(...shown.flatMap(x => months.map(m => x.byMonth[m] || 0)), 1);
      body.innerHTML = `<table class="mx">
        <thead><tr><th class="rowh">阶段 \\ 月份</th>${months.map(m => `<th>${mLabel(m)}</th>`).join('')}<th>合计</th></tr></thead>
        <tbody>${shown.map(x => `<tr><th class="rowh"><i class="rowdot" style="background:${pal(x.code)}"></i>${x.name}</th>
          ${months.map(m => { const v = x.byMonth[m] || 0;
            const a = v ? 0.15 + 0.85 * Math.sqrt(v / max) : 0;
            return `<td class="${v ? 'hit' : ''}" style="${v ? `background:${hexA(pal(x.code), a)}` : ''}">${v || ''}</td>`; }).join('')}
          <td class="tot">${x.total}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th class="rowh">当月合计</th>
          ${months.map(m => `<td>${META.monthTotals[m] || 0}</td>`).join('')}
          <td class="tot">${Object.values(META.monthTotals).reduce((a, b) => a + b, 0)}</td></tr></tfoot></table>`
        + (zero.length ? `<div class="mx-zero">尚无任何记录的阶段：${zero.join(' · ')}</div>` : '');
      return;
    }

    // 每月新增(堆叠) 或 累积曲线 —— 两者共用左侧柱状图
    const maxTot = Math.max(...months.map(m => META.monthTotals[m]), 1);
    const bars = `<div class="tl-bars">${months.map(m => {
      const segs = st.map(x => {
        const v = x.byMonth[m] || 0; if (!v) return '';
        return `<i class="tl-bar-seg" style="height:${v / maxTot * 100}%;background:${pal(x.code)}" title="${x.name} ${v}"></i>`;
      }).join('');
      return `<div class="tl-bar-col">
        <div class="tl-bar-num">${META.monthTotals[m]}</div>
        <div class="tl-bar-stack" style="height:${META.monthTotals[m] / maxTot * 170}px">${segs}</div>
        <div class="tl-bar-lbl">${mLabel(m)}</div></div>`;
    }).join('')}</div>`;

    if (state.tlMode === 'month') {
      const legend = st.filter(x => x.total).map(x =>
        `<div class="legend-item"><i class="legend-dot" style="background:${pal(x.code)}"></i>${x.name}<em>${x.total}</em></div>`).join('');
      body.innerHTML = `<div class="tl-chart">${bars}
        <div class="legend-body" style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:5px 14px;align-content:start">${legend}</div></div>`;
      return;
    }

    // 累积曲线:总量 S 曲线 + 各阶段累积
    const W = 100, H = 100;
    const cum = {}; let run = 0;
    months.forEach(m => { run += META.monthTotals[m] || 0; cum[m] = run; });
    const total = run;
    const x = i => months.length === 1 ? W / 2 : i / (months.length - 1) * W;
    const y = v => H - v / total * H;
    const path = months.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(cum[m]).toFixed(2)}`).join(' ');
    const stageLines = st.filter(s => s.total > 0).map(s => {
      let r = 0; const pts = months.map((m, i) => { r += s.byMonth[m] || 0; return `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(r).toFixed(2)}`; }).join(' ');
      return `<path d="${pts}" fill="none" stroke="${pal(s.code)}" stroke-width=".7" opacity=".45"/>`;
    }).join('');
    body.innerHTML = `<div class="tl-chart">${bars}<div class="tl-line">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        ${stageLines}
        <path d="${path}" fill="none" stroke="#33d0c0" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
        ${months.map((m, i) => `<circle cx="${x(i).toFixed(2)}" cy="${y(cum[m]).toFixed(2)}" r="1.4" fill="#33d0c0" vector-effect="non-scaling-stroke"/>`).join('')}
      </svg>
      <div style="position:absolute;left:0;right:0;bottom:-16px;display:flex;justify-content:space-between;font-size:10px;color:var(--txt-3)">
        ${months.map(m => `<span>${mLabel(m)}</span>`).join('')}</div>
      <div style="position:absolute;right:0;top:0;font-size:10px;color:var(--txt-3)">累积里程碑 ${total} 条</div>
    </div></div>`;
  }

  /* ---------------- 街道 / 图例 ---------------- */
  // 街道分布:一条堆叠条 + 紧凑图例(替代原来占一整个卡片的分组柱状图,
  // 把纵向空间让给 14 行阶段漏斗)
  function renderStreetChart() {
    const vis = visible();
    const max = Math.max(...STREETS.map(s => META.byStreet[s]));
    const total = Object.values(META.byStreet).reduce((a, b) => a + b, 0);
    const bar = STREETS.map((s, i) => {
      const on = state.streetOn.has(s);
      const col = COM_PALETTE[i % COM_PALETTE.length];
      return `<i data-street="${s}" title="${s}街道 ${META.byStreet[s]} 台"
        style="width:${META.byStreet[s] / total * 100}%;background:${col};${on ? '' : 'opacity:.2'}"></i>`;
    }).join('');
    const legend = STREETS.map((s, i) => {
      const on = state.streetOn.has(s);
      const cur = vis.filter(p => p.street === s).length;
      const col = COM_PALETTE[i % COM_PALETTE.length];
      return `<span class="ss-item${on ? '' : ' off'}" data-street="${s}">
        <i style="background:${col}"></i>${s}<b>${cur}</b><em>/${META.byStreet[s]}</em></span>`;
    }).join('');
    document.getElementById('streetChart').innerHTML =
      `<div class="ss-bar">${bar}</div><div class="ss-legend">${legend}</div>`;
    document.querySelectorAll('#streetChart [data-street]').forEach(n =>
      n.onclick = () => {
        const s = n.dataset.street;
        state.streetOn.has(s) ? state.streetOn.delete(s) : state.streetOn.add(s);
        syncChips(); apply();
      });
  }

  function renderChips() {
    document.getElementById('streetChips').innerHTML = STREETS.map(s =>
      `<span class="chip${state.streetOn.has(s) ? ' on' : ''}" data-street="${s}">${s}街道</span>`).join('')
      + `<span class="chip" id="chipAll" style="border-style:dashed">全部</span>`
      + (ALL.some(x => x.geoConfidence === 'review')
          ? `<span class="chip${state.reviewOnly ? ' on' : ''}" id="chipReview" title="只显示坐标待现场复核的点位">待复核坐标 ${ALL.filter(x => x.geoConfidence === 'review').length}</span>`
          : `<span class="chip on" style="cursor:default" title="全部点位坐标均经高德 POI 定位并交叉校验">坐标已全部核验 ${ALL.length}</span>`);
    document.querySelectorAll('#streetChips .chip[data-street]').forEach(n =>
      n.onclick = () => {
        const s = n.dataset.street;
        state.streetOn.has(s) ? state.streetOn.delete(s) : state.streetOn.add(s);
        syncChips(); apply();
      });
    const all = document.getElementById('chipAll');
    if (all) all.onclick = () => {
      state.streetOn = state.streetOn.size === STREETS.length ? new Set() : new Set(STREETS);
      syncChips(); apply();
    };
    const rv = document.getElementById('chipReview');
    if (rv) rv.onclick = () => {
      state.reviewOnly = !state.reviewOnly;
      rv.classList.toggle('on', state.reviewOnly);
      apply();
    };
  }
  function syncChips() {
    document.querySelectorAll('#streetChips .chip[data-street]').forEach(n =>
      n.classList.toggle('on', state.streetOn.has(n.dataset.street)));
  }

  function renderLegend() {
    const modes = [['stage', '按阶段'], ['risk', '按风险'], ['zone', '按片区'], ['brand', '按品牌']];
    let body = '';
    if (state.colorBy === 'risk') {
      body = RISK_ORDER.map(k => `<div class="legend-item"><i class="legend-swatch" style="background:${RISK_COLOR[k]}"></i>
        ${RISK_NAME[k]}<em>${riskCount(k)} 台</em></div>`).join('');
    } else if (state.colorBy === 'stage') {
      body = GROUPS.map(g => `<div class="legend-item"><i class="legend-dot" style="background:${g.color}"></i>
        <span>${g.name}<em>${g.desc}</em></span></div>`).join('');
    } else if (state.colorBy === 'zone') {
      body = Object.entries(ZONE_COLOR).filter(([z]) => META.zones[z])
        .map(([z, c]) => `<div class="legend-item"><i class="legend-dot" style="background:${c}"></i>${z}</div>`).join('');
    } else {
      body = BRANDS.map(b => `<div class="legend-item"><i class="legend-dot" style="background:${BRAND_PALETTE[b] || '#64748b'}"></i>
        ${b}<em>${META.byBrand[b]} 台</em></div>`).join('');
    }
    document.getElementById('legend').innerHTML = `
      <div class="legend-title">着色方式</div>
      <div class="seg seg-mini">${modes.map(([k, l]) => `<button data-color="${k}" class="${state.colorBy === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="legend-body">${body}</div>
      <div class="legend-item legend-toggle${state.showHull ? ' on' : ''}" id="hullToggle">
        <i class="legend-box"></i>显示片区包络</div>
      <div class="legend-title" style="margin-top:4px">圆点大小 = 楼层数</div>
      <div class="legend-size"><i style="width:6px;height:6px"></i><span>7层</span>
        <i style="width:11px;height:11px"></i><span>18层</span>
        <i style="width:17px;height:17px"></i><span>30层+</span></div>`;
    document.querySelectorAll('#legend .seg-mini button').forEach(b =>
      b.onclick = () => { state.colorBy = b.dataset.color; renderLegend(); redraw(); renderCommunityList(); });
    const tg = document.getElementById('hullToggle');
    if (tg) tg.onclick = () => { state.showHull = !state.showHull; renderLegend(); redraw(); };
  }

  /* ---------------- 右栏 ---------------- */
  function renderCommunityList() {
    const vis = visible();
    const list = COMMUNITIES.filter(c => c.points.some(hit))
      .sort((a, b) => b.points.filter(hit).length - a.points.filter(hit).length);
    document.getElementById('listCount').textContent = list.length;
    document.getElementById('communityList').innerHTML = list.map(c => {
      const sel = state.selectedCommunity === c.community;
      const cnt = c.points.filter(hit).length;
      const g = GROUP_BY_ID[GROUP_OF[c.maxStage]];
      const done = c.points.filter(p => p._rank >= 9).length;
      return `<div class="cc${sel ? ' sel' : ''}" data-c="${c.community}">
        <div class="cc-hd">
          <span class="cc-name"><i class="dot" style="background:${comColor(c)}"></i><em>${c.community}</em></span>
          <span class="cc-cnt"><b>${cnt}</b>/${c.elevators} 台</span>
        </div>
        <div class="cc-stage">
          <span class="badge" style="background:${hexA(g.color, .16)};border-color:${hexA(g.color, .5)};color:${g.color}">
            ${STAGES[RANK[c.maxStage]].name}</span>
          ${done ? `<span class="badge hi">已开工 ${done}</span>` : ''}
          <span class="cc-meta-inline">${c.street} · ${c.households}户 · 最高${c.maxFloors}层</span>
        </div>
      </div>`;
    }).join('');
    document.querySelectorAll('.cc').forEach(n =>
      n.onclick = () => selectCommunity(COMMUNITIES.find(c => c.community === n.dataset.c), true));
  }

  /* ---------------- 明细 ---------------- */
  function selectPoint(p, fly) {
    state.selected = p; state.selectedCommunity = p.community;
    if (fly) map.flyTo([p._lat, p._lng], Math.max(map.getZoom(), 16), { duration: .6 });
    renderDetail(); redraw(); renderCommunityList();
  }
  function selectCommunity(c, fly) {
    if (!c) return;
    state.selectedCommunity = c.community; state.selected = null;
    if (fly) map.flyToBounds(L.latLngBounds(c.points.map(p => [p._lat, p._lng])).pad(.8), { duration: .6, maxZoom: 17 });
    renderDetail(); redraw(); renderCommunityList();
  }

  function milestoneRows(p) {
    return STAGES.filter(s => s.code !== 'S0').map(s => {
      const idx = RANK[s.code];
      const done = p._rank >= idx;
      const key = Object.keys(FUNNEL_TO_STAGE).find(k => FUNNEL_MAP[k] === s.code) || null;
      const d = key ? (p.dates || {})[FUNNEL_TO_STAGE[key]] : null;
      const cur = p._rank === idx;
      return `<div class="ms-row${done ? '' : ' pending'}${cur ? ' cur' : ''}">
        <i class="ms-dot"></i><span class="ms-name">${s.name}</span>
        <span class="ms-date">${d || (done ? '已完成' : '—')}</span></div>`;
    }).join('');
  }

  function renderDetail() {
    const el = document.getElementById('detailPanel');
    const hint = document.getElementById('detailHint');

    if (state.selected) {
      const p = state.selected;
      const sibs = ALL.filter(x => x.community === p.community);
      const g = GROUP_BY_ID[p._group];
      hint.textContent = `第 ${p.seq} 台`;
      el.innerHTML = `
        <div class="dt-title">${p.community}</div>
        <div class="dt-sub">${p.address}</div>
        <div class="dt-tags">
          <span class="badge" style="background:${hexA(g.color, .16)};border-color:${hexA(g.color, .5)};color:${g.color}">${STAGES[p._rank].name}</span>
          <span class="badge z">${p.street}街道</span>
          <span class="badge z">${p.zone}</span>
          ${p.brand ? `<span class="badge z">${p.brand}</span>` : '<span class="badge lo">品牌未定</span>'}
          <span class="badge ${p.geoConfidence === 'verified' ? 'hi' : 'lo'}">${p.geoConfidence === 'verified' ? '坐标已核验' : '坐标待现场复核'}</span>
        </div>
        <div class="dt-grid">
          <div class="dt-cell"><span>层数</span><b>${p.floors || '—'}<small style="font-size:10px"> 层</small></b></div>
          <div class="dt-cell"><span>本单元户数</span><b>${p.households || '—'}<small style="font-size:10px"> 户</small></b></div>
          <div class="dt-cell"><span>社区</span><b style="font-size:12px">${p.committee || '—'}</b></div>
          <div class="dt-cell"><span>设备代码尾号</span><b>${(p.deviceCode || '').slice(-4) || '—'}</b></div>
        </div>
        <div class="dt-sec"><span>里程碑</span><b style="color:var(--accent)">${p._rank} / ${STAGES.length - 1}</b></div>
        <div class="ms-list">${milestoneRows(p)}</div>
        <div class="dt-sec"><span>台账信息</span></div>
        <div class="dt-row"><span>更新改造前设备代码</span><b class="mono">${p.deviceCode || '—'}</b></div>
        <div class="dt-row"><span>品牌</span><b>${p.brand || '未确定'}${p.brandFrom === 'plan' ? '（按小区）' : ''}</b></div>
        <div class="dt-row"><span>经纬度 GCJ-02</span><b class="mono">${p._lat.toFixed(5)}, ${p._lng.toFixed(5)}</b></div>
        <div class="dt-row"><span>坐标依据</span><b style="font-weight:400;font-size:10.5px;color:var(--txt-2);max-width:190px">${(META.geoByCommunity[p.community]||{}).method || '—'}</b></div>
        <div class="dt-row"><span>高德定位到</span><b style="font-weight:400;font-size:10.5px;color:var(--txt-2);max-width:190px">${(META.geoByCommunity[p.community]||{}).matched || '—'}</b></div>
        ${p.auditor ? `<div class="dt-row"><span>跟踪审计对接人</span><b>${p.auditor}</b></div>` : ''}
        <div class="dt-sec"><span>同小区其他点位</span><b style="color:var(--accent)">${sibs.length - 1}</b></div>
        <div class="dt-siblings">
          ${sibs.filter(s => s.seq !== p.seq).slice(0, 40).map(s =>
            `<div class="dt-sib" data-id="${s.seq}"><span>${s.address.slice(0, 16)}</span>
              <span style="color:${GROUP_BY_ID[s._group].color};font-size:10px">${STAGES[s._rank].name}</span></div>`).join('') || '<div class="empty">无</div>'}
        </div>`;
      el.querySelectorAll('.dt-sib').forEach(n =>
        n.onclick = () => selectPoint(ALL.find(x => x.seq === +n.dataset.id), true));
      return;
    }

    if (state.selectedCommunity) {
      const c = COMMUNITIES.find(x => x.community === state.selectedCommunity);
      const vis = c.points.filter(hit);
      const g = GROUP_BY_ID[GROUP_OF[c.maxStage]];
      hint.textContent = c.community;
      const dist = Object.entries(c.stageCounts).sort((a, b) => RANK[a[0]] - RANK[b[0]]);
      el.innerHTML = `
        <div class="dt-title">${c.community}</div>
        <div class="dt-sub">${c.street}街道 · ${c.committee || '—'} · ${c.elevators} 台</div>
        <div class="dt-tags">
          <span class="badge" style="background:${hexA(g.color, .16)};border-color:${hexA(g.color, .5)};color:${g.color}">最远 ${STAGES[RANK[c.maxStage]].name}</span>
          ${c.brands.map(b => `<span class="badge z">${b}</span>`).join('')}
        </div>
        <div class="dt-grid">
          <div class="dt-cell"><span>电梯台数</span><b>${c.elevators}</b></div>
          <div class="dt-cell"><span>涉及居民</span><b>${c.households}</b></div>
          <div class="dt-cell"><span>最高楼层</span><b>${c.maxFloors}<small style="font-size:10px"> 层</small></b></div>
          <div class="dt-cell"><span>计划 / 台账</span><b>${c.planned} / ${c.actual}</b></div>
        </div>
        <div class="dt-sec"><span>阶段分布</span><b style="color:var(--accent)">${vis.length} 台在筛选内</b></div>
        ${dist.map(([code, n]) => `<div class="dt-row"><span>${STAGES[RANK[code]].name}</span><b>${n} 台</b></div>`).join('')}
        <div class="dt-sec"><span>台账时间</span></div>
        <div class="dt-row"><span>街道对接</span><b>${c.streetContact || '—'}</b></div>
        <div class="dt-row"><span>社区摸排</span><b>${c.survey || '—'}</b></div>
        <div class="dt-sec"><span>点位列表</span><b style="color:var(--accent)">${vis.length}</b></div>
        <div class="dt-siblings">
          ${vis.map(s => `<div class="dt-sib" data-id="${s.seq}"><span>${s.address.slice(0, 16)}</span>
            <span style="color:${GROUP_BY_ID[s._group].color};font-size:10px">${STAGES[s._rank].name}</span></div>`).join('')}
        </div>`;
      el.querySelectorAll('.dt-sib').forEach(n =>
        n.onclick = () => selectPoint(ALL.find(x => x.seq === +n.dataset.id), true));
      return;
    }
    hint.textContent = '点击地图或清单';
    el.innerHTML = '<div class="empty">未选择点位<br><span style="font-size:10px">点击地图圆点，或右侧小区清单</span></div>';
  }

  function updateStatusbar() {
    const vis = visible();
    document.getElementById('statusbar').innerHTML =
      `筛选 <b>${vis.length}</b> 台 · <b>${new Set(vis.map(p => p.community)).size}</b> 小区 · <b>${vis.reduce((s, p) => s + (p.households || 0), 0)}</b> 户`;
    const review = vis.filter(p => p.geoConfidence === 'review');
    const note = document.getElementById('geoNote');
    if (review.length) {
      const names = [...new Set(review.map(p => p.community))];
      note.classList.add('show');
      note.innerHTML = `<b>坐标待复核</b>：${names.length} 个小区 / ${review.length} 台为按地址或社区推断，
        未经实地校准（${names.slice(0, 6).join('、')}${names.length > 6 ? ' 等' : ''}）。
        其余小区坐标取自<b>高德 POI</b>，并经所属社区锚点交叉校验。<b>小区内各单元为示意展开，非实测楼栋位置。</b>`;
    } else note.classList.remove('show');
  }

  /* ---------------- 交互 ---------------- */
  document.getElementById('basemapSeg').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    state.map = b.dataset.map; setBasemap(state.map);
  };
  document.getElementById('viewSeg').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    state.view = b.dataset.view; redraw();
  };
  document.getElementById('btnFit').onclick = () => fitAll(false);

  // 左栏标签页
  document.getElementById('leftTabs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    state.tab = b.dataset.tab;
    [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab-pane').forEach(pn =>
      pn.classList.toggle('on', pn.id === 'pane' + state.tab[0].toUpperCase() + state.tab.slice(1)));
  };

  // 时间轴抽屉
  document.getElementById('btnTimeline').onclick = () => openTimeline();
  document.getElementById('btnTlClose').onclick = () => openTimeline(false);
  document.getElementById('tlModes').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    state.tlMode = b.dataset.tl; renderTimeline();
  };

  // 导出周报
  document.getElementById('btnReport').onclick = () => {
    window.open('reports/weekly.html', '_blank');   // 单文件简报,可直接另存/打印
  };
  let t = null;
  document.getElementById('search').oninput = e => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); apply(); }, 160);
  };
  function fitAll(immediate) {
    const vis = visible();
    if (!vis.length) return;
    const b = L.latLngBounds(vis.map(p => [p._lat, p._lng])).pad(.18);
    if (immediate) map.fitBounds(b, { animate: false }); else map.flyToBounds(b, { duration: .6 });
  }
  function apply() { renderKpi(); renderFunnel(); renderRisk(); renderPeople(); renderStreetChart(); renderCommunityList(); redraw(); }

  /* ---------------- 深度链接 ---------------- */
  function loadDeepLink() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    let linked = false;
    const v = h.get('view');
    if (v && ['point', 'community', 'heat'].includes(v)) {
      state.view = v; linked = true;
      document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    }
    const cb = h.get('color');
    if (cb && ['stage', 'risk', 'zone', 'brand'].includes(cb)) { state.colorBy = cb; linked = true; }
    const bm = h.get('base');
    if (bm && TILES[bm]) {
      state.map = bm; setBasemap(bm); linked = true;
      document.querySelectorAll('#basemapSeg button').forEach(b => b.classList.toggle('on', b.dataset.map === bm));
    }
    if (h.get('hull') === '0') state.showHull = false;
    const tb = h.get('tab');
    if (tb && ['funnel', 'risk', 'people'].includes(tb)) {
      state.tab = tb; linked = true;
      document.querySelectorAll('#leftTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tb));
      document.querySelectorAll('.tab-pane').forEach(pn =>
        pn.classList.toggle('on', pn.id === 'pane' + tb[0].toUpperCase() + tb.slice(1)));
    }
    if (h.get('tl') === '1') state.tlOpen = true;
    const tlm = h.get('tlm');
    if (tlm && ['month', 'cum', 'matrix'].includes(tlm)) {
      state.tlMode = tlm;
      document.querySelectorAll('#tlModes button').forEach(b => b.classList.toggle('on', b.dataset.tl === tlm));
    }
    const cc = h.get('c');
    if (cc && COM[cc]) {
      state.selectedCommunity = cc; linked = true;
      // 必须用 GCJ-02 坐标定位:plan.json 里的是 WGS-84,直接用会与标记相差约 400m
      const cg = COMMUNITIES.find(x => x.community === cc);
      map.setView([cg._lat, cg._lng], parseInt(h.get('z') || '16', 10), { animate: false });
    }
    const pt = h.get('p');
    if (pt) {
      const f = ALL.find(x => String(x.seq) === pt);
      if (f) { state.selected = f; state.selectedCommunity = f.community; linked = true; map.setView([f._lat, f._lng], 17, { animate: false }); }
    }
    return linked;
  }

  /* ---------------- 启动 ---------------- */
  let booted = false;
  // 各步骤独立 try:任一渲染失败不应中断后续(上一版就是小区清单抛错导致地图没定位)
  function step(name, fn) { try { fn(); } catch (e) { console.error('[看台] ' + name + ' 渲染失败:', e); } }
  function boot() {
    if (booted) return; booted = true;
    step('invalidateSize', () => map.invalidateSize());
    let linked = false;
    step('deepLink', () => { linked = loadDeepLink(); });
    step('topStats', renderTopStats);
    step('legend', renderLegend);
    step('chips', renderChips);
    step('kpi', renderKpi);
    step('funnel', renderFunnel);
    step('risk', renderRisk);
    step('people', renderPeople);
    step('streetChart', renderStreetChart);
    step('communityList', renderCommunityList);
    step('detail', renderDetail);
    step('redraw', redraw);
    if (state.tlOpen) step('timelineOpen', () => openTimeline(true));   // 会顺带 renderTimeline
    if (!linked) step('fitAll', () => fitAll(true));
  }
  // 不用 requestAnimationFrame:部分无头/后台环境不产帧,rAF 回调可能永不执行
  if (document.readyState === 'complete') setTimeout(boot, 0);
  else window.addEventListener('load', () => setTimeout(boot, 0));
  setTimeout(boot, 1200);   // 兜底:load 事件缺失时也要初始化

  let zt = null;
  map.on('zoomend', () => { if (state.view === 'heat') return; clearTimeout(zt); zt = setTimeout(redraw, 140); });
  window.addEventListener('resize', () => map.invalidateSize());

  document.getElementById('footLeft').textContent =
    `数据来源：${META.source} · 工作表【${META.sheets.join(' / ')}】· 生成于 ${META.generatedWeb}`;
  document.getElementById('subtitle').textContent =
    `${META.project} · 台账 ${META.counts.elevators} 台 / ${META.counts.communities} 小区 / ${META.counts.streets} 街道`;

  window.__DASH__ = { map, state, data: DATA, redraw, fitAll, COM, ALL };
})();
