const { HOME } = require('./data/constants.js');

App({
  globalData: {
    /** 从地图页跳详情页时携带的点位，避免 URL 传大对象 */
    detailSite: null,
    /** 定位结果缓存 */
    location: null,
    /** 我的家乡（市州名），用于"廉洁地图·家乡"快捷入口 */
    homeCity: HOME.city
  },

  onLaunch() {
    // 收藏 / 打卡数据落盘，供"我的循迹"使用
    try {
      const visited = wx.getStorageSync('visitedSites');
      if (!visited || typeof visited !== 'object') {
        wx.setStorageSync('visitedSites', {});
      }
    } catch (e) {
      // 存储不可用时静默降级，不影响地图浏览
    }
  },

  onShow() {},

  onError(err) {
    console.error('[清风循迹] 运行时错误：', err);
  }
});
