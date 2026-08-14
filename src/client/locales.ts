/** `museai` namespace dictionaries for the MuseAI tavern tab. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'museai'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'tab.label': 'MuseAI',
  'nav.background': '背景',
  'nav.chat': '聊天',
  'nav.adventure': '冒险',
  'nav.bond': '羁绊',
  'nav.settings': '设置',
  'view.title': 'MuseAI',
  'view.subtitle': '背景 · 聊天 · 冒险 · 羁绊 · 设置',
} satisfies Record<string, string>

/** The museai namespace key union. */
export type MuseAIKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'tab.label': 'MuseAI',
  'nav.background': 'Background',
  'nav.chat': 'Chat',
  'nav.adventure': 'Adventure',
  'nav.bond': 'Bond',
  'nav.settings': 'Settings',
  'view.title': 'MuseAI',
  'view.subtitle': 'Background · Chat · Adventure · Bond · Settings',
} satisfies Record<MuseAIKey, string>
