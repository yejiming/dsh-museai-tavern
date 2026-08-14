import React, { useState } from 'react';
import { Button, Card, Empty, Input, Space, Switch, Tooltip, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { StylePreset, useStylePresetStore } from '../stores/useStylePresetStore';

interface StylePresetEditorProps {
  preset: StylePreset;
}

const STYLE_PRESET_TITLE_BUTTON_STYLE: React.CSSProperties = {
  flex: 1,
  border: 0,
  padding: 0,
  background: 'transparent',
  textAlign: 'left',
  color: '#33312e',
  fontWeight: 500,
  cursor: 'pointer',
};

export const StylePresetEditor: React.FC<StylePresetEditorProps> = ({ preset }) => {
  const { updatePresetName, addSegment, updateSegment, deleteSegment, reorderSegments } = useStylePresetStore();
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<string[]>([]);
  const expandedSegmentIdSet = new Set(expandedSegmentIds);

  const toggleExpanded = (segmentId: string) => {
    setExpandedSegmentIds((ids) => ids.includes(segmentId)
      ? ids.filter((id) => id !== segmentId)
      : [...ids, segmentId]);
  };

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Card className="custom-form-card" size="small" title={<span className="form-section-title">基本信息</span>}>
        <div className="input-label">预设名称</div>
        <Input
          aria-label="预设名称"
          value={preset.name}
          maxLength={60}
          showCount
          placeholder="请输入预设名称"
          onChange={(event) => updatePresetName(preset.id, event.target.value)}
        />
      </Card>

      <Card
        className="custom-form-card"
        size="small"
        title={<span className="form-section-title">提示词片段</span>}
        extra={<Button type="text" size="small" icon={<PlusOutlined />} onClick={() => addSegment(preset.id)}>新增提示词</Button>}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          点击标题展开内容；使用上移、下移按钮调整嵌入顺序。关闭的片段不会发送给模型。
        </Typography.Paragraph>
        {preset.segments.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无提示词片段" />
        ) : (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            {preset.segments.map((segment, index) => {
              const expanded = expandedSegmentIdSet.has(segment.id);
              return (
                <div
                  key={segment.id}
                  style={{
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.06)',
                    background: segment.enabled ? '#fffdf9' : '#f6f4f0',
                    opacity: segment.enabled ? 1 : 0.72,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                    <Button
                      aria-label={`${expanded ? '收起' : '展开'}提示词 ${index + 1}`}
                      type="text"
                      size="small"
                      icon={expanded ? <DownOutlined /> : <RightOutlined />}
                      onClick={() => toggleExpanded(segment.id)}
                      style={{ width: 26, height: 26, padding: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpanded(segment.id)}
                      style={STYLE_PRESET_TITLE_BUTTON_STYLE}
                    >
                      {segment.title || '未命名提示词'}
                    </button>
                    <Switch
                      aria-label={`启用提示词 ${index + 1}`}
                      checked={segment.enabled}
                      checkedChildren="开启"
                      unCheckedChildren="关闭"
                      onChange={(enabled) => updateSegment(preset.id, segment.id, { enabled })}
                    />
                    <Tooltip title="上移">
                      <Button
                        aria-label={`上移提示词 ${index + 1}`}
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={index === 0}
                        onClick={() => reorderSegments(preset.id, index, index - 1)}
                      />
                    </Tooltip>
                    <Tooltip title="下移">
                      <Button
                        aria-label={`下移提示词 ${index + 1}`}
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={index === preset.segments.length - 1}
                        onClick={() => reorderSegments(preset.id, index, index + 1)}
                      />
                    </Tooltip>
                    <Button
                      aria-label={`删除提示词 ${index + 1}`}
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => deleteSegment(preset.id, segment.id)}
                    />
                  </div>
                  {expanded && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <Input
                        aria-label={`提示词标题 ${index + 1}`}
                        value={segment.title}
                        maxLength={60}
                        placeholder="请输入提示词标题"
                        onChange={(event) => updateSegment(preset.id, segment.id, { title: event.target.value })}
                        style={{ marginBottom: 10, fontWeight: 500 }}
                      />
                      <Input.TextArea
                        aria-label={`提示词正文 ${index + 1}`}
                        value={segment.content}
                        disabled={!segment.enabled}
                        placeholder="填写希望模型遵循的文风、对白或叙事要求"
                        autoSize={{ minRows: 4, maxRows: 12 }}
                        showCount
                        onChange={(event) => updateSegment(preset.id, segment.id, { content: event.target.value })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </Space>
        )}
      </Card>
    </Space>
  );
};
