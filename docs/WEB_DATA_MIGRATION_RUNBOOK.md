# DEMO 网页产品数据迁移与回滚手册

> 文档版本：`v1.0`
> 日期：2026-09-07
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

## 8. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-07 | 当前 | 记录首次真实数据副本演练、校验基线、正式切换和回滚流程。 |
