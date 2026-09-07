# DEMO 网页产品数据迁移与回滚手册

> 文档版本：`v1.2`
> 日期：2026-09-08
> 适用范围：母文件夹真实数据到网页产品数据根的副本迁移

## 1. 不可变规则

- `/Users/cxc/Projects/DEMO/var` 仍是当前权威母数据，未经单独切换审批不得修改或删除。
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

## 2.2 第 3 切片拟定正式数据根

公网产品拟使用固定目录：

```text
/Users/cxc/Projects/DEMO/var-product
```

该目录位于母文件夹中，不属于任何 Codex worktree。它必须从 `/Users/cxc/Projects/DEMO/var-web-auth-candidate` 的已验证产品快照恢复产生，不能通过 Finder 或普通文件复制直接克隆运行中的 SQLite。

正式切换尚未执行。当前关系是：

- `/Users/cxc/Projects/DEMO/var`：原始母数据，保持不动；
- `/Users/cxc/Projects/DEMO/var-web-auth-candidate`：包含 Cleo 认证和所有者工作区的候选产品数据；
- `/Users/cxc/Projects/DEMO/var-product`：获批并完成恢复验收后才创建和标记为产品权威数据根。

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

第 3 切片执行时，上述“旧权威目录”指经过最终冻结的 `var-web-auth-candidate`，“新的、空白候选目录”固定为 `var-product`。切换前同时抽查 Cleo 所有者工作区的 4 个班级、53 名学生、2 份资料和 522 个资料页面；这些数量用于发现意外缺失，不限制后续正常业务增长。

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

## 9. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-07 | 已被 v1.1 取代 | 记录首次真实数据副本演练、校验基线、正式切换和回滚流程。 |
| v1.1 | 2026-09-07 | 已被 v1.2 取代 | 记录认证工作区候选迁移、二次在线快照、所有者归属和 v2 产品备份边界。 |
| v1.2 | 2026-09-08 | 当前，待实施 | 固定 `var-product` 为公网产品数据根，明确从认证候选的在线快照恢复；排除外置盘/云盘，并增加无变化跳过、最近两份自动快照和旧快照单独删除授权。 |
