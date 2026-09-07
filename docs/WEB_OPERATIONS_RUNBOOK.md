# DEMO 网页产品本地生产运行手册

> 文档版本：`v1.2`
> 日期：2026-09-08
> 适用范围：网页产品第一阶段第 2 切片
> 当前边界：具备本机邀请登录与工作区隔离，尚未配置公网入口

## 1. 当前运行边界

本切片已经加入邀请登录、每教师工作区和受保护文件访问，公开 `/uploads` 已移除。域名、Tunnel、自动开机和国内三网测试尚未完成，因此仍不得邀请外部用户。

权威母数据仍是：

```text
/Users/cxc/Projects/DEMO/var
```

本切片测试运行只使用恢复出的候选副本：

```text
/Users/cxc/Projects/DEMO/var-web-auth-candidate
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
APP_URL=https://unreached.cn \
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

## 9. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-07 | 已被 v1.1 取代 | 建立第 1 切片本地生产启动、健康检查、退出、日志和备份恢复操作基线。 |
| v1.1 | 2026-09-07 | 已被 v1.2 取代 | 加入认证环境变量、本机验收边界和覆盖认证库/全部工作区的 v2 产品快照。 |
| v1.2 | 2026-09-08 | 当前 | 修正本机双进程启动说明；补充“注册后返回登录页”、无注册会话和新教师空工作区的验收步骤。 |
