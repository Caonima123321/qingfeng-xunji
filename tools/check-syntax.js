/**
 * 语法自检脚本：node tools/check-syntax.js
 * 对全部 .js 做语法检查、对全部 .json 做解析检查，避免导入开发者工具后才暴露低级错误。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'miniprogram_npm']);
const out = [];
let errors = 0;

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) walk(full, acc);
    } else {
      acc.push(full);
    }
  });
  return acc;
}

const files = walk(ROOT, []);

out.push('=== 语法自检 ===');
out.push('文件总数：' + files.length);
out.push('');

files
  .filter(function (f) { return f.endsWith('.js') && f.indexOf('tools' + path.sep) === -1; })
  .forEach(function (f) {
    const rel = path.relative(ROOT, f);
    try {
      new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f });
      out.push('  OK   ' + rel);
    } catch (e) {
      errors += 1;
      out.push('  FAIL ' + rel + ' -> ' + e.message);
    }
  });

out.push('');
out.push('--- JSON ---');
files
  .filter(function (f) { return f.endsWith('.json'); })
  .forEach(function (f) {
    const rel = path.relative(ROOT, f);
    try {
      JSON.parse(fs.readFileSync(f, 'utf8'));
      out.push('  OK   ' + rel);
    } catch (e) {
      errors += 1;
      out.push('  FAIL ' + rel + ' -> ' + e.message);
    }
  });

out.push('');
out.push(errors === 0 ? '结论：语法与配置校验通过。' : '结论：存在 ' + errors + ' 处语法/配置错误。');

process.stdout.write(out.join('\n') + '\n');
process.exitCode = errors ? 1 : 0;
