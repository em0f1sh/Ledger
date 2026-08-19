# AGENTS.md

Windows-only Electron 记账应用（离线、**绿色文件夹版，不打包 exe**）。环境为 PowerShell 5.1。

## 命令

- 运行应用：`npm start`（= `electron .`）
- 双击启动：`记账本.lnk`（带图标快捷方式，目标为 `启动记账本.bat`）
- 便携启动器：`启动记账本.bat`（`cd /d %~dp0` + `start "" "node_modules\electron\dist\electron.exe" .`，整个文件夹拷走可用）
- 无测试框架、无 lint/typecheck。验证方式：`npm start` 拉起窗口，或直接用 node 单测 `store.js` 的逻辑
- 本机 git 未配身份，提交/合并必须带：`git -c user.name=opencode -c user.email=opencode@local commit/merge/...`

## 架构

- `main.js`：主进程，窗口 + IPC + 数据目录决策。窗口图标读 `build/icon.ico`（存在才用）。注册了 `uncaughtException`，出错会写 `%TEMP%\crash.log`（双击闪退先看它）。
- `preload.js`：contextBridge 暴露 `window.api`；IPC 通道名在 main/preload 两处一致。
- `store.js`：JSON 存储（分类/记录/统计），无原生依赖，刻意避开 better-sqlite3（本机无 VS Build Tools）。
- `renderer/`：原生 HTML/CSS/JS + 本地 `echarts.min.js`（不联网）。主题色变量在 `style.css` 的 `:root`；储蓄罐水位动画在 `app.js` 的 `animateWater()`（SVG 用户坐标，空=184 / 满=14）。
- 绿色版依赖：`node_modules\electron\dist\electron.exe`（`npm install` 装，dist 二进制自带，无 postinstall 网络下载）。

## 数据与隐私

- 运行时数据是 `data.json`。**已 gitignore，含用户真实账目，绝不提交。**
- 数据目录逻辑：`%APPDATA%\记账本\config.json` 里记录的 `dataDir` 优先 → 默认目录（项目根/程序所在文件夹）已有 `data.json` 则沿用 → 首次运行弹窗让用户选位置（用户数据目录/自定义文件夹/程序旁边）并记住。无写权限再弹窗选目录。
- `crash.log`、`node_modules/`、`*.lnk`（本机快捷方式）均在 .gitignore。

## 其他

- 图标：`build/icon.ico` 由 `build/generate-icon.js` 生成（纯 Node 像素光栅化，无图像库），改图标改脚本重跑即可。
- 截图：`build/capture-scripts.js` 用 Electron + 脚本内生成的样例数据（临时 data 文件，不碰真实数据）截取四个页面到 `screenshots/`，改完 UI 可重跑刷新 README 截图。
- 远端仓库：`origin` → GitHub `lianyuwww/jizhangben`（原 emofish，账号改名后 URL 会变，改完记得 `git remote set-url`）。提交作者目前是 `opencode <opencode@local>`。