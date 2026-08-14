/**
 * Browser shim for `node:url` (the subset inlined dependencies touch at
 * module scope). URL construction is delegated to the global URL/URLSearchParams.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-url
 */
export function fileURLToPath(url: string | URL): string {
  const href = typeof url === 'string' ? url : url.href
  const parsed = new URL(href)
  if (parsed.protocol !== 'file:') throw new Error(`node:url shim: not a file URL: ${href}`)
  return decodeURIComponent(parsed.pathname)
}
export function pathToFileURL(path: string): URL {
  return new URL(`file://${encodeURIComponent(path).replace(/%2F/g, '/')}`)
}
export function parse(input: string): URL {
  return new URL(input)
}
export default { fileURLToPath, pathToFileURL, parse }
