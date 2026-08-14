# MuseAI 数据存储与持久化（museai-data）

## ADDED Requirements

### Requirement: 服务端数据域
插件宿主行 SHALL 通过 DSH 存储设施（`ctx.storageDomain`/`ctx.storage`）打开一个 `museai` 数据域，域记录 SHALL 覆盖 MuseAI 各 store 的数据：设置（模型选择、提示词、Agent 参数）、世界书/角色卡、聊天会话、冒险/故事会话、穿书会话、风格预设等。域 schema SHALL 用 zod 声明（`defineDomain`），记录按 store 分 key 存储。存储后端失败时插件 SHALL 降级为进程内存存储并记录告警，MUST NOT 阻断标签与聊天主链路。

#### Scenario: 数据落盘持久化
- **WHEN** 用户创建/修改世界书、角色卡、聊天或冒险会话后重启 DSH 并重新打开插件
- **THEN** 数据完整恢复，与重启前一致

#### Scenario: 存储后端不可用降级
- **WHEN** 存储域打开失败
- **THEN** 插件以内存存储继续工作（会话内可用），日志记录告警，页面不报错

### Requirement: 数据读写路由
插件路由 SHALL 提供数据读写面：`GET /plugins/museai/store/<key>` 全量读取一个 store 记录，`PUT /plugins/museai/store/<key>` 全量写回（write-through 到数据域，last-write-wins）。路由 MUST 校验请求体符合对应记录的 zod schema，非法数据 MUST 拒绝并返回错误。路由 MUST 仅接受插件自身数据域范围内的 key（白名单），杜绝任意键读写。

#### Scenario: 客户端写回
- **WHEN** 客户端 PUT 一个合法 store 记录
- **THEN** 数据写入数据域并持久化，后续 GET 返回新值

#### Scenario: 非法记录被拒
- **WHEN** 客户端 PUT 不符合 schema 的数据或白名单外 key
- **THEN** 请求被拒绝并返回明确错误，数据域不变

### Requirement: 客户端存储镜像
浏览器半体 SHALL 以 zustand 保持 MuseAI 原 store 结构与 actions（`useSettingsStore`、`usePartnerStore`、`usePartnerChatStore`、`useAgentStore`、`useStoryStore`、`useBookTravelStore`、`useStylePresetStore` 等），持久化中间件 SHALL 替代 MuseAI 的 Tauri diskStorage：挂载时经 `GET /plugins/museai/store/<key>` 拉取初始状态，状态变更后经 `PUT` 写回；无服务端可用时（如 headless 调试）SHALL 回退浏览器 localStorage。

#### Scenario: 初始加载
- **WHEN** 插件视图首次挂载
- **THEN** 各 store 从服务端拉取数据完成水合，页面直接展示既有数据

#### Scenario: 变更即持久化
- **WHEN** 用户在任意页面修改数据
- **THEN** 对应 store 记录写回服务端，刷新页面后数据仍在

### Requirement: 数据一致性约束
MuseAI 各 store 之间既有的一致性关系（如聊天/冒险会话引用角色卡 id、羁绊页读取同一伙伴数据源）MUST 在移植后保持：共享实体 MUST 使用同一份存储记录，删除实体后引用方 MUST 按 MuseAI 原逻辑处理（空态/清理）。

#### Scenario: 删除角色卡后关联页可用
- **WHEN** 用户删除一个被聊天/羁绊页引用的角色卡
- **THEN** 关联页面按原逻辑显示空态或清理引用，不抛错、不残留脏数据

### Requirement: 持久化不依赖 Tauri
所有数据读写 MUST 不调用 Tauri API；原 `diskStorage`（写 `<文档>/MuseAI/config/`）MUST 被替换，浏览器环境内即可完成全部读写。

#### Scenario: 纯浏览器环境可用
- **WHEN** 在无 Tauri 的浏览器中操作全部五个页面并刷新
- **THEN** 数据经插件路由/存储域恢复，全程无 Tauri 调用
