const { SITES } = require('../../data/sites.js');
const { ROUTES } = require('../../data/routes.js');
const siteUtil = require('../../utils/site.js');

/** 把路线的 stations 解析为带名称/坐标的站点列表 */
function resolveStations(route) {
  const byId = {};
  SITES.forEach(function (s) { byId[String(s.id)] = s; });
  return (route.stations || []).map(function (st) {
    if (st.id && byId[String(st.id)]) {
      const s = byId[String(st.id)];
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        kind: s.district || s.city || '廉洁点位',
        note: (s.categories || []).join(' · ')
      };
    }
    return {
      id: '',
      name: st.name,
      lat: st.lat,
      lng: st.lng,
      kind: st.kind || '顺路景点',
      note: st.note || ''
    };
  });
}

/** 研学路线（小地图）：路线连线 + 站点顺序 + 里程 */
Page({
  data: {
    tabs: [],
    routeId: '',
    route: {},
    stops: [],
    totalText: '',
    center: { lat: 30.6, lng: 104.0 },
    scale: 8,
    polyline: [],
    markers: []
  },

  onLoad(query) {
    this.setData({
      tabs: ROUTES.map(function (r) {
        return { id: r.id, label: r.city || r.name };
      })
    });
    this.show((query && query.id) || (ROUTES[0] && ROUTES[0].id));
  },

  onReady() {
    this._map = wx.createMapContext('routemap', this);
    this.fit();
  },

  show(id) {
    const route = ROUTES.filter(function (r) {
      return String(r.id) === String(id);
    })[0] || ROUTES[0];
    if (!route) return;

    const stops = resolveStations(route);
    let total = 0;
    stops.forEach(function (s, i) {
      if (i === 0) { s.leg = '起点'; return; }
      const km = siteUtil.distanceKm(stops[i - 1].lat, stops[i - 1].lng, s.lat, s.lng);
      s.leg = '↑ ' + siteUtil.distanceText(km);
      total += km || 0;
    });

    const pts = stops.map(function (s) { return { latitude: s.lat, longitude: s.lng }; });
    this._pts = pts;

    this.setData({
      routeId: route.id,
      route: { name: route.name, city: route.city, days: route.days, intro: route.intro },
      stops: stops,
      totalText: siteUtil.distanceText(Math.round(total * 10) / 10),
      center: stops.length ? { lat: stops[0].lat, lng: stops[0].lng } : this.data.center,
      polyline: [{
        points: pts,
        color: '#8C1F28',
        width: 5,
        dottedLine: true,
        arrowLine: false
      }],
      markers: stops.map(function (s, i) {
        return {
          id: i + 1,
          latitude: s.lat,
          longitude: s.lng,
          iconPath: '/assets/marker/pin-all-on.png',
          width: 32,
          height: 32,
          callout: {
            content: (i + 1) + '. ' + s.name,
            color: '#2B2B2B',
            fontSize: 12,
            bgColor: '#FFFFFF',
            borderColor: '#8C1F28',
            borderWidth: 1,
            borderRadius: 8,
            padding: 6,
            display: 'ALWAYS',
            textAlign: 'center'
          }
        };
      })
    });

    this.fit();
  },

  /** 缩放到刚好容纳整条线路 */
  fit() {
    if (!this._map || !this._pts || this._pts.length < 2) return;
    const that = this;
    setTimeout(function () {
      that._map.includePoints({ points: that._pts, padding: [90, 40, 90, 40] });
    }, 80);
  },

  onTab(e) {
    this.show(e.currentTarget.dataset.id);
  },

  onStop(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  /** 在大地图中查看整条线路 */
  onMap() {
    const app = getApp();
    if (app && app.globalData) app.globalData.studyRoute = this.data.routeId;
    wx.switchTab({ url: '/pages/map/map' });
  },

  onShareAppMessage() {
    return {
      title: this.data.route.name || '清风循迹 · 研学路线',
      path: '/pages/route/route?id=' + this.data.routeId
    };
  }
});
