/** `museai` namespace dictionaries for the MuseAI tavern tab. */
/** Dictionary namespace owned by this plugin. */
export declare const NS = "museai";
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'tab.label': string;
    'nav.background': string;
    'nav.chat': string;
    'nav.adventure': string;
    'nav.bond': string;
    'nav.settings': string;
    'view.title': string;
    'view.subtitle': string;
};
/** The museai namespace key union. */
export type MuseAIKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'tab.label': string;
    'nav.background': string;
    'nav.chat': string;
    'nav.adventure': string;
    'nav.bond': string;
    'nav.settings': string;
    'view.title': string;
    'view.subtitle': string;
};
