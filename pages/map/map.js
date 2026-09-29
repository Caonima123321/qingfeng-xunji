const { HOME, CITIES, CATEGORIES, PROVINCE_VIEW } = require('../../data/constants.js');
const { SITES } = require('../../data/sites.js');
const siteUtil = require('../../utils/site.js');

/** 市州短名：阿坝藏族羌族自治州 -> 阿坝州 */
function shortCity(name) {
  return name
    .replace('藏族羌族自治州', '州')
    .replace('藏族自治州', '州')
    .replace('彝族自治州', '州');
}

Page({
  data: {
    home: HOME,
    categories: [],
    markers: [],
    filtered: [],
    cityStats: [],
    total: SITES.length,
    center: { lat: PROVINCE_VIEW.lat, lng: PROVINCE_VIEW.lng },
    scale: PROVINCE_VIEW.scale,
    activeCategory: '',
    cityFilter: '',
    activeId: '',
    cityPanelOpen: false,
    legendOpen: false,
    sheetUp: true,
    scrollInto: '',
    location: null,
    locating: false,
    userMarkerId: '__me__'
  },

  // 非渲染状态
  _view: { lat: PROVINCE_VIEW.lat, lng: PROVINCE_VIEW.lng, scale: PROVINCE_VIEW.scale },
  _map: null,

  onLoad() {
    this._map = wx.createMapContext('qfmap', this);
    this.buildCityStats();
    this.applyFilter();
    this.getLocation();
  },

  onShow() {
    // 从详情页返回时刷新"已循迹"标记
    this.applyFilter();
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

    this.setData({
      filtered: list,
      markers: this.decorate(siteUtil.buildMarkers(list, this.data.activeId))
    });
    this.buildCategories();
    this.fitToList(list);
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
    this._view = {
      lat: e.detail.centerLocation.latitude,
      lng: e.detail.centerLocation.longitude,
      scale: e.detail.scale
    };
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
