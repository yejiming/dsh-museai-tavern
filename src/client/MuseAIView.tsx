/**
 * The MuseAI conversation view: the tab content right of Trajectory. A shell
 * with five internal pages — 背景 (Background) / 聊天 (Chat) / 冒险 (Adventure) /
 * 羁绊 (Bond) / 设置 (Settings) — rendered inside the conversation view ring,
 * one-at-a-time by the session body. The component unmounts on tab switches,
 * so all MuseAI state lives behind the plugin's routes (the store domain),
 * never in component state beyond the active page.
 *
 * While this view is active the platform composer seat is hidden (the view
 * marks the document root with a class and the stylesheet hides
 * `[data-composer-seat]` under it).
 */
import { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation view-slot declaration and the
// framework-standard view props into this program.
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS, type MuseAIKey } from './locales.ts'
import { injectMuseaiStyles } from './styles.ts'
import { BackgroundPage } from './pages/Background.tsx'
import { ChatPage } from './pages/Chat.tsx'
import { AdventurePage } from './pages/Adventure.tsx'
import { BondPage } from './pages/Bond.tsx'
import { SettingsPage } from './pages/Settings.tsx'

/** The MuseAI tab's full component props: the framework view seat + the locale seat. */
export type MuseAIViewProps = ConvViewProps & PropsLocale<'museai'>

const PAGE_TABS: readonly { key: string; labelKey: MuseAIKey }[] = [
  { key: 'background', labelKey: 'nav.background' },
  { key: 'chat', labelKey: 'nav.chat' },
  { key: 'adventure', labelKey: 'nav.adventure' },
  { key: 'bond', labelKey: 'nav.bond' },
  { key: 'settings', labelKey: 'nav.settings' },
]

/**
 * The MuseAI session view: header tabs + scrollable page area.
 * @param props - framework view props (sessionId etc., unused for now) and
 * the locale seat.
 */
export function MuseAIView(props: MuseAIViewProps): JSX.Element {
  const { t } = props
  const [active, setActive] = useState('background')

  useEffect(() => {
    injectMuseaiStyles()
    document.documentElement.classList.add('museai-view-active')
    return () => {
      document.documentElement.classList.remove('museai-view-active')
    }
  }, [])

  return (
    <div className="museai-view-root">
      <Tabs
        className="museai-tabs"
        activeKey={active}
        onChange={setActive}
        items={PAGE_TABS.map(({ key, labelKey }) => ({
          key,
          label: t(labelKey),
        }))}
      />
      <div className="museai-view-content">
        {active === 'background' && <BackgroundPage />}
        {active === 'chat' && <ChatPage />}
        {active === 'adventure' && <AdventurePage />}
        {active === 'bond' && <BondPage />}
        {active === 'settings' && <SettingsPage />}
      </div>
    </div>
  )
}

// The locale seat arrives through PropsLocale when `locale: NS` is set on the
// registration; keep the type-check honest by referencing NS here.
void NS
