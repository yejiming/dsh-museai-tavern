import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSyncStorage } from '../syncStorage';

export interface StylePresetSegment {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
}

export interface StylePreset {
  id: string;
  name: string;
  segments: StylePresetSegment[];
  createdAt: number;
  updatedAt: number;
}

interface StylePresetState {
  presets: StylePreset[];
  selectedPresetId: string | null;
  addPreset: () => string;
  selectPreset: (id: string | null) => void;
  updatePresetName: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  addSegment: (presetId: string) => string;
  updateSegment: (presetId: string, segmentId: string, patch: Partial<Omit<StylePresetSegment, 'id'>>) => void;
  deleteSegment: (presetId: string, segmentId: string) => void;
  reorderSegments: (presetId: string, sourceIndex: number, targetIndex: number) => void;
}

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createBlankSegment = (): StylePresetSegment => ({
  id: createId('style-segment'),
  title: '未命名提示词',
  content: '',
  enabled: true,
});

export const normalizeStylePresets = (value: unknown): StylePreset[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Partial<StylePreset> & { content?: unknown };
    const now = Date.now();
    const legacyContent = typeof source.content === 'string' ? source.content : '';
    const rawSegments = Array.isArray(source.segments)
      ? source.segments
      : legacyContent
        ? [{ title: '提示词 1', content: legacyContent, enabled: true }]
        : [];
    const segments = rawSegments.flatMap((segment) => {
      if (!segment || typeof segment !== 'object') return [];
      const raw = segment as Partial<StylePresetSegment>;
      return [{
        id: typeof raw.id === 'string' && raw.id ? raw.id : createId('style-segment'),
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '未命名提示词',
        content: typeof raw.content === 'string' ? raw.content : '',
        enabled: raw.enabled !== false,
      }];
    });
    return [{
      id: typeof source.id === 'string' && source.id ? source.id : createId('style-preset'),
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : '未命名预设',
      segments,
      createdAt: typeof source.createdAt === 'number' ? source.createdAt : now,
      updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now,
    }];
  });
};

export const useStylePresetStore = create<StylePresetState>()(
  persist(
    (set) => ({
      presets: [],
      selectedPresetId: null,
      addPreset: () => {
        const now = Date.now();
        const id = createId('style-preset');
        const preset: StylePreset = {
          id,
          name: '未命名预设',
          segments: [createBlankSegment()],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ presets: [...state.presets, preset], selectedPresetId: id }));
        return id;
      },
      selectPreset: (selectedPresetId) => set({ selectedPresetId }),
      updatePresetName: (id, name) => set((state) => ({
        presets: state.presets.map((preset) => preset.id === id
          ? { ...preset, name, updatedAt: Date.now() }
          : preset),
      })),
      deletePreset: (id) => set((state) => ({
        presets: state.presets.filter((preset) => preset.id !== id),
        selectedPresetId: state.selectedPresetId === id ? null : state.selectedPresetId,
      })),
      addSegment: (presetId) => {
        const segment = createBlankSegment();
        set((state) => ({
          presets: state.presets.map((preset) => preset.id === presetId
            ? { ...preset, segments: [...preset.segments, segment], updatedAt: Date.now() }
            : preset),
        }));
        return segment.id;
      },
      updateSegment: (presetId, segmentId, patch) => set((state) => ({
        presets: state.presets.map((preset) => preset.id === presetId ? {
          ...preset,
          segments: preset.segments.map((segment) => segment.id === segmentId ? { ...segment, ...patch } : segment),
          updatedAt: Date.now(),
        } : preset),
      })),
      deleteSegment: (presetId, segmentId) => set((state) => ({
        presets: state.presets.map((preset) => preset.id === presetId ? {
          ...preset,
          segments: preset.segments.filter((segment) => segment.id !== segmentId),
          updatedAt: Date.now(),
        } : preset),
      })),
      reorderSegments: (presetId, sourceIndex, targetIndex) => set((state) => ({
        presets: state.presets.map((preset) => {
          if (preset.id !== presetId || sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= preset.segments.length || targetIndex >= preset.segments.length) return preset;
          const segments = [...preset.segments];
          const [moved] = segments.splice(sourceIndex, 1);
          segments.splice(targetIndex, 0, moved);
          return { ...preset, segments, updatedAt: Date.now() };
        }),
      })),
    }),
    {
      name: 'museai-style-preset-storage',
      storage: createJSONStorage(() => createSyncStorage('stylePresets', 'museai-style-preset-storage')),
      merge: (persistedState, currentState) => ({
        ...currentState,
        presets: normalizeStylePresets((persistedState as Partial<StylePresetState> | undefined)?.presets),
        selectedPresetId: null,
      }),
      partialize: (state) => ({ presets: state.presets }),
    },
  ),
);
