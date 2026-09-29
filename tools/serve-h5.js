/**
 * 极简静态文件服务器：把 h5/ 目录挂到 HTTP，供浏览器直接访问。
 * 用法：node tools/serve-h5.js [端口]
 * 默认端口 8090，可用环境变量 PORT 覆盖。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..', 'h5');
const port = parseInt(process.env.PORT || process.argv[2] || '8090', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(root, urlPath));
  if (filePath.indexOf(root) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    res.end(data);
  });
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    process.stdout.write('端口 ' + port + ' 已被占用，请换一个端口（如 node tools/serve-h5.js 8091）\n');
  } else {
    process.stdout.write('启动失败：' + e.message + '\n');
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', function () {
  const ips = [];
  Object.keys(os.networkInterfaces()).forEach(function (name) {
    os.networkInterfaces()[name].forEach(function (i) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    });
  });
  process.stdout.write('清风循迹 H5 已启动（Ctrl+C 停止）\n');
  process.stdout.write('  本机访问：http://127.0.0.1:' + port + '/\n');
  ips.forEach(function (ip) {
    process.stdout.write('  局域网访问：http://' + ip + ':' + port + '/\n');
  });
});
