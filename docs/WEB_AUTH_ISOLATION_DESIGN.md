# DEMO Web 身份与工作区隔离设计

> 文档版本：`v1.0`  
> 日期：2026-09-07  
> 状态：第 2 切片已实施，待用户验收

## 1. 目标与安全边界

第一阶段是一位教师对应一个私有工作区。平台所有者只能邀请账号、查看账号状态和生成密码重置链接；普通业务 API 始终按当前登录账号的工作区解析，所有者不能通过管理接口读取另一位教师的班级、资料或批改内容。

公开端点只有前端页面、`/api/health/*`、Better Auth 登录/会话端点和一次性邀请注册。其余业务 API 均要求有效会话。应用不接受客户端传入磁盘根或工作区根。

## 2. 数据结构

```text
APP_DATA_ROOT/
├── system/
│   └── auth.sqlite
├── workspaces/
│   └── <workspace-id>/
│       ├── data/
│       │   ├── roster.sqlite
│       │   ├── resources.sqlite
│       │   ├── grading-*.json
│       │   └── parser-artifacts/
│       └── uploads/
└── backups/
```

`auth.sqlite` 保存 Better Auth 表和应用自己的 `app_workspaces`、`app_workspace_members`、`app_invitations`、`app_teacher_profiles`。邀请令牌使用 32 字节随机数，数据库只保存 SHA-256；默认 72 小时过期且一次使用。密码由 Better Auth 使用 scrypt 处理，应用不读取明文密码。

## 3. 请求数据流

```text
浏览器同源请求
  → 安全响应头 / request ID
  → Better Auth 会话 Cookie
  → user_id 查询 workspace membership
  → AsyncLocalStorage WorkspaceContext
  → 当前工作区 SQLite / JSON / uploads
  → 路径仍在工作区内校验
  → 返回业务数据或受保护文件
```

长任务在创建时继承明确的 `WorkspaceContext`；连接池按数据库绝对路径分开，JSON 内存缓存也按绝对路径分开。进程退出时关闭全部工作区数据库连接。

## 4. Web 安全约束

- 生产必须配置精确的 HTTPS `APP_URL` 和至少 32 字符的 `AUTH_SECRET`；
- 会话 Cookie 为 HttpOnly、SameSite=Lax，生产环境加 Secure；
- 业务修改请求必须具有精确 Origin、同源 Fetch Metadata 和 `x-demo-csrf: 1`；
- 不开放跨域业务 CORS；认证框架继续执行自己的 Origin/CSRF 校验；
- 登录、注册和密码重置限速；错误信息不区分账号是否存在；
- CSP 只允许同源脚本/连接，允许当前 KaTeX 内联样式、本地字体、同源 PDF object 和本地/Blob 图片；
- `/uploads` 不存在公网静态映射，文件只能经业务记录定位。

## 5. 账号操作

1. 本地脚本创建首个所有者邀请，或所有者在设置页创建教师邀请。
2. 教师打开链接，使用绑定邮箱、姓名和至少 12 字符密码注册。
3. 注册成功后产生新的空工作区；旧数据只存在于所有者候选工作区。
4. 管理员生成一次性密码重置链接，经 Agent Mail 人工发送；链接 30 分钟有效。
5. 退出后原受保护文件 URL 立即失去访问权限。

## 6. 已知取舍

- 当前是单 Node 实例、进程内工作区连接池，不支持多实例共享会话/任务。
- 管理员人工发送邀请和重置链接，避免把交互式 Agent Mail CLI 冒充事务邮件系统。
- JSON 状态已做到工作区隔离和原子落盘，但还不是具备事务队列的任务状态机。
- 资料库仍保留原 500 MiB 限制；本切片没有执行曾讨论但未批准的 80 MiB 调整。
- 公网可用性、自动开机、Tunnel 和中国大陆三网速度属于下一切片。

## 7. 修改历史

| 版本 | 日期 | 状态 | 修改概要 |
| --- | --- | --- | --- |
| v1.0 | 2026-09-07 | 当前 | 记录邀请认证、工作区物理隔离、文件授权、CSRF/CSP、管理员边界与已知取舍。 |
