# MuseAI 模型桥（museai-model-bridge）

## ADDED Requirements

### Requirement: DSH 模型目录查询
插件服务端路由 SHALL 提供模型目录接口：遍历宿主 `ctx.llm.listProviders()`，对每个 provider 调用 `ctx.llm.listModels(provider.id)`，返回 `{ groups: [{ provider, displayName, models: [{ id, name }] }], failures: [{ provider, error }], defaultSelection: { provider, model, reasoningEffort? } | null }`。`defaultSelection` MUST 取自宿主 `agentDefaultModel.currentSelection()`（DSH 当前默认模型）。单个 provider 查询失败 MUST 记录到 `failures` 而不中断整体响应。接口路径 MUST 位于插件自有前缀下（`/plugins/museai/models`），经 webserver 服务注册，无 webserver 的 headless 环境 MUST 不激活（路由行整体不挂载）。

#### Scenario: 目录返回 DSH 已配置模型
- **WHEN** 客户端 GET /plugins/museai/models
- **THEN** 返回 DSH 全部可用 provider 及其模型列表并附 defaultSelection；查询失败的 provider 出现在 failures 中

#### Scenario: 无模型时返回空目录
- **WHEN** DSH 未配置任何模型
- **THEN** 接口返回空 groups 且不报错，客户端据此渲染引导空态

### Requirement: 流式生成接口
插件服务端路由 SHALL 提供流式生成接口（`POST /plugins/museai/chat`）：请求体携带 `provider`、`model`、`system`、`messages` 及可选 `temperature`/`maxTokens`/`thinkingDepth`；服务端 MUST 经 `ctx.llm.stream` 调用 DSH 配置的模型（绝不接受/存储任何 baseUrl、API Key 或接口类型字段），并用 `BlockAssembler` 组装输出，以 MuseAI 事件协议（`start`、`delta`、`thinking_delta`、`done`、`error`、`aborted`）的 NDJSON 流回浏览器。`thinkingDepth` MUST 先经 `resolveModelInfo` 校验该模型支持该 effort，不支持则回落模型默认。请求取消（客户端断开）MUST 中止底层流并终态 `aborted`。

#### Scenario: 流式对话成功
- **WHEN** 客户端以 DSH 中已配置的 provider/model 发起对话请求
- **THEN** 浏览器收到 start → 若干 delta/thinking_delta → done 事件流，最终消息完整

#### Scenario: 模型不可用时报错
- **WHEN** provider/model 无效或底层调用失败
- **THEN** 浏览器收到 error 事件，错误信息来自 DSH 原始错误，不涉及任何插件自有密钥配置

#### Scenario: 取消生成
- **WHEN** 用户在生成中点击停止（客户端 abort）
- **THEN** 服务端中止底层流，浏览器收到 aborted 终态，部分输出被丢弃

### Requirement: 非流式辅助调用
对于会话标题生成、存档分析、记忆浓缩等 MuseAI 原有「非流式」用途，服务端 SHALL 提供对应的非流式调用面（同一 `ctx.llm` 通道，一次调用返回完整文本或 JSON），客户端不直接访问任何模型端点。

#### Scenario: 存档分析
- **WHEN** 客户端请求对某会话做存档分析
- **THEN** 服务端经 DSH 模型完成分析并以结构化结果返回，客户端回显

### Requirement: 设置页模型选择器
设置页模型区域 SHALL 渲染为「DSH 模型目录」选择器：provider 下拉（数据来自 /models）→ model 下拉（随 provider 联动），并 SHALL 提供「跟随 DSH 默认模型」选项（使用 `defaultSelection`，随用户在 DSH 中的默认模型切换自动跟随）。选择结果保存为插件设置并按 Agent 可独立指定模型（沿用 MuseAI 按 Agent 配置模型的既有交互）。选择器 MUST NOT 渲染 baseUrl、API Key、接口类型、连接测试等任何自有 API 配置控件；保存选择 MUST 仅持久化 `{ provider, model }`（或 `followDefault: true`）标识。

#### Scenario: 选择 DSH 模型
- **WHEN** 用户在设置页从 provider/model 级联下拉中选择并保存，或选择「跟随 DSH 默认模型」
- **THEN** 该选择被持久化，聊天/冒险等页面后续生成使用对应 provider/model（跟随模式实时解析 DSH 默认选择）

#### Scenario: 目录为空引导
- **WHEN** /models 返回空目录
- **THEN** 选择器显示空态提示（引导用户先在 DSH 中配置模型），不提供任何手动 API 配置入口

### Requirement: 配置与安全
插件配置 schema（宿主行）SHALL 仅含与 DSH 部署相关的默认值（如流式超时、输出上限等），MUST NOT 包含任何凭据字段；所有模型请求 MUST 复用 DSH 的模型配置与鉴权，插件自身不接触密钥。

#### Scenario: 配置无凭据
- **WHEN** 部署方查看插件配置 schema 或 dump-config
- **THEN** 配置中不存在 apiKey/secret/token 等字段
