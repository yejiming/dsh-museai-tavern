/**
 * Browser shim for `node:process`, satisfying module-scope and runtime
 * `process.*` reads in inlined dependencies (unified/remark internals, vfile).
 * No Node runtime exists in the browser; callers must never depend on real
 * process behavior. `cwd` is exercised by vfile when constructing markdown
 * VFiles — it must exist or every ReactMarkdown render crashes.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-process
 */
const env: Record<string, string | undefined> = {
  NODE_ENV: 'production',
}

/** vfile uses the cwd to resolve relative paths; browser text rendering never
 * resolves real files, so a fixed root is safe. */
export function cwd(): string {
  return '/'
}

export default {
  env,
  cwd,
  platform: 'browser',
  arch: 'browser',
  version: '',
  versions: {},
  stdin: undefined,
  stdout: undefined,
  stderr: undefined,
}
export { env }
