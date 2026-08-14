import React from 'react';
import { Select, Space, Tag, Typography } from 'antd';
import { useStylePresetStore } from '../stores/useStylePresetStore';
import { resolveStylePresets } from '../utils/stylePresets';

type StylePresetUsage = 'chat' | 'adventure' | 'bookTravel';
const TARGET_LABELS: Record<StylePresetUsage, string> = {
  chat: '聊天',
  adventure: '冒险',
  bookTravel: '穿书',
};

interface StylePresetSelectorProps {
  target: StylePresetUsage;
  value: string | null;
  onChange: (value: string | null) => void;
  compact?: boolean;
  sessionStarted?: boolean;
}

export const StylePresetSelector: React.FC<StylePresetSelectorProps> = ({
  target,
  value,
  onChange,
  sessionStarted = false,
}) => {
  const presets = useStylePresetStore((state) => state.presets);
  const resolved = resolveStylePresets(presets, value ? [value] : []);
  const selectedMissing = Boolean(value && !presets.some((preset) => preset.id === value));

  return (
    <div className="style-preset-selector">
      <Space orientation="vertical" size={6} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Typography.Text strong>文风预设</Typography.Text>
          <Tag color="volcano">{TARGET_LABELS[target]}</Tag>
          <Typography.Text type="secondary">生效正文 {resolved.totalCharacters} 字</Typography.Text>
        </Space>
        {presets.length > 0 ? (
          <Select
            aria-label={`${TARGET_LABELS[target]}文风预设`}
            value={selectedMissing ? undefined : value || undefined}
            options={presets.map((preset) => ({ label: preset.name, value: preset.id }))}
            placeholder={`选择一个${TARGET_LABELS[target]}文风预设`}
            onChange={(next) => onChange(next || null)}
            allowClear
            style={{ width: '100%' }}
          />
        ) : (
          <Typography.Text type="secondary">暂无可用预设，请先在背景页创建。</Typography.Text>
        )}
        {selectedMissing && <Typography.Text type="warning">所选预设已删除，发送时会自动忽略。</Typography.Text>}
        {sessionStarted && <Typography.Text type="secondary">修改仅影响后续回复，不会改变已有对话记录。</Typography.Text>}
      </Space>
    </div>
  );
};
