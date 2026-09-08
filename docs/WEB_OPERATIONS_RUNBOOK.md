# DEMO 网页产品本地生产运行手册

> 文档版本：`v1.6`
> 日期：2026-09-08
> 适用范围：网页产品第一阶段第 2、3 切片操作口径
> 当前边界：代码已合并、`var-product` 与生产环境已就绪；名称服务器切换已获批准，公网与后台自启尚未接通

## 1. 当前运行边界

本切片已经加入邀请登录、每教师工作区和受保护文件访问，公开 `/uploads` 已移除。域名、Tunnel、自动开机和国内三网测试尚未完成，因此仍不得邀请外部用户。

原始权威母数据仍保持不动：

```text
/Users/cxc/Projects/DEMO/var
```

第 3 切片已经从候选副本的在线快照恢复出产品目录：

```text
/Users/cxc/Projects/DEMO/var-product
```

真实密钥只从下列外部文件加载，不复制进仓库：

```text
/Users/cxc/Projects/DEMO/.env
```

## 2. 首次准备

在项目目录执行：

```bash
npm ci
npm run build
```

生产启动会检查 `dist/index.html`、数据目录、上传目录和备份目录。缺少生产构建时进程会拒绝启动。

## 3. 本机生产启动

在项目目录执行以下完整命令：

```bash
NODE_ENV=production \
APP_DATA_ROOT=/Users/cxc/Projects/DEMO/var-web-auth-candidate \
APP_URL=https://td.unreached.cn \
AUTH_SECRET='<至少 32 字符的独立随机密钥>' \
API_HOST=127.0.0.1 \
API_PORT=4317 \
node --env-file=/Users/cxc/Projects/DEMO/.env --import tsx server/index.ts
```

正式 HTTPS 尚未接通前，不要用生产模式的 Secure Cookie 配置测试 HTTP。本机验收需要两个进程：API 使用候选数据，Vite 提供前端并代理 `/api`。先启动 API：

```bash
NODE_ENV=development \
APP_DATA_ROOT=/Users/cxc/Projects/DEMO/var-web-auth-candidate \
APP_URL=http://localhost:3000 \
API_HOST=127.0.0.1 \
API_PORT=4317 \
node --env-file=/Users/cxc/Projects/DEMO/.env --import tsx server/index.ts
```

再在另一个终端启动前端：

```bash
API_PROXY_TARGET=http://127.0.0.1:4317 npm run dev
```

浏览器访问 `http://localhost:3000`。不要把 `--env-file` 追加在 `npm start --` 后面；那会把参数交给应用而不是 Node。

`npm start` 仅适用于环境变量已经由进程管理器完整注入的情况。

首次使用邀请链接完成注册。注册成功后页面必须回到普通登录表单，并显示“注册成功，请使用新账户登录”；此时尚无登录会话。用户再次输入密码并点击“登录”后才进入工作台。首个所有者读取迁移候选数据，之后邀请的教师进入全新空工作区。

## 4. 健康检查

存活检查：

```bash
curl -fsS http://127.0.0.1:4317/api/health/live
```

就绪检查：

```bash
curl -fsS http://127.0.0.1:4317/api/health/ready
```

就绪检查会验证认证库、系统目录和工作区根可用，并报告 AI 与 PaddleOCR 是否已配置。第三方服务未配置不会让本地资料读取整体失效。

## 5. 停止与重启

前台运行时使用 `Ctrl-C`。进程收到 `SIGINT` 或 `SIGTERM` 后会停止接收新连接、等待活动连接、关闭 SQLite，再退出。日志中应依次出现：

```text
server_shutdown_started
server_shutdown_completed
```

如果超过 `SHUTDOWN_TIMEOUT_MS`，进程会记录强制退出事件。当前默认值为 15 秒。

本切片没有安装自动开机启动服务；`launchd`、断线自动重连和公网 Tunnel 属于后续获批切片。

## 6. 日志

服务日志为一行一个 JSON 对象，包含时间、级别、事件、request ID、路由模板、状态码和耗时。令牌、Cookie、授权头和敏感查询参数会脱敏；不得主动把学生姓名、OCR 正文或资料内容写入日志。

当前日志输出到标准输出/错误。日志轮转和长期保留将在正式后台运行配置中完成。

## 7. 备份、校验和恢复

第 2 切片上线后必须使用产品快照，同时包含认证库和全部工作区：

```bash
npm run backup:product -- \
  /Users/cxc/Projects/DEMO/var-web-auth-candidate \
  /Users/cxc/Projects/DEMO/var/backups/product-YYYYMMDD-HHMMSS
```

校验与恢复演练：

```bash
npm run verify:product -- /Users/cxc/Projects/DEMO/var/backups/product-YYYYMMDD-HHMMSS
npm run restore:product -- \
  /Users/cxc/Projects/DEMO/var/backups/product-YYYYMMDD-HHMMSS \
  /Users/cxc/Projects/DEMO/var-web-auth-restored
```

备份对认证库和每个工作区 SQLite 使用在线备份 API；`manifest.json` 保存大小和 SHA-256。恢复只允许不存在的新目录，并映射数据库与 JSON 的内部绝对路径。旧 `backup:data/restore:data` 只用于迁移前的单工作区格式，不能作为新产品的完整备份。

完整迁移和回滚步骤见 `docs/WEB_DATA_MIGRATION_RUNBOOK.md`。

## 8. 升级前最小检查

每次升级至少执行：

```bash
npm ci
npm run build
npm run lint
npm run test:operations
npm run verify:data -- /Users/cxc/Projects/DEMO/var-web
```

升级前创建新快照；升级后检查首页、存活与就绪接口、班级和资料读取、PDF Range 请求。失败时停止新版本并按迁移手册切回旧代码和旧数据副本。

## 9. 第 3 切片运行口径与当前进度

完整批准范围和实时实施记录见 `docs/WEB_PUBLIC_TRIAL_DEPLOYMENT_PLAN.md`。`cloudflared 2026.8.3` 已安装，Cloudflare 免费 Zone 已创建；Tunnel、名称服务器切换和 LaunchAgent 仍未完成。

### 9.0 DNS 切换与回滚

域名继续由阿里云持有和续费，权威 DNS 计划从阿里云切换到 Cloudflare：

```text
原值：dns11.hichina.com
原值：dns12.hichina.com
新值：mustafa.ns.cloudflare.com
新值：ophelia.ns.cloudflare.com
```

2026-09-08 切换前检查未发现 A、AAAA、MX、TXT、`www`、`td` 或 DNSSEC 记录，因此没有现有网站或域名邮箱记录需要迁移。回滚时先在阿里云 DNS 建立必要记录，再恢复两条原名称服务器。不要在传播期间反复切换；等待公共解析确认后再点击 Cloudflare 的完成按钮。

### 9.1 正式入口和运行目录

```text
网址：https://td.unreached.cn
项目：/Users/cxc/Projects/DEMO
数据：/Users/cxc/Projects/DEMO/var-product
监听：127.0.0.1:4317
环境：/Users/cxc/Projects/DEMO/.env
```

教师工作台使用 `td.unreached.cn`，根域名 `unreached.cn` 留作未来入口；不从 Codex worktree 启动生产服务，不使用外置盘、iCloud 或一个月建站权益保存真实数据。

### 9.2 后台进程

代码仓库已提供三个用户级 `launchd` 模板，合并到母文件夹后再安装：

- Node/Express：登录后启动并在异常退出后重启；
- `cloudflared`：把 `td.unreached.cn` Tunnel 转到本机回环端口并自动重连；
- 每日备份：检查数据变化，有变化才创建和验证快照。

应用与 Tunnel 日志通过 macOS unified log 保存，不写入产品数据根。常用只读查看命令：

```bash
log show --last 1h --predicate 'process == "logger" AND eventMessage CONTAINS "cn.unreached.teacher-dashboard"'
```

正式合并后按顺序执行：

```bash
node /Users/cxc/Projects/DEMO/scripts/configure-production-env.mjs
/Users/cxc/Projects/DEMO/scripts/install-production-launch-agents.sh
```

第二条命令只有在 `/Users/cxc/.cloudflared/config.yml` 已创建并校验后才会成功；它不会从 worktree 安装长期服务。

仓库只保存无密钥模板。`AUTH_SECRET`、AI/OCR 密钥和 Tunnel 凭据不写入仓库，也不输出到操作记录。

### 9.3 自动备份

- 只覆盖 `var-product/system` 与 `var-product/workspaces`；
- 每天最多检查一次，无数据变化时不创建目录；
- 新快照只有通过清单哈希和 SQLite 完整性检查后才算成功；
- 自动目录只保留最近 2 份成功快照；
- 升级/迁移前快照和当前 `var/backups` 历史快照不自动删除；
- 恢复永远落到全新的目录，禁止覆盖运行目录。

2026-09-08 实测：第一次在 `var-product/backups/automatic` 创建成功快照；紧接着第二次检查检测到内容未变化并跳过，没有产生重复快照。当前只有 1 个成功自动恢复点。

这一策略的 RPO 目标为 24 小时、RTO 目标为 2 小时。同盘备份不能抵御整机丢失或物理磁盘损坏，该风险在本阶段接受。

### 9.4 公网故障人工接管

- 域名/Tunnel 异常：停止 Tunnel，保留本机服务和数据，先通过回环地址检查；
- 应用异常：停止 LaunchAgent，记录当前提交和日志，再以前台方式诊断；
- 数据异常：先停止写入，保留故障目录，从已验证快照恢复到新目录；
- 长任务异常：重启后遗留状态应显示 interrupted/failed，由教师人工重试；
- 中国大陆链路不达标：不扩大邀请，重新审批国内入口，不自动购买服务器。

### 9.5 国内网络验收

公网开放后连续 48 小时在中国电信、联通、移动以及微信内置浏览器测试登录、首屏、核心 API、PDF 打开和上传。测试前关闭会影响结论的开发机代理；免费 Cloudflare 不构成中国大陆高速承诺。

## 10. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-07 | 已被 v1.1 取代 | 建立第 1 切片本地生产启动、健康检查、退出、日志和备份恢复操作基线。 |
| v1.1 | 2026-09-07 | 已被 v1.2 取代 | 加入认证环境变量、本机验收边界和覆盖认证库/全部工作区的 v2 产品快照。 |
| v1.2 | 2026-09-08 | 已被 v1.3 取代 | 修正本机双进程启动说明；补充“注册后返回登录页”、无注册会话和新教师空工作区的验收步骤。 |
| v1.3 | 2026-09-08 | 已被 v1.4 取代 | 固定 `unreached.cn` 根域名、`var-product` 和三个 LaunchAgent 的运行口径；排除外置盘/云盘，改为每日变更检测及最近两份自动快照，并加入公网故障与三网验收步骤。 |
| v1.4 | 2026-09-08 | 已被 v1.5 取代 | 教师工作台入口改为 `td.unreached.cn`，同步生产 `APP_URL`、Tunnel 路由和后台运行说明；根域名保留给未来入口。 |
| v1.5 | 2026-09-08 | 已被 v1.6 取代 | 记录 cloudflared、本地产品副本、自动备份去重、unified log 与合并后 LaunchAgent 安装顺序；公网入口仍未启用。 |
| v1.6 | 2026-09-08 | 当前，实施中 | 记录 Cloudflare 免费 Zone、阿里云与 Cloudflare DNS 职责、精确名称服务器、切换前空记录核查、用户授权和回滚步骤。 |
