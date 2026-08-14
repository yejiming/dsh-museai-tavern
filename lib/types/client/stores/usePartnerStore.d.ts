export interface CustomField {
    id: string;
    moduleId: string;
    label: string;
    value: string;
}
export interface PartnerItemFields {
    theme?: string;
    era?: string;
    techLevel?: string;
    magicLevel?: string;
    geography?: string;
    keyScenes?: string;
    culturalFeatures?: string;
    history?: string;
    conflict?: string;
    name?: string;
    age?: string;
    gender?: string;
    race?: string;
    birthplace?: string;
    occupation?: string;
    socialClass?: string;
    identityTags?: string[];
    heightBuild?: string;
    iconicFeatures?: string;
    clothingStyle?: string;
    overallVibe?: string;
    externalPersonality?: string;
    internalPersonality?: string;
    coreDesire?: string;
    fearWeakness?: string;
    moralValues?: string;
    quirk?: string;
    skills?: string;
    backgroundStory?: string;
    relationships?: string;
    speakingStyle?: string;
    typicalReactions?: string;
    relationMemory?: string;
    userRelationType?: string;
    userInteractionModel?: string;
    userRelationBottomLine?: string;
    keyEvents?: string;
    customFields?: CustomField[];
}
export interface PartnerItem {
    id: string;
    name: string;
    type: 'world_book' | 'character_card';
    content: string;
    fields?: PartnerItemFields;
    worldBookId?: string | null;
}
export type PartnerImportExportType = 'world_book' | 'character_card';
export interface PartnerItemsPackage {
    schema: 'museai.partner-items';
    version: 1;
    exportedAt: string;
    worldBooks: Array<{
        id?: string;
        name: string;
        fields?: PartnerItemFields;
    }>;
    characterCards: Array<{
        id?: string;
        name: string;
        fields?: PartnerItemFields;
        worldBookId?: string | null;
    }>;
}
export interface PartnerImportResult {
    worldBookIds: string[];
    characterCardIds: string[];
    failedCount?: number;
}
interface PartnerState {
    worldBooks: PartnerItem[];
    characterCards: PartnerItem[];
    selectedId: string | null;
    selectedType: 'world_book' | 'character_card' | null;
    addWorldBook: () => void;
    addCharacterCard: () => void;
    selectItem: (id: string | null, type: 'world_book' | 'character_card' | null) => void;
    deleteItem: (id: string, type: 'world_book' | 'character_card') => void;
    deleteWorldBookWithCharacterCards: (id: string) => void;
    updateItemName: (id: string, type: 'world_book' | 'character_card', name: string) => void;
    updateItemContent: (id: string, type: 'world_book' | 'character_card', content: string) => void;
    updateItemFields: (id: string, type: 'world_book' | 'character_card', fields: PartnerItemFields) => void;
    updateCharacterCardWorldBook: (id: string, worldBookId: string | null) => void;
    addCustomField: (id: string, type: 'world_book' | 'character_card', moduleId: string) => void;
    updateCustomField: (id: string, type: 'world_book' | 'character_card', fieldId: string, updates: Partial<Pick<CustomField, 'label' | 'value'>>) => void;
    removeCustomField: (id: string, type: 'world_book' | 'character_card', fieldId: string) => void;
    importGeneratedItems: (items: {
        worldBooks: Array<{
            name: string;
            fields: PartnerItemFields;
        }>;
        characterCards: Array<{
            name: string;
            fields: PartnerItemFields;
            worldBookId?: string | null;
        }>;
    }) => {
        worldBookIds: string[];
        characterCardIds: string[];
    };
    exportPartnerItems: (type: PartnerImportExportType) => PartnerItemsPackage;
    exportPartnerItem: (type: PartnerImportExportType, id: string) => PartnerItemsPackage;
    exportPartnerItemBundle: (type: PartnerImportExportType, id: string) => PartnerItemsPackage;
    importPartnerItemsPackage: (packageText: string, type: PartnerImportExportType) => PartnerImportResult;
    importPartnerItemsPackages: (packageTexts: string[], type: PartnerImportExportType) => PartnerImportResult;
}
export declare const normalizePartnerFields: (fields?: PartnerItemFields) => PartnerItemFields;
export declare const compileItemToMarkdown: (name: string, type: "world_book" | "character_card", fields: PartnerItemFields) => string;
export declare const usePartnerStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<PartnerState>, "setState" | "persist"> & {
    setState(partial: PartnerState | Partial<PartnerState> | ((state: PartnerState) => PartnerState | Partial<PartnerState>), replace?: false | undefined): unknown;
    setState(state: PartnerState | ((state: PartnerState) => PartnerState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<PartnerState, PartnerState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: PartnerState) => void) => () => void;
        onFinishHydration: (fn: (state: PartnerState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<PartnerState, PartnerState, unknown>>;
    };
}>;
export {};
