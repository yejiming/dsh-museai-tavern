/**
 * Browser shim for `node:process`, satisfying module-scope `process.env`
 * reads in inlined dependencies (unified/remark internals). No Node runtime
 * exists in the browser; callers must never depend on real process behavior.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-process
 */
declare const env: Record<string, string | undefined>;
declare const _default: {
    env: Record<string, string | undefined>;
    platform: string;
    arch: string;
    version: string;
    versions: {};
};
export default _default;
export { env };
