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
import {
  Form,
  Input,
  Button,
  InputNumber,
  Divider,
  Typography,
  Select,
  message,
  Anchor,
  Card,
  Switch,
  Empty,
} from 'antd';
import {
  SettingOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
  ClearOutlined,
  ProfileOutlined,
  GlobalOutlined,
  MessageOutlined,
  CompassOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { fetchModels } from '../api.ts';
import type { ModelsResponseWire } from '../api.ts';
import {
  useSettingsStore,
  defaultAgentConfigs,
  defaultSystemPrompt,
  defaultDeAiDetectorPrompt,
  defaultDeAiRemoverPrompt,
  defaultWorkSummaryPrompt,
  defaultOutlineCreationPrompt,
  defaultOutlineAssessmentPrompt,
  defaultReverseOutlineShortPrompt,
  defaultReverseOutlineLongSummaryPrompt,
  defaultReverseOutlineLongFinalPrompt,
  defaultPartnerChatPrompt,
  defaultBackgroundWorldBookPrompt,
  defaultBackgroundCharacterCardPrompt,
  defaultStoryAgentPrompt,
  defaultStoryDynamicAgentPrompt,
  defaultBookTravelMaterialAssemblerPrompt,
  defaultBookTravelEntryDirectorPrompt,
  defaultBookTravelPlotPlannerPrompt,
  defaultBookTravelSceneWriterPrompt,
  defaultBookTravelMemoryKeeperPrompt,
  defaultBookTravelEndingJudgePrompt,
  defaultChatArchivePrompt,
  defaultStoryArchivePrompt,
  defaultSillyTavernExporterPrompt,
} from '../stores/useSettingsStore';
import type { AgentConfig, DshModelSelection } from '../stores/useSettingsStore';
import { SettingsConcurrencyCard } from '../components/SettingsConcurrencyCard';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SETTINGS_SIDEBAR_STYLE: React.CSSProperties = {
  width: 180,
  padding: '40px 0 40px 24px',
  borderRight: '1px solid #eae6df',
  overflowY: 'auto',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

// thinkingDepth 选项（保留在 Agent 配置里；原 effortLevelOptions 已随模型配置删除）
const thinkingDepthOptions = [
  { id: 'off', label: '关闭' },
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' },
] as const;

// Reusable elegant configuration card for each Agent
interface AgentSettingCardProps {
  title: string;
  agentId: string;
  defaultPrompt: string;
  currentPrompt: string;
  onSavePrompt: (prompt: string) => void;
  onResetPrompt: () => void;
  helpText: string;
  showModelControls?: boolean;
}

interface AgentFormValues {
  temperature?: number;
  maxOutputTokens?: number;
  maxContextTokens?: number;
  thinkingDepth?: 'off' | 'low' | 'medium' | 'high';
  compactionTurnThreshold?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topP?: number;
  prompt: string;
}

interface BuildAgentFormValuesOptions {
  config: AgentConfig;
  defaultConfig: AgentConfig;
  prompt: string;
  supportsCompactionTurnThreshold: boolean;
  supportsSamplingControls: boolean;
}

const buildAgentFormValues = ({
  config,
  defaultConfig,
  prompt,
  supportsCompactionTurnThreshold,
  supportsSamplingControls,
}: BuildAgentFormValuesOptions): AgentFormValues => {
  const values: AgentFormValues = {
    temperature: config.temperature ?? defaultConfig.temperature ?? 0.3,
    maxOutputTokens: config.maxOutputTokens ?? defaultConfig.maxOutputTokens ?? 32000,
    maxContextTokens: config.maxContextTokens ?? defaultConfig.maxContextTokens ?? 200000,
    thinkingDepth: config.thinkingDepth ?? defaultConfig.thinkingDepth ?? 'off',
    prompt,
  };
  if (supportsCompactionTurnThreshold) {
    values.compactionTurnThreshold = config.compactionTurnThreshold ?? defaultConfig.compactionTurnThreshold ?? 20;
  }
  if (supportsSamplingControls) {
    values.frequencyPenalty = config.frequencyPenalty ?? defaultConfig.frequencyPenalty ?? 0.3;
    values.presencePenalty = config.presencePenalty ?? defaultConfig.presencePenalty ?? 0.2;
    values.topP = config.topP ?? defaultConfig.topP ?? 0.9;
  }
  return values;
};

const AgentSettingCard: React.FC<AgentSettingCardProps> = ({
  title,
  agentId,
  defaultPrompt,
  currentPrompt,
  onSavePrompt,
  onResetPrompt,
  helpText,
  showModelControls = true,
}) => {
  const store = useSettingsStore();
  const [form] = Form.useForm<AgentFormValues>();
  const defaultConfig = React.useMemo(() => defaultAgentConfigs[agentId] || {}, [agentId]);
  const agentConfig = store.agentConfigs?.[agentId] || defaultConfig;
  const supportsCompactionTurnThreshold = agentId === 'partnerChat' || agentId === 'storyAgent' || agentId === 'storyDynamicAgent';
  const supportsSamplingControls = supportsCompactionTurnThreshold;

  const initialFormValues = buildAgentFormValues({
    config: agentConfig,
    defaultConfig,
    prompt: currentPrompt,
    supportsCompactionTurnThreshold,
    supportsSamplingControls,
  });

  const handleSave = (values: AgentFormValues) => {
    if (showModelControls) {
      const nextConfig = {
        temperature: values.temperature,
        maxOutputTokens: values.maxOutputTokens,
        maxContextTokens: values.maxContextTokens,
        thinkingDepth: values.thinkingDepth,
        ...(supportsCompactionTurnThreshold ? { compactionTurnThreshold: values.compactionTurnThreshold ?? 20 } : {}),
        ...(supportsSamplingControls ? {
          frequencyPenalty: values.frequencyPenalty ?? 0.3,
          presencePenalty: values.presencePenalty ?? 0.2,
          topP: values.topP ?? 0.9,
        } : {}),
      };
      store.setAgentConfig(agentId, nextConfig);
    }
    onSavePrompt(values.prompt);
    message.success(`已保存 ${title} 配置`);
  };

  const handleReset = () => {
    const values = buildAgentFormValues({
      config: defaultConfig,
      defaultConfig,
      prompt: defaultPrompt,
      supportsCompactionTurnThreshold,
      supportsSamplingControls,
    });
    form.setFieldsValue(values);
    if (showModelControls) {
      const nextConfig = {
        temperature: defaultConfig.temperature,
        maxOutputTokens: defaultConfig.maxOutputTokens,
        maxContextTokens: defaultConfig.maxContextTokens,
        thinkingDepth: defaultConfig.thinkingDepth,
        ...(supportsCompactionTurnThreshold ? { compactionTurnThreshold: defaultConfig.compactionTurnThreshold ?? 20 } : {}),
        ...(supportsSamplingControls ? {
          frequencyPenalty: defaultConfig.frequencyPenalty ?? 0.3,
          presencePenalty: defaultConfig.presencePenalty ?? 0.2,
          topP: defaultConfig.topP ?? 0.9,
        } : {}),
      };
      store.setAgentConfig(agentId, nextConfig);
    }
    onResetPrompt();
    message.success(`已恢复 ${title} 默认配置`);
  };

  return (
    <Card
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #eae6df',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(217, 119, 87, 0.02)',
        marginBottom: '24px',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease'
      }}
      styles={{
        header: {
          borderBottom: '1px solid #f2eee8',
          padding: '16px 24px',
          fontWeight: 600
        },
        body: {
          padding: '24px'
        }
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#33312e' }}>
          <DeploymentUnitOutlined style={{ color: '#d97757' }} />
          <span>{title}</span>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialFormValues}
        onFinish={handleSave}
        requiredMark={false}
      >
        {showModelControls && (
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '16px',
                marginBottom: supportsCompactionTurnThreshold ? '16px' : 0
              }}
            >
              <Form.Item label="温度" name="temperature" style={{ marginBottom: 0 }}>
                <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="最大输出 Token" name="maxOutputTokens" style={{ marginBottom: 0 }}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="最大上下文 Token" name="maxContextTokens" style={{ marginBottom: 0 }}>
                <InputNumber min={1} step={1024} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="思考深度 (Depth)" name="thinkingDepth" style={{ marginBottom: 0 }}>
                <Select
                  style={{ width: '100%' }}
                  options={thinkingDepthOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
                />
              </Form.Item>
            </div>
            {supportsCompactionTurnThreshold && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '16px'
                }}
              >
              <Form.Item
                label="自动压缩轮数"
                name="compactionTurnThreshold"
                tooltip="MuseAI 内部上下文管理参数，OpenAI 接口和 Anthropic 接口都会使用。控制用户对话轮数超过多少后，后端自动压缩早期上下文；数值越大，保留原文越久，但 Token 成本更高。"
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={2} max={200} step={1} style={{ width: '100%' }} />
              </Form.Item>
                <Form.Item
                  label="频率惩罚"
                  name="frequencyPenalty"
                  tooltip="对应 OpenAI 的 frequency_penalty，适用于 OpenAI-compatible 接口，用来降低重复词句的概率。Anthropic 接口不支持，MuseAI 不会向 Anthropic 请求发送此参数。"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={-2} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="存在惩罚"
                  name="presencePenalty"
                  tooltip="对应 OpenAI 的 presence_penalty，适用于 OpenAI-compatible 接口，用来鼓励模型引入新内容、减少反复围绕旧话题。Anthropic 接口不支持，MuseAI 不会向 Anthropic 请求发送此参数。"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={-2} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="Top P"
                  name="topP"
                  tooltip="对应 OpenAI 的 top_p，适用于 OpenAI-compatible 接口，用来控制候选词概率范围。Anthropic 部分模型曾支持，但新 Opus 模型不支持非默认采样参数；MuseAI 不会向 Anthropic 请求发送此参数。"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            )}
          </div>
        )}

        <Form.Item
          label="系统提示词 (System Prompt)"
          name="prompt"
          help={<span style={{ color: '#8c8780', fontSize: '12px' }}>{helpText}</span>}
          style={{ marginBottom: '24px' }}
        >
          <TextArea
            rows={8}
            placeholder={`请输入 ${title} 的系统提示词...`}
            style={{
              resize: 'none',
              backgroundColor: '#faf9f5',
              border: '1px solid #eae6df',
              borderRadius: '8px',
              color: '#33312e',
              fontSize: '14px',
              fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace'
            }}
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button
            type="primary"
            htmlType="submit"
            style={{
              backgroundColor: '#d97757',
              borderColor: '#d97757',
              color: '#ffffff',
              fontWeight: 500,
              borderRadius: '6px'
            }}
          >
            保存配置
          </Button>
          <Button
            onClick={handleReset}
            style={{
              borderColor: '#eae6df',
              color: '#5c5751',
              borderRadius: '6px'
            }}
          >
            恢复默认
          </Button>
        </div>
      </Form>
    </Card>
  );
};

const useSettingsView = () => {
  const store = useSettingsStore();

  // ---- DSH 模型选择 ----
  // 模型目录（provider 分组 + 加载失败项 + Harness 默认模型）
  const [catalog, setCatalog] = React.useState<ModelsResponseWire | null>(null);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  // 「跟随 DSH 默认模型」开关，默认 true
  const [followDefault, setFollowDefault] = React.useState<boolean>(
    () => useSettingsStore.getState().dshModelSelection.followDefault,
  );
  // 手动选择模式下的 provider / model（跟随默认时为 ''，不渲染选择器）
  const [selectedProvider, setSelectedProvider] = React.useState<string>(() => {
    const selection = useSettingsStore.getState().dshModelSelection;
    return selection.followDefault ? '' : selection.provider;
  });
  const [selectedModel, setSelectedModel] = React.useState<string>(() => {
    const selection = useSettingsStore.getState().dshModelSelection;
    return selection.followDefault ? '' : selection.model;
  });

  React.useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        // 若 store 里保存的是显式选择且仍存在于目录中，则保持手动模式；
        // 否则回退到 Harness 默认模型或目录第一个可用模型。
        const selection = useSettingsStore.getState().dshModelSelection;
        if (!selection.followDefault) {
          const group = data.groups.find((g) => g.provider === selection.provider);
          const modelExists = group?.models.some((m) => m.id === selection.model) ?? false;
          if (group && modelExists) {
            setFollowDefault(false);
            setSelectedProvider(selection.provider);
            setSelectedModel(selection.model);
          } else if (data.defaultSelection) {
            setFollowDefault(false);
            setSelectedProvider(data.defaultSelection.provider);
            setSelectedModel(data.defaultSelection.model);
          } else if (data.groups[0]) {
            setFollowDefault(false);
            setSelectedProvider(data.groups[0].provider);
            setSelectedModel(data.groups[0].models[0]?.id ?? '');
          } else {
            setFollowDefault(true);
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveModelSelection = () => {
    if (!followDefault && (!selectedProvider || !selectedModel)) {
      message.warning('请先选择模型服务商和模型');
      return;
    }
    const selection: DshModelSelection = followDefault
      ? { followDefault: true }
      : { followDefault: false, provider: selectedProvider, model: selectedModel };
    useSettingsStore.getState().setDshModelSelection(selection);
    message.success('模型选择已保存');
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#faf9f5' }}>
      {/* 左侧侧边菜单栏 */}
      <div style={SETTINGS_SIDEBAR_STYLE}>
        <Anchor
          affix={false}
          getContainer={() => document.getElementById('settings-scroll-container') as HTMLElement}
          onClick={(e) => e.preventDefault()}
          items={[
            { key: 'dsh-model-config', href: '#dsh-model-config', title: 'DSH 模型选择' },
          ]}
        />
        <Divider style={{ margin: '12px 16px 12px -8px', borderColor: '#eae6df', minWidth: 'auto', width: 'calc(100% - 8px)' }} />
        <Anchor
          affix={false}
          getContainer={() => document.getElementById('settings-scroll-container') as HTMLElement}
          onClick={(e) => e.preventDefault()}
          items={[
            { key: 'works-config', href: '#works-config', title: '作品页设置' },
            { key: 'outline-config', href: '#outline-config', title: '大纲页设置' },
            { key: 'deai-config', href: '#deai-config', title: '去AI味页设置' },
          ]}
        />
        <Divider style={{ margin: '12px 16px 12px -8px', borderColor: '#eae6df', minWidth: 'auto', width: 'calc(100% - 8px)' }} />
        <Anchor
          affix={false}
          getContainer={() => document.getElementById('settings-scroll-container') as HTMLElement}
          onClick={(e) => e.preventDefault()}
          items={[
            { key: 'background-config', href: '#background-config', title: '背景页设置' },
            { key: 'partner-chat-config', href: '#partner-chat-config', title: '聊天页设置' },
            { key: 'story-agent-config', href: '#story-agent-config', title: '冒险页设置' },
            { key: 'bond-config', href: '#bond-config', title: '羁绊页设置' },
          ]}
        />
        <Divider style={{ margin: '12px 16px 12px -8px', borderColor: '#eae6df', minWidth: 'auto', width: 'calc(100% - 8px)' }} />
        <Anchor
          affix={false}
          getContainer={() => document.getElementById('settings-scroll-container') as HTMLElement}
          onClick={(e) => e.preventDefault()}
          items={[
            { key: 'book-travel-material-config', href: '#book-travel-material-config', title: '素材页设置' },
            { key: 'book-travel-config', href: '#book-travel-config', title: '穿书页设置' },
          ]}
        />
      </div>

      {/* 右侧核心内容区域 */}
      <div id="settings-scroll-container" style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', paddingBottom: 120 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          <Title level={2} style={{ fontWeight: 600, color: '#33312e', marginBottom: 40, letterSpacing: '-0.5px', fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            设置
          </Title>

          {/* DSH 模型选择区域 */}
          <section id="dsh-model-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <SettingOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>DSH 模型选择</Title>
            </div>

            <Card
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #eae6df',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(217, 119, 87, 0.02)',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              {catalogError ? (
                <div style={{ color: '#f5222d', fontSize: 14 }}>
                  模型列表加载失败：{catalogError}，请检查 DeepSeek Harness 服务后重试。
                </div>
              ) : !catalog ? (
                <div style={{ color: '#8c857b', fontSize: 14 }}>正在加载 DeepSeek Harness 模型列表...</div>
              ) : catalog.groups.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: '#8c857b' }}>
                      暂无可用模型，请先在 DeepSeek Harness 的模型设置中配置模型。
                    </span>
                  }
                />
              ) : (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 13, color: '#8c857b', display: 'block', lineHeight: 1.6 }}>
                      MuseAI 全部页面（作品、大纲、聊天、冒险、羁绊、穿书等）的生成请求都使用
                      DeepSeek Harness 自带或已配置的模型，由 Harness 统一管理与鉴权，此处无需填写
                      API Key、接口地址等信息。
                    </Text>
                  </div>

                  {/* 跟随 DSH 默认模型 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 600, color: '#33312e', fontSize: 14, display: 'block' }}>
                        跟随 DSH 默认模型
                      </Text>
                      <Text style={{ fontSize: 12, color: '#8c857b', display: 'block', marginTop: 4, lineHeight: 1.6 }}>
                        使用 DeepSeek Harness 当前配置的默认模型。
                      </Text>
                      {followDefault && (
                        <Text style={{ fontSize: 12, color: '#8c857b', display: 'block', marginTop: 4, lineHeight: 1.6 }}>
                          {catalog.defaultSelection
                            ? `当前默认模型：${catalog.defaultSelection.provider} / ${catalog.defaultSelection.model}`
                            : '当前未检测到 Harness 默认模型，可关闭此开关手动选择模型。'}
                        </Text>
                      )}
                    </div>
                    <Switch
                      aria-label="跟随 DSH 默认模型"
                      checked={followDefault}
                      onChange={(checked) => {
                        setFollowDefault(checked);
                        if (!checked && !selectedProvider) {
                          const provider = catalog.defaultSelection?.provider ?? catalog.groups[0]?.provider ?? '';
                          const group = catalog.groups.find((g) => g.provider === provider);
                          setSelectedProvider(provider);
                          setSelectedModel(catalog.defaultSelection?.model ?? group?.models[0]?.id ?? '');
                        }
                      }}
                    />
                  </div>

                  {/* 手动选择：provider → model 级联 */}
                  {!followDefault && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 24 }}>
                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 500, color: '#5c5751', fontSize: 14 }}>
                          模型服务商 (Provider)
                        </div>
                        <Select<string>
                          value={selectedProvider || undefined}
                          placeholder="请选择服务商"
                          style={{ width: '100%' }}
                          onChange={(value) => {
                            setSelectedProvider(value);
                            const group = catalog.groups.find((g) => g.provider === value);
                            setSelectedModel(group?.models[0]?.id ?? '');
                          }}
                          options={catalog.groups.map((g) => ({ value: g.provider, label: g.displayName }))}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 500, color: '#5c5751', fontSize: 14 }}>
                          模型 (Model)
                        </div>
                        <Select<string>
                          value={selectedModel || undefined}
                          placeholder="请选择模型"
                          style={{ width: '100%' }}
                          showSearch
                          optionFilterProp="label"
                          onChange={(value) => setSelectedModel(value)}
                          options={catalog.groups.find((g) => g.provider === selectedProvider)?.models.map((m) => ({ value: m.id, label: m.name })) ?? []}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button
                      type="primary"
                      onClick={handleSaveModelSelection}
                      style={{
                        backgroundColor: '#d97757',
                        borderColor: '#d97757',
                        color: '#ffffff',
                        fontWeight: 500,
                        borderRadius: '6px',
                        padding: '0 24px'
                      }}
                    >
                      保存模型选择
                    </Button>
                    <Text style={{ fontSize: 12, color: '#8c857b' }}>
                      保存后立即应用到全部 MuseAI 页面的生成请求。
                    </Text>
                  </div>
                </>
              )}

              {/* 目录加载失败的服务商 */}
              {catalog && catalog.failures.length > 0 && (
                <div
                  style={{
                    marginTop: 24,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#faf9f5',
                    border: '1px solid #f2eee8',
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#8c857b', display: 'block', marginBottom: 4 }}>
                    以下模型服务商加载失败：
                  </Text>
                  {catalog.failures.map((failure) => (
                    <Text key={failure.provider} style={{ fontSize: 12, color: '#8c857b', display: 'block', lineHeight: 1.6 }}>
                      {failure.provider}：{failure.error}
                    </Text>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 作品页设置区域 */}
          <section id="works-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <BookOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>作品页设置</Title>
            </div>

            <AgentSettingCard
              title="写文章 Agent"
              agentId="writer"
              defaultPrompt={defaultSystemPrompt}
              currentPrompt={store.systemPrompt}
              onSavePrompt={store.setSystemPrompt}
              onResetPrompt={store.resetSystemPrompt}
              helpText="此提示词将作为作品页写文章 Agent 初始化和长短篇创作时的核心人设设定与行为约束。"
            />

            <AgentSettingCard
              title="作品总结 Agent"
              agentId="workSummary"
              defaultPrompt={defaultWorkSummaryPrompt}
              currentPrompt={store.workSummaryPrompt}
              onSavePrompt={store.setWorkSummaryPrompt}
              onResetPrompt={store.resetWorkSummaryPrompt}
              helpText="此提示词将用于评估小说商业逻辑，梳理人物、线索和分章节剧情，并提供多维度详细打分建议。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 大纲页设置区域 */}
          <section id="outline-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <ProfileOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>大纲页设置</Title>
            </div>

            <AgentSettingCard
              title="大纲制作 Agent"
              agentId="outlineCreation"
              defaultPrompt={defaultOutlineCreationPrompt}
              currentPrompt={store.outlineCreationPrompt}
              onSavePrompt={store.setOutlineCreationPrompt}
              onResetPrompt={store.resetOutlineCreationPrompt}
              helpText="此提示词将作为大纲制作 Agent 的核心规范，用于新建、改写或根据评估建议重构大纲。"
            />

            <AgentSettingCard
              title="大纲评估 Agent"
              agentId="outlineAssessment"
              defaultPrompt={defaultOutlineAssessmentPrompt}
              currentPrompt={store.outlineAssessmentPrompt}
              onSavePrompt={store.setOutlineAssessmentPrompt}
              onResetPrompt={store.resetOutlineAssessmentPrompt}
              helpText="此提示词将作为大纲评估的主力人设，评估引流能力、开局钩子、情绪脑洞并进行 5 维度商业估分。"
            />

            <AgentSettingCard
              title="AI反向分析大纲：短篇"
              agentId="reverseOutlineShort"
              defaultPrompt={defaultReverseOutlineShortPrompt}
              currentPrompt={store.reverseOutlineShortPrompt}
              onSavePrompt={store.setReverseOutlineShortPrompt}
              onResetPrompt={store.resetReverseOutlineShortPrompt}
              helpText="此配置用于短篇反向分析，直接读取完整文本并生成结构化大纲。"
            />

            <AgentSettingCard
              title="AI反向分析大纲：长篇-分段摘要"
              agentId="reverseOutlineLongSummary"
              defaultPrompt={defaultReverseOutlineLongSummaryPrompt}
              currentPrompt={store.reverseOutlineLongSummaryPrompt}
              onSavePrompt={store.setReverseOutlineLongSummaryPrompt}
              onResetPrompt={store.resetReverseOutlineLongSummaryPrompt}
              helpText="此配置用于长篇反向分析的第一阶段，将每 10 段内容压缩成剧情概要。"
            />

            <AgentSettingCard
              title="AI反向分析大纲：长篇-汇总大纲"
              agentId="reverseOutlineLongFinal"
              defaultPrompt={defaultReverseOutlineLongFinalPrompt}
              currentPrompt={store.reverseOutlineLongFinalPrompt}
              onSavePrompt={store.setReverseOutlineLongFinalPrompt}
              onResetPrompt={store.resetReverseOutlineLongFinalPrompt}
              helpText="此配置用于长篇反向分析的第二阶段，根据分段概要汇总生成最终大纲。"
            />

            <SettingsConcurrencyCard
              agentId="reverseOutline"
              label="AI 反向分析大纲并发数"
              helpText="仅用于长篇文章的分布式并行分析，默认 5，建议不要超过 20。"
              saveMessage="已保存 AI 反向分析大纲并发数"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 去AI味页设置区域 */}
          <section id="deai-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <ClearOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>去AI味页设置</Title>
            </div>

            <AgentSettingCard
              title="检测 AI 味 Agent"
              agentId="detector"
              defaultPrompt={defaultDeAiDetectorPrompt}
              currentPrompt={store.deAiDetectorPrompt}
              onSavePrompt={store.setDeAiDetectorPrompt}
              onResetPrompt={store.resetDeAiDetectorPrompt}
              helpText="此提示词将作为去AI味页面的核心评测准则，检测 8 项 AI Slop 特征并对文章进行打分。"
            />

            <AgentSettingCard
              title="去除 AI 味 Agent"
              agentId="remover"
              defaultPrompt={defaultDeAiRemoverPrompt}
              currentPrompt={store.deAiRemoverPrompt}
              onSavePrompt={store.setDeAiRemoverPrompt}
              onResetPrompt={store.resetDeAiRemoverPrompt}
              helpText="此提示词将作为润色去AI味的专家规范，依据分析意见小步快跑地优化文章，让人味更加突出。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 背景页设置区域 */}
          <section id="background-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <GlobalOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>背景页设置</Title>
            </div>

            <SettingsConcurrencyCard
              agentId="backgroundExtraction"
              label="AI 提取背景设定并发数"
              helpText="仅用于并行提取角色卡，默认 5，建议不要超过 20。"
              saveMessage="已保存 AI 提取背景设定并发数"
            />

            <AgentSettingCard
              title="提取世界书"
              agentId="backgroundWorldBook"
              defaultPrompt={defaultBackgroundWorldBookPrompt}
              currentPrompt={store.backgroundWorldBookPrompt}
              onSavePrompt={store.setBackgroundWorldBookPrompt}
              onResetPrompt={store.resetBackgroundWorldBookPrompt}
              helpText="此提示词用于 AI 智能提取背景设定的第一阶段：生成世界书，并在完整模式下提取角色名列表。"
            />

            <AgentSettingCard
              title="提取角色卡"
              agentId="backgroundCharacterCard"
              defaultPrompt={defaultBackgroundCharacterCardPrompt}
              currentPrompt={store.backgroundCharacterCardPrompt}
              onSavePrompt={store.setBackgroundCharacterCardPrompt}
              onResetPrompt={store.resetBackgroundCharacterCardPrompt}
              helpText="此提示词用于 AI 智能提取背景设定的第二阶段：按角色名分别生成结构化角色卡。"
            />

            <AgentSettingCard
              title="SillyTavern 角色卡转换师"
              agentId="sillyTavernExporter"
              defaultPrompt={defaultSillyTavernExporterPrompt}
              currentPrompt={store.sillyTavernExporterPrompt}
              onSavePrompt={store.setSillyTavernExporterPrompt}
              onResetPrompt={store.resetSillyTavernExporterPrompt}
              helpText="此提示词用于在角色卡导出时把 MuseAI 角色卡转换为 SillyTavern 角色卡 V2 格式。默认使用温度 0、max_tokens 32000、思考深度 high。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 聊天页设置区域 */}
          <section id="partner-chat-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <MessageOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>聊天页设置</Title>
            </div>

            <AgentSettingCard
              title="伴侣对谈师"
              agentId="partnerChat"
              defaultPrompt={defaultPartnerChatPrompt}
              currentPrompt={store.partnerChatPrompt}
              onSavePrompt={store.setPartnerChatPrompt}
              onResetPrompt={store.resetPartnerChatPrompt}
              helpText="此提示词将作为伴侣聊天室中聊天 Agent 的核心系统提示词。结尾将自动且优雅地嵌入用户选择的世界书、角色卡和个人信息。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 故事页设置区域 */}
          <section id="story-agent-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <CompassOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>冒险页设置</Title>
            </div>

            <AgentSettingCard
              title="冒险主持人（非动态加载）"
              agentId="storyAgent"
              defaultPrompt={defaultStoryAgentPrompt}
              currentPrompt={store.storyAgentPrompt}
              onSavePrompt={store.setStoryAgentPrompt}
              onResetPrompt={store.resetStoryAgentPrompt}
              helpText="此提示词将作为跑团/文字冒险故事中故事 Agent（主持GM）的核心系统提示词。结尾将自动且优雅地嵌入用户选择的世界书、多个角色卡和个人信息。第一条用户消息为填入的初始剧情。"
            />

            <AgentSettingCard
              title="冒险主持人（角色卡动态加载）"
              agentId="storyDynamicAgent"
              defaultPrompt={defaultStoryDynamicAgentPrompt}
              currentPrompt={store.storyDynamicAgentPrompt}
              onSavePrompt={store.setStoryDynamicAgentPrompt}
              onResetPrompt={store.resetStoryDynamicAgentPrompt}
              helpText="开启角色卡动态加载时使用此配置。此提示词会强调角色本人发言必须通过 role_play 生成。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 羁绊页设置区域 */}
          <section id="bond-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <HeartOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>羁绊页设置</Title>
            </div>

            <AgentSettingCard
              title="聊天页-记忆封存师"
              agentId="chatArchive"
              defaultPrompt={defaultChatArchivePrompt}
              currentPrompt={store.chatArchivePrompt}
              onSavePrompt={store.setChatArchivePrompt}
              onResetPrompt={store.resetChatArchivePrompt}
              helpText="此提示词用于聊天页点击「封存记忆」时，AI 分析整场对话并提炼关系设定变化、关键事件与建议会话标题。"
            />

            <AgentSettingCard
              title="冒险页-记忆封存师"
              agentId="storyArchive"
              defaultPrompt={defaultStoryArchivePrompt}
              currentPrompt={store.storyArchivePrompt}
              onSavePrompt={store.setStoryArchivePrompt}
              onResetPrompt={store.resetStoryArchivePrompt}
              helpText="此提示词用于冒险页点击「封存记忆」时，AI 分析整场冒险并提炼关系设定变化、关键事件与建议会话标题。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 素材页设置区域 */}
          <section id="book-travel-material-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <BookOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>素材页设置</Title>
            </div>

            <AgentSettingCard
              title="穿书素材装配师"
              agentId="bookTravelMaterialAssembler"
              defaultPrompt={defaultBookTravelMaterialAssemblerPrompt}
              currentPrompt={store.bookTravelMaterialAssemblerPrompt}
              onSavePrompt={store.setBookTravelMaterialAssemblerPrompt}
              onResetPrompt={store.resetBookTravelMaterialAssemblerPrompt}
              helpText="此提示词用于把已选大纲、世界书和角色卡整理成穿书运行所需的结构化世界模型。"
            />

            <AgentSettingCard
              title="穿书入场导演"
              agentId="bookTravelEntryDirector"
              defaultPrompt={defaultBookTravelEntryDirectorPrompt}
              currentPrompt={store.bookTravelEntryDirectorPrompt}
              onSavePrompt={store.setBookTravelEntryDirectorPrompt}
              onResetPrompt={store.resetBookTravelEntryDirectorPrompt}
              helpText="此提示词用于生成穿书入口和用户可选身份，帮助用户进入所选小说世界。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

          {/* 穿书页设置区域 */}
          <section id="book-travel-config" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <DeploymentUnitOutlined style={{ fontSize: '20px', color: '#d97757' }} />
              <Title level={4} style={{ color: '#33312e', margin: 0, fontWeight: 600, fontFamily: '"Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>穿书页设置</Title>
            </div>

            <AgentSettingCard
              title="穿书剧情规划师"
              agentId="bookTravelPlotPlanner"
              defaultPrompt={defaultBookTravelPlotPlannerPrompt}
              currentPrompt={store.bookTravelPlotPlannerPrompt}
              onSavePrompt={store.setBookTravelPlotPlannerPrompt}
              onResetPrompt={store.resetBookTravelPlotPlannerPrompt}
              helpText="此提示词用于分类用户输入、规划换场状态变化，并保持剧情因果。"
            />

            <AgentSettingCard
              title="穿书场景写手"
              agentId="bookTravelSceneWriter"
              defaultPrompt={defaultBookTravelSceneWriterPrompt}
              currentPrompt={store.bookTravelSceneWriterPrompt}
              onSavePrompt={store.setBookTravelSceneWriterPrompt}
              onResetPrompt={store.resetBookTravelSceneWriterPrompt}
              helpText="此提示词用于生成当前场景、节拍、选项和沉浸式中文叙事。"
            />

            <AgentSettingCard
              title="穿书记忆整理员"
              agentId="bookTravelMemoryKeeper"
              defaultPrompt={defaultBookTravelMemoryKeeperPrompt}
              currentPrompt={store.bookTravelMemoryKeeperPrompt}
              onSavePrompt={store.setBookTravelMemoryKeeperPrompt}
              onResetPrompt={store.resetBookTravelMemoryKeeperPrompt}
              helpText="此提示词用于压缩长线穿书历史，保留关键选择、关系变化和未解决伏笔。"
            />

            <AgentSettingCard
              title="穿书结局裁判"
              agentId="bookTravelEndingJudge"
              defaultPrompt={defaultBookTravelEndingJudgePrompt}
              currentPrompt={store.bookTravelEndingJudgePrompt}
              onSavePrompt={store.setBookTravelEndingJudgePrompt}
              onResetPrompt={store.resetBookTravelEndingJudgePrompt}
              helpText="此提示词用于判断结局条件，并生成最终结局、世界线名称和偏离度总结。"
            />
          </section>

          <Divider style={{ borderColor: '#eae6df', margin: '48px 0' }} />

        </div>
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => useSettingsView();
