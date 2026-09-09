# 上传隔离与页面运行稳定性方案

## 文档信息

- 当前版本：v1.0
- 日期：2026-09-10
- 状态：文档与代码方案已批准，待实施
- 代码基线：`origin/main@dfdf87c`

## 1. 原始问题和目标

本轮同时解决三个真实故障：班级课表全部进入不可操作的待确认状态、班级可视化每次进入都清空并重新加载、知识图谱在部署后可能白屏。目标是修复共同边界和状态生命周期，不叠加名称特例、永久旧资源或无期限兼容分支。

## 2. 已确认事实

- 线上班级课表导入日志记录 34 项全部为 `no-candidate`；教师为空与待确认无关。
- authenticated multipart 路由在认证中间件后使用 Multer，但 Multer 完成后没有显式恢复 `AsyncLocalStorage` 工作区。母级兼容数据库恰好没有启用班级，而真实工作区存在班级，与故障结果一致。
- 座位图接口最近响应约 13–35ms。等待来自页面切换时组件卸载、已有布局清空和重新显示整页 loading，而不是服务端计算。
- 知识图谱接口最近响应约 5–9ms。图谱画布是唯一延迟加载的大组件；缺失的 `/assets/*.js` 当前会被 SPA fallback 误返回 `index.html`（HTTP 200），页面又没有 chunk 加载错误边界。
- 公网当前对静态 JS 返回约 4 小时缓存。保留旧构建文件不是本方案的稳定性机制。

## 3. 决策与最短路径

1. 在认证边界增加一个 Multer 后工作区恢复中间件，并应用到课表、资料和批改三个上传入口；删除依赖母级存储兜底的错误路径。
2. 班级课表在 OCR 前验证目标班级，教师可空，取消不可能被用户处理的班级待确认状态；AI 使用按 scope 收敛的最小字段协议。
3. 座位布局由登录态内的父级缓存持有。重新进入先展示已知状态并后台刷新，保存后同步更新缓存；退出登录后随 App 卸载清空。
4. `/assets` 缺失资源明确返回 404，`index.html` 使用 `no-store`，哈希资源使用 immutable；图谱 chunk 在空闲时预取并由错误边界提供一次明确刷新恢复。
5. 不保留旧构建文件作为兜底，不引入 React Query、Service Worker 或新的部署平台。

## 4. 修改文件与范围

- `server/middleware/authenticated.ts`：工作区恢复中间件。
- `server/routes/schedule.ts`、`server/routes/resources.ts`、`server/routes/gradingTasks.ts`：Multer 后恢复认证工作区；课表提前校验班级。
- `server/services/schedule/scheduleImportService.ts`：按课表 scope 精简 AI 契约，教师字段可空。
- `src/features/schedule/ScheduleReminder.tsx`：删除班级课表不可见的确认阻塞，改进状态文案。
- `src/App.tsx`、`src/features/classroom/VirtualClassroom.tsx`：登录态内座位布局缓存和后台刷新。
- `server/app.ts`：静态资源和 HTML 缓存、404 边界。
- `src/features/knowledge/KnowledgeGraphWorkspace.tsx`：图谱资源预取及错误恢复界面。
- 相关测试文件：multipart 工作区隔离、课表协议、静态资源路由与既有模块回归。

## 5. 风险、取舍和验证

- 工作区恢复覆盖三个上传入口，范围比单修课表更大，但这是同一数据隔离边界；验证必须证明上传路径和数据库都落在当前工作区。
- AI 精简协议减少输出量但不能保证第三方网关延迟；不为性能测试额外消耗真实 OCR/AI 额度，先用 mock 验证协议，最终由一次真实用户导入记录耗时。
- 座位图采用 stale-while-revalidate；后台刷新失败时保留旧布局并显示错误，不用白屏代替状态。
- 图谱不保留旧静态文件；缺失 chunk 必须可解释、可刷新恢复，且绝不能以 200 HTML 冒充 JS。
- 验证包括 TypeScript、课表/班级/隔离测试、生产构建、缺失 chunk 响应、1440×900 与 390×844 页面闭环。只使用临时工作区和数据副本，不写权威数据。

## 6. 明确不做

- 不修改 SQLite 结构或权威数据；
- 不保留旧构建文件或永久兼容分支；
- 不写死任何班级名称；
- 不取消 AI 对 OCR 噪声的必要整理；
- 不引入微服务、任务队列、React Query 或 Service Worker；
- 未经另行授权，不推送、创建 PR、合并或部署。

## 7. 修改历史

| 版本 | 日期 | 概要 |
| --- | --- | --- |
| v1.0 | 2026-09-10 | 根据线上日志、真实工作区只读数据、请求耗时和静态资源响应完成根因调查；批准上传隔离、课表协议、座位状态保留和图谱加载恢复方案。 |
