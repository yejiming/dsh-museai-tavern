/**
 * Bundle smoke test: load the built browser artifact (lib/client.js) in a VM
 * with a stub window.__ModuleLoader__ and verify the museai module registers
 * and its factory yields the expected exports (apply/inject) without throwing.
 * This catches closure-factory / module-graph integration errors that unit
 * tests cannot see.
 * @module @yejiming/dsh-museai-tavern/tests/client-bundle.smoke
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'

let bundle: string
let registration: { id: string; factory: (require: (id: string) => unknown) => unknown } | null = null
let client: { apply: (ctx: unknown) => void; inject: string[] }

/** Minimal React surface antd/rc-* touch at module scope during evaluation. */
const reactStub = {
  version: '18.2.0',
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useInsertionEffect: () => {},
  useRef: () => ({ current: undefined }),
  useMemo: (fn: unknown) => (typeof fn === 'function' ? fn() : fn),
  useCallback: (fn: unknown) => fn,
  useContext: () => undefined,
  useReducer: () => [undefined, () => {}],
  useImperativeHandle: () => {},
  useDebugValue: () => {},
  useId: () => 'smoke-id',
  useTransition: () => [false, (fn: () => void) => fn()],
  useDeferredValue: (v: unknown) => v,
  forwardRef: (fn: unknown) => fn,
  memo: (fn: unknown) => fn,
  lazy: (fn: unknown) => ({ then: fn }),
  createContext: () => ({ Provider: 'div', Consumer: 'div' }),
  createElement: () => null,
  createRef: () => ({ current: undefined }),
  cloneElement: (el: unknown) => el,
  isValidElement: () => false,
  Children: { map: (c: unknown, fn: unknown) => (fn as (x: unknown) => unknown)(c), forEach: () => {}, toArray: (c: unknown) => [c], count: () => 0 },
  Fragment: 'div',
  StrictMode: 'div',
  Suspense: 'div',
  Component: class {},
  PureComponent: class {},
  startTransition: (fn: () => void) => fn(),
  default: {} as Record<string, unknown>,
}
reactStub.default = reactStub

beforeAll(() => {
  bundle = readFileSync(join(process.cwd(), 'lib', 'client.js'), 'utf8')
})

describe('lib/client.js bundle', () => {
  it('registers under the plugin id through __ModuleLoader__.load', () => {
    const sandbox: Record<string, unknown> = {
      window: {
        __ModuleLoader__: {
          load: (entry: { id: string; factory: (require: (id: string) => unknown) => unknown }) => {
            registration = entry
            return {}
          },
        },
      },
      module: { exports: {} },
      exports: {},
    }
    vm.createContext(sandbox)
    vm.runInContext(bundle, sandbox)
    expect(registration).not.toBeNull()
    expect(registration?.id).toBe('@yejiming/dsh-museai-tavern')
  })

  it('factory evaluates and exports apply/inject with the expected shape', () => {
    expect(registration).not.toBeNull()
    const requireStub = (id: string): unknown => {
      // Platform modules are external. antd/rc-* call many React APIs at
      // module scope (forwardRef, createContext, ...), so the react stub
      // needs the full surface; everything else can be a bare stub.
      if (id === 'react') {
        return reactStub
      }
      if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') {
        return { jsx: () => null, jsxs: () => null, Fragment: 'div' }
      }
      if (id === 'react-dom' || id === 'react-dom/client') {
        return { render: () => {}, createRoot: () => ({ render: () => {} }) }
      }
      throw new Error(`Browser bundle requires an unavailable platform module: ${id}`)
    }
    client = registration!.factory(requireStub) as typeof client
    expect(typeof client.apply).toBe('function')
    expect(client.inject).toEqual(['slots', 'locale'])
  })

  it('registers and disposes the tab with the real DSH 0.2 slot core', () => {
    const slots = new SlotCore()
    const disposeShell = slots.register({
      name: 'root',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    }, () => null)
    const effects: Array<() => void> = []
    const dictionaries = new Map<string, Record<string, Record<string, string>>>()
    client.apply({
      effect: (setup: () => () => void) => effects.push(setup()),
      slots: {
        inject: (_key: string, setup: () => () => void) => effects.push(setup()),
        register: slots.register.bind(slots),
      },
      locale: {
        register: (ns: string, dicts: Record<string, Record<string, string>>) => {
          dictionaries.set(ns, dicts)
          return () => dictionaries.delete(ns)
        },
        bind: (ns: string) => (key: string) => dictionaries.get(ns)?.en[key],
      },
    })
    const entries = slots.entriesOfSlot('conversation.view')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ options: { id: 'museai', order: 15 }, locale: 'museai' })
    expect((entries[0].options.label as () => string)()).toBe('MuseAI')
    for (const dispose of effects.reverse()) dispose()
    expect(slots.entriesOfSlot('conversation.view')).toHaveLength(0)
    expect(dictionaries.size).toBe(0)
    disposeShell()
  })
})
