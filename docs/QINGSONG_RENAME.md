# 青松教师项目改名

- 版本：v1.0
- 日期：2026-10-16
- 状态：GitHub 仓库已改名；代码本地验证完成，尚未推送、合并或部署；母文件夹切换待合并

## 目标与授权

用户确认网站中文名称为「青松教师」，英文项目名为 `qingsong`，并批准网站品牌、项目标识、GitHub 仓库、母文件夹、必要路径引用及文档修改。推送、PR、合并和服务器部署不包含在最初授权内，须分别确认。

## 事实、边界与最短路径

原仓库为 `CXC0515/demo`，母文件夹为 `/Users/cxc/Projects/DEMO`。登录页、主界面和浏览器标题不统一，需要修改代码。项目标识原为 `react-example`。

先从最新 `origin/main` 创建独立分支和 worktree，完成品牌及路径修改并验证。获得发布到 GitHub 的授权并合并后，母文件夹同步稳定 main，再改为 `/Users/cxc/Projects/qingsong` 并修复关联 worktree、Git remote、Codex trust 配置及本机 LaunchAgent 路径。GitHub 仓库目标为 `CXC0515/qingsong`。

仅改网站名称的备选路径更短，但不满足用户同时修改文件夹和仓库名称的目标。

不修改服务器目录、服务名、域名、数据库结构和真实数据内容。不批量改写历史专项文档；旧路径可作为历史证据保留。

## 修改范围

- `index.html`、`src/features/auth/AuthGate.tsx`、`src/app/AppLayout.tsx`：品牌文字。
- `package.json`、`package-lock.json`：项目名称。
- `scripts/run-production*.sh`、`scripts/install-production-launch-agents.sh`、`scripts/configure-production-env.mjs`、`ops/launchd/*.plist`：本机路径。
- `README.md`、`AGENTS.md`、`docs/PROJECT_HANDOFF.md`、`docs/WEB_OPERATIONS_RUNBOOK.md`：当前名称和必要路径；本文记录进度。
- 本机环境配置仅替换确实存在的旧路径，不输出或改动凭据。

## 风险、验证与回退

文件夹改名会使绝对路径引用失效，必须在稳定 main 包含新路径后连续切换。需检查 Git worktree 元数据、本地定时备份、配置路径及 remote。Codex 应用保存的项目入口可能需要用户重新选择新目录；不直接修改应用内部数据库。

验证 TypeScript、生产构建、桌面/手机登录页和主界面品牌、Git 远程访问、worktree 可用性和 plist 语法。无真实账号验收时明确标注。

代码回退用本次提交的 revert；目录和仓库可改回原名，随后 repair worktree 并恢复配置路径。不会删除产品数据或备份。

## 本次执行与验证

- GitHub 仓库已改为 `https://github.com/CXC0515/qingsong`，本地 origin 已更新，`git ls-remote origin HEAD` 通过。
- 独立分支 `codex/qingsong-rename`，基线 `origin/main@4f26912`；worktree 为 `/Users/cxc/.codex/worktrees/qingsong-rename/qingsong`。
- 独立安装锁定依赖后 `npm run lint`、`npm run build` 通过。构建仍有现有大体积 chunk 提示，本次不扩展优化范围。
- Shell 语法、3 个 LaunchAgent plist 语法及按原有 CRLF 检查的 diff 均通过。
- Chromium 1440×900 检查登录页和登录后的品牌；390×667 完成独立测试账号注册、登录和导航操作；320×568 主界面文档宽度为 320，无横向溢出。手机主界面沿用原有隐藏品牌区域的布局，浏览器标题已更新。
- 截图保存在本次 worktree 的 `output/playwright/`；测试数据也在此目录下，不使用真实教师数据。控制台仅有未登录阶段预期的 `/api/account` 401。
- 未验证真实手机、生产账号及线上新品牌；服务器未部署。
- 母文件夹、本机 `.env`、LaunchAgent 和 Codex trust 路径尚未切换。推送与合并授权待用户答复，以免稳定 main 中旧绝对路径在目录移动后失效。

## 遗留 worktree 核查

- `material-pool-folder-ux/DEMO`：`codex/material-pool-folder-ux`，PR #51 已合并，工作区干净，约 420 MB。
- `material-pool-archive-navigation/DEMO`：当前分支为 `codex/material-pool-release-record`，PR #53 已合并，工作区干净，约 422 MB。
- 本地 `codex/material-pool-archive-navigation` 分支对应 PR #52，已合并。

这些是合并后遗留，具备清理条件。本次只核查，不在改名过程中删除其他会话 worktree 或分支。

## 修改历史

| 版本 | 日期 | 概要 |
| --- | --- | --- |
| v1.0 | 2026-10-16 | 记录已批准范围、实施顺序、遗留 worktree 及验证边界。 |
