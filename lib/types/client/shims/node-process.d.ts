/**
 * Browser shim for `node:process`, satisfying module-scope and runtime
 * `process.*` reads in inlined dependencies (unified/remark internals, vfile).
 * No Node runtime exists in the browser; callers must never depend on real
 * process behavior. `cwd` is exercised by vfile when constructing markdown
 * VFiles — it must exist or every ReactMarkdown render crashes.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-process
 */
declare const env: Record<string, string | undefined>;
/** vfile uses the cwd to resolve relative paths; browser text rendering never
 * resolves real files, so a fixed root is safe. */
export declare function cwd(): string;
declare const _default: {
    env: Record<string, string | undefined>;
    cwd: typeof cwd;
    platform: string;
    arch: string;
    version: string;
    versions: {};
    stdin: undefined;
    stdout: undefined;
    stderr: undefined;
};
export default _default;
export { env };
