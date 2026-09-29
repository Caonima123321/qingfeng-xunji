const { HOME, CATEGORIES } = require('../../data/constants.js');
const { SITES } = require('../../data/sites.js');
const siteUtil = require('../../utils/site.js');

Page({
  data: {
    keyword: '',
    scope: 'all',
    activeCategory: '',
    categories: [],
    groups: [],
    total: SITES.length,
    homeCount: 0,
    visitedCount: 0,
    location: null,
    locating: false,
    nearMode: false
  },

  onLoad() {
    this.buildCategories();
    this.setData({ homeCount: SITES.filter(function (s) { return s.city === HOME.city; }).length });
    this.refreshVisitedCount();
    this.query();
    this.locateMe(true);
  },

  onShow() {
    this.refreshVisitedCount();
    this.query();
  },

  buildCategories() {
    this.setData({
      categories: CATEGORIES.map(function (c) {
        return {
          key: c.key,
          color: c.color,
          count: SITES.filter(function (s) {
            return (s.categories || []).indexOf(c.key) > -1;
          }).length
        };
      })
    });
  },

  refreshVisitedCount() {
    const visited = siteUtil.getVisited();
    this.setData({ visitedCount: Object.keys(visited).length });
  },

  /* ---------------- 查询 ---------------- */

  query() {
    const kw = this.data.keyword.trim();
    const scope = this.data.scope;
    const cat = this.data.activeCategory;
    const visited = siteUtil.getVisited();
    const loc = this.data.location;

    let list = SITES.filter(function (s) {
      if (cat && (s.categories || []).indexOf(cat) === -1) return false;
      if (scope === 'home' && s.city !== HOME.city) return false;
      if (scope === 'visited' && !visited[String(s.id)]) return false;
      if (!kw) return true;
      const hay = [
        s.name,
        s.city,
        s.district || '',
        s.address || '',
        (s.tags || []).join(' '),
        (s.categories || []).join(' '),
        s.summary || ''
      ].join(' ');
      return hay.indexOf(kw) > -1;
    });

    if (loc && loc.lat && scope !== 'visited') {
      list = list
        .map(function (s) {
          return Object.assign({}, s, {
            _dist: siteUtil.distanceKm(loc.lat, loc.lng, s.lat, s.lng)
          });
        })
        .sort(function (a, b) { return a._dist - b._dist; });
    }

    this.setData({ groups: this.group(list), nearMode: !!(loc && loc.lat && scope !== 'visited') });
  },

  /** 按市州分组，市州顺序遵循 CITIES 的行政顺序；就近模式下按距离排序则不再分组 */
  group(list) {
    if (this.data.nearMode) {
      return list.length ? [{ city: '按距离就近排列', list: list }] : [];
    }
    const order = [];
    const map = {};
    list.forEach(function (s) {
      if (!map[s.city]) {
        map[s.city] = [];
        order.push(s.city);
      }
      map[s.city].push(s);
    });
    return order.map(function (city) {
      return { city: city, list: map[city] };
    });
  },

  /* ---------------- 交互 ---------------- */

  onInput(e) {
    const that = this;
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._t);
    this._t = setTimeout(function () { that.query(); }, 180);
  },

  clearKeyword() {
    this.setData({ keyword: '' }, this.query);
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeCategory: this.data.activeCategory === key ? '' : key }, this.query);
  },

  onScopeTap(e) {
    this.setData({ scope: e.currentTarget.dataset.scope }, this.query);
  },

  resetAll() {
    this.setData({ keyword: '', activeCategory: '', scope: 'all' }, this.query);
  },

  onCardTap(e) {
    siteUtil.goDetail(e.detail.id);
  },

  /** 切到地图页并聚焦该市州 */
  flyCity(e) {
    const city = e.currentTarget.dataset.city;
    wx.switchTab({
      url: '/pages/map/map',
      success() {
        const pages = getCurrentPages();
        const mapPage = pages[pages.length - 1];
        if (mapPage && mapPage.setData) {
          mapPage.setData({ cityFilter: city });
          if (mapPage.applyFilter) mapPage.applyFilter();
        }
      }
    });
  },

  locateMe(silent) {
    const that = this;
    if (this.data.location) return;
    this.setData({ locating: true });
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        that.setData(
          { location: { lat: res.latitude, lng: res.longitude }, locating: false },
          that.query
        );
      },
      fail() {
        that.setData({ locating: false });
        if (!silent) {
          wx.showToast({ title: '未获得定位权限，可按市州浏览', icon: 'none' });
        }
      }
    });
  },

  clearLocation() {
    this.setData({ location: null, nearMode: false }, this.query);
  }
});
