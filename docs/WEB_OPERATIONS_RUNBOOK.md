# DEMO 网页产品本地生产运行手册

> 文档版本：`v1.0`
> 日期：2026-09-07
> 适用范围：网页产品第一阶段第 1 切片
> 当前边界：仅限 MacBook 本机验证，尚未具备公网开放条件

## 1. 当前运行边界

本切片已经把 Vite 生产构建、Express API 和资料文件放到同一个 Node/Express 进程中，并增加运行环境校验、健康检查、结构化日志和优雅退出。当前尚未实现注册登录、工作区隔离和受保护下载，`/uploads` 仍是临时公开静态路径，因此不得把本版本通过域名或 Tunnel 暴露到互联网。

权威母数据仍是：

```text
/Users/cxc/Projects/DEMO/var
```

本切片测试运行只使用恢复出的候选副本：

```text
/Users/cxc/Projects/DEMO/var-web
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
APP_DATA_ROOT=/Users/cxc/Projects/DEMO/var-web \
API_HOST=127.0.0.1 \
API_PORT=4317 \
node --env-file=/Users/cxc/Projects/DEMO/.env --import tsx server/index.ts
```

浏览器访问 `http://127.0.0.1:4317`。不要把 `--env-file` 追加在 `npm start --` 后面；那会把参数交给应用而不是 Node，导致外部 AI/OCR 环境变量未加载。

`npm start` 仅适用于环境变量已经由进程管理器完整注入的情况。

## 4. 健康检查

存活检查：

```bash
curl -fsS http://127.0.0.1:4317/api/health/live
```

就绪检查：

```bash
curl -fsS http://127.0.0.1:4317/api/health/ready
```

就绪检查会验证数据卷可读写、两个 SQLite 可查询，并报告 AI 与 PaddleOCR 是否已配置。第三方服务未配置不会让本地资料读取整体失效，但会在依赖状态中明确显示。

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

对指定数据根创建快照：

```bash
npm run backup:data -- \
  /Users/cxc/Projects/DEMO/var-web \
  /Users/cxc/Projects/DEMO/var/backups/manual-YYYYMMDD-HHMMSS
```

校验活动数据：

```bash
npm run verify:data -- /Users/cxc/Projects/DEMO/var-web
```

恢复必须写入一个不存在的新目录：

```bash
npm run restore:data -- \
  /Users/cxc/Projects/DEMO/var/backups/manual-YYYYMMDD-HHMMSS \
  /Users/cxc/Projects/DEMO/var-web-restored
```

备份对 SQLite 使用在线备份 API；文件使用独立快照；`manifest.json` 保存文件大小和 SHA-256。恢复前会验证清单，恢复后会校验数据库完整性、关键表数量和资料引用，并把数据库及 JSON 中位于旧数据根内的绝对路径映射到新根。脚本拒绝覆盖已有目录，也拒绝符号链接。

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
| v1.0 | 2026-09-07 | 当前 | 建立第 1 切片本地生产启动、健康检查、退出、日志和备份恢复操作基线。 |
