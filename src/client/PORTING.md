# MuseAI → DSH 插件页面移植指南（PORTING GUIDE）

目标仓库：`/Users/yejiming/Desktop/OpenSource/dsh-museai-tavern`
源项目：`/Users/yejiming/Desktop/kittlabs/MuseAI`（React 19 + antd 6 + zustand 5；**DSH 平台 react 为 18**）

## 已就绪的基础层（直接 import，不要改动）

| 模块 | 说明 |
|---|---|
| `src/client/api.ts` | 模型桥/存储/会话的全部浏览器侧调用（见下） |
| `src/client/syncStorage.ts` | zustand 持久化（已接入全部 store） |
| `src/client/stores/*` | useSettingsStore（已去模型配置，含 `dshModelSelection`）、usePartnerStore、usePartnerChatStore、useStoryStore、useStylePresetStore、useAgentStore（类型） |
| `src/client/utils/*` | storyAgent、toolArguments、sessionIds、sessionTitle、contextCompaction、archiveAnalysis、sessionHistory（已去穿书函数）、renderKeys、reducerState、characterCardGroups、stylePresets、collectionSelection |
| `src/client/components/*` | PartnerChatSettingsModal、SessionHistoryModal、SaveChoiceModal、StylePresetSelector、StylePresetManager、StylePresetEditor、SillyTavernExportPreviewModal、SettingsConcurrencyCard（纯拷贝，无 Tauri） |

## Tauri API → 插件 API 映射（替换规则）

页面中所有 `import { invoke } from '@tauri-apps/api/core'`、`import { listen } from '@tauri-apps/api/event'` **必须删除**，改用 `src/client/api.ts`：

| 原 Tauri 调用 | 替换为 |
|---|---|
| `invoke('start_chat_completion_stream', { request })` + `listen('agent-chat-stream', ...)` | `streamChat(request, onEvent, abortSignal)` — `onEvent` 收到 `{event:'start'\|'delta'\|'thinking_delta'\|'done'\|'error'\|'aborted', ...}`；`done` 事件带 `text`/`reasoning`。请求体：`{ followDefault 或 provider+model, system, messages:[{role,content}], temperature?, maxTokens?, thinkingDepth? }` |
| `invoke('stop_chat_stream')` | 对 `streamChat` 传入的 `AbortController` 调 `abort()` |
| `invoke('summarize_text', ...)`（会话标题） | `complete({ followDefault 或 provider+model, system:'请使用用户输入的消息，总结用户意图，不超过15个字。', messages, temperature: 0.3, maxTokens: 128 })` → `.text` |
| `invoke('analyze_character_memory', ...)`（封存记忆） | `complete({ ..., system: settings.chatArchivePrompt 或 settings.storyArchivePrompt, temperature: agentConfig.temperature, maxTokens: agentConfig.maxOutputTokens })` → `.text` |
| `invoke('convert_character_card_to_silly_tavern', ...)` | `complete({ ..., system: settings.sillyTavernExporterPrompt, temperature: 0, maxTokens: agentConfig.maxOutputTokens })` → `.text`（解析 JSON） |
| `invoke('optimize_character_memories', ...)`（记忆浓缩） | `complete({ ..., system: 与 MuseAI 相同的提示词, temperature: 0, maxTokens: agentConfig.maxOutputTokens })` → `.text` |
| `invoke('list_agent_sessions', { prefix })` | `listSessions('partner' \| 'story')` → `SessionSummaryWire[]`（含 id/title/savedAt/characterCardId/characterCardIds/selectedWorldBookId/dynamicRoleLoadingEnabled/messageCount） |
| `invoke('save_agent_session', ...)` | `saveSession(kind, record)` |
| `invoke('load_agent_session', ...)` | `loadSession(kind, id)` |
| `invoke('delete_agent_session', ...)` | `deleteSession(kind, id)` |
| `invoke('update_agent_session_title', ...)` | `saveSession(kind, { ...record, title })` |
| `invoke('export_json_files_to_downloads', ...)` | 浏览器下载：`const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);` |
| `invoke('get_workspace_dir'/'list_dir'/'read_file')` | **仅背景页 AI 提取使用——提取功能整个删除，无需替换** |

## 模型选择（设置页/请求构造）

- 全局模型选择在 `useSettingsStore.getState().dshModelSelection`：`{ followDefault: true }` 或 `{ followDefault: false, provider, model }`。
- 所有生成请求把该选择作为 ModelTarget 传入（`streamChat`/`complete` 的第一个参数形状即此）。
- Agent 采样参数仍从 `settings.agentConfigs[agentId]` 读取：`temperature`/`maxOutputTokens`/`maxContextTokens`/`thinkingDepth` 透传；`frequencyPenalty`/`presencePenalty`/`topP` **忽略不传**（DSH 无对应面）。
- `maxContextTokens`：客户端在消息裁剪/压缩时使用（contextCompaction 工具已有该逻辑）。

## 页面具体要求

- **Background.tsx（背景页）**：删除全部「AI 智能提取」——`runCharacterExtractionBatch`/`BackgroundExtractionMode`/`CharacterExtractionItem`/`splitCharacterNames`（utils/backgroundExtraction 不移植）、`UNASSIGNED_CHARACTER_CARD_GROUP_ID` 与 `groupCharacterCardsByWorldBook` 的提取路径、提取状态/refs/函数（loadWorkspaceFiles、handleOpenAiModal、readSelectedReferenceText、currentWorldBookDraft、waitForBackgroundCancellation、runCharacterExtraction、handleStartExtraction、handleConfirmReview、handleAiModalOk、handleContinueExtraction、handleRetryFailed、aiModalOkText）、AI 提取 Modal JSX、`settings.agentConfigs.backgroundExtraction` 与 `backgroundWorldBook`/`backgroundCharacterCard` 的读取。**保留**：世界书/角色卡 CRUD 与字段表单、`groupCharacterCardsByWorldBook` 手工分组目录树、文风预设、导入导出（JSON 导入、世界书批量导出→浏览器下载、角色卡 MuseAI/SillyTavern 双格式导出、SillyTavern 转换→complete + 预览 Modal）、记忆浓缩→complete、删除世界书 Modal。`exportPartnerItem(s)` 等 store 导出方法保留。
- **Chat.tsx（聊天页）**：照原样移植（`agentId:'partnerChat'`、allowedTools 忽略），流式通道按映射替换；标题/封存走 complete；会话 CRUD 走 sessions 路由；`context_compacted` 事件不再出现（上下文压缩摘要改走 complete 后本地更新）。
- **Adventure.tsx（冒险页）**：照原样移植；**删除** `useBookTravelStore` 的 import 与 `useBookTravelStore.getState().resetSession()`（523 行附近）；`[[TOOL:id]]`/`role_play` 气泡与 `<choices>` 候选渲染保留（输出文本直接解析）；storyAgent.ts 已移植到 utils。
- **Bond.tsx（羁绊页）**：照原样移植，会话读取走 `listSessions`/`loadSession`（partner/story 两种 kind）。
- **Settings.tsx（设置页）**：删除模型配置区全部（MODEL_PROVIDER_PRESETS、modelInterfaceOptions、模型选择行、添加/编辑/删除模型 Modal、测试连接、`settings.models/selectedModelId/addModel/updateModel/deleteModel/selectModel/test_llm_connection`）；**新增「DSH 模型选择」卡片**：调用 `fetchModels()` 拿 `{groups, failures, defaultSelection}`，渲染 provider Select → model Select 级联 + 「跟随 DSH 默认模型」选项（默认选中，数据来自 defaultSelection），保存调 `useSettingsStore.getState().setDshModelSelection(...)`；空目录渲染空态提示（引导去 DSH 设置配置模型）。「局域网访问」区删除。Agent 配置区（AgentSettingCard 网格、全部提示词编辑/重置、并发卡）照原样保留。

## 硬性约束

1. 不要改动 `src/client/stores/`、`src/client/utils/`、`src/client/components/`、`src/client/api.ts`、`src/client/syncStorage.ts`（除非发现 bug，且需在报告里说明）。
2. 页面组件签名：导出 `BackgroundPage`/`ChatPage`/`AdventurePage`/`BondPage`/`SettingsPage`（React FC，无 props），供 `src/client/MuseAIView.tsx` 使用。
3. 类型：TS strict；不要用 `any` 逃避（必要时用精确的局部类型）；React 18 兼容（不要用 React 19 专属 API）。
4. 样式：沿用 MuseAI 内联样式与 antd 组件；不要引入新的全局 CSS 文件。
5. 完成后运行 `npx tsc -p tsconfig.client.json --noEmit` 确认无错误（在仓库根目录）。
