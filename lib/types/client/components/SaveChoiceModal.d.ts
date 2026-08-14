import React from 'react';
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
export declare const SaveChoiceModal: React.FC<SaveChoiceModalProps>;
export default SaveChoiceModal;
