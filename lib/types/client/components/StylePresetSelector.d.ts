import React from 'react';
type StylePresetUsage = 'chat' | 'adventure' | 'bookTravel';
interface StylePresetSelectorProps {
    target: StylePresetUsage;
    value: string | null;
    onChange: (value: string | null) => void;
    compact?: boolean;
    sessionStarted?: boolean;
}
export declare const StylePresetSelector: React.FC<StylePresetSelectorProps>;
export {};
