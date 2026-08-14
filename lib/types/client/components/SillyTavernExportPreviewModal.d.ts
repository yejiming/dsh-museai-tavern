import React from 'react';
export interface SillyTavernCardPreviewData {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    alternate_greetings: string[];
    tags: string[];
    character_book: {
        name?: string;
        entries: unknown[];
    };
}
interface SillyTavernExportPreviewModalProps {
    open: boolean;
    cardJson: string | null;
    loading: boolean;
    error: string | null;
    onConfirm: () => void;
    onRetry: () => void;
    onCancel: () => void;
}
export declare const SillyTavernExportPreviewModal: React.FC<SillyTavernExportPreviewModalProps>;
export {};
