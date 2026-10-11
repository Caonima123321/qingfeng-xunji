const { HOME, CITIES, CATEGORIES, PROVINCE_VIEW } = require('../../data/constants.js');
const { SITES } = require('../../data/sites.js');
const { ROUTES } = require('../../data/routes.js');
const siteUtil = require('../../utils/site.js');

/** 市州短名：阿坝藏族羌族自治州 -> 阿坝州 */
function shortCity(name) {
  return name
    .replace('藏族羌族自治州', '州')
    .replace('藏族自治州', '州')
    .replace('彝族自治州', '州');
}

/** 把研学路线的 stations 解析为带名称/坐标的站点列表 */
function resolveStations(route) {
  const byId = {};
  SITES.forEach(function (s) { byId[String(s.id)] = s; });
  return (route.stations || []).map(function (st) {
    if (st.id && byId[String(st.id)]) {
      const s = byId[String(st.id)];
      return {
        id: s.id, name: s.name, lat: s.lat, lng: s.lng,
        kind: s.district || s.city || '廉洁点位', note: ''
      };
    }
    return {
      id: '', name: st.name, lat: st.lat, lng: st.lng,
      kind: st.kind || '顺路景点', note: ''
    };
  });
}

/* ---------------- 点位计数气泡：市州 / 区县（"当前有多少个展馆点位"） ---------------- */
const COUNT_ID_BASE = 900000;   // 计数 marker 的 id 起始值，与点位 id 区分
const DIST_MIN_SCALE = 11;      // 放到这一级由「市州计数」切换为「区县计数」

function countMarker(id, lat, lng, label, n, on) {
  return {
    id: id,
    latitude: lat,
    longitude: lng,
    iconPath: '/assets/marker/pin-count.png',
    width: 1,
    height: 1,
    zIndex: on ? 4 : 1,
    label: {
      content: label + '  ' + n,
      color: on ? '#FFFFFF' : '#2B2B2B',
      fontSize: 11,
      bgColor: on ? '#8C1F28' : '#FFFFFF',
      borderColor: '#8C1F28',
      borderWidth: 1,
      borderRadius: 10,
      padding: 5,
      textAlign: 'center',
      anchorX: -34,
      anchorY: -11
    }
  };
}

/** 生成计数气泡 markers 以及 id → 市州 的映射 */
function buildCountMarkers(list, cityFilter, scale) {
  const markers = [];
  const cityOf = {};
  const byDistrict = !!cityFilter || (scale || 0) >= DIST_MIN_SCALE;

  if (byDistrict) {
    /* 区县级：同一区县的点位聚合成一个气泡 */
    const groups = {}, order = [];
    (list || []).forEach(function (s) {
      const k = s.city + '|' + (s.district || '市辖区');
      if (!groups[k]) {
        groups[k] = { label: s.district || shortCity(s.city), city: s.city, n: 0, lat: 0, lng: 0 };
        order.push(k);
      }
      groups[k].n += 1;
      groups[k].lat += s.lat;
      groups[k].lng += s.lng;
    });
    order.forEach(function (k, i) {
      const g = groups[k];
      const id = COUNT_ID_BASE + 100 + i;
      cityOf[id] = g.city;
      markers.push(countMarker(id, g.lat / g.n, g.lng / g.n, g.label, g.n, false));
    });
  } else {
    /* 市州级：21 个市州各显示当前点位数量 */
    CITIES.forEach(function (c, i) {
      let n = 0;
      SITES.forEach(function (s) { if (s.city === c.name) n += 1; });
      if (!n) return;
      const id = COUNT_ID_BASE + i;
      cityOf[id] = c.name;
      markers.push(countMarker(id, c.lat, c.lng, shortCity(c.name), n, cityFilter === c.name));
    });
  }
  return { markers: markers, cityOf: cityOf };
}

Page({
  data: {
    home: HOME,
    categories: [],
    markers: [],
    filtered: [],
    cityStats: [],
    total: SITES.length,
    center: { lat: HOME.lat, lng: HOME.lng },
    scale: 9,
    activeCategory: '',
    cityFilter: '',
    activeId: '',
    cityPanelOpen: false,
    legendOpen: false,
    sheetUp: true,
    scrollInto: '',
    location: null,
    locating: false,
    userMarkerId: '__me__',
    polyline: [],
    routeInfo: null,
    counts: true
  },

  // 非渲染状态
  _view: { lat: HOME.lat, lng: HOME.lng, scale: 9 },
  _map: null,

  onLoad() {
    this._map = wx.createMapContext('qfmap', this);
    this.buildCityStats();
    this._initialFit = true;   // 首次打开放大到家乡，不缩到全省
    this.applyFilter();
    this.getLocation();
  },

  onShow() {
    // 从详情页返回时刷新"已循迹"标记
    this.applyFilter();
    // 详情页点了「在地图上规划」→ 在本页地图上画路线
    const app = getApp();
    if (app && app.globalData && app.globalData.routeTo) {
      const id = app.globalData.routeTo;
      app.globalData.routeTo = null;
      this.drawRouteTo(id);
    }
    // 路线页点了「在大地图中查看整条线路」
    if (app && app.globalData && app.globalData.studyRoute) {
      const rid = app.globalData.studyRoute;
      app.globalData.studyRoute = null;
      this.drawStudyRoute(rid);
    }
  },

  onShareAppMessage() {
    return {
      title: '清风循迹 · 四川廉洁文化地图',
      path: '/pages/map/map'
    };
  },

  onShareTimeline() {
    return { title: '清风循迹 · 四川廉洁文化地图' };
  },

  /* ---------------- 数据准备 ---------------- */

  buildCityStats() {
    const order = CITIES.map(function (c) { return c.name; });
    const counts = {};
    SITES.forEach(function (s) {
      counts[s.city] = (counts[s.city] || 0) + 1;
    });
    const stats = order
      .map(function (name) {
        return { name: name, short: shortCity(name), count: counts[name] || 0 };
      })
      .filter(function (it) { return it.count > 0; });
    this.setData({ cityStats: stats });
  },

  buildCategories() {
    const base = CATEGORIES.map(function (c) {
      return {
        key: c.key,
        color: c.color,
        desc: c.desc,
        count: SITES.filter(function (s) {
          return (s.categories || []).indexOf(c.key) > -1;
        }).length
      };
    });
    this.setData({ categories: base });
  },

  /** 应用分类 + 市州筛选 */
  applyFilter() {
    const cat = this.data.activeCategory;
    const city = this.data.cityFilter;
    let list = SITES.filter(function (s) {
      if (cat && (s.categories || []).indexOf(cat) === -1) return false;
      if (city && s.city !== city) return false;
      return true;
    });

    // 定位可用时按距离从近到远排序，让"就近参观"直接可用
    const loc = this.data.location;
    if (loc && loc.lat) {
      list = list
        .map(function (s) {
          return Object.assign({}, s, {
            _dist: siteUtil.distanceKm(loc.lat, loc.lng, s.lat, s.lng)
          });
        })
        .sort(function (a, b) { return a._dist - b._dist; });
    }

    const countRes = this.data.counts
      ? buildCountMarkers(list, city, this._view.scale)
      : { markers: [], cityOf: {} };
    this._countCity = countRes.cityOf;

    this.setData({
      filtered: list,
      markers: countRes.markers.concat(this.decorate(siteUtil.buildMarkers(list, this.data.activeId)))
    });
    this.buildCategories();
    this.fitToList(list);
  },

  /** 只重建 marker（含计数气泡），不动视野 */
  refreshMarkers() {
    const list = this.data.filtered;
    const countRes = this.data.counts
      ? buildCountMarkers(list, this.data.cityFilter, this._view.scale)
      : { markers: [], cityOf: {} };
    this._countCity = countRes.cityOf;
    this.setData({
      markers: countRes.markers.concat(this.decorate(siteUtil.buildMarkers(list, this.data.activeId)))
    });
  },

  /** 计数气泡开关 */
  toggleCounts() {
    const on = !this.data.counts;
    this.setData({ counts: on }, this.refreshMarkers);
    wx.showToast({ title: on ? '已显示市州 / 区县点位计数' : '已隐藏点位计数', icon: 'none' });
  },

  /** 在点位 marker 之上附加"我的位置"marker */
  decorate(markers) {
    const loc = this.data.location;
    if (!loc || !loc.lat) return markers;
    return markers.concat([
      {
        id: this.data.userMarkerId,
        latitude: loc.lat,
        longitude: loc.lng,
        iconPath: '/assets/marker/pin-me.png',
        width: 22,
        height: 22,
        zIndex: 5
      }
    ]);
  },

  /** 视野自适应到筛选结果 */
  fitToList(list) {
    if (!list.length) return;
    if (this._initialFit) {
      this._initialFit = false;
      this.moveTo(HOME.lat, HOME.lng, 9);   // 打开默认放大到家乡
      return;
    }
    if (list.length === 1) {
      this.moveTo(list[0].lat, list[0].lng, 13);
      return;
    }
    const points = list.map(function (s) {
      return { latitude: s.lat, longitude: s.lng };
    });
    this._map.includePoints({
      points: points,
      padding: [140, 60, 420, 60]
    });
  },

  moveTo(lat, lng, scale) {
    this._view = { lat: lat, lng: lng, scale: scale };
    this.setData({ center: { lat: lat, lng: lng }, scale: scale });
  },

  /* ---------------- 应用内路线规划（不依赖任何地图账号 / 登录） ---------------- */

  /** 在自有地图上画出「我的位置 → 点位」的示意路线 */
  drawRouteTo(siteId) {
    const site = SITES.filter(function (s) { return String(s.id) === String(siteId); })[0];
    if (!site) return;
    const loc = this.data.location;
    if (!loc || !loc.lat) {
      wx.showToast({ title: '需先允许定位，已改为打开内置地图', icon: 'none' });
      siteUtil.openLocation(site);
      return;
    }
    const km = siteUtil.distanceKm(loc.lat, loc.lng, site.lat, site.lng);
    this.setData({
      polyline: [{
        points: [
          { latitude: loc.lat, longitude: loc.lng },
          { latitude: site.lat, longitude: site.lng }
        ],
        color: '#8C1F28',
        width: 5,
        dottedLine: true,
        arrowLine: false
      }],
      routeInfo: { id: site.id, name: site.name, distText: siteUtil.distanceText(km) }
    });
    if (this._map) {
      this._map.includePoints({
        points: [
          { latitude: loc.lat, longitude: loc.lng },
          { latitude: site.lat, longitude: site.lng }
        ],
        padding: [140, 60, 400, 60]
      });
    }
    wx.showToast({ title: '已规划路线，虚线为示意', icon: 'none' });
  },

  clearRoute() {
    this.setData({ polyline: [], routeInfo: null });
    this.applyFilter();
  },

  /** 内部地图路线只作示意，真实路况导航仍走微信内置地图 */
  onRouteNav() {
    const info = this.data.routeInfo;
    if (!info) return;
    const site = SITES.filter(function (s) { return String(s.id) === String(info.id); })[0];
    if (site) siteUtil.openLocation(site);
  },

  /** 研学路线：在地图上画出整条线路 + 编号站点 */
  drawStudyRoute(routeId) {
    const route = ROUTES.filter(function (r) { return String(r.id) === String(routeId); })[0];
    if (!route) return;
    const stops = resolveStations(route);
    if (stops.length < 2) return;
    const pts = stops.map(function (s) { return { latitude: s.lat, longitude: s.lng }; });
    let total = 0;
    for (let i = 1; i < stops.length; i++) {
      total += siteUtil.distanceKm(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng) || 0;
    }
    this.setData({
      polyline: [{ points: pts, color: '#8C1F28', width: 5, dottedLine: true, arrowLine: false }],
      markers: stops.map(function (s, i) {
        return {
          id: 9000 + i,
          latitude: s.lat,
          longitude: s.lng,
          iconPath: '/assets/marker/pin-all-on.png',
          width: 32,
          height: 32,
          callout: {
            content: (i + 1) + '. ' + s.name,
            color: '#2B2B2B', fontSize: 12, bgColor: '#FFFFFF',
            borderColor: '#8C1F28', borderWidth: 1, borderRadius: 8,
            padding: 6, display: 'ALWAYS', textAlign: 'center'
          }
        };
      }),
      routeInfo: {
        id: route.id,
        name: route.name,
        study: true,
        stops: stops.length,
        distText: siteUtil.distanceText(Math.round(total * 10) / 10)
      }
    });
    if (this._map) {
      this._map.includePoints({ points: pts, padding: [150, 60, 400, 60] });
    }
    wx.showToast({ title: '已在地图上画出整条线路', icon: 'none' });
  },

  /** 打开研学路线（小地图）页 */
  goRoute() {
    const info = this.data.routeInfo;
    const q = info && info.study ? '?id=' + info.id : '';
    wx.navigateTo({ url: '/pages/route/route' + q });
  },

  /* ---------------- 定位 ---------------- */

  getLocation() {
    const that = this;
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        that.applyLocation(res.latitude, res.longitude);
      },
      fail() {
        // 用户未授权：不影响地图浏览，仅在需要时就近排序
        that.setData({ locating: false });
      }
    });
  },

  applyLocation(lat, lng) {
    this.setData({ location: { lat: lat, lng: lng }, locating: false });
    this.applyFilter();
  },

  locateMe() {
    if (this.data.location) {
      this.moveTo(this.data.location.lat, this.data.location.lng, 11);
      wx.showToast({ title: '已回到您的位置', icon: 'none' });
      return;
    }
    const that = this;
    this.setData({ locating: true });
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        that.applyLocation(res.latitude, res.longitude);
        wx.showToast({ title: '定位成功，已按距离排序', icon: 'none' });
      },
      fail() {
        that.setData({ locating: false });
        wx.showModal({
          title: '需要位置权限',
          content: '开启定位后可自动按距离为您就近推荐廉洁文化场馆。',
          confirmText: '去设置',
          success(r) {
            if (r.confirm) wx.openSetting({});
          }
        });
      }
    });
  },

  /** 回到"我的家乡" */
  goHome() {
    this.setData({ cityPanelOpen: false, cityFilter: HOME.city });
    this.applyFilter();
    this.moveTo(HOME.lat, HOME.lng, 10);
    wx.showToast({ title: '已定位到' + HOME.label, icon: 'none' });
  },

  /* ---------------- 交互 ---------------- */

  onMarkerTap(e) {
    const id = e.detail.markerId;
    if (id === this.data.userMarkerId) return;
    /* 计数气泡：点市州 → 筛选并下钻区县；点区县 → 筛选该市州 */
    if (typeof id === 'number' && id >= COUNT_ID_BASE) {
      const city = (this._countCity || {})[id];
      if (!city) return;
      this.setData({ cityFilter: this.data.cityFilter === city ? '' : city }, this.applyFilter);
      return;
    }
    const hit = this.data.filtered.find(function (s) { return String(s.id) === String(id); });
    if (!hit) return;
    this.setData({
      activeId: id,
      markers: this.decorate(siteUtil.buildMarkers(this.data.filtered, id)),
      sheetUp: true,
      scrollInto: 'c-' + id
    });
    this.moveTo(hit.lat, hit.lng, Math.max(this._view.scale, 10));
  },

  onMapTap() {
    this.setData({
      activeId: '',
      markers: this.decorate(siteUtil.buildMarkers(this.data.filtered, null))
    });
  },

  onRegionChange(e) {
    if (e.type !== 'end' || !e.detail || !e.detail.centerLocation) return;
    const prev = this._view.scale;
    const next = e.detail.scale;
    this._view = {
      lat: e.detail.centerLocation.latitude,
      lng: e.detail.centerLocation.longitude,
      scale: next
    };
    /* 跨过「市州计数 / 区县计数」分界时重建气泡（不动视野） */
    if (this.data.counts && (prev < DIST_MIN_SCALE) !== (next < DIST_MIN_SCALE)) {
      this.refreshMarkers();
    }
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeCategory: this.data.activeCategory === key ? '' : key }, this.applyFilter);
  },

  onCityTap(e) {
    const city = e.currentTarget.dataset.city;
    this.setData({ cityFilter: city, cityPanelOpen: false }, this.applyFilter);
  },

  openCityPanel() {
    this.setData({ cityPanelOpen: true });
  },

  closeCityPanel() {
    this.setData({ cityPanelOpen: false });
  },

  resetFilter() {
    this.setData({ activeCategory: '', cityFilter: '' }, function () {
      this.applyFilter();
      this.moveTo(PROVINCE_VIEW.lat, PROVINCE_VIEW.lng, PROVINCE_VIEW.scale);
    });
  },

  toggleLegend() {
    this.setData({ legendOpen: !this.data.legendOpen });
  },

  toggleSheet() {
    this.setData({ sheetUp: !this.data.sheetUp });
  },

  onListScroll() {
    // 列表滚动时收起图例，避免遮挡
    if (this.data.legendOpen) this.setData({ legendOpen: false });
  },

  onCardTap(e) {
    siteUtil.goDetail(e.detail.id);
  },

  goSearch() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' });
  }
});
