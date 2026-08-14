## Why

MuseAI（/Users/yejiming/Desktop/kittlabs/MuseAI）是一套面向创意写作的独立 Tauri 应用（背景/聊天/冒险/羁绊/设置），用户希望直接在 DeepSeek Harness 的 Web GUI 中使用这些能力，而无需在另一个应用里重复维护一套 API 配置。本变更参考 dsh-data-agent 的插件形态，把 MuseAI 的五个页面移植为 DSH 的一个会话视图标签，并让所有模型调用复用 DSH 自带的模型配置（不新增任何 API/密钥配置面）。

## What Changes

- **新增 MuseAI 会话视图标签**：在 DSH Web GUI 会话的标签栏中，于「轨迹」(Trajectory, order 10) 右侧注册 `MuseAI` 标签（复用 `conversation.view` 插槽，order 15，与 dsh-data-agent 旧版 Database 标签同序位），点击后整个会话面板渲染 MuseAI 视图。
- **移植五个页面**（以 MuseAI 桌面版为蓝本）：背景页、聊天页、冒险页、羁绊页、设置页，全部功能随页面一起移植（世界书/角色卡手动管理、导入导出、风格预设、聊天会话、冒险故事、羁绊树、设置等）。
  - **背景页明确排除**「AI 智能提取世界书、角色卡」功能（`backgroundExtraction` 批处理、提取模式/步骤、世界书分组智能归类等），保留其余全部功能。
- **系统提示词与模型设置复制 MuseAI**：`useSettingsStore` 中全部默认提示词（对话、背景、冒险、羁绊、去AI味、大纲、穿书等）与默认 Agent 配置（temperature/maxTokens/thinkingDepth 等）原样复制，可在设置页编辑并重置。
- **设置页模型改为「使用 DSH 的模型」**：不再提供 MuseAI 的 provider/baseUrl/apiKey 表单与连接测试；改为从 DSH 的模型目录（`ctx.llm` 服务）读取可用 provider/model 列表，用户为每个 Agent/页面选择 DSH 中已配置的模型。所有生成调用经插件服务端路由转发给 `ctx.llm.stream`，**不引入任何新的 API 配置**。
- **新插件包**：`@yejiming/dsh-museai-tavern`（服务端行 + HTTP 路由行 + 浏览器半体），按 dsh-data-agent 的打包/装载方式（cordis.patch.yml、`dsh.client` 声明、tsdown 双半体构建）发布。

## Capabilities

### New Capabilities
- `museai-view-tab`: MuseAI 会话视图标签的注册与渲染（`conversation.view` 插槽、order 15、中英文案、按会话渲染）。
- `museai-pages`: 五个移植页面（背景/聊天/冒险/羁绊/设置）及其子导航、数据模型与交互，含背景页排除 AI 智能提取的界定。
- `museai-model-bridge`: 插件服务端路由（模型目录查询 + 流式生成），全部经 DSH `ctx.llm` 服务，设置页模型选择器不包含任何 API/密钥配置。
- `museai-data`: 插件数据存储与持久化（世界书/角色卡、聊天记录、冒险/故事、羁绊、设置），替代 MuseAI 的 Tauri diskStorage。

### Modified Capabilities
（无 — 本仓库 `openspec/specs/` 尚无既有能力，全部为新增。）

## Impact

- **新仓库**：`dsh-museai-tavern`（当前工作目录），npm 包 `@yejiming/dsh-museai-tavern`，依赖 dsh 0.1.0-rc.6 生态（cordis、dsh-client-runtime、dsh-client-ui-conversation、dsh-client-ui-slots、dsh-llm、dsh-host-webserver 等 peer 依赖）。
- **DSH 侧零改动**：仅通过 cordis.patch.yml 宿主行 + 浏览器半体注入；标签、路由、服务均为插件自有。
- **被移植源码**：MuseAI `src/pages/{Background,Chat,Adventure,Bond,Settings}.tsx`、`src/stores/*`（zustand + persist）、`src/utils/*`、`src/components/*`、`prompts/prompts.md`；排除 Tauri 专用层（`invoke`、`listen`、diskStorage、Rust 命令），替换为 DSH 路由/浏览器存储。
- **新增依赖**：antd、@ant-design/icons、react-markdown、remark-gfm、zustand（浏览器半体 bundle 内联）；服务端不新增运行时依赖。
- **文档/验证**：README（中英）、单元测试（存储/工具函数）、端到端冒烟（Web GUI 内标签可见、模型选择与对话可用）。
