## Context

MuseAI 是独立 Tauri 桌面应用（React + antd + zustand，LLM 调用走 Rust 后端），提供网文创作五件套：背景（世界书/角色卡）、聊天（角色扮演对话）、冒险（故事 Agent）、羁绊（关系梳理）、设置（模型/提示词）。用户希望把它作为 DeepSeek Harness 的一个插件标签使用，且**不再维护第二套 API 配置** —— 所有模型调用复用 DSH 已配置的模型。

参考插件 dsh-data-agent（`@yejiming/dsh-data-agent`）提供了完整范式：

- 单 npm 包多装载面：宿主行（cordis.patch.yml 插入）+ HTTP 路由行（`data-agent-routes`，仅 webserver 存在时激活）+ 浏览器半体（`package.json` 的 `dsh.client.inject`，closure-factory 产物经 `window.__ModuleLoader__.load` 装载）。
- 标签注册：`conversation.view` 插槽，`order: 15` 正好落在「轨迹」(order 10) 右侧、gomoku (order 20) 左侧（dsh-data-agent 旧版 Database 标签即此位；后改为 input.dock 内嵌工作台，本插件恢复标签形态）。
- 模型调用：宿主服务 `ctx.llm`（`listProviders()` / `listModels()` / `stream()` + `BlockAssembler`），dsh-gomoku 的 `/plugins/gomoku/*` 路由即此模式（GET /models 列目录、POST /move 流式生成）。

MuseAI 移植面约 1 万行 TSX（五页 + 十余个 store + utils/components + prompts），全部为纯前端 + Tauri invoke，无后端业务逻辑可复用（Rust 侧负责 LLM 代理与磁盘存储）。

## Goals / Non-Goals

**Goals:**
- DSH Web GUI 会话标签栏「轨迹」右侧出现 `MuseAI` 标签；点击后会话面板整体渲染 MuseAI 视图。
- 背景页（不含 AI 智能提取世界书/角色卡）、聊天页、冒险页、羁绊页、设置页功能完整移植。
- 系统提示词、Agent 采样参数（temperature/maxTokens/thinkingDepth 等）逐字复制 MuseAI 默认值，可编辑、可重置。
- 设置页模型选择 = 从 DSH 模型目录挑选（provider + model），零 API/密钥配置；所有生成走 `ctx.llm`。
- 数据（世界书、角色卡、聊天/冒险会话、羁绊、设置）持久化，跨浏览器重启不丢。

**Non-Goals:**
- 不移植 MuseAI 的作品/大纲/去AI味/范文/穿书材料等页面（用户只点名五页）。
- 不移植背景页的 AI 智能提取（`backgroundExtraction` 批处理、提取模式/步骤/角色名切分、世界书智能分组归类）。
- 不在插件内实现完整 Agent 工具循环（bash/read/write/… 的 Rust 式 tool loop）；MuseAI 的「工具事件」类功能改为普通 LLM 调用或客户端注入上下文实现。
- 不提供任何新的模型 provider 配置面（无 baseUrl/apiKey/连接测试）。
- 不改动 DSH 宿主源码；移动端（MuseAI MobileShell）不在范围。

## Decisions

### D1. 标签形态：`conversation.view` 插槽，order 15
与 dsh-data-agent 旧版 Database 标签完全一致：客户端 `apply()` 内 `ctx.effect(() => ctx.locale.register(...))` + `ctx.inject(['slots','locale','sessions'], scope => scope.slots.inject('conversation.view', () => scope.slots.register({ name:'conversation.view', id:'museai', order:15, label:() => t('tab.label'), locale:NS, inject:()=>({hooks:{sessions: sessionsSource}}) }, MuseAISessionView)))`。
- 插槽为 `session` scope：每个会话都有该标签；会话切换不卸载（view ring 由会话体 `only: <active id>` 渲染）。标签按 `priority`（默认 0）→ `order` 升序排列：chat=0、轨迹=10、本插件=15、gomoku=20；tab id 在 priority 0 须全局唯一（重复注册抛错）。标签栏仅在视图数 >1 时渲染（chat+轨迹+插件恒成立，无影响）。
- 视图组件仅接收框架标准 props（`sessionId` + `useSession`/`useProjection`/`useSessions`/`useWorkspaces`，经 `PropsRuntime<'conversation.view'>` 注入，`sessionId` 切勿自行传递）；MuseAI 数据不挂在会话上，标签内自管理。**标签切换会卸载重挂视图**（per-session scope 按会话 key 挂载）——因此所有状态必须走数据域/服务端或自持久化（本设计 D5 即此方案），不依赖组件内存态。
- 跨视图通道：`conversation.view` owner 提供 `inspect`/`onInspectDone`（Chat 的 Inspect 按钮投递），本插件暂不使用；陈旧持久化 view id 会自动回落 Chat（`resolveActiveView`），卸载标签不炸会话。
- **备选**：input.dock 内嵌（dsh-data-agent 现状）—— 与「新增标签栏」需求不符；`conversation.session` 整体替换 —— 会丢掉 DSH 原生会话能力，过重。均否决。

### D2. 包结构：三装载面 + 浏览器半体（照抄 dsh-data-agent 范式）
```
dsh-museai-tavern/
  package.json          # dsh.bundle.patch -> cordis.patch.yml；dsh.client.inject ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-conversation"]；platform web
  cordis.patch.yml      # 两行：museai（宿主行）、museai-routes（路由行）
  src/index.ts          # 宿主行：提供 museaiSettings 服务、存储域打开、配置 schema
  src/routes.ts         # 路由行：/plugins/museai/*（models、chat、store 读写）
  src/client/index.ts   # 浏览器半体：标签注册 + 字典
  src/client/MuseAIView.tsx  # 视图外壳（五页子导航）
  src/client/pages/{Background,Chat,Adventure,Bond,Settings}.tsx   # 移植页
  src/client/stores/*   # zustand（persist -> 服务端路由同步）
  src/client/utils/*    # 移植自 MuseAI（去 Tauri 化）
  src/client/components/*  # 移植组件（AgentChat、SessionHistoryModal、SaveChoiceModal、StylePreset* 等）
  tsdown.config.ts      # node half（index/routes）+ browser CJS closure bundle（平台模块 external、CSS module 内联）
```
构建产物提交 `lib/`（不设 prepare 脚本），git/tarball 安装无需构建 —— dsh-data-agent 已验证此路径。

### D3. 模型桥：服务端路由 + `ctx.llm`，无新配置面
- 服务端注入 `['webServer', 'llm', 'agentDefaultModel']`；`GET /plugins/museai/models`：遍历 `ctx.llm.listProviders()` × `ctx.llm.listModels(provider.id)` 返回 `{ groups:[{provider, displayName, models:[{id,name}]}], failures }`（dsh-gomoku 同款），并把 `ctx.agentDefaultModel.currentSelection()`（DSH 当前默认 provider/model/effort）标为 `defaultSelection`；失败 provider 进 failures 不中断。
- **「跟随 DSH 默认模型」选项**：设置页模型选择器提供两个层级 —— ①「跟随 DSH 默认模型」（`{provider, model} = agentDefaultModel.currentSelection()`，DSH 内置默认，随用户在 DSH 中切换自动跟随）；② 手动从目录选择任意 DSH 已配置 provider/model。两者都仅持久化 `{provider, model}` 标识（`followDefault: true` 表示层级 ①，请求时服务端实时解析）。
- `POST /plugins/museai/chat`：请求 `{ provider, model, system, messages, temperature?, maxTokens?, thinkingDepth? }` → `ctx.llm.stream({ provider, model, system, messages, maxTokens, signal, ...(effort) })` + `BlockAssembler`，把 `text`/`reasoning` 增量以 MuseAI 事件协议（`start/delta/thinking_delta/done/error`）NDJSON 流回浏览器；`thinkingDepth` 经 `resolveModelInfo` 校验 effort 存在才转发（gomoku 同款降级）。
- **采样参数映射**（MuseAI 请求体字段 → DSH）：`temperature`/`maxOutputTokens`/`thinkingDepth` 一一对应；`maxContextTokens`（上下文窗口）与 `compactionTurnThreshold` 由客户端在消息裁剪/压缩时自行消费；`frequencyPenalty`/`presencePenalty`/`topP` 在 DSH `LlmCallConfig`（provider/model/temperature/maxTokens/stop/reasoningEffort）中无对应面，**忽略**并让 DSH 适配器默认值生效（README 明示差异）。
- 浏览器侧只 `fetch` 路由；**无任何 baseUrl/apiKey 表单、无连接测试**（设置页该区块整体替换为 DSH 模型选择器：两列 Select（provider → model）级联，数据来自 /models）。
- 流式取消：请求带 `signal`，客户端 abort → 服务端 `AbortController` → `finish {kind:'aborted'}`。
- **备选**：浏览器直连 DSH 的 /v1/chat/completions —— 该面是会话专用且有鉴权细节，未公开为插件面；否决。

### D4. 聊天/冒险的「Agent」实现：直接流式 + 简化工具语义
MuseAI 的聊天/冒险页由 Rust 跑工具循环，UI 展示 `tool_start/tool_output/tool_end/todo_update/context_compacted` 事件。移植策略：
- 核心对话 = 服务端直连 `ctx.llm.stream`，事件协议保留 `start/delta/thinking_delta/done/error`（流式 Markdown、Thinking 折叠 UI 原样）。
- 原工具语义降级为普通 LLM 调用/客户端注入：角色卡/世界书内容由客户端在发请求前拼入 system prompt（数据本来就在插件存储里，无需文件工具）；「存档分析」「上下文压缩摘要」「会话标题生成」= 各一次非流式 JSON 调用；`tool_start/tool_end` 等事件不再产生。注：伴侣聊天（partnerChat）原配置 `allowedTools: []`（无工具），冒险页仅有 `role_play` 单一工具（输出 `[[TOOL:id]]` 标记 + `<choices>` 候选渲染为特殊气泡），降级影响面小、保真度高。
- **备选**：为 MuseAI 建 DSH agent 预设（dsh-data-agent 式）走真 agent loop —— 需要把 MuseAI 会话映射到 DSH 会话、处理双份历史，复杂度过高；列为未来方向（见 Open Questions）。

### D5. 数据持久化：`ctx.storageDomain` 服务端权威 + zustand 客户端镜像
- 宿主行用 `ctx.storageDomain` 打开一个 `museai` 域（zod record schemas），覆盖两类数据：① 各 store 状态（`settings`、`partners`、`stylePresets` 及聊天/冒险的持久化选择字段），对应 MuseAI diskStorage 的 10 个 config 文件（`settings-store`/`partner-store`/`partner-chat-store`/`story-store`/`style-preset-store` 等）；② **Agent 会话记录**（MuseAI 原 Rust 读写 `<文档>/MuseAI/agent-sessions/*.json`，`partner-session-*`/`story-session-*` 前缀，含 `characterCardId/characterCardIds/sessionKind` 元数据）→ 以会话 id 为 key 的 `chatSessions`/`storySessions` 记录，保留元数据供羁绊页按角色过滤。
- 客户端 zustand 保持 MuseAI 原 store 结构与 actions（移植成本最低），持久化中间件改为「挂载时 GET /plugins/museai/store/<key> 全量拉取；每次变更 PUT 整记录写回（write-through，last-write-wins）」，替代 Tauri diskStorage；会话 CRUD（list/load/save/delete/updateTitle）走同组路由（`GET/PUT/DELETE /plugins/museai/sessions/<kind>/<id>` + `GET /plugins/museai/sessions/<kind>`）。
- 单机单用户场景无需冲突合并；域事件 `domain/changed` 暂不跨进程同步（DSH 已知限制，接受）。
- **备选**：纯 localStorage（dsh-data-agent 连接配置做法）—— 实现最简但用户创作数据随浏览器存储丢失风险高；否决，但路由层保留 localStorage 兜底可选项（配置开关）。

### D6. 背景页排除面（精确界定）
移植 `Background.tsx`（2782 行）时删除「AI 智能提取」专属面（均以行号界定，摘自调研报告）：
- imports（29–35 行）：`runCharacterExtractionBatch`/`BackgroundExtractionMode`/`CharacterExtractionItem`/`splitCharacterNames`（utils/backgroundExtraction）、`UNASSIGNED_CHARACTER_CARD_GROUP_ID`/`groupCharacterCardsByWorldBook` 的**提取路径**；
- UI 状态（57–63 行）：`isAiModalOpen/selectedFilePaths/isGenerating/isCancellingBackground/extractionMode/extractionStep/manualCharacterNames/reviewWorldBook*/reviewCharacterNames/characterStatuses` 与提取专用 refs（280–283）；
- 提取函数（289–703 行）：`loadWorkspaceFiles/handleOpenAiModal/readSelectedReferenceText/currentWorldBookDraft/waitForBackgroundCancellation/runCharacterExtraction/handleStartExtraction/handleConfirmReview/handleAiModalOk/handleContinueExtraction/handleRetryFailed/aiModalOkText` 及对应 Tauri 调用（`generate_background_stage_one`/`generate_background_character_card`/`cancel_background_task`、提取用 `get_workspace_dir`/`list_dir`/`read_file`）；
- 提取 Modal JSX（2432–2688 行，setup/review/characters 三步骤）；设置项 `agentConfigs.backgroundExtraction` 并发与 `backgroundWorldBook/backgroundCharacterCard` 提示词区域随之移除（default 常量仍复制进设置页数据，作为存档）。
保留：世界书/角色卡手工 CRUD 与字段编辑（两张表单 renderWorldBookForm/renderCharacterCardForm）、`characterCardGroups` 手工分组目录树（Adventure/Bond 共用）、文风预设（StylePresetManager/Editor/Selector）、导入导出（JSON 包导入、世界书批量导出 `export_json_files_to_downloads` 替换为浏览器下载、角色卡导出格式选择、SillyTavern 转换 + 预览 Modal）、记忆 AI 浓缩（`optimize_character_memories` 走模型桥）、删除世界书 Modal（仅删/连带删）。逐项以「移除 import + 删除对应 JSX 分支」落地，测试断言提取入口不存在。

### D7. 本地化与视觉
- 字典走 `ctx.locale.register(NS, {zh, en})`（标签名「MuseAI」中英一致；页面文案沿用 MuseAI 中文原样，不强制全量英化 —— 与 MuseAI 一致以中文为主）。
- 样式沿用 MuseAI antd 主题与 CSS（App.css 关键样式搬入），不套 DSH 会话样式；视图容器高度自适应会话面板，`overflow:auto`。
- **前端依赖版本**：antd ^6、@ant-design/icons ^6、react-markdown ^10、remark-gfm ^4、zustand ^5 全部内联进浏览器 bundle（平台模块表不含它们，无版本冲突）；DSH 平台种子 react 为 18.x，antd 6 / react-markdown 10 均兼容 React 18（MuseAI 用 React 19，移植时如遇 JSX/类型差异按 18 调整）。@uiw/react-codemirror、echarts（仅作品页用）不引入。

## Risks / Trade-offs

- [MuseAI 页面体积大（五页约 1 万行）] → 按页拆任务、逐页移植并配冒烟验收；先骨架后填肉，每页一个提交。
- [工具语义降级改变体验（无真 tool loop）] → 聊天/冒险核心是对话流式输出，工具事件原本只是展示层；降级项全部用等价 LLM 调用补足；在 README 明示差异。
- [ctx.storageDomain 属 DSH 0.1.0-rc.6 较新面，行为未在第三方插件验证] → 宿主行以嵌套 inject 惰性挂载 + 失败降级到内存存储（进程内可用，日志告警），不阻塞标签/聊天主链路。
- [DSH 模型目录为空/无 provider 时聊天不可用] → 设置页空态引导（提示去 DSH 设置配置模型）；聊天错误以 DSH 原始错误文案展示。
- [antd 体积（浏览器半体 bundle 内联）] → 接受：与 DSH 自身 UI 栈隔离，避免版本冲突；bundle 体积在 README 记录。
- [NDJSON 流与 DSH 代理/缓冲兼容性] → 服务端 `flush` 每事件；错误经 finish 事件送达，不依赖 HTTP 状态码。

## Migration Plan

1. 初始化仓库骨架（package.json/cordis.patch.yml/tsdown/双半体空实现）→ 标签可显示空壳。
2. 模型桥路由 + 设置页模型选择器（最小闭环：选模型 → /models 验证）。
3. 按页移植：背景 → 聊天 → 冒险 → 羁绊 → 设置（设置页最后做全局联调）。
4. 数据域接入（storageDomain + 写回路由）逐 store 替换 diskStorage。
5. 单测（utils/stores）+ README（中英）+ 真机冒烟（`dsh --profile <p> add .` 后 Web GUI 验证标签/对话/持久化）。
- 回滚：插件为独立 npm 包，`dsh plugin remove` 即整体卸载；宿主零改动，无迁移负担。

## Open Questions

- 是否把「去AI味/大纲」等 MuseAI 其余页面作为后续增量（本变更明确不含）？
- MuseAI 聊天页的「存档分析」在无工具循环下的保真度是否满足（当前方案：纯 LLM JSON 调用）？
- 未来是否用 DSH agent 预设 + 真 agent loop 替换直连流式（体验对齐 MuseAI 工具事件）？
