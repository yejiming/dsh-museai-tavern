/**
 * MuseAI 设置页（移植自 MuseAI Settings.tsx）。
 *
 * 模型配置区已整体移除，替换为「DSH 模型选择」卡片：模型由 DeepSeek Harness
 * 统一管理与鉴权，页面只从 /plugins/museai/models 读取目录并让用户选择
 * 「跟随 DSH 默认模型」或指定 provider/model，不出现任何 API Key / Base URL /
 * 接口类型控件。「局域网访问」区一并删除。Agent 配置区（AgentSettingCard 网格、
 * 提示词编辑/重置、并发卡）照原样保留。
 *
 * @module @yejiming/dsh-museai-tavern/client/pages/Settings
 */
import React from 'react';
export declare const SettingsPage: React.FC;
