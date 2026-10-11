const { SITES } = require('../../data/sites.js');
const { CATEGORIES, HOME } = require('../../data/constants.js');
const { ROUTES } = require('../../data/routes.js');

/** 封面页（总览）：文字介绍 + 这是一张什么图 + 箭头按钮进入大地图 */
Page({
  data: {
    home: HOME,
    stats: [],
    categories: [],
    routes: []
  },

  onLoad() {
    const cities = {};
    SITES.forEach(function (s) { cities[s.city] = 1; });
    const cats = CATEGORIES.map(function (c) {
      const n = SITES.filter(function (s) {
        return (s.categories || []).indexOf(c.key) > -1;
      }).length;
      return { key: c.key, color: c.color, icon: c.icon, count: n };
    });
    this.setData({
      stats: [
        { n: SITES.length, t: '廉洁点位' },
        { n: Object.keys(cities).length, t: '市州覆盖' },
        { n: CATEGORIES.length, t: '廉洁要素' }
      ],
      categories: cats,
      routes: ROUTES.map(function (r) {
        return {
          id: r.id,
          name: r.name,
          desc: r.desc,
          days: r.days,
          city: r.city,
          stops: (r.stations || []).length
        };
      })
    });
  },

  /** 箭头按钮：进入大地图 */
  onEnter() {
    wx.switchTab({ url: '/pages/map/map' });
  },

  /** 研学路线 → 小地图 */
  onRoute(e) {
    wx.navigateTo({ url: '/pages/route/route?id=' + e.currentTarget.dataset.id });
  },

  onShareAppMessage() {
    return { title: '清风循迹 · 四川廉洁文化地图', path: '/pages/cover/cover' };
  },

  onShareTimeline() {
    return { title: '清风循迹 · 四川廉洁文化地图' };
  }
});
