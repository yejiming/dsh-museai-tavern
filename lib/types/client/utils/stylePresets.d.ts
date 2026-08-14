import { StylePreset, StylePresetSegment } from '../stores/useStylePresetStore';
export interface ResolvedStylePresets {
    presets: StylePreset[];
    segments: Array<{
        preset: StylePreset;
        segment: StylePresetSegment;
    }>;
    missingIds: string[];
    totalCharacters: number;
}
export declare const resolveStylePresets: (presets: StylePreset[], selectedIds: string[]) => ResolvedStylePresets;
export declare const prependStylePresets: (baseSystemPrompt: string, presets: StylePreset[], selectedIds: string[]) => string;
