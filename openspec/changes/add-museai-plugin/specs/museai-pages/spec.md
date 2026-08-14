# MuseAI 五页移植（museai-pages）

## ADDED Requirements

### Requirement: 背景页移植（不含 AI 智能提取）
背景页 SHALL 移植 MuseAI `Background.tsx` 的全部功能，除下列明确排除项外：AI 智能提取世界书/角色卡（`backgroundExtraction` 批处理、提取模式/步骤 UI、角色名切分、提取状态回显）与基于提取的世界书自动分组 MUST NOT 出现。保留功能 SHALL 包括：世界书/角色卡的手动增删改查与自定义字段编辑、作品/大纲/参考目录树浏览、世界书与角色卡的导入导出、SillyTavern 导出预览、风格预设（管理器/选择器/编辑器）、备忘录与事件优化等 MuseAI 原页面其余功能。

#### Scenario: 背景页不含 AI 提取入口
- **WHEN** 用户打开背景页并检查页面 UI
- **THEN** 页面不存在「AI 提取」「智能提取」类按钮/弹窗/步骤向导，相关提取状态字段不渲染

#### Scenario: 世界书手动管理可用
- **WHEN** 用户在背景页新建/编辑/删除一个世界书条目并填写字段
- **THEN** 条目立即在列表中反映，字段持久化，刷新后仍在

#### Scenario: 角色卡管理可用
- **WHEN** 用户为角色卡填写角色信息字段并保存
- **THEN** 角色卡可在列表中查看/编辑/删除，可归入手动分组

#### Scenario: SillyTavern 导出预览可用
- **WHEN** 用户对世界书或角色卡触发 SillyTavern 导出
- **THEN** 弹出预览 Modal 展示导出 JSON，可确认导出

#### Scenario: 风格预设可用
- **WHEN** 用户创建/编辑/选择风格预设
- **THEN** 预设列表、编辑器与选择器正常工作，选择结果被聊天/冒险页消费

### Requirement: 聊天页移植
聊天页 SHALL 移植 MuseAI `Chat.tsx` 的核心交互：角色卡选择与会话管理（新建/历史/标题编辑）、与角色的流式对话（Markdown 渲染、Thinking 折叠展示、停止生成）、风格预设选择、会话存档与存档分析、上下文压缩提示、聊天设置弹窗。

#### Scenario: 与角色对话
- **WHEN** 用户在聊天页选择角色卡、输入消息并发送
- **THEN** 助手回复以流式 Markdown 渲染，生成可随时停止，消息追加到当前会话

#### Scenario: 会话历史管理
- **WHEN** 用户打开会话历史弹窗
- **THEN** 可查看历史会话列表、切换会话、编辑标题，切换后对话上下文随之切换

#### Scenario: 存档分析
- **WHEN** 用户对当前会话触发存档分析
- **THEN** 生成分析结果并回显（分析调用走模型桥，无独立 API 配置）

### Requirement: 冒险页移植
冒险页 SHALL 移植 MuseAI `Adventure.tsx` 的核心交互：故事会话管理（新建/历史）、动态角色加载开关、世界书/角色卡选择、风格预设、故事流式生成（含分支/存档选择等 MuseAI 冒险页既有交互）、穿书材料相关入口按 MuseAI 原页面呈现。

#### Scenario: 冒险故事生成
- **WHEN** 用户在冒险页选择角色与世界书、输入故事指令并开始
- **THEN** 故事内容流式生成并渲染，生成记录可保存为故事会话

#### Scenario: 冒险历史回放
- **WHEN** 用户打开冒险历史
- **THEN** 可查看历史冒险会话与完整记录，可继续或回顾

### Requirement: 羁绊页移植
羁绊页 SHALL 移植 MuseAI `Bond.tsx` 的交互：角色关系概览（自定义字段）、羁绊时间线（关键事件解析与展示）、关联聊天/冒险会话的展示与展开。

#### Scenario: 关系概览展示
- **WHEN** 用户选中一个角色
- **THEN** 页面展示其关系概览卡片与羁绊时间线

#### Scenario: 关联会话展开
- **WHEN** 用户展开某个关联会话/冒险记录
- **THEN** 记录内容完整展示，数据与聊天页/冒险页共享同一来源

### Requirement: 设置页移植（模型部分除外）
设置页 SHALL 移植 MuseAI `Settings.tsx` 除「模型服务商/接口/API Key/连接测试」外的全部设置项：全部默认系统提示词（对话、背景、冒险、羁绊、去AI味、大纲、穿书、存档等，逐字复制 MuseAI `useSettingsStore` 默认值）的查看/编辑/重置；各 Agent 采样参数（temperature、maxOutputTokens、maxContextTokens、topP、frequencyPenalty、presencePenalty、thinkingDepth、compactionTurnThreshold、concurrency）的编辑；模型选择区域 MUST 替换为「从 DSH 模型目录选择」的级联选择器（见 museai-model-bridge），MUST NOT 出现 baseUrl/API Key/连接测试等配置。

#### Scenario: 系统提示词编辑与重置
- **WHEN** 用户在设置页修改某 Agent 的系统提示词并保存，或点击重置
- **THEN** 修改持久化并在对应页面生效；重置恢复 MuseAI 默认原文

#### Scenario: Agent 参数生效
- **WHEN** 用户修改某 Agent 的 temperature/maxTokens/thinkingDepth 并保存
- **THEN** 该 Agent 后续生成请求携带新参数

#### Scenario: 无 API 配置面
- **WHEN** 用户浏览设置页模型区域
- **THEN** 页面只提供 DSH provider/model 选择，不渲染任何 baseUrl、API Key、接口类型或连接测试控件

### Requirement: 页面文案与交互一致性
五个页面 SHALL 保持 MuseAI 原版的中文文案、antd 组件风格与主要交互路径；Tauri 专用能力（`invoke`/`listen`/diskStorage）MUST 被替换为插件等价实现且不残留调用。

#### Scenario: 页面无 Tauri 残留
- **WHEN** 在无 Tauri 环境的浏览器中打开各页并执行主要操作
- **THEN** 页面不因调用 Tauri API 而报错，所有能力由插件路由/浏览器实现提供
