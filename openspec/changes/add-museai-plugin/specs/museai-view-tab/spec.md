# MuseAI 会话视图标签（museai-view-tab）

## ADDED Requirements

### Requirement: MuseAI 标签注册于会话标签栏「轨迹」右侧
插件浏览器半体 SHALL 通过 `conversation.view` 插槽注册 `MuseAI` 视图标签，注册顺序 MUST 落在 DSH 会话标签栏中「轨迹」(Trajectory) 标签右侧：注册 order MUST 为 15（轨迹为 10）。标签文案 MUST 为 `MuseAI`（中英文一致），经插件自有 locale 字典提供。注册 MUST 挂在 slot 服务的 effect 包装内，插件卸载时标签 MUST 自动移除。

#### Scenario: 安装插件后标签可见
- **WHEN** 插件安装并打开任意 DSH 会话
- **THEN** 会话标签栏在「轨迹」右侧出现 `MuseAI` 标签，点击后会话面板切换为该视图

#### Scenario: 卸载插件后标签消失
- **WHEN** 用户卸载插件并刷新页面
- **THEN** 会话标签栏不再包含 `MuseAI` 标签，会话面板恢复正常渲染

### Requirement: MuseAI 视图按会话渲染且状态自持
`MuseAI` 视图组件 SHALL 接收框架会话标准 props（`sessionId` 等），其内部状态（页面、数据、正在进行的生成）MUST NOT 依赖 DSH 会话的消息/历史存储；不同会话切换时视图 MUST 保持可用并正确渲染各自数据。视图根容器 SHALL 撑满会话面板可视区域，内部滚动不污染面板布局。

#### Scenario: 会话切换后视图可用
- **WHEN** 用户在 MuseAI 视图激活时切换到另一个会话再切回
- **THEN** 视图重新渲染且数据不丢失，页面停留在切换前状态

### Requirement: 视图内五页导航
MuseAI 视图 SHALL 提供内部导航，包含五个页面入口：背景、聊天、冒险、羁绊、设置，任一时刻渲染其中一页，页面切换 MUST 不卸载其他页的持久化数据（仅 UI 挂载/卸载）。

#### Scenario: 五页均可访问
- **WHEN** 用户依次点击背景/聊天/冒险/羁绊/设置
- **THEN** 每页均渲染对应 MuseAI 页面内容，切换无报错

### Requirement: 标签与视图的本地化字典
插件 SHALL 注册 `museai` locale 命名空间并至少提供 `zh`、`en` 两套字典；标签文案与必要的界面文案 MUST 从字典读取，缺失键 MUST 回退为中文原文（与 MuseAI 一致）。

#### Scenario: 英文界面显示标签
- **WHEN** DSH 界面语言为英文
- **THEN** 标签仍显示 `MuseAI`，字典查询不抛错
