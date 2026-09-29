/* 清风循迹 H5 · 应用逻辑（依赖 data.js 的 QF_* 全局与 Leaflet） */
(function () {
  'use strict';

  var SITES = window.QF_SITES || [];
  var CITIES = window.QF_CITIES || [];
  var CATEGORIES = window.QF_CATEGORIES || [];
  var HOME = window.QF_HOME || { city: '南充市', lat: 30.837332, lng: 106.110244 };

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

  var state = {
    view: 'map',
    prevView: 'map',
    detailId: null,
    cat: '',
    city: '',
    kw: '',
    scope: 'all'
  };

  var map = null;
  var markerLayer = null;
  var meMarker = null;

  /* ---------------- 工具 ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function catColor(site) {
    var hit = CATEGORIES.filter(function (c) { return (site.categories || []).indexOf(c.key) > -1; })[0];
    return hit ? hit.color : '#8C1F28';
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
    var titles = { map: '四川省 · 廉洁文化地图', list: '廉迹 · 点位总览', about: '关于清风循迹', detail: '点位详情' };
    $('#nav-title').textContent = titles[v] || '清风循迹';
    var backBtn = $('#nav-back');
    if (backBtn) backBtn.hidden = (v !== 'detail');
    if (v === 'map') {
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
      fillColor: '#F0EBE0',
      fillOpacity: 1,
      color: '#8C1F28',
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
      var sheetEl = document.getElementById('sheet');
      var sheetH = sheetEl ? sheetEl.offsetHeight : Math.round(window.innerHeight * 0.34);
      map.setMaxBounds(SICHUAN_BOUNDS);
      map.fitBounds(SICHUAN_BOUNDS, { paddingTopLeft: [74, 16], paddingBottomRight: [sheetH + 8, 16] });
      map.setMinZoom(map.getZoom());
    } else if (attempt < 10) {
      setTimeout(function () { applySichuanView(attempt + 1); }, 150);
    } else {
      map.setView([30.75, 102.90], 6);
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
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(TILE_URL, {
      subdomains: ['1', '2', '3', '4'],
      attribution: '© 高德地图',
      maxZoom: 18
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
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
      '<a class="lp-btn" href="#/detail/' + encodeURIComponent(s.id) + '">查看详情 →</a>';
  }
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
  function fitList(list) {
    if (!list.length) return;
    if (list.length === 1) { map.setView([list[0].lat, list[0].lng], 13); return; }
    var b = L.latLngBounds(list.map(function (s) { return [s.lat, s.lng]; }));
    map.fitBounds(b, { padding: [60, 60], maxZoom: 13 });
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
    renderSheet();
    bindCards();
    renderLegend();
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
    var navUrl = 'https://uri.amap.com/marker?position=' + s.lng + ',' + s.lat + '&name=' + encodeURIComponent(s.name) + '&coordinate=gaode&callnative=1';
    var phoneBtn = s.phone ? '<a href="tel:' + String(s.phone).split(/[、,，;；]/)[0].replace(/[^\d+]/g, '') + '"><span class="da-ic">☎</span>预约咨询</a>' : '';
    var highlights = (s.highlights || []).map(function (h, i) {
      return '<div class="point"><span class="point-no">' + (i + 1) + '</span><span>' + esc(h) + '</span></div>';
    }).join('');
    var quote = s.quote ? '<div class="quote">“' + esc(s.quote) + '”</div>' : '';

    box.innerHTML =
      '<div class="detail-hero" style="background:linear-gradient(140deg,' + color + ',' + color + 'cc 62%,#B8860B)">' +
        '<div class="detail-badges">' + badges + '</div>' +
        '<div class="detail-name">' + esc(s.name) + '</div>' +
        '<div class="detail-loc">' + esc(s.city + (s.district ? ' · ' + s.district : '')) + '</div>' +
        '<div class="detail-tags">' + tags + '</div>' +
      '</div>' +
      '<div class="detail-actions">' +
        '<a href="' + navUrl + '" target="_blank" rel="noopener"><span class="da-ic">➤</span>导航前往</a>' +
        '<button id="dv-visited"><span class="da-ic">' + (visited ? '★' : '☆') + '</span>' + (visited ? '已循迹' : '标记循迹') + '</button>' +
        phoneBtn +
        '<button id="dv-copy"><span class="da-ic">⧉</span>复制地址</button>' +
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
      navBack.onclick = function () { setView(state.prevView || 'map'); };
    }
    /* 地图视图按钮 */
    $('#go-search').onclick = function () { setView('list'); };
    $('#btn-locate').onclick = locate;
    $('#btn-home').onclick = goHome;
    $('#btn-legend').onclick = function () {
      var l = $('#legend');
      var open = l.hidden;
      l.hidden = !open;
      $('#legend-label').textContent = open ? '要素图例 ▴' : '要素图例 ▾';
    };
    /* 底部面板收起 / 展开，便于看全四川 */
    var sheetToggle = $('#sheet-toggle');
    if (sheetToggle) {
      sheetToggle.onclick = function () {
        var s = $('#sheet');
        var collapsed = s.classList.toggle('collapsed');
        var chev = $('#sheet-chevron');
        if (chev) chev.textContent = collapsed ? '展开 ▴' : '收起 ▾';
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
    parseHash();
  });
})();
