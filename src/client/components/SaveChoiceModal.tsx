import React, { useLayoutEffect, useReducer } from 'react';
import { Alert, Input, Modal, Radio, Select, Space } from 'antd';

export type SaveChoiceMode = 'create' | 'overwrite';

export interface SaveChoiceConfirmPayload {
  mode: SaveChoiceMode;
  name: string;
  targetId: string | null;
}

export interface SaveChoiceOverwriteTarget {
  value: string;
  label: string;
  description?: string;
  details?: string[];
}

interface SaveChoiceModalProps {
  open: boolean;
  title: string;
  nameLabel: string;
  initialName: string;
  loading?: boolean;
  overwriteAvailable: boolean;
  createLabel?: string;
  overwriteLabel?: string;
  overwriteTargetLabel?: string;
  overwriteTargets?: SaveChoiceOverwriteTarget[];
  initialOverwriteTargetId?: string | null;
  unavailableOverwriteText?: string;
  onCancel: () => void;
  onConfirm: (payload: SaveChoiceConfirmPayload) => void;
}

interface SaveChoiceDraft {
  mode: SaveChoiceMode;
  name: string;
  targetId: string | null;
}

type SaveChoiceDraftAction =
  | { type: 'reset'; draft: SaveChoiceDraft }
  | { type: 'setMode'; mode: SaveChoiceMode }
  | { type: 'setName'; name: string }
  | { type: 'setTargetId'; targetId: string | null };

const saveChoiceDraftReducer = (state: SaveChoiceDraft, action: SaveChoiceDraftAction): SaveChoiceDraft => {
  switch (action.type) {
    case 'reset':
      return action.draft;
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'setName':
      return { ...state, name: action.name };
    case 'setTargetId':
      return { ...state, targetId: action.targetId };
    default:
      return state;
  }
};

const createSaveChoiceDraft = (
  overwriteAvailable: boolean,
  initialName: string,
  targetId: string | null,
): SaveChoiceDraft => ({
  mode: overwriteAvailable ? 'overwrite' : 'create',
  name: initialName,
  targetId,
});

const SAVE_CHOICE_DETAIL_TAG_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  color: '#6f6962',
  background: '#faf7f1',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 12,
  lineHeight: 1.45,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const SaveChoiceModal: React.FC<SaveChoiceModalProps> = ({
  open,
  title,
  nameLabel,
  initialName,
  loading = false,
  overwriteAvailable,
  createLabel = '保存为新记录',
  overwriteLabel = '覆盖原记录',
  overwriteTargetLabel = '覆盖记录',
  overwriteTargets = [],
  initialOverwriteTargetId = null,
  unavailableOverwriteText = '当前没有可覆盖的原记录，将保存为新记录。',
  onCancel,
  onConfirm,
}) => {
  const overwriteTargetValues = overwriteTargets.map((target) => target.value);
  const overwriteTargetValueSet = new Set(overwriteTargetValues);
  const fallbackTargetId = overwriteTargetValues[0] || null;
  const resolvedInitialTargetId = (
    initialOverwriteTargetId && overwriteTargetValueSet.has(initialOverwriteTargetId)
      ? initialOverwriteTargetId
      : fallbackTargetId
  );
  const overwriteTargetValuesSignature = JSON.stringify(overwriteTargetValues);
  const [draft, dispatchDraft] = useReducer(
    saveChoiceDraftReducer,
    createSaveChoiceDraft(overwriteAvailable, initialName, resolvedInitialTargetId),
  );
  const selectedTargetId = draft.targetId || fallbackTargetId;
  const selectOptions = overwriteTargets.map((target) => ({
    value: target.value,
    label: target.label,
  }));

  useLayoutEffect(() => {
    if (!open) return;
    dispatchDraft({
      type: 'reset',
      draft: createSaveChoiceDraft(overwriteAvailable, initialName, resolvedInitialTargetId),
    });
  }, [initialName, open, overwriteAvailable, overwriteTargetValuesSignature, resolvedInitialTargetId]);

  const confirmDisabled = (
    (draft.mode === 'create' && draft.name.trim() === '') ||
    (draft.mode === 'overwrite' && overwriteTargets.length > 0 && !selectedTargetId)
  );

  return (
    <Modal
      open={open}
      title={title}
      centered
      width={460}
      okText="确认保存"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: confirmDisabled }}
      onCancel={onCancel}
      onOk={() => onConfirm({ mode: draft.mode, name: draft.name.trim(), targetId: selectedTargetId })}
      styles={{ body: { paddingTop: 12 } }}
    >
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <Radio.Group
          value={draft.mode}
          onChange={(event) => dispatchDraft({ type: 'setMode', mode: event.target.value })}
          style={{ display: 'grid', gap: 8 }}
        >
          <Radio value="create">{createLabel}</Radio>
          <Radio value="overwrite" disabled={!overwriteAvailable}>{overwriteLabel}</Radio>
        </Radio.Group>
        {!overwriteAvailable && (
          <Alert type="info" showIcon message={unavailableOverwriteText} />
        )}
        {draft.mode === 'create' && (
          <label style={{ display: 'grid', gap: 6, color: '#33312e', fontWeight: 600 }}>
            {nameLabel}
            <Input
              aria-label={nameLabel}
              value={draft.name}
              maxLength={80}
              placeholder={`请输入${nameLabel}`}
              onChange={(event) => dispatchDraft({ type: 'setName', name: event.target.value })}
            />
          </label>
        )}
        {draft.mode === 'overwrite' && overwriteTargets.length > 0 && (
          <label style={{ display: 'grid', gap: 6, color: '#33312e', fontWeight: 600 }}>
            {overwriteTargetLabel}
            <Select
              aria-label={overwriteTargetLabel}
              value={selectedTargetId}
              options={selectOptions}
              listHeight={320}
              optionRender={(option) => {
                const target = overwriteTargets.find((item) => item.value === option.value);
                if (!target) return option.label;
                return (
                  <div style={{ display: 'grid', gap: 5, padding: '4px 0' }}>
                    <div style={{ color: '#33312e', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {target.label}
                    </div>
                    {target.description && (
                      <div style={{ color: '#8c8882', fontSize: 12, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {target.description}
                      </div>
                    )}
                    {target.details && target.details.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {target.details.slice(0, 4).map((detail) => (
                          <span
                            key={detail}
                            style={SAVE_CHOICE_DETAIL_TAG_STYLE}
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
              onChange={(value) => dispatchDraft({ type: 'setTargetId', targetId: value })}
            />
          </label>
        )}
      </Space>
    </Modal>
  );
};

export default SaveChoiceModal;
