# MuseAI Tavern · DeepSeek Harness 的 MuseAI 标签

[English](README.en.md) | **中文**

在 DeepSeek Harness 的会话标签栏「轨迹」右侧，新增一个 **MuseAI** 标签，把 MuseAI 桌面的五个页面（背景 / 聊天 / 冒险 / 羁绊 / 设置）搬进 DSH Web GUI，并让所有模型调用复用 DSH 已配置的模型 —— **不需要任何额外的 API / 密钥配置**。

![MuseAI 标签](assets/tab.png)

## 主要功能

- **MuseAI 会话视图标签**：注册于 `conversation.view` 插槽（order 15，位于「轨迹」order 10 右侧），点击后整个会话面板渲染 MuseAI 视图；标签内五页导航（背景/聊天/冒险/羁绊/设置）。
- **背景页**（不含 AI 智能提取世界书/角色卡）：世界书 / 角色卡手动管理（自定义字段、按世界书分组的角色卡目录）、JSON 导入导出、MuseAI / SillyTavern 双格式导出与 SillyTavern 转换预览、文风预设、记忆 AI 浓缩、删除世界书（仅删/连带删）。
- **聊天页**：伴侣对谈。绑定世界书 + 角色卡，流式对话（Markdown + Thinking 折叠 + 停止生成）、会话历史/标题编辑、文风预设、封存记忆、上下文用量圆环。
- **冒险页**：文字冒险 / GM 跑团。世界书 + 多角色卡选择（勾选世界书自动带出角色卡）、动态角色加载、三种输入模式、流式故事 + `[[TOOL]]` 特殊气泡 + `<choices>` 候选选项、多角色卡封存记忆、会话保存。
- **羁绊页**：角色关系概览、羁绊时间线、关联的聊天/冒险会话展示。
- **设置页**：全部系统提示词（逐字复制 MuseAI 默认值，可编辑/重置）与 Agent 采样参数（temperature / maxOutputTokens / maxContextTokens / thinkingDepth 等）；**模型区域为「DSH 模型选择」**：跟随 DSH 默认模型，或从 DSH 已配置的 provider/model 目录中挑选，无任何 baseUrl / API Key / 连接测试。
- **持久化**：数据（世界书、角色卡、会话、设置、风格预设）经插件服务端存储域落盘 `$DSH_HOME/storages/museai.json`（storage-domain json backend），浏览器 localStorage 仅作离线镜像；重启不丢。

## 快速安装

仓库已提交构建产物 `lib/`（不设 `prepare`/`prepack` 脚本），git、tarball 与本地目录安装都直接使用产物，无需在安装时构建。

```sh
# 从本地源码目录安装（开发）
dsh plugin --profile demo add .

# 从 git 安装
dsh plugin --profile demo add github:omdsh-dev/dsh-museai-tavern

# 从 npm 安装
dsh plugin --profile demo add @yejiming/dsh-museai-tavern
```

安装后验证：

```sh
dsh --profile demo --dump-config   # 输出中应出现 museai 与 museai-routes 行
```

启动 Web GUI：

```sh
dsh --profile demo
```

在 Web GUI 中：打开任意会话 → 标签栏「轨迹」右侧出现 **MuseAI** → 先到「设置」页确认模型（默认跟随 DSH 默认模型，或从目录中选择）→ 在「背景」页创建世界书/角色卡 → 「聊天」页与角色对话、「冒险」页跑团、「羁绊」页查看关系。

> 模型前提：DSH 中需已配置至少一个模型（provider/model），否则设置页显示空态引导，聊天/冒险请求返回错误提示。

## 架构

```text
浏览器 (apps/web)                         宿主进程 (dsh --profile demo)
┌─────────────────────────────┐          ┌──────────────────────────────────────┐
│ MuseAI 会话视图 (conversation│  fetch   │ @yejiming/dsh-museai-tavern (宿主行) │
│  .view, order 15)           │ ───────▶ │  · museaiStore 服务（存储域/内存）    │
│  · 背景 / 聊天 / 冒险 / 羁绊 │          │ @yejiming/dsh-museai-tavern/routes    │
│  · 设置（DSH 模型选择器）    │          │  · /plugins/museai/models|chat|       │
│  · zustand + syncStorage    │          │    complete|store/*|sessions/*        │
└─────────────────────────────┘          └──────────────┬───────────────────────┘
                                                       │ ctx.llm（DSH 模型）
                                                       ▼
                                              DeepSeek / 其他已配置适配器
```

一个 npm 包两个装载面、宿主两条行：

| 面 | 入口 | 装载位置 |
|---|---|---|
| 宿主行（存储服务/配置） | `lib/index.js`（行 `museai`） | 宿主组合：打开 `museai` 存储域（失败降级内存）、提供 `museaiStore`；headless 可用 |
| 路由行（模型桥/存储/会话） | `lib/routes.js`（行 `museai-routes`） | 宿主组合：webserver 存在时经嵌套 inject 注册 `/plugins/museai/*`；headless 自动跳过 |
| 浏览器半体（标签/页面） | `lib/client.js`（`dsh.client` 声明） | 浏览器：注册 MuseAI 标签与五页视图 |

## 配置

所有字段都有 loader 默认值；无库级默认值；**无任何凭据字段**。

| 键 | 说明 |
|---|---|
| `chatTimeoutMs` | 流式生成端到端超时（默认 120000 毫秒） |
| `completeTimeoutMs` | 非流式生成超时（默认 120000 毫秒） |
| `modelsTimeoutMs` | 模型目录查询超时（默认 10000 毫秒） |
| `maxCompleteChars` | 非流式输出捕获上限（默认 20000 字符） |

```yaml
# cordis.patch.yml 或 profile 层覆盖示例
- id: museai
  config:
    chatTimeoutMs: 180000
```

## HTTP 面（浏览器半体使用）

- `GET  /plugins/museai/models` — DSH 模型目录 `{groups, failures, defaultSelection}`
- `POST /plugins/museai/chat` — 流式生成（NDJSON：start/delta/thinking_delta/done/error/aborted）
- `POST /plugins/museai/complete` — 一次性生成 `{text, reasoning}`
- `GET/PUT /plugins/museai/store/<key>` — 一个 store 数据（settings/partners/partnerChat/story/stylePresets/agent）
- `GET /plugins/museai/sessions/<kind>` 与 `GET/PUT/DELETE .../sessions/<kind>/<id>` — 会话记录（kind=partner|story）

## 开发

```sh
pnpm install
pnpm build        # tsdown 双半体 + 类型声明
pnpm typecheck    # 服务端类型检查（客户端见下）
npx tsc -p tsconfig.client.json --noEmit   # 客户端类型检查
pnpm test         # vitest（服务端路由/存储域 + 移植 utils）
```

## 许可

MIT
