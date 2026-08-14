/**
 * Regression test for the background-page port: the AI smart extraction of
 * world books / character cards (MuseAI `backgroundExtraction` pipeline) must
 * be absent from the ported page — no imports, no state, no UI entry, no
 * Tauri extraction calls. All other management features must remain.
 * @module @yejiming/dsh-museai-tavern/tests/background-port
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pagePath = join(process.cwd(), 'src', 'client', 'pages', 'Background.tsx')
const page = readFileSync(pagePath, 'utf8')

describe('Background page port (AI extraction excluded)', () => {
  it('does not import the extraction pipeline', () => {
    expect(page).not.toContain('backgroundExtraction')
    expect(page).not.toContain('runCharacterExtractionBatch')
    expect(page).not.toContain('splitCharacterNames')
    expect(page).not.toContain('CharacterExtractionItem')
    expect(page).not.toContain('BackgroundExtractionMode')
  })

  it('does not reference extraction state, handlers, or UI', () => {
    for (const symbol of [
      'isAiModalOpen',
      'selectedFilePaths',
      'extractionMode',
      'extractionStep',
      'manualCharacterNames',
      'characterStatuses',
      'handleStartExtraction',
      'runCharacterExtraction',
      'loadWorkspaceFiles',
      'generate_background_stage_one',
      'generate_background_character_card',
      'cancel_background_task',
    ]) {
      expect(page, `must not contain ${symbol}`).not.toContain(symbol)
    }
  })

  it('keeps the manual management features', () => {
    for (const symbol of [
      'renderWorldBookForm',
      'renderCharacterCardForm',
      'groupCharacterCardsByWorldBook',
      'StylePresetManager',
      'StylePresetEditor',
      'SillyTavernExportPreviewModal',
      'importPartnerItemsPackage',
      'exportPartnerItem',
    ]) {
      expect(page, `must keep ${symbol}`).toContain(symbol)
    }
  })

  it('has no Tauri calls left', () => {
    expect(page).not.toContain('@tauri-apps')
    expect(page).not.toContain('invoke(')
    expect(page).not.toContain('listen(')
  })

  it('exports the BackgroundPage component for the view shell', () => {
    expect(page).toMatch(/export function BackgroundPage|export const BackgroundPage/)
  })
})
