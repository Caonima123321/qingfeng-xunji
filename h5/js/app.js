/* 清风循迹 H5 · 应用逻辑（依赖 data.js 的 QF_* 全局与 Leaflet） */
(function () {
  'use strict';

  var SITES = window.QF_SITES || [];
  var CITIES = window.QF_CITIES || [];
  var CATEGORIES = window.QF_CATEGORIES || [];
  var HOME = window.QF_HOME || { city: '南充市', lat: 30.837332, lng: 106.110244 };
  var ROUTES = window.QF_ROUTES || [];

  /* 高德瓦片（gcj02，与点位坐标一致；备选：可换成 OSM 但需 wgs84 转换） */
  var TILE_URL = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
  var PIN = {
    '红色廉洁': 'pin-red',
    '清官廉吏': 'pin-official',
    '家风家训': 'pin-family',
    '廉政教育': 'pin-edu',
    '行业清风': 'pin-industry'
  };
  /* 四川省界框（gcj02），用于地图初始取景 */
  var SICHUAN_BOUNDS = [[25.97, 97.35], [34.32, 108.58]];
  /* 视野锁定范围（宽松，防止把四川拖出屏、露出省外底图） */
  var NAV_BOUNDS = [[20.0, 88.0], [40.0, 118.0]];
  /* 遮罩外圈（覆盖中国及周边，远大于锁定范围，保证不露底） */
  var MASK_OUTER = [[52, 78], [52, 128], [12, 128], [12, 78]];
  /* 规划路线时临时放宽视野（起点可能远在省外），结束后恢复四川锁定 */
  var ROUTE_BOUNDS = [[15, 75], [54, 135]];

  var state = {
    view: 'map',
    prevView: 'map',
    detailId: null,
    cat: '',
    city: '',
    kw: '',
    scope: 'all',
    user: null,
    route: null,
    routeId: null,
    studyRoute: null,
    counts: true          // 地图上常驻显示市州 / 区县点位计数
  };

  var map = null;
  var markerLayer = null;
  var meMarker = null;
  var routeLayer = null;
  var countLayer = null;

  /* ---------------- 工具 ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* ---------------- 馆藏级线描图标库（24×24 网格 · 1.7 描边 · 随 currentColor 着色） ---------------- */
  var ICON = {
    map: '<path d="M9 3.6 3.4 6.2v14.2L9 17.8l6 2.6 5.6-2.6V3.6L15 6.2z"/><path d="M9 3.6v14.2M15 6.2v14.2"/>',
    list: '<circle cx="5.2" cy="7" r="1.3"/><circle cx="5.2" cy="12" r="1.3"/><circle cx="5.2" cy="17" r="1.3"/><path d="M9.6 7h9.2M9.6 12h9.2M9.6 17h5.6"/>',
    route: '<path d="M7 17.6c4.8 0 3.6-11.2 9.8-11.2"/><circle cx="5.4" cy="17.6" r="2.2"/><circle cx="18.6" cy="6.4" r="2.2"/>',
    search: '<circle cx="10.6" cy="10.6" r="6.2"/><path d="m15.2 15.2 5 5"/>',
    locate: '<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="12" r="1.9"/><path d="M12 2.4v3M12 18.6v3M2.4 12h3M18.6 12h3"/>',
    home: '<path d="M3.6 11.2 12 4l8.4 7.2"/><path d="M6.2 10.2v10.2h11.6V10.2"/><path d="M10 20.4v-5.6h4v5.6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2 5.2-5.2 2 2-5.2z"/>',
    layers: '<path d="m12 3.2 8.8 4.8L12 12.8 3.2 8z"/><path d="m3.2 12.8 8.8 4.8 8.8-4.8"/>',
    pin: '<path d="M12 21.2s6.8-6.2 6.8-11.2a6.8 6.8 0 1 0-13.6 0c0 5 6.8 11.2 6.8 11.2z"/><circle cx="12" cy="10" r="2.5"/>',
    down: '<path d="m5.6 9.2 6.4 6.4 6.4-6.4"/>',
    up: '<path d="m5.6 14.8 6.4-6.4 6.4 6.4"/>',
    left: '<path d="M15 4.8 7.8 12l7.2 7.2"/>',
    right: '<path d="M9 4.8 16.2 12 9 19.2"/>',
    arrow: '<path d="M4.4 12h14.6M13.4 6.4 19 12l-5.6 5.6"/>',
    navigate: '<path d="M20.4 3.6 3.6 10.4l6.4 2.8 2.8 6.4z"/><path d="m10 13.2 4.6-4.6"/>',
    check: '<circle cx="12" cy="12" r="8.4"/><path d="m8.5 12.3 2.5 2.5 4.6-5.2"/>',
    phone: '<path d="M7.2 3.8H4.6A1.7 1.7 0 0 0 2.9 5.6c.5 8.2 7.3 15 15.5 15.5a1.7 1.7 0 0 0 1.8-1.7v-2.6l-4.4-1.6-1.7 2.2a13.9 13.9 0 0 1-5.8-5.8l2.2-1.7z"/>',
    copy: '<rect x="9" y="9" width="11.4" height="11.4" rx="2.4"/><path d="M15.6 6.4V4.9a2.4 2.4 0 0 0-2.4-2.4H4.9a2.4 2.4 0 0 0-2.4 2.4v8.3a2.4 2.4 0 0 0 2.4 2.4h1.5"/>',
    car: '<path d="M4.6 15.6h14.8v2.6H4.6z"/><path d="M6.4 15.6V12l1.7-4.2h7.8L17.6 12v3.6"/><circle cx="7.8" cy="18.6" r="1.6"/><circle cx="16.2" cy="18.6" r="1.6"/>',
    bus: '<rect x="5" y="3.6" width="14" height="12.8" rx="2.4"/><path d="M5 11h14"/><path d="M8.4 7.4h7.2"/><circle cx="8.4" cy="18.6" r="1.5"/><circle cx="15.6" cy="18.6" r="1.5"/>',
    bike: '<circle cx="6.2" cy="16.6" r="3.4"/><circle cx="17.8" cy="16.6" r="3.4"/><path d="m9.6 16.6 3.4-7.4h3"/><path d="M13 9.2h3.4l1.4 4.6"/><path d="M14.6 5.8h2.6"/>',
    walk: '<circle cx="13.4" cy="4.8" r="1.8"/><path d="m11.8 9.4 3.2 1.4 1.2 4"/><path d="m13.8 10.8-3.2 3.4.8 6"/><path d="M9.2 20.6 9.8 14l-2.2-2.6"/>'
  };
  function ic(name, cls) {
    var body = ICON[name];
    if (!body) return '';
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  /* 底部面板的「收起 / 展开」文字 + 箭头图标 */
  function chevronLabel(collapsed) {
    return (collapsed ? '展开 ' : '收起 ') + ic(collapsed ? 'up' : 'down', 'ic-sm');
  }
  /* 把静态 HTML 里的 <span data-icon="xxx"> 填成图标 */
  function paintIcons() {
    $all('[data-icon]').forEach(function (el) {
      var n = el.getAttribute('data-icon');
      if (n) el.innerHTML = ic(n, el.getAttribute('data-icon-cls') || '');
    });
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    (document.getElementById('app') || document.body).appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function catColor(site) {
    var hit = CATEGORIES.filter(function (c) { return (site.categories || []).indexOf(c.key) > -1; })[0];
    return hit ? hit.color : '#9C2B26';
  }
  function distKm(lat1, lng1, lat2, lng2) {
    var R = 6371, toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function distText(km) {
    if (km == null) return '';
    if (km < 1) return Math.round(km * 1000) + ' m';
    if (km < 100) return Math.round(km * 10) / 10 + ' km';
    return Math.round(km) + ' km';
  }
  /* ---------------- 循迹（本地存储，无需登录） ---------------- */
  function getVisited() {
    try { return JSON.parse(localStorage.getItem('qf_visited') || '{}'); } catch (e) { return {}; }
  }
  function isVisited(id) { return !!getVisited()[String(id)]; }
  function toggleVisited(id) {
    var v = getVisited();
    if (v[String(id)]) { delete v[String(id)]; localStorage.setItem('qf_visited', JSON.stringify(v)); return false; }
    v[String(id)] = Date.now(); localStorage.setItem('qf_visited', JSON.stringify(v)); return true;
  }

  /* ---------------- 筛选 ---------------- */
  function filtered() {
    var kw = state.kw.trim();
    return SITES.filter(function (s) {
      if (state.cat && (s.categories || []).indexOf(state.cat) === -1) return false;
      if (state.city && s.city !== state.city) return false;
      if (state.scope === 'home' && s.city !== HOME.city) return false;
      if (state.scope === 'visited' && !isVisited(s.id)) return false;
      if (kw) {
        var h = [s.name, s.city, s.district || '', s.address || '', (s.tags || []).join(' '), (s.categories || []).join(' '), s.summary || ''].join(' ');
        if (h.indexOf(kw) === -1) return false;
      }
      return true;
    });
  }
  function sorted(list) {
    if (state.user && state.scope !== 'visited') {
      return list.map(function (s) {
        return { s: s, d: distKm(state.user.lat, state.user.lng, s.lat, s.lng) };
      }).sort(function (a, b) { return a.d - b.d; }).map(function (x) { return x.s; });
    }
    return list;
  }
  function cityCounts() {
    var c = {};
    SITES.forEach(function (s) { c[s.city] = (c[s.city] || 0) + 1; });
    return c;
  }

  /* ---------------- 视图切换 ---------------- */
  function setView(v, opts) {
    opts = opts || {};
    if (v === 'detail') {
      state.detailId = opts.id;
      state.view = 'detail';
    } else {
      state.view = v;
      if (v === 'map' || v === 'list' || v === 'about') {
        location.hash = '/map' === v ? '/' : '/' + v;
      }
    }
    render();
  }
  function render() {
    var v = state.view;
    $all('.view').forEach(function (el) { el.classList.remove('is-active'); });
    $all('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    var titles = {
      cover: '清风循迹', route: '研学路线',
      map: '四川省 · 廉洁文化地图', list: '廉迹 · 点位总览',
      about: '关于清风循迹', detail: '点位详情'
    };
    $('#nav-title').textContent = titles[v] || '清风循迹';
    var backBtn = $('#nav-back');
    if (backBtn) backBtn.hidden = (v !== 'detail' && v !== 'route');
    /* 封面页是落地页，隐藏底部 Tab 保持干净 */
    var tb = $('#tabbar');
    if (tb) tb.classList.toggle('is-hidden', v === 'cover');
    if (v === 'cover') {
      $('#view-cover').classList.add('is-active');
      renderCover();
    } else if (v === 'route') {
      $('#view-route').classList.add('is-active');
      renderRoute();
    } else if (v === 'map') {
      $('#view-map').classList.add('is-active');
      renderMap();
    } else if (v === 'list') {
      $('#view-list').classList.add('is-active');
      renderList();
    } else if (v === 'about') {
      $('#view-about').classList.add('is-active');
      renderAbout();
    } else if (v === 'detail') {
      $('#view-detail').classList.add('is-active');
      renderDetail();
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 地图 ---------------- */
  /* 用四川行政边界做遮罩：省外区域灰化，只显示四川 */
  function buildMask(geom) {
    if (!geom) return null;
    var rings = [];
    function collect(ring) {
      var r = ring.map(function (p) { return [p[1], p[0]]; });
      var f = r[0], l = r[r.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) r = r.concat([f]);
      rings.push(r);
    }
    if (geom.type === 'Polygon') geom.coordinates.forEach(collect);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(function (poly) { poly.forEach(collect); });
    if (!rings.length) return null;
    var outer = MASK_OUTER.concat([MASK_OUTER[0]]);
    return L.polygon([outer].concat(rings), {
      pane: 'maskPane',
      fillColor: '#E7DDC7',
      fillOpacity: 1,
      color: '#9C2B26',
      weight: 2,
      opacity: 1,
      fillRule: 'evenodd',
      interactive: false
    });
  }

  /* 把视野锁死在四川：取景到四川 + 缩放下限锁死（无法再缩小到看见省外） */
  function applySichuanView(attempt) {
    if (!map) return;
    map.invalidateSize();
    if (map.getSize().y > 100) {
      map.setMaxBounds(SICHUAN_BOUNDS);
      map.setMinZoom(map.getBoundsZoom(SICHUAN_BOUNDS));
      map.setView([HOME.lat, HOME.lng], 9);   // 打开默认放大到家乡
    } else if (attempt < 10) {
      setTimeout(function () { applySichuanView(attempt + 1); }, 150);
    } else {
      map.setView([HOME.lat, HOME.lng], 9);
      map.setMinZoom(6);
    }
  }

  function initMap() {
    if (map) return;
    if (typeof L === 'undefined') { toast('地图组件加载失败，请检查网络后重试'); return; }
    map = L.map('map', { zoomControl: false }).setView([30.75, 102.90], 6);
    /* 遮罩专用 pane：位于瓦片之上、点位之下 */
    map.createPane('maskPane');
    map.getPane('maskPane').style.zIndex = 350;
    map.getPane('maskPane').style.pointerEvents = 'none';
    /* 计数气泡专用 pane：压在圆钉之下，不挡点位点击 */
    map.createPane('countPane');
    map.getPane('countPane').style.zIndex = 560;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(TILE_URL, {
      subdomains: ['1', '2', '3', '4'],
      attribution: '© 高德地图',
      maxZoom: 18
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    /* 缩放变化时在「市州计数」与「区县计数」之间切换 */
    map.on('zoomend', function () { renderCounts(); });
    /* 遮罩：仅显示四川省，省外区域灰化 */
    var geom = (window.QF_BOUNDARY && window.QF_BOUNDARY.features && window.QF_BOUNDARY.features[0])
      ? window.QF_BOUNDARY.features[0].geometry : null;
    var mask = buildMask(geom);
    if (mask) mask.addTo(map);
    /* 布局稳定后：按四川精确取景，并把缩放下限与拖拽范围锁死在四川 */
    setTimeout(function () { applySichuanView(0); }, 250);
  }
  function iconFor(site) {
    var f = PIN[(site.categories || [])[0]] || 'pin-all';
    return L.icon({ iconUrl: 'assets/marker/' + f + '.png', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17] });
  }
  function popupHtml(s) {
    return '<div class="lp-name">' + esc(s.name) + '</div>' +
      '<div class="lp-meta">' + esc(s.city + (s.district ? ' · ' + s.district : '')) + '</div>' +
      '<a class="lp-btn" href="#/detail/' + encodeURIComponent(s.id) + '">查看详情 →</a>';  }
  function renderMarkers() {
    markerLayer.clearLayers();
    var list = filtered();
    list.forEach(function (s) {
      var m = L.marker([s.lat, s.lng], { icon: iconFor(s) });
      m.bindPopup(popupHtml(s));
      markerLayer.addLayer(m);
    });
    placeMeMarker();
  }
  function placeMeMarker() {
    if (meMarker) { map.removeLayer(meMarker); meMarker = null; }
    if (state.user) {
      meMarker = L.marker([state.user.lat, state.user.lng], {
        icon: L.icon({ iconUrl: 'assets/marker/pin-me.png', iconSize: [20, 20], iconAnchor: [10, 10] })
      }).addTo(map);
    }
  }

  /* ---------------- 点位计数气泡：市州 / 区县（"当前有多少个展馆点位"） ---------------- */
  var DIST_MIN_ZOOM = 10;   // 放到这一级由「市州计数」切换为「区县计数」

  function shortCity(name) {
    return String(name)
      .replace('藏族羌族自治州', '州')
      .replace('藏族自治州', '州')
      .replace('彝族自治州', '州');
  }
  function bubbleHtml(label, n, on) {
    return '<div class="count-bubble' + (on ? ' on' : '') + '"><b>' + esc(label) + '</b><i>' + n + '</i></div>';
  }
  function addBubble(lat, lng, html, onClick) {
    var m = L.marker([lat, lng], {
      pane: 'countPane',
      icon: L.divIcon({ className: 'count-wrap', html: html, iconSize: [0, 0] }),
      keyboard: false
    });
    m.on('click', onClick);
    return m;
  }
  function renderCounts() {
    if (!map) return;
    if (countLayer) { map.removeLayer(countLayer); countLayer = null; }
    if (!state.counts) return;
    countLayer = L.layerGroup();

    var list = filtered();
    var byDistrict = !!state.city || map.getZoom() >= DIST_MIN_ZOOM;

    if (byDistrict) {
      /* 区县级：同一区县的点位聚合成一个气泡 */
      var groups = {}, order = [];
      list.forEach(function (s) {
        var key = s.city + '|' + (s.district || '市辖区');
        if (!groups[key]) {
          groups[key] = { label: s.district || shortCity(s.city), city: s.city, n: 0, lat: 0, lng: 0 };
          order.push(key);
        }
        groups[key].n += 1;
        groups[key].lat += s.lat;
        groups[key].lng += s.lng;
      });
      order.forEach(function (k) {
        var g = groups[k];
        (function (gg) {
          countLayer.addLayer(addBubble(gg.lat / gg.n, gg.lng / gg.n, bubbleHtml(gg.label, gg.n, false), function () {
            state.city = gg.city;
            renderMap();
            toast('已筛选：' + gg.label + '（' + gg.n + ' 处）');
          }));
        })(g);
      });
    } else {
      /* 市州级：全省 21 个市州各显示当前点位数量 */
      CITIES.forEach(function (c) {
        var n = 0;
        SITES.forEach(function (s) { if (s.city === c.name) n += 1; });
        if (!n) return;
        (function (cc, nn) {
          countLayer.addLayer(addBubble(cc.lat, cc.lng, bubbleHtml(shortCity(cc.name), nn, state.city === cc.name), function () {
            state.city = state.city === cc.name ? '' : cc.name;
            renderMap();
          }));
        })(c, n);
      });
    }
    countLayer.addTo(map);
  }
  function fitList(list) {
    if (!list.length) return;
    if (list.length === 1) { map.setView([list[0].lat, list[0].lng], 13); return; }
    var b = L.latLngBounds(list.map(function (s) { return [s.lat, s.lng]; }));
    map.fitBounds(b, { padding: [60, 60], maxZoom: 13 });
  }

  /* ---------------- 封面页（扫码后的第一屏：文字介绍 + 这是什么图 + 箭头按钮） ---------------- */
  function sichuanSvg(w, h) {
    var b = window.QF_BOUNDARY;
    var geom = (b && b.features && b.features[0]) ? b.features[0].geometry : null;
    if (!geom) return '';
    var minLat = 25.97, maxLat = 34.32, minLng = 97.35, maxLng = 108.58;
    var k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    var spanX = (maxLng - minLng) * k, spanY = (maxLat - minLat);
    function px(lng, lat) {
      return [(lng - minLng) * k / spanX * w, (maxLat - lat) / spanY * h];
    }
    var rings = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach(function (r) { rings.push(r); });
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(function (p) { p.forEach(function (r) { rings.push(r); }); });
    var d = rings.map(function (ring) {
      return ring.map(function (p, i) {
        var q = px(p[0], p[1]);
        return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
      }).join(' ') + 'Z';
    }).join('');
    var dots = SITES.map(function (s) {
      var q = px(s.lng, s.lat);
      return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2" fill="#9C2B26" opacity=".5"/>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="cover-svg" preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + d + '" fill="#F6EFE0" stroke="#9C2B26" stroke-width="1.3" stroke-linejoin="round"/>' + dots + '</svg>';
  }
  /* 封面主视觉：程序生成的水墨山水（不依赖任何图片资源，离线也能显示） */
  function inkBackdrop() {
    return '<svg class="cover-art" viewBox="0 0 390 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="qfSky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#B8A47C"/><stop offset=".42" stop-color="#D6C6A0"/>' +
          '<stop offset="1" stop-color="#EBE0C6"/></linearGradient>' +
        '<linearGradient id="qfFar" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#7C6B4C" stop-opacity=".66"/>' +
          '<stop offset="1" stop-color="#B6A583" stop-opacity=".3"/></linearGradient>' +
        '<linearGradient id="qfMid" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#57492F" stop-opacity=".78"/>' +
          '<stop offset="1" stop-color="#93815E" stop-opacity=".36"/></linearGradient>' +
        '<linearGradient id="qfNear" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#332B1E" stop-opacity=".9"/>' +
          '<stop offset="1" stop-color="#5E5238" stop-opacity=".5"/></linearGradient>' +
        '<radialGradient id="qfSun" cx=".5" cy=".5" r=".5">' +
          '<stop offset="0" stop-color="#F6EAC8" stop-opacity=".85"/>' +
          '<stop offset="1" stop-color="#F6EAC8" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<rect width="390" height="470" fill="url(#qfSky)"/>' +
      '<circle cx="288" cy="108" r="62" fill="url(#qfSun)"/>' +
      '<circle cx="288" cy="108" r="25" fill="#F0E1BA" opacity=".7"/>' +
      '<path d="M0 272 52 216 96 250 146 190 200 254 250 214 300 256 348 222 390 260V470H0z" fill="url(#qfFar)"/>' +
      '<path d="M0 312 46 264 92 304 138 250 194 312 240 274 292 316 338 278 390 318V470H0z" fill="url(#qfMid)"/>' +
      '<path d="M0 358 56 320 110 362 166 316 224 364 278 328 334 366 390 334V470H0z" fill="url(#qfNear)"/>' +
      '<rect x="0" y="264" width="390" height="32" fill="#EFE4C9" opacity=".38"/>' +
      '<rect x="0" y="316" width="390" height="22" fill="#EFE4C9" opacity=".28"/>' +
      '<rect x="0" y="372" width="390" height="26" fill="#EFE4C9" opacity=".22"/>' +
      '<g fill="none" stroke="#3E3524" stroke-opacity=".4" stroke-width="2" stroke-linecap="round">' +
        '<path d="M392 448c-26-6-45-22-53-45 16 9 30 11 45 9"/>' +
        '<path d="M392 418c-18-4-31-14-37-30 11 7 21 9 32 8"/>' +
      '</g>' +
      '<g fill="none" stroke="#5C5039" stroke-opacity=".48" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M118 138c5-5 9-5 14 0M142 124c5-5 9-5 14 0"/>' +
      '</g>' +
      '</svg>';
  }
  function renderCover() {
    var box = $('#cover-body');
    if (!box) return;
    var cs = {};
    SITES.forEach(function (s) { cs[s.city] = 1; });
    var routeCards = ROUTES.map(function (r) {
      return '<button class="cover-route" data-route="' + esc(r.id) + '">' +
        '<span class="cover-route__top"><b>' + esc(r.name) + '</b><i>' + (r.stations || []).length + ' 站</i></span>' +
        '<span class="cover-route__desc">' + esc(r.desc || '') + '</span>' +
        '<span class="cover-route__meta">' + esc(r.days || '') + ' · ' + esc(r.city || '') + '</span>' +
        '</button>';
    }).join('');
    box.innerHTML =
      '<div class="cover-hero">' + inkBackdrop() +
        '<div class="cover-hero__vtext">' + CITIES.length + ' 个市州<br>' + SITES.length + ' 处点位<br>' +
          CATEGORIES.length + ' 大廉洁要素</div>' +
        '<div class="cover-hero__foot">' +
          '<div class="cover-hero__title">清风循迹</div>' +
          '<div class="cover-hero__line"></div>' +
          '<div class="cover-hero__sub">四川省廉洁文化地图</div>' +
        '</div>' +
        '<div class="cover-hero__seal">廉</div>' +
      '</div>' +
      '<div class="cover-main">' +
        '<div class="cover-card">' +
          '<div class="cover-sec">这是一张什么图？</div>' +
          '<p class="cover-desc">深入挖掘廉洁文化的历史纵深与时代价值，梳理四川省内蕴含廉洁要素的纪念场馆、教育基地与家风家训场所，串联古今廉洁故事，为党员干部、师生群体及社会公众提供可视化、可感知、可参与的廉洁文化教育资源。</p>' +
          '<div class="cover-stats">' +
            '<div class="cover-stat"><b>' + SITES.length + '</b><span>廉洁点位</span></div>' +
            '<div class="cover-stat"><b>' + Object.keys(cs).length + '</b><span>市州覆盖</span></div>' +
            '<div class="cover-stat"><b>' + CATEGORIES.length + '</b><span>廉洁要素</span></div>' +
          '</div>' +
          '<div class="cover-map">' + sichuanSvg(320, 275) + '<span class="cover-map__cap">四川省 · 点位分布</span></div>' +
        '</div>' +
        '<button class="cover-enter" id="cover-enter"><span>进入地图</span><i>→</i></button>' +
        '<div class="cover-sec cover-sec--out">研学路线 · 点开看小地图</div>' +
        '<div class="cover-routes">' + (routeCards || '<div class="empty">暂无路线</div>') + '</div>' +
        '<p class="cover-note">里程由本站按坐标估算，仅供研学参考；展陈与开放信息以场馆最新公告为准。</p>' +
      '</div>';
    var e = $('#cover-enter');
    if (e) e.onclick = function () { location.hash = '#/map'; };
    $all('.cover-route').forEach(function (b) {
      b.onclick = function () { openRoute(b.dataset.route); };
    });
  }

  /* ---------------- 研学路线（小地图：路线连线 + 站点列表 + 里程） ---------------- */
  var miniMap = null;
  function routeById(id) {
    return ROUTES.filter(function (r) { return String(r.id) === String(id); })[0];
  }
  function resolveStations(route) {
    var byId = {};
    SITES.forEach(function (s) { byId[String(s.id)] = s; });
    return ((route && route.stations) || []).map(function (st) {
      if (st.id && byId[String(st.id)]) {
        var s = byId[String(st.id)];
        return {
          id: s.id, name: s.name, lat: s.lat, lng: s.lng,
          kind: (s.district || s.city || '廉洁点位'), note: (s.categories || []).join(' · ')
        };
      }
      return { id: '', name: st.name, lat: st.lat, lng: st.lng, kind: st.kind || '顺路景点', note: st.note || '' };
    });
  }
  function stopIcon(i) {
    return L.divIcon({ className: 'rs-pin', html: '<span>' + i + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] });
  }
  function openRoute(id) {
    state.routeId = id || (ROUTES[0] && ROUTES[0].id);
    if (state.view !== 'route') location.hash = '#/route';
    else renderRoute();
  }
  function renderRoute() {
    var r = routeById(state.routeId) || ROUTES[0];
    var box = $('#route-body');
    if (!box) return;
    if (!r) { box.innerHTML = '<div class="empty">暂无研学路线</div>'; return; }
    var stops = resolveStations(r);
    var legs = [], total = 0;
    for (var i = 1; i < stops.length; i++) {
      var dd = distKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
      legs.push(dd); total += dd;
    }
    var listHtml = stops.map(function (st, i) {
      return '<div class="rs-item">' +
        '<span class="rs-no">' + (i + 1) + '</span>' +
        '<div class="rs-body"><span class="rs-name">' + esc(st.name) + '</span>' +
        '<span class="rs-meta">' + esc(st.kind) + (st.note ? ' · ' + esc(st.note) : '') + '</span></div>' +
        '<span class="rs-leg">' + (i === 0 ? '起点' : '↑ ' + distText(legs[i - 1])) + '</span>' +
        (st.id ? '<a class="rs-go" href="#/detail/' + encodeURIComponent(st.id) + '">' + ic('right', 'ic-sm') + '</a>' : '') +
        '</div>';
    }).join('');
    box.innerHTML =
      '<div class="route-head">' +
        '<div class="route-title">' + esc(r.name) + '</div>' +
        '<div class="route-sub">' + esc(r.city || '') + ' · ' + esc(r.days || '') + ' · 共 ' + stops.length +
          ' 站 · 全程约 ' + distText(total) + '</div>' +
      '</div>' +
      '<div class="route-tabs">' + ROUTES.map(function (x) {
        return '<button class="route-tab' + (String(x.id) === String(r.id) ? ' on' : '') +
          '" data-route="' + esc(x.id) + '">' + esc((x.city || x.name).replace('藏族羌族自治州', '州').replace('藏族自治州', '州').replace('彝族自治州', '州')) + '</button>';
      }).join('') + '</div>' +
      '<div class="route-mini" id="route-mini"></div>' +
      '<div class="route-doc">' +
        '<p class="route-intro">' + esc(r.intro || '') + '</p>' +
        '<div class="rs-title">站点顺序（共 ' + stops.length + ' 站）</div>' +
        '<div class="route-list">' + listHtml + '</div>' +
        '<button class="route-onmap" id="route-onmap">在大地图中查看整条线路</button>' +
        '<p class="route-note">小地图为示意线路，按站点坐标依次连线；实际道路走向以手机地图导航为准。</p>' +
      '</div>';
    drawMiniMap(stops);
    $all('.route-tab').forEach(function (b) {
      b.onclick = function () { state.routeId = b.dataset.route; renderRoute(); };
    });
    var om = $('#route-onmap');
    if (om) om.onclick = function () {
      state.studyRoute = r.id; state.route = null;
      location.hash = '#/map';
    };
  }
  function drawMiniMap(stops) {
    var el = document.getElementById('route-mini');
    if (!el || typeof L === 'undefined' || !stops.length) return;
    if (miniMap) { miniMap.remove(); miniMap = null; }
    miniMap = L.map('route-mini', { zoomControl: false, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { subdomains: ['1', '2', '3', '4'], maxZoom: 18 }).addTo(miniMap);
    var pts = stops.map(function (s) { return [s.lat, s.lng]; });
    L.polyline(pts, { color: '#9C2B26', weight: 4, opacity: .85, dashArray: '9 7' }).addTo(miniMap);
    stops.forEach(function (s, i) {
      L.marker([s.lat, s.lng], { icon: stopIcon(i + 1) }).addTo(miniMap)
        .bindPopup('<b>' + esc(s.name) + '</b><br>' + esc(s.kind));
    });
    try { miniMap.fitBounds(L.latLngBounds(pts), { padding: [34, 34] }); } catch (e) {}
    setTimeout(function () { if (miniMap) miniMap.invalidateSize(); }, 140);
  }

  /* ---------------- 应用内路线规划（不依赖任何地图账号 / 登录） ---------------- */
  function siteById(id) {
    return SITES.filter(function (x) { return String(x.id) === String(id); })[0];
  }
  function routeEstimateHtml(km) {
    var road = km * 1.3;
    function spd(near, mid, far) { return km < 20 ? near : (km < 100 ? mid : far); }
    var items = [
      { ic: 'car', k: '驾车', v: spd(40, 65, 85), d: road },
      { ic: 'bus', k: '公共交通', v: spd(22, 45, 60), d: road },
      { ic: 'bike', k: '骑行', v: 15, d: km * 1.25 },
      { ic: 'walk', k: '步行', v: 5, d: km * 1.25 }
    ];
    return items.map(function (x) {
      var min = Math.max(1, Math.round(x.d / x.v * 60));
      var t = min < 60 ? min + ' 分钟'
        : Math.floor(min / 60) + ' 小时' + (min % 60 ? ' ' + (min % 60) + ' 分' : '');
      return '<div class="rt-item"><span class="rt-ic">' + ic(x.ic, 'ic-sm') + '</span>' +
        '<span class="rt-k">' + x.k + '</span><span class="rt-v">约 ' + t + '</span></div>';
    }).join('');
  }
  function startRoute(id) {
    if (!siteById(id)) return;
    if (state.user) { enterRoute(id); return; }
    if (!navigator.geolocation) { toast('当前浏览器不支持定位，可改用下方手机地图导航'); return; }
    toast('正在获取您的位置…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.user = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      enterRoute(id);
    }, function () {
      toast('未获得定位权限，可改用下方手机地图导航');
    }, { enableHighAccuracy: true, timeout: 8000 });
  }
  function enterRoute(id) {
    state.route = { id: id };
    if (state.view !== 'map') location.hash = '#/map';
    else renderMap();
  }
  function clearRoute() {
    state.route = null;
    state.studyRoute = null;
    if (routeLayer && map) { map.removeLayer(routeLayer); routeLayer = null; }
    var p = $('#route-panel'); if (p) p.hidden = true;
    var sh = $('#sheet'), chev = $('#sheet-chevron');
    if (sh) sh.classList.remove('collapsed');
    if (chev) chev.innerHTML = chevronLabel(false);
    if (map) { map.setMaxBounds(SICHUAN_BOUNDS); applySichuanView(0); }
    renderMap();
  }
  function drawRoute() {
    if (!map) return;
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    var p = $('#route-panel');
    if (!p) return;
    /* 研学路线模式：整条线路 + 编号站点（来自「小地图」的"在大地图中查看"） */
    if (state.studyRoute) {
      var r = routeById(state.studyRoute);
      if (!r) { state.studyRoute = null; p.hidden = true; return; }
      var stops = resolveStations(r);
      if (stops.length < 2) { p.hidden = true; return; }
      var pts = stops.map(function (x) { return [x.lat, x.lng]; });
      var total = 0;
      for (var i = 1; i < stops.length; i++) {
        total += distKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
      }
      routeLayer = L.layerGroup().addTo(map);
      L.polyline(pts, { color: '#9C2B26', weight: 4, opacity: 0.9, dashArray: '9 7' }).addTo(routeLayer);
      stops.forEach(function (x, i) {
        L.marker([x.lat, x.lng], { icon: stopIcon(i + 1), zIndexOffset: 600 }).addTo(routeLayer);
      });
      map.setMaxBounds(ROUTE_BOUNDS);
      map.setMinZoom(2);
      try { map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 13 }); } catch (e) {}
      p.innerHTML =
        '<div class="rt-head"><span class="rt-title">' + esc(r.name) + '</span><button id="rt-close">结束</button></div>' +
        '<div class="rt-sub">共 ' + stops.length + ' 站 · 全程约 <b>' + distText(total) + '</b>（虚线为示意线路）</div>' +
        '<div class="rt-foot"><a href="#/route">查看站点列表与里程 →</a></div>';
      p.hidden = false;
      var rc = $('#rt-close'); if (rc) rc.onclick = clearRoute;
      var sh2 = $('#sheet'), ch2 = $('#sheet-chevron');
      if (sh2) sh2.classList.add('collapsed');
      if (ch2) ch2.innerHTML = chevronLabel(true);
      setTimeout(function () { if (map) map.invalidateSize(); }, 280);
      return;
    }
    if (!state.route || !state.user) { p.hidden = true; return; }
    var s = siteById(state.route.id);
    if (!s) { state.route = null; p.hidden = true; return; }
    var a = [state.user.lat, state.user.lng];
    var b = [s.lat, s.lng];
    routeLayer = L.layerGroup().addTo(map);
    L.polyline([a, b], { color: '#9C2B26', weight: 4, opacity: 0.9, dashArray: '10 7' }).addTo(routeLayer);
    L.marker(b, { icon: iconFor(s), zIndexOffset: 600 }).addTo(routeLayer);
    /* 临时放宽视野锁定，保证省外起点也能看到完整路线 */
    map.setMaxBounds(ROUTE_BOUNDS);
    map.setMinZoom(2);
    try {
      map.fitBounds(L.latLngBounds([a, b]), { padding: [50, 50], maxZoom: 14 });
    } catch (e) {}
    var km = distKm(a[0], a[1], b[0], b[1]);
    p.innerHTML =
      '<div class="rt-head"><span class="rt-title">我的位置 → ' + esc(s.name) + '</span>' +
      '<button id="rt-close">结束</button></div>' +
      '<div class="rt-sub">直线距离 <b>' + distText(km) + '</b> · 时间为按常见速度估算，实际以现场导航为准</div>' +
      '<div class="rt-grid">' + routeEstimateHtml(km) + '</div>' +
      '<div class="rt-foot"><a href="https://uri.amap.com/navigation?to=' + s.lng + ',' + s.lat + ',' +
        encodeURIComponent(s.name) + '&mode=car&coordinate=gaode&callnative=1" target="_blank" rel="noopener">用手机地图导航 →</a></div>';
    p.hidden = false;
    var c = $('#rt-close'); if (c) c.onclick = clearRoute;
    var sh = $('#sheet'), chev = $('#sheet-chevron');
    if (sh) sh.classList.add('collapsed');
    if (chev) chev.innerHTML = chevronLabel(true);
    setTimeout(function () { if (map) map.invalidateSize(); }, 280);
  }
  function renderChips(container, onPick) {
    container.innerHTML = '';
    CATEGORIES.forEach(function (c) {
      var n = SITES.filter(function (s) { return (s.categories || []).indexOf(c.key) > -1; }).length;
      var b = document.createElement('button');
      b.className = 'chip' + (state.cat === c.key ? ' on' : '');
      b.style.cssText = state.cat === c.key ? ('background:' + c.color + ';border-color:' + c.color) : '';
      b.innerHTML = '<span>' + c.key + '</span><span class="chip-n">' + n + '</span>';
      b.onclick = function () { state.cat = (state.cat === c.key ? '' : c.key); onPick(); };
      container.appendChild(b);
    });
    var cb = document.createElement('button');
    cb.className = 'chip';
    cb.innerHTML = '<span>' + (state.city || '全部市州') + '</span><span class="chip-n">▾</span>';
    cb.onclick = function () {
      if (state.view !== 'map') { setView('map'); }
      openCityPanel();
    };
    container.appendChild(cb);
    if (state.cat || state.city) {
      var rb = document.createElement('button');
      rb.className = 'chip reset';
      rb.textContent = '重置';
      rb.onclick = function () { state.cat = ''; state.city = ''; onPick(); };
      container.appendChild(rb);
    }
  }
  function renderSheet() {
    var list = sorted(filtered());
    $('#sheet-title').textContent = (state.cat || state.city) ? '筛选结果' : '全省廉洁文化点位';
    $('#sheet-count').textContent = list.length + ' 处';
    var box = $('#sheet-list');
    if (!list.length) {
      box.innerHTML = '<div class="empty">当前筛选条件下暂无可展示的点位</div>';
      return;
    }
    box.innerHTML = list.map(cardHtml).join('');
  }
  function cardHtml(s) {
    var color = catColor(s);
    var dist = '';
    if (state.user) { dist = distText(distKm(state.user.lat, state.user.lng, s.lat, s.lng)); }
    var done = isVisited(s.id) ? '<span class="card-done">已循迹</span>' : '';
    var tags = (s.categories || []).map(function (c) {
      return '<span class="tag" style="color:' + color + ';border-color:' + color + '44;background:' + color + '12">' + esc(c) + '</span>';
    }).join('');
    return '<div class="card" data-id="' + esc(s.id) + '">' +
      '<div class="card-bar" style="background:' + color + '"></div>' +
      '<div class="card-body">' +
      '<div class="card-head"><span class="card-name">' + esc(s.name) + '</span>' + done + '</div>' +
      '<div class="card-meta">' + esc(s.city + (s.district ? ' · ' + s.district : '')) + (dist ? ' · 距您 ' + dist : '') + '</div>' +
      '<div class="card-tags">' + tags + '</div>' +
      '<div class="card-sum">' + esc(s.summary) + '</div>' +
      '</div></div>';
  }
  function renderMap() {
    initMap();
    renderChips($('#chips'), function () { renderMap(); });
    renderMarkers();
    renderCounts();
    renderSheet();
    bindCards();
    renderLegend();
    drawRoute();
  }
  function bindCards() {
    $all('#sheet-list .card').forEach(function (el) {
      el.onclick = function () { location.hash = '#/detail/' + encodeURIComponent(el.dataset.id); };
    });
  }
  function renderLegend() {
    var html = CATEGORIES.map(function (c) {
      var n = SITES.filter(function (s) { return (s.categories || []).indexOf(c.key) > -1; }).length;
      return '<div class="legend-row"><span class="legend-dot" style="background:' + c.color + '"></span>' +
        '<span><span class="legend-name">' + c.key + ' · ' + n + ' 处</span>' +
        '<span class="legend-desc">' + c.desc + '</span></span></div>';
    }).join('');
    html += '<div class="legend-row"><span class="legend-dot" style="background:#FF6B35"></span>' +
      '<span><span class="legend-name">' + esc(HOME.label || ('我的家乡 · ' + HOME.city)) + '</span>' +
      '<span class="legend-desc">' + esc(HOME.desc || '') + '</span></span></div>';
    $('#legend').innerHTML = html;
  }

  /* ---------------- 市州面板 ---------------- */
  function openCityPanel() {
    var c = cityCounts();
    var grid = $('#city-grid');
    grid.innerHTML = '<div class="city-item' + (state.city === '' ? ' on' : '') + '" data-city=""><span class="city-name">全省</span><span class="city-n">' + SITES.length + ' 处</span></div>';
    CITIES.filter(function (x) { return c[x.name]; }).forEach(function (x) {
      grid.innerHTML += '<div class="city-item' + (state.city === x.name ? ' on' : '') + '" data-city="' + esc(x.name) + '">' +
        '<span class="city-name">' + esc(x.name.replace('藏族羌族自治州', '州').replace('藏族自治州', '州').replace('彝族自治州', '州')) + '</span>' +
        '<span class="city-n">' + c[x.name] + ' 处</span></div>';
    });
    $all('#city-grid .city-item').forEach(function (el) {
      el.onclick = function () {
        state.city = el.dataset.city;
        $('#city-panel').hidden = true; $('#city-mask').hidden = true;
        renderMap();
      };
    });
    var homeBtn = $('#city-home');
    homeBtn.innerHTML = '一键回到「' + esc(HOME.label || ('我的家乡 · ' + HOME.city)) + '」<small>' + esc(HOME.desc || '') + '</small>';
    homeBtn.onclick = function () {
      $('#city-panel').hidden = true; $('#city-mask').hidden = true;
      goHome();
    };
    $('#city-panel').hidden = false;
    $('#city-mask').hidden = false;
  }

  /* ---------------- 列表 ---------------- */
  function renderList() {
    renderChips($('#list-chips'), function () { renderList(); });
    var list = sorted(filtered());
    var body = $('#list-body');
    if (state.user && state.scope !== 'visited' && list.length) {
      var banner = '<div class="banner"><span>已定位，按距离由近到远排列</span><button id="clear-loc">取消</button></div>';
      body.innerHTML = banner + list.map(cardHtml).join('');
      var cl = $('#clear-loc'); if (cl) cl.onclick = function () { state.user = null; renderList(); };
    } else if (state.scope === 'visited') {
      body.innerHTML = (list.length ? list.map(cardHtml).join('') : '<div class="empty">还没有标记循迹的点位，去地图或详情页「标记循迹」吧</div>');
    } else {
      var groups = {};
      var order = [];
      list.forEach(function (s) {
        if (!groups[s.city]) { groups[s.city] = []; order.push(s.city); }
        groups[s.city].push(s);
      });
      body.innerHTML = order.map(function (city) {
        return '<div class="group-head"><span class="group-city">' + esc(city) + '</span><span class="group-n">' + groups[city].length + ' 处</span></div>' +
          groups[city].map(cardHtml).join('');
      }).join('') || '<div class="empty">没有匹配的点位，换个关键词试试</div>';
    }
    $all('#list-body .card').forEach(function (el) {
      el.onclick = function () { location.hash = '#/detail/' + encodeURIComponent(el.dataset.id); };
    });
  }

  /* ---------------- 详情 ---------------- */
  function renderDetail() {
    var s = SITES.filter(function (x) { return String(x.id) === String(state.detailId); })[0];
    var box = $('#detail-body');
    var dv = $('#view-detail'); if (dv) dv.scrollTop = 0;
    if (!s) { box.innerHTML = '<div class="empty">未找到该点位</div>'; return; }
    var color = catColor(s);
    var badges = (s.official ? '<span class="badge official">省级及以上命名基地</span>' : '') +
      (s.categories || []).map(function (c) { return '<span class="badge">' + esc(c) + '</span>'; }).join('');
    var tags = (s.tags || []).map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
    var visited = isVisited(s.id);
    var routeUrl = function (mode) {
      var from = state.user ? 'from=' + state.user.lng + ',' + state.user.lat + ',' + encodeURIComponent('我的位置') + '&' : '';
      return 'https://uri.amap.com/navigation?' + from + 'to=' + s.lng + ',' + s.lat + ',' + encodeURIComponent(s.name) + '&mode=' + mode + '&policy=0&src=qingfengxunji&coordinate=gaode&callnative=1';
    };
    var phoneBtn = s.phone ? '<a href="tel:' + String(s.phone).split(/[、,，;；]/)[0].replace(/[^\d+]/g, '') + '">' + ic('phone', 'ic-sm') + '预约咨询</a>' : '';
    var highlights = (s.highlights || []).map(function (h, i) {
      return '<div class="point"><span class="point-no">' + (i + 1) + '</span><span>' + esc(h) + '</span></div>';
    }).join('');
    var quote = s.quote ? '<div class="quote">“' + esc(s.quote) + '”</div>' : '';

    box.innerHTML =
      '<div class="detail-hero" style="background:linear-gradient(150deg,' + color + ',' + color + 'd9 58%,#B08D57)">' +
        '<div class="detail-badges">' + badges + '</div>' +
        '<div class="detail-name">' + esc(s.name) + '</div>' +
        '<div class="detail-loc">' + esc(s.city + (s.district ? ' · ' + s.district : '')) + '</div>' +
        '<div class="detail-tags">' + tags + '</div>' +
      '</div>' +
      '<div class="detail-actions">' +
        '<button id="dv-route">' + ic('navigate', 'ic-sm') + '规划路线</button>' +
        '<button id="dv-visited">' + ic('check', 'ic-sm' + (visited ? ' ic-on' : '')) + (visited ? '已循迹' : '标记循迹') + '</button>' +
        phoneBtn +
        '<button id="dv-copy">' + ic('copy', 'ic-sm') + '复制地址</button>' +
      '</div>' +
      '<div class="detail-body">' +
        '<div class="sec-title">点位简介</div>' +
        '<div class="block"><p>' + esc(s.summary) + '</p>' +
          (s.year ? '<div class="kv"><span class="kv-k">建馆 / 开放</span><span class="kv-v">' + esc(s.year) + ' 年</span></div>' : '') +
          '<div class="kv"><span class="kv-k">廉洁要素</span><span class="kv-v">' + esc((s.categories || []).join(' · ')) + '</span></div>' +
        '</div>' +
        '<div class="sec-title">廉洁看点</div>' +
        '<div class="block">' + highlights + '</div>' +
        '<div class="sec-title">循迹读史</div>' +
        '<div class="block"><p>' + esc(s.story) + '</p></div>' +
        quote +
        '<div class="sec-title">参观信息</div>' +
        '<div class="block">' +
          '<div class="kv"><span class="kv-k">地址</span><span class="kv-v">' + esc(s.city + (s.district ? s.district : '') + s.address) + '</span></div>' +
          '<div class="kv"><span class="kv-k">预约电话</span><span class="kv-v">' + esc(s.phone || '暂未收录，建议联系当地纪委监委或文旅部门') + '</span></div>' +
          '<div class="kv"><span class="kv-k">适合对象</span><span class="kv-v">党员干部主题党日 · 师生研学 · 社会公众</span></div>' +
          '<div class="kv"><span class="kv-k">坐标置信度</span><span class="kv-v">' + (s.verify === 'verified' ? '已核实（官方地址）' : '据地址估算，出发前请再确认') + '</span></div>' +
        '</div>' +
        '<div class="sec-title">规划到这里的路线</div>' +
        '<div class="block">' +
          '<button id="dv-route2" class="route-cta"><span>🧭</span>在应用内规划路线</button>' +
          '<p class="route-hint">在地图上标出「我的位置 → ' + esc(s.name) + '」的路线与距离，<b>无需登录任何地图账号</b>。</p>' +
          '<div class="route-alt">如需真实路况导航，用手机地图打开：' +
            '<a href="' + routeUrl('car') + '" target="_blank" rel="noopener">驾车</a>' +
            '<a href="' + routeUrl('bus') + '" target="_blank" rel="noopener">公交</a>' +
            '<a href="' + routeUrl('walk') + '" target="_blank" rel="noopener">步行</a>' +
            '<a href="' + routeUrl('ride') + '" target="_blank" rel="noopener">骑行</a>' +
          '</div>' +
        '</div>' +
        '<p class="disclaimer">本页内容依据纪委监委、政府门户及官方媒体报道整理，用于廉洁文化教育；展陈与开放信息可能调整，出行前请以场馆最新公告为准。</p>' +
      '</div>';

    $('#dv-visited').onclick = function () {
      var on = toggleVisited(s.id);
      toast(on ? '已标记循迹' : '已取消标记');
      renderDetail();
    };
    $('#dv-copy').onclick = function () {
      var txt = s.name + '｜' + s.city + (s.district ? s.district : '') + s.address;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { toast('地址已复制'); }, function () { fallbackCopy(txt); });
      } else { fallbackCopy(txt); }
    };
    var rt1 = $('#dv-route'), rt2 = $('#dv-route2');
    if (rt1) rt1.onclick = function () { startRoute(s.id); };
    if (rt2) rt2.onclick = function () { startRoute(s.id); };
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('地址已复制'); } catch (e) { toast('复制失败，请手动记录'); }
    ta.remove();
  }

  /* ---------------- 关于 ---------------- */
  function renderAbout() {
    var citySet = {};
    var official = 0;
    SITES.forEach(function (s) { citySet[s.city] = true; if (s.official) official++; });
    $('#stat-row').innerHTML =
      '<div class="stat"><span class="stat-n">' + SITES.length + '</span><span class="stat-t">廉洁点位</span></div>' +
      '<div class="stat"><span class="stat-n">' + Object.keys(citySet).length + '</span><span class="stat-t">覆盖市州</span></div>' +
      '<div class="stat"><span class="stat-n">' + official + '</span><span class="stat-t">省级命名基地</span></div>' +
      '<div class="stat"><span class="stat-n">' + CATEGORIES.length + '</span><span class="stat-t">廉洁要素类别</span></div>';
    $('#about-cats').innerHTML = '<h3>廉洁要素五类</h3>' + CATEGORIES.map(function (c) {
      var n = SITES.filter(function (s) { return (s.categories || []).indexOf(c.key) > -1; }).length;
      return '<div class="cat-row"><span class="cat-dot" style="background:' + c.color + '"></span>' +
        '<span><span class="cat-name">' + c.key + '（' + n + ' 处）</span><span class="cat-desc">' + c.desc + '</span></span></div>';
    }).join('');
    $('#about-usage').innerHTML = '<h3>如何使用</h3><ul>' + [
      '「廉图」：地图上每个圆钉是一个廉洁文化点位，颜色对应五类要素，点开可看名称并进入详情。',
      '顶部筛选：点分类只看某一类；点“全部市州”切换到任意市州或一键回到“我的家乡”。',
      '详情页：看简介、廉洁看点、循迹读史、名言家训，并可一键导航、电话预约、标记循迹。',
      '「廉迹」：按场馆名、市州、廉洁要素搜索；授权定位后自动按距离从近到远排列；“我的循迹”可打卡留存。'
    ].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    $('#about-sources').innerHTML = '<h3>数据来源与核实口径</h3><ul>' + [
      '四川省纪委监委、省委宣传部 2018 年命名「四川省廉洁文化基地」名单（24 个，含真实地址与预约电话）。',
      '四川省纪委监委、重庆市纪委监委「川渝好家风」廉洁文化体验环线名单。',
      '各市州纪委监委、政府门户、文旅部门公开的廉洁文化、红色教育基地信息。',
      '坐标采用 gcj02 坐标系，与高德瓦片对齐；“已核实”为官方地址定位，“估算”为按地址推算。'
    ].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    $('#about-note').textContent = '清风循迹 · 廉洁文化地图 · 以史为鉴，以廉润心。点位信息用于廉洁文化教育，展陈与开放时间可能调整，出行前请以场馆最新公告为准。';
  }

  /* ---------------- 定位 ---------------- */
  function locate() {
    if (!navigator.geolocation) { toast('当前浏览器不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.user = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      toast('定位成功，已按距离排序');
      renderMap();
      if (map) map.setView([state.user.lat, state.user.lng], 11);
    }, function () {
      toast('未获得定位权限，可手动选择市州');
    }, { enableHighAccuracy: true, timeout: 8000 });
  }
  function goHome() {
    state.city = HOME.city;
    renderMap();
    if (map) map.setView([HOME.lat, HOME.lng], 10);
    toast('已定位到' + (HOME.label || HOME.city));
  }

  /* ---------------- 状态栏（实时时间 + 电量） ---------------- */
  function tickClock() {
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    var el = document.getElementById('sb-time');
    if (el) el.textContent = hh + ':' + mm;
  }
  function updateBattery(level, charging) {
    var pct = Math.max(0, Math.min(100, Math.round(level * 100)));
    var fill = document.getElementById('sb-batt-fill');
    var txt = document.getElementById('sb-batt-pct');
    if (fill) fill.style.width = pct + '%';
    if (fill) fill.style.background = charging ? '#8CE99A' : '#ffffff';
    if (txt) txt.textContent = (charging ? '⚡' : '') + pct + '%';
  }
  function initStatusbar() {
    tickClock();
    setInterval(tickClock, 1000);
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        updateBattery(b.level, b.charging);
        b.addEventListener('levelchange', function () { updateBattery(b.level, b.charging); });
        b.addEventListener('chargingchange', function () { updateBattery(b.level, b.charging); });
      }).catch(function () { updateBattery(0.78, false); });
    } else {
      updateBattery(0.78, false);
    }
  }

  /* ---------------- 路由与事件 ---------------- */
  function parseHash() {
    var h = location.hash || '#/';
    var parts = h.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'detail' && parts[1]) {
      if (state.view !== 'detail') state.prevView = state.view;
      state.detailId = decodeURIComponent(parts[1]);
      state.view = 'detail';
    } else if (parts[0] === 'list') { state.view = 'list'; }
    else if (parts[0] === 'about') { state.view = 'about'; }
    else if (parts[0] === 'route') { state.view = 'route'; }
    else if (parts[0] === '' || parts[0] === 'cover') { state.view = 'cover'; }
    else { state.view = 'map'; }
    render();
  }
  window.addEventListener('hashchange', parseHash);

  document.addEventListener('DOMContentLoaded', function () {
    /* 状态栏（实时时间 + 电量） */
    initStatusbar();
    /* 底部导航 */
    $all('.tabbar button').forEach(function (b) {
      b.onclick = function () { setView(b.dataset.view); };
    });
    /* 顶部导航返回 */
    var navBack = $('#nav-back');
    if (navBack) {
      navBack.onclick = function () {
        if (state.view === 'route') { location.hash = '#/map'; return; }
        setView(state.prevView || 'map');
      };
    }
    /* 地图视图按钮 */
    $('#go-search').onclick = function () { setView('list'); };
    $('#btn-locate').onclick = locate;
    $('#btn-home').onclick = goHome;
    var btnRoutes = $('#btn-routes');
    if (btnRoutes) {
      btnRoutes.onclick = function () {
        openRoute(state.routeId || (ROUTES[0] && ROUTES[0].id));
      };
    }
    $('#btn-legend').onclick = function () {
      var l = $('#legend');
      var open = l.hidden;
      l.hidden = !open;
      $('#legend-label').innerHTML = '要素图例 ' + ic(open ? 'up' : 'down', 'ic-sm');
    };
    /* 点位计数开关（市州 / 区县） */
    var btnCounts = $('#btn-counts');
    if (btnCounts) {
      btnCounts.onclick = function () {
        state.counts = !state.counts;
        btnCounts.classList.toggle('on', state.counts);
        $('#counts-label').innerHTML = ic('pin', 'ic-sm') + '点位计数 ' + (state.counts ? '✓' : '✕');
        renderCounts();
      };
    }
    /* 初始就把两个开关的图标画出来（不依赖用户是否点过） */
    $('#legend-label').innerHTML = '要素图例 ' + ic('down', 'ic-sm');
    $('#counts-label').innerHTML = ic('pin', 'ic-sm') + '点位计数 ' + (state.counts ? '✓' : '✕');
    /* 底部面板收起 / 展开，便于看全四川 */
    var sheetToggle = $('#sheet-toggle');
    if (sheetToggle) {
      sheetToggle.onclick = function () {
        var s = $('#sheet');
        var collapsed = s.classList.toggle('collapsed');
        var chev = $('#sheet-chevron');
        if (chev) chev.innerHTML = chevronLabel(collapsed);
        setTimeout(function () { if (map) map.invalidateSize(); }, 280);
      };
    }
    $('#city-close').onclick = function () { $('#city-panel').hidden = true; $('#city-mask').hidden = true; };
    $('#city-mask').onclick = function () { $('#city-panel').hidden = true; $('#city-mask').hidden = true; };
    /* 列表视图搜索 */
    $('#kw').addEventListener('input', function (e) {
      state.kw = e.target.value;
      clearTimeout(this._t);
      var that = this;
      this._t = setTimeout(function () { renderList(); }, 160);
    });
    $all('#scope-tabs button').forEach(function (b) {
      b.onclick = function () {
        state.scope = b.dataset.scope;
        $all('#scope-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
        renderList();
      };
    });
    paintIcons();
    parseHash();
  });
})();
