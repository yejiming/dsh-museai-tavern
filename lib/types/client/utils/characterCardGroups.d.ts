import type { PartnerItem } from '../stores/usePartnerStore';
export declare const UNASSIGNED_CHARACTER_CARD_GROUP_ID = "__unassigned_character_cards__";
export interface CharacterCardGroup {
    key: string;
    title: string;
    worldBookId: string | null;
    cards: PartnerItem[];
}
export declare const groupCharacterCardsByWorldBook: (worldBooks: PartnerItem[], characterCards: PartnerItem[]) => CharacterCardGroup[];
export declare const getCharacterCardIdsForWorldBook: (worldBookId: string | null | undefined, characterCards: PartnerItem[]) => string[];
