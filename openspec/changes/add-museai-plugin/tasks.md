## 1. 仓库骨架与构建

- [x] 1.1 初始化 `dsh-museai-tavern` 包：package.json（name `@yejiming/dsh-museai-tavern`、type module、exports 映射 `./routes`/`./client`/`./src/*`、`dsh.bundle.patch`→cordis.patch.yml、`dsh.client.inject` 三件套、`dsh.client.platform: web`、peer 依赖与 devDependencies 对齐 dsh 0.1.0-rc.6）
- [x] 1.2 编写 cordis.patch.yml：宿主行 `museai`（@yejiming/dsh-museai-tavern）+ 路由行 `museai-routes`（同包 /routes 子路径）
- [x] 1.3 编写 tsdown.config.ts：node half（entry index/routes，esm）+ browser half（CJS closure-factory，`window.__ModuleLoader__.load`，平台模块 external，CSS Modules 内联），outputOptions banner/footer/intro 照抄 dsh-data-agent
- [x] 1.4 空实现双半体（src/index.ts、src/routes.ts、src/client/index.ts 最小 apply）并跑通 `pnpm build` 产出 lib/
- [x] 1.5 `dsh plugin --profile demo add .` 安装验证：dump-config 出现 museai 层、lib/client.js 被装载、浏览器无报错

## 2. 视图标签（museai-view-tab）

- [x] 2.1 浏览器半体入口：`ctx.effect` 注册 `museai` locale 字典（zh/en），`ctx.inject(['slots','locale','sessions'])` 内 `slots.inject('conversation.view', ...)` 注册 `{name:'conversation.view', id:'museai', order:15, label, locale, inject}`（order 15 > 轨迹 10、< gomoku 20）
- [x] 2.2 `MuseAISessionView` 外壳组件：接收框架标准 props（sessionId/useSession/useSessions），渲染五页内部导航（背景/聊天/冒险/羁绊/设置）+ 内容区，容器撑满会话面板、内部滚动
- [x] 2.3 标签与页面级联测试：Web GUI 中「轨迹」右侧出现 MuseAI 标签、切换会话不丢失视图状态、插件卸载后标签消失

## 3. 模型桥（museai-model-bridge）

- [x] 3.1 宿主行 `museai`：配置 schema（流式超时、输出上限等默认值，无凭据字段）、提供 `museaiSettings` 服务与存储域打开（见 §4）
- [x] 3.2 路由行 `museai-routes`：`ctx.webServer.register({kind:'prefix', path:'/plugins/museai'})`，嵌套 inject 等待 webServer（headless 不激活）；服务端注入 `['webServer','llm','agentDefaultModel']`
- [x] 3.3 `GET /plugins/museai/models`：遍历 `ctx.llm.listProviders()` × `listModels()` 输出 `{groups, failures, defaultSelection}`（defaultSelection 取 `ctx.agentDefaultModel.currentSelection()`；dsh-gomoku 同款，失败 provider 进 failures）
- [x] 3.4 `POST /plugins/museai/chat`：请求体校验（provider/model/system/messages/temperature/maxTokens/thinkingDepth；`followDefault: true` 时服务端实时解析 DSH 默认选择）→ `resolveModelInfo` 校验 thinkingDepth → `ctx.llm.stream` + `BlockAssembler` → NDJSON 流（start/delta/thinking_delta/done/error/aborted），客户端断开中止底层流
- [x] 3.5 非流式辅助调用面：`POST /plugins/museai/complete`（一次调用返回完整文本/JSON），覆盖 MuseAI 原 `summarize_text`（会话标题，≤15 字）、`analyze_character_memory`（封存记忆）、`convert_character_card_to_silly_tavern`（SillyTavern 转换，temp 0.0）、`optimize_character_memories`（记忆浓缩）；请求形状照搬第 4 节非流式 body（provider/model/system/messages/temperature/maxTokens/thinkingDepth）
- [x] 3.6 设置页模型选择器（配合 §9 设置页）：provider/model 级联 Select + 「跟随 DSH 默认模型」选项，数据来自 /models，空目录空态引导，仅持久化 `{provider, model}` 或 `followDefault`
- [x] 3.7 模型桥测试：目录接口（含失败 provider）、流式成功/错误/取消三类终态、非法请求体拒绝、配置无凭据断言；采样参数映射断言（temperature/maxTokens/thinkingDepth 透传，frequencyPenalty/presencePenalty/topP 忽略）

## 4. 数据域（museai-data）

- [x] 4.1 宿主行用 `ctx.storageDomain` 打开 `museai` 域：`defineDomain` zod schemas（settings、partners、stylePresets、chatSessions、storySessions 等记录），失败降级内存存储 + 告警
- [x] 4.2 数据读写路由：`GET/PUT /plugins/museai/store/<key>`（key 白名单 + zod 校验，非法拒绝）
- [x] 4.3 会话路由：`GET /plugins/museai/sessions/<kind>`（list，kind=partner|story）、`GET/PUT/DELETE /plugins/museai/sessions/<kind>/<id>`（load/save/delete）+ 标题更新，替代 Rust `list/save/load/delete/update_agent_session`（保留 characterCardId/characterCardIds/sessionKind 元数据）
- [x] 4.4 客户端同步中间件：zustand persist 替代 diskStorage —— 挂载时 GET 水合、变更后 PUT 写回，服务端不可用时回退 localStorage
- [x] 4.5 逐 store 接入：useSettingsStore / usePartnerStore / usePartnerChatStore / useStoryStore / useStylePresetStore 等（config 文件名与 localStorage 键按调研表映射），聊天/冒险会话 CRUD 走会话路由
- [x] 4.6 数据一致性：删除角色卡后聊天/羁绊引用清理、共享实体同源，浏览器环境全读写无 Tauri

## 5. 背景页移植（museai-pages）

- [x] 5.1 移植基础层：zustand stores（usePartnerStore 全量、useStylePresetStore）、utils（characterCardGroups 保留、reducerState、collectionSelection 等）、组件（StylePresetManager/Editor/Selector、SillyTavernExportPreviewModal）
- [x] 5.2 移植背景页主体：世界书/角色卡增删改查与字段编辑（renderWorldBookForm/renderCharacterCardForm 两张表单）、按世界书分组的角色卡目录树（characterCardGroups 保留）、JSON 导入、导出（世界书批量导出改浏览器 Blob 下载，替代 `export_json_files_to_downloads`；角色卡 MuseAI/SillyTavern 双格式导出）、SillyTavern 转换（`convert_character_card_to_silly_tavern` → /complete）+ 预览 Modal、记忆浓缩（`optimize_character_memories` → /complete）、删除世界书 Modal（仅删/连带删）
- [x] 5.3 排除 AI 智能提取：移除 `backgroundExtraction` 批处理/提取模式/步骤向导/角色名切分/提取状态回显相关 import 与 JSX；删除 `runCharacterExtractionBatch` 及 `generate_background_*`/`cancel_background_task` Tauri 调用；世界书自动分组逻辑剔除，手工分组保留
- [x] 5.4 背景页验收：提取入口不存在、世界书/角色卡 CRUD 持久化、SillyTavern 导出预览、风格预设被聊天/冒险消费

## 6. 聊天页移植（museai-pages）

- [x] 6.1 移植聊天基础层：usePartnerChatStore、useAgentStore（会话/消息/思考块/工具条目结构）、utils（sessionIds、sessionTitle、contextCompaction、archiveAnalysis、sessionHistory、renderKeys）、组件（SessionHistoryModal、SaveChoiceModal、PartnerChatSettingsModal）
- [x] 6.2 移植聊天页主体：角色卡选择、会话管理（新建/历史/标题编辑）、流式对话 UI（Markdown + Thinking 折叠 + 停止）、风格预设选择、上下文压缩提示
- [x] 6.3 替换流式通道：`start_chat_completion_stream`（agentId partnerChat、allowedTools:[]、请求体含 agentConfigs 采样字段 + compileEffectiveSystemPrompt 结果）→ POST /plugins/museai/chat；`stop_chat_stream` → abort；`summarize_text`（标题）→ /complete；`analyze_character_memory`（封存记忆，prompt `chatArchivePrompt`）→ /complete；`listen('agent-chat-stream')` → fetch NDJSON 事件（start/delta/thinking_delta/done/error/aborted）；会话 CRUD → §4.3 会话路由
- [x] 6.4 聊天页验收：与角色流式对话、会话历史切换、停止生成、封存记忆回显、上下文用量圆环

## 7. 冒险页移植（museai-pages）

- [x] 7.1 移植冒险基础层：useStoryStore、useBookTravelStore、storyAgent.ts（提示词编译/消息构建/角色名解析）、组件（BookTravelStatusHud 等冒险相关）
- [x] 7.2 移植冒险页主体：故事会话管理、动态角色加载开关（storyAgent/storyDynamicAgent 双配置）、世界书选择 + 多角色卡 checkable Tree（勾选世界书自动带出角色卡）、风格预设、三种输入模式（speech/behavior/plot）、流式故事生成 + `[[TOOL:id]]` role_play 特殊气泡 + `<choices>` 候选按钮、多角色卡封存记忆（prompt `storyArchivePrompt`）、会话保存（sessionKind story）
- [x] 7.3 替换流式通道与保存链路：请求体照搬（rolePlayContext 拼入 system，allowedTools 忽略）；故事会话落 §4.3 会话路由
- [x] 7.4 冒险页验收：故事生成/历史回放/继续冒险/候选选项/封存记忆

## 8. 羁绊页移植（museai-pages）

- [x] 8.1 移植羁绊页：角色头 + 身份标签、关系概览卡片（关系类型/相处模式/关系底线）、羁绊时间线（parseKeyEvents 按行解析 keyEvents）、SessionHistory（按 characterCardId 过滤 partner 会话）、AdventureHistory（按 characterCardIds 过滤 story 会话）；数据源与伙伴 store 同源，会话读取走 §4.3 路由
- [x] 8.2 羁绊页验收：选中角色展示概览与时间线、关联会话展开正常、与聊天页选中角色双向同步

## 9. 设置页移植（museai-pages）

- [x] 9.1 移植设置页主体（模型区域除外）：AgentSettingCard 网格（writer/workSummary/outline*/detector/remover/partnerChat/storyAgent/storyDynamicAgent/chatArchive/storyArchive/background*/sillyTavernExporter/bookTravel* 等，含并发卡）、全部系统提示词编辑/重置（default 常量逐字复制，行号清单见调研报告）、Agent 采样参数编辑（temperature/maxOutputTokens/maxContextTokens/thinkingDepth/compactionTurnThreshold/frequencyPenalty/presencePenalty/topP）；「局域网访问」区跳过
- [x] 9.2 替换模型区域：删除 MODEL_PROVIDER_PRESETS/baseUrl/apiKey/测试连接全部控件与逻辑（addModel/updateModel/deleteModel/selectModel/test_llm_connection），接入 §3.6 的 DSH 模型选择器；「当前使用模型」行改为 DSH provider/model 级联选择并持久化
- [x] 9.3 设置页验收：提示词编辑生效并重置为原文、Agent 参数随生成请求生效、无任何 API 配置面

## 10. 测试、文档与发布

- [x] 10.1 单元测试：移植的 utils（sessionTitle、contextCompaction、archiveAnalysis、characterCardGroups、stylePresets、sessionIds 等）+ 服务端路由（models/chat/complete/store/sessions 读写与校验）
- [x] 10.2 端到端冒烟：`dsh --profile demo add .` → Web GUI 验证标签、五页交互、模型选择、流式对话、重启后数据恢复
- [x] 10.3 README（中英）：功能、安装、配置、与 MuseAI 的差异（AI 提取排除、无 API 配置、直连流式替代工具循环）、架构图
- [x] 10.4 发布准备：lib/ 产物提交、package.json files 字段、npm publish（或 git 安装路径）
