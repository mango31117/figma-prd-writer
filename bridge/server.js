/* WorkBuddy -> Figma local bridge. Zero dependencies, Node built-ins only. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PRD_BRIDGE_PORT || 9876);
const HOST = process.env.PRD_BRIDGE_HOST || 'localhost';
const OUT_DIR = path.join(__dirname, 'outbox');
const LATEST = path.join(OUT_DIR, 'latest.json');
const STATE = path.join(OUT_DIR, 'state.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

let seq = 0;
let current = null;
let appliedSeq = 0;   // 已被插件接手过的最大序号：<= 它的内容重开面板时不自动重放

function saveState() {
  try { fs.writeFileSync(STATE, JSON.stringify({ appliedSeq: appliedSeq }, null, 2), 'utf8'); }
  catch (e) { console.error('[warn] cannot persist state: ' + e.message); }
}

try {
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  appliedSeq = Math.max(0, Number(st.appliedSeq) || 0);
} catch (e) { /* no state yet: every push is considered new */ }

try {
  const saved = JSON.parse(fs.readFileSync(LATEST, 'utf8'));
  if (saved) {
    seq = Number(saved.seq) || 0;
    const hasDoc = typeof saved.markdown === 'string' && saved.markdown.trim();
    const hasUI = saved.spec && Array.isArray(saved.spec.nodes);
    if (hasDoc || hasUI) current = saved;
  }
} catch (e) {
  /* no saved state, start fresh */
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, cb) {
  let body = '';
  req.on('data', function (c) {
    body += c;
    if (body.length > 4 * 1024 * 1024) req.destroy();
  });
  req.on('end', function () { cb(body); });
}

const server = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://' + HOST);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (u.pathname === '/health' && req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      seq: seq,
      appliedSeq: appliedSeq,
      port: PORT,
      pending: current ? { seq: current.seq, title: current.title, target: current.target, kind: current.kind || 'doc', mode: (current.options && current.options.mode) || '' } : null
    });
  }

  if (u.pathname === '/push' && req.method === 'POST') {
    return readBody(req, function (raw) {
      let p;
      try { p = JSON.parse(raw || '{}'); }
      catch (e) { return json(res, 400, { ok: false, error: 'invalid JSON: ' + e.message }); }
      const hasDoc = p && typeof p.markdown === 'string' && p.markdown.trim();
      const hasUI = p && p.spec && typeof p.spec === 'object' && Array.isArray(p.spec.nodes);
      if (!hasDoc && !hasUI) {
        return json(res, 400, { ok: false, error: 'need markdown or spec.nodes' });
      }
      seq += 1;
      current = {
        seq: seq,
        title: String(p.title || 'Untitled PRD').slice(0, 120),
        markdown: p.markdown,
        target: String(p.target || '').slice(0, 120),
        width: (p.width == null || p.width === '') ? null : (Number(p.width) || 1080),
        accent: (p.accent == null || p.accent === '') ? null
          : (/^#[0-9a-fA-F]{6}$/.test(p.accent) ? p.accent : '#165DFF'),
        ts: new Date().toISOString(),
        kind: hasUI ? 'ui' : (p.kind === 'ui' ? 'ui' : 'doc'),
        spec: hasUI ? p.spec : null,
        options: p.options && typeof p.options === 'object' ? p.options : null
      };
      try { fs.writeFileSync(LATEST, JSON.stringify(current, null, 2), 'utf8'); }
      catch (e) { console.error('[warn] cannot persist outbox: ' + e.message); }
      console.log('[push] #' + seq + ' [' + (current.kind || 'doc') + '] ' + current.title + ((current.options && current.options.mode) ? ' mode=' + current.options.mode : '') + (current.target ? ' -> ' + current.target : ''));
      return json(res, 200, { ok: true, seq: seq, title: current.title, target: current.target });
    });
  }

  if (u.pathname === '/ack' && req.method === 'GET') {
    const n = Number(u.searchParams.get('seq') || 0);
    if (Number.isFinite(n) && n > appliedSeq) {
      appliedSeq = Math.floor(n);
      saveState();
      console.log('[ack] #' + appliedSeq + ' marked applied (no auto replay on reopen)');
    }
    return json(res, 200, { ok: true, appliedSeq: appliedSeq });
  }

  if (u.pathname === '/next' && req.method === 'GET') {
    const since = Number(u.searchParams.get('since') || 0);
    const out = { ok: true, seq: seq, appliedSeq: appliedSeq, applied: false, item: null };
    if (current && current.seq > since) {
      out.item = current;
      out.applied = current.seq <= appliedSeq;
    }
    return json(res, 200, out);
  }

  return json(res, 404, { ok: false, error: 'not found' });
});

server.on('error', function (e) {
  console.error('[bridge] server error: ' + e.message);
  process.exitCode = 1;
});

server.listen(PORT, HOST, function () {
  console.log('PRD bridge ready at http://' + HOST + ':' + PORT);
  console.log('  POST /push          <- WorkBuddy');
  console.log('  GET  /next?since=N  <- Figma plugin');
  console.log('  GET  /health');
  console.log('  GET  /ack?seq=N  <- plugin marks a push as applied');
  console.log('  appliedSeq=' + appliedSeq + ' (pushes <= this will NOT auto-run on reopen)');
  console.log('Keep this window open while the Figma plugin is running.');
});
