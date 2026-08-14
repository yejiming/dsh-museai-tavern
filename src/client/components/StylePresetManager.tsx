import React from 'react';
import { Button, Modal, Tooltip } from 'antd';
import { DeleteOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { StylePreset, useStylePresetStore } from '../stores/useStylePresetStore';

interface StylePresetManagerProps {
  onSelectPreset: () => void;
}

export const StylePresetManager: React.FC<StylePresetManagerProps> = ({ onSelectPreset }) => {
  const { presets, selectedPresetId, addPreset, selectPreset, deletePreset } = useStylePresetStore();

  const handleAdd = () => {
    addPreset();
    onSelectPreset();
  };

  const handleSelect = (id: string) => {
    selectPreset(id);
    onSelectPreset();
  };

  const confirmDelete = (preset: StylePreset, event: React.MouseEvent) => {
    event.stopPropagation();
    Modal.confirm({
      title: '删除文风预设',
      content: `确认删除「${preset.name}」吗？历史会话仍可打开，但会自动忽略该预设。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => deletePreset(preset.id),
    });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="background-category-header">
        <span>文风预设</span>
        <Tooltip title="新增文风预设">
          <Button
            aria-label="新增文风预设"
            type="text"
            size="small"
            icon={<PlusOutlined style={{ fontSize: 12 }} />}
            onClick={handleAdd}
            style={{ width: 22, height: 22, padding: 0 }}
            className="add-category-btn"
          />
        </Tooltip>
      </div>
      {presets.length === 0 ? (
        <div style={{ padding: '8px 20px', color: '#c0bbb4', fontSize: 12, fontStyle: 'italic' }}>暂无文风预设</div>
      ) : presets.map((preset) => {
        const isSelected = preset.id === selectedPresetId;
        return (
          <div
            key={preset.id}
            role="treeitem"
            aria-selected={isSelected}
            tabIndex={0}
            className={`directory-item-hover background-directory-item ${isSelected ? 'is-selected' : ''}`}
            onClick={() => handleSelect(preset.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSelect(preset.id);
              }
            }}
          >
            <div className="background-directory-item__body">
              <FileTextOutlined style={{ fontSize: 15, flexShrink: 0, color: isSelected ? '#d97757' : '#8c8882' }} />
              <span className="background-directory-item__name">{preset.name}</span>
            </div>
            <div className="directory-item-actions" style={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="删除" mouseEnterDelay={0.8}>
                <Button
                  aria-label={`删除文风预设 ${preset.name}`}
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                  onClick={(event) => confirmDelete(preset, event)}
                  style={{ width: 20, height: 20, padding: 0, display: 'none' }}
                  className="action-btn"
                />
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
};
