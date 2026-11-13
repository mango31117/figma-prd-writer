/* Push a Markdown PRD to the local bridge. Used by WorkBuddy. */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
}

const file = opt('--file', '');
const title = opt('--title', '');
const target = opt('--target', '');
const width = opt('--width', '');
const accent = opt('--accent', '');
const specFile = opt('--spec', '');
const mode = opt('--mode', '');
const checkpoints = opt('--checkpoints', '');
const speed = opt('--speed', '');
const host = opt('--host', 'localhost');
const port = Number(opt('--port', '9876'));

let markdown = '';
if (file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) {
    console.error('file not found: ' + p);
    process.exit(1);
  }
  markdown = fs.readFileSync(p, 'utf8');
} else {
  try { markdown = fs.readFileSync(0, 'utf8'); }
  catch (e) { markdown = ''; }
}

let spec = null;
if (specFile) {
  const sp = path.resolve(specFile);
  if (!fs.existsSync(sp)) {
    console.error('spec not found: ' + sp);
    process.exit(1);
  }
  try { spec = JSON.parse(fs.readFileSync(sp, 'utf8')); }
  catch (e) { console.error('invalid spec JSON: ' + e.message); process.exit(1); }
  if (!spec || !Array.isArray(spec.nodes)) {
    console.error('spec.nodes must be an array');
    process.exit(1);
  }
}

if (!markdown.trim() && !spec) {
  console.error('Usage: node push.js --file <path.md> [--title "T"] [--target "Figma file name"] [--width 1080]');
  console.error('   or: node push.js --spec <ui.json> [--title "T"]');
  console.error('   UI 节奏: --mode auto|step|checkpoint  --checkpoints 3,5  --speed 220');
  console.error('   or: type file.md | node push.js --title "T"');
  process.exit(1);
}

const payload = {
  title: title || (spec && spec.title) || (file ? path.basename(file, path.extname(file)) : 'Untitled PRD'),
  markdown: markdown,
  target: target,
  width: width === '' ? null : Number(width),
  accent: accent === '' ? null : accent,
  kind: spec ? 'ui' : 'doc',
  spec: spec
};
if (spec && (mode || checkpoints || speed !== '')) {
  payload.options = { mode: mode || '' };
  if (checkpoints !== '') {
    payload.options.checkpoints = checkpoints.split(',')
      .map(Number).filter(function (n) { return !isNaN(n); });
  }
  if (speed !== '') payload.options.speed = Number(speed);
}
const body = Buffer.from(JSON.stringify(payload), 'utf8');

const req = http.request({
  hostname: host,
  port: port,
  path: '/push',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length
  }
}, function (res) {
  let out = '';
  res.on('data', function (c) { out += c; });
  res.on('end', function () {
    console.log('HTTP ' + res.statusCode + ' ' + out);
    if (res.statusCode !== 200) process.exitCode = 1;
  });
});

req.on('error', function (e) {
  console.error('push failed (is bridge/server.js running?): ' + e.message);
  process.exit(1);
});
req.setTimeout(5000, function () { req.destroy(new Error('timeout')); });
req.end(body);
