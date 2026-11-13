/* uispec.json -> 1:1 浏览器预览（零依赖，Node 内置模块）
 * 用法: node tools/spec-to-html.js <spec.json> <out.html>
 * spec 坐标为绝对画布坐标；frame 仅作分组，不参与 HTML 布局。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const inFile = process.argv[2];
const outFile = process.argv[3];
if (!inFile || !outFile) {
  console.error('usage: node tools/spec-to-html.js <spec.json> <out.html>');
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const CV = spec.canvas || { width: 375, height: 812 };
const W = CV.width, H = CV.height;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function hex(s) { return /^#[0-9a-fA-F]{3,8}$/.test(String(s || '')) ? s : '#FFFFFF'; }

function bgOf(o) {
  if (o.gradient && Array.isArray(o.gradient.stops) && o.gradient.stops.length) {
    const stops = o.gradient.stops.map(function (s) {
      return hex(s.color) + ' ' + (Math.max(0, Math.min(1, Number(s.at) || 0)) * 100).toFixed(1) + '%';
    });
    return 'linear-gradient(to bottom,' + stops.join(',') + ')';
  }
  return o.fill ? hex(o.fill) : null;
}
function baseStyle(o) {
  const p = [
    'position:absolute', 'left:' + (Number(o.x) || 0) + 'px', 'top:' + (Number(o.y) || 0) + 'px',
    'width:' + Math.max(1, Number(o.w) || 1) + 'px', 'height:' + Math.max(1, Number(o.h) || 1) + 'px',
    'box-sizing:border-box'
  ];
  const bg = bgOf(o);
  if (bg) p.push('background:' + bg);
  if (o.stroke) p.push('border:' + (Number(o.strokeWidth) || 1) + 'px solid ' + hex(o.stroke));
  if (o.radius != null) p.push('border-radius:' + Number(o.radius) + 'px');
  if (o.type === 'ellipse') p.push('border-radius:50%');
  if (o.opacity != null) p.push('opacity:' + Number(o.opacity));
  return p.join(';');
}
function svgInline(svg) {
  return String(svg || '')
    .replace(/\s(?:width|height)="[^"]*"/g, '')
    .replace('<svg', '<svg width="100%" height="100%" style="display:block"');
}

let layerCount = 0;
const groupCount = (spec.nodes || []).filter(function (n) { return n.type === 'frame'; }).length;
function render(o) {
  layerCount += 1;
  if (o.type === 'frame') {
    const self = (o.fill || o.gradient || o.stroke) ? '<div style="' + baseStyle(o) + '"></div>' : '';
    return self + (o.children || []).map(render).join('\n');
  }
  const st = baseStyle(o);
  if (o.type === 'text') {
    const al = o.align === 'CENTER' ? 'center' : (o.align === 'RIGHT' ? 'flex-end' : 'flex-start');
    const va = o.valign === 'BOTTOM' ? 'flex-end' : (o.valign === 'TOP' ? 'flex-start' : 'center');
    const extra = 'display:flex;align-items:' + va + ';justify-content:' + al + ';' +
      'font-size:' + (Number(o.size) || 12) + 'px;line-height:1.2;color:' + hex(o.color || '#1D2129') + ';' +
      'font-weight:' + (o.bold ? 600 : 400) + ';white-space:pre-wrap;';
    return '<div style="' + st + ';' + extra + '">' + esc(o.text) + '</div>';
  }
  if (o.type === 'icon') {
    return '<div style="' + st + '">' + svgInline(o.svg) + '</div>';
  }
  if (o.type === 'image') {
    return '<img style="' + st + ';object-fit:cover;" alt="' + esc(o.name) + '" src="data:image/jpeg;base64,' + (o.data || '') + '">';
  }
  return '<div style="' + st + '"></div>';
}

const body = (spec.nodes || []).map(render).join('\n');
const html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' +
  '<title>' + esc(spec.title || 'UI 画布') + ' · 1:1 预览</title>\n' +
  '<style>\n' +
  '  body { margin:0; padding:24px; background:#E5E6EB; color:#1D2129; font:13px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif; }\n' +
  '  .meta { width:' + W + 'px; margin:0 0 12px; color:#4E5969; font-size:12px; line-height:1.8; }\n' +
  '  .meta b { font-size:14px; color:#1D2129; }\n' +
  '  .meta span { display:inline-block; margin-right:8px; padding:1px 7px; border:1px solid #C9CDD4; border-radius:3px; color:#4E5969; }\n' +
  '  .phone { position:relative; width:' + W + 'px; height:' + H + 'px; overflow:hidden; background:' + hex(CV.fill || '#FFFFFF') + '; box-shadow:0 6px 24px rgba(29,33,41,.14); }\n' +
  '  .legend { width:' + W + 'px; margin-top:14px; color:#86909C; font-size:11px; line-height:1.9; }\n' +
  '  .legend b { color:#4E5969; }\n' +
  '</style>\n</head>\n<body>\n' +
  '<div class="meta"><b>' + esc(spec.title || 'UI 画布') + ' · Figma 画布 1:1 预览</b><br>' +
  '<span>' + W + ' × ' + H + '</span><span>' + groupCount + ' 分组</span>' +
  '<span>' + (layerCount + 1) + ' 图层</span><span>主色 ' + esc(spec.accent || '#165DFF') + '</span><br>' +
  '由 uispec.json 自动生成，与 Figma 图层坐标严格一致；画布内每个元素均为独立可编辑节点。</div>\n' +
  '<div class="phone">\n' + body + '\n</div>\n' +
  '<div class="legend"><b>分组：</b>' + esc((spec.nodes || []).map(function (n) { return n.name; }).join(' / ')) + '<br>' +
  '<b>说明：</b>预览仅用于视觉核对，真正写入 Figma 的是插件按 spec 生成的原生 Frame / Text / Rect / Vector / Image 图层。</div>\n' +
  '</body>\n</html>\n';

fs.writeFileSync(outFile, html, 'utf8');
console.log('PREVIEW OK · ' + path.basename(outFile) + ' | ' + W + 'x' + H + ' | ' + groupCount + ' 分组 | ' + (layerCount + 1) + ' 图层 | ' + Buffer.byteLength(html) + ' bytes');
