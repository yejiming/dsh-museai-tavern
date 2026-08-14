/**
 * Contract test for the browser `node:process` shim: inlined dependencies
 * (unified/vfile) call `process.cwd()` when constructing markdown VFiles —
 * the crash class that took down the whole MuseAI view on first message
 * render. The shim must stay callable for the full member surface the bundle
 * touches at runtime.
 * @module @yejiming/dsh-museai-tavern/tests/node-shims
 */

import { describe, it, expect } from 'vitest'
import nodeProcessShim from '../src/client/shims/node-process.ts'
import nodePathShim from '../src/client/shims/node-path.ts'
import nodeUrlShim from '../src/client/shims/node-url.ts'

describe('node:process browser shim', () => {
  it('provides cwd/env/stdin/stdout as callable or defined members', () => {
    expect(typeof nodeProcessShim.cwd).toBe('function')
    expect(nodeProcessShim.cwd()).toBe('/')
    expect(nodeProcessShim.env).toMatchObject({ NODE_ENV: 'production' })
    expect(nodeProcessShim).toHaveProperty('platform')
    // stdin/stdout/stderr exist (undefined) so property reads never throw.
    expect('stdin' in nodeProcessShim).toBe(true)
    expect('stdout' in nodeProcessShim).toBe(true)
    expect('stderr' in nodeProcessShim).toBe(true)
  })
})

describe('node:path browser shim', () => {
  it('implements the pure functions vfile uses', () => {
    expect(nodePathShim.basename('/a/b.md')).toBe('b.md')
    expect(nodePathShim.dirname('/a/b.md')).toBe('/a')
    expect(nodePathShim.extname('/a/b.md')).toBe('.md')
    expect(nodePathShim.join('a', 'b')).toBe('a/b')
    expect(nodePathShim.isAbsolute('/a')).toBe(true)
    expect(nodePathShim.isAbsolute('a')).toBe(false)
  })
})

describe('node:url browser shim', () => {
  it('converts file URLs to paths and back', () => {
    expect(nodeUrlShim.fileURLToPath('file:///a/b.md')).toBe('/a/b.md')
    const back = nodeUrlShim.pathToFileURL('/a/b.md')
    expect(back.href).toMatch(/^file:\/\//)
  })
})
