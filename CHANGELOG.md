# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-11-13

首个发布版本。

### Added
- **双管线写入**：Markdown/HTML 文档 → 章节 Frame / 表格行列 / 引用色条；
  `*.uispec.json` → 完整 UI 画布（Frame / Text / Rect / SVG 矢量 / 位图 / 渐变）。
- **本地桥接服务** `bridge/server.js`：`/push` `/next` `/ack` `/health` 四接口，
  Node 内置模块实现，零第三方依赖，一键 `start-bridge.bat`。
- **进度与节奏控制**：AI 一键生成 / 逐步确认 / 断点续跑三种模式，
  步进间隔可调、全设与清空断点、暂停、全速跑完、中止清空。
- **排版控制**：宽度等比缩放整棵图层树（下限 200 / 上限 2000，等于原宽即 1:1）、
  主色按基准色精准替换、手动设定优先、重复生成不累积缩放。
- **三道保护**：
  - 防重放——`appliedSeq` 持久化 + `/ack`，重开插件不自动重跑旧指令；
  - 自动路径 `overwrite:false`——画布同名 Frame 时跳过，不删任何图层；
  - 载入示例 ≠ 生成——载入只进面板，写画布必须手动点「开始生成」。
- **面板避让**——新 Frame 自动排在插件浮动窗口右侧（安全线 480+48 屏幕 px），
  不再被面板遮挡。
- **离线示例**：深色登录页 uispec（375×812 / 8 分组 / 31 图层 / 内嵌 LOGO）、
  Arco 白底抽奖中心 uispec（9 分组 / 81 图层）、完整登录界面 PRD。
- **1:1 预览工具** `tools/spec-to-html.js`，任意 uispec 离线浏览器预览。
- **文档**：README（使用 / 验收清单 / FAQ / 专家包对接）、DEPENDENCIES.md（全依赖表）。
- **配图**：桥接窗口、插件面板上下半屏、生成结果全景，共 4 张验收对照图。

### Security
- 本插件不需要任何 Figma Token / API Key；全部通信仅限 `localhost:9876` 回环；
  `manifest.json` 的 `networkAccess` 未放行任何外网域名。
