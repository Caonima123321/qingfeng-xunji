const { findSite, sitesOfCity } = require('../../data/sites.js');
const siteUtil = require('../../utils/site.js');

Page({
  data: {
    site: null,
    color: '#8C1F28',
    visited: false,
    siblings: []
  },

  onLoad(options) {
    const site = findSite(options.id);
    if (!site) {
      this.setData({ site: null });
      return;
    }
    const visited = !!siteUtil.getVisited()[String(site.id)];
    this.setData({
      site: site,
      color: siteUtil.categoryColor(site),
      visited: visited,
      siblings: sitesOfCity(site.city).filter(function (s) {
        return s.id !== site.id;
      })
    });
    wx.setNavigationBarTitle({ title: site.name });
  },

  onShareAppMessage() {
    const site = this.data.site;
    return {
      title: site ? '廉洁点位推荐：' + site.name : '清风循迹 · 廉洁文化地图',
      path: '/pages/detail/detail?id=' + (site ? site.id : '')
    };
  },

  onNavigate() {
    siteUtil.openLocation(this.data.site);
  },

  /** 回到地图页并聚焦该点位 */
  onGoMap() {
    const site = this.data.site;
    wx.switchTab({
      url: '/pages/map/map',
      success() {
        const pages = getCurrentPages();
        const mapPage = pages[pages.length - 1];
        if (mapPage && mapPage.onMarkerTap) {
          mapPage.setData({ cityFilter: '' });
          if (mapPage.applyFilter) mapPage.applyFilter();
          mapPage.onMarkerTap({ detail: { markerId: site.id } });
        }
      }
    });
  },

  onCall() {
    const phone = this.data.site && this.data.site.phone;
    if (!phone) {
      wx.showToast({ title: '该点位暂未收录预约电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: String(phone).replace(/-/g, '') });
  },

  onToggleVisited() {
    const on = siteUtil.toggleVisited(this.data.site.id);
    this.setData({ visited: on });
    wx.showToast({ title: on ? '已标记循迹，可在「我的循迹」查看' : '已取消标记', icon: 'none' });
  },

  onSiblingTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.redirectTo({ url: '/pages/detail/detail?id=' + id });
  }
});
