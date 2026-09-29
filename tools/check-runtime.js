/**
 * 运行时逻辑自检：node tools/check-runtime.js
 * 在不依赖微信环境的前提下，模拟 wx 全局，验证 marker 构建、距离排序、筛选与分组逻辑。
 */
global.wx = {
  getStorageSync() { return {}; },
  setStorageSync() {},
  showToast() {},
  openLocation() {},
  navigateTo() {},
  switchTab() {}
};

const path = require('path');
const { SITES } = require(path.join(__dirname, '..', 'data', 'sites.js'));
const { CITIES, CATEGORIES, HOME } = require(path.join(__dirname, '..', 'data', 'constants.js'));
const siteUtil = require(path.join(__dirname, '..', 'utils', 'site.js'));

const out = [];
let fail = 0;
function ok(label, cond, extra) {
  out.push((cond ? '  OK   ' : '  FAIL ') + label + (extra ? '  -> ' + extra : ''));
  if (!cond) fail += 1;
}

out.push('=== 运行时逻辑自检 ===');

/* 1. marker 构建 */
const markers = siteUtil.buildMarkers(SITES, SITES[3].id);
ok('marker 数量与点位一致', markers.length === SITES.length, markers.length + ' / ' + SITES.length);
ok('每个 marker 都有合法 iconPath', markers.every(function (m) { return /^\/assets\/marker\/pin-.+\.png$/.test(m.iconPath); }));
ok('选中项被放大并置顶', markers[3].width === 52 && markers[3].zIndex === 99, markers[3].width + '/' + markers[3].zIndex);
ok('选中项 callout 常显', markers[3].callout.display === 'ALWAYS');
ok('非选中项 callout 点击显示', markers[0].callout.display === 'BYCLICK');
ok('marker 坐标全部为数字', markers.every(function (m) { return typeof m.latitude === 'number' && typeof m.longitude === 'number'; }));

/* 2. 分类配色 */
const colorSet = {};
SITES.forEach(function (s) { colorSet[siteUtil.categoryColor(s)] = true; });
ok('分类配色命中五类要素色板', Object.keys(colorSet).every(function (c) {
  return CATEGORIES.some(function (x) { return x.color === c; }) || c === '#8C1F28';
}), Object.keys(colorSet).join(','));

/* 3. 距离计算 */
const d = siteUtil.distanceKm(30.572815, 104.066801, 30.837332, 106.110244); // 成都 -> 南充
ok('成都到南充距离合理（180-260km）', d > 180 && d < 260, d + ' km');
ok('同点距离为 0', siteUtil.distanceKm(30, 104, 30, 104) === 0);
ok('非法坐标返回 null', siteUtil.distanceKm(null, 104, 30, 104) === null);
ok('距离文案格式化', siteUtil.distanceText(0.4) === '400 m' && siteUtil.distanceText(12.34) === '12.3 km', siteUtil.distanceText(0.4) + ' / ' + siteUtil.distanceText(12.34));

/* 4. 就近排序：从家乡出发，朱德故里应排在很靠前 */
const near = SITES
  .map(function (s) { return Object.assign({}, s, { _d: siteUtil.distanceKm(HOME.lat, HOME.lng, s.lat, s.lng) }); })
  .sort(function (a, b) { return a._d - b._d; });
out.push('  家乡（' + HOME.city + '）最近的 5 个点位：');
near.slice(0, 5).forEach(function (s) { out.push('    · ' + s.name + '（' + s.city + '） ' + siteUtil.distanceText(s._d)); });
ok('就近排序首位在南充或相邻市州', ['南充市', '广元市', '达州市', '巴中市', '遂宁市', '广安市', '绵阳市'].indexOf(near[0].city) > -1, near[0].city + ' / ' + near[0].name);

/* 5. 筛选逻辑 */
const cityFiltered = SITES.filter(function (s) { return s.city === HOME.city; });
ok('家乡筛选有点位', cityFiltered.length > 0, cityFiltered.length + ' 处');
CATEGORIES.forEach(function (c) {
  const n = SITES.filter(function (s) { return s.categories.indexOf(c.key) > -1; }).length;
  ok('分类「' + c.key + '」有点位', n > 0, n + ' 处');
});
const kw = '家风';
const kwHit = SITES.filter(function (s) {
  return [s.name, s.city, s.district || '', s.address || '', (s.tags || []).join(' '), s.categories.join(' '), s.summary].join(' ').indexOf(kw) > -1;
});
ok('关键词「家风」能命中点位', kwHit.length >= 5, kwHit.length + ' 处');

/* 6. 分组 */
const groups = {};
SITES.forEach(function (s) { groups[s.city] = (groups[s.city] || 0) + 1; });
ok('分组覆盖 21 市州', Object.keys(groups).length === 21, Object.keys(groups).length + ' 个市州');
ok('21 市州坐标齐全', CITIES.length === 21);

out.push('');
out.push(fail === 0 ? '结论：运行时逻辑自检通过（' + (out.filter(function (l) { return l.indexOf('  OK') === 0; }).length) + ' 项断言）。' : '结论：存在 ' + fail + ' 项断言失败。');

process.stdout.write(out.join('\n') + '\n');
process.exitCode = fail ? 1 : 0;
