# 依赖清单（PRD to Figma Writer v1.0.0）

> 汇总范围：整段对话中出现过的全部依赖，含**运行时硬依赖**、**构建期工具**、**已评估但弃用的旁支链路**、**平台侧上传要求**。
> 标注「不随包」的项不需要、也不应该被打进插件 ZIP。

---

## A. 运行时硬依赖（缺了就跑不起来）

| # | 依赖 | 版本 / 取值 | 用途 | 随包 | 获取方式 | 必需性 |
|---|---|---|---|---|---|---|
| A1 | Node.js | 实测 v22.22.2（npm 10.9.7）；另检出 v22.19.0 / v22.23.2 | 运行 `bridge/server.js`、`bridge/push.js`、`tools/spec-to-html.js` | 否（外部环境） | 系统安装或 WorkBuddy 托管；建议 ≥18 | **必需** |
| A2 | Node 内置模块 | `http` / `fs` / `path` / `URL` / `Buffer` | 桥接服务、推流、预览生成；**零第三方包** | 是（Node 自带） | 无需安装 | **必需** |
| A3 | Figma 桌面端 | 支持 `manifest.api = 1.0.0` 与 `documentAccess` 的版本 | 运行插件、提供画布 | 否 | figma.com/downloads | **必需** |
| A4 | Figma Plugin API | `1.0.0` | `createFrame/createText/createRectangle/createImage/createNodeFromSvg`、`loadFontAsync`、`showUI`、`viewport` | 是（`manifest.json` 声明） | Figma 内置 | **必需** |
| A5 | 本地回环端口 | `localhost:9876`（TCP，需空闲） | `POST /push`、`GET /next?since=N`、`/health`、`/ack?seq=N` | 是（配置常量） | 启动 `start-bridge.bat` | **必需** |
| A6 | 环境变量（可选） | `PRD_BRIDGE_HOST`（默认 `localhost`）、`PRD_BRIDGE_PORT`（默认 `9876`） | 改端口/主机 | 是（代码内） | 启动前设置 | 可选 |
| A7 | 字体 Inter | Figma 内置预加载 | 英文/数字文本图层 | 否 | Figma 提供，无需联网 | **必需**（有降级） |
| A8 | 字体 Microsoft YaHei | 系统字体，运行时探测 | 中文文本图层，避免豆腐块；探测失败回落 Inter | 否 | Windows 自带 | 建议 |
| A9 | 现代浏览器 | 任意 | 打开 `preview-login.html` / `preview-lottery.html` 做 1:1 视觉预览 | 是（HTML 文件） | 无需安装 | 可选（预览用） |

**A 组小结**：整个插件**没有 `package.json`、没有 `node_modules`、不需要 `npm install`**。桥接服务与推流脚本只用 Node 内置模块。

---

## B. 构建 / 开发期依赖（只在生成素材与自测时用到，运行时不需要）

| # | 依赖 | 版本 / 取值 | 用途 | 随包 | 说明 |
|---|---|---|---|---|---|
| B1 | Python | 3.13.14（隔离环境 `C:/Users/admin/.workbuddy/binaries/python/envs/default/Scripts/python.exe`） | 采样参考截图色值、压缩 LOGO | 否 | 仅重建素材时需要 |
| B2 | Pillow (PIL) | 12.3.0 | 图片裁方、缩放到 240×240、JPEG q88、生成 base64 | 否 | 仅重建素材时需要 |
| B3 | 参考截图 | 1206×2622（375:812 比例） | 深色登录页背景渐变、按钮色、坐标采样来源 | 否 | 用户提供；产物已固化进 spec |
| B4 | 兔子 LOGO 原图 | 640×640 JPG | 登录页 LOGO 素材来源 | 否（产物 `content/logo-rabbit.jpg` 随包，且已内嵌 base64 进 spec） | 用户提供 |
| B5 | Node `vm` 模块 | 内置 | mock Figma / DOM 做闭环自测（不引入测试框架） | 否 | 仅开发自测 |
| B6 | PowerShell `Get-NetTCPConnection` | Windows 内置 | 排查 9876 端口占用、重启旧服务 | 否 | 仅运维排查 |

**B 组小结**：换一台电脑直接用本插件，**不装 Python、不装 Pillow 也能跑**——spec 里的位图已是 base64，预览页已内嵌。

---

## C. 旁支链路（对话中出现过，但本插件**完全不依赖**）

| # | 依赖 | 版本 / 取值 | 对话中的角色 | 随包 | 结论 |
|---|---|---|---|---|---|
| C1 | `figma-developer-mcp` | 0.13.2，`npm install -g` 全局安装 | 早期尝试的只读 MCP，仅 `get_figma_data` / `download_figma_images` | **否** | 只用 GET，无法写画布；本方案已改走 Plugin API |
| C2 | Figma Personal Access Token | `figd` 前缀（**严禁写入任何文档或包**） | 给 C1 那个只读 MCP 鉴权 | **否** | 本插件**不需要任何 token** |
| C3 | `~/.workbuddy/mcp.json` | 本机 MCP 配置 | 曾把 C1 配成 `node.exe` 绝对路径 + `dist/bin.js --stdio` + `env.FIGMA_API_KEY` | **否** | 与本插件无关，不要随包分发 |
| C4 | Figma REST API | `api.figma.com/v1/*` | 能力边界核查 | — | 设计内容 GET-only，明确排除 |
| C5 | Figma 官方远程 MCP | `https://mcp.figma.com/mcp` | 能力边界核查 | — | 需 Catalog 白名单客户端 + OAuth，WorkBuddy 不在列，明确排除 |
| C6 | MasterGo MCP | 用户设计资产链路 | 历史项目背景 | — | 本插件不接入 |

**C 组小结**：C1/C2/C3 是「早期探测、后来被否掉」的一条支线。保留记录是为了避免以后有人（大概率是我）又兴冲冲拿只读工具去写画布。**打包时已扫描确认 ZIP 内无 Figma PAT 明文等敏感串。**

---

## D. 平台侧依赖（上传到 WorkBuddy 开放平台「专家」时才需要）

| # | 依赖 | 版本 / 取值 | 用途 | 随包 | 必需性（上传时） |
|---|---|---|---|---|---|
| D1 | WorkBuddy | 当前会话环境 | 自然语言 → 生成 Markdown / uispec → 调 `push.js` 推流 | 否 | 使用入口 |
| D2 | `expert-manager` 技能 | 专家开发规范 v2.0 | 提供 `init_expert.py` / `validate_expert.py` / `register_expert.py` / `package_expert.py` | 否 | **必需** |
| D3 | Python 3 | 3.13.14 | 运行上述四个脚本 | 否 | **必需** |
| D4 | 固定专家目录 | `~/.workbuddy/plugins/marketplaces/my-experts/plugins/<expert-name>/` | 专家必须落在此目录才能被检测；其他路径一律判无效 | 否 | **必需** |
| D5 | `.codebuddy-plugin/plugin.json` | 规范 v2.0 | 必填 `name`(kebab-case) / `version` / `description` / `expertType` / `agentName`，加展示字段 | 否 | **必需** |
| D6 | `agents/<agentName>.md` | frontmatter | `name` 必须等于文件名；**禁止声明 `tools` 字段** | 否 | **必需** |
| D7 | `skills/<name>/SKILL.md` | 若 `plugin.json` 声明了 `skills` 数组 | 每个声明的 skill 目录下必须有 `SKILL.md`，否则校验报错 | 否 | 条件必需（把本插件挂成 skill 时） |
| D8 | `avatars/*.png` | 512×512、≤500KB | 专家头像；可由 ImageGen 生成后手动替换 | 否 | 建议 |
| D9 | 展示字段 | `displayName` / `profession` / `displayDescription`(zh 40–50 字) / `categoryId` / `defaultInitPrompt` / `tags`(固定 3) / `quickPrompts`(固定 3) | 专家卡片展示；`defaultInitPrompt` 须等于 `quickPrompts[0]` | 否 | **必需** |
| D10 | 禁止项 | `hooks/`、`commands/`、`.lsp.json` | 专家包内出现即校验失败 | — | 必须规避 |
| D11 | 会话内 Figma 只读工具 | `mcp__figma__get_figma_data` / `download_figma_images` | 读设计稿做参考（可选） | 否 | 可选 |

> **判定建议**：`expertType: "agent"`（单角色）；`categoryId: "01-ProductDesign"`（主要输出物是 UI 设计稿 / 可编辑画布，服务对象是产品设计师）。最终以你确认的花名、职业头衔、3 个标签为准。

---

## E. 明确「零」的部分（验收时可直接勾掉）

| 项 | 状态 |
|---|---|
| npm 第三方包 / `node_modules` | ❌ 无 |
| `package.json` / 构建步骤 / 编译 | ❌ 无，纯 JS 直接跑 |
| 外部网络请求 | ❌ 无，`networkAccess.allowedDomains` 仅 `http://localhost:9876` |
| CDN / 字体外链 / 第三方 JS 库 | ❌ 无，预览页与面板全部自包含 |
| 云服务 / 数据库 / 云函数 | ❌ 无 |
| API Key / Token / 账号密码 | ❌ 无（本插件不需要鉴权） |
| 跨文件写入能力 | ❌ 无，Plugin API 只能写**当前打开的 Figma 文件** |

---

## F. 兼容性与冲突提示

| 场景 | 说明 / 处理 |
|---|---|
| Node 版本 | 三个 22.x 安装共存（v22.22.2 当前 PATH 优先 / v22.19.0 系统 / v22.23.2 CodeArts）；换终端可能拿到不同小版本，均为 22 主版本，跑本插件无兼容问题 |
| 端口 9876 被占 | 设 `PRD_BRIDGE_PORT` 后，**必须同步**改 `manifest.json` 的 `allowedDomains` / `devAllowedDomains` 与 `ui.html` 里 `endpoint` 输入框默认值 |
| 服务改了 `server.js` | 旧后台进程仍加载旧代码，**必须重启**（否则 `/ack` 404、`spec` 被丢），重启后 `seq` 会从 `outbox/state.json` 恢复 |
| 改了 `ui.html` / `code.js` | **Figma 里必须重新运行插件**才加载新代码，光刷新页面无效 |
| 操作系统 | 插件本身跨平台；`bridge/start-bridge.bat` 是 Windows 快捷方式，mac/Linux 直接 `node bridge/server.js` |
| 中文文件名 | ZIP 使用 UTF-8 编码，Windows / macOS 解压均不乱码 |

---

## G. 最小验收环境（干净机器）

1. Node.js ≥18
2. Figma 桌面端 + 一个已打开的 Design 文件
3. 端口 9876 空闲

就这三样。没有第四步。
