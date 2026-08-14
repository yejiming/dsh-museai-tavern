import React, { useEffect, useRef, useMemo } from 'react';
import { Button, Input, Tooltip, Empty, Card, Tabs, Tag, Row, Col, Space, Radio, Modal, message, Tree, Select } from 'antd';
import type { InputRef } from 'antd';
import { 
  GlobalOutlined, 
  UserOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  CompassOutlined,
  EyeOutlined,
  EditFilled,
  ThunderboltOutlined,
  BookOutlined,
  FileProtectOutlined,
  LoadingOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { usePartnerStore, PartnerItem, PartnerItemFields, CustomField, PartnerImportExportType, PartnerItemsPackage, normalizePartnerFields } from '../stores/usePartnerStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { groupCharacterCardsByWorldBook } from '../utils/characterCardGroups';
import { useStateGroup } from '../utils/reducerState';
import { SillyTavernExportPreviewModal } from '../components/SillyTavernExportPreviewModal';
import { StylePresetManager } from '../components/StylePresetManager';
import { StylePresetEditor } from '../components/StylePresetEditor';
import { useStylePresetStore } from '../stores/useStylePresetStore';
import { complete } from '../api';

const DIRECTORY_WIDTH = 280;

/** 记忆浓缩的系统提示词（等价于原 Rust 端内置提示词）。 */
const MEMORY_OPTIMIZER_SYSTEM_PROMPT =
  '你是角色记忆整理师，请根据角色卡的关键事件，浓缩并优化为更精炼、更有表现力的关键事件列表，每行一个事件，直接输出整理后的事件文本';

/** 「未归属」角色卡分组 id（与 utils/characterCardGroups 中常量同值，本页表单专用）。 */
const UNASSIGNED_CHARACTER_CARD_GROUP_ID = '__unassigned_character_cards__';

interface BackgroundUiState {
  isMemModalOpen: boolean;
  optimizedEvents: string;
  isOptimizing: boolean;
  pendingWorldBookDelete: PartnerItem | null;
  editingId: string | null;
  editName: string;
  activeMode: 'edit' | 'preview';
  tagInputVisible: boolean;
  tagInputValue: string;
  expandedCharacterGroupKeys: React.Key[];
  exportFormatModalItem: PartnerItem | null;
  sillyTavernPreviewOpen: boolean;
  sillyTavernPreviewJson: string | null;
  sillyTavernConverting: boolean;
  sillyTavernConvertError: string | null;
  sillyTavernExportItem: PartnerItem | null;
}

const partnerTypeLabel = (type: PartnerImportExportType) => type === 'world_book' ? '世界书' : '角色卡';

const partnerPackageText = (data: PartnerItemsPackage) => JSON.stringify(data, null, 2);

/** 浏览器端 Blob 下载单个 JSON 文件（等价于原 export_json_files_to_downloads）。 */
const downloadPartnerItemFile = (relativePath: string, content: string): void => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = relativePath.split(/[\\/]/).pop() || relativePath;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** 从模型原始输出中提取最外层 JSON 片段（等价于原 Rust clean_json_response）。 */
const extractJsonText = (text: string): string => {
  const trimmed = text.trim();
  const openers = ['{', '['].map((ch) => trimmed.indexOf(ch)).filter((index) => index >= 0);
  const closers = ['}', ']'].map((ch) => trimmed.lastIndexOf(ch)).filter((index) => index >= 0);
  if (openers.length === 0 || closers.length === 0) {
    return trimmed;
  }
  const start = Math.min(...openers);
  const end = Math.max(...closers);
  return start < end ? trimmed.slice(start, end + 1) : trimmed;
};

/** 构造 SillyTavern 转换的 user 消息（等价于原 Rust build_silly_tavern_user_prompt）。 */
const buildSillyTavernUserPrompt = (
  sourceCharacterCard: { name: string; fields: PartnerItemFields; content: string },
  worldBookEntries?: { name: string; fields: PartnerItemFields; content: string },
): string => {
  const cardJson = JSON.stringify(sourceCharacterCard, null, 2);
  const worldBookSection = worldBookEntries
    ? `\n\n### 关联世界书条目\n${JSON.stringify(worldBookEntries, null, 2)}\n`
    : '';
  return `请将以下 MuseAI 角色卡转换为 SillyTavern 角色卡 V2 JSON。保留源文件事实，整理为连贯可用的中文角色指令，并按规则映射到 V2 字段。\n\n### 源角色卡 JSON\n${cardJson}${worldBookSection}请直接输出符合 V2 规范的纯 JSON，顶层与 data 字段必须完全镜像。`;
};

interface CustomFieldsBlockProps {
  item: PartnerItem;
  moduleId: string;
  addCustomField: (id: string, type: 'world_book' | 'character_card', moduleId: string) => void;
  updateCustomField: (
    id: string,
    type: 'world_book' | 'character_card',
    fieldId: string,
    updates: Partial<Pick<CustomField, 'label' | 'value'>>,
  ) => void;
  removeCustomField: (id: string, type: 'world_book' | 'character_card', fieldId: string) => void;
}

const CustomFieldsBlock: React.FC<CustomFieldsBlockProps> = ({
  item,
  moduleId,
  addCustomField,
  updateCustomField,
  removeCustomField,
}) => {
  const fields = item.fields?.customFields?.filter((field: CustomField) => field.moduleId === moduleId) || [];

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
      <Row gutter={[16, 16]}>
        {fields.map((field: CustomField) => (
          <Col span={8} key={field.id}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Input
                  value={field.label}
                  placeholder="字段名"
                  onChange={(event) => updateCustomField(item.id, item.type, field.id, { label: event.target.value })}
                  style={{ flex: 1, fontSize: 12, fontWeight: 500 }}
                  className="custom-form-input"
                />
                <Tooltip title="删除">
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                    onClick={() => removeCustomField(item.id, item.type, field.id)}
                    style={{ width: 22, height: 22, padding: 0 }}
                  />
                </Tooltip>
              </div>
              <Input
                value={field.value}
                placeholder={`请输入${field.label || '内容'}`}
                onChange={(event) => updateCustomField(item.id, item.type, field.id, { value: event.target.value })}
                className="custom-form-input"
              />
            </div>
          </Col>
        ))}
      </Row>
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => addCustomField(item.id, item.type, moduleId)}
        style={{ marginTop: 16, height: 28, fontSize: 12, color: '#8c8882', borderColor: 'rgba(0,0,0,0.1)' }}
      >
        添加自定义字段
      </Button>
    </div>
  );
};

const useBackgroundView = () => {
  const { 
    worldBooks, 
    characterCards, 
    selectedId, 
    selectedType,
    addWorldBook,
    addCharacterCard,
    selectItem,
    deleteItem,
    deleteWorldBookWithCharacterCards,
    updateItemName,
    updateItemFields,
    updateCharacterCardWorldBook,
    addCustomField,
    updateCustomField,
    removeCustomField,
    exportPartnerItemBundle,
    importPartnerItemsPackages
  } = usePartnerStore();

  const settings = useSettingsStore();
  const stylePresetStore = useStylePresetStore();
  const selectedStylePreset = stylePresetStore.presets.find((preset) => preset.id === stylePresetStore.selectedPresetId) || null;

  const [uiState, , setUiField] = useStateGroup<BackgroundUiState>({
    isMemModalOpen: false,
    optimizedEvents: '',
    isOptimizing: false,
    pendingWorldBookDelete: null,
    editingId: null,
    editName: '',
    activeMode: 'edit',
    tagInputVisible: false,
    tagInputValue: '',
    expandedCharacterGroupKeys: [],
    exportFormatModalItem: null,
    sillyTavernPreviewOpen: false,
    sillyTavernPreviewJson: null,
    sillyTavernConverting: false,
    sillyTavernConvertError: null,
    sillyTavernExportItem: null,
  });
  const {
    isMemModalOpen,
    optimizedEvents,
    isOptimizing,
    pendingWorldBookDelete,
    editingId,
    editName,
    activeMode,
    tagInputVisible,
    tagInputValue,
    expandedCharacterGroupKeys,
    exportFormatModalItem,
    sillyTavernPreviewOpen,
    sillyTavernPreviewJson,
    sillyTavernConverting,
    sillyTavernConvertError,
    sillyTavernExportItem,
  } = uiState;
  const setIsMemModalOpen = (isMemModalOpen: boolean) => setUiField('isMemModalOpen', isMemModalOpen);
  const setOptimizedEvents = (optimizedEvents: string) => setUiField('optimizedEvents', optimizedEvents);
  const setIsOptimizing = (isOptimizing: boolean) => setUiField('isOptimizing', isOptimizing);
  const setPendingWorldBookDelete = (pendingWorldBookDelete: PartnerItem | null) => setUiField('pendingWorldBookDelete', pendingWorldBookDelete);
  const setEditingId = (editingId: string | null) => setUiField('editingId', editingId);
  const setEditName = (editName: string) => setUiField('editName', editName);
  const setActiveMode = (activeMode: BackgroundUiState['activeMode']) => setUiField('activeMode', activeMode);
  const setTagInputVisible = (tagInputVisible: boolean) => setUiField('tagInputVisible', tagInputVisible);
  const setTagInputValue = (tagInputValue: string) => setUiField('tagInputValue', tagInputValue);
  const setExpandedCharacterGroupKeys = (expandedCharacterGroupKeys: React.SetStateAction<React.Key[]>) => setUiField('expandedCharacterGroupKeys', expandedCharacterGroupKeys);

  const handleOptimizeMemories = async (currentEvents: string) => {
    if (!currentEvents.trim()) {
      message.warning('当前关键事件记忆内容为空，无法进行浓缩与消解矛盾');
      return;
    }

    setIsOptimizing(true);
    try {
      const result = await complete({
        ...settings.dshModelSelection,
        system: MEMORY_OPTIMIZER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: currentEvents }],
        temperature: 0,
        maxTokens: 4096,
      });

      setOptimizedEvents(result.text);
      setIsMemModalOpen(true);
    } catch (err) {
      console.error('记忆优化失败:', err);
      message.error(`记忆浓缩优化失败：${String(err)}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleConfirmOptimize = () => {
    if (selectedItem) {
      updateItemFields(selectedItem.id, selectedItem.type, { keyEvents: optimizedEvents });
      message.success('关键事件记忆更新成功！');
      setIsMemModalOpen(false);
    }
  };

  const tagInputRef = useRef<InputRef>(null);
  const renameInputRef = useRef<InputRef>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportTypeRef = useRef<PartnerImportExportType>('world_book');
  const knownCharacterGroupKeysRef = useRef<string[]>([]);
  const hasInitializedCharacterGroupsRef = useRef(false);

  // Focus rename input when editing starts
  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  // Focus tag input when visible
  useEffect(() => {
    if (tagInputVisible && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [tagInputVisible]);

  const handleStartRename = (item: PartnerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleSaveRename = (item: PartnerItem) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== item.name) {
      updateItemName(item.id, item.type, trimmed);
    }
    setEditingId(null);
  };

  const handleDeleteItem = (id: string, type: 'world_book' | 'character_card', e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'world_book') {
      const item = worldBooks.find((worldBook) => worldBook.id === id);
      if (item) {
        setPendingWorldBookDelete(item);
      }
      return;
    }
    deleteItem(id, type);
  };

  const handleDeleteWorldBookOnly = () => {
    if (!pendingWorldBookDelete) return;
    deleteItem(pendingWorldBookDelete.id, 'world_book');
    setPendingWorldBookDelete(null);
  };

  const handleDeleteWorldBookWithCards = () => {
    if (!pendingWorldBookDelete) return;
    deleteWorldBookWithCharacterCards(pendingWorldBookDelete.id);
    setPendingWorldBookDelete(null);
  };

  const exportFilesForItem = (item: PartnerItem) => {
    const data = exportPartnerItemBundle(item.type, item.id);
    if (item.type === 'world_book') {
      const worldBookPackage = {
        ...data,
        characterCards: [],
      };
      const characterFiles = data.characterCards.map((card) => ({
        relativePath: `角色卡/${card.name || '未命名角色卡'}.json`,
        content: partnerPackageText({
          ...data,
          worldBooks: [],
          characterCards: [card],
        }),
      }));
      return {
        directoryName: item.name || '未命名世界书',
        files: [
          {
            relativePath: '世界书和角色卡.json',
            content: partnerPackageText(data),
          },
          {
            relativePath: '世界书.json',
            content: partnerPackageText(worldBookPackage),
          },
          ...characterFiles,
        ],
      };
    }

    return {
      directoryName: null,
      files: [
        {
          relativePath: `museai-character-card-${item.name || '未命名角色卡'}.json`,
          content: partnerPackageText(data),
        },
      ],
    };
  };

  const handleExportPartnerItem = (item: PartnerItem) => {
    try {
      const payload = exportFilesForItem(item);
      payload.files.forEach((file) => downloadPartnerItemFile(file.relativePath, file.content));
      const targetText = item.type === 'world_book'
        ? `已下载 ${payload.files.length} 个文件（浏览器下载）`
        : `已下载：${payload.files[0]?.relativePath || ''}`;
      message.success(`${partnerTypeLabel(item.type)}导出成功，${targetText}`);
    } catch (err) {
      message.error(`${partnerTypeLabel(item.type)}导出失败：${String(err)}`);
    }
  };

  const handleChooseMuseAiFormat = () => {
    const item = exportFormatModalItem;
    setUiField('exportFormatModalItem', null);
    if (item) {
      handleExportPartnerItem(item);
    }
  };

  const handleStartSillyTavernConvert = async (item: PartnerItem) => {
    setUiField('exportFormatModalItem', null);
    setUiField('sillyTavernExportItem', item);
    setUiField('sillyTavernPreviewOpen', true);
    setUiField('sillyTavernConverting', true);
    setUiField('sillyTavernConvertError', null);
    setUiField('sillyTavernPreviewJson', null);

    const sourceCharacterCard = {
      name: item.name,
      fields: normalizePartnerFields(item.fields),
      content: item.content,
    };
    const worldBook = item.worldBookId
      ? worldBooks.find((wb) => wb.id === item.worldBookId)
      : null;
    const worldBookEntries = worldBook
      ? { name: worldBook.name, fields: normalizePartnerFields(worldBook.fields), content: worldBook.content }
      : undefined;

    const agentConfig = settings.agentConfigs?.sillyTavernExporter || {};

    try {
      const result = await complete({
        ...settings.dshModelSelection,
        system: settings.sillyTavernExporterPrompt,
        messages: [{ role: 'user', content: buildSillyTavernUserPrompt(sourceCharacterCard, worldBookEntries) }],
        temperature: agentConfig.temperature ?? 0,
        maxTokens: agentConfig.maxOutputTokens ?? 32000,
        thinkingDepth: agentConfig.thinkingDepth ?? 'high',
      });
      const cleaned = extractJsonText(result.text);
      try {
        JSON.parse(cleaned);
      } catch (parseError) {
        throw new Error(`模型没有返回合法 JSON，请重新分析：${String(parseError)}`);
      }
      setUiField('sillyTavernPreviewJson', cleaned);
    } catch (err) {
      setUiField('sillyTavernConvertError', String(err));
    } finally {
      setUiField('sillyTavernConverting', false);
    }
  };

  const handleRetrySillyTavernConvert = () => {
    const item = sillyTavernExportItem;
    if (item) {
      handleStartSillyTavernConvert(item);
    }
  };

  const handleConfirmSillyTavernExport = () => {
    const item = sillyTavernExportItem;
    const cardJson = sillyTavernPreviewJson;
    if (!item || !cardJson) return;

    try {
      const fileName = `sillytavern-character-card-${item.name || '未命名角色卡'}.json`;
      downloadPartnerItemFile(fileName, cardJson);
      message.success('SillyTavern 角色卡导出成功，已开始下载');
      setUiField('sillyTavernPreviewOpen', false);
      setUiField('sillyTavernPreviewJson', null);
      setUiField('sillyTavernExportItem', null);
      setUiField('sillyTavernConvertError', null);
    } catch (err) {
      message.error(`SillyTavern 角色卡导出失败：${String(err)}`);
    }
  };

  const handleCancelSillyTavernPreview = () => {
    setUiField('sillyTavernPreviewOpen', false);
    setUiField('sillyTavernPreviewJson', null);
    setUiField('sillyTavernConvertError', null);
    setUiField('sillyTavernExportItem', null);
  };

  const handleRequestImportPartnerItems = (type: PartnerImportExportType) => {
    pendingImportTypeRef.current = type;
    if (importInputRef.current) {
      importInputRef.current.value = '';
      importInputRef.current.click();
    }
  };

  const handleImportPartnerItemsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const type = pendingImportTypeRef.current;
    try {
      const texts = await Promise.all(files.map((file) => file.text()));
      const result = importPartnerItemsPackages(texts, type);
      const worldBookCount = result.worldBookIds.length;
      const characterCardCount = result.characterCardIds.length;
      const failedCount = result.failedCount || 0;
      if (worldBookCount === 0 && characterCardCount === 0) {
        throw new Error('所选文件中没有可导入的内容');
      }
      const countText = type === 'world_book'
        ? `新增 ${worldBookCount} 个世界书${characterCardCount > 0 ? `、${characterCardCount} 个角色卡` : ''}`
        : `新增 ${characterCardCount} 个角色卡${worldBookCount > 0 ? `、${worldBookCount} 个世界书` : ''}`;
      const failText = failedCount > 0 ? `，${failedCount} 个文件导入失败` : '';
      message.success(`${partnerTypeLabel(type)}导入完成，${countText}${failText}`);
    } catch (err) {
      message.error(`${partnerTypeLabel(type)}导入失败：${String(err)}`);
    } finally {
      event.target.value = '';
    }
  };

  // Find currently selected item
  const selectedItem = selectedType === 'world_book' 
    ? worldBooks.find(b => b.id === selectedId) 
    : characterCards.find(c => c.id === selectedId);
  const characterCardGroups = useMemo(
    () => groupCharacterCardsByWorldBook(worldBooks, characterCards),
    [worldBooks, characterCards],
  );
  const characterCardGroupKeys = useMemo(
    () => characterCardGroups.map((group) => group.key),
    [characterCardGroups],
  );

  useEffect(() => {
    const previousGroupKeys = knownCharacterGroupKeysRef.current;
    knownCharacterGroupKeysRef.current = characterCardGroupKeys;
    const characterCardGroupKeySet = new Set(characterCardGroupKeys);
    const previousGroupKeySet = new Set(previousGroupKeys);

    setUiField('expandedCharacterGroupKeys', (previousKeys) => {
      if (!hasInitializedCharacterGroupsRef.current) {
        hasInitializedCharacterGroupsRef.current = true;
        return characterCardGroupKeys;
      }

      const validKeys = previousKeys.filter((key) => characterCardGroupKeySet.has(String(key)));
      const newKeys = characterCardGroupKeys.filter((key) => !previousGroupKeySet.has(key));
      return [...validKeys, ...newKeys];
    });
  }, [characterCardGroupKeys, setUiField]);

  // Sync editName when item name changes or new item is selected
  const handleFieldChange = (key: keyof PartnerItemFields, value: string | string[] | CustomField[] | undefined) => {
    if (selectedItem) {
      updateItemFields(selectedItem.id, selectedItem.type, { [key]: value });
    }
  };

  // Tag manipulation for Character Card
  const handleRemoveTag = (removedTag: string) => {
    if (selectedItem) {
      const currentTags = selectedItem.fields?.identityTags || [];
      const nextTags = currentTags.filter(tag => tag !== removedTag);
      handleFieldChange('identityTags', nextTags);
    }
  };

  const handleAddTagConfirm = () => {
    if (selectedItem && tagInputValue.trim()) {
      const currentTags = selectedItem.fields?.identityTags || [];
      if (!currentTags.includes(tagInputValue.trim())) {
        const nextTags = [...currentTags, tagInputValue.trim()];
        handleFieldChange('identityTags', nextTags);
      }
    }
    setTagInputVisible(false);
    setTagInputValue('');
  };

  const showTagInput = () => {
    setTagInputVisible(true);
  };

  const renderDirectoryItem = (item: PartnerItem) => {
    const isSelected = selectedId === item.id;
    const isEditing = editingId === item.id;

    return (
      <div
        key={item.id}
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={0}
        onClick={() => {
          stylePresetStore.selectPreset(null);
          selectItem(item.id, item.type);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            stylePresetStore.selectPreset(null);
            selectItem(item.id, item.type);
          }
        }}
        onDoubleClick={(e) => handleStartRename(item, e)}
        className={`directory-item-hover background-directory-item ${isSelected ? 'is-selected' : ''}`}
      >
        <div className="background-directory-item__body">
          {item.type === 'world_book' ? (
            <GlobalOutlined style={{ fontSize: 15, flexShrink: 0, color: isSelected ? '#d97757' : '#8c8882' }} />
          ) : (
            <UserOutlined style={{ fontSize: 15, flexShrink: 0, color: isSelected ? '#d97757' : '#8c8882' }} />
          )}

          {isEditing ? (
            <Input
              ref={renameInputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleSaveRename(item)}
              onPressEnter={() => handleSaveRename(item)}
              size="small"
              style={{
                height: 22,
                padding: '0 4px',
                fontSize: 13,
                borderColor: '#d97757',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="background-directory-item__name">
              {item.name}
            </span>
          )}
        </div>

        {!isEditing && (
          <div className="directory-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title="重命名" mouseEnterDelay={0.8}>
              <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined style={{ fontSize: 12 }} />} 
                onClick={(e) => handleStartRename(item, e)}
                style={{ width: 20, height: 20, padding: 0, display: 'none' }}
                className="action-btn"
              />
            </Tooltip>
            <Tooltip title="删除" mouseEnterDelay={0.8}>
              <Button 
                aria-label={`${item.type === 'world_book' ? '删除世界书' : '删除角色卡'} ${item.name}`}
                type="text" 
                danger
                size="small" 
                icon={<DeleteOutlined style={{ fontSize: 12 }} />} 
                onClick={(e) => handleDeleteItem(item.id, item.type, e)}
                style={{ width: 20, height: 20, padding: 0, display: 'none' }}
                className="action-btn"
              />
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  const renderCharacterCardTreeTitle = (item: PartnerItem) => {
    const isSelected = selectedType === 'character_card' && selectedId === item.id;
    const isEditing = editingId === item.id;

    return (
      <div
        className={`character-tree-item ${isSelected ? 'is-selected' : ''}`}
        onDoubleClick={(e) => handleStartRename(item, e)}
      >
        <div className="background-directory-item__body">
          <UserOutlined style={{ fontSize: 14, flexShrink: 0, color: isSelected ? '#d97757' : '#8c8882' }} />
          {isEditing ? (
            <Input
              ref={renameInputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleSaveRename(item)}
              onPressEnter={() => handleSaveRename(item)}
              size="small"
              style={{ height: 22, padding: '0 4px', fontSize: 13, borderColor: '#d97757' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="background-directory-item__name">
              {item.name}
            </span>
          )}
        </div>

        {!isEditing && (
          <div className="directory-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title="重命名" mouseEnterDelay={0.8}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => handleStartRename(item, e)}
                style={{ width: 20, height: 20, padding: 0, display: 'none' }}
                className="action-btn"
              />
            </Tooltip>
            <Tooltip title="删除" mouseEnterDelay={0.8}>
              <Button
                aria-label={`${item.type === 'world_book' ? '删除世界书' : '删除角色卡'} ${item.name}`}
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => handleDeleteItem(item.id, item.type, e)}
                style={{ width: 20, height: 20, padding: 0, display: 'none' }}
                className="action-btn"
              />
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  const toggleCharacterGroup = (groupKey: string) => {
    setExpandedCharacterGroupKeys((keys) =>
      keys.includes(groupKey) ? keys.filter((key) => key !== groupKey) : [...keys, groupKey]
    );
  };

  const characterCardTreeData = characterCardGroups.map((group) => ({
    key: group.key,
    selectable: false,
    title: (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#8c8882', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
      >
        <BookOutlined style={{ fontSize: 13, color: group.worldBookId ? '#d97757' : '#c0bbb4' }} />
        {group.title}
      </span>
    ),
    children: group.cards.map((card) => ({
      key: card.id,
      title: renderCharacterCardTreeTitle(card),
      isLeaf: true,
    })),
  }));

  // Rendering World Book Config UI
  const renderWorldBookForm = (item: PartnerItem) => {
    const fields = normalizePartnerFields(item.fields);

    return (
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card className="custom-form-card" title={<span className="form-section-title"><CompassOutlined style={{ color: '#d97757' }} /> 基本世界设定</span>} size="small">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div className="input-label">世界名称</div>
              <Input 
                value={item.name} 
                className="custom-form-input"
                placeholder="请输入世界观名称"
                onChange={(e) => updateItemName(item.id, item.type, e.target.value)}
              />
            </Col>
            <Col span={12}>
              <div className="input-label">核心主题</div>
              <Input 
                value={fields.theme || ''} 
                className="custom-form-input"
                placeholder="例如：魔法冒险 / 奇幻史诗 / 蒸汽朋克"
                onChange={(e) => handleFieldChange('theme', e.target.value)}
              />
            </Col>
            <Col span={8}>
              <div className="input-label">时代背景</div>
              <Input 
                value={fields.era || ''} 
                className="custom-form-input"
                placeholder="例如：魔法工业时代 / 中世纪末期"
                onChange={(e) => handleFieldChange('era', e.target.value)}
              />
            </Col>
            <Col span={8}>
              <div className="input-label">科技水平</div>
              <Input 
                value={fields.techLevel || ''} 
                className="custom-form-input"
                placeholder="例如：蒸汽机与简单电气"
                onChange={(e) => handleFieldChange('techLevel', e.target.value)}
              />
            </Col>
            <Col span={8}>
              <div className="input-label">魔法水平</div>
              <Input 
                value={fields.magicLevel || ''} 
                className="custom-form-input"
                placeholder="例如：高魔世界 / 以太广泛应用"
                onChange={(e) => handleFieldChange('magicLevel', e.target.value)}
              />
            </Col>
          </Row>
          <CustomFieldsBlock
            item={item}
            moduleId="world_basic"
            addCustomField={addCustomField}
            updateCustomField={updateCustomField}
            removeCustomField={removeCustomField}
          />
        </Card>

        <Card className="custom-form-card" title={<span className="form-section-title"><GlobalOutlined style={{ color: '#d97757' }} /> 核心世界观架构</span>} size="small">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <div className="input-label">地理格局</div>
              <Input.TextArea 
                value={fields.geography || ''} 
                autoSize={{ minRows: 2, maxRows: 6 }}
                className="custom-form-input"
                placeholder="描述大陆分布、主要地理特征及气候格局..."
                onChange={(e) => handleFieldChange('geography', e.target.value)}
              />
            </div>
            <div>
              <div className="input-label">关键场景</div>
              <Input.TextArea 
                value={fields.keyScenes || ''} 
                autoSize={{ minRows: 2, maxRows: 6 }}
                className="custom-form-input"
                placeholder="列出故事展开的核心场景地标，如“奥兰魔法学院大图书馆”..."
                onChange={(e) => handleFieldChange('keyScenes', e.target.value)}
              />
            </div>
            <div>
              <div className="input-label">文化特色</div>
              <Input.TextArea 
                value={fields.culturalFeatures || ''} 
                autoSize={{ minRows: 2, maxRows: 6 }}
                className="custom-form-input"
                placeholder="描述各族群的风俗习惯、宗教信仰、以及对魔法/科技的社会观念..."
                onChange={(e) => handleFieldChange('culturalFeatures', e.target.value)}
              />
            </div>
            <div>
              <div className="input-label">历史事件</div>
              <Input.TextArea 
                value={fields.history || ''} 
                autoSize={{ minRows: 2, maxRows: 6 }}
                className="custom-form-input"
                placeholder="列出世界观下具有深远影响的历史大战、协议签署或重大转折点..."
                onChange={(e) => handleFieldChange('history', e.target.value)}
              />
            </div>
            <div>
              <div className="input-label">核心矛盾</div>
              <Input.TextArea 
                value={fields.conflict || ''} 
                autoSize={{ minRows: 2, maxRows: 6 }}
                className="custom-form-input"
                placeholder="描述当前世界最激烈的矛盾冲突，如“魔法保守势力与科技工业党派的对立”..."
                onChange={(e) => handleFieldChange('conflict', e.target.value)}
              />
            </div>
            <CustomFieldsBlock
              item={item}
              moduleId="world_core"
              addCustomField={addCustomField}
              updateCustomField={updateCustomField}
              removeCustomField={removeCustomField}
            />
          </Space>
        </Card>
      </Space>
    );
  };

  // Rendering Character Card Config UI
  const renderCharacterCardForm = (item: PartnerItem) => {
    const fields = normalizePartnerFields(item.fields);
    const ownerSelectValue = item.worldBookId && worldBooks.some((worldBook) => worldBook.id === item.worldBookId)
      ? item.worldBookId
      : UNASSIGNED_CHARACTER_CARD_GROUP_ID;

    const tabItems = [
      {
        key: '1',
        label: '基础与标签',
        children: (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Card className="custom-sub-card" title="基本身份信息" size="small">
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <div className="input-label">姓名</div>
                  <Input 
                    value={item.name} 
                    className="custom-form-input"
                    placeholder="请输入角色姓名"
                    onChange={(e) => updateItemName(item.id, item.type, e.target.value)}
                  />
                </Col>
                <Col span={12}>
                  <div className="input-label">归属世界书</div>
                  <Select
                    aria-label="归属世界书"
                    value={ownerSelectValue}
                    onChange={(value) => updateCharacterCardWorldBook(
                      item.id,
                      value === UNASSIGNED_CHARACTER_CARD_GROUP_ID ? null : value,
                    )}
                    options={[
                      { value: UNASSIGNED_CHARACTER_CARD_GROUP_ID, label: '未归属' },
                      ...worldBooks.map((worldBook) => ({ value: worldBook.id, label: worldBook.name })),
                    ]}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={6}>
                  <div className="input-label">年龄</div>
                  <Input 
                    value={fields.age || ''} 
                    className="custom-form-input"
                    placeholder="例如：18岁"
                    onChange={(e) => handleFieldChange('age', e.target.value)}
                  />
                </Col>
                <Col span={6}>
                  <div className="input-label">性别</div>
                  <Input 
                    value={fields.gender || ''} 
                    className="custom-form-input"
                    placeholder="例如：男"
                    onChange={(e) => handleFieldChange('gender', e.target.value)}
                  />
                </Col>
                <Col span={8}>
                  <div className="input-label">种族</div>
                  <Input 
                    value={fields.race || ''} 
                    className="custom-form-input"
                    placeholder="例如：人类 / 精灵"
                    onChange={(e) => handleFieldChange('race', e.target.value)}
                  />
                </Col>
                <Col span={8}>
                  <div className="input-label">出生地</div>
                  <Input 
                    value={fields.birthplace || ''} 
                    className="custom-form-input"
                    placeholder="例如：边境小镇"
                    onChange={(e) => handleFieldChange('birthplace', e.target.value)}
                  />
                </Col>
                <Col span={8}>
                  <div className="input-label">职业</div>
                  <Input 
                    value={fields.occupation || ''} 
                    className="custom-form-input"
                    placeholder="例如：学院高级学员"
                    onChange={(e) => handleFieldChange('occupation', e.target.value)}
                  />
                </Col>
                <Col span={24}>
                  <div className="input-label">社会阶层</div>
                  <Input 
                    value={fields.socialClass || ''} 
                    className="custom-form-input"
                    placeholder="描述角色的社会地位，例如：“平民出身，凭天赋获得奖学金入学”"
                    onChange={(e) => handleFieldChange('socialClass', e.target.value)}
                  />
                </Col>
              </Row>
            </Card>

            <Card className="custom-sub-card" title="身份标签 (按回车或失去焦点保存)" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 4px', alignItems: 'center' }}>
                {(fields.identityTags || []).map((tag) => (
                  <Tag
                    key={tag}
                    closable
                    onClose={() => handleRemoveTag(tag)}
                    className="background-identity-tag"
                  >
                    {tag}
                  </Tag>
                ))}
                {tagInputVisible ? (
                  <Input
                    ref={tagInputRef}
                    type="text"
                    size="small"
                    style={{ width: 100, height: 26 }}
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onBlur={handleAddTagConfirm}
                    onPressEnter={handleAddTagConfirm}
                  />
                ) : (
                  <Button 
                    type="dashed" 
                    size="small" 
                    icon={<PlusOutlined />} 
                    onClick={showTagInput}
                    style={{ 
                      height: 26, 
                      fontSize: 12, 
                      borderRadius: 4,
                      color: '#8c8882',
                      borderColor: 'rgba(0,0,0,0.1)'
                    }}
                  >
                    新增标签
                  </Button>
                )}
              </div>
            </Card>
            <CustomFieldsBlock
              item={item}
              moduleId="char_basic"
              addCustomField={addCustomField}
              updateCustomField={updateCustomField}
              removeCustomField={removeCustomField}
            />
          </Space>
        )
      },
      {
        key: '2',
        label: '外貌与性格',
        children: (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Card className="custom-sub-card" title="外貌气质设定" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div className="input-label">身高体型</div>
                    <Input 
                      value={fields.heightBuild || ''} 
                      className="custom-form-input"
                      placeholder="如：“178cm，体型匀称偏瘦”"
                      onChange={(e) => handleFieldChange('heightBuild', e.target.value)}
                    />
                  </Col>
                  <Col span={12}>
                    <div className="input-label">标志性特征</div>
                    <Input 
                      value={fields.iconicFeatures || ''} 
                      className="custom-form-input"
                      placeholder="如：“手背上有淡蓝色以太烙印”"
                      onChange={(e) => handleFieldChange('iconicFeatures', e.target.value)}
                    />
                  </Col>
                </Row>
                <div>
                  <div className="input-label">衣着风格</div>
                  <Input.TextArea 
                    value={fields.clothingStyle || ''} 
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    className="custom-form-input"
                    placeholder="描述角色常穿服饰及随身携带的物品..."
                    onChange={(e) => handleFieldChange('clothingStyle', e.target.value)}
                  />
                </div>
                <div>
                  <div className="input-label">整体气质</div>
                  <Input.TextArea 
                    value={fields.overallVibe || ''} 
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    className="custom-form-input"
                    placeholder="给旁人留下的直观感觉，如“温和沉静，偶尔闪过警惕”..."
                    onChange={(e) => handleFieldChange('overallVibe', e.target.value)}
                  />
                </div>
              </Space>
            </Card>

            <Card className="custom-sub-card" title="性格内里特征" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div className="input-label">外在性格 (表现给外界看的一面)</div>
                    <Input.TextArea 
                      value={fields.externalPersonality || ''} 
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      className="custom-form-input"
                      placeholder="如：“温和谦逊，乐于助人，靠谱同伴”"
                      onChange={(e) => handleFieldChange('externalPersonality', e.target.value)}
                    />
                  </Col>
                  <Col span={12}>
                    <div className="input-label">内在性格 (真实的自我本质)</div>
                    <Input.TextArea 
                      value={fields.internalPersonality || ''} 
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      className="custom-form-input"
                      placeholder="如：“冷静克制，心防极重，权衡明确”"
                      onChange={(e) => handleFieldChange('internalPersonality', e.target.value)}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <div className="input-label">核心欲望 (内在的最强驱动力)</div>
                    <Input.TextArea 
                      value={fields.coreDesire || ''} 
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      className="custom-form-input"
                      placeholder="如：“探寻魔法底层原理，安全回家”"
                      onChange={(e) => handleFieldChange('coreDesire', e.target.value)}
                    />
                  </Col>
                  <Col span={12}>
                    <div className="input-label">恐惧与弱点 (最大的软肋)</div>
                    <Input.TextArea 
                      value={fields.fearWeakness || ''} 
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      className="custom-form-input"
                      placeholder="如：“穿越的秘密泄露被当成异端净化”"
                      onChange={(e) => handleFieldChange('fearWeakness', e.target.value)}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <div className="input-label">道德观念 (是非对错底线)</div>
                    <Input.TextArea 
                      value={fields.moralValues || ''} 
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      className="custom-form-input"
                      placeholder="如：“不主动害人，安全受威胁时果断反击”"
                      onChange={(e) => handleFieldChange('moralValues', e.target.value)}
                    />
                  </Col>
                  <Col span={12}>
                    <div className="input-label">怪癖 (独特有趣的习惯动作)</div>
                    <Input.TextArea 
                      value={fields.quirk || ''} 
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      className="custom-form-input"
                      placeholder="如：“思考难题时下意识用食指轻敲太阳穴”"
                      onChange={(e) => handleFieldChange('quirk', e.target.value)}
                    />
                  </Col>
                </Row>
              </Space>
            </Card>
            <CustomFieldsBlock
              item={item}
              moduleId="char_appearance"
              addCustomField={addCustomField}
              updateCustomField={updateCustomField}
              removeCustomField={removeCustomField}
            />
          </Space>
        )
      },
      {
        key: '3',
        label: '能力与经历',
        children: (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Card className="custom-sub-card" title="硬核能力与经历" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <div className="input-label">技能专长</div>
                  <Input.TextArea 
                    value={fields.skills || ''} 
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    className="custom-form-input"
                    placeholder="描述角色掌握的魔法、体术、科学知识或其他特长..."
                    onChange={(e) => handleFieldChange('skills', e.target.value)}
                  />
                </div>
                <div>
                  <div className="input-label">背景故事</div>
                  <Input.TextArea 
                    value={fields.backgroundStory || ''} 
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    className="custom-form-input"
                    placeholder="记叙角色过去的重要成长事件，如何成为现在的自己..."
                    onChange={(e) => handleFieldChange('backgroundStory', e.target.value)}
                  />
                </div>
                <div>
                  <div className="input-label">人际关系</div>
                  <Input.TextArea 
                    value={fields.relationships || ''} 
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    className="custom-form-input"
                    placeholder="描述与配角、敌对势力、导师或死党的关系关联..."
                    onChange={(e) => handleFieldChange('relationships', e.target.value)}
                  />
                </div>
              </Space>
            </Card>

            <Card className="custom-sub-card" title="语言表达风格" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <div className="input-label">说话方式</div>
                  <Input.TextArea 
                    value={fields.speakingStyle || ''} 
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    className="custom-form-input"
                    placeholder="口癖、语气节奏，如：“语气不温不火，喜欢用'根据我的观察...'”..."
                    onChange={(e) => handleFieldChange('speakingStyle', e.target.value)}
                  />
                </div>
                <div>
                  <div className="input-label">典型反应</div>
                  <Input.TextArea 
                    value={fields.typicalReactions || ''} 
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    className="custom-form-input"
                    placeholder="遇到不同突发事件的本能反应，如“遭遇危机时瞳孔微缩但绝不惊慌”..."
                    onChange={(e) => handleFieldChange('typicalReactions', e.target.value)}
                  />
                </div>
              </Space>
            </Card>
            <CustomFieldsBlock
              item={item}
              moduleId="char_ability"
              addCustomField={addCustomField}
              updateCustomField={updateCustomField}
              removeCustomField={removeCustomField}
            />
          </Space>
        )
      },
      {
        key: '4',
        label: '角色记忆',
        children: (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Card className="custom-sub-card" title="与用户关系设定（大模型提取或手动输入）" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <div className="input-label">与用户关系类型</div>
                  <Input 
                    value={fields.userRelationType || ''} 
                    className="custom-form-input"
                    placeholder="例如：欢喜冤家、生死之交、师徒、针锋相对的竞争对手..."
                    onChange={(e) => handleFieldChange('userRelationType', e.target.value)}
                  />
                </div>
                <div>
                  <div className="input-label">与用户相处模式</div>
                  <Input.TextArea 
                    value={fields.userInteractionModel || ''} 
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    className="custom-form-input"
                    placeholder="描述该角色如何与用户互动交往。例如：表面上冷嘲热讽但关键时刻极其护短、以礼相待保持分寸、主动热情爱开玩笑..."
                    onChange={(e) => handleFieldChange('userInteractionModel', e.target.value)}
                  />
                </div>
                <div>
                  <div className="input-label">与用户关系底线</div>
                  <Input.TextArea 
                    value={fields.userRelationBottomLine || ''} 
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    className="custom-form-input"
                    placeholder="描述该角色在与用户相处时的底线。例如：绝对不能容忍欺骗、一旦涉及家族利益会优先站在家族立场、禁止打听其右手烙印的秘密..."
                    onChange={(e) => handleFieldChange('userRelationBottomLine', e.target.value)}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div className="input-label" style={{ margin: 0 }}>关键事件</div>
                    <Button
                      type="text"
                      size="small"
                      disabled={isOptimizing}
                      icon={isOptimizing ? <LoadingOutlined spin /> : <ThunderboltOutlined style={{ color: '#d97757' }} />}
                      onClick={() => handleOptimizeMemories(fields.keyEvents || '')}
                      className="background-optimize-button"
                    >
                      {isOptimizing ? 'AI 优化中...' : 'AI 浓缩与优化'}
                    </Button>
                  </div>
                  <Input.TextArea 
                    value={fields.keyEvents || ''} 
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    className="custom-form-input"
                    placeholder="记录该角色与用户共同经历的重要里程碑事件（推荐以点列或时间线形式记录）..."
                    onChange={(e) => handleFieldChange('keyEvents', e.target.value)}
                  />
                </div>
              </Space>
            </Card>
            <CustomFieldsBlock
              item={item}
              moduleId="char_memory"
              addCustomField={addCustomField}
              updateCustomField={updateCustomField}
              removeCustomField={removeCustomField}
            />
          </Space>
        )
      }
    ];

    return (
      <div className="custom-tab" style={{ width: '100%' }}>
        <Tabs items={tabItems} defaultActiveKey="1" size="middle" />
      </div>
    );
  };

  return (
      <div className="background-page">
      {/* CSS injection for aesthetic styling and theme preservation */}
      <style>{`
        .directory-item-hover:hover {
          background-color: #faf6f0;
        }
        .background-page {
          display: flex;
          height: 100%;
          width: 100%;
          overflow: hidden;
          background: #faf9f5;
        }
        .background-directory-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          margin: 4px 8px;
          padding: 8px 12px;
          border-radius: 6px;
          color: #33312e;
          cursor: pointer;
          transition: background-color 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), color 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .background-directory-item.is-selected,
        .character-tree-item.is-selected {
          background: #f2e8dc;
          color: #d97757;
        }
        .background-directory-item__body {
          display: flex;
          flex: 1;
          min-width: 0;
          align-items: center;
          gap: 8px;
        }
        .background-directory-item__name {
          overflow: hidden;
          font-size: 13px;
          font-weight: 400;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .background-directory-item.is-selected .background-directory-item__name,
        .character-tree-item.is-selected .background-directory-item__name {
          font-weight: 500;
        }
        .character-tree-item {
          display: flex;
          min-height: 30px;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px;
          border-radius: 6px;
          color: #33312e;
        }
        .background-identity-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border: 1px solid #f2e8dc;
          border-radius: 4px;
          background-color: #faf6f0;
          color: #d97757;
          font-size: 13px;
        }
        .background-optimize-button.ant-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 22px;
          border: 1px solid #f2e8dc;
          border-radius: 4px;
          background: #faf6f0;
          color: #d97757;
          font-size: 11px;
        }
        .directory-item-hover:hover .action-btn {
          display: inline-flex !important;
        }
        .character-tree-item:hover {
          background-color: #faf6f0 !important;
        }
        .character-tree-item:hover .action-btn,
        .character-tree-item.is-selected .action-btn {
          display: inline-flex !important;
        }
        .character-card-tree .ant-tree-treenode {
          padding: 0 8px 2px 8px !important;
        }
        .character-card-tree .ant-tree-node-content-wrapper {
          flex: 1;
          min-width: 0;
          padding: 0 !important;
          border-radius: 6px !important;
        }
        .character-card-tree .ant-tree-node-content-wrapper.ant-tree-node-selected {
          background: transparent !important;
        }
        .character-card-tree .ant-tree-switcher {
          color: #c0bbb4;
        }
        .directory-item-hover .action-btn:hover {
          background-color: rgba(0, 0, 0, 0.04) !important;
        }
        .add-category-btn {
          color: #8c8882;
          transition: all 0.2s;
        }
        .add-category-btn:hover {
          color: #d97757 !important;
          background-color: #f2e8dc !important;
        }
        .background-ai-button.ant-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 24px;
          padding: 2px 8px;
          border: 1px solid #f2e8dc;
          border-radius: 4px;
          background: #faf6f0;
          color: #d97757;
          font-size: 12px;
        }
        .background-category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 16px 4px 20px;
          color: #8c8882;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
        }
        .background-export-button.ant-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 1px solid rgba(0, 0, 0, 0.03);
          border-radius: 6px;
          background: #faf9f5;
        }
        .background-character-error-pre {
          max-height: 220px;
          margin: 0;
          padding: 10px;
          overflow: auto;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 6px;
          background: #fff;
          font-family: Consolas, Monaco, "Courier New", monospace;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        /* Premium custom styles for inputs and forms */
        .input-label {
          font-size: 12px;
          color: #8c8882;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .custom-form-input {
          border-radius: 6px !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          transition: all 0.2s !important;
          font-family: inherit !important;
        }
        .custom-form-input:focus, .custom-form-input-focused {
          border-color: #d97757 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.1) !important;
        }
        .custom-form-input:hover {
          border-color: #d97757 !important;
        }
        .form-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #33312e;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .custom-form-card {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.03) !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.01) !important;
        }
        .custom-form-card .ant-card-head {
          border-bottom: 1px solid rgba(0,0,0,0.02) !important;
          background: #fafafa !important;
          border-top-left-radius: 8px !important;
          border-top-right-radius: 8px !important;
        }
        .custom-sub-card {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.03) !important;
          border-radius: 8px !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.01) !important;
        }
        .custom-sub-card .ant-card-head {
          border-bottom: 1px solid rgba(0,0,0,0.02) !important;
          background: #fbfbfa !important;
          font-size: 13px !important;
          font-weight: 500 !important;
        }
        
        /* Custom tabs styling in warm palette */
        .custom-tab .ant-tabs-nav::before {
          border-bottom: 1px solid rgba(0,0,0,0.03) !important;
        }
        .custom-tab .ant-tabs-tab {
          padding: 8px 12px !important;
        }
        .custom-tab .ant-tabs-tab-btn {
          color: #8c8882 !important;
          font-weight: 400 !important;
        }
        .custom-tab .ant-tabs-tab-btn:hover {
          color: #d97757 !important;
        }
        .custom-tab .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #d97757 !important;
          font-weight: 600 !important;
        }
        .custom-tab .ant-tabs-ink-bar {
          background: #d97757 !important;
          height: 2px !important;
        }
        
        /* Premium Magazine-like preview styling */
        .markdown-preview-container {
          background-color: #ffffff;
          padding: 32px 40px;
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.03);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.01);
          color: #33312e;
          font-family: Georgia, -apple-system-font, "STSong", "Songti SC", serif;
          line-height: 1.8;
          font-size: 15px;
          max-width: 760px;
          margin: 0 auto;
          width: 100%;
        }
        .markdown-preview-container h1 {
          font-size: 26px;
          font-weight: 700;
          border-bottom: 2px solid #f2e8dc;
          padding-bottom: 10px;
          margin-bottom: 24px;
          color: #33312e;
          text-align: center;
        }
        .markdown-preview-container h2 {
          font-size: 18px;
          font-weight: 600;
          margin-top: 28px;
          margin-bottom: 16px;
          color: #d97757;
          border-left: 3px solid #d97757;
          padding-left: 10px;
        }
        .markdown-preview-container p {
          margin-bottom: 16px;
          text-align: justify;
        }
        .markdown-preview-container ul {
          padding-left: 20px;
          margin-bottom: 18px;
        }
        .markdown-preview-container li {
          margin-bottom: 8px;
        }
        .markdown-preview-container code {
          background-color: #faf6f0;
          color: #d97757;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: Consolas, Monaco, monospace;
        }
      `}</style>

      {/* Left Directory Sidebar */}
      <div style={{ 
        width: DIRECTORY_WIDTH, 
        minWidth: DIRECTORY_WIDTH, 
        borderRight: '1px solid rgba(0, 0, 0, 0.04)', 
        display: 'flex', 
        flexDirection: 'column',
        background: '#ffffff'
      }}>
        <input
          ref={importInputRef}
          type="file"
          multiple
          accept="application/json,.json"
          aria-label="导入世界书或角色卡文件"
          style={{ display: 'none' }}
          onChange={handleImportPartnerItemsFile}
        />
        {/* Title Header */}
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: '1px solid rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ 
            fontSize: 16, 
            fontWeight: 600, 
            color: '#33312e',
            fontFamily: '"Inter", sans-serif'
          }}>
            背景设定
          </span>
        </div>

        {/* Directory Scrollable Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          <StylePresetManager onSelectPreset={() => selectItem(null, null)} />
          
          {/* World Book Category */}
          <div>
            <div className="background-category-header">
              <span>世界书</span>
              <Space size={2}>
                <Tooltip title="导入世界书">
                  <Button
                    aria-label="导入世界书"
                    type="text"
                    size="small"
                    icon={<UploadOutlined style={{ fontSize: 12 }} />}
                    onClick={() => handleRequestImportPartnerItems('world_book')}
                    style={{ width: 22, height: 22, padding: 0 }}
                    className="add-category-btn"
                  />
                </Tooltip>
                <Tooltip title="新增世界书">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined style={{ fontSize: 12 }} />}
                    onClick={() => {
                      stylePresetStore.selectPreset(null);
                      addWorldBook();
                    }}
                    style={{ width: 22, height: 22, padding: 0 }}
                    className="add-category-btn"
                  />
                </Tooltip>
              </Space>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              {worldBooks.length === 0 ? (
                <div style={{ padding: '8px 20px', color: '#c0bbb4', fontSize: 12, fontStyle: 'italic' }}>
                  暂无世界书
                </div>
              ) : (
                worldBooks.map(renderDirectoryItem)
              )}
            </div>
          </div>

          {/* Character Card Category */}
          <div>
            <div className="background-category-header">
              <span>角色卡</span>
              <Space size={2}>
                <Tooltip title="导入角色卡">
                  <Button
                    aria-label="导入角色卡"
                    type="text"
                    size="small"
                    icon={<UploadOutlined style={{ fontSize: 12 }} />}
                    onClick={() => handleRequestImportPartnerItems('character_card')}
                    style={{ width: 22, height: 22, padding: 0 }}
                    className="add-category-btn"
                  />
                </Tooltip>
                <Tooltip title="新增角色卡">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined style={{ fontSize: 12 }} />}
                    onClick={() => {
                      stylePresetStore.selectPreset(null);
                      addCharacterCard();
                    }}
                    style={{ width: 22, height: 22, padding: 0 }}
                    className="add-category-btn"
                  />
                </Tooltip>
              </Space>
            </div>
            
            <div>
              {characterCards.length === 0 ? (
                <div style={{ padding: '8px 20px', color: '#c0bbb4', fontSize: 12, fontStyle: 'italic' }}>
                  暂无角色卡
                </div>
              ) : (
                <Tree
                  className="character-card-tree"
                  expandedKeys={expandedCharacterGroupKeys}
                  onExpand={(keys) => setExpandedCharacterGroupKeys(keys)}
                  selectedKeys={selectedType === 'character_card' && selectedId ? [selectedId] : []}
                  onClick={(_, node) => {
                    const nextKey = String(node.key);
                    if (characterCardGroupKeys.includes(nextKey)) {
                      toggleCharacterGroup(nextKey);
                    }
                  }}
                  onSelect={(keys) => {
                    const nextId = String(keys[0] || '');
                    if (nextId) {
                      stylePresetStore.selectPreset(null);
                      selectItem(nextId, 'character_card');
                    }
                  }}
                  treeData={characterCardTreeData}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Right Config Panel */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden' 
      }}>
        {selectedStylePreset ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <div style={{
              padding: '12px 24px',
              background: '#ffffff',
              borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 52,
            }}>
              <FileProtectOutlined style={{ fontSize: 16, color: '#d97757' }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#33312e' }}>{selectedStylePreset.name}</span>
              <span style={{ fontSize: 12, background: '#f2e8dc', color: '#d97757', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
                文风预设
              </span>
            </div>
            <div style={{ flex: 1, padding: '24px 32px 40px', overflowY: 'auto', background: '#faf9f5' }}>
              <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
                <StylePresetEditor preset={selectedStylePreset} />
              </div>
            </div>
          </div>
        ) : selectedItem ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            width: '100%' 
          }}>
            {/* Header */}
            <div style={{ 
              padding: '12px 24px', 
              background: '#ffffff', 
              borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 52
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedItem.type === 'world_book' ? (
                  <GlobalOutlined style={{ fontSize: 16, color: '#d97757' }} />
                ) : (
                  <UserOutlined style={{ fontSize: 16, color: '#d97757' }} />
                )}
                <span style={{ fontSize: 15, fontWeight: 600, color: '#33312e' }}>
                  {selectedItem.name}
                </span>
                <span style={{ 
                  fontSize: 12,
                  background: '#f2e8dc', 
                  color: '#d97757', 
                  padding: '2px 8px', 
                  borderRadius: 12, 
                  fontWeight: 500
                }}>
                  {selectedItem.type === 'world_book' ? '世界书' : '角色卡'}
                </span>
              </div>

              <Space size={8}>
                <Tooltip title={selectedItem.type === 'world_book' ? '导出当前世界书及归属角色卡' : '导出当前角色卡'}>
                  <Button
                    aria-label={selectedItem.type === 'world_book' ? '导出当前世界书' : '导出当前角色卡'}
                    type="text"
                    size="small"
                    icon={<DownloadOutlined style={{ fontSize: 13, color: '#8c8882' }} />}
                    onClick={() => {
                      if (selectedItem.type === 'character_card') {
                        setUiField('exportFormatModalItem', selectedItem);
                      } else {
                        handleExportPartnerItem(selectedItem);
                      }
                    }}
                    className="background-export-button"
                  />
                </Tooltip>

                {/* Mode Toggle Selector */}
                <Radio.Group
                  value={activeMode}
                  onChange={(e) => setActiveMode(e.target.value)}
                  size="small"
                  style={{
                    padding: 2,
                    background: '#faf9f5',
                    borderRadius: 6,
                    border: '1px solid rgba(0,0,0,0.03)'
                  }}
                >
                  <Radio.Button
                    value="edit"
                    style={{
                      borderRadius: 4,
                      border: 'none',
                      background: activeMode === 'edit' ? '#ffffff' : 'transparent',
                      color: activeMode === 'edit' ? '#d97757' : '#8c8882',
                      boxShadow: activeMode === 'edit' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                      fontWeight: activeMode === 'edit' ? 500 : 400
                    }}
                  >
                    <Space size={4}>
                      <EditFilled style={{ fontSize: 12 }} />
                      <span>编辑配置</span>
                    </Space>
                  </Radio.Button>
                  <Radio.Button
                    value="preview"
                    style={{
                      borderRadius: 4,
                      border: 'none',
                      background: activeMode === 'preview' ? '#ffffff' : 'transparent',
                      color: activeMode === 'preview' ? '#d97757' : '#8c8882',
                      boxShadow: activeMode === 'preview' ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                      fontWeight: activeMode === 'preview' ? 500 : 400
                    }}
                  >
                    <Space size={4}>
                      <EyeOutlined style={{ fontSize: 12 }} />
                      <span>效果预览</span>
                    </Space>
                  </Radio.Button>
                </Radio.Group>
              </Space>
            </div>

            {/* Scrollable Work Area */}
            <div style={{ 
              flex: 1, 
              padding: '24px 32px 40px 32px', 
              overflowY: 'auto',
              background: '#faf9f5'
            }}>
              {activeMode === 'edit' ? (
                // Form Editor View
                <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
                  {selectedItem.type === 'world_book' 
                    ? renderWorldBookForm(selectedItem) 
                    : renderCharacterCardForm(selectedItem)
                  }
                </div>
              ) : (
                // Elegant Markdown Preview View
                <div className="markdown-preview-container">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedItem.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#faf9f5' 
          }}>
            <Empty
              image={<CompassOutlined style={{ fontSize: 64, color: '#c0bbb4' }} />}
              description={
                <span style={{ color: '#8c8882', fontSize: 14 }}>
                  请在左侧目录中选择或新建一个文风预设、世界书或角色卡来查看配置。
                </span>
              }
            />
          </div>
        )}
      </div>

      <Modal
        title="删除世界书"
        open={Boolean(pendingWorldBookDelete)}
        onCancel={() => setPendingWorldBookDelete(null)}
        footer={[
          <Button key="delete-world" onClick={handleDeleteWorldBookOnly}>
            删除世界书本身
          </Button>,
          <Button key="delete-bundle" danger type="primary" onClick={handleDeleteWorldBookWithCards}>
            删除世界书及归属的角色卡
          </Button>,
          <Button key="cancel" onClick={() => setPendingWorldBookDelete(null)}>
            取消
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 8 }}>
          确认删除「{pendingWorldBookDelete?.name || '未命名世界书'}」吗？
        </p>
        <p style={{ marginBottom: 0, color: '#8c8882' }}>
          只删除世界书本身时，归属它的角色卡会变为未归属。
        </p>
      </Modal>

      {/* Memory Optimization Review Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#33312e', fontSize: '16px', fontWeight: 600 }}>
            <FileProtectOutlined style={{ color: '#d97757' }} />
            <span>AI 优化与消解逻辑矛盾记忆预览</span>
          </div>
        }
        open={isMemModalOpen}
        onCancel={() => setIsMemModalOpen(false)}
        onOk={handleConfirmOptimize}
        okText="确认更新写入角色卡"
        cancelText="取消"
        width={680}
        styles={{
          body: { padding: '16px 24px' }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '10px 14px', background: '#faf6f0', borderRadius: '8px', border: '1px solid #f2e8dc', color: '#8c8882', fontSize: '12px', lineHeight: 1.5 }}>
            <strong>记忆优化已完成：</strong>大模型已消解逻辑矛盾并浓缩整理完毕。您可以在下方编辑框中直接微调修改，点击“确认更新”即可同步回该角色的“关键事件”中。
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#8c8882', marginBottom: '6px' }}>优化后的关键事件</div>
            <Input.TextArea
              value={optimizedEvents}
              onChange={(e) => setOptimizedEvents(e.target.value)}
              autoSize={{ minRows: 10, maxRows: 16 }}
              className="custom-form-input custom-form-input-focused"
              placeholder="请输入优化后的关键事件记忆内容..."
              style={{ borderRadius: '6px', fontSize: '13px', lineHeight: 1.6 }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="选择导出格式"
        open={Boolean(exportFormatModalItem)}
        onCancel={() => setUiField('exportFormatModalItem', null)}
        footer={[
          <Button key="cancel" onClick={() => setUiField('exportFormatModalItem', null)}>
            取消
          </Button>,
        ]}
        width={420}
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
          <div style={{ color: '#8c8882', fontSize: 13, marginBottom: 4 }}>
            请选择「{exportFormatModalItem?.name || '未命名角色卡'}」的导出格式：
          </div>
          <Button
            block
            size="large"
            onClick={handleChooseMuseAiFormat}
            style={{ textAlign: 'left', height: 'auto', padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>MuseAI 格式</span>
              <span style={{ fontSize: 12, color: '#b4afa7' }}>导出为 MuseAI 角色卡 JSON，可重新导入编辑</span>
            </div>
          </Button>
          <Button
            block
            size="large"
            onClick={() => exportFormatModalItem && handleStartSillyTavernConvert(exportFormatModalItem)}
            style={{ textAlign: 'left', height: 'auto', padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>SillyTavern 格式</span>
              <span style={{ fontSize: 12, color: '#b4afa7' }}>使用大模型转换为 SillyTavern V2 角色卡，预览确认后导出</span>
            </div>
          </Button>
        </div>
      </Modal>

      <SillyTavernExportPreviewModal
        open={sillyTavernPreviewOpen}
        cardJson={sillyTavernPreviewJson}
        loading={sillyTavernConverting}
        error={sillyTavernConvertError}
        onConfirm={handleConfirmSillyTavernExport}
        onRetry={handleRetrySillyTavernConvert}
        onCancel={handleCancelSillyTavernPreview}
      />
    </div>
  );
};

export const BackgroundPage: React.FC = () => useBackgroundView();
