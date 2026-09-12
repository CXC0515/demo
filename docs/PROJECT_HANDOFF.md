# DEMO 项目当前交接

> 本文是当前统一交接入口。历史专项文档只用于追溯当时的决策，不再代表当前 Git、数据路径或部署状态。
> 更新时间：2026-09-12；当前 Git 稳定基线：`origin/main@20b66bc`（PR #19），最近功能基线为 `54ff5dc`（PR #17）。

## 1. 当前阶段与产品边界

DEMO 已从本地原型进入“三名教师以内的私有网页试用”阶段。当前主要任务不是继续扩张架构，而是通过真实教师使用发现稳定性、交互和识别质量问题。

- 正式入口：`https://td.unreached.cn`
- 当前运行机器：Cleo 的 MacBook，单实例 Node/Express 长期进程
- 下一阶段基础设施：已购买一台服务器，但供应商、地域、系统、规格、公网 IP、带宽、SSH、备案和安全组状态尚未核实，不能视为已具备迁移条件
- 用户：管理员 Cleo 与最多两名受邀教师
- 身份边界：邀请注册、密码登录、管理员权限、每教师独立工作区
- 暂不承诺：校园网可达率、多人高并发、跨实例容灾和异地备份

## 2. Git 与协作基线

- GitHub `origin/main` 是唯一稳定基线；2026-09-12 只读核对为 `20b66bc`，已包含 PR #17 的功能修改、PR #18 的部署交接更新和 PR #19 的规则/服务器交接整理。
- 母文件夹固定为 `/Users/cxc/Projects/DEMO`，正式服务只从这里运行，不从临时 worktree 运行。
- 每个代码任务先 `git fetch origin`，再从最新 `origin/main` 创建独立的 `codex/<功能名>` 分支和 worktree。
- 文档按用户约定可在母文件夹先同步 Git 后直接更新；代码仍不得在 `main` 上开发。
- 修改必须遵守根目录 `AGENTS.md`：先只读调查并提交具体方案，得到明确授权后写入；推送、PR、合并和部署分别需要授权。
- 真实环境变量只使用 `/Users/cxc/Projects/DEMO/.env`，不得提交、复制或输出其中的密钥。

## 3. 当前生产架构

```mermaid
flowchart LR
    U[教师浏览器] -->|HTTPS| C[Cloudflare Tunnel<br/>td.unreached.cn]
    C -->|127.0.0.1:4317| E[单实例 Express]
    E --> V[Vite dist 静态文件]
    E --> A[同源 API 与受保护资料]
    A --> S[(system/auth.sqlite)]
    A --> W[(各教师 workspace SQLite)]
    A --> F[各 workspace 上传与解析产物]
    A --> P[PaddleOCR-VL 远程服务]
    A --> M[OpenAI-compatible 模型服务]
```

- 前端：React 19、Vite 6、TypeScript、Tailwind CSS；桌面和手机共用一个响应式应用。
- 服务端：Express 5 同源托管生产前端、API 和受权限保护的资料内容。
- 数据：系统认证库与每教师工作区的 SQLite、上传文件、OCR 产物和任务状态全部位于持久目录。
- 后台：应用、Cloudflare Tunnel、每日变更检测备份由三个用户级 LaunchAgent 运行。
- 健康检查：`/api/health/live` 与 `/api/health/ready`；后者检查存储并报告 AI、PaddleOCR 配置状态。
- 长任务：OCR/AI 使用可查询状态；重启时进行中的任务标记为中断/失败，由用户重试，不阻塞已完成 PDF/OCR 查看。

## 4. 数据权威性与恢复边界

- 原始母数据 `/Users/cxc/Projects/DEMO/var` 保留为不可直接试错的历史母数据。
- 当前网页产品的运行权威数据为 `/Users/cxc/Projects/DEMO/var-product`。
- 自动备份位于 `var-product/backups/automatic`，仅在数据变化时创建，保留最近两份成功快照。
- 升级前独立恢复点位于 `/Users/cxc/Projects/DEMO/var/backups`，不参与自动清理。
- 最新部署前恢复点：`product-2026-09-10T14-55-20-pre-pr17`，包含 198 个文件和 5 个 SQLite，清单哈希与完整性校验均通过。
- 恢复必须落到新目录，禁止覆盖故障目录。若故障版本已经产生用户新写入，先冻结并导出差异，再单独审批数据合并。

## 5. 已落地能力

- 班级、学生、座位图、班委、课表、日程和系统设置。
- 作业图片 OCR、AI 试批、证据复核、学情诊断和教师终审。
- PDF 资料上传、分页 PaddleOCR、原文/OCR 阅读、知识检索与知识结构建议。
- 邀请注册、管理员门禁、会话保护、跨用户工作区隔离和受保护资料下载。
- 作息完整时间输入；80 MiB 上传限制和中文错误；资料会话缓存与请求去重。
- PaddleOCR 原始块类型、Markdown、坐标和图片引用持久保存；表格、图片和公式安全渲染。

关键控制边界：OCR 与 AI 只产生可追溯草稿或建议；教师确认前不得静默改变正式知识结构或评分结果。局部解析失败应隔离，不阻塞已完成页面。

## 6. PR #17 部署状态

- PR：`https://github.com/CXC0515/demo/pull/17`
- 生产提交：`54ff5dc`
- 回填：2 个工作区、3 份资料、230 个候选块；安全更新 217 个内容块和 11 张页面底图。
- 保留异常：两个没有既有内容块的历史页面不自动补写，需要用户主动重新解析。
- 数据校验：两个 `resources.sqlite` 的 `integrity_check` 均为 `ok`；原始 PaddleOCR 标签没有被规范类型覆盖。
- PR #17 部署当时的服务验收：本机与公网 `ready` 为 200，存储、AI、PaddleOCR 均为 ready；公网与本地构建资源哈希一致；未登录资料 API 返回 401。该记录只代表当次验收，不代表当前公网持续可达。

详细实现与验证见 [RESOURCE_EDITOR_AND_SCHEDULE_UX_PLAN.md](./RESOURCE_EDITOR_AND_SCHEDULE_UX_PLAN.md)，运行和恢复操作见 [WEB_OPERATIONS_RUNBOOK.md](./WEB_OPERATIONS_RUNBOOK.md) 与 [WEB_DATA_MIGRATION_RUNBOOK.md](./WEB_DATA_MIGRATION_RUNBOOK.md)。

## 7. 当前风险与下一步

1. Cloudflare 免费网络不保证中国大陆校园网可达或高速。2026-09-10 后续只读核查中，本机 `ready` 正常，但公网连续返回 HTTP 530；应用和 Tunnel 进程仍在运行，Tunnel 日志出现 QUIC 超时并连接到 `198.18.0.x` 合成地址。现有证据更指向 MacBook 上代理/TUN 与 Cloudflare Tunnel 出口链路不稳定，尚未证明是 Express 或 SQLite 故障。
2. 生产依赖 MacBook 的供电、网络和本地磁盘；自动备份同盘，不能抵御整机丢失或物理损坏。
3. PaddleOCR 与模型服务可能排队或短暂返回 5xx；保留阶段状态、有限重试和人工重试入口。
4. 两个历史 OCR 页面缺少可一一对应的旧内容块，保持原状，重新解析后才进入新结构。
5. `npm ci` 仍报告 4 项既有依赖审计问题（1 low、2 moderate、1 high）；尚未评估破坏性升级，不能直接运行 `npm audit fix --force`。

下一任务是把私有试用从 MacBook 迁移到新服务器，同时确保中国大陆普通网络、校园网和微信内置浏览器的真实可用性。开始前必须先只读核实服务器供应商与产品、地域、操作系统、CPU/内存/磁盘、公网 IP 与带宽、SSH 方式、域名备案状态以及安全组/防火墙；不得要求用户在聊天中粘贴密码或私钥。核实后再形成服务器部署、数据副本迁移、DNS 切换、验收和回滚方案，未经批准不实施。

## 8. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-06 | 已归档 | 记录本地原型、母数据同步和网页部署前阻塞项。 |
| v2.0 | 2026-09-10 | 已归档 | 重写为真实生产交接：记录邀请登录、工作区隔离、`var-product`、Cloudflare Tunnel、LaunchAgent、PR #17 OCR 富内容迁移、恢复点和当前试用风险。 |
| v2.1 | 2026-09-10 | 已被 v2.2 取代 | 校正 Git 基线为 PR #18；记录公网 530 与 Tunnel 出口异常证据、已购服务器的未核实状态，以及下一会话的服务器迁移调查入口。 |
| v2.2 | 2026-09-12 | 当前 | 校正稳定 Git 基线为 PR #19；PR #17 仍是最近功能基线，服务器迁移边界不变。 |
