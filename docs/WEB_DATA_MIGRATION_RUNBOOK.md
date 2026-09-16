# DEMO 网页产品数据迁移与回滚手册

> 文档版本：`v1.9`
> 日期：2026-09-16
> 适用范围：母文件夹真实数据到网页产品数据根的副本迁移

## 1. 不可变规则

- `/Users/cxc/Projects/DEMO/var` 是保留的原始母数据；网页产品当前运行权威数据为 `/Users/cxc/Projects/DEMO/var-product`。两者都不得直接用于试错。
- 迁移前先做 SQLite 在线备份与文件快照，不直接复制正在写入的 `.sqlite`、`-wal` 或 `-shm`。
- 每次恢复写入全新的目标目录，工具拒绝覆盖已有目录。
- 正式切换前必须停止旧进程的新写入，并分别记录切换前、切换后的校验结果。
- 回滚通过切换 `APP_DATA_ROOT` 完成，不通过覆盖或删除原目录完成。

## 2. 2026-09-07 首次恢复演练记录

源数据：

```text
/Users/cxc/Projects/DEMO/var
```

可恢复快照：

```text
/Users/cxc/Projects/DEMO/var/backups/pre-web-phase1-20260907-012014
```

恢复出的网页候选副本：

```text
/Users/cxc/Projects/DEMO/var-web
```

快照包含 182 个文件，共 336,844,907 字节。快照和恢复副本的两个 SQLite `integrity_check` 均为 `ok`，2 个资料文件引用均存在；恢复后的资料绝对路径已指向 `var-web/uploads/resources`。演练后再次检查母数据，两库仍为 `ok`。

关键表基线：

| 数据库 | 表 | 行数 |
| --- | --- | ---: |
| roster | classes | 4 |
| roster | students | 53 |
| roster | class_memberships | 53 |
| roster | classroom_layouts | 1 |
| roster | classroom_seats | 53 |
| roster | committee_roles | 3 |
| roster | committee_assignments | 4 |
| roster | schedule_items | 46 |
| roster | schedule_periods | 9 |
| roster | timer_reminders | 24 |
| resources | resources | 2 |
| resources | resource_pages | 522 |
| resources | resource_chunks | 220 |
| resources | knowledge_nodes | 62 |
| resources | knowledge_relations | 16 |
| resources | knowledge_source_links | 13 |
| resources | discovery_suggestions | 43 |
| resources | resource_processing_jobs | 11 |

上述数字用于发现意外缺失，不代表未来数据必须保持不变。

## 2.1 2026-09-07 认证工作区候选迁移

对非权威候选 `/Users/cxc/Projects/DEMO/var-web` 再次创建在线快照：

```text
/Users/cxc/Projects/DEMO/var/backups/pre-auth-20260907-170634
```

随后只从该快照恢复到：

```text
/Users/cxc/Projects/DEMO/var-web-auth-candidate/
└── workspaces/ba9eb0be-5101-4d78-b7c9-915ff568e240/
```

新候选同时包含 `system/auth.sqlite`。初始所有者邀请绑定 `xcheng@agent.qq.com`，注册前保持 pending。迁移后仍为 182 个业务文件、336,844,907 字节；两个业务 SQLite 完整性为 `ok`，关键表计数与上表一致，2 个资料引用均存在。原 `/var` 与 `/var-web` 未被改写，新候选尚未设为正式权威数据根。

迁移后又用 v2 产品快照覆盖认证库与所有者工作区：

```text
/Users/cxc/Projects/DEMO/var/backups/post-auth-candidate-20260907-172120
```

该快照共 186 个文件，包含 3 个在线备份的 SQLite；清单哈希和数据库完整性校验通过。另已恢复到临时新目录并验证路径映射，证明 v2 备份可恢复；临时演练目录不作为长期备份。

## 2.2 第 3 切片产品数据根恢复记录

公网产品固定目录：

```text
/Users/cxc/Projects/DEMO/var-product
```

该目录位于母文件夹中，不属于任何 Codex worktree。2026-09-08 已从 `/Users/cxc/Projects/DEMO/var-web-auth-candidate` 的在线产品快照恢复产生，没有通过 Finder 或普通文件复制运行中的 SQLite。

独立切换前恢复点：

```text
/Users/cxc/Projects/DEMO/var/backups/pre-public-trial-2026-09-08T055000+0800
```

快照与恢复证据：

- 186 个清单文件，3 个 SQLite 在线备份；文件大小、SHA-256 和 3 个数据库的 `integrity_check` 均通过；
- 认证侧为 1 个用户、1 个工作区、1 个成员关系；
- 业务侧为 4 个班级、53 名学生、46 条日程、2 份资料、522 个资料页面、62 个知识节点和 11 条资源处理任务；
- 2 个资料路径均已重映射到 `var-product` 且文件存在；源候选路径只保留在顶层 `restore-report.json` 的审计字段中；
- 原 `/var`、候选目录和既有历史快照未修改、未删除。

当前关系是：

- `/Users/cxc/Projects/DEMO/var`：原始母数据，保持不动；
- `/Users/cxc/Projects/DEMO/var-web-auth-candidate`：包含 Cleo 认证和所有者工作区的候选产品数据；
- `/Users/cxc/Projects/DEMO/var-product`：已完成恢复、数据库/文件校验和回环生产烟雾测试；待代码合并及正式后台进程接管后成为公网产品运行根。

外置盘、iCloud 和其他云盘不属于本阶段迁移或恢复链路。

## 3. 创建可恢复快照

先确认没有未知服务占用数据，然后执行：

```bash
npm run backup:data -- \
  /Users/cxc/Projects/DEMO/var \
  /Users/cxc/Projects/DEMO/var/backups/pre-cutover-YYYYMMDD-HHMMSS
```

命令成功后会输出快照文件数、字节数和数据库表计数。保留快照目录内的 `manifest.json`；不得单独移动其中一部分文件。

## 4. 恢复到候选目录

选择一个尚不存在的目录：

```bash
npm run restore:data -- \
  /Users/cxc/Projects/DEMO/var/backups/pre-cutover-YYYYMMDD-HHMMSS \
  /Users/cxc/Projects/DEMO/var-web-next
```

恢复过程依次执行：校验快照哈希、复制文件、映射旧绝对路径、校验 SQLite、检查资料引用、写入 `restore-report.json`。任何步骤失败都不得把该目录用于生产。

再执行独立校验：

```bash
npm run verify:data -- /Users/cxc/Projects/DEMO/var-web-next
```

## 5. 正式切换

正式切换需要单独审批，且应安排短维护窗口：

1. 停止旧服务，阻止旧数据根继续写入。
2. 对旧权威目录创建最后一个切换前快照并校验。
3. 恢复到新的、空白候选目录并校验。
4. 用新目录设置 `APP_DATA_ROOT`，在 `127.0.0.1` 启动新版本。
5. 检查健康接口、班级/学生/课表、资料列表、PDF Range、OCR 结果、知识结构和批改记录。
6. 记录切换时刻、旧代码提交、旧数据根、新代码提交、新数据根和快照目录。
7. 只有验收通过后，才把新目录标记为权威数据；旧目录继续只读保留到回滚窗口结束。

第 3 切片中，上述“旧权威目录”指经过最终冻结的 `var-web-auth-candidate`，“新的、空白候选目录”固定为 `var-product`。2026-09-08 的恢复和回环启动抽查已通过；公网开放前仍需完成登录、知识图谱、批改及跨账号浏览器抽查。这些数量用于发现意外缺失，不限制后续正常业务增长。

## 6. 回滚

出现数据库错误、资料缺失、关键接口失败或数据路径异常时：

1. 立即停止新服务，避免继续写入候选目录。
2. 保留失败目录用于调查，不覆盖、不删除。
3. 将代码切回已知稳定提交。
4. 将 `APP_DATA_ROOT` 指回切换前的只读保留目录，或从切换前快照恢复到另一个新目录。
5. 启动后重新运行健康、完整性和核心业务检查。
6. 记录故障时间、新目录产生的新写入及是否需要人工补录；不得自动把两边 SQLite 合并。

若切换后已经产生用户新数据，回滚不是无损操作。必须先冻结两边写入，导出差异并制定单独的数据合并方案，经审批后执行。

## 7. 恢复演练验收

一次恢复演练只有同时满足以下条件才算通过：

- 快照全部文件的大小和 SHA-256 匹配；
- 两个 SQLite 的 `integrity_check` 为 `ok`；
- 关键表数量与快照清单一致；
- 资料引用无缺失，抽查 PDF 可 Range 读取；
- 恢复目录中的内部绝对路径不再指向源目录；
- 使用恢复目录启动后，首页、API 和核心只读业务正常；
- 母数据在演练前后未被修改或破坏。

## 8. 公网产品自动备份保留

正式切换后，自动备份只覆盖 `var-product/system` 与 `var-product/workspaces`：

1. 每天检查一次；无变化不生成快照。
2. 有变化时创建新目录，对 SQLite 使用在线备份，并复制文件产物。
3. 完成 SHA-256、文件数量和 SQLite 完整性检查后才标记为成功。
4. 新成功快照可用后，自动目录只保留最近 2 份成功快照。
5. incomplete 快照不作为恢复点，并保留错误记录供排查。
6. 升级/迁移前快照与既有 `var/backups` 历史快照不参与自动清理；如需删除，先列出绝对路径、大小和可替代恢复点，再单独获得授权。

自动备份目录与运行数据位于同一台 MacBook，只能处理误操作、错误升级和部分逻辑损坏；不能处理整机丢失或物理磁盘损坏。该限制不通过擅自使用外置盘或云盘规避。

### 8.1 PR #16 升级前恢复点

2026-09-10 部署 PR #16 前，对正在运行的 `/Users/cxc/Projects/DEMO/var-product` 创建产品在线快照：

```text
/Users/cxc/Projects/DEMO/var/backups/product-2026-09-10T04-07-32-pre-pr16
```

快照包含 192 个文件和 5 个 SQLite 数据库；独立 `verify:product` 已通过全部清单哈希和 SQLite 完整性检查。本次升级没有数据库结构迁移或数据根切换；若新版本在产生新写入前失败，可切回旧代码并从该快照恢复到全新目录。若已有用户新写入，仍按第 6 节冻结并核对差异，不覆盖当前 `var-product`。

### 8.2 PR #17 OCR 富内容迁移恢复点

2026-09-10 部署 PR #17 前，在应用停止写入期间创建并验证：

```text
/Users/cxc/Projects/DEMO/var/backups/product-2026-09-10T14-55-20-pre-pr17
```

快照包含 198 个文件和 5 个 SQLite。正式迁移先以只读模式检查 2 个工作区、3 份资料、230 个候选块和 11 张页面图；结果与副本演练一致后才携带该已验证快照执行。最终更新 217 个内容块、归位 11 张页面图，两个缺少旧内容块的页面保持不变；两个 `resources.sqlite` 的 `integrity_check` 均为 `ok`。

本次迁移为 `resource_chunks` 增加 PaddleOCR 原始类型、应用内容类型、Markdown 和图片引用。回滚时停止应用，保留迁移后目录，把代码切回 `52754d1`，从本恢复点恢复到全新目录并切换 `APP_DATA_ROOT`；不得让旧代码继续写入已执行 v8 迁移的资源库。

### 8.3 腾讯云服务器恢复演练

2026-09-10，已将产品快照 `product-2026-09-10T23-57-18-pre-server-migration` 上传到腾讯云 Lighthouse，并在清理归档外层包装文件后完成校验：200 个清单文件、5 个 SQLite。随后恢复到服务器新目录：

```text
/var/lib/teacher-dashboard/product-2026-09-10T23-57-18
```

该目录只证明服务器恢复链路可用，不是当前权威数据。MacBook 后续本地修改和数据写入不会自动同步到该副本，正式切换时禁止用它覆盖最新 `var-product`。

### 8.4 备案下线前恢复点与最终迁移口径

2026-09-12，在停止公网入口前，从运行权威目录创建并验证：

```text
/Users/cxc/Projects/DEMO/var/backups/product-2026-09-12-pre-icp-offline
```

快照包含 207 个文件和 5 个 SQLite，清单与完整性校验通过。备案审核期间，本地开发仍直接使用唯一权威目录 `/Users/cxc/Projects/DEMO/var-product`；用户本地从状态 A 修改到状态 C 后，C 即为待迁移状态。

备案通过后的最终迁移必须重新停止写入、从当时最新 `var-product` 创建在线快照、上传并恢复到服务器全新目录，再完成清单、SQLite、文件引用和业务验收。不得把 2026-09-10 的服务器演练副本误标为最新数据。

### 8.5 硅谷生产迁移恢复点

2026-09-16，用户确认当前产品数据可以存储到境外。迁移前从唯一权威目录 `/Users/cxc/Projects/DEMO/var-product` 创建新的在线产品快照：

```text
/Users/cxc/Projects/DEMO/var/backups/product-2026-09-16-pre-overseas-cutover
```

`backup:product` 记录 1,255 个产品文件和 5 个 SQLite；独立 `verify:product` 已通过所有清单哈希和数据库完整性检查。快照目录包含 `manifest.json` 共 1,256 个文件，占用约 506 MiB。旧上海服务器中的 2026-09-10 演练副本不参与本次迁移。

服务器端校验快照时发现 macOS 上传产生的 `._*` AppleDouble 元数据。这些文件不属于 `manifest.json`，精确统计为 1,618 个，仅从服务器传输副本中清除；本地快照未改动。清理后服务器端再次通过 1,255 个产品文件和 5 个 SQLite 校验。

首次恢复到以下目录时，恢复工具把 `workspaces/.DS_Store` 当作工作区目录，恢复失败：

```text
/var/lib/teacher-dashboard/product-2026-09-16
```

失败目录按回滚规则保留。PR #24（生产提交 `03b3a0d`）把恢复遍历改为只处理实际目录，并增加非目录元数据测试。随后从同一已验证快照恢复到新的目录：

```text
/var/lib/teacher-dashboard/product-2026-09-16-r2
```

新目录恢复成功，应用回环、HTTPS、公网 `live`、未登录 401 和登录首屏均通过。2026-09-16 起，该 `-r2` 目录成为生产运行权威数据；本地 `var-product` 与迁移前恢复点继续保留为切换前回滚证据，不得覆盖上线后产生的新数据。

## 9. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-07 | 已被 v1.1 取代 | 记录首次真实数据副本演练、校验基线、正式切换和回滚流程。 |
| v1.1 | 2026-09-07 | 已被 v1.2 取代 | 记录认证工作区候选迁移、二次在线快照、所有者归属和 v2 产品备份边界。 |
| v1.2 | 2026-09-08 | 已被 v1.3 取代 | 固定 `var-product` 为公网产品数据根，明确从认证候选的在线快照恢复；排除外置盘/云盘，并增加无变化跳过、最近两份自动快照和旧快照单独删除授权。 |
| v1.3 | 2026-09-08 | 已被 v1.4 取代 | 记录切换前 v2 在线快照、`var-product` 恢复、业务计数、资料路径及回环生产烟雾结果；公网接管前仍保留候选与母数据。 |
| v1.4 | 2026-09-09 | 已被 v1.5 取代 | 增加班级级 `chinese_teacher` 删除的升级保护：生产切换前创建并验证产品在线快照，先在全新恢复目录演练 SQLite v11；失败时切回旧代码和升级前恢复目录，不覆盖故障目录。 |
| v1.5 | 2026-09-10 | 已被 v1.6 取代 | 记录 PR #16 部署前产品在线快照、192 个文件与 5 个 SQLite 校验结果，以及无结构迁移条件下的回滚边界。 |
| v1.6 | 2026-09-10 | 已被 v1.7 取代 | 记录 PR #17 部署前 198 文件恢复点、OCR 富内容 v8 迁移的只读预检、正式回填结果、完整性检查与禁止旧代码写新库的回滚边界。 |
| v1.7 | 2026-09-12 | 已被 v1.8 取代 | 记录腾讯云 200 文件/5 SQLite 恢复演练、备案下线前 207 文件恢复点，以及本地 `var-product` 持续为唯一权威数据的最终迁移口径。 |
| v1.8 | 2026-09-16 | 已被 v1.9 取代 | 记录迁移前最新 `var-product` 的硅谷恢复点、1,255 个产品文件/5 个 SQLite 校验结果，以及服务器完成验收前不切换权威数据。 |
| v1.9 | 2026-09-16 | 当前 | 记录 AppleDouble 清理、非目录工作区修复、全新 `-r2` 恢复成功及服务器数据正式成为运行权威数据。 |
