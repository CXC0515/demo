# 班级、座位、课表与日程功能交接记录

## 1. 文档目的

本文记录 `codex/reminder-batch-workbench` 分支中已经落地的班级、座位、课表与日程功能，说明本地数据的真实位置、运行前提和后续开发基线，避免新 worktree 因缺少 `.env` 或 SQLite 数据而误判为数据丢失。

## 2. Git 基线

- 本分支从 `origin/main@5fad4d3525858720f2c5cdf24e68edc3aae543bb` 开始开发。
- 起始提交是合并资源库功能的 `5fad4d3 Merge pull request #4 from CXC0515/codex/resource-library`。
- 本次功能合并后，后续任务必须先执行 `git fetch origin`，再从包含本次 PR 的最新 `origin/main` 创建独立的 `codex/<功能名>` 分支和 worktree。
- 不得直接复用本分支，也不得假设 `/Users/cxc/Projects/DEMO` 当前检出的分支就是 `main`。

本分支在交接文档之前包含以下 12 个功能提交：

| 提交 | 内容 |
| --- | --- |
| `dc7eb01` | 学生管理单列展示学号，并将座位图改为教师从讲台看向学生的方向 |
| `7580bca` | 座位图适配可视区域，避免依赖固定尺寸 |
| `db77cb5` | 增加座位坐标、默认 8 行 7 列及 Excel 导出 |
| `20a0d11` | 拆分课表与日程子页面，加入课表 OCR 导入 |
| `822217f` | 增加全校统一课节设置 |
| `37c5e99` | 支持学校自定义课节数量和时段 |
| `7fd0eaa` | 明确课节设置的保存和同步反馈 |
| `6a166d1` | 改进课表识别草稿、课表层级和颜色表达 |
| `4a36760` | 增强班级名称匹配，并加入宋瓷主题色卡 |
| `db28bb2` | 加入 AI 批量创建日程草稿，并修复工作台今日日程来源 |
| `fb54444` | 修复学生与座位数据衔接，扩展课表和日程交互 |
| `2ffe7f6` | 规范 OCR 特殊符号，并增强周期日程识别 |

## 3. 当前能力和产品约束

### 学生与座位

- 学生管理中姓名和学号分列显示。
- 座位图按照教师在讲台向后看的方向展示：前排在下，后排在上。
- 默认座位模板是 8 行 7 列，列间保留过道。
- 座位图使用底部列号和由下到上的行号，不在座位卡片中堆放冗余序号。
- Excel 按座位顺序导出，空位保留空单元格，并可选择是否包含学号。
- 旧示例班级 `七年级 5 班` 已从数据库和启动初始化逻辑中移除；新数据库不会再自动生成该班级。

### 课表

- “我的课表”和“班级课表”分开管理。
- 我的课表以班级为主信息、课程为次信息；没有班级时以个人事项名称为主信息。
- 班级课表以课程名称为主信息，不同课程使用一致的主题色卡。
- 默认显示周一至周五，周末显示由设置控制。
- 学校可在系统设置中增删课节、修改课节名称和时间。
- 课表图片先在本地增强，再交给 PaddleOCR，OCR 文本随后交给 AI 结构化和班级名称匹配。
- AI 匹配应处理同义年级和班级写法；“七年级十班＝初一（10）班”只是示例，不是写死规则。
- OCR 空白单元格保持为空，不生成“教师待补充”等占位文本。

### 日程

- 产品用语统一为“日程”，课表和日程是同一模块下互不挤占空间的两个子页面。
- 日程支持清单、四象限、拖动、重要/紧急状态、时间排序、编辑和周期设置。
- AI 批量创建先生成草稿，用户确认后才写入正式日程。
- 没有明确日期但给出具体时刻时，可以按今天补全，同时保留黄色假设提示。
- “每周三”等表达应生成周期规则；现有试验日程在本次交接中全部保留。

## 4. 本地持久化现状

SQLite 和本地任务文件都被 `.gitignore` 排除，不会随 Git 分支、PR 或 `main` 自动移动。

### `roster.sqlite`

当前权威文件位于：

`/Users/cxc/.codex/worktrees/32dd/DEMO/var/data/roster.sqlite`

交接时的逻辑数据量：

| 数据 | 数量 |
| --- | ---: |
| 班级 | 2 |
| 学生 | 53 |
| 班级成员关系 | 53 |
| 座位布局 | 1 |
| 已安排座位 | 53 |
| 课表项目 | 46 |
| 课节 | 9 |
| 日程 | 8 |

两个班级分别是“初一（10）班”和“初一（9）班”。SQLite `user_version` 为 7，交接前完整性检查结果为 `ok`。

### `resources.sqlite`

当前文件位于：

`/Users/cxc/.codex/worktrees/32dd/DEMO/var/data/resources.sqlite`

其中没有用户上传资源，包含系统预置的 9 个学科、51 个知识节点和相应修订记录。它不是本轮班级数据丢失问题的来源。

### 临时和疑似试验内容

- 8 条日程包含本轮交互试验产生的内容，按用户要求保留，不做自动清理。
- `var/data/grading-tasks.json` 中有一条名为 `20260902_1` 的试验批改任务；它不是 SQLite 数据库，本次不复制到母文件夹。
- `var/data/parser-artifacts/` 下的 PaddleOCR 返回结果是解析诊断产物，本次不复制。
- `var/backups/` 是恢复快照，本次不复制到母文件夹的数据目录，也不提交 Git。

## 5. 数据库复制规则

SQLite 使用 WAL 模式。只复制 `roster.sqlite` 或 `resources.sqlite` 主文件可能漏掉尚在 `-wal` 文件中的最新记录，曾经出现过复制后学生数量变成 0 的现象。

必须使用 SQLite 在线备份：

```bash
sqlite3 /绝对路径/源数据库 ".backup '/绝对路径/目标数据库'"
```

复制后至少检查：

```bash
sqlite3 /绝对路径/目标数据库 "PRAGMA integrity_check;"
sqlite3 /绝对路径/目标数据库 "SELECT COUNT(*) FROM students;"
```

母文件夹的数据目标是：

- `/Users/cxc/Projects/DEMO/var/data/roster.sqlite`
- `/Users/cxc/Projects/DEMO/var/data/resources.sqlite`

母文件夹当前检出的是其他功能分支。复制数据库不代表可以在该分支直接继续本功能开发；代码任务仍应从最新 `origin/main` 新建 worktree。

## 6. 环境变量

本地真实配置位于：

`/Users/cxc/Projects/DEMO/.env`

交接时下列三个文件内容和 SHA-256 完全一致：

- `/Users/cxc/Projects/DEMO/.env`
- `/Users/cxc/.codex/worktrees/32dd/DEMO/.env`
- `/Users/cxc/.codex/worktrees/a57e/DEMO/.env`

`.env` 被 Git 忽略，不得提交，也不会自动出现在新的 worktree。新任务开始前应从母文件夹复制到新 worktree 根目录，并只核对变量名，不在文档、日志或 PR 中暴露值。

当前使用的变量名：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_VISION_MODEL`
- `APP_URL`
- `PADDLEOCR_MODEL`
- `PADDLEOCR_COMMAND`
- `PADDLEOCR_PYTHON`
- `PADDLEOCR_ACCESS_TOKEN`

`.env.example` 还提供了 `OPENAI_REMINDER_MODEL`、`PADDLEOCR_BASE_URL`、`ROSTER_DB_PATH` 和 `ROSTER_BACKUP_DIR` 等可选配置。新增变量时应同步更新 `.env.example`，但不得把真实值写入仓库。

## 7. 本地运行和验证

前端默认端口是 `3000`，API 默认端口是 `3001`；也可由启动环境改到其他端口。前端通过 Vite 将 `/api` 和 `/uploads` 代理到 API。

```bash
npm install
npm run dev:api
npm run dev
```

提交前至少运行：

```bash
npm run lint
npm run test:roster
npm run test:classroom
npm run test:schedule
npm run build
```

涉及资源库、批改或视觉识别时，再运行相应专项测试。最终还要核对工作区只包含当前批准范围内的修改。

## 8. 后续任务启动清单

1. `git fetch origin`，确认本次 PR 已合并到 `origin/main`。
2. 从最新 `origin/main` 创建独立的 `codex/<功能名>` 分支和 worktree。
3. 从 `/Users/cxc/Projects/DEMO/.env` 复制 `.env` 到新 worktree。
4. 如果需要延续当前教师数据，用 SQLite `.backup` 从母文件夹数据库复制，不要使用普通 `cp`。
5. 启动 API，让迁移程序检查数据库结构；确认 `PRAGMA integrity_check` 为 `ok`。
6. 启动前端，先用真实班级、座位、课表和日程完成最小闭环验证，再继续修改。
7. 每个专项单独提交、单独 PR，不把其他 worktree 的改动混入。
