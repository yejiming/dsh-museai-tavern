/**
 * Browser shim for `node:process`, satisfying module-scope `process.env`
 * reads in inlined dependencies (unified/remark internals). No Node runtime
 * exists in the browser; callers must never depend on real process behavior.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-process
 */
const env: Record<string, string | undefined> = {
  NODE_ENV: 'production',
}
export default { env, platform: 'browser', arch: 'browser', version: '', versions: {} }
export { env }
