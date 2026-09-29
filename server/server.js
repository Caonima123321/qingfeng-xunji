/**
 * 清风循迹 · 静态服务端（仅用 Node 内置模块，零第三方依赖）
 * 运行：node server/server.js [端口]    默认端口 8090，可用环境变量 PORT 覆盖。
 * 公网部署：把整个项目传到云服务器 / Node 平台，运行本文件即可。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..', 'h5');
const PORT = parseInt(process.env.PORT || process.argv[2] || '8090', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

const server = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (filePath.indexOf(ROOT) !== 0) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('403 Forbidden'); return; }
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' });
    res.end(data);
  });
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') process.stdout.write('端口 ' + PORT + ' 已被占用，请换一个端口\n');
  else process.stdout.write('启动失败: ' + e.message + '\n');
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', function () {
  const ips = [];
  Object.keys(os.networkInterfaces()).forEach(function (n) {
    os.networkInterfaces()[n].forEach(function (i) { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); });
  });
  process.stdout.write('清风循迹 已启动（端口 ' + PORT + '）\n');
  process.stdout.write('  本机: http://127.0.0.1:' + PORT + '/\n');
  ips.forEach(function (ip) { process.stdout.write('  局域网: http://' + ip + ':' + PORT + '/\n'); });
});
