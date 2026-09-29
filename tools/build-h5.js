/**
 * 生成 H5 版数据文件：把小程序端的 data/sites.js(+sites-more.js)+constants.js
 * 序列化为浏览器可直接加载的 h5/js/data.js，复制 marker 图标，并内嵌四川边界（用于地图遮罩）。
 * 用法：node tools/build-h5.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { SITES } = require(path.join(root, 'data', 'sites.js'));
const { CITIES, CATEGORIES, HOME } = require(path.join(root, 'data', 'constants.js'));

const h5 = path.join(root, 'h5');
const h5js = path.join(h5, 'js');
const h5marker = path.join(h5, 'assets', 'marker');
fs.mkdirSync(h5js, { recursive: true });
fs.mkdirSync(h5marker, { recursive: true });

/* 复制圆钉图标 */
const srcMarker = path.join(root, 'assets', 'marker');
let copied = 0;
fs.readdirSync(srcMarker).forEach(function (f) {
  fs.copyFileSync(path.join(srcMarker, f), path.join(h5marker, f));
  copied += 1;
});

/* 四川边界（用于地图遮罩：灰化省外区域） */
let boundary = 'null';
let boundaryNote = '无边界';
const bPath = path.join(h5, 'assets', 'sichuan.json');
if (fs.existsSync(bPath)) {
  try {
    boundary = JSON.stringify(JSON.parse(fs.readFileSync(bPath, 'utf8')));
    boundaryNote = '四川边界已内嵌（' + fs.statSync(bPath).size + ' 字节）';
  } catch (e) {
    boundaryNote = '四川边界读取失败，遮罩将跳过';
  }
}

const js = [
  '/* 本文件由 tools/build-h5.js 自动生成，请勿手改。 */',
  'window.QF_SITES = ' + JSON.stringify(SITES) + ';',
  'window.QF_CITIES = ' + JSON.stringify(CITIES) + ';',
  'window.QF_CATEGORIES = ' + JSON.stringify(CATEGORIES) + ';',
  'window.QF_HOME = ' + JSON.stringify(HOME) + ';',
  'window.QF_BOUNDARY = ' + boundary + ';',
  ''
].join('\n');

fs.writeFileSync(path.join(h5js, 'data.js'), js, 'utf8');
process.stdout.write('OK  h5/js/data.js（' + SITES.length + ' 个点位），图标复制 ' + copied + ' 个，' + boundaryNote + '\n');
