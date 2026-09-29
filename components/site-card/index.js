const siteUtil = require('../../utils/site.js');

Component({
  options: { addGlobalClass: true },
  properties: {
    site: { type: Object, value: {} },
    /** 用户定位，用于显示距离 */
    location: { type: Object, value: null }
  },
  data: {
    color: '#8C1F28',
    distText: '',
    visited: false
  },
  observers: {
    'site, location': function (site, location) {
      if (!site || !site.id) return;
      const patch = {
        color: siteUtil.categoryColor(site),
        visited: !!siteUtil.getVisited()[String(site.id)]
      };
      if (location && location.lat) {
        const km = siteUtil.distanceKm(location.lat, location.lng, site.lat, site.lng);
        patch.distText = siteUtil.distanceText(km);
      } else {
        patch.distText = '';
      }
      this.setData(patch);
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.site.id });
    }
  }
});
