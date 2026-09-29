/**
 * H5 静态校验：node tools/check-h5.js
 * 校验 data.js 可加载且点位数正确、index.html 与 app.js 的 id 引用一致、app.js 语法无误。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const h5 = path.join(root, 'h5');
const out = [];
let fail = 0;

/* 1. data.js 可加载 */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(h5, 'js', 'data.js'), 'utf8'), ctx);
const sites = ctx.window.QF_SITES || [];
out.push('QF_SITES 点位数：' + sites.length);
if (sites.length !== 92) { fail++; out.push('  ✗ 应为 92'); }
out.push('QF_CITIES：' + (ctx.window.QF_CITIES || []).length + ' 个市州');
if ((ctx.window.QF_CITIES || []).length !== 21) { fail++; out.push('  ✗ 应为 21'); }
out.push('QF_CATEGORIES：' + (ctx.window.QF_CATEGORIES || []).length + ' 类');

/* 2. 点位字段完整性抽查 */
sites.forEach(function (s) {
  if (typeof s.lat !== 'number' || typeof s.lng !== 'number') { fail++; out.push('  ✗ 坐标缺失：' + s.id); }
  if (!s.categories || !s.categories.length) { fail++; out.push('  ✗ categories 缺失：' + s.id); }
  if (!s.summary || !s.story) { fail++; out.push('  ✗ 文案缺失：' + s.id); }
});

/* 2.5 四川边界数据校验 */
const b = ctx.window.QF_BOUNDARY;
if (!b || !b.features || !b.features[0]) {
  fail++; out.push('  ✗ QF_BOUNDARY 缺失');
} else {
  const g = b.features[0].geometry;
  let rings = 0, pts = 0, closedOK = true, inRange = true;
  function collect(coordRing) {
    rings++;
    const r = coordRing.map(function (p) { return [p[1], p[0]]; });
    pts += r.length;
    if (r.length < 3) closedOK = false;
    const f = r[0], l = r[r.length - 1];
    if (Math.abs(f[0] - l[0]) > 1e-6 || Math.abs(f[1] - l[1]) > 1e-6) closedOK = false;
    r.forEach(function (p) {
      if (p[0] < 24 || p[0] > 36 || p[1] < 95 || p[1] > 111) inRange = false;
    });
  }
  if (g.type === 'Polygon') g.coordinates.forEach(collect);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(function (poly) { poly.forEach(collect); });
  out.push('边界 type=' + g.type + '，环数=' + rings + '，点数=' + pts + '，闭合=' + closedOK + '，范围正常=' + inRange);
  if (rings === 0 || !closedOK || !inRange) fail++;
}

/* 3. index.html 的 id 与 app.js 引用一致 */
const html = fs.readFileSync(path.join(h5, 'index.html'), 'utf8');
const ids = new Set();
let m; const re = /id="([^"]+)"/g;
while ((m = re.exec(html))) ids.add(m[1]);

const app = fs.readFileSync(path.join(h5, 'js', 'app.js'), 'utf8');
const used = new Set();
let m2; const re2 = /\$\('#([A-Za-z0-9_-]+)'\)/g;
while ((m2 = re2.exec(app))) used.add(m2[1]);
const dynamic = new Set(['dv-visited', 'dv-copy', 'clear-loc', 'u-name', 'u-pass', 'u-login', 'u-register', 'user-logout']);
let miss = 0;
used.forEach(function (id) {
  if (!ids.has(id) && !dynamic.has(id)) { miss++; out.push('  ✗ app.js 引用不存在的 id：#"' + id + '"'); }
});
out.push('app.js 引用 id ' + used.size + ' 个，缺失 ' + miss);
if (miss) fail++;

/* 4. app.js 语法 */
try { new vm.Script(app, { filename: 'app.js' }); out.push('app.js 语法 OK'); }
catch (e) { fail++; out.push('  ✗ app.js 语法错误：' + e.message); }

out.push('');
out.push(fail === 0 ? '结论：H5 静态校验通过。' : '结论：存在 ' + fail + ' 项问题。');
process.stdout.write(out.join('\n') + '\n');
process.exitCode = fail ? 1 : 0;
