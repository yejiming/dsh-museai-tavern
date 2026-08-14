/**
 * Standalone build config for the merged museai-tavern package: the node-half
 * library (lib/index.js host row + lib/routes.js routes row) and the browser
 * client bundle (lib/client.js), replicating the harness's shared client
 * preset (packages/client/tsdown.client.ts): a closure-factory artifact
 * calling window.__ModuleLoader__.load({id, factory}), with platform modules
 * resolved through the injected require (the loader module table), CSS
 * Modules compiled by lightningcss and injected as plugin-owned style tags,
 * and plain global CSS (museai.app.css) injected as a side-effect style tag.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath, sep } from 'node:path'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

/** Plugin id (package name), stamped into the __ModuleLoader__.load handoff. */
const PLUGIN_ID = '@yejiming/dsh-museai-tavern'

/** Shared browser platform modules the shell seeds into the frozen module table. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-schema-form',
] as const

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
/** Virtual-id wrapper for plain (non-module) CSS: side-effect style injection. */
const PLAIN_CSS_VIRTUAL_PREFIX = '\0dsh-css-plain:'
const PLAIN_CSS_VIRTUAL_SUFFIX = '.mjs'

/** Node-half library: the host row and the routes row. */
const nodeHalf: UserConfig = {
  name: PLUGIN_ID,
  entry: {
    index: 'src/index.ts',
    routes: 'src/routes.ts',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

/**
 * Browser bundle: CJS closure-factory artifact. Externals resolve from the
 * loader module table; everything else (antd, zustand, react-markdown, the
 * ported MuseAI pages) inlines. CSS Modules compile to a hashed class map
 * plus an idempotent <style data-plugin> injection.
 */
const client: UserConfig = {
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...PLATFORM_MODULES],
  // Inlined dependencies (unified/remark internals, vfile) import node
  // builtins at module scope; the browser has none, so they resolve to the
  // plugin's own shims instead of the loader module table.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // No opinion for table entries (external wins above); bundle everything else.
  noExternal: (id: string) => PLATFORM_MODULES.includes(id as (typeof PLATFORM_MODULES)[number]) ? undefined : true,
  plugins: [{
    // Inlined dependencies (unified/remark internals, vfile) import node
    // builtins at module scope; the browser has none, so they resolve to the
    // plugin's own shims instead of the loader module table.
    name: 'dsh-node-builtin-shims',
    resolveId(source: string) {
      if (source === 'node:process') return resolvePath('src/client/shims/node-process.ts')
      if (source === 'node:path') return resolvePath('src/client/shims/node-path.ts')
      if (source === 'node:url') return resolvePath('src/client/shims/node-url.ts')
      return null
    },
  }, {
    // Bundle purity gate (mirror of the module-edge rules): platform seed
    // entries stay external, every other @deepseek-ai value import is a
    // build error — cross-plugin collaboration goes through cordis services.
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (PLATFORM_MODULES.includes(source as (typeof PLATFORM_MODULES)[number])) return null
      throw new Error(
        `client bundle purity: "${source}" is not a platform module — cross-plugin value imports are forbidden; `
        + 'collaborate through cordis services (type-only imports are erased and never reach this gate)',
      )
    },
  }, {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, entry] of Object.entries(cssExports ?? {})) classMap[local] = entry.name
      const tagId = `${PLUGIN_ID}/${basename(fileId)}`
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
        `  const tag = document.createElement('style');`,
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }, {
    // Plain global CSS (museai.app.css): side-effect import that injects one
    // idempotent <style data-plugin-css> tag; the module exports nothing.
    name: 'dsh-css-plain-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
      return PLAIN_CSS_VIRTUAL_PREFIX + abs + PLAIN_CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(PLAIN_CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(PLAIN_CSS_VIRTUAL_PREFIX.length, -PLAIN_CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code } = transform({ filename: fileId, code: source, minify: true })
      const tagId = `${PLUGIN_ID}/${basename(fileId)}`
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
        `  const tag = document.createElement('style');`,
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeHalf, client]

/** Resolve an emitted JS asset import against its source-tree counterpart. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}
