/**
 * 点位数据自检脚本：node tools/check-data.js
 * 校验 id 唯一、坐标范围、市州与分类取值、必填字段完整性。
 */
const path = require('path');
const { SITES } = require(path.join(__dirname, '..', 'data', 'sites.js'));
const { CITIES, CATEGORIES, HOME } = require(path.join(__dirname, '..', 'data', 'constants.js'));

const cityNames = CITIES.map(function (c) { return c.name; });
const catKeys = CATEGORIES.map(function (c) { return c.key; });

const errors = [];
const warnings = [];
const seen = {};

SITES.forEach(function (s, i) {
  const at = '[' + (i + 1) + '] ' + (s.name || s.id || '未命名');

  if (!s.id) errors.push(at + '：缺少 id');
  if (seen[s.id]) errors.push(at + '：id 重复（' + s.id + '）');
  seen[s.id] = true;

  if (!s.name) errors.push(at + '：缺少 name');
  if (cityNames.indexOf(s.city) === -1) errors.push(at + '：市州不在四川 21 市州列表内 -> ' + s.city);
  if (!s.address) warnings.push(at + '：缺少 address');

  if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
    errors.push(at + '：坐标缺失或非数字');
  } else {
    if (s.lat < 26 || s.lat > 34.5) errors.push(at + '：纬度超出四川范围 -> ' + s.lat);
    if (s.lng < 97 || s.lng > 109) errors.push(at + '：经度超出四川范围 -> ' + s.lng);
  }

  if (!Array.isArray(s.categories) || !s.categories.length) {
    errors.push(at + '：缺少 categories');
  } else {
    s.categories.forEach(function (c) {
      if (catKeys.indexOf(c) === -1) errors.push(at + '：非法分类 -> ' + c);
    });
  }

  if (!s.summary || s.summary.length < 20) warnings.push(at + '：summary 过短或缺失');
  if (!Array.isArray(s.highlights) || s.highlights.length < 2) warnings.push(at + '：highlights 少于 2 条');
  if (!s.story || s.story.length < 40) warnings.push(at + '：story 过短或缺失');
  if (s.verify !== 'verified' && s.verify !== 'est') errors.push(at + '：verify 取值应为 verified / est');
});

/* 市州覆盖检查 */
const covered = {};
SITES.forEach(function (s) { covered[s.city] = (covered[s.city] || 0) + 1; });
const missing = cityNames.filter(function (c) { return !covered[c]; });
if (missing.length) warnings.push('以下市州暂无点位：' + missing.join('、'));

/* 家乡检查 */
if (cityNames.indexOf(HOME.city) === -1) errors.push('HOME.city 非法：' + HOME.city);
if (!covered[HOME.city]) warnings.push('我的家乡（' + HOME.city + '）暂无点位');

const out = [];
out.push('=== 清风循迹 · 点位数据自检 ===');
out.push('点位数：' + SITES.length + '　覆盖市州：' + Object.keys(covered).length + '/' + cityNames.length);
out.push('');
out.push('各市州点位数：');
cityNames.forEach(function (c) {
  out.push('  ' + c + '：' + (covered[c] || 0));
});
out.push('');
out.push('分类分布：');
catKeys.forEach(function (k) {
  out.push('  ' + k + '：' + SITES.filter(function (s) { return s.categories.indexOf(k) > -1; }).length);
});
out.push('');
out.push('错误 ' + errors.length + ' 项：');
errors.forEach(function (e) { out.push('  ✗ ' + e); });
out.push('提示 ' + warnings.length + ' 项：');
warnings.forEach(function (w) { out.push('  ! ' + w); });
out.push('');
out.push(errors.length === 0 ? '结论：数据校验通过（无阻断性错误）。' : '结论：存在阻断性错误，请修正后再发布。');

process.stdout.write(out.join('\n') + '\n');
process.exitCode = errors.length ? 1 : 0;
