/* 生成 1x1 全透明 PNG，作为小程序地图计数气泡的占位图标 */
const fs = require('fs');
const path = require('path');
const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const out = path.join(__dirname, '..', 'assets', 'marker', 'pin-count.png');
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
process.stdout.write('pin-count.png 写入完成，字节数=' + fs.statSync(out).size + '\n');
