const { CATEGORIES } = require('../data/constants.js');

/** 分类 -> marker 图标（普通 / 选中） */
const PIN_MAP = {
  '红色廉洁': { normal: '/assets/marker/pin-red.png', active: '/assets/marker/pin-red-on.png' },
  '清官廉吏': { normal: '/assets/marker/pin-official.png', active: '/assets/marker/pin-official-on.png' },
  '家风家训': { normal: '/assets/marker/pin-family.png', active: '/assets/marker/pin-family-on.png' },
  '廉政教育': { normal: '/assets/marker/pin-edu.png', active: '/assets/marker/pin-edu-on.png' },
  '行业清风': { normal: '/assets/marker/pin-industry.png', active: '/assets/marker/pin-industry-on.png' }
};

const PIN_HOME = { normal: '/assets/marker/pin-home.png', active: '/assets/marker/pin-home.png' };
const PIN_DEFAULT = { normal: '/assets/marker/pin-all.png', active: '/assets/marker/pin-all-on.png' };

function pinOf(site, active) {
  const set = PIN_MAP[(site.categories || [])[0]] || PIN_DEFAULT;
  return active ? set.active : set.normal;
}

function categoryColor(site) {
  const hit = CATEGORIES.find(function (c) {
    return (site.categories || []).indexOf(c.key) > -1;
  });
  return hit ? hit.color : '#8C1F28';
}

/**
 * 生成 map 组件的 markers 数组
 * @param {Array} sites 点位
 * @param {String|Number} activeId 当前选中点位 id
 */
function buildMarkers(sites, activeId) {
  return (sites || []).map(function (site) {
    const active = activeId != null && String(activeId) === String(site.id);
    const width = active ? 52 : 38;
    return {
      id: site.id,
      latitude: site.lat,
      longitude: site.lng,
      iconPath: pinOf(site, active),
      width: width,
      height: width,
      zIndex: active ? 99 : 10,
      joinCluster: false,
      callout: {
        content: site.name,
        color: '#2B2B2B',
        fontSize: 12,
        bgColor: '#FFFFFF',
        borderColor: categoryColor(site),
        borderWidth: 1,
        borderRadius: 8,
        padding: 6,
        display: active ? 'ALWAYS' : 'BYCLICK',
        textAlign: 'center'
      }
    };
  });
}

/** 两点球面距离（公里），保留 1 位小数 */
function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(function (v) { return typeof v !== 'number' || isNaN(v); })) return null;
  const R = 6371;
  const toRad = function (d) { return (d * Math.PI) / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function distanceText(km) {
  if (km == null) return '';
  if (km < 1) return Math.round(km * 1000) + ' m';
  if (km < 100) return Math.round(km * 10) / 10 + ' km';
  return Math.round(km) + ' km';
}

/** 打开微信内置地图 */
function openLocation(site) {
  wx.openLocation({
    latitude: site.lat,
    longitude: site.lng,
    name: site.name,
    address: (site.city || '') + (site.district || '') + (site.address || ''),
    scale: 16,
    fail: function () {
      wx.showToast({ title: '暂时无法打开地图', icon: 'none' });
    }
  });
}

/** 带高亮参数跳转详情页 */
function goDetail(id) {
  wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
}

/** 打卡（收藏）状态读写 */
function getVisited() {
  try {
    return wx.getStorageSync('visitedSites') || {};
  } catch (e) {
    return {};
  }
}

function toggleVisited(id) {
  const all = getVisited();
  const key = String(id);
  if (all[key]) {
    delete all[key];
  } else {
    all[key] = Date.now();
  }
  try {
    wx.setStorageSync('visitedSites', all);
  } catch (e) {
    // 忽略
  }
  return !!all[key];
}

module.exports = {
  PIN_MAP: PIN_MAP,
  PIN_HOME: PIN_HOME,
  PIN_DEFAULT: PIN_DEFAULT,
  buildMarkers: buildMarkers,
  categoryColor: categoryColor,
  distanceKm: distanceKm,
  distanceText: distanceText,
  openLocation: openLocation,
  goDetail: goDetail,
  getVisited: getVisited,
  toggleVisited: toggleVisited
};
