/**
 * Browser shim for `node:path` (posix subset), satisfying module-scope
 * imports in inlined dependencies (vfile/unified). Only the rarely-called
 * pure functions are implemented; anything exotic throws.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-path
 */
function normalizeString(path: string): string {
  return path.replace(/\\/g, '/')
}
export function basename(path: string): string {
  const parts = normalizeString(path).split('/')
  return parts[parts.length - 1] ?? ''
}
export function dirname(path: string): string {
  const parts = normalizeString(path).split('/')
  parts.pop()
  return parts.join('/') || '.'
}
export function extname(path: string): string {
  const base = basename(path)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}
export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/')
}
export function resolve(...parts: string[]): string {
  return join(...parts)
}
export function isAbsolute(path: string): boolean {
  return normalizeString(path).startsWith('/')
}
export function relative(from: string, to: string): string {
  const fromParts = normalizeString(from).split('/').filter(Boolean)
  const toParts = normalizeString(to).split('/').filter(Boolean)
  let common = 0
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common++
  return [...Array(fromParts.length - common).fill('..'), ...toParts.slice(common)].join('/')
}
export function normalize(path: string): string {
  return normalizeString(path)
}
export function sep(): string {
  return '/'
}
export const posix = { basename, dirname, extname, join, resolve, isAbsolute, relative, normalize, sep }
export default { basename, dirname, extname, join, resolve, isAbsolute, relative, normalize, sep, posix }
