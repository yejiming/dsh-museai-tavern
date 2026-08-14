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
export declare const normalizeStylePresets: (value: unknown) => StylePreset[];
export declare const useStylePresetStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<StylePresetState>, "setState" | "persist"> & {
    setState(partial: StylePresetState | Partial<StylePresetState> | ((state: StylePresetState) => StylePresetState | Partial<StylePresetState>), replace?: false | undefined): unknown;
    setState(state: StylePresetState | ((state: StylePresetState) => StylePresetState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<StylePresetState, unknown, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: StylePresetState) => void) => () => void;
        onFinishHydration: (fn: (state: StylePresetState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<StylePresetState, unknown, unknown>>;
    };
}>;
export {};
