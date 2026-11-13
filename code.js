/* PRD to Figma Writer - plugin main thread */
const C = {
  text: "#1D2129",
  muted: "#86909C",
  accent: "#165DFF",
  line: "#E5E6EB",
  soft: "#F7F8FA",
  white: "#FFFFFF",
  code: "#4E5969"
};

const FONT = { family: "Inter", style: "Regular" };
const FONT_BOLD = { family: "Inter", style: "Bold" };
let boldOk = false;

function rgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  };
}

function solid(hex) {
  return [{ type: "SOLID", color: rgb(hex) }];
}

function vFrame(name, o) {
  o = o || {};
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = "VERTICAL";
  f.counterAxisSizingMode = "FIXED";
  f.primaryAxisSizingMode = "AUTO";
  f.resize(o.width || 1000, 20);
  f.itemSpacing = o.spacing == null ? 12 : o.spacing;
  f.paddingTop = o.pt == null ? 0 : o.pt;
  f.paddingBottom = o.pb == null ? 0 : o.pb;
  f.paddingLeft = o.pl == null ? 0 : o.pl;
  f.paddingRight = o.pr == null ? 0 : o.pr;
  f.fills = o.fill ? solid(o.fill) : [];
  if (o.stroke) {
    f.strokes = solid(o.stroke);
    f.strokeWeight = 1;
  }
  return f;
}

function hFrame(name, o) {
  o = o || {};
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = "HORIZONTAL";
  f.primaryAxisSizingMode = "FIXED";
  f.counterAxisSizingMode = "AUTO";
  f.resize(o.width || 1000, 20);
  f.itemSpacing = o.spacing == null ? 12 : o.spacing;
  f.paddingTop = o.pt == null ? 10 : o.pt;
  f.paddingBottom = o.pb == null ? 10 : o.pb;
  f.paddingLeft = o.pl == null ? 12 : o.pl;
  f.paddingRight = o.pr == null ? 12 : o.pr;
  f.fills = o.fill ? solid(o.fill) : [];
  return f;
}

function makeText(str, o) {
  o = o || {};
  const t = figma.createText();
  t.name = o.name || "文本";
  t.fontName = o.bold && boldOk ? FONT_BOLD : FONT;
  t.characters = str == null || String(str) === "" ? " " : String(str);
  t.fontSize = o.size || 14;
  t.fills = solid(o.color || C.text);
  t.textAutoResize = "HEIGHT";
  if (o.grow) {
    t.layoutGrow = 1;
  } else {
    t.layoutAlign = "STRETCH";
  }
  return t;
}

function rule(width, hex, height) {
  const r = figma.createRectangle();
  r.name = "分割线";
  r.resize(width, height || 1);
  r.fills = solid(hex || C.line);
  r.layoutAlign = "STRETCH";
  return r;
}

function renderTable(rows, width) {
  const wrap = vFrame("表格", {
    width: width,
    spacing: 0,
    fill: C.white,
    stroke: C.line
  });
  rows.forEach(function (cells, ri) {
    const line = hFrame("行 " + (ri + 1), {
      width: width,
      spacing: 12,
      pt: 9,
      pb: 9,
      pl: 12,
      pr: 12,
      fill: ri === 0 ? C.soft : C.white
    });
    cells.forEach(function (cell) {
      line.appendChild(makeText(cell, {
        size: 13,
        bold: ri === 0,
        grow: true,
        name: "单元格"
      }));
    });
    wrap.appendChild(line);
    if (ri < rows.length - 1) wrap.appendChild(rule(width, C.line, 1));
  });
  return wrap;
}

function renderQuote(str, width, accent) {
  const row = hFrame("引用", {
    width: width,
    spacing: 12,
    pt: 12,
    pb: 12,
    pl: 0,
    pr: 14,
    fill: C.soft
  });
  const bar = figma.createRectangle();
  bar.name = "引用色条";
  bar.resize(3, 20);
  bar.fills = solid(accent);
  bar.layoutAlign = "STRETCH";
  row.appendChild(bar);
  row.appendChild(makeText(str, { size: 13, color: C.muted, grow: true, name: "引用文本" }));
  return row;
}

function renderCode(str, width) {
  const box = vFrame("代码块", {
    width: width,
    spacing: 0,
    pt: 14,
    pb: 14,
    pl: 16,
    pr: 16,
    fill: C.soft
  });
  box.appendChild(makeText(str, { size: 13, color: C.code, name: "代码" }));
  return box;
}

/* ---------------- UI canvas: structured editable layers ---------------- */
let CJK_FONT = null;
let CJK_BOLD = null;

function safeHex(v, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(v || "") ? v : fallback;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(src) {
  const s = String(src || "").replace(/^data:[^,]+,/, "").replace(/[\s\r\n]/g, "");
  const out = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === "=") break;
    const v = B64_CHARS.indexOf(ch);
    if (v < 0) continue;
    acc = ((acc << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}


function applyShape(n, o) {
  if (o.gradient && Array.isArray(o.gradient.stops) && o.gradient.stops.length) {
    n.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: o.gradient.transform || [[0, 1, 0], [-1, 0, 1]],
      gradientStops: o.gradient.stops.map(function (st) {
        const c = rgb(safeHex(st.color, C.white));
        return {
          position: Math.max(0, Math.min(1, Number(st.at) || 0)),
          color: { r: c.r, g: c.g, b: c.b, a: st.opacity == null ? 1 : Number(st.opacity) }
        };
      })
    }];
  } else {
    n.fills = o.fill ? solid(safeHex(o.fill, C.white)) : [];
  }
  if (o.stroke) {
    n.strokes = solid(safeHex(o.stroke, C.line));
    n.strokeWeight = Number(o.strokeWidth) || 1;
  }
  if (o.radius != null) n.cornerRadius = Number(o.radius);
  if (o.opacity != null) n.opacity = Number(o.opacity);
}

function countSpecNodes(o) {
  let n = 1;
  if (Array.isArray(o.children)) {
    o.children.forEach(function (c) { n += countSpecNodes(c); });
  }
  return n;
}

function uiNode(o, ox, oy) {
  ox = ox || 0;
  oy = oy || 0;
  const x = Number(o.x) || 0;
  const y = Number(o.y) || 0;
  const w = Math.max(1, Number(o.w) || 100);
  const h = Math.max(1, Number(o.h) || 100);
  let n;

  if (o.type === "text") {
    n = figma.createText();
    const str = String(o.text == null ? "" : o.text);
    const cjk = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(str);
    let font = FONT;
    if (cjk && CJK_FONT) font = o.bold && CJK_BOLD ? CJK_BOLD : CJK_FONT;
    else if (o.bold && boldOk) font = FONT_BOLD;
    n.fontName = font;
    n.characters = str === "" ? " " : str;
    n.fontSize = Number(o.size) || 14;
    n.fills = solid(safeHex(o.color, C.text));
    n.resize(w, h);
    n.textAutoResize = "NONE";
    n.textAlignHorizontal = o.align || "LEFT";
    n.textAlignVertical = o.valign || "TOP";
    if (o.lineHeight) n.lineHeight = { value: Number(o.lineHeight), unit: "PIXELS" };
    if (o.opacity != null) n.opacity = Number(o.opacity);
  } else if (o.type === "icon") {
    n = figma.createNodeFromSvg(String(o.svg || ""));
    n.resize(w, h);
  } else if (o.type === "image") {
    n = figma.createRectangle();
    n.resize(w, h);
    if (o.radius != null) n.cornerRadius = Number(o.radius);
    if (o.opacity != null) n.opacity = Number(o.opacity);
    if (o.data) {
      try {
        const img = figma.createImage(base64ToBytes(o.data));
        n.fills = [{ type: "IMAGE", scaleMode: o.scaleMode || "FILL", imageHash: img.hash }];
      } catch (e) {
        n.fills = solid(safeHex(o.fill, C.white));
      }
    } else {
      n.fills = solid(safeHex(o.fill, C.white));
    }
  } else {
    if (o.type === "ellipse") n = figma.createEllipse();
    else if (o.type === "rect") n = figma.createRectangle();
    else n = figma.createFrame();
    n.resize(w, h);
    if (o.type === "frame") n.clipsContent = !!o.clip;
    applyShape(n, o);
  }

  n.name = String(o.name || o.type || "图层");
  n.x = x - ox;
  n.y = y - oy;

  if (o.type === "frame" && Array.isArray(o.children)) {
    o.children.forEach(function (ch) { n.appendChild(uiNode(ch, x, y)); });
  }
  return n;
}

function renderUI(msg, fileName) {
  const spec = msg.spec || {};
  const cv = spec.canvas || {};
  const W = Math.max(1, Number(cv.width) || 375);
  const H = Math.max(1, Number(cv.height) || 812);
  const title = String(msg.title || spec.title || "UI 画布").slice(0, 80);
  const frameName = "UI · " + title;

  if (!resolveConflict(frameName, msg)) return;

  const root = figma.createFrame();
  root.name = frameName;
  root.resize(W, H);
  root.fills = solid(safeHex(cv.fill, C.white));
  root.clipsContent = true;
  placeFrame(root, W, H);

  let nodes = 1;
  (spec.nodes || []).forEach(function (o) {
    root.appendChild(uiNode(o, 0, 0));
    nodes += countSpecNodes(o);
  });

  figma.currentPage.appendChild(root);
  revealFrame(root, W, H);
  figma.notify("已生成 UI 画布「" + title + "」· " + nodes + " 个图层");
  figma.ui.postMessage({
    type: "done",
    counts: { mode: "ui", nodes: nodes, h2: 0, table: 0 },
    name: frameName,
    file: fileName
  });
}

function renderBlock(b, width, accent, counts) {
  switch (b.type) {
    case "h3":
      return makeText(b.text, { size: 17, bold: true, color: accent, name: "小标题" });
    case "p":
      counts.p++;
      return makeText(b.text, { size: 14, name: "段落" });
    case "li":
      counts.li++;
      return makeText("•  " + b.text, { size: 14, name: "列表项" });
    case "quote":
      return renderQuote(b.text, width, accent);
    case "code":
      return renderCode(b.text, width);
    case "table":
      counts.table++;
      return renderTable(b.rows, width);
    case "hr":
      return rule(width, C.line, 1);
    default:
      return makeText(b.text || "", { size: 14 });
  }
}

async function loadFonts() {
  await figma.loadFontAsync(FONT);
  try {
    await figma.loadFontAsync(FONT_BOLD);
    boldOk = true;
  } catch (e) {
    boldOk = false;
  }
  try {
    const cjk = { family: "Microsoft YaHei", style: "Regular" };
    await figma.loadFontAsync(cjk);
    CJK_FONT = cjk;
  } catch (e) { CJK_FONT = null; }
  try {
    const cjkB = { family: "Microsoft YaHei", style: "Bold" };
    await figma.loadFontAsync(cjkB);
    CJK_BOLD = cjkB;
  } catch (e) { CJK_BOLD = null; }
}

function currentFileName() {
  return String((figma.root && figma.root.name) || "");
}

/* ---- 分步会话：面板负责节奏，主线程只负责逐步落图层 ---- */
let uiSession = null;

function findRoot(name) {
  return figma.currentPage.children.find(function (n) { return n.name === name; });
}

/* ---- 画布布局：为插件面板预留左侧空间 ----
   插件面板（showUI width:480）是浮动窗口，会盖住画布左侧。
   生成位置必须避开它，否则新页面一生成就被压在窗口底下。
   下列「屏幕 px」按当前 zoom 换算成画布坐标。 */
const PLUGIN_PANEL_W = 480;   // 与 figma.showUI 的 width 保持一致
const PANEL_GAP = 48;         // 面板右缘到第一个页面的呼吸间距（屏幕 px）
const PAGE_GAP = 80;          // 多个页面 Frame 之间的间距（画布坐标）
const TOP_PAD = 72;           // 页面顶部留白（屏幕 px）

function viewportSafeArea() {
  const v = figma.viewport || {};
  const z = Number(v.zoom) > 0 ? Number(v.zoom) : 1;
  const c = v.center || { x: 0, y: 0 };
  const b = v.bounds;
  const W = b && Number(b.width) > 0 ? Number(b.width) : 2000;
  const H = b && Number(b.height) > 0 ? Number(b.height) : 1400;
  const left = b && isFinite(Number(b.x)) ? Number(b.x) : Number(c.x) - W / 2;
  const top = b && isFinite(Number(b.y)) ? Number(b.y) : Number(c.y) - H / 2;
  return {
    left: left, top: top, right: left + W, bottom: top + H,
    zoom: z, cx: left + W / 2, cy: top + H / 2
  };
}

function panelSafeLeft() {
  const va = viewportSafeArea();
  return va.left + (PLUGIN_PANEL_W + PANEL_GAP) / va.zoom;
}

/* 新建 Frame 一律放到「插件面板右侧」的可见区：
   空画布从安全线起点开始，已有页面则依次向右排开、顶部对齐。 */
function placeFrame(root, W, H) {
  const va = viewportSafeArea();
  const safeLeft = Math.round(panelSafeLeft());
  const safeTop = Math.round(va.top + TOP_PAD / va.zoom);
  const others = figma.currentPage.children.filter(function (n) { return n !== root; });
  if (!others.length) {
    root.x = safeLeft;
    root.y = safeTop;
    return;
  }
  let right = -Infinity, top = Infinity;
  others.forEach(function (n) {
    const r = Number(n.x || 0) + Number(n.width || 0);
    if (r > right) right = r;
    const t = Number(n.y || 0);
    if (t < top) top = t;
  });
  if (!isFinite(right)) right = safeLeft - PAGE_GAP;
  if (!isFinite(top)) top = safeTop;
  root.x = Math.round(Math.max(right + PAGE_GAP, safeLeft));
  root.y = Math.round(top);
}

/* 不用 scrollAndZoomIntoView：它会把 Frame 居中到视口中心，正好又落回面板底下。
   只在 Frame 横向超出可见区时平移视口，保持当前 zoom、不改动画布内容。 */
function revealFrame(root, W, H) {
  try {
    const va = viewportSafeArea();
    const safeLeft = panelSafeLeft();
    if (root.x >= safeLeft - 1 && root.x + W <= va.right) return;
    const visibleCx = (safeLeft + va.right) / 2;
    const dx = (root.x + W / 2) - visibleCx;
    figma.viewport.center = { x: va.cx + dx, y: va.cy };
  } catch (e) { /* 视口 center 不可写时保持原样，不影响生成 */ }
}

/* 自动运行（overwrite:false）绝不删除同名 Frame，避免抹掉用户在画布上的手改。
   未带 overwrite 字段的旧调用保持原行为（允许替换），保证兼容。 */
function resolveConflict(frameName, msg) {
  const old = findRoot(frameName);
  if (!old) return true;
  if (msg && msg.overwrite === false) {
    figma.ui.postMessage({ type: "overwrite-blocked", name: frameName });
    return false;
  }
  old.remove();
  return true;
}

function targetOk(msg) {
  const fileName = currentFileName();
  const target = String(msg.target || "").trim();
  if (target && fileName && fileName.indexOf(target) === -1) {
    figma.ui.postMessage({
      type: "error",
      message: "目标项目不匹配：内容指向「" + target + "」，当前文件为「" + fileName + "」。请在对应项目里打开插件后重新推送。"
    });
    return false;
  }
  return true;
}

async function handlePlan(msg) {
  try {
    if (!targetOk(msg)) return;
    await loadFonts();
    const spec = msg.spec || {};
    if (!Array.isArray(spec.nodes)) throw new Error("spec.nodes 缺失，无法分步生成");
    const cv = spec.canvas || {};
    const W = Math.max(1, Number(cv.width) || 375);
    const H = Math.max(1, Number(cv.height) || 812);
    const rootName = String(msg.rootName || ("UI · " + (msg.title || "画布"))).slice(0, 100);
    if (!resolveConflict(rootName, msg)) return;
    const root = figma.createFrame();
    root.name = rootName;
    root.resize(W, H);
    root.fills = solid(safeHex(cv.fill, C.white));
    root.clipsContent = true;
    placeFrame(root, W, H);
    figma.currentPage.appendChild(root);
    revealFrame(root, W, H);
    uiSession = { root: root, spec: spec, rootName: rootName, layers: 1 };
    figma.ui.postMessage({
      type: "plan-ready", total: spec.nodes.length, name: rootName, file: currentFileName()
    });
  } catch (e) {
    figma.ui.postMessage({ type: "run-error", message: String(e && e.message ? e.message : e) });
  }
}

function handleStep(msg) {
  try {
    if (!uiSession || uiSession.rootName !== msg.rootName) {
      throw new Error("分步会话已失效，请点「开始生成」重新开始");
    }
    const i = Number(msg.index);
    const o = uiSession.spec.nodes[i];
    if (!o) throw new Error("步骤越界：" + i);
    uiSession.root.appendChild(uiNode(o, 0, 0));
    uiSession.layers += countSpecNodes(o);
    const last = i === uiSession.spec.nodes.length - 1;
    figma.ui.postMessage({
      type: "step-done", index: i, layers: uiSession.layers,
      name: String(o.name || ""), finished: last
    });
    if (last) figma.notify("已生成 UI 画布 · " + uiSession.layers + " 个图层");
  } catch (e) {
    figma.ui.postMessage({ type: "run-error", message: String(e && e.message ? e.message : e) });
  }
}

function handleAbort(msg) {
  try {
    const root = findRoot(String(msg.rootName || ""));
    if (root) root.remove();
    uiSession = null;
    figma.ui.postMessage({ type: "abort-ok" });
  } catch (e) {
    figma.ui.postMessage({ type: "run-error", message: String(e && e.message ? e.message : e) });
  }
}

figma.showUI(__html__, { width: 480, height: 880 });
figma.ui.postMessage({ type: "file", name: currentFileName() });

figma.ui.onmessage = async function (msg) {
  if (!msg) return;
  if (msg.type === "ui-plan") return handlePlan(msg);
  if (msg.type === "render-step") return handleStep(msg);
  if (msg.type === "ui-abort") return handleAbort(msg);
  if (msg.type !== "generate" && msg.type !== "render-ui") return;
  try {
    const fileName = currentFileName();
    const target = String(msg.target || "").trim();
    if (target && fileName && fileName.indexOf(target) === -1) {
      figma.ui.postMessage({
        type: "error",
        message: "目标项目不匹配：内容指向「" + target + "」，当前文件为「" + fileName +
          "」。请在对应项目里打开插件后重新推送。"
      });
      return;
    }

    await loadFonts();
    if (msg.type === "render-ui") return renderUI(msg, fileName);
    const accent = /^#[0-9a-fA-F]{6}$/.test(msg.accent || "") ? msg.accent : C.accent;
    const W = Math.max(200, Math.min(2000, Number(msg.width) || 1080));
    const inner = W - 96;
    const title = String(msg.title || "PRD 文档").slice(0, 80);
    const frameName = "PRD · " + title;

    if (!resolveConflict(frameName, msg)) return;

    const root = vFrame(frameName, {
      width: W,
      spacing: 24,
      pt: 48,
      pb: 56,
      pl: 48,
      pr: 48,
      fill: C.white
    });

    const counts = { h2: 0, p: 0, li: 0, table: 0 };
    let section = null;

    for (const b of msg.blocks) {
      if (b.type === "h1") {
        root.appendChild(makeText(b.text, { size: 30, bold: true, name: "文档标题" }));
        const bar = figma.createRectangle();
        bar.name = "标题装饰线";
        bar.resize(48, 3);
        bar.fills = solid(accent);
        root.appendChild(bar);
        continue;
      }
      if (b.type === "h2") {
        section = vFrame("章节 · " + b.text, { width: inner, spacing: 14 });
        section.appendChild(makeText(b.text, { size: 22, bold: true, name: "章节标题" }));
        section.appendChild(rule(inner, C.line, 1));
        root.appendChild(section);
        counts.h2++;
        continue;
      }
      (section || root).appendChild(renderBlock(b, inner, accent, counts));
    }

    placeFrame(root, W, root.height || 800);
    figma.currentPage.appendChild(root);
    revealFrame(root, W, root.height || 800);
    figma.notify("已写入「" + title + "」· " + counts.h2 + " 个章节");
    figma.ui.postMessage({
      type: "done",
      counts: counts,
      name: frameName,
      file: fileName
    });
  } catch (e) {
    figma.ui.postMessage({
      type: "error",
      message: String(e && e.message ? e.message : e)
    });
  }
};
